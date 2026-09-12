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
  PRICE_BUCKETS,
  runSearch,
  type IndexRecord,
  type MaskPosition,
  type PriceBucket,
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
import ValuerCard from "./ValuerCard";

type Props = {
  listings: Listing[];
  initialOperator?: string;
  initialTier?: string;
  initialType?: string;
  initialSort?: string;
  initialMask?: string;
  initialWhere?: string;
  initialFamily?: string;
  initialPrice?: string;
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

const splitParam = (value?: string) =>
  value ? value.split(",").filter(Boolean) : [];

/** Цена внутри корзины. У последней корзины верхней границы нет: max === null. */
const inBucket = (price: number, b: PriceBucket) =>
  price >= b.min && (b.max === null || price < b.max);

export default function HomeClient({
  listings,
  initialOperator = "",
  initialTier = "",
  initialType = "",
  initialSort = "",
  initialMask = "",
  initialWhere = "any",
  initialFamily = "",
  initialPrice = "",
}: Props) {
  const locale = useLocale();
  const t = useTranslations("home");
  const tTier = useTranslations("tiers");
  /** Короткие названия — для узкой колонки фильтров. */
  const tShort = useTranslations("tiersShort");
  const tOpShort = useTranslations("operatorsShort");
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
        // Запись для модуля поиска знает и цену объявления: по ней модуль
        // умеет отбирать сам, когда поиск переедет из памяти в базу.
        const rec = v.ok ? buildIndex(v) : null;
        if (rec) rec.price = l.price;
        return {
          listing: l,
          index: l.beauty_index ?? (v.ok ? v.index : null),
          patternCode: l.pattern_code ?? (v.ok ? v.patternCode : null),
          pattern: v.ok ? v.pattern : null,
          window: v.ok ? v.window : null,
          patternFrom: v.ok ? v.patternFrom : null,
          patternTo: v.ok ? v.patternTo : null,
          fee,
          // Запись для модуля поиска: маска, счётчики цифр, виды узора.
          search: rec,
        };
      }),
    [listings]
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
  /**
   * Цена выбирается готовыми диапазонами, а не ползунком.
   *
   * У ползунка всегда есть верхний конец, и он отсекал самое дорогое — ровно
   * те номера, ради которых площадку и открывают. У последней корзины верхней
   * границы нет вовсе.
   */
  const [buckets, setBuckets] = useState<string[]>(splitParam(initialPrice));
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyDescribed, setOnlyDescribed] = useState(false);
  // Чего маска не даёт в принципе: «цифра 4 встречается не менее пяти раз».
  const [countDigit, setCountDigit] = useState("");
  const [countMin, setCountMin] = useState(2);
  /**
   * Виды узора — выбор нескольких сразу.
   *
   * Один номер почти всегда попадает в несколько видов: 041 10 90 90 — это и
   * повтор блока, и нули. Пока вид выбирался один, разделы «Повторы», «Нули»
   * и «Мало разных цифр» стояли пустыми.
   */
  const [families, setFamilies] = useState<string[]>(splitParam(initialFamily));
  /** На узком экране фильтры живут в выезжающей снизу панели. */
  const [sheetOpen, setSheetOpen] = useState(false);

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) =>
    setter((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );

  const hasActiveFilters =
    selectedOperators.length > 0 ||
    selectedTiers.length > 0 ||
    selectedTypes.length > 0 ||
    !!mask.trim() ||
    onlyVerified ||
    onlyDescribed ||
    !!countDigit ||
    families.length > 0 ||
    buckets.length > 0;

  function resetFilters() {
    setSelectedOperators([]);
    setSelectedTiers([]);
    setSelectedTypes([]);
    setSort("");
    setMask("");
    setWhere("any");
    setOnlyVerified(false);
    setOnlyDescribed(false);
    setCountDigit("");
    setFamilies([]);
    setBuckets([]);
  }

  // Счётчики считаются по всему списку, без учёта активных фильтров.
  const operatorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const op of OPERATORS) counts[op] = 0;
    for (const l of listings) counts[l.operator] = (counts[l.operator] ?? 0) + 1;
    return counts;
  }, [listings]);

  /** Сколько номеров в каждом виде узора. Виды пересекаются — суммы не сходятся. */
  const familyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of PATTERN_FAMILIES) counts[f] = 0;
    for (const x of valued) {
      for (const f of x.search?.fams ?? []) counts[f] = (counts[f] ?? 0) + 1;
    }
    return counts;
  }, [valued]);

  const bucketCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of PRICE_BUCKETS) {
      counts[b.code] = valued.filter((x) => inBucket(x.listing.price, b)).length;
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
    if (families.length) q.set("family", families.join(","));
    if (buckets.length) q.set("price", buckets.join(","));

    const query = q.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname
    );
  }, [
    selectedOperators,
    selectedTiers,
    selectedTypes,
    sort,
    mask,
    where,
    families,
    buckets,
  ]);

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
    ...(mask.trim()
      ? [{ key: "mask", label: mask.trim(), clear: () => setMask("") }]
      : []),
    ...families.map((f) => ({
      key: `family:${f}`,
      label: engineMessage(`family.${f}`, locale),
      clear: () => toggle(setFamilies, f),
    })),
    ...buckets.map((code) => ({
      key: `price:${code}`,
      label: engineMessage(code, locale),
      clear: () => toggle(setBuckets, code),
    })),
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

  // Написанное человеком разбирает сам модуль: он знает и «?», и «*», и то,
  // что «5x5» — это «пятёрка пять раз», а не маска. Сайт ничего не угадывает.
  const query = useMemo(
    () =>
      parseQuery(mask, {
        where,
        counts: countDigit ? [{ digit: countDigit, min: countMin }] : [],
        families,
      }),
    [mask, where, countDigit, countMin, families]
  );

  /** Задан ли вообще запрос: пустая строка без условий — это «показать всё». */
  const hasQuery = !!mask.trim() || !!countDigit || families.length > 0;

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
          // Именно maskDisplay: в mask лежит внутренняя запись со знаком «?»,
          // которого человек не вводил. Увидев «5?5» вместо своего «5*5»,
          // он решит, что ошибся.
          mask: query.maskDisplay ?? query.mask,
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
      ({ listing: l, search: rec }) =>
        (!selectedOperators.length || selectedOperators.includes(l.operator)) &&
        (!selectedTiers.length || selectedTiers.includes(l.status_tier)) &&
        (!selectedTypes.length || selectedTypes.includes(l.number_type)) &&
        // Корзины цены проверяются здесь, а не модулем: выбранных корзин может
        // быть несколько и несоседних, а модуль принимает один диапазон — «до
        // 50 000» вместе с «дороже миллиона» стали бы у него «всем подряд».
        (!buckets.length ||
          PRICE_BUCKETS.some(
            (b) => buckets.includes(b.code) && inBucket(l.price, b)
          )) &&
        (!onlyVerified || l.number_verified) &&
        (!onlyDescribed || !!l.description) &&
        // Маску, счётчики цифр и виды узора проверяет модуль поиска.
        (!searchHits || (rec !== null && searchHits.has(rec.w)))
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
    return by((x) => -new Date(x.listing.created_at).getTime());
  }, [
    valued,
    selectedOperators,
    selectedTiers,
    selectedTypes,
    sort,
    mask,
    buckets,
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
        <div className="hero-search-main">
          <h1>{t("searchTitle")}</h1>

          <MaskSearch
            mask={mask}
            where={where}
            onMaskChange={setMask}
            onWhereChange={setWhere}
            onSubmit={() => {
              document
                .getElementById("results")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            status={queryStatus}
          />
        </div>

        <ValuerCard />
      </section>

      <div className="board">
        {/* Кнопка видна только на узком экране — на широком колонка и так слева. */}
        <button
          type="button"
          className="filters-open btn btn-accent"
          onClick={() => setSheetOpen(true)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M7 12h10M11 18h2" />
          </svg>
          {t("filtersButton")}
          {activeChips.length > 0 && (
            <span className="filters-open-count">{activeChips.length}</span>
          )}
        </button>

        <aside className={"filters" + (sheetOpen ? " open" : "")}>
        <div className="filters-sheet-head">
          <span className="filters-sheet-title">{t("filtersTitle")}</span>
          <button type="button" className="reset-all" onClick={resetFilters}>
            {t("filters.resetAll")}
          </button>
        </div>
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
                  <span className="operator-toggle-name">
                    {op === "Viva" || op === "Ucom" ? op : tOpShort(op)}
                  </span>
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
                  <span className="tier-row-text" title={tTier(tier)}>
                    <b>{tShort(tier)}</b>
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
          <div className="filter-group-label">{t("filters.priceLabel")}</div>
          <p className="filters-hint">{t("filters.priceHint")}</p>
          {/* Готовые диапазоны вместо ползунка: у последнего верхней границы
              нет, и самые дорогие номера больше не отсекаются. */}
          <div className="presets">
            {PRICE_BUCKETS.map((b) => {
              const active = buckets.includes(b.code);
              return (
                <button
                  key={b.code}
                  type="button"
                  className={"chip" + (active ? " active" : "")}
                  aria-pressed={active}
                  disabled={!active && bucketCounts[b.code] === 0}
                  onClick={() => toggle(setBuckets, b.code)}
                >
                  {engineMessage(b.code, locale)}
                  <span className="chip-count">{bucketCounts[b.code] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>


        <details className="filter-extra">
          <summary>{t("filters.extraLabel")}</summary>

        <div className="filter-group">
          <div className="filter-group-label">{t("filters.digitCountLabel")}</div>
          <p className="filters-hint">{t("filters.digitCountHint")}</p>

          {/* Десять квадратов вместо списка из десяти строк: видно сразу,
              нажимается с первого раза и экономит экран прокрутки. */}
          <div className="digit-grid">
            {"0123456789".split("").map((d) => (
              <button
                key={d}
                type="button"
                className={"digit-key mono" + (countDigit === d ? " active" : "")}
                aria-pressed={countDigit === d}
                onClick={() => setCountDigit(countDigit === d ? "" : d)}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="times-row">
            <span>{t("filters.timesLabel")}</span>
            <div className="times-keys">
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={"digit-key mono" + (countMin === n ? " active" : "")}
                  aria-pressed={countMin === n}
                  onClick={() => setCountMin(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <span>{t("filters.timesUnit")}</span>
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-group-label">{t("filters.familyLabel")}</div>
          <p className="filters-hint">{t("filters.familyHint")}</p>
          {/* Выбор нескольких видов сразу. Список с одним значением оставлял
              разделы «Повторы», «Нули» и «Мало разных цифр» пустыми: номер
              числился только в том виде, который задал ему статус. */}
          <div className="presets">
            {PATTERN_FAMILIES.map((f) => {
              const active = families.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  className={"chip" + (active ? " active" : "")}
                  aria-pressed={active}
                  disabled={!active && familyCounts[f] === 0}
                  onClick={() => toggle(setFamilies, f)}
                >
                  {engineMessage(`family.${f}`, locale)}
                  <span className="chip-count">{familyCounts[f] ?? 0}</span>
                </button>
              );
            })}
          </div>
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

        <button
          type="button"
          className="btn btn-accent filters-apply"
          onClick={() => setSheetOpen(false)}
        >
          {t("filtersApply", { count: visible.length })}
        </button>
        </aside>

        {sheetOpen && (
          <button
            type="button"
            className="filters-scrim"
            aria-label={t("filtersClose")}
            onClick={() => setSheetOpen(false)}
          />
        )}

        <div className="board-results" id="results">
          <div className="results-head">
            <span className="results-count">
              {t("resultsCount", { count: visible.length })}
            </span>

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
        <>
          <div className="listing-cards">
            {visible.map((item) => (
              <ListingCard key={item.listing.id} item={item} />
            ))}
          </div>

          {/* Три строки цены — не прихоть оформления: сбор оператора у Viva,
              Ucom и Team считается по-разному, и покупателю это важно знать
              до похода в офис. */}
          <p className="three-lines">
            <span className="three-lines-icon" aria-hidden="true">i</span>
            <span>
              <b>{t("onePriceTitle")}</b> {t("onePriceText")}
            </span>
          </p>
        </>
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
