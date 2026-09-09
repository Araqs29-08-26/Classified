import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import SupportForm from "./SupportForm";

export const dynamic = "force-dynamic";

// ВНИМАНИЕ: адрес поддержки захардкожен здесь и в текстах словаря
// (legal.terms.sections[9].body и legal.privacy.sections[7].body).
// Меняете здесь — поменяйте и там, во всех трёх языках.
const SUPPORT_EMAIL = "support@araqs.com";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "support" });
  return { title: t("title") };
}

export default async function SupportPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: "support" });

  return (
    <div className="legal">
      <h1>{t("title")}</h1>
      <p className="legal-intro">{t("intro")}</p>
      <SupportForm email={SUPPORT_EMAIL} />
    </div>
  );
}
