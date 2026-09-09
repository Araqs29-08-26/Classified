"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { supabase } from "@/lib/supabase";

/**
 * Обращение в поддержку формой, а не почтовой ссылкой.
 *
 * Ссылка mailto: открывает почтовую программу устройства — на компьютере это
 * оказался Outlook, а на чужом или рабочем устройстве не открывается ничего.
 * Форма работает у всех и складывает обращения туда же, где администратор
 * разбирает остальное.
 *
 * Адрес почты оставлен рядом обычным текстом: кому-то привычнее написать
 * самому, и его нужно видеть, а не угадывать.
 */
type State = "form" | "sending" | "done" | "failed";

export default function SupportForm({ email }: { email: string }) {
  const t = useTranslations("support");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<State>("form");
  const [copied, setCopied] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("support_requests").insert({
      user_id: user?.id ?? null,
      contact,
      message,
    });

    setState(error ? "failed" : "done");
  }

  return (
    <>
      {state === "done" ? (
        <div className="card">
          <h2 style={{ margin: 0, fontSize: 18 }}>{t("doneTitle")}</h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
            {t("doneText")}
          </p>
        </div>
      ) : (
        <form className="card" onSubmit={send}>
          <div className="field">
            <label>{t("contactLabel")}</label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t("contactPlaceholder")}
              required
            />
          </div>

          <div className="field">
            <label>{t("messageLabel")}</label>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              required
            />
          </div>

          {state === "failed" && <p className="order-error">{t("failed")}</p>}

          <button
            className="btn btn-accent"
            type="submit"
            disabled={state === "sending"}
          >
            {state === "sending" ? t("sending") : t("send")}
          </button>
        </form>
      )}

      <p className="support-mail">
        {t("orMail")}{" "}
        <button
          type="button"
          className="link-button mono"
          onClick={() => {
            void navigator.clipboard?.writeText(email);
            setCopied(true);
          }}
        >
          {email}
        </button>
        {copied && <span className="support-copied">{t("copied")}</span>}
      </p>
    </>
  );
}
