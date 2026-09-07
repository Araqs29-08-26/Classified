import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  TIER_EMOJI,
  formatPrice,
  supabase,
  type Listing,
} from "@/lib/supabase";
import ContactReveal from "./ContactReveal";

export const dynamic = "force-dynamic";

async function getListing(id: string): Promise<Listing | null> {
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .eq("listing_status", "active")
    .maybeSingle();

  return (data as Listing) ?? null;
}

// Телефон продавца здесь намеренно не запрашивается. Раньше он приходил на
// страницу вместе со всем остальным и был виден в её исходном коде до всякого
// нажатия — то есть доступен поисковикам и сборщикам. Теперь его запрашивает
// ContactReveal в момент нажатия «Связаться».

export async function generateMetadata({
  params,
}: {
  params: { locale: string; id: string };
}): Promise<Metadata> {
  const listing = await getListing(params.id);
  if (!listing) return {};

  const t = await getTranslations({ locale: params.locale, namespace: "tiers" });

  return {
    title: {
      absolute: `${listing.phone_number} — ${t(listing.status_tier)} — Araqs`,
    },
    description: `${formatPrice(listing.price)} · Araqs`,
  };
}

export default async function ListingPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const listing = await getListing(params.id);
  if (!listing) notFound();

  const t = await getTranslations({ locale: params.locale });
  const tierLabel = t(`tiers.${listing.status_tier}`);

  return (
    <div className="detail">
      <span className={`tier-badge tier-${listing.status_tier}`}>
        <span aria-hidden="true">{TIER_EMOJI[listing.status_tier]}</span>{" "}
        {tierLabel}
      </span>

      <div className="number mono">{listing.phone_number}</div>

      <div className="price">{formatPrice(listing.price)}</div>

      <p style={{ color: "var(--muted)" }}>
        {listing.operator}
        {" · "}
        {t(`numberTypes.${listing.number_type}`)}
        {listing.region ? ` · ${listing.region}` : ""}
        {listing.sms_verified ? ` · ${t("listing.verified")}` : ""}
      </p>

      {listing.description ? <p>{listing.description}</p> : null}

      <ContactReveal listingId={listing.id} />
    </div>
  );
}
