import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { formatAmount } from "@/lib/supabase";
import { OPERATOR_TRANSFER, UCOM_FLAT } from "@/lib/transferPrices";
import { TRANSFER_RULES } from "@/lib/numberEngine";
import RulesNav from "../RulesNav";

export const dynamic = "force-dynamic";

/** Логотипы лежат рядом с остальными: они же на карточках объявлений. */
const LOGO: Record<string, string> = {
  viva: "/operators/viva.png",
  team: "/operators/team.png",
  ucom: "/operators/ucom.png",
};

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "transfer" });
  return { title: t("title") };
}

export default async function TransferPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: "transfer" });
  const tTiers = await getTranslations({ locale, namespace: "tiers" });

  /** Название категории: у Viva это наш статус, у Team есть своя «Никелевая». */
  const categoryName = (tier: string) =>
    tier === "Никелевый" ? t("nickel") : tTiers(tier);

  const rule: Record<string, string> = {
    viva: t("vivaRule", { fixed: TRANSFER_RULES.vivaFixed }),
    team: t("teamRule", { fixed: TRANSFER_RULES.teamFixed }),
    ucom: t("ucomRule", { flat: UCOM_FLAT }),
  };

  return (
    <div className="legal">
      <h1>{t("title")}</h1>
      <RulesNav />

      {/* Предупреждение стоит первым: это главное, что нужно знать до сделки. */}
      <div className="warning-banner">
        <span className="warning-icon" aria-hidden="true">
          ⚠️
        </span>
        <p>{t("warning")}</p>
      </div>

      <h2>{t("howTitle")}</h2>
      <p>{t("howSteps")}</p>

      <h2>{t("byOperator")}</h2>
      <p className="legal-note">{t("ourScaleNote")}</p>

      {OPERATOR_TRANSFER.map((op) => (
        <section key={op.key} className="operator-block">
          <h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO[op.key]} alt="" className="operator-logo" />
            {op.name}
          </h3>

          <p>{rule[op.key]}</p>
          {op.key === "team" && <p>{t("teamContract")}</p>}
          {op.key === "ucom" && <p>{t("ucomNoObligation")}</p>}

          <table className="category-table">
            <thead>
              <tr>
                <th>{t("colCategory")}</th>
                <th className="col-right">{t("colPrice")}</th>
              </tr>
            </thead>
            <tbody>
              {op.categories.map((c) => (
                <tr key={c.tier}>
                  <td>{categoryName(c.tier)}</td>
                  <td className="col-right mono">
                    {formatAmount(c.price)} ֏
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Категорий выше «Бриллиантового» у этих операторов нет — так и
              сказано. Заполнять пробел похожей цифрой значило бы выдумывать. */}
          {op.key !== "viva" && (
            <p className="legal-note">
              <b>{t("notPublishedTitle")}.</b> {t("notPublished")}
            </p>
          )}

          <ul className="operator-links">
            {op.links.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {t(link.key)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="legal-note">{t("sourceNote")}</p>

      <h2>{t("otherOperatorsTitle")}</h2>
      <p>{t("otherOperatorsNote")}</p>
    </div>
  );
}
