"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { IndexRecord } from "@/lib/numberSearch";
import { OPERATOR_META, formatPrice, type Listing } from "@/lib/supabase";
import PatternNumber from "./PatternNumber";

/** Объявление вместе с оценкой: сохранённой при публикации либо пересчитанной. */
export type ValuedListing = {
  listing: Listing;
  index: number | null;
  patternCode: string | null;
  /** Узор словами, уже на нужном языке. */
  pattern: string | null;
  window: string | null;
  patternFrom: number | null;
  patternTo: number | null;
  fee: number;
  total: number;
  /** Запись для модуля поиска: маска, счётчики цифр, вид узора. */
  search: IndexRecord | null;
};

/**
 * Действующее продвижение объявления либо ничего.
 *
 * Продвижение живёт до срока: истёкшее просто перестаёт показываться,
 * запись при этом сохраняется — по ней видно, что и когда покупали.
 */
export function activePromo(listing: Listing): Listing["promo_kind"] {
  if (!listing.promo_kind || !listing.promo_until) return null;
  const until = new Date(listing.promo_until).getTime();
  return until > Date.now() ? listing.promo_kind : null;
}

export default function ListingCard({ item }: { item: ValuedListing }) {
  const t = useTranslations("home");
  const tTier = useTranslations("tiers");
  const tType = useTranslations("numberTypes");
  const tCost = useTranslations("listing.cost");

  const l = item.listing;
  const logo = OPERATOR_META[l.operator]?.logo;
  const promo = activePromo(l);

  return (
    <Link
      href={`/listing/${l.id}`}
      className={"listing-card" + (promo ? ` promo promo-${promo}` : "")}
    >
      <div className="listing-card-main">
        <div className="listing-card-number">
          {item.window ? (
            <PatternNumber
              window={item.window}
              from={item.patternFrom}
              to={item.patternTo}
            />
          ) : (
            <div className="number mono">{l.phone_number}</div>
          )}
          {l.number_verified && (
            <span className="verified-mark">{t("verified")}</span>
          )}
        </div>

        {promo && (
          <span className={`promo-badge promo-badge-${promo}`}>
            {t(`promo.${promo}`)}
          </span>
        )}

        <div className="listing-card-tier">
          <span className={`tier-badge tier-${l.status_tier}`}>
            {tTier(l.status_tier)}
          </span>
          {item.pattern && (
            <span className="listing-card-pattern">
              {item.pattern}
            </span>
          )}
        </div>

        <div className="listing-card-meta">
          {logo && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logo} alt="" className="operator-logo" />
          )}
          <span>{l.operator}</span>
          <span>·</span>
          <span>{tType(l.number_type)}</span>
          {l.region && (
            <>
              <span>·</span>
              <span>{l.region}</span>
            </>
          )}
        </div>
      </div>

      {item.index !== null && (
        <div className="listing-card-index">
          <b>{item.index}</b>
          <div className={`index-bar tier-bar-${l.status_tier}`} role="presentation">
            <span style={{ width: `${item.index}%` }} />
          </div>
          <span className="listing-card-index-label">{t("filters.indexShort")}</span>
        </div>
      )}

      <div className="listing-card-cost">
        <div>
          <span>{tCost("seller")}</span>
          <b>{formatPrice(l.price)}</b>
        </div>
        <div>
          <span>{tCost("feeUnknownOperator")}</span>
          {/* Плюс уместен только у ненулевого сбора: «+ Бесплатно» — бессмыслица. */}
          <b>{item.fee > 0 ? `+ ${formatPrice(item.fee)}` : formatPrice(item.fee)}</b>
        </div>
        <div className="price-total">
          <span>{tCost("total")}</span>
          <b>{formatPrice(item.total)}</b>
        </div>
      </div>

      <span className="listing-card-view">{t("view")}</span>
    </Link>
  );
}
