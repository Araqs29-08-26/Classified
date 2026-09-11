import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
import { LANDINGS } from "@/lib/landing";

export const dynamic = "force-dynamic";

type Term = { term: string; also: string; means: string };

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "glossary" });
  const url = `${SITE_URL}/${locale}/glossary`;

  return {
    title: { absolute: `${t("title")} — Araqs` },
    description: t("intro"),
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${SITE_URL}/${l}/glossary`])
      ),
    },
    openGraph: {
      type: "website",
      siteName: "Araqs",
      title: t("title"),
      description: t("intro"),
      url,
      locale,
    },
  };
}

/**
 * Словарь рынка красивых номеров.
 *
 * Нужен людям: покупатель слышит «голд», «бомб», «бацарик» и не понимает,
 * одно это и то же или разное. И он же честно закрывает запросы, набранные
 * латиницей: здесь такие написания объясняются как написания, а не рассыпаны
 * по сайту ради поисковика — рассыпать их было бы и накруткой, и мусором
 * для читателя.
 */
export default async function GlossaryPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: "glossary" });
  const tAll = await getTranslations({ locale, namespace: "landing" });
  const terms = t.raw("terms") as Term[];

  return (
    <div className="landing">
      <h1>{t("h1")}</h1>
      <p className="landing-intro">{t("intro")}</p>

      <h2>{t("spellingTitle")}</h2>
      <p className="landing-body">{t("spellingBody")}</p>

      <div className="wrap-x">
        <table className="glossary-table">
          <thead>
            <tr>
              <th>{t("colTerm")}</th>
              <th>{t("colAlso")}</th>
              <th>{t("colMeans")}</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((row) => (
              <tr key={row.term}>
                <td>
                  <b>{row.term}</b>
                </td>
                <td className="glossary-also">{row.also}</td>
                <td>{row.means}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{t("afterTitle")}</h2>
      <p className="landing-body">{t("afterBody")}</p>

      <h2>{t("ctaTitle")}</h2>
      <p className="landing-links">
        {LANDINGS.map((l) => (
          <Link key={l.slug} href={`/numbers/${l.slug}`}>
            {tAll(`${l.slug}.h1`)}
          </Link>
        ))}
      </p>
    </div>
  );
}
