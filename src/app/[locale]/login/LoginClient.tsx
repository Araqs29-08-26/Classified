"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { supabase } from "@/lib/supabase";
import { rememberContact } from "@/lib/profile";

/**
 * Вход и регистрация — одно и то же действие.
 *
 * Пароля нет вовсе: его нельзя ни забыть, ни украсть. На телефон приходит
 * код, на почту — ссылка. Почта предпочтительнее для нас (по ней проще
 * связаться), но ограничивать ею нельзя: у части продавцов почты просто нет.
 *
 * Сессия хранится в браузере и продлевается сама, поэтому на своём устройстве
 * человек входит один раз.
 */
type Way = "email" | "phone";
type Stage = "form" | "sent" | "code";

export default function LoginClient() {
  const t = useTranslations("auth");
  const locale = useLocale();

  const [way, setWay] = useState<Way>("email");
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+374");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (way === "email" && !email.trim()) return setError(t("errors.needEmail"));
    if (way === "phone" && phone.replace(/\D/g, "").length < 8) {
      return setError(t("errors.needPhone"));
    }

    setLoading(true);

    const { error: err } =
      way === "email"
        ? await supabase.auth.signInWithOtp({
            email,
            options: {
              // Ссылка ведёт на страницу разбора, а та уже уводит в кабинет.
              emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
            },
          })
        : await supabase.auth.signInWithOtp({ phone });

    setLoading(false);
    if (err) {
      setError(`${t("errors.send")} ${err.message}`);
      return;
    }
    setStage(way === "email" ? "sent" : "code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });

    if (err) {
      setLoading(false);
      setError(`${t("errors.wrongCode")} ${err.message}`);
      return;
    }

    // Контакт и согласие записываются сразу после входа: иначе человек,
    // зашедший просто посмотреть, в базе контактов не окажется.
    await rememberContact(consent);
    window.location.href = `/${locale}/account`;
  }

  return (
    <div style={{ padding: "32px 0", maxWidth: 460 }}>
      <h1 style={{ marginBottom: 8 }}>{t("title")}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20 }}>{t("subtitle")}</p>

      {error && <div className="notice">{error}</div>}

      {stage === "sent" && (
        <div className="card">
          <h2 style={{ margin: 0, fontSize: 18 }}>{t("linkSentTitle")}</h2>
          <p style={{ margin: 0, fontSize: 14 }}>{t("linkSentTo", { email })}</p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}>
            {t("linkSentSpam")}
          </p>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setStage("form")}
          >
            {t("sendAgain")}
          </button>
        </div>
      )}

      {stage === "code" && (
        <form className="card" onSubmit={verify}>
          <div className="field">
            <label>{t("codeLabel")}</label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("codePlaceholder")}
              required
            />
          </div>
          <button className="btn btn-accent" type="submit" disabled={loading}>
            {loading ? t("checking") : t("check")}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setStage("form")}
          >
            {t("changePhone")}
          </button>
        </form>
      )}

      {stage === "form" && (
        <form className="card" onSubmit={send}>
          <div className="way-tabs">
            {(["email", "phone"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={"way-tab" + (way === option ? " active" : "")}
                aria-pressed={way === option}
                onClick={() => setWay(option)}
              >
                {option === "email" ? t("tabEmail") : t("tabPhone")}
              </button>
            ))}
          </div>

          {way === "email" ? (
            <div className="field">
              <label>{t("emailLabel")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
              />
            </div>
          ) : (
            <div className="field">
              <label>{t("phoneLabel")}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phonePlaceholder")}
                autoComplete="tel"
              />
              <p className="field-hint">{t("phoneHint")}</p>
            </div>
          )}

          <label className="consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              {t("consent")}
              <span className="consent-note">{t("consentNote")}</span>
            </span>
          </label>

          <button className="btn btn-accent" type="submit" disabled={loading}>
            {loading ? t("sending") : way === "email" ? t("sendLink") : t("sendCode")}
          </button>

          <p className="field-hint">{t("remembered")}</p>
        </form>
      )}
    </div>
  );
}
