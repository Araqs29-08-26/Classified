"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useSession } from "@/lib/useSession";

/**
 * Ссылка в шапке: «Войти» или «Мой кабинет».
 *
 * Пока сессия читается, не показываем ничего — иначе вошедший видел бы
 * мелькающее «Войти» при каждой загрузке страницы.
 */
export default function AccountLink() {
  const t = useTranslations("nav");
  const { user, loading } = useSession();

  if (loading) return null;

  return (
    <Link href={user ? "/account" : "/login"} className="nav-link">
      {user ? t("account") : t("login")}
    </Link>
  );
}
