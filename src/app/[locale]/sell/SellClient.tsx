"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { detect } from "@/lib/phone";
import {
  engineMessage,
  evaluateNumber,
  fillMessage,
  OPERATOR_NAME,
  type EngineResult,
} from "@/lib/numberEngine";
import { formatPrice, formatAmount } from "@/lib/supabase";
import PatternNumber from "../PatternNumber";

/**
 * Оценка номера — вход для того, кто ещё не решил, продавать ли.
 *
 * Показывается тот же разбор, что и в тестере движка: подсвеченный узор,
 * статус с индексом, пояснения, диапазон цены и что в итоге платит покупатель.
 * Одна цифра «рекомендуем» без диапазона вводила в заблуждение: продавец
 * считал её единственно верной.
 */
export default function SellClient() {
  const locale = useLocale();
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
        )}&price=${result.priceTypical}&type=${encodeURIComponent(
          detected?.numberType ?? "Мобильный"
        )}${detected?.operator ? `&operator=${encodeURIComponent(detected.operator)}` : ""}`
      : "/new";

  // Где стоит отметка «рекомендуем» внутри полосы диапазона.
  const markPercent =
    result && result.ok && result.priceMax > result.priceMin
      ? ((result.priceTypical - result.priceMin) /
          (result.priceMax - result.priceMin)) *
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

          {/* Признаков в номере бывает несколько, и показывать надо все:
              041 10 90 90 — это и пара «90», и три нуля. Прежняя версия
              называла только тот узор, что задал статус. */}
          {result.features.length > 1 && (
            <>
              <h2>{tr("featuresTitle")}</h2>
              <ul className="feature-list">
                {result.features.map((f, i) => (
                  <li
                    key={i}
                    className={
                      "feature" +
                      (f.main ? " feature-main" : "") +
                      (f.affects === "info" ? " feature-info" : "")
                    }
                  >
                    <span>{f.text}</span>
                    {f.affects === "info" && (
                      <em>{engineMessage("extra.affects.info", locale)}</em>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

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
                <b>{formatAmount(result.priceMin)}</b>
              </span>
              <span className="range-rec">
                <em>{tr("rangeRec")}</em>
                <b>{formatPrice(result.priceTypical)}</b>
              </span>
              <span className="range-high">
                <em>{tr("rangeHigh")}</em>
                <b>{formatAmount(result.priceMax)}</b>
              </span>
            </div>
            <p className="breakdown-hint">{tr("priceHint")}</p>
          </div>

          {/* Схема версии 5.0: сбор оператора сидит ВНУТРИ рыночной цены,
              а не прибавляется к ней. Иначе два одинаковых по узору номера
              стоили бы покупателю разных денег — только из-за симки. */}
          <table className="money-table">
            <tbody>
              <tr className="money-total">
                <td>{engineMessage("price.marketLabel", locale)}</td>
                <td className="col-right mono">
                  {formatAmount(result.priceMin)} – {formatPrice(result.priceMax)}
                </td>
              </tr>
              <tr>
                <td>
                  {engineMessage("price.feeLabel", locale)}
                  <span className="money-note">{result.feeNote}</span>
                </td>
                <td className="col-right mono">− {formatAmount(result.transferFee)}</td>
              </tr>
              <tr>
                <td>{engineMessage("price.sellerLabel", locale)}</td>
                <td className="col-right mono">
                  {formatAmount(result.sellerGetsMin)} –{" "}
                  {formatPrice(result.sellerGetsMax)}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="breakdown-hint">
            {engineMessage("price.rangeExplained", locale)}
          </p>

          {result.operatorPrice > 0 && (
            <p className="breakdown-hint">
              {fillMessage(engineMessage("price.operatorRef", locale), {
                operator: OPERATOR_NAME[result.operator] ?? result.operator,
                amount: formatPrice(result.operatorPrice),
              })}
            </p>
          )}

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

          <p className="notice" style={{ marginTop: 16, marginBottom: 0 }}>
            {tr("disclaimer")}
          </p>
        </div>
      )}
    </div>
  );
}
