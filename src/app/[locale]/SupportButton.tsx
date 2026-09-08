"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * Поддержка — кружок с вопросительным знаком в углу экрана.
 *
 * В меню она занимала место наравне с разделами, которыми пользуются постоянно,
 * хотя нужна редко. В углу она всегда под рукой и не спорит за внимание
 * с «Купить», «Продать» и «Правилами».
 */
export default function SupportButton() {
  const t = useTranslations("nav");

  return (
    <Link href="/support" className="support-fab" title={t("support")}>
      <span aria-hidden="true">?</span>
      <span className="visually-hidden">{t("support")}</span>
    </Link>
  );
}
