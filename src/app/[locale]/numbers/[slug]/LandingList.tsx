"use client";

import { useLocale } from "next-intl";

import { evaluateNumber, OPERATOR_CODE } from "@/lib/numberEngine";
import { buildIndex, type IndexRecord } from "@/lib/numberSearch";
import type { Listing } from "@/lib/supabase";
import ListingCard, { type ValuedListing } from "../../ListingCard";

/**
 * Список номеров на странице подборки.
 *
 * Оценка считается на стороне браузера тем же движком, что и в каталоге, —
 * иначе одно и то же объявление показывало бы на двух страницах разные числа.
 */
export default function LandingList({
  listings,
  empty,
}: {
  listings: Listing[];
  empty: string;
}) {
  const locale = useLocale();

  if (listings.length === 0) {
    return <p className="landing-empty">{empty}</p>;
  }

  const valued: ValuedListing[] = listings.map((l) => {
    const v = evaluateNumber(l.phone_number, {
      operator: OPERATOR_CODE[l.operator] ?? null,
      heldOverLimit: l.held_over_limit,
      locale,
    });
    const fee = v.ok ? v.transferFee : 0;
    return {
      listing: l,
      index: l.beauty_index ?? (v.ok ? v.index : null),
      patternCode: l.pattern_code ?? (v.ok ? v.patternCode : null),
      pattern: v.ok ? v.pattern : null,
      window: v.ok ? v.window : null,
      patternFrom: v.ok ? v.patternFrom : null,
      patternTo: v.ok ? v.patternTo : null,
      fee,
      search: v.ok ? (buildIndex(v) as IndexRecord | null) : null,
    };
  });

  return (
    <div className="listing-cards">
      {valued.map((item) => (
        <ListingCard key={item.listing.id} item={item} />
      ))}
    </div>
  );
}
