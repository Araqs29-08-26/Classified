"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { evaluateNumber, OPERATOR_CODE } from "@/lib/numberEngine";
import {
  NUMBER_TYPES,
  OPERATORS,
  OPERATOR_META,
  TIERS,
  TIER_EMOJI,
  type Listing,
} from "@/lib/supabase";
import ListingCard, { type ValuedListing } from "./ListingCard";
import DigitSearch, { EMPTY_MASK, matchesDigits } from "./DigitSearch";

type Props = {
  listings: Listing[];
  initialOperator?: string;
  initialTier?: string;
  initialType?: string;
  initialSort?: string;
  initialMask?: string;
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
  initialPreset = "",
}: Props) {
  const t = useTranslations("home");
  const tTier = useTranslations("tiers");
  const tType = useTranslations("numberTypes");

  const maxPrice = useMemo(
    () => Math.max(TIERS[0].price, ...listings.map((l) => l.price), 1),
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
  const [preset, setPreset] = useState<string>(initialPreset);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, maxPrice]);

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
    /\d/.test(mask) ||
    !!preset ||
    priceRange[0] > 0 ||
    priceRange[1] < maxPrice;

  function resetFilters() {
    setSelectedOperators([]);
    setSelectedTiers([]);
    setSelectedTypes([]);
    setSort("");
    setMask(EMPTY_MASK);
    setPreset("");
    setPriceRange([0, maxPrice]);
  }

  // Счётчики считаются по всему списку, без учёта активных фильтров.
  const operatorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const op of OPERATORS) counts[op] = 0;
    for (const l of listings) counts[l.operator] = (counts[l.operator] ?? 0) + 1;
    return counts;
  }, [listings]);

  // Оценка для каждого объявления. Сохранённая при публикации важнее пересчитанной:
  // объявление должно помнить, по какой версии движка его оценили.
  const valued: ValuedListing[] = useMemo(
    () =>
      listings.map((l) => {
        const v = evaluateNumber(l.phone_number, {
          operator: OPERATOR_CODE[l.operator] ?? null,
          monthsHeld: l.months_held ?? null,
        });
        const fee = v.ok ? v.transferFee : 0;
        return {
          listing: l,
          index: l.beauty_index ?? (v.ok ? v.index : null),
          patternCode: l.pattern_code ?? (v.ok ? v.patternCode : null),
          patternParams: l.pattern_params ?? (v.ok ? v.patternParams : {}),
          window: v.ok ? v.window : null,
          patternFrom: v.ok ? v.patternFrom : null,
          patternTo: v.ok ? v.patternTo : null,
          fee,
          total: l.price + fee,
        };
      }),
    [listings]
  );

  // Состояние поиска пишется в адрес страницы, иначе при смене языка оно теряется:
  // страница перезагружается, а фильтры живут только в памяти вкладки.
  // replaceState вместо роутера — правка адреса не должна дёргать сервер на каждую цифру.
  useEffect(() => {
    const q = new URLSearchParams();
    if (selectedOperators.length) q.set("operator", selectedOperators.join(","));
    if (selectedTiers.length) q.set("tier", selectedTiers.join(","));
    if (selectedTypes.length) q.set("type", selectedTypes.join(","));
    if (sort) q.set("sort", sort);
    if (/\d/.test(mask)) q.set("mask", mask);
    if (preset) q.set("preset", preset);

    const query = q.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname
    );
  }, [selectedOperators, selectedTiers, selectedTypes, sort, mask, preset]);

  const presetPrefixes = PRESETS.find((p) => p.id === preset)?.prefixes;

  const visible = useMemo(() => {
    const filtered = valued.filter(
      ({ listing: l, patternCode }) =>
        (!selectedOperators.length || selectedOperators.includes(l.operator)) &&
        (!selectedTiers.length || selectedTiers.includes(l.status_tier)) &&
        (!selectedTypes.length || selectedTypes.includes(l.number_type)) &&
        !(l.price < priceRange[0]) &&
        !(l.price > priceRange[1]) &&
        (!/\d/.test(mask) || matchesDigits(l.phone_number, mask)) &&
        (!presetPrefixes ||
          (patternCode !== null &&
            presetPrefixes.some((prefix) => patternCode.startsWith(prefix))))
    );

    const by = (rank: (x: ValuedListing) => number) =>
      [...filtered].sort((a, b) => rank(a) - rank(b));

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
  ]);

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

        <DigitSearch mask={mask} onChange={setMask} />

        <div className="presets">
          <span className="presets-label">{t("presetsLabel")}</span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={"chip" + (preset === p.id ? " active" : "")}
              aria-pressed={preset === p.id}
              onClick={() => setPreset(preset === p.id ? "" : p.id)}
            >
              {t(`presets.${p.id}`)}
            </button>
          ))}
        </div>
      </section>

      <div className="warning-banner">
        <span className="warning-icon" aria-hidden="true">
          ⚠️
        </span>
        <p>{t("warningBanner")}</p>
      </div>

      <div className="filters">
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
                  <span className="operator-toggle-name">{op}</span>
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
          <div className="tier-toggle-grid">
            {TIERS.map((tier) => {
              const active = selectedTiers.includes(tier.name);
              return (
                <label
                  key={tier.name}
                  className={"tier-toggle" + (active ? " active" : "")}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(setSelectedTiers, tier.name)}
                  />
                  <span className="tier-toggle-icon" aria-hidden="true">
                    {TIER_EMOJI[tier.name]}
                  </span>
                  {tTier(tier.name)}
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

        <div className="filter-group">
          <div className="filter-group-label">{t("filters.sortLabel")}</div>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="">{t("filters.sortNewest")}</option>
            <option value="index_desc">{t("filters.sortIndex")}</option>
            <option value="price_asc">{t("filters.sortPriceAsc")}</option>
            <option value="price_desc">{t("filters.sortPriceDesc")}</option>
            <option value="total_asc">{t("filters.sortTotalAsc")}</option>
            <option value="total_desc">{t("filters.sortTotalDesc")}</option>
          </select>
        </div>


        {hasActiveFilters && (
          <button
            type="button"
            className="btn btn-ghost filter-clear"
            onClick={resetFilters}
          >
            {t("filters.maskClear")}
          </button>
        )}
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

      {visible.length === 0 && hasActiveFilters && (
        <div className="empty-state">
          <h2>{t("emptyFiltered.title")}</h2>
          <p>{t("emptyFiltered.subtitle")}</p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="listing-cards">
          {visible.map((item) => (
            <ListingCard key={item.listing.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
