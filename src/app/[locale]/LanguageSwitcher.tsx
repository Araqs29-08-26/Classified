"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

// Порядок и подписи заданы здесь, а не берутся из routing.locales: на переключателе
// армянский стоит первым, и подписи не совпадают с кодами языков.
const LOCALES: { code: string; label: string }[] = [
  { code: "hy", label: "Հայ" },
  { code: "ru", label: "Ру" },
  { code: "en", label: "Eng" },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // usePathname() из next-intl отдаёт путь без строки параметров. Без этой склейки
  // смена языка сбрасывала бы всё, что стоит после «?».
  const query = searchParams.toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <div
      className="lang-switch"
      role="group"
      aria-label="Язык / Լեզու / Language"
    >
      {LOCALES.map(({ code, label }) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            className={"lang-btn" + (active ? " active" : "")}
            aria-pressed={active}
            onClick={() => router.replace(href, { locale: code as any })}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
