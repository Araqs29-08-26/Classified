"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { supabase } from "@/lib/supabase";

const onlyDigits = (p: string) => p.replace(/[^\d]/g, "");

type State =
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "shown"; phone: string }
  | { kind: "missing" }
  | { kind: "failed" };

export default function ContactReveal({ listingId }: { listingId: string }) {
  const t = useTranslations("listing.contact");
  const [state, setState] = useState<State>({ kind: "hidden" });

  // Телефон намеренно не приходит вместе со страницей: до нажатия его нет ни
  // в разметке, ни в данных страницы, поэтому его не соберут ни поисковики,
  // ни простые сборщики. Функция в базе отдаёт телефон по одному объявлению
  // и только для активного — списком телефоны выгрузить нельзя.
  async function reveal() {
    setState({ kind: "loading" });

    const { data, error } = await supabase.rpc("listing_seller_phone", {
      listing_id: listingId,
    });

    if (error) {
      setState({ kind: "failed" });
      return;
    }

    setState(data ? { kind: "shown", phone: String(data) } : { kind: "missing" });
  }

  if (state.kind === "missing") {
    return (
      <p style={{ fontSize: 13, color: "var(--faint)", marginTop: 16 }}>
        {t("noPhone")}
      </p>
    );
  }

  if (state.kind !== "shown") {
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
