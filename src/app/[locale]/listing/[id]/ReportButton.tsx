"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { supabase } from "@/lib/supabase";

/**
 * Жалоба на объявление.
 *
 * В базе хранится КОД причины, а не её текст: тексты живут в словарях сайта
 * и переводятся отдельно, а жалобы, поданные на разных языках, остаются
 * сравнимыми между собой.
 */
const REASONS = ["not_owner", "fraud", "wrong_data", "spam"] as const;

type State = "idle" | "form" | "sending" | "done" | "failed" | "tooMany";

export default function ReportButton({ listingId }: { listingId: string }) {
  const t = useTranslations("listing.report");
  const [state, setState] = useState<State>("idle");
  const [reason, setReason] = useState<string>(REASONS[0]);
  /** Оба поля необязательные: сообщить о мошеннике можно и не называя себя. */
  const [comment, setComment] = useState("");
  const [contact, setContact] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");

    // Жалоба записывается функцией в базе, а не прямой вставкой: там же
    // проверяется, что объявление существует и что жалобами его не заваливают.
    // Автор берётся из сессии — подать жалобу можно и не входя на сайт.
    const { data, error } = await supabase.rpc("file_report", {
      listing_id: listingId,
      reason,
      comment,
      contact,
    });

    if (error) {
      setState(error.message.includes("too_many") ? "tooMany" : "failed");
      return;
    }

    // Письмо администратору — уже после того, как жалоба сохранена. Если почта
    // не уйдёт, жалоба всё равно на месте, и человеку показывать ошибку незачем.
    void supabase.functions.invoke("notify-report", {
      body: { reportId: data },
    });

    setState("done");
  }

  if (state === "done") {
    return <p className="report-done">{t("done")}</p>;
  }

  // Слишком частые жалобы — не поломка: человеку надо сказать, что сигнал
  // уже принят, а не что у него что-то не сработало.
  if (state === "tooMany") {
    return <p className="report-done">{t("tooMany")}</p>;
  }

  if (state === "idle" || state === "failed") {
    return (
      <div className="report-block">
        <button
          type="button"
          className="report-link"
          onClick={() => setState("form")}
        >
          <span aria-hidden="true">⚑</span> {t("button")}
        </button>
        {state === "failed" && <p className="report-error">{t("error")}</p>}
      </div>
    );
  }

  return (
    <form className="report-block report-form" onSubmit={send}>
      <p className="report-title">{t("title")}</p>

      {REASONS.map((code) => (
        <label key={code} className="report-reason">
          <input
            type="radio"
            name="reason"
            value={code}
            checked={reason === code}
            onChange={() => setReason(code)}
          />
          <span>{t(`reasons.${code}`)}</span>
        </label>
      ))}

      <div className="field">
        <label>{t("commentLabel")}</label>
        <textarea
          rows={2}
          value={comment}
          maxLength={2000}
          placeholder={t("commentPlaceholder")}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <div className="field">
        <label>{t("contactLabel")}</label>
        <input
          type="text"
          value={contact}
          maxLength={200}
          placeholder={t("contactPlaceholder")}
          onChange={(e) => setContact(e.target.value)}
        />
      </div>

      <p className="report-privacy">{t("privacy")}</p>

      <div className="report-actions">
        <button
          className="btn btn-accent"
          type="submit"
          disabled={state === "sending"}
        >
          {state === "sending" ? t("sending") : t("submit")}
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => setState("idle")}
          disabled={state === "sending"}
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
