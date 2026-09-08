"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  engineMessage,
  evaluateNumber,
  fillMessage,
  INDEX_RANGE,
  OPERATOR_CODE,
} from "@/lib/numberEngine";
import {
  buildIndex,
  findSimilar,
  parseQuery,
  PATTERN_FAMILIES,
  runSearch,
  type IndexRecord,
  type MaskPosition,
} from "@/lib/numberSearch";
import {
  NUMBER_TYPES,
  OPERATORS,
  OPERATOR_META,
  TIERS,
  TIER_EMOJI,
  type Listing,
} from "@/lib/supabase";
import ListingCard, { activePromo, type ValuedListing } from "./ListingCard";
import MaskSearch from "./MaskSearch";

type Props = {
  listings: Listing[];
  initialOperator?: string;
  initialTier?: string;
  initialType?: string;
  initialSort?: string;
  initialMask?: string;
  initialWhere?: string;
  initialPreset?: string;
};

function OperatorBadge({ op, small }: { op: string; small?: boolean }) {
  const meta = OPERATOR_META[op] ?? {
    abbr: op.slice(0, 2).toUpperCase(),
    color: "var(--faint)",
    logo: undefined,
  };
  const cls = "operator-badge" + (small ? " operator-badge-sm" : "");

  return meta.logo ? (
    <span className={cls} title={op}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={meta.logo} alt={op} />
    </span>
  ) : (
    <span className={cls} style={{ background: meta.color }} title={op}>
      {meta.abbr}
    </span>
  );
}



/**
 * Статусы в фильтре — от дорогого к дешёвому и без «Обычного»: номера без узора
 * на площадке не публикуются, фильтровать по ним нечего.
 */
/** Все восемь статусов: обычные номера тоже размещаются и тоже ищутся. */
const ALL_TIERS = TIERS.map((x) => x.name);

/** Готовые узоры: каждый — семейство кодов, которые возвращает движок. */
const PRESETS = [
  { id: "mirror", prefixes: ["pal."] },
  { id: "triple", prefixes: ["run.3", "run.4", "run.5", "run.6"] },
  { id: "pairRepeat", prefixes: ["block.pair.", "pairs."] },
  { id: "round", prefixes: ["zeros.tail."] },
  { id: "ladder", prefixes: ["seq."] },
] as const;
const splitParam = (value?: string) =>
  value ? value.split(",").filter(Boolean) : [];

