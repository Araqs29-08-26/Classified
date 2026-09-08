"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

/**
 * Избранное.
 *
 * Не вошедшему кнопка не показывается: избранное привязано к учётной записи,
 * и хранить его «на этом устройстве» значило бы потерять при первом же входе
 * с телефона. Вместо кнопки — приглашение войти.
 */
export default function FavoriteButton({ listingId }: { listingId: string }) {
  const t = useTranslations("account");
  const { user, loading } = useSession();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setSaved(null);
      return;
    }
    let alive = true;
    supabase
      .from("favorites")
      .select("listing_id")
      .eq("listing_id", listingId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setSaved(!!data);
      });
    return () => {
      alive = false;
    };
  }, [user, listingId]);

  if (loading) return null;

  if (!user) {
    return (
      <Link href="/login" className="favorite-hint">
        {t("signInToFavorite")}
      </Link>
    );
  }

  async function toggle() {
    if (!user) return;
    setBusy(true);
    if (saved) {
      await supabase
        .from("favorites")
        .delete()
        .eq("listing_id", listingId)
        .eq("user_id", user.id);
      setSaved(false);
    } else {
      await supabase.from("favorites").insert({ listing_id: listingId, user_id: user.id });
      setSaved(true);
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      className={"favorite-btn" + (saved ? " active" : "")}
      onClick={toggle}
      disabled={busy}
      aria-pressed={!!saved}
    >
      <span aria-hidden="true">{saved ? "★" : "☆"}</span>
      {saved ? t("removeFavorite") : t("addFavorite")}
    </button>
  );
}
