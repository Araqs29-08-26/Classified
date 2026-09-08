"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

/**
 * Кнопка «Заказать» рядом с услугой.
 *
 * Приём оплаты на сайте не подключён, поэтому заказ — это заявка: она ложится
 * в promo_requests, дальше с человеком связывается администратор. Когда оплата
 * появится, кнопка поведёт на страницу оплаты, а таблица заявок останется той
 * же — по ней видно, что и почём заказывали.
 */
type State = "idle" | "sending" | "done" | "failed";

export default function OrderButton({
  kind,
  amount,
}: {
  /** Код услуги: shop_50, hunter, certificate и прочие. */
  kind: string;
  amount: number;
}) {
  const t = useTranslations("promoPage");
  const { user, loading } = useSession();
  const [state, setState] = useState<State>("idle");

  if (loading) return <span className="order-slot" />;

  // Заявку нужно к кому-то привязать, иначе некому отвечать.
  if (!user) {
    return (
      <Link href="/login" className="btn btn-ghost order-button">
        {t("signInToOrder")}
      </Link>
    );
  }

  if (state === "done") {
    return <span className="order-done">{t("ordered")}</span>;
  }

  async function order() {
    setState("sending");
    const { error } = await supabase.from("promo_requests").insert({
      // Подписка и сертификат не относятся к конкретному объявлению.
      listing_id: null,
      requester_id: user!.id,
      kinds: [kind],
      amount,
    });
    setState(error ? "failed" : "done");
  }

  return (
    <span className="order-slot">
      <button
        type="button"
        className="btn btn-accent order-button"
        disabled={state === "sending"}
        onClick={order}
      >
        {state === "sending" ? t("ordering") : t("order")}
      </button>
      {state === "failed" && <span className="order-error">{t("orderFailed")}</span>}
    </span>
  );
}
