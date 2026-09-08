"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { formatAmount, supabase, type Listing } from "@/lib/supabase";
import {
  EXTRA_LISTING_PRICE,
  PROMO_KINDS,
  PROMO_PRICES,
  type PromoKind,
} from "@/lib/promoPrices";

/**
 * Окно продвижения: услуги, их описания и цены.
 *
 * Раньше отсюда уводили в поддержку, и продавец так и не узнавал, что именно
 * ему предлагают и почём. Теперь прайс виден сразу, а поддержка нужна только
 * для оплаты, пока приём платежей на сайте не подключён.
 */
type State = "idle" | "sending" | "done" | "failed";

export default function PromoDialog({
  listing,
  onClose,
}: {
  listing: Listing;
  onClose: () => void;
}) {
  const t = useTranslations("promo");
  const [chosen, setChosen] = useState<PromoKind[]>([]);
  const [state, setState] = useState<State>("idle");

  const total = chosen.reduce((sum, kind) => sum + PROMO_PRICES[kind], 0);

  function toggle(kind: PromoKind) {
    setChosen((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
    );
  }

  async function order() {
    setState("sending");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState("failed");
      return;
    }

    const { error } = await supabase.from("promo_requests").insert({
      listing_id: listing.id,
      requester_id: user.id,
      kinds: chosen,
      amount: total,
    });

    setState(error ? "failed" : "done");
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal promo-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        onClick={(e) => e.stopPropagation()}
      >
        {state === "done" ? (
          <>
            <h2>{t("orderedTitle")}</h2>
            <p>{t("orderedText", { number: listing.phone_number })}</p>
            <div className="promo-modal-foot">
              <button className="btn btn-accent" type="button" onClick={onClose}>
                {t("cancel")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{t("title")}</h2>
            <p className="promo-modal-sub">{t("subtitle")}</p>
            <p className="promo-modal-number mono">
              {t("forNumber", { number: listing.phone_number })}
            </p>

            <ul className="promo-services">
              {PROMO_KINDS.map((kind) => (
                <li key={kind}>
                  <label
                    className={
                      "promo-service" + (chosen.includes(kind) ? " chosen" : "")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={chosen.includes(kind)}
                      onChange={() => toggle(kind)}
                    />
                    <span className="promo-service-body">
                      <b>{t(`${kind}Title`)}</b>
                      <span>{t(`${kind}Text`)}</span>
                    </span>
                    <span className="promo-service-price">
                      <b>{formatAmount(PROMO_PRICES[kind])}</b>
                      <span>{t("duration")}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {/* Плата за второе объявление — не услуга, а условие размещения:
                выбрать её нельзя, но знать о ней продавец должен. */}
            <div className="promo-extra">
              <span className="promo-extra-body">
                <b>{t("extraTitle")}</b>
                <span>{t("extraText", { amount: EXTRA_LISTING_PRICE })}</span>
              </span>
            </div>

            <div className="promo-total">
              <span>{t("totalLabel")}</span>
              <b>{formatAmount(total)}</b>
            </div>

            <p className="promo-modal-note">{t("payNote")}</p>
            {state === "failed" && <p className="report-error">{t("orderFailed")}</p>}

            <div className="promo-modal-foot">
              <button className="btn btn-ghost" type="button" onClick={onClose}>
                {t("cancel")}
              </button>
              <button
                className="btn btn-accent"
                type="button"
                disabled={chosen.length === 0 || state === "sending"}
                onClick={order}
              >
                {t("order")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
