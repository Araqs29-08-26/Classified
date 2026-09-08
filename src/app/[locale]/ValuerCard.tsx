"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

/**
 * Чёрная карточка оценки в правом крыле шапки.
 *
 * Продавец приходит на доску объявлений с вопросом «сколько стоит мой номер»,
 * и раньше ему приходилось искать этот вход в меню. Здесь он сразу вводит
 * номер и попадает на готовый разбор.
 */
export default function ValuerCard() {
  const t = useTranslations("home");
  const router = useRouter();
  const [phone, setPhone] = useState("");

  return (
    <form
      className="valuer"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/sell?number=${encodeURIComponent(phone || "+374")}`);
      }}
    >
      <span className="valuer-glow" aria-hidden="true" />
      <div className="valuer-body">
        <span className="valuer-eyebrow">{t("valuerEyebrow")}</span>
        <h2>{t("valuerTitle")}</h2>
        <p>{t("valuerText")}</p>
        <input
          className="valuer-input mono"
          type="tel"
          value={phone}
          aria-label={t("valuerTitle")}
          placeholder={t("valuerPlaceholder")}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button className="btn btn-amber valuer-button" type="submit">
          {t("valuerButton")}
        </button>
      </div>
    </form>
  );
}
