"use client";

import { useTranslations } from "next-intl";

import type { MaskPosition } from "@/lib/numberSearch";

/**
 * Строка поиска по маске номера.
 *
 * Раньше здесь были восемь ячеек — по одной на цифру. Ячейки умеют только
 * «эта цифра на этом месте», а модуль поиска умеет заметно больше: «?» вместо
 * одной любой цифры, «*» вместо любого их количества и выбор места, где искать.
 * Обычная строка отдаёт эти возможности человеку целиком.
 *
 * Разбирает написанное сам модуль (parseQuery) — здесь только ввод.
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
  status,
}: {
  mask: string;
  where: MaskPosition;
  onMaskChange: (next: string) => void;
  onWhereChange: (next: MaskPosition) => void;
  /** Расшифровка запроса словами либо ошибка разбора — приходит от модуля. */
  status: { text: string; error: boolean } | null;
}) {
  const t = useTranslations("home.filters");

  return (
    <div className="mask-search">
      <label className="mask-search-label" htmlFor="mask-search-input">
        {t("maskLabel")}
      </label>

      <div className="mask-search-row">
        <input
          id="mask-search-input"
          className="mask-search-input mono"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={mask}
          placeholder={t("maskPlaceholder")}
          onChange={(e) => onMaskChange(e.target.value)}
        />
        {mask && (
          <button
            type="button"
            className="mask-search-clear"
            onClick={() => onMaskChange("")}
          >
            {t("maskClear")}
          </button>
        )}
      </div>

      <p className="mask-search-hint">{t("maskHint")}</p>

      <div className="where-row" role="group" aria-label={t("whereLabel")}>
        {WHERE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={"where-button" + (where === option.id ? " active" : "")}
            aria-pressed={where === option.id}
            onClick={() => onWhereChange(option.id)}
          >
            {t(option.key)}
          </button>
        ))}
      </div>

      {status && (
        <p className={"mask-search-status" + (status.error ? " error" : "")}>
          {status.text}
        </p>
      )}
    </div>
  );
}
