"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

/**
 * Полоска подразделов «Правил».
 *
 * Четыре темы — размещение, переоформление, продвижение и условия — раньше
 * лежали в разных концах сайта: часть в главном меню, часть в подвале. Теперь
 * это один раздел, и переходить между ними можно не возвращаясь назад.
 */
const SECTIONS = [
  { href: "/rules", key: "posting" },
  { href: "/rules/transfer", key: "transfer" },
  { href: "/rules/promo", key: "promo" },
  { href: "/rules/terms", key: "terms" },
] as const;

export default function RulesNav() {
  const t = useTranslations("rulesNav");
  const pathname = usePathname();

  return (
    <nav className="rules-nav" aria-label={t("sectionLabel")}>
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className={"rules-nav-item" + (pathname === s.href ? " active" : "")}
          aria-current={pathname === s.href ? "page" : undefined}
        >
          {t(s.key)}
        </Link>
      ))}
    </nav>
  );
}
