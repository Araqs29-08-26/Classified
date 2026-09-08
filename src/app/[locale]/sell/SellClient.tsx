"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { detect } from "@/lib/phone";
import { evaluateNumber, type EngineResult } from "@/lib/numberEngine";
import { formatPrice, formatAmount } from "@/lib/supabase";
import PatternNumber from "../PatternNumber";
import CertificateButton from "./CertificateButton";

/**
 * Оценка номера — вход для того, кто ещё не решил, продавать ли.
 *
 * Показывается тот же разбор, что и в тестере движка: подсвеченный узор,
 * статус с индексом, пояснения, диапазон цены и что в итоге платит покупатель.
 * Одна цифра «рекомендуем» без диапазона вводила в заблуждение: продавец
 * считал её единственно верной.
 */
export default function SellClient() {
  const t = useTranslations("sell");
  const tr = useTranslations("sell.result");
  const tTiers = useTranslations("tiers");

  // Номер берётся из адреса, если он там есть: иначе смена языка сбрасывала бы
  // и введённый номер, и показанную оценку.
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("number") ?? "";

  const [phone, setPhone] = useState(fromUrl || "+374");
  const [result, setResult] = useState<EngineResult | null>(
    fromUrl ? evaluateNumber(fromUrl) : null
  );
  const [detected, setDetected] = useState<ReturnType<typeof detect> | null>(
    fromUrl ? detect(fromUrl) : null
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(evaluateNumber(phone));
    setDetected(detect(phone));

    // Оценённый номер уходит в адрес — так его можно и переслать, и сохранить,
    // и не потерять при смене языка.
    const q = new URLSearchParams(window.location.search);
    q.set("number", phone);
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }

  // Причину отказа объясняет сам движок: он лучше знает, что именно не так —
  // непонятная запись, буква внутри номера или несколько номеров в строке.
  const error = result && !result.ok ? result.error : null;

  const ctaHref =
    result && result.ok
      ? `/new?number=${encodeURIComponent(phone)}&tier=${encodeURIComponent(
          result.status
        )}&price=${result.sellerTypical}&type=${encodeURIComponent(
          detected?.numberType ?? "Мобильный"
        )}${detected?.operator ? `&operator=${encodeURIComponent(detected.operator)}` : ""}`
      : "/new";

  // Где стоит отметка «рекомендуем» внутри полосы диапазона.
  const markPercent =
    result && result.ok && result.sellerMax > result.sellerMin
      ? ((result.sellerTypical - result.sellerMin) /
          (result.sellerMax - result.sellerMin)) *
        100
      : 50;

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
        <div className="breakdown">
          <h2>{tr("breakdownTitle")}</h2>

          <PatternNumber
            window={result.window}
            from={result.patternFrom}
            to={result.patternTo}
          />

          <p className="breakdown-legend">
            <span className="legend-code" /> {tr("legendCode")}
            <span className="legend-lit" /> {tr("legendPattern")}
          </p>

          <div className="breakdown-head">
            <span className={`tier-badge tier-${result.status}`}>
              {tTiers(result.status)}
            </span>
            <span className="breakdown-index">
              <b>{result.index}</b> {tr("indexLabel")}
            </span>
          </div>

          <p className="breakdown-pattern">{result.pattern}</p>

          {result.notes.length > 0 && (
            <ul className="breakdown-notes">
              {result.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          )}

          <h2>{tr("rangeTitle")}</h2>

          <div className="range">
            <div className="range-bar">
              <span className="range-mark" style={{ left: `${markPercent}%` }} />
            </div>
            <div className="range-ends">
              <span>
                <em>{tr("rangeLow")}</em>
                <b>{formatAmount(result.sellerMin)}</b>
              </span>
              <span className="range-rec">
                <em>{tr("rangeRec")}</em>
                <b>{formatPrice(result.sellerTypical)}</b>
              </span>
              <span className="range-high">
                <em>{tr("rangeHigh")}</em>
                <b>{formatAmount(result.sellerMax)}</b>
              </span>
            </div>
            <p className="breakdown-hint">{tr("rangeHint")}</p>
          </div>

          <h2>{tr("buyerTitle")}</h2>

          <table className="money-table">
            <tbody>
              <tr>
                <td>{tr("buyerSeller")}</td>
                <td className="col-right mono">{formatAmount(result.sellerTypical)}</td>
              </tr>
              <tr>
                <td>
                  {tr("buyerFee")}
                  <span className="money-note">{result.feeNote}</span>
                </td>
                <td className="col-right mono">{formatAmount(result.transferFee)}</td>
              </tr>
              <tr className="money-total">
                <td>{tr("buyerTotal")}</td>
                <td className="col-right mono">{formatAmount(result.totalTypical)}</td>
              </tr>
            </tbody>
          </table>

          <p className="breakdown-hint">
            {detected?.operator
              ? tr("operatorNote", { operator: detected.operator })
              : tr("operatorUnknown")}
          </p>

          <div className="breakdown-actions">
            <Link href={ctaHref} className="btn btn-accent">
              {tr("cta")}
            </Link>
          </div>

          <div className="certificate">
            <b>{tr("certificateTitle")}</b>
            <p>{tr("certificateText")}</p>
            <CertificateButton phone={phone} status={result.status} />
          </div>

          <p className="notice" style={{ marginTop: 16, marginBottom: 0 }}>
            {tr("disclaimer")}
          </p>
        </div>
      )}
    </div>
  );
}
