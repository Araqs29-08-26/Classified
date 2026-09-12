import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { BETA_PROMO, EXTRA_LISTING_PRICE } from "@/lib/promoPrices";
import RulesNav from "./RulesNav";

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
  const t = await getTranslations({ locale, namespace: "rules" });
  const tNav = await getTranslations({ locale, namespace: "rulesNav" });

  return (
    <div className="legal">
      <h1>{t("title")}</h1>
      <RulesNav />

      <p className="legal-intro">{t("intro")}</p>

      <h2>{t("postingTitle")}</h2>
      <p>{t("postingFree")}</p>
      <p>{t("postingTerm")}</p>
      <p>{t("postingSecond", { amount: EXTRA_LISTING_PRICE })}</p>

      {/* Акция стоит отдельным абзацем и исчезнет вместе с ней самой:
          правило выше остаётся верным и после её окончания. */}
      {BETA_PROMO && <p className="legal-note">{t("postingPromo")}</p>}

      <h2>{t("postingWhoTitle")}</h2>
      <p>{t("postingWho")}</p>

      <h2>{t("postingForbiddenTitle")}</h2>
      <p>{t("postingForbidden")}</p>

      <p className="legal-note">
        {t("termsNote")} <Link href="/rules/terms">{tNav("terms")}</Link>.
      </p>
    </div>
  );
}
