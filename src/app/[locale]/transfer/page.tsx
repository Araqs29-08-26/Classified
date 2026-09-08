import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { OPERATOR_PRICES, TRANSFER_RULES } from "@/lib/numberEngine";
import { formatAmount } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Сайты операторов — куда идти за самой свежей информацией. */
const OPERATOR_SITES = [
  { key: "viva", name: "Viva", url: "https://www.viva.am" },
  { key: "team", name: "Team Telecom", url: "https://www.telecomarmenia.am" },
  { key: "ucom", name: "Ucom", url: "https://www.ucom.am" },
] as const;

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

  // Правила и прайсы берутся из таблиц движка, а не переписываются в текст:
  // иначе страница и расчёт на карточках однажды разойдутся.
  const rules: Record<string, string> = {
    viva: t("vivaRule", {
      fixed: TRANSFER_RULES.vivaFixed,
      months: TRANSFER_RULES.vivaFreeAfterMonths.individual,
      monthsLegal: TRANSFER_RULES.vivaFreeAfterMonths.legal,
    }),
    team: t("teamRule", { fixed: TRANSFER_RULES.teamFixed }),
    ucom: t("ucomRule", { flat: TRANSFER_RULES.ucomFlatFee }),
  };

  const tiers = Object.keys(OPERATOR_PRICES.viva).filter((name) => name !== "Обычный");

  return (
    <div className="legal">
      <h1>{t("title")}</h1>

      <p className="legal-intro">{t("note")}</p>

      <h2>{t("rulesTitle")}</h2>
      <p>{t("rulesIntro")}</p>

      <div className="listings-table-wrap">
        <table className="listings-table">
          <thead>
            <tr>
              <th>{t("colOperator")}</th>
              <th>{t("colRule")}</th>
            </tr>
          </thead>
          <tbody>
            {OPERATOR_SITES.map((site) => (
              <tr key={site.key}>
                <td>
                  <b>{site.name}</b>
                </td>
                <td>{rules[site.key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{t("priceTableTitle")}</h2>

      <div className="listings-table-wrap">
        <table className="listings-table">
          <thead>
            <tr>
              <th />
              {OPERATOR_SITES.map((site) => (
                <th key={site.key} className="col-right">
                  {site.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr key={tier}>
                <td>
                  <span className={`tier-badge tier-${tier}`}>{tTiers(tier)}</span>
                </td>
                {OPERATOR_SITES.map((site) => (
                  <td key={site.key} className="col-right mono">
                    {formatAmount(OPERATOR_PRICES[site.key][tier] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="warning-banner" style={{ marginTop: 24 }}>
        <span className="warning-icon" aria-hidden="true">
          ⚠️
        </span>
        <p>{t("warning")}</p>
      </div>

      <p>{t("changeNote")}</p>

      <ul className="operator-links">
        {OPERATOR_SITES.map((site) => (
          <li key={site.url}>
            <a href={site.url} target="_blank" rel="noopener noreferrer">
              {site.name} — {site.url.replace("https://", "")}
            </a>
          </li>
        ))}
      </ul>

      <p className="legal-intro">{t("otherOperatorsNote")}</p>
    </div>
  );
}
