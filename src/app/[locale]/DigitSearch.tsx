"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";

/**
 * Поиск по цифрам номера: восемь ячеек — все значащие цифры армянского
 * мобильного номера, включая код оператора. Пустая ячейка означает
 * «любая цифра на этом месте».
 *
 * Маска хранится строкой из восьми символов, где пустая позиция — «_».
 */
export const MASK_LENGTH = 8;
export const EMPTY_MASK = "_".repeat(MASK_LENGTH);

/** Совпадает ли номер с маской. Сравниваются все восемь значащих цифр. */
export function matchesDigits(phoneNumber: string, mask: string): boolean {
  const digits = phoneNumber.replace(/\D/g, "").replace(/^374/, "").replace(/^0/, "");
  if (digits.length < MASK_LENGTH) return false;

  const window = digits.slice(-MASK_LENGTH);
  for (let i = 0; i < MASK_LENGTH; i++) {
    const ch = mask[i];
    if (ch && ch !== "_" && ch !== window[i]) return false;
  }
  return true;
}

export default function DigitSearch({
  mask,
  onChange,
}: {
  mask: string;
  onChange: (next: string) => void;
}) {
  const t = useTranslations("home");
  const cells = useRef<(HTMLInputElement | null)[]>([]);

  const padded = (mask || EMPTY_MASK).padEnd(MASK_LENGTH, "_").slice(0, MASK_LENGTH);

  function setCell(i: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = padded.split("");
    next[i] = digit || "_";
    onChange(next.join(""));

    // После ввода цифры переходим к следующей ячейке — как в коде из SMS.
    if (digit && i < MASK_LENGTH - 1) cells.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && padded[i] === "_" && i > 0) {
      e.preventDefault();
      cells.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) cells.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < MASK_LENGTH - 1) cells.current[i + 1]?.focus();
  }

  /** Вставка целого номера сразу заполняет ячейки. */
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .replace(/^374/, "")
      .replace(/^0/, "");
    if (!digits) return;
    e.preventDefault();
    onChange(digits.slice(0, MASK_LENGTH).padEnd(MASK_LENGTH, "_"));
  }

  return (
    <div className="digit-search">
      <div className="digit-cells">
        <span className="digit-prefix">+374</span>
        {Array.from({ length: MASK_LENGTH }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              cells.current[i] = el;
            }}
            className={"digit-cell" + (padded[i] !== "_" ? " filled" : "")}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            aria-label={t("cellAria", { position: i + 1 })}
            value={padded[i] === "_" ? "" : padded[i]}
            onChange={(e) => setCell(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
      <p className="digit-hint">{t("cellHint")}</p>
    </div>
  );
}
