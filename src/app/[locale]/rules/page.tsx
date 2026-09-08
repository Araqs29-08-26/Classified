import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "rules" });
  return { title: t("title") };
}

export default async function RulesPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale });

  return (
    <div className="legal">
      <h1>{t("rules.title")}</h1>

      <p className="legal-intro">{t("rules.intro")}</p>

      <h2>{t("rules.promoTitle")}</h2>
      <p>{t("rules.promoIntro")}</p>

      <ul>
        <li>{t("rules.promoTop")}</li>
        <li>{t("rules.promoHighlight")}</li>
        <li>{t("rules.promoUrgent")}</li>
      </ul>

      <p>{t("rules.promoHow")}</p>
      <p>{t("rules.promoUntil")}</p>

      <p className="legal-intro">
        {t("rules.termsNote")} <Link href="/terms">{t("legal.termsNav")}</Link>.
      </p>
    </div>
  );
}
