import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { formatPrice } from "@/lib/supabase";
import {
  EXTRA_LISTING_PRICE,
  HUNTER_PRICE,
  PROMO_KINDS,
  PROMO_PRICES,
  SUBSCRIPTIONS,
} from "@/lib/promoPrices";
import RulesNav from "../RulesNav";
import OrderButton from "./OrderButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "promoPage" });
  return { title: t("title") };
}

export default async function PromoRulesPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: "promoPage" });
  const tPromo = await getTranslations({ locale, namespace: "promo" });

  return (
    <div className="legal">
      <h1>{t("title")}</h1>
      <RulesNav />

      <p className="legal-intro">{t("intro")}</p>

      <h2>{t("perListingTitle")}</h2>
      <p className="legal-note">{t("perListingNote")}</p>

      <ul className="service-list">
        {PROMO_KINDS.map((kind) => (
          <li key={kind} className="service">
            <span className="service-body">
              <b>{tPromo(`${kind}Title`)}</b>
              <span>{tPromo(`${kind}Text`)}</span>
            </span>
            <span className="service-price">{formatPrice(PROMO_PRICES[kind])}</span>
          </li>
        ))}
        <li className="service">
          <span className="service-body">
            <b>{tPromo("extraTitle")}</b>
            <span>{tPromo("extraText", { amount: EXTRA_LISTING_PRICE })}</span>
          </span>
          <span className="service-price">{formatPrice(EXTRA_LISTING_PRICE)}</span>
        </li>
      </ul>

      <h2>{t("subscriptionsTitle")}</h2>

      <h3>{t("shopTitle")}</h3>
      <p>{t("shopIntro")}</p>

      <ul className="service-list">
        {SUBSCRIPTIONS.map((s) => (
          <li key={s.plan} className="service">
            <span className="service-body">
              <b>
                {t("shopTitle")} — {t(`shop${s.limit}`)}
              </b>
            </span>
            <span className="service-price">
              {formatPrice(s.price)}
              <span className="service-period">{t("perMonth")}</span>
            </span>
            <OrderButton kind={s.plan} amount={s.price} />
          </li>
        ))}
      </ul>

      <h3>{t("hunterTitle")}</h3>
      <p>{t("hunterText")}</p>

      <ul className="service-list">
        <li className="service">
          <span className="service-body">
            <b>{t("hunterTitle")}</b>
          </span>
          <span className="service-price">
            {formatPrice(HUNTER_PRICE)}
            <span className="service-period">{t("perMonth")}</span>
          </span>
          <OrderButton kind="hunter" amount={HUNTER_PRICE} />
        </li>
      </ul>

      <p className="legal-note">{t("payNote")}</p>
    </div>
  );
}
