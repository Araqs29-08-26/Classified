import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { LANDINGS } from "@/lib/landing";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";

const STATIC_PATHS: Array<{
  path: string;
  changeFrequency: "hourly" | "monthly";
  priority: number;
}> = [
  { path: "", changeFrequency: "hourly", priority: 1 },
  { path: "/sell", changeFrequency: "monthly", priority: 0.5 },
  { path: "/new", changeFrequency: "monthly", priority: 0.5 },
  { path: "/rules", changeFrequency: "monthly", priority: 0.6 },
  { path: "/rules/transfer", changeFrequency: "monthly", priority: 0.6 },
  { path: "/rules/promo", changeFrequency: "monthly", priority: 0.5 },
  { path: "/rules/terms", changeFrequency: "monthly", priority: 0.4 },
  { path: "/glossary", changeFrequency: "monthly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.5 },
  // Подборки под поисковые запросы обновляются вместе с каталогом.
  ...LANDINGS.map((l) => ({
    path: `/numbers/${l.slug}`,
    changeFrequency: "hourly" as const,
    priority: 0.8,
  })),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const item of STATIC_PATHS) {
      entries.push({
        url: `${SITE_URL}/${locale}${item.path}`,
        changeFrequency: item.changeFrequency,
        priority: item.priority,
      });
    }
  }

  const { data } = await supabase
    .from("listings")
    .select("id, updated_at")
    .eq("listing_status", "active")
    .gt("expires_at", new Date().toISOString());

  for (const listing of data ?? []) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${SITE_URL}/${locale}/listing/${listing.id}`,
        lastModified: listing.updated_at,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  return entries;
}
