"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const onlyDigits = (p: string) => p.replace(/[^\d]/g, "");

export default function ContactReveal({ phone }: { phone: string | null }) {
  const t = useTranslations("listing.contact");
  const [revealed, setRevealed] = useState(false);

  if (!phone) {
    return (
      <p style={{ fontSize: 13, color: "var(--faint)", marginTop: 16 }}>
        {t("noPhone")}
      </p>
    );
  }

  if (!revealed) {
    return (
      <>
        <div className="contact-box">{t("prompt")}</div>
        <p style={{ marginTop: 16 }}>
          <button
            className="btn btn-accent"
            type="button"
            onClick={() => setRevealed(true)}
          >
            {t("button")}
          </button>
        </p>
      </>
    );
  }

  const display = phone.startsWith("+") ? phone : `+${phone}`;

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
          href={`https://wa.me/${onlyDigits(phone)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("whatsapp")}
        </a>
        <a
          className="btn btn-ghost"
          href={`https://t.me/+${onlyDigits(phone)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("telegram")}
        </a>
      </div>
    </div>
  );
}
