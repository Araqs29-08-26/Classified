"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { detect } from "@/lib/phone";
import { classify, type ClassifyResult } from "@/lib/tierClassifier";
import { TIERS, TIER_EMOJI, formatPrice } from "@/lib/supabase";

export default function SellClient() {
  const t = useTranslations("sell");
  const tTiers = useTranslations("tiers");

  const [phone, setPhone] = useState("+374");
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [detected, setDetected] = useState<ReturnType<typeof detect> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const evaluated = classify(phone);
    if (!evaluated) {
      setResult(null);
      setDetected(null);
      setError(t("error"));
      return;
    }

    setError(null);
    setResult(evaluated);
    setDetected(detect(phone));
  }

  const tier = result ? TIERS.find((x) => x.name === result.tier) : null;

  const ctaHref = result
    ? `/new?number=${encodeURIComponent(phone)}&tier=${encodeURIComponent(
        result.tier
      )}&price=${tier?.price ?? 0}&type=${encodeURIComponent(
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

      {result && tier && (
        <div className="detail" style={{ marginTop: 20, maxWidth: 480 }}>
          <span className={`tier-badge tier-${result.tier}`}>
            <span aria-hidden="true">{TIER_EMOJI[result.tier]}</span>{" "}
            {tTiers(result.tier)}
          </span>

          <p style={{ marginTop: 12, marginBottom: 4, color: "var(--muted)" }}>
            {t("result.tierLabel")}
          </p>

          <div className="price">{formatPrice(tier.price)}</div>

          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
            {t("result.reasonPrefix")}
            {result.reason}
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
