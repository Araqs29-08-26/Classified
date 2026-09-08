import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TRANSFER_RULES } from "@/lib/numberEngine";

export const dynamic = "force-dynamic";

/**
 * Правила переоформления — отдельным блоком на каждого оператора.
 *
 * Сводных таблиц здесь нет намеренно: у операторов разные правила, и в общей
 * таблице нюансы каждого теряются. Точные суммы по категориям операторы
 * публикуют не полностью, поэтому цифры показываются только те, что оператор
 * называет сам, — остальное человек узнаёт в офисе.
 */
const OPERATORS = [
  {
    key: "viva",
    name: "Viva",
    url: "https://www.viva.am",
    logo: "/operators/viva.png",
    body: "vivaBody",
    params: {
      fixed: TRANSFER_RULES.vivaFixed,
      months: TRANSFER_RULES.vivaFreeAfterMonths.individual,
      monthsLegal: TRANSFER_RULES.vivaFreeAfterMonths.legal,
    },
  },
  {
    key: "team",
    name: "Team Telecom",
    url: "https://www.telecomarmenia.am",
    logo: "/operators/team.png",
    body: "teamBody",
    params: { fixed: TRANSFER_RULES.teamFixed },
  },
  {
    key: "ucom",
    name: "Ucom",
    url: "https://www.ucom.am",
    logo: "/operators/ucom.png",
    body: "ucomBody",
    params: { flat: TRANSFER_RULES.ucomFlatFee },
  },
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

  return (
    <div className="legal">
      <h1>{t("title")}</h1>

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

      <div className="operator-rules">
        {OPERATORS.map((op) => (
          <section key={op.key} className="operator-rule">
            <h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={op.logo} alt="" className="operator-logo" />
              {op.name}
            </h3>
            <p>{t(op.body, op.params)}</p>
            <a href={op.url} target="_blank" rel="noopener noreferrer">
              {op.url.replace("https://", "")}
            </a>
          </section>
        ))}
      </div>

      <p className="legal-note">{t("unpublished")}</p>

      <h2>{t("otherOperatorsTitle")}</h2>
      <p>{t("otherOperatorsNote")}</p>

      <p className="legal-note">{t("note")}</p>
    </div>
  );
}
