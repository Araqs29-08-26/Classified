"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice, supabase, type Listing } from "@/lib/supabase";
import { activePromo } from "../ListingCard";
import PromoDialog from "./PromoDialog";
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
  /** Объявление, для которого открыто окно продвижения. */
  const [promoFor, setPromoFor] = useState<Listing | null>(null);

  /**
   * Правка объявления: открыта на одном объявлении за раз.
   *
   * Меняются только цена и описание — остальное в карточке либо подтверждено
   * (номер), либо посчитано движком (статус), и правка сделала бы её неправдой.
   */
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

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

  /** Истёкшее объявление — оно ещё в кабинете, но уже не в каталоге. */
  function isExpired(listing: Listing): boolean {
    return !!listing.expires_at && new Date(listing.expires_at) <= new Date();
  }

  /**
   * Разместить заново.
   *
   * Срок отсчитывается заново от сегодняшнего дня, а дата создания остаётся
   * прежней: по ней видно, как давно номер продаётся.
   */
  async function repost(listing: Listing) {
    setBusyId(listing.id);
    const until = new Date();
    until.setMonth(until.getMonth() + 6);

    const { error } = await supabase
      .from("listings")
      .update({
        expires_at: until.toISOString(),
        listing_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);

    setBusyId(null);
    if (!error) void load();
  }

  function startEdit(listing: Listing) {
    setEditId(listing.id);
    setEditPrice(String(listing.price));
    setEditDescription(listing.description ?? "");
    setEditError(null);
  }

  async function saveEdit(listing: Listing) {
    const price = Number(editPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setEditError(t("editBadPrice"));
      return;
    }

    setBusyId(listing.id);
    setEditError(null);

    const { error } = await supabase
      .from("listings")
      .update({
        price,
        description: editDescription.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id);

    setBusyId(null);
    if (error) {
      setEditError(t("editFailed"));
      return;
    }

    setEditId(null);
    void load();
  }

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
                    {isExpired(l)
                      ? t("statusExpired")
                      : t(STATUS_KEY[l.listing_status] ?? "statusActive")}
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
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setPromoFor(l)}
                      >
                        {t("promoRequest")}
                      </button>
                    )}
                  </span>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => (editId === l.id ? setEditId(null) : startEdit(l))}
                  >
                    {t("edit")}
                  </button>

                  {isExpired(l) ? (
                    <button
                      className="btn btn-accent"
                      type="button"
                      disabled={busyId === l.id}
                      onClick={() => repost(l)}
                    >
                      {busyId === l.id ? t("working") : t("repost")}
                    </button>
                  ) : (
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
                  )}
                </div>
              )}

              {tab === "listings" && editId === l.id && (
                <form
                  className="account-edit"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveEdit(l);
                  }}
                >
                  <b>{t("editTitle")}</b>

                  <div className="field">
                    <label>{t("editPriceLabel")}</label>
                    <input
                      type="number"
                      min={1}
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>{t("editDescriptionLabel")}</label>
                    <textarea
                      rows={3}
                      value={editDescription}
                      placeholder={t("editDescriptionPlaceholder")}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>

                  <p className="account-edit-hint">{t("editHint")}</p>

                  {editError && <p className="order-error">{editError}</p>}

                  <div className="account-edit-actions">
                    <button
                      className="btn btn-accent"
                      type="submit"
                      disabled={busyId === l.id}
                    >
                      {busyId === l.id ? t("working") : t("editSave")}
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => setEditId(null)}
                    >
                      {t("editCancel")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {promoFor && (
        <PromoDialog listing={promoFor} onClose={() => setPromoFor(null)} />
      )}
    </div>
  );
}
