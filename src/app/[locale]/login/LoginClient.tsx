"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Вход по почте кодом из письма — без пароля.
 *
 * Тот же ход, что и при размещении объявления по SMS: человек вводит адрес,
 * получает шестизначный код и подтверждает им вход. Пароль не заводится вовсе,
 * поэтому его нельзя ни забыть, ни украсть.
 */
type Step = "email" | "code";

export default function LoginClient() {
  const t = useTranslations("auth");
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithOtp({ email });

    setLoading(false);
    if (err) {
      setError(`${t("errors.send")} ${err.message}`);
      return;
    }
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    setLoading(false);
    if (err) {
      setError(`${t("errors.wrongCode")} ${err.message}`);
      return;
    }
    router.push("/account");
  }

  return (
    <div style={{ padding: "32px 0", maxWidth: 460 }}>
      <h1 style={{ marginBottom: 8 }}>{t("title")}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20 }}>{t("subtitle")}</p>

      {error && <div className="notice">{error}</div>}

      {step === "email" && (
        <form className="card" onSubmit={sendCode}>
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
            {loading ? t("sending") : t("sendCode")}
          </button>
        </form>
      )}

      {step === "code" && (
        <form className="card" onSubmit={verify}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
            {t("codeSentTo", { email })}
          </p>
          <div className="field">
            <label>{t("codeLabel")}</label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("codePlaceholder")}
              autoComplete="one-time-code"
              required
            />
          </div>
          <button className="btn btn-accent" type="submit" disabled={loading}>
            {loading ? t("checking") : t("confirm")}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            {t("changeEmail")}
          </button>
        </form>
      )}
    </div>
  );
}
