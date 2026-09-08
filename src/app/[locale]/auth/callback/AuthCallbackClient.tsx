"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Возврат по ссылке из письма.
 *
 * Раньше письмо вело сразу в кабинет, и когда подтверждение не срабатывало,
 * кабинет молча отправлял человека на вход — выглядело так, будто ссылка
 * не работает. Здесь разбор происходит явно: получилось — идём в кабинет,
 * не получилось — показываем причину, которую вернул сам Supabase.
 */
export default function AuthCallbackClient() {
  const t = useTranslations("auth.callback");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Причину неудачи Supabase кладёт и в hash, и в строку запроса —
    // смотрим оба места, чтобы не потерять её.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const described =
      hash.get("error_description") ?? query.get("error_description");
    if (described) {
      setError(described);
      return;
    }

    let alive = true;

    // Сессию из ссылки клиент разбирает сам; нам остаётся дождаться результата.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && alive) router.replace("/account");
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) router.replace("/account");
      else setError(t("noSession"));
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router, t]);

  return (
    <div style={{ padding: "48px 0", maxWidth: 460 }}>
      {error ? (
        <>
          <h1 style={{ marginBottom: 8 }}>{t("failedTitle")}</h1>
          <p style={{ color: "var(--muted)", marginBottom: 8 }}>{t("failedText")}</p>
          <p className="notice">{error}</p>
          <p style={{ marginTop: 16 }}>
            <Link href="/login" className="btn btn-accent">
              {t("tryAgain")}
            </Link>
          </p>
        </>
      ) : (
        <p style={{ color: "var(--muted)" }}>{t("checking")}</p>
      )}
    </div>
  );
}
