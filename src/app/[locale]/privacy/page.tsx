import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

type Section = { title: string; body: string };

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return { title: t("title") };
}

export default async function PrivacyPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  const sections = t.raw("sections") as Section[];

  return (
    <div className="legal">
      <h1>{t("title")}</h1>
      <p className="legal-updated">{t("updated")}</p>
      <p className="legal-intro">{t("intro")}</p>

      {sections.map((s, i) => (
        <section key={i}>
          <h2>{s.title}</h2>
          <p>{s.body}</p>
        </section>
      ))}
    </div>
  );
}
