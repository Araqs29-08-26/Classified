"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { supabase } from "@/lib/supabase";

const onlyDigits = (p: string) => p.replace(/[^\d]/g, "");

/**
 * Связь с продавцом: телефон либо письмо.
 *
 * Продавец может зарегистрироваться по почте — тогда телефона у него нет,
 * и прежняя кнопка не показывала ничего: объявление висит, а связаться не с
 * кем. Теперь в этом случае открывается окно письма.
 *
 * Ни телефон, ни адрес почты не приходят вместе со страницей. Телефон
 * отдаётся по нажатию и по одному объявлению, адрес почты не отдаётся вовсе:
 * письмо уходит с сервера, а покупатель оставляет свой контакт для ответа.
 * Причина одна и та же — списком контакты продавцов выгрузить нельзя.
 */
type State =
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "phone"; phone: string }
  | { kind: "letter" }
  | { kind: "sent" }
  | { kind: "none" }
  | { kind: "failed" };

/** Почему письмо не ушло — словами, которые человеку что-то говорят. */
type SendError = "failed" | "tooMany" | null;

export default function ContactReveal({ listingId }: { listingId: string }) {
  const t = useTranslations("listing.contact");
  const [state, setState] = useState<State>({ kind: "hidden" });

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<SendError>(null);

  async function reveal() {
    setState({ kind: "loading" });

    const { data, error } = await supabase.rpc("listing_seller_contact", {
      listing_id: listingId,
    });

    if (error) {
      setState({ kind: "failed" });
      return;
    }

    // Функция возвращает строку таблицы — в ответе это список из одной записи.
    const row = (Array.isArray(data) ? data[0] : data) as
      | { phone: string | null; has_email: boolean }
      | undefined;

    if (row?.phone) setState({ kind: "phone", phone: String(row.phone) });
    else if (row?.has_email) setState({ kind: "letter" });
    else setState({ kind: "none" });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSendError(null);

    const { data, error } = await supabase.rpc("send_listing_message", {
      listing_id: listingId,
      writer_contact: contact,
      body: message,
      writer_name: name,
    });

    if (error) {
      // Слишком частые письма — не поломка, а защита ящика продавца,
      // и человеку надо сказать об этом иначе, чем об ошибке.
      setSendError(error.message.includes("too_many") ? "tooMany" : "failed");
      setSending(false);
      return;
    }

    // Письмо уже сохранено. Если почта не уйдёт, оно всё равно на месте,
    // а покупателю показывать ошибку незачем — он своё сделал.
    void supabase.functions.invoke("notify-seller", {
      body: { messageId: data },
    });

    setSending(false);
    setState({ kind: "sent" });
  }

  if (state.kind === "none") {
    return (
      <p style={{ fontSize: 13, color: "var(--faint)", marginTop: 16 }}>
        {t("noContact")}
      </p>
    );
  }

  if (state.kind === "sent") {
    return (
      <div className="contact-box">
        <b>{t("sentTitle")}</b>
        <p style={{ margin: "6px 0 0", fontSize: 13 }}>{t("sentText")}</p>
      </div>
    );
  }

  if (state.kind === "letter") {
    return (
      <form className="contact-box contact-letter" onSubmit={send}>
        <b>{t("writeTitle")}</b>
        <p className="contact-letter-hint">{t("promptEmail")}</p>
        <p className="contact-letter-hint">{t("writeHint")}</p>

        <div className="field">
          <label>{t("nameLabel")}</label>
          <input
            type="text"
            value={name}
            maxLength={100}
            placeholder={t("namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label>{t("yourContactLabel")}</label>
          <input
            type="text"
            value={contact}
            maxLength={200}
            placeholder={t("yourContactPlaceholder")}
            onChange={(e) => setContact(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label>{t("messageLabel")}</label>
          <textarea
            rows={4}
            value={message}
            maxLength={4000}
            placeholder={t("messagePlaceholder")}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>

        {sendError && <p className="order-error">{t(sendError)}</p>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-accent" type="submit" disabled={sending}>
            {sending ? t("sending") : t("send")}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setState({ kind: "hidden" })}
          >
            {t("cancel")}
          </button>
        </div>
      </form>
    );
  }

  if (state.kind !== "phone") {
    return (
      <>
        <div className="contact-box">
          {state.kind === "failed" ? t("error") : t("prompt")}
        </div>
        <p style={{ marginTop: 16 }}>
          <button
            className="btn btn-accent"
            type="button"
            onClick={reveal}
            disabled={state.kind === "loading"}
          >
            {state.kind === "loading" ? t("loading") : t("button")}
          </button>
        </p>
      </>
    );
  }

  const display = state.phone.startsWith("+") ? state.phone : `+${state.phone}`;

  return (
    <div className="contact-box">
      <div style={{ marginBottom: 10 }}>
        {t("phoneLabel")}{" "}
        <a href={`tel:${display}`} className="mono">
          {display}
        </a>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          className="btn btn-accent"
          href={`https://wa.me/${onlyDigits(state.phone)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("whatsapp")}
        </a>
        <a
          className="btn btn-ghost"
          href={`https://t.me/+${onlyDigits(state.phone)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("telegram")}
        </a>
      </div>
    </div>
  );
}
