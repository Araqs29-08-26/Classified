import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

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

      <div className="warning-banner" style={{ marginTop: 20 }}>
        <span className="warning-icon" aria-hidden="true">
          ⚠️
        </span>
        <p>{t("warning")}</p>
      </div>

      <p className="legal-intro">{t("note")}</p>
    </div>
  );
}
