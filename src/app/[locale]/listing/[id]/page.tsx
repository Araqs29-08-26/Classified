import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  OPERATOR_META,
  formatAmount,
  formatPrice,
  supabase,
  type Listing,
} from "@/lib/supabase";
import { evaluateNumber, OPERATOR_CODE } from "@/lib/numberEngine";
import ContactReveal from "./ContactReveal";
import PatternNumber from "../../PatternNumber";
import ReportButton from "./ReportButton";
import FavoriteButton from "./FavoriteButton";

export const dynamic = "force-dynamic";

async function getListing(id: string): Promise<Listing | null> {
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .eq("listing_status", "active")
    .maybeSingle();

  return (data as Listing) ?? null;
}

// Телефон продавца здесь намеренно не запрашивается. Раньше он приходил на
// страницу вместе со всем остальным и был виден в её исходном коде до всякого
// нажатия — то есть доступен поисковикам и сборщикам. Теперь его запрашивает
// ContactReveal в момент нажатия «Связаться».

export async function generateMetadata({
  params,
}: {
  params: { locale: string; id: string };
}): Promise<Metadata> {
  const listing = await getListing(params.id);
  if (!listing) return {};

  const t = await getTranslations({ locale: params.locale, namespace: "tiers" });

  return {
    title: {
      absolute: `${listing.phone_number} — ${t(listing.status_tier)} — Araqs`,
    },
    description: `${formatPrice(listing.price)} · Araqs`,
  };
}

export default async function ListingPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const listing = await getListing(params.id);
  if (!listing) notFound();

  const t = await getTranslations({ locale: params.locale });

  // Срок владения в объявлении пока не хранится (это Задача 9г), поэтому у Viva
  // движок вернёт осторожный сбор — полную стоимость категории — и сам об этом скажет.
  const verdict = evaluateNumber(listing.phone_number, {
    operator: OPERATOR_CODE[listing.operator] ?? null,
    heldOverLimit: listing.held_over_limit,
    locale: params.locale,
  });

  const tier = verdict.ok ? verdict.status : listing.status_tier;
  const fee = verdict.ok ? verdict.transferFee : 0;
  const logo = OPERATOR_META[listing.operator]?.logo;

  return (
    <div className="listing-layout">
      <div className="listing-main">
        <div className="detail">
          <div className="detail-head">
            <span className={`tier-badge tier-${tier}`}>{t(`tiers.${tier}`)}</span>
            {listing.sms_verified && (
              <span className="verified-mark">{t("listing.verified")}</span>
            )}
          </div>

          {verdict.ok ? (
            <PatternNumber
              window={verdict.window}
              from={verdict.patternFrom}
              to={verdict.patternTo}
            />
          ) : (
            <div className="number mono">{listing.phone_number}</div>
          )}

          <div className="detail-meta">
            <div>
              <b>
                {logo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logo} alt="" className="operator-logo" />
                )}
                {listing.operator}
              </b>
              <span>{t("listing.meta.operator")}</span>
            </div>
            <div>
              <b>{t(`numberTypes.${listing.number_type}`)}</b>
              <span>{t("listing.meta.type")}</span>
            </div>
            {listing.region && (
              <div>
                <b>{listing.region}</b>
                <span>{t("listing.meta.region")}</span>
              </div>
            )}
          </div>

          {listing.description ? (
            <p style={{ marginTop: 4 }}>{listing.description}</p>
          ) : null}
        </div>

        {verdict.ok && (
          <div className="detail why-card">
            <h2>{t("listing.why.title")}</h2>
            <p className="why-subtitle">{t("listing.why.subtitle")}</p>

            <div className="why-body">
              <div className="why-index">
                <div className="why-index-value">
                  <b>{verdict.index}</b>
                  <span>/ 100</span>
                </div>
                <div className="why-index-label">{t("listing.why.indexLabel")}</div>
                <div className={`index-bar tier-bar-${tier}`} role="presentation">
                  <span style={{ width: `${verdict.index}%` }} />
                </div>
              </div>

              <ul className="why-list">
                <li>
                  <b>{verdict.pattern}</b>
                </li>
                {verdict.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="warning-banner">
          <span className="warning-icon" aria-hidden="true">
            ⚠️
          </span>
          <p>{t("transfer.warning")}</p>
        </div>
      </div>

      <aside className="listing-aside">
        <div className="detail cost-card">
          <h3>{t("listing.cost.title")}</h3>

          <div className="price-breakdown">
            <div>
              <span>{t("listing.cost.seller")}</span>
              <b>{formatPrice(listing.price)}</b>
            </div>
            <div>
              <span>
                {listing.operator
                  ? t("listing.cost.fee", { operator: listing.operator })
                  : t("listing.cost.feeUnknownOperator")}
              </span>
              <b>{formatPrice(fee)}</b>
            </div>
            <div className="price-total">
              <span>{t("listing.cost.total")}</span>
              <b>{formatPrice(listing.price + fee)}</b>
            </div>
          </div>

          {verdict.ok && (
            <p className="cost-note">
              {verdict.feeNote}
            </p>
          )}

          {verdict.ok && (
            <p className="cost-note">
              {t("listing.cost.range", {
                from: formatAmount(verdict.sellerMin),
                to: formatPrice(verdict.sellerMax),
              })}
            </p>
          )}

          <ContactReveal listingId={listing.id} />

          <FavoriteButton listingId={listing.id} />
        </div>

        <ReportButton listingId={listing.id} />
      </aside>
    </div>
  );
}
