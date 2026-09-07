"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="empty-state">
      <h2>{t("title")}</h2>
      <p>{t("subtitle")}</p>
      <p style={{ marginTop: 16 }}>
        <Link href="/" className="btn btn-accent">
          {t("cta")}
        </Link>
      </p>
    </div>
  );
}
