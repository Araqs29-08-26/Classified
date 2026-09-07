"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_LABELS: Record<string, string> = {
  ru: "RU",
  hy: "ՀԱՅ",
  en: "EN",
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <select
      aria-label="Язык / Լեզու / Language"
      value={locale}
      onChange={(e) => router.replace(pathname, { locale: e.target.value as any })}
      style={{
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 600,
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid var(--line)",
        background: "var(--surface)",
        color: "var(--ink)",
        cursor: "pointer",
      }}
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l] ?? l}
        </option>
      ))}
    </select>
  );
}
