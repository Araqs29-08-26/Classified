"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { messageKey } from "@/lib/numberEngine";
import { OPERATOR_META, formatPrice, type Listing } from "@/lib/supabase";
import PatternNumber from "./PatternNumber";

/** Объявление вместе с оценкой: сохранённой при публикации либо пересчитанной. */
export type ValuedListing = {
  listing: Listing;
  index: number | null;
  patternCode: string | null;
  patternParams: Record<string, string | number>;
  window: string | null;
  patternFrom: number | null;
  patternTo: number | null;
  fee: number;
  total: number;
};

export default function ListingCard({ item }: { item: ValuedListing }) {
  const t = useTranslations("home");
  const tTier = useTranslations("tiers");
  const tType = useTranslations("numberTypes");
  const tEngine = useTranslations("engine");
  const tCost = useTranslations("listing.cost");

  const l = item.listing;
  const logo = OPERATOR_META[l.operator]?.logo;

  return (
    <Link href={`/listing/${l.id}`} className="listing-card">
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
          {l.sms_verified && (
            <span className="verified-mark">{t("verified")}</span>
          )}
        </div>

        <div className="listing-card-tier">
          <span className={`tier-badge tier-${l.status_tier}`}>
            {tTier(l.status_tier)}
          </span>
          {item.patternCode && (
            <span className="listing-card-pattern">
              {tEngine(messageKey(item.patternCode), item.patternParams)}
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
        <span className="listing-card-view">{t("view")}</span>
      </div>
    </Link>
  );
}
