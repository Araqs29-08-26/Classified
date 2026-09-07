"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import {
  NUMBER_TYPES,
  OPERATORS,
  OPERATOR_META,
  TIERS,
  TIER_EMOJI,
  formatPrice,
  type Listing,
} from "@/lib/supabase";

type Props = {
  listings: Listing[];
  initialOperator?: string;
  initialTier?: string;
  initialType?: string;
  initialSort?: string;
  initialMask?: string;
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
 * Маска выравнивается по ПРАВОМУ краю номера: сравниваются последние N цифр,
 * где N — длина маски. Подстановочные символы — «_» и «*» (фактически любой
 * нецифровой символ занимает позицию, но ничего не проверяет).
 */
function matchesMask(phoneNumber: string, mask: string): boolean {
  const digits = phoneNumber.replace(/\D/g, "");
  const m = mask.trim();
  if (!m) return true;
  if (digits.length < m.length) return false;

  const tail = digits.slice(-m.length);
  for (let i = 0; i < m.length; i++) {
    const ch = m[i];
    if (ch !== "_" && ch !== "*" && /\d/.test(ch) && ch !== tail[i]) return false;
  }
  return true;
}

const splitParam = (value?: string) =>
  value ? value.split(",").filter(Boolean) : [];

export default function HomeClient({
  listings,
  initialOperator = "",
  initialTier = "",
  initialType = "",
  initialSort = "",
  initialMask = "",
}: Props) {
  const t = useTranslations("home");
  const tTier = useTranslations("tiers");
  const tType = useTranslations("numberTypes");
  const router = useRouter();

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
    !!mask ||
    priceRange[0] > 0 ||
    priceRange[1] < maxPrice;

  function resetFilters() {
    setSelectedOperators([]);
    setSelectedTiers([]);
    setSelectedTypes([]);
    setSort("");
    setMask("");
    setPriceRange([0, maxPrice]);
  }

  // Счётчики считаются по всему списку, без учёта активных фильтров.
  const operatorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const op of OPERATORS) counts[op] = 0;
    for (const l of listings) counts[l.operator] = (counts[l.operator] ?? 0) + 1;
    return counts;
  }, [listings]);

  const visible = useMemo(() => {
    const filtered = listings.filter(
      (l) =>
        (!selectedOperators.length || selectedOperators.includes(l.operator)) &&
        (!selectedTiers.length || selectedTiers.includes(l.status_tier)) &&
        (!selectedTypes.length || selectedTypes.includes(l.number_type)) &&
        !(l.price < priceRange[0]) &&
        !(l.price > priceRange[1]) &&
        (!mask || matchesMask(l.phone_number, mask))
    );

    if (sort === "price_asc") return [...filtered].sort((a, b) => a.price - b.price);
    if (sort === "price_desc") return [...filtered].sort((a, b) => b.price - a.price);
    return [...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [listings, selectedOperators, selectedTiers, selectedTypes, sort, mask, priceRange]);

  const open = (id: string) => router.push(`/listing/${id}`);

  return (
    <>
      <section className="hero">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1>{t("title")}</h1>
        <p>{t("subtitle")}</p>
        {visible.length > 0 && (
          <p className="stat-pill">{t("stats", { count: visible.length })}</p>
        )}
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
            <option value="price_asc">{t("filters.sortPriceAsc")}</option>
            <option value="price_desc">{t("filters.sortPriceDesc")}</option>
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-group-label">{t("filters.maskLabel")}</div>
          <input
            type="text"
            className="mono"
            value={mask}
            placeholder={t("filters.maskLabel")}
            onChange={(e) => setMask(e.target.value)}
          />
          <p className="filters-hint">{t("filters.maskHint")}</p>
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
        <div className="listings-table-wrap" style={{ marginTop: 20 }}>
          <table className="listings-table">
            <thead>
              <tr>
                <th>{t("table.number")}</th>
                <th>{t("table.status")}</th>
                <th className="col-hide-sm">{t("table.operator")}</th>
                <th className="col-hide-sm">{t("table.type")}</th>
                <th className="col-right">{t("table.price")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr
                  key={l.id}
                  className="listing-row"
                  tabIndex={0}
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("a")) open(l.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") open(l.id);
                  }}
                >
                  <td className="cell-number">
                    <Link href={`/listing/${l.id}`} className="mono">
                      {l.phone_number}
                    </Link>
                    {l.sms_verified && (
                      <span className="verified-mark" title={t("verified")}>
                        ✓
                      </span>
                    )}
                    <span className="cell-number-sub col-show-sm">
                      <OperatorBadge op={l.operator} small />
                      {l.operator} · {tType(l.number_type)}
                    </span>
                  </td>

                  <td>
                    <span className={`tier-badge tier-${l.status_tier}`}>
                      <span aria-hidden="true">{TIER_EMOJI[l.status_tier]}</span>{" "}
                      {tTier(l.status_tier)}
                    </span>
                  </td>

                  <td className="cell-muted col-hide-sm">
                    <OperatorBadge op={l.operator} small />
                  </td>

                  <td className="cell-muted col-hide-sm">
                    {tType(l.number_type)}
                    {l.region ? ` · ${l.region}` : ""}
                  </td>

                  <td className="cell-price col-right">{formatPrice(l.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
