"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { detect } from "@/lib/phone";
import {
  engineMessage,
  evaluateNumber,
  fillMessage,
  OPERATOR_CODE,
  OPERATOR_NAME,
  recommendedPrice,
  type EngineResult,
} from "@/lib/numberEngine";
import { formatPrice, formatAmount, OPERATOR_META } from "@/lib/supabase";
import PatternNumber from "../PatternNumber";
import ShareReview from "./ShareReview";

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

  // Номер и настройки берутся из адреса: иначе смена языка сбрасывала бы
  // оценку, а переслать разбор другу было бы нечем.
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("number") ?? "";
  const opFromUrl = searchParams.get("operator") ?? "";
  const heldFromUrl = searchParams.get("held") ?? "";

  const [phone, setPhone] = useState(fromUrl || "+374");
  /** Номер, который вправду оценивали. Отличается от набранного до нажатия. */
  const [asked, setAsked] = useState(fromUrl);
  const [operator, setOperator] = useState(
    opFromUrl || (fromUrl ? detect(fromUrl).operator ?? "" : "")
  );
  const [held, setHeld] = useState<"yes" | "no" | "">(
    heldFromUrl === "yes" || heldFromUrl === "no" ? heldFromUrl : ""
  );

  const detected = useMemo(() => (asked ? detect(asked) : null), [asked]);

  const isViva = operator === "Viva";
  // Срок владения спрашивается только у Viva: у Ucom и Team он на сбор не влияет.
  const heldOverLimit = isViva && held !== "" ? held === "yes" : null;

  // Оценка пересчитывается сама, когда меняют оператора или срок владения:
  // от них зависит сбор, а значит и то, сколько останется продавцу.
  const result: EngineResult | null = useMemo(
    () =>
      asked
        ? evaluateNumber(asked, {
            operator: OPERATOR_CODE[operator] ?? null,
            heldOverLimit,
            locale,
          })
        : null,
    [asked, operator, heldOverLimit, locale]
  );

  // Настройки живут в адресе страницы — вместе с номером. Ссылку можно
  // переслать, и у друга откроется тот же разбор, а не «примерно такой же».
  function remember(next: { number: string; operator: string; held: string }) {
    const q = new URLSearchParams();
    q.set("number", next.number);
    if (next.operator) q.set("operator", next.operator);
    if (next.held) q.set("held", next.held);
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Оператор подставляется по коду номера — как подсказка, не как приговор.
    const guess = detect(phone).operator ?? "";
    setAsked(phone);
    setOperator(guess);
    setHeld("");
    remember({ number: phone, operator: guess, held: "" });
  }

  function chooseOperator(next: string) {
    setOperator(next);
    remember({ number: asked, operator: next, held: next === "Viva" ? held : "" });
  }

  function chooseHeld(next: "yes" | "no" | "") {
    setHeld(next);
    remember({ number: asked, operator, held: next });
  }

  // Причину отказа объясняет сам движок: он лучше знает, что именно не так —
  // непонятная запись, буква внутри номера или несколько номеров в строке.
  const error = result && !result.ok ? result.error : null;

  // Рекомендация с поправкой на сбор: советовать цену ниже сбора нельзя.
  const advice = result && result.ok ? recommendedPrice(result) : null;

  const ctaHref =
    result && result.ok
      ? `/new?number=${encodeURIComponent(asked)}&tier=${encodeURIComponent(
          result.status
        )}&price=${advice?.typical ?? 0}&type=${encodeURIComponent(
          detected?.numberType ?? "Мобильный"
        )}${operator ? `&operator=${encodeURIComponent(operator)}` : ""}`
      : "/new";

  // Где стоит отметка «рекомендуем» внутри полосы диапазона.
  const markPercent =
    advice && advice.max > advice.min
      ? ((advice.typical - advice.min) / (advice.max - advice.min)) * 100
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

          <h2>{t("operatorLabel")}</h2>
          <p className="breakdown-hint">{t("operatorHint")}</p>
          <div className="operator-toggle-row">
            {["Viva", "Ucom", "Team Telecom"].map((op) => {
              const active = operator === op;
              const meta = OPERATOR_META[op];
              return (
                <button
                  key={op}
                  type="button"
                  className={"operator-toggle" + (active ? " active" : "")}
                  aria-pressed={active}
                  onClick={() => chooseOperator(op)}
                >
                  <span className="operator-badge" title={op}>
                    {meta?.logo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={meta.logo} alt="" />
                    ) : (
                      op.slice(0, 1)
                    )}
                  </span>
                  <span className="operator-toggle-name">{op}</span>
                </button>
              );
            })}
          </div>

          {/* Только у Viva: там сбор либо 500 ֏, либо ещё и полная стоимость
              категории — у премиум-номера разница в две тысячи раз. */}
          {isViva && (
            <>
              <h2>{t("heldLabel")}</h2>
              <p className="breakdown-hint">{t("heldHint")}</p>
              <div className="presets">
                {([
                  ["yes", "heldYes"],
                  ["no", "heldNo"],
                  ["", "heldUnknown"],
                ] as const).map(([value, key]) => (
                  <button
                    key={key}
                    type="button"
                    className={"chip" + (held === value ? " active" : "")}
                    aria-pressed={held === value}
                    onClick={() => chooseHeld(value)}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </>
          )}

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

          {/* Нулевая цена — это не «бесплатно», а «движок не берётся считать».
              Показывать полосу диапазона от нуля до нуля незачем. */}
          {advice!.max === 0 ? (
            <p className="notice">{tr("noPrice")}</p>
          ) : (
          <div className="range">
            <div className="range-bar">
              <span className="range-mark" style={{ left: `${markPercent}%` }} />
            </div>
            <div className="range-ends">
              <span>
                <em>{tr("rangeLow")}</em>
                <b>{formatAmount(advice!.min)}</b>
              </span>
              <span className="range-rec">
                <em>{tr("rangeRec")}</em>
                <b>{formatPrice(advice!.typical)}</b>
              </span>
              <span className="range-high">
                <em>{tr("rangeHigh")}</em>
                <b>{formatAmount(advice!.max)}</b>
              </span>
            </div>
            <p className="breakdown-hint">{tr("priceHint")}</p>
            {advice!.raisedByFee && (
              <p className="breakdown-hint">{tr("feeFloorNote")}</p>
            )}
          </div>
          )}

          {/* Схема версии 5.0: сбор оператора сидит ВНУТРИ рыночной цены,
              а не прибавляется к ней. Иначе два одинаковых по узору номера
              стоили бы покупателю разных денег — только из-за симки. */}
          {advice!.max > 0 && (
          <table className="money-table">
            <tbody>
              <tr className="money-total">
                <td>{engineMessage("price.marketLabel", locale)}</td>
                <td className="col-right mono">
                  {formatAmount(advice!.min)} – {formatPrice(advice!.max)}
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
                  {formatAmount(advice!.sellerMin)} –{" "}
                  {formatPrice(advice!.sellerMax)}
                </td>
              </tr>
            </tbody>
          </table>
          )}

          {advice!.max > 0 && (
            <p className="breakdown-hint">
              {engineMessage("price.rangeExplained", locale)}
            </p>
          )}

          {result.operatorPrice > 0 && (
            <p className="breakdown-hint">
              {fillMessage(engineMessage("price.operatorRef", locale), {
                operator: OPERATOR_NAME[result.operator] ?? result.operator,
                amount: formatPrice(result.operatorPrice),
              })}
            </p>
          )}

          <div className="breakdown-actions">
            <Link href={ctaHref} className="btn btn-accent">
              {tr("cta")}
            </Link>
            {/* Разбор чужого номера часто смотрят, чтобы показать владельцу:
                ссылка воспроизводит его целиком, считать заново не нужно. */}
            <ShareReview
              number={asked}
              status={tTiers(result.status)}
              index={result.index}
              priceFrom={formatAmount(advice!.min)}
              priceTo={formatPrice(advice!.max)}
              hasPrice={advice!.max > 0}
            />
          </div>

          <p className="notice" style={{ marginTop: 16, marginBottom: 0 }}>
            {tr("disclaimer")}
          </p>
        </div>
      )}
    </div>
  );
}
