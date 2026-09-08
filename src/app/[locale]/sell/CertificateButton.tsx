"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { formatPrice, supabase } from "@/lib/supabase";
import { CERTIFICATE_PRICE } from "@/lib/promoPrices";
import { useSession } from "@/lib/useSession";

/**
 * Заказ сертификата оценки.
 *
 * Сертификат выдаёт администратор: движок считает одинаково для всех, а
 * заверяет расчёт площадка. Заявка ложится в ту же таблицу, что и заказы
 * продвижения, — там же администратор их и разбирает.
 */
type State = "idle" | "sending" | "done" | "failed";

export default function CertificateButton({
  phone,
  status,
}: {
  phone: string;
  status: string;
}) {
  const t = useTranslations("sell.result");
  const { user, loading } = useSession();
  const [state, setState] = useState<State>("idle");

  if (loading) return null;

  if (!user) {
    return (
      <Link href="/login" className="btn btn-ghost">
        {t("certificateSignIn")}
      </Link>
    );
  }

  if (state === "done") {
    return <p className="order-done">{t("certificateDone")}</p>;
  }

  async function order() {
    setState("sending");
    const { error } = await supabase.from("promo_requests").insert({
      listing_id: null,
      requester_id: user!.id,
      // Номер и статус нужны, чтобы администратор выдал сертификат именно на них.
      kinds: ["certificate", phone, status],
      amount: CERTIFICATE_PRICE,
    });
    setState(error ? "failed" : "done");
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-accent"
        disabled={state === "sending"}
        onClick={order}
      >
        {state === "sending"
          ? t("certificateOrdering")
          : `${t("certificateOrder")} — ${formatPrice(CERTIFICATE_PRICE)}`}
      </button>
      {state === "failed" && <p className="order-error">{t("certificateFailed")}</p>}
    </>
  );
}
