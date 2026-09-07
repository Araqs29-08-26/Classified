"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { detect } from "@/lib/phone";
import { evaluateNumber, messageKey, type EngineResult } from "@/lib/numberEngine";
import { TIER_EMOJI, formatPrice } from "@/lib/supabase";

export default function SellClient() {
  const t = useTranslations("sell");
  const tTiers = useTranslations("tiers");
  const tEngine = useTranslations("engine");

  const [phone, setPhone] = useState("+374");
  const [result, setResult] = useState<EngineResult | null>(null);
  const [detected, setDetected] = useState<ReturnType<typeof detect> | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(evaluateNumber(phone));
    setDetected(detect(phone));
  }

  // Причину отказа объясняет сам движок: он лучше знает, что именно не так —
  // непонятная запись, буква внутри номера или несколько номеров в строке.
  const error =
    result && !result.ok
      ? tEngine(messageKey(result.errorCode), result.errorParams)
      : null;

  const ctaHref =
    result && result.ok
      ? `/new?number=${encodeURIComponent(phone)}&tier=${encodeURIComponent(
          result.status
        )}&price=${result.sellerTypical}&type=${encodeURIComponent(
          detected?.numberType ?? "Мобильный"
        )}${detected?.operator ? `&operator=${encodeURIComponent(detected.operator)}` : ""}`
      : "/new";

  return (
    <div style={{ padding: "32px 0" }}>
      <h1 style={{ marginBottom: 8 }}>{t("title")}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20, maxWidth: "60ch" }}>
        {t("subtitle")}
      </p>

      <form className="card" onSubmit={onSubmit} style={{ maxWidth: 480 }}>
        <div className="field">
          <label>{t("inputLabel")}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("placeholder")}
            required
          />
        </div>
        {error && <div className="notice">{error}</div>}
        <button className="btn btn-accent" type="submit">
          {t("button")}
        </button>
      </form>

      {result && result.ok && (
        <div className="detail" style={{ marginTop: 20, maxWidth: 480 }}>
          <span className={`tier-badge tier-${result.status}`}>
            <span aria-hidden="true">{TIER_EMOJI[result.status]}</span>{" "}
            {tTiers(result.status)}
          </span>

          <p style={{ marginTop: 12, marginBottom: 4, color: "var(--muted)" }}>
            {t("result.tierLabel")}
          </p>

          <div className="price">{formatPrice(result.sellerTypical)}</div>

          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
            {t("result.reasonPrefix")}
            {tEngine(messageKey(result.patternCode), result.patternParams)}
          </p>

          {detected && (
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              {detected.operator
                ? t("result.operatorNote", { operator: detected.operator })
                : t("result.operatorUnknown")}
            </p>
          )}

          <p style={{ marginTop: 16 }}>
            <Link href={ctaHref} className="btn btn-accent">
              {t("result.cta")}
            </Link>
          </p>

          <p className="notice" style={{ marginTop: 16, marginBottom: 0 }}>
            {t("result.disclaimer")}
          </p>
        </div>
      )}
    </div>
  );
}
