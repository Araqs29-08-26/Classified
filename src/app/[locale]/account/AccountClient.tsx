"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice, supabase, type Listing } from "@/lib/supabase";
import { activePromo } from "../ListingCard";
import { displayWho, useSession } from "@/lib/useSession";

type Tab = "listings" | "favorites";

const STATUS_KEY: Record<string, string> = {
  active: "statusActive",
  hidden: "statusHidden",
  sold: "statusSold",
  reserved: "statusReserved",
};

export default function AccountClient() {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const tTier = useTranslations("tiers");
  const tHome = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  const [tab, setTab] = useState<Tab>("listings");
  const [mine, setMine] = useState<Listing[] | null>(null);
  const [favorites, setFavorites] = useState<Listing[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Не вошедшему в кабинете делать нечего — отправляем на вход.
  useEffect(() => {
    if (!sessionLoading && !user) router.replace("/login");
  }, [sessionLoading, user, router]);

  const load = useCallback(async () => {
    if (!user) return;
    setFailed(false);

    const own = await supabase
      .from("listings")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    // Избранное хранится отдельной таблицей, объявления подтягиваются связью.
    const fav = await supabase
      .from("favorites")
      .select("listing_id, created_at, listings(*)")
      .order("created_at", { ascending: false });

    if (own.error || fav.error) {
      setFailed(true);
      return;
    }

    setMine((own.data ?? []) as Listing[]);

    // Связанное объявление приходит объектом, но типы Supabase описывают его
    // как массив — принимаем оба вида, чтобы не зависеть от этой мелочи.
    setFavorites(
      ((fav.data ?? []) as unknown as { listings: Listing | Listing[] | null }[])
        .map((row) => (Array.isArray(row.listings) ? row.listings[0] : row.listings))
        .filter((l): l is Listing => !!l)
    );
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(listing: Listing, status: string) {
    setBusyId(listing.id);
    const { error } = await supabase
      .from("listings")
      .update({ listing_status: status, updated_at: new Date().toISOString() })
      .eq("id", listing.id);
    setBusyId(null);
    if (!error) void load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (sessionLoading || !user) {
    return <div style={{ padding: "32px 0" }} />;
  }

  const list = tab === "listings" ? mine : favorites;

  return (
    <div style={{ padding: "32px 0" }}>
      <div className="account-head">
        <div>
          <h1 style={{ marginBottom: 6 }}>{t("title")}</h1>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: 13.5 }}>
            {t("signedInAs", { who: displayWho(user) })}
          </p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={signOut}>
          {tAuth("signOut")}
        </button>
      </div>

      <div className="account-tabs">
        <button
          type="button"
          className={"chip" + (tab === "listings" ? " active" : "")}
          onClick={() => setTab("listings")}
        >
          {t("myListings")}
          {mine ? ` · ${mine.length}` : ""}
        </button>
        <button
          type="button"
          className={"chip" + (tab === "favorites" ? " active" : "")}
          onClick={() => setTab("favorites")}
        >
          {t("favorites")}
          {favorites ? ` · ${favorites.length}` : ""}
        </button>
      </div>

      {failed && <div className="notice">{t("loadFailed")}</div>}

      {list && list.length === 0 && (
        <div className="empty-state">
          <p>{tab === "listings" ? t("emptyListings") : t("emptyFavorites")}</p>
          {tab === "listings" && (
            <p style={{ marginTop: 16 }}>
              <Link href="/new" className="btn btn-accent">
                {t("postFirst")}
              </Link>
            </p>
          )}
        </div>
      )}

      {list && list.length > 0 && (
        <div className="account-list">
          {list.map((l) => (
            <div key={l.id} className="account-row">
              <Link href={`/listing/${l.id}`} className="account-row-main">
                <span className="mono account-row-number">{l.phone_number}</span>
                <span className={`tier-badge tier-${l.status_tier}`}>
                  {tTier(l.status_tier)}
                </span>
                <span className="account-row-price">{formatPrice(l.price)}</span>
              </Link>

              {tab === "listings" && (
                <div className="account-row-actions">
                  <span className="account-row-status">
                    {t(STATUS_KEY[l.listing_status] ?? "statusActive")}
                  </span>

                  {/* Продвижение показываем всегда: и когда оно есть, и когда его нет,
                      иначе продавец не узнает, что такая возможность существует. */}
                  <span className="account-row-promo">
                    {activePromo(l) ? (
                      <>
                        <b>{tHome(`promo.${activePromo(l)}`)}</b>{" "}
                        {t("promoActiveUntil", {
                          date: new Date(l.promo_until!).toLocaleDateString(locale),
                        })}
                      </>
                    ) : (
                      <Link href="/support" title={t("promoRequestHint")}>
                        {t("promoRequest")}
                      </Link>
                    )}
                  </span>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busyId === l.id}
                    onClick={() =>
                      setStatus(l, l.listing_status === "active" ? "hidden" : "active")
                    }
                  >
                    {busyId === l.id
                      ? t("working")
                      : l.listing_status === "active"
                        ? t("hide")
                        : t("publish")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
