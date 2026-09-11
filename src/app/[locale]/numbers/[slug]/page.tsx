import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
import { findLanding, LANDINGS, matchesLanding } from "@/lib/landing";
import { supabase, type Listing } from "@/lib/supabase";
import { evaluateNumber, OPERATOR_CODE } from "@/lib/numberEngine";
import LandingList from "./LandingList";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  if (!findLanding(slug)) return {};

  const t = await getTranslations({ locale, namespace: `landing.${slug}` });
  const url = `${SITE_URL}/${locale}/numbers/${slug}`;

  return {
    title: { absolute: `${t("title")} — Araqs` },
    description: t("intro"),
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${SITE_URL}/${l}/numbers/${slug}`])
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
 * Страница под поисковый запрос.
 *
 * Отвечает на вопрос человека текстом и тут же показывает подходящие номера.
 * Текст здесь не украшение: подборка должна быть полезной и тогда, когда
 * подходящих объявлений ноль, иначе поисковику нечего показывать, а человеку
 * незачем оставаться.
 */
export default async function LandingPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  const landing = findLanding(slug);
  if (!landing) notFound();

  const t = await getTranslations({ locale, namespace: `landing.${slug}` });
  const tc = await getTranslations({ locale, namespace: "landing.common" });
  const tAll = await getTranslations({ locale, namespace: "landing" });

  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("listing_status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  // Код узора у старых объявлений не сохранён — тогда считаем его движком.
  const listings = ((data ?? []) as Listing[]).filter((l) => {
    let patternCode = l.pattern_code;
    if (!patternCode && landing.patterns) {
      const v = evaluateNumber(l.phone_number, {
        operator: OPERATOR_CODE[l.operator] ?? null,
        heldOverLimit: l.held_over_limit,
        locale,
      });
      patternCode = v.ok ? v.patternCode : null;
    }
    return matchesLanding(landing, l, patternCode);
  });

  const body = t.raw("body") as string[];

  return (
    <div className="landing">
      <h1>{t("h1")}</h1>
      <p className="landing-intro">{t("intro")}</p>

      {body.map((paragraph, i) => (
        <p key={i} className="landing-body">
          {paragraph}
        </p>
      ))}

      <h2>{tc("found")}</h2>
      <LandingList listings={listings} empty={tc("empty")} />

      <p className="landing-actions">
        <Link href="/" className="btn btn-accent">
          {tc("toCatalog")}
        </Link>
        <Link href="/sell" className="btn btn-ghost">
          {tc("sellCta")}
        </Link>
      </p>

      {/* Подборки ссылаются друг на друга: так их находит и поисковик,
          и человек, пришедший по одному запросу и увидевший соседний. */}
      <h2>{tc("alsoTitle")}</h2>
      <p className="landing-links">
        {LANDINGS.filter((l) => l.slug !== slug).map((l) => (
          <Link key={l.slug} href={`/numbers/${l.slug}`}>
            {tAll(`${l.slug}.h1`)}
          </Link>
        ))}
      </p>
    </div>
  );
}
