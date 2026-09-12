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
import {
  engineMessage,
  evaluateNumber,
  OPERATOR_CODE,
  recommendedPrice,
} from "@/lib/numberEngine";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
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
  const tSeo = await getTranslations({ locale: params.locale, namespace: "seo" });

  /**
   * Заголовок и описание пишутся так, как человек ищет: номер, статус,
   * оператор, цена. Прежний вариант «65 000 ֏ · Araqs» в выдаче не говорил
   * ничего и не содержал ни одного слова, по которому его можно найти.
   */
  const verdict = evaluateNumber(listing.phone_number, {
    operator: OPERATOR_CODE[listing.operator] ?? null,
    heldOverLimit: listing.held_over_limit,
    locale: params.locale,
  });

  const title = tSeo("listingTitle", {
    number: listing.phone_number,
    tier: t(listing.status_tier),
    operator: listing.operator,
  });

  // Цена в описании одна: сбор оператора сидит внутри неё, а не прибавляется.
  const description = verdict.ok
    ? tSeo("listingDescription", {
        number: listing.phone_number,
        tier: t(listing.status_tier),
        pattern: verdict.pattern,
        price: formatPrice(listing.price),
      })
    : tSeo("listingDescriptionPlain", {
        number: listing.phone_number,
        tier: t(listing.status_tier),
        price: formatPrice(listing.price),
      });

  const url = `${SITE_URL}/${params.locale}/listing/${listing.id}`;

  return {
    title: { absolute: `${title} — Araqs` },
    description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${SITE_URL}/${l}/listing/${listing.id}`])
      ),
    },
    openGraph: {
      type: "website",
      siteName: "Araqs",
      title,
      description,
      url,
      locale: params.locale,
    },
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

  /**
   * Описание товара для поисковиков.
   *
   * Обычный текст страницы поисковик читает как текст и о цене догадывается.
   * Эта разметка говорит прямо: это товар, вот цена, вот валюта, вот наличие —
   * и тогда в выдаче под ссылкой появляется цена, а объявление попадает в
   * товарные подборки. Для доски объявлений это самая полезная разметка.
   *
   * Телефон продавца сюда не попадает: он и на странице показывается только
   * по нажатию, а в разметке был бы виден всем сборщикам сразу.
   */
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${listing.phone_number} — ${t(`tiers.${tier}`)}`,
    category: t(`numberTypes.${listing.number_type}`),
    brand: { "@type": "Brand", name: listing.operator },
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "AMD",
      availability:
        listing.listing_status === "active"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${SITE_URL}/${params.locale}/listing/${listing.id}`,
      seller: { "@type": "Organization", name: "Araqs" },
    },
  };

  return (
    <div className="listing-layout">
      {/* Разметка невидима человеку и предназначена только поисковику. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <div className="listing-main">
        <div className="detail">
          <div className="detail-head">
            <span className={`tier-badge tier-${tier}`}>{t(`tiers.${tier}`)}</span>
            {listing.number_verified && (
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

              <ul className="feature-list">
                {verdict.features.map((f, i) => (
                  <li
                    key={i}
                    className={
                      "feature" +
                      (f.main ? " feature-main" : "") +
                      (f.affects === "info" ? " feature-info" : "")
                    }
                  >
                    <span>{f.text}</span>
                    {/* Признак, который в цену не заложен, помечается прямо:
                        иначе покупатель решит, что платит и за него тоже. */}
                    {f.affects === "info" && (
                      <em>{engineMessage("extra.affects.info", params.locale)}</em>
                    )}
                  </li>
                ))}
              </ul>

              {verdict.notes.length > 0 && (
                <ul className="why-list">
                  {verdict.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
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
            <div className="price-total">
              <span>{t("listing.cost.price")}</span>
              <b>{formatPrice(listing.price)}</b>
            </div>
            {/* Сбор оператора сидит ВНУТРИ цены, а не сверх неё: покупатель
                платит за номер, а не за оператора. От оператора зависит лишь
                остаток продавцу. Нулевой сбор не показываем: вычитать нечего. */}
            {fee > 0 && (
              <>
                <div>
                  <span>{t("listing.cost.feeInside")}</span>
                  <b>− {formatPrice(fee)}</b>
                </div>
                <div>
                  <span>{t("listing.cost.sellerGets")}</span>
                  <b>{formatPrice(Math.max(0, listing.price - fee))}</b>
                </div>
              </>
            )}
          </div>

          {verdict.ok && (
            <p className="cost-note">
              {verdict.feeNote}
            </p>
          )}

          {/* У обычного номера движок цены не называет — показывать нечего. */}
          {verdict.ok && recommendedPrice(verdict).max > 0 && (
            <p className="cost-note">
              {t("listing.cost.range", {
                from: formatAmount(recommendedPrice(verdict).min),
                to: formatPrice(recommendedPrice(verdict).max),
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
