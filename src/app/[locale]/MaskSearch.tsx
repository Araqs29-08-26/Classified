"use client";

import { useTranslations } from "next-intl";

import type { MaskPosition } from "@/lib/numberSearch";

/**
 * Строка поиска по маске номера.
 *
 * Ячейки по одной цифре умели только «эта цифра на этом месте», а модуль
 * поиска умеет заметно больше: звёздочка вместо одной любой цифры, «5x5»
 * вместо «пятёрка пять раз» и выбор места, где искать. Обычная строка отдаёт
 * эти возможности человеку целиком, а разбирает написанное сам модуль.
 *
 * Звёздочка — ровно ОДНА цифра, а не «сколько угодно». Так устроен поиск
 * автомобильных номеров на roadpolice.am, который в Армении знают все:
 * заводить свои знаки там, где у людей уже есть привычные, значит учить их
 * заново.
 */
export const WHERE_OPTIONS: { id: MaskPosition; key: string }[] = [
  { id: "any", key: "whereAny" },
  { id: "start", key: "whereStart" },
  { id: "middle", key: "whereMiddle" },
  { id: "end", key: "whereEnd" },
];

export default function MaskSearch({
  mask,
  where,
  onMaskChange,
  onWhereChange,
  onSubmit,
  status,
}: {
  mask: string;
  where: MaskPosition;
  onMaskChange: (next: string) => void;
  onWhereChange: (next: MaskPosition) => void;
  /** Выдача обновляется на лету, поэтому кнопка просто ведёт к списку. */
  onSubmit: () => void;
  /** Расшифровка запроса словами либо ошибка разбора — приходит от модуля. */
  status: { text: string; error: boolean } | null;
}) {
  const t = useTranslations("home");
  const tf = useTranslations("home.filters");

  return (
    <div className="mask-search">
      <form
        className="mask-search-row"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="mask-search-field">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="mask-search-input mono"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={mask}
            aria-label={tf("maskLabel")}
            placeholder={tf("maskPlaceholder")}
            onChange={(e) => onMaskChange(e.target.value)}
          />
          {mask && (
            <button
              type="button"
              className="mask-search-clear"
              onClick={() => onMaskChange("")}
            >
              {tf("maskClear")}
            </button>
          )}
        </div>
        <button className="btn btn-accent mask-search-submit" type="submit">
          {t("find")}
        </button>
      </form>

      <div className="mask-search-legend">
        <span className="mono">
          <b>*</b> {t("legendAny")} <span aria-hidden="true">·</span> <b>5x5</b>{" "}
          {t("legendTimes")}
        </span>
        <span className="mask-search-sep" aria-hidden="true" />
        <div className="where-row" role="group" aria-label={tf("whereLabel")}>
          {WHERE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={"where-button" + (where === option.id ? " active" : "")}
              aria-pressed={where === option.id}
              onClick={() => onWhereChange(option.id)}
            >
              {tf(option.key)}
            </button>
          ))}
        </div>
      </div>

      {status && (
        <p className={"mask-search-status" + (status.error ? " error" : "")}>
          {status.text}
        </p>
      )}
    </div>
  );
}
