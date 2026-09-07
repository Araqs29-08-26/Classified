import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
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
  { path: "/terms", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.5 },
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
    .eq("listing_status", "active");

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
