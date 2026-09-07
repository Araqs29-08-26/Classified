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

type State = "idle" | "form" | "sending" | "done" | "failed";

export default function ReportButton({ listingId }: { listingId: string }) {
  const t = useTranslations("listing.report");
  const [state, setState] = useState<State>("idle");
  const [reason, setReason] = useState<string>(REASONS[0]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("reports").insert({
      listing_id: listingId,
      // Жалобу может подать и незалогиненный посетитель — тогда автор неизвестен.
      reporter_id: user?.id ?? null,
      reason,
    });

    setState(error ? "failed" : "done");
  }

  if (state === "done") {
    return <p className="report-done">{t("done")}</p>;
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
