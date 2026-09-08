import { getTranslations } from "next-intl/server";

import { supabase, type Listing } from "@/lib/supabase";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

type SearchParams = {
  operator?: string;
  tier?: string;
  type?: string;
  sort?: string;
  mask?: string;
  where?: string;
  preset?: string;
};

export default async function HomePage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: SearchParams;
}) {
  const t = await getTranslations({ locale, namespace: "home" });

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("listing_status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="empty-state">
        <h2>{t("error.title")}</h2>
      </div>
    );
  }

  return (
    <HomeClient
      listings={(data ?? []) as Listing[]}
      initialOperator={searchParams.operator ?? ""}
      initialTier={searchParams.tier ?? ""}
      initialType={searchParams.type ?? ""}
      initialSort={searchParams.sort ?? ""}
      initialMask={searchParams.mask ?? ""}
      initialWhere={searchParams.where ?? "any"}
      initialPreset={searchParams.preset ?? ""}
    />
  );
}