export default function HomeClient({
  listings,
  initialOperator = "",
  initialTier = "",
  initialType = "",
  initialSort = "",
  initialMask = "",
  initialWhere = "any",
  initialPreset = "",
}: Props) {
  const locale = useLocale();
  const t = useTranslations("home");
  const tTier = useTranslations("tiers");
  const tType = useTranslations("numberTypes");

  // Оценка для каждого объявления. Сохранённая при публикации важнее пересчитанной:
  // объявление должно помнить, по какой версии движка его оценили.
  const valued: ValuedListing[] = useMemo(
    () =>
      listings.map((l) => {
        const v = evaluateNumber(l.phone_number, {
          operator: OPERATOR_CODE[l.operator] ?? null,
          heldOverLimit: l.held_over_limit,
          locale,
        });
        const fee = v.ok ? v.transferFee : 0;
        return {
          listing: l,
          index: l.beauty_index ?? (v.ok ? v.index : null),
          patternCode: l.pattern_code ?? (v.ok ? v.patternCode : null),
          pattern: v.ok ? v.pattern : null,
          window: v.ok ? v.window : null,
          patternFrom: v.ok ? v.patternFrom : null,
          patternTo: v.ok ? v.patternTo : null,
          fee,
          total: l.price + fee,
          // Запись для модуля поиска: маска, счётчики цифр, вид узора.
          search: v.ok ? buildIndex(v) : null,
        };
      }),
    [listings]
  );

  // Верхняя граница ползунка — по полной стоимости, ведь по ней и фильтруем.
  const maxPrice = useMemo(
    () => Math.max(TIERS[0].price, ...valued.map((x) => x.total), 1),
    [valued]
  );

  const [selectedOperators, setSelectedOperators] = useState<string[]>(
    splitParam(initialOperator)
  );
  const [selectedTiers, setSelectedTiers] = useState<string[]>(
    splitParam(initialTier)
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    splitParam(initialType)
  );
  const [sort, setSort] = useState<string>(initialSort);
  const [mask, setMask] = useState<string>(initialMask);
  /** Где в номере должна стоять маска. Считается по шести цифрам после кода. */
  const [where, setWhere] = useState<MaskPosition>(
    (["any", "start", "middle", "end"] as const).includes(
      initialWhere as MaskPosition
    )
      ? (initialWhere as MaskPosition)
      : "any"
  );
  const [preset, setPreset] = useState<string>(initialPreset);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, maxPrice]);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyDescribed, setOnlyDescribed] = useState(false);
  // Чего маска не даёт в принципе: «цифра 4 встречается не менее пяти раз».
  const [countDigit, setCountDigit] = useState("");
  const [countMin, setCountMin] = useState(2);
  const [family, setFamily] = useState("");

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) =>
    setter((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );

  const setMin = (value: number) =>
    setPriceRange(([, hi]) => [Math.max(0, Math.min(value, hi)), hi]);
  const setMax = (value: number) =>
    setPriceRange(([lo]) => [lo, Math.min(maxPrice, Math.max(value, lo))]);

  const hasActiveFilters =
    selectedOperators.length > 0 ||
    selectedTiers.length > 0 ||
    selectedTypes.length > 0 ||
    !!mask.trim() ||
    !!preset ||
    onlyVerified ||
    onlyDescribed ||
    !!countDigit ||
    !!family ||
    priceRange[0] > 0 ||
    priceRange[1] < maxPrice;

  function resetFilters() {
    setSelectedOperators([]);
    setSelectedTiers([]);
    setSelectedTypes([]);
    setSort("");
    setMask("");
    setWhere("any");
    setPreset("");
    setOnlyVerified(false);
    setOnlyDescribed(false);
    setCountDigit("");
    setFamily("");
    setPriceRange([0, maxPrice]);
  }

  // Счётчики считаются по всему списку, без учёта активных фильтров.
  const operatorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const op of OPERATORS) counts[op] = 0;
    for (const l of listings) counts[l.operator] = (counts[l.operator] ?? 0) + 1;
    return counts;
  }, [listings]);

  const presetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of PRESETS) {
      counts[p.id] = valued.filter(
        (x) =>
          x.patternCode !== null &&
          p.prefixes.some((prefix) => x.patternCode!.startsWith(prefix))
      ).length;
    }
    return counts;
  }, [valued]);

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tier of ALL_TIERS) counts[tier] = 0;
    for (const l of listings) counts[l.status_tier] = (counts[l.status_tier] ?? 0) + 1;
    return counts;
  }, [listings]);


  // Состояние поиска пишется в адрес страницы, иначе при смене языка оно теряется:
  // страница перезагружается, а фильтры живут только в памяти вкладки.
  // replaceState вместо роутера — правка адреса не должна дёргать сервер на каждую цифру.
  useEffect(() => {
    const q = new URLSearchParams();
    if (selectedOperators.length) q.set("operator", selectedOperators.join(","));
    if (selectedTiers.length) q.set("tier", selectedTiers.join(","));
    if (selectedTypes.length) q.set("type", selectedTypes.join(","));
    if (sort) q.set("sort", sort);
    if (mask.trim()) q.set("mask", mask.trim());
    if (where !== "any") q.set("where", where);
    if (preset) q.set("preset", preset);

    const query = q.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname
    );
  }, [selectedOperators, selectedTiers, selectedTypes, sort, mask, where, preset]);

  // Активные фильтры показываются чипами над списком: видно, что именно сузило
  // выдачу, и каждый снимается по отдельности, не сбрасывая остальные.
  const activeChips: { key: string; label: string; clear: () => void }[] = [
    ...selectedOperators.map((op) => ({
      key: `op:${op}`,
      label: op === "Другие" ? t("filters.otherOperator") : op,
      clear: () => toggle(setSelectedOperators, op),
    })),
    ...selectedTiers.map((tier) => ({
      key: `tier:${tier}`,
      label: tTier(tier),
      clear: () => toggle(setSelectedTiers, tier),
    })),
    ...selectedTypes.map((type) => ({
      key: `type:${type}`,
      label: tType(type),
      clear: () => toggle(setSelectedTypes, type),
    })),
    ...(preset
      ? [{ key: "preset", label: t(`presets.${preset}`), clear: () => setPreset("") }]
      : []),
    ...(mask.trim()
      ? [{ key: "mask", label: mask.trim(), clear: () => setMask("") }]
      : []),
    ...(onlyVerified
      ? [{ key: "verified", label: t("filters.onlyVerified"), clear: () => setOnlyVerified(false) }]
      : []),
    ...(onlyDescribed
      ? [
          {
            key: "described",
            label: t("filters.onlyDescribed"),
            clear: () => setOnlyDescribed(false),
          },
        ]
      : []),
  ];

  const presetPrefixes = PRESETS.find((p) => p.id === preset)?.prefixes;

  // Написанное человеком разбирает сам модуль: он знает и «?», и «*», и то,
  // что «5x5» — это «пятёрка пять раз», а не маска. Сайт ничего не угадывает.
  const query = useMemo(
    () =>
      parseQuery(mask, {
        where,
        counts: countDigit ? [{ digit: countDigit, min: countMin }] : [],
        family: family || null,
      }),
    [mask, where, countDigit, countMin, family]
  );

  /** Задан ли вообще запрос: пустая строка без условий — это «показать всё». */
  const hasQuery = !!mask.trim() || !!countDigit || !!family;

  /**
   * Строка под полем поиска: расшифровка запроса словами либо причина отказа.
   *
   * Расшифровка обязательна — она страхует от «модуль понял не так». Части
   * складываются: маска и «цифра не менее N раз» могут работать вместе.
   */
  const queryStatus = useMemo(() => {
    if (query.error) {
      // Пустой запрос — не ошибка, а обычное начальное состояние страницы.
      const empty = query.error === "search.empty";
      if (empty && !hasQuery) {
        return { text: engineMessage("search.empty", locale), error: false };
      }
      return { text: engineMessage(query.error, locale), error: true };
    }

    const parts: string[] = [];
    if (query.mask) {
      parts.push(
        fillMessage(engineMessage("search.hint." + query.where, locale), {
          mask: query.mask,
        })
      );
    }
    for (const c of query.counts) {
      parts.push(
        fillMessage(engineMessage("search.hint.count", locale), {
          digit: c.digit,
          min: c.min,
          n: c.min,
        })
      );
    }
    if (!parts.length) return null;
    return { text: parts.join(" "), error: false };
  }, [query, hasQuery, locale]);

  /** Нужен ли модуль поиска: без маски, счётчика и вида узора он не при чём. */
  const needsSearch = hasQuery && !query.error;

  const records = useMemo(
    () =>
      valued.map((x) => x.search).filter((r): r is IndexRecord => r !== null),
    [valued]
  );

  /** Окна номеров, прошедших поиск. Сам поиск делает модуль, а не сайт. */
  const searchHits = useMemo(() => {
    if (!needsSearch) return null;
    return new Set(runSearch(records, query).map((r) => r.w));
  }, [needsSearch, records, query]);

  const visible = useMemo(() => {
    const filtered = valued.filter(
      ({ listing: l, patternCode, total, search: rec }) =>
        (!selectedOperators.length || selectedOperators.includes(l.operator)) &&
        (!selectedTiers.length || selectedTiers.includes(l.status_tier)) &&
        (!selectedTypes.length || selectedTypes.includes(l.number_type)) &&
        // Диапазон считается по ПОЛНОЙ стоимости: покупатель платит цену продавца
        // плюс сбор оператора, и искать логично по тому, что он отдаст на руки.
        !(total < priceRange[0]) &&
        !(total > priceRange[1]) &&
        (!onlyVerified || l.number_verified) &&
        (!onlyDescribed || !!l.description) &&
        // Маску, счётчики цифр и вид узора проверяет модуль поиска.
        (!searchHits || (rec !== null && searchHits.has(rec.w))) &&
        (!presetPrefixes ||
          (patternCode !== null &&
            presetPrefixes.some((prefix) => patternCode.startsWith(prefix))))
    );

    // Продвинутые объявления идут первыми при ЛЮБОЙ сортировке — за это и платят.
    // Внутри своей группы они упорядочиваются наравне со всеми, поэтому оплата
    // поднимает объявление, но не ломает выбранный человеком порядок.
    const promoted = (x: ValuedListing) =>
      activePromo(x.listing) === "top" ? 0 : 1;

    const by = (rank: (x: ValuedListing) => number) =>
      [...filtered].sort(
        (a, b) => promoted(a) - promoted(b) || rank(a) - rank(b)
      );

    if (sort === "price_asc") return by((x) => x.listing.price);
    if (sort === "price_desc") return by((x) => -x.listing.price);
    if (sort === "index_desc") return by((x) => -(x.index ?? -1));
    if (sort === "total_asc") return by((x) => x.total);
    if (sort === "total_desc") return by((x) => -x.total);
    return by((x) => -new Date(x.listing.created_at).getTime());
  }, [
    valued,
    selectedOperators,
    selectedTiers,
    selectedTypes,
    sort,
    mask,
    priceRange,
    presetPrefixes,
    searchHits,
    onlyVerified,
    onlyDescribed,
  ]);

  /** Похожие номера: считаются только когда точных совпадений нет. */
  const similar = useMemo(() => {
    if (!needsSearch || visible.length > 0) return [];
    const windows = new Set(findSimilar(records, query).map((r) => r.w));
    return valued.filter((x) => x.search !== null && windows.has(x.search.w));
  }, [needsSearch, visible.length, records, query, valued]);

  return (
    <>
      <section className="hero hero-search">
        <div className="hero-search-text">
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1>{t("searchTitle")}</h1>
          <p>{t("searchSubtitle")}</p>
        </div>

        <div className="hero-counters">
          <span>{t("counters", { count: listings.length })}</span>
          <span>{t("operatorsCount", { count: OPERATORS.length })}</span>
        </div>

        <MaskSearch
          mask={mask}
          where={where}
          onMaskChange={setMask}
          onWhereChange={setWhere}
          status={queryStatus}
        />

      </section>

      <div className="board">
        <aside className="filters">
        <div className="filter-group">
          <div className="filter-group-label">{t("filters.operatorLabel")}</div>
          <div className="operator-toggle-row">
            {OPERATORS.map((op) => {
              const active = selectedOperators.includes(op);
              return (
                <button
                  key={op}
                  type="button"
                  className={"operator-toggle" + (active ? " active" : "")}
                  aria-pressed={active}
                  onClick={() => toggle(setSelectedOperators, op)}
                >
                  <OperatorBadge op={op} />
                  <span className="operator-toggle-name">{op === "Другие" ? t("filters.otherOperator") : op}</span>
                  <span className="operator-toggle-count">
                    {operatorCounts[op] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-group-label">{t("filters.statusLabel")}</div>
          <p className="filters-hint">{t("filters.statusHint")}</p>
          <div className="tier-list">
            {ALL_TIERS.map((tier) => {
              const active = selectedTiers.includes(tier);
              return (
                <label key={tier} className={"tier-row" + (active ? " active" : "")}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(setSelectedTiers, tier)}
                  />
                  <span className={`tier-edge tier-bar-${tier}`} aria-hidden="true" />
                  <span className="tier-row-text">
                    <b>{tTier(tier)}</b>
                    <span>
                      {t("filters.indexShortLabel")} {INDEX_RANGE[tier]}
                    </span>
                  </span>
                  <span className="tier-row-count">{tierCounts[tier] ?? 0}</span>
                </label>
              );
            })}
          </div>

        </div>

        <div className="filter-group">
          <div className="filter-group-label">{t("filters.typeLabel")}</div>
          <div className="type-toggle-row">
            {NUMBER_TYPES.map((type) => {
              const active = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  className={"type-toggle" + (active ? " active" : "")}
                  aria-pressed={active}
                  onClick={() => toggle(setSelectedTypes, type)}
                >
                  {tType(type)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-group-label">{t("filters.totalPriceLabel")}</div>
          <p className="filters-hint">{t("filters.totalPriceHint")}</p>
          <div className="price-range">
            <div className="price-range-track-wrap">
              <div className="price-range-fill" />
              <div
                className="price-range-fill-active"
                style={{
                  left: `${maxPrice ? (priceRange[0] / maxPrice) * 100 : 0}%`,
                  right: `${maxPrice ? 100 - (priceRange[1] / maxPrice) * 100 : 0}%`,
                }}
              />
              <input
                type="range"
                min={0}
                max={maxPrice}
                value={priceRange[0]}
                aria-label={t("filters.priceFrom")}
                onChange={(e) => setMin(Number(e.target.value))}
              />
              <input
                type="range"
                min={0}
                max={maxPrice}
                value={priceRange[1]}
                aria-label={t("filters.priceTo")}
                onChange={(e) => setMax(Number(e.target.value))}
              />
            </div>
            <div className="price-range-inputs">
              <input
                type="number"
                className="mono"
                min={0}
                max={priceRange[1]}
                value={priceRange[0]}
                aria-label={t("filters.priceFrom")}
                onChange={(e) => setMin(Number(e.target.value) || 0)}
              />
              <span className="price-range-sep">—</span>
              <input
                type="number"
                className="mono"
                min={priceRange[0]}
                max={maxPrice}
                value={priceRange[1]}
                aria-label={t("filters.priceTo")}
                onChange={(e) => setMax(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>


        <details className="filter-extra">
          <summary>{t("filters.extraLabel")}</summary>

        <div className="filter-group">
          <div className="filter-group-label">{t("presetsLabel")}</div>
          <div className="presets">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={"chip" + (preset === p.id ? " active" : "")}
                aria-pressed={preset === p.id}
                disabled={presetCounts[p.id] === 0}
                onClick={() => setPreset(preset === p.id ? "" : p.id)}
              >
                {t(`presets.${p.id}`)}
                <span className="chip-count">{presetCounts[p.id] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-group-label">{t("filters.digitCountLabel")}</div>
          <div className="count-filter">
            <select value={countDigit} onChange={(e) => setCountDigit(e.target.value)}>
              <option value="">{t("filters.digitAny")}</option>
              {"0123456789".split("").map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span>{t("filters.timesLabel")}</span>
            <select
              value={countMin}
              onChange={(e) => setCountMin(Number(e.target.value))}
              disabled={!countDigit}
            >
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {t("filters.times", { n })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-group-label">{t("filters.familyLabel")}</div>
          <select value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="">{t("filters.familyAny")}</option>
            {PATTERN_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {engineMessage(`family.${f}`, locale)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-group-label">{t("filters.moreLabel")}</div>
          <div className="more-toggles">
            <label>
              <input
                type="checkbox"
                checked={onlyVerified}
                onChange={(e) => setOnlyVerified(e.target.checked)}
              />
              <span>{t("filters.onlyVerified")}</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={onlyDescribed}
                onChange={(e) => setOnlyDescribed(e.target.checked)}
              />
              <span>{t("filters.onlyDescribed")}</span>
            </label>
          </div>
        </div>

        </details>

        </aside>

        <div className="board-results">
          <div className="results-head">
            <span className="results-count">{t("found", { count: visible.length })}</span>

            <div className="active-chips">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="active-chip"
                  onClick={chip.clear}
                >
                  {chip.label}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              {hasActiveFilters && (
                <button type="button" className="reset-all" onClick={resetFilters}>
                  {t("filters.resetAll")}
                </button>
              )}
            </div>

            <label className="results-sort">
              <span>{t("filters.sortLabel")}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="">{t("filters.sortNewest")}</option>
                <option value="index_desc">{t("filters.sortIndex")}</option>
                <option value="price_asc">{t("filters.sortPriceAsc")}</option>
                <option value="price_desc">{t("filters.sortPriceDesc")}</option>
                <option value="total_asc">{t("filters.sortTotalAsc")}</option>
                <option value="total_desc">{t("filters.sortTotalDesc")}</option>
              </select>
            </label>
          </div>
      {visible.length === 0 && !hasActiveFilters && (
        <div className="empty-state">
          <h2>{t("empty.title")}</h2>
          <p>{t("empty.subtitle")}</p>
          <p style={{ marginTop: 16 }}>
            <Link href="/new" className="btn btn-accent">
              {t("empty.cta")}
            </Link>
          </p>
        </div>
      )}

      {visible.length === 0 && hasActiveFilters && similar.length === 0 && (
        <div className="empty-state">
          <h2>{t("emptyFiltered.title")}</h2>
          <p>{t("emptyFiltered.subtitle")}</p>
        </div>
      )}

      {/* Пустая выдача — плохой ответ. Модуль умеет подобрать номера,
          отличающиеся одной цифрой: чаще всего человеку подойдёт и такой. */}
      {visible.length === 0 && similar.length > 0 && (
        <div className="similar-block">
          <p className="similar-title">{t("similarTitle")}</p>
          <div className="listing-cards">
            {similar.map((item) => (
              <ListingCard key={item.listing.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <div className="listing-cards">
          {visible.map((item) => (
            <ListingCard key={item.listing.id} item={item} />
          ))}
        </div>
      )}
        </div>
      </div>

      <div className="warning-banner">
        <span className="warning-icon" aria-hidden="true">
          ⚠️
        </span>
        <p>{t("warningBanner")}</p>
      </div>
    </>
  );
}
