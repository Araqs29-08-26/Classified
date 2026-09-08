"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { supabase } from "@/lib/supabase";

/**
 * Вход по ссылке из письма — без пароля.
 *
 * Кодом из письма было бы привычнее (так же, как SMS при размещении), но
 * шаблон письма в Supabase нельзя править без собственного почтового сервера,
 * а в стандартном шаблоне приходит именно ссылка. Поэтому вход сделан по
 * ссылке: она не требует никаких настроек и работает сразу.
 */
export default function LoginClient() {
  const t = useTranslations("auth");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Ссылка ведёт на страницу разбора, а та уже уводит в кабинет. Раньше
        // письмо вело прямо в кабинет, и при неудаче он молча отправлял на
        // вход — со стороны это выглядело как «ссылка не работает».
        emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    });

    setLoading(false);
    if (err) {
      setError(`${t("errors.send")} ${err.message}`);
      return;
    }
    setSent(true);
  }

  return (
    <div style={{ padding: "32px 0", maxWidth: 460 }}>
      <h1 style={{ marginBottom: 8 }}>{t("title")}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20 }}>{t("subtitle")}</p>

      {error && <div className="notice">{error}</div>}

      {sent ? (
        <div className="card">
          <h2 style={{ margin: 0, fontSize: 18 }}>{t("linkSentTitle")}</h2>
          <p style={{ margin: 0, fontSize: 14 }}>{t("linkSentTo", { email })}</p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}>
            {t("linkSentSpam")}
          </p>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setSent(false)}
          >
            {t("sendAgain")}
          </button>
        </div>
      ) : (
        <form className="card" onSubmit={sendLink}>
          <div className="field">
            <label>{t("emailLabel")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              required
            />
          </div>
          <button className="btn btn-accent" type="submit" disabled={loading}>
            {loading ? t("sending") : t("sendLink")}
          </button>
        </form>
      )}
    </div>
  );
}
