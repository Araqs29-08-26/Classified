"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { detect, normalizePhone } from "@/lib/phone";
import {
  evaluateNumber,
  messageKey,
  OPERATOR_CODE,
  type EngineResult,
} from "@/lib/numberEngine";
import {
  NUMBER_TYPES,
  OPERATORS,
  OPERATOR_META,
  formatPrice,
  supabase,
} from "@/lib/supabase";

type Step = "phone" | "code" | "form";

type FormState = {
  phone_number: string;
  operator: string;
  number_type: string;
  region: string;
  price: string;
  /** Срок владения в месяцах. Нужен только для Viva: от него зависит сбор за переоформление. */
  months_held: string;
  description: string;
};

export default function NewListingClient() {
  const t = useTranslations("newListing");
  const tTiers = useTranslations("tiers");
  const tTypes = useTranslations("numberTypes");
  const tEngine = useTranslations("engine");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Параметры проставляет кнопка «Разместить этот номер» со страницы /sell
  const qNumber = searchParams.get("number") ?? "";
  const qTier = searchParams.get("tier");
  const qPrice = searchParams.get("price");
  const qOperator = searchParams.get("operator");
  const qType = searchParams.get("type");

  const guessed = qNumber ? detect(qNumber) : null;

  const [step, setStep] = useState<Step | "done">("phone");
  const [phone, setPhone] = useState("+374");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [operatorTouched, setOperatorTouched] = useState(false);
  const [typeTouched, setTypeTouched] = useState(false);

  const [form, setForm] = useState<FormState>({
    phone_number: qNumber,
    operator:
      (qOperator && OPERATORS.includes(qOperator) ? qOperator : null) ??
      guessed?.operator ??
      OPERATORS[0],
    number_type:
      (qType && NUMBER_TYPES.includes(qType) ? qType : null) ??
      guessed?.numberType ??
      "Мобильный",
    region: "",
    price: qPrice && !Number.isNaN(Number(qPrice)) ? qPrice : "",
    months_held: "",
    description: "",
  });

  const autofilled = Boolean(qNumber && qTier);
  const numberMatchesVerified =
    normalizePhone(form.phone_number) === normalizePhone(phone);

  const isViva = form.operator === "Viva";
  /** Срок владения спрашиваем только у Viva — только там от него зависит сбор. */
  const monthsHeld = isViva && form.months_held !== "" ? Number(form.months_held) : null;

  // Статус, индекс, узор и сбор считает движок — вручную статус не выбирается.
  const verdict: EngineResult | null = useMemo(
    () =>
      form.phone_number.trim()
        ? evaluateNumber(form.phone_number, {
            operator: OPERATOR_CODE[form.operator] ?? null,
            monthsHeld,
          })
        : null,
    [form.phone_number, form.operator, monthsHeld]
  );

  const sellerPrice = Number(form.price) || 0;
  const transferFee = verdict?.ok ? verdict.transferFee : 0;

  // Публикацию блокируем, пока номер не разобран или узор не дотягивает до Бронзового.
  const blocked = !verdict || !verdict.ok || !verdict.publishable;
  const blockReason = !verdict
    ? null
    : !verdict.ok
      ? tEngine(messageKey(verdict.errorCode), verdict.errorParams)
      : !verdict.publishable
        ? t("errors.notPublishable")
        : null;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** Пока пользователь не менял селекты руками, оператор и тип подставляются по коду номера. */
  function onNumberChange(value: string) {
    setForm((prev) => {
      const next = { ...prev, phone_number: value };
      const d = detect(value);
      if (!operatorTouched && d.operator) next.operator = d.operator;
      if (!typeTouched) next.number_type = d.numberType;
      return next;
    });
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithOtp({ phone });

    setLoading(false);
    if (err) {
      setError(`${t("errors.sendCode")} ${err.message}`);
      return;
    }
    setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });

    setLoading(false);
    if (err) {
      setError(`${t("errors.wrongCode")} ${err.message}`);
      return;
    }
    setStep("form");
  }

  async function submitListing(e: React.FormEvent) {
    e.preventDefault();

    // Вторая проверка на всякий случай: кнопка и так заблокирована.
    if (!verdict?.ok || !verdict.publishable) return;

    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setError(t("errors.sessionExpired"));
      setStep("phone");
      return;
    }

    const { error: err } = await supabase.from("listings").insert({
      seller_id: user.id,
      phone_number: form.phone_number,
      operator: form.operator,
      number_type: form.number_type,
      region: form.region || null,
      price: Number(form.price) || 0,
      // Статус берём у движка, а не из выбора продавца: иначе обычный номер
      // можно было бы опубликовать под чужим статусом.
      status_tier: verdict.status,
      // Оценку сохраняем целиком и с версией движка: движок будет меняться,
      // а объявление должно помнить, чем и когда его оценили.
      months_held: monthsHeld,
      beauty_index: verdict.index,
      pattern_code: verdict.patternCode,
      pattern_params: verdict.patternParams,
      engine_version: verdict.version,
      evaluated_at: new Date().toISOString(),
      description: form.description || null,
      // отметка «подтверждено» ставится, только если номер объявления совпал
      // с номером, подтверждённым по SMS на первом шаге
      sms_verified: numberMatchesVerified,
    });

    setLoading(false);
    if (err) {
      setError(`${t("errors.saveFailed")} ${err.message}`);
      return;
    }

    setStep("done");
    setTimeout(() => router.push("/"), 1200);
  }

  return (
    <div style={{ padding: "32px 0" }}>
      <h1 style={{ marginBottom: 8 }}>{t("title")}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20 }}>{t("subtitle")}</p>

      {error && <div className="notice">{error}</div>}

      {step === "phone" && (
        <form className="card" onSubmit={sendCode}>
          <div className="field">
            <label>{t("phoneStep.label")}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phoneStep.placeholder")}
              required
            />
          </div>
          <button className="btn btn-accent" type="submit" disabled={loading}>
            {loading ? t("phoneStep.loading") : t("phoneStep.button")}
          </button>
        </form>
      )}

      {step === "code" && (
        <form className="card" onSubmit={verifyCode}>
          <div className="field">
            <label>{t("codeStep.label")}</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("codeStep.placeholder")}
              required
            />
          </div>
          <button className="btn btn-accent" type="submit" disabled={loading}>
            {loading ? t("codeStep.loading") : t("codeStep.button")}
          </button>
        </form>
      )}

      {step === "form" && (
        <form className="card" onSubmit={submitListing}>
          {autofilled && <div className="notice">{t("autofillNotice")}</div>}

          <div className="field">
            <label>{t("formStep.numberLabel")}</label>
            <input
              type="text"
              value={form.phone_number}
              onChange={(e) => onNumberChange(e.target.value)}
              placeholder={t("formStep.numberPlaceholder")}
              required
            />
            {form.phone_number && (
              <p
                style={{
                  fontSize: 12.5,
                  marginTop: 4,
                  color: numberMatchesVerified ? "var(--success)" : "var(--faint)",
                }}
              >
                {numberMatchesVerified
                  ? t("formStep.numberVerifiedHint")
                  : t("formStep.numberNotVerifiedHint")}
              </p>
            )}
          </div>

          <div className="field">
            <label>{t("formStep.operatorLabel")}</label>
            <div className="operator-pick">
              {OPERATORS.map((op) => (
                <label
                  key={op}
                  className={"operator-card" + (form.operator === op ? " active" : "")}
                >
                  <input
                    type="radio"
                    name="operator"
                    value={op}
                    checked={form.operator === op}
                    onChange={() => {
                      setOperatorTouched(true);
                      setField("operator", op);
                    }}
                  />
                  {OPERATOR_META[op]?.logo && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={OPERATOR_META[op].logo} alt="" className="operator-logo" />
                  )}
                  <span>{op}</span>
                </label>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 6 }}>
              {t("formStep.operatorHint")}
            </p>
          </div>

          {isViva && (
            <div className="field">
              <label>{t("formStep.monthsHeldLabel")}</label>
              <input
                type="number"
                min={0}
                max={600}
                value={form.months_held}
                onChange={(e) => setField("months_held", e.target.value)}
                required
              />
              <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 4 }}>
                {t("formStep.monthsHeldHint")}
              </p>
            </div>
          )}

          <div className="field">
            <label>{t("formStep.typeLabel")}</label>
            <select
              value={form.number_type}
              onChange={(e) => {
                setTypeTouched(true);
                setField("number_type", e.target.value);
              }}
            >
              {NUMBER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tTypes(type)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>{t("formStep.tierLabel")}</label>

            {verdict?.ok ? (
              <div className="verdict">
                <div className="verdict-head">
                  <span className={`tier-badge tier-${verdict.status}`}>
                    {tTiers(verdict.status)}
                  </span>
                  <span className="verdict-index">
                    <b>{verdict.index}</b> {t("formStep.indexOutOf")}
                  </span>
                </div>
                <div
                  className={`index-bar tier-bar-${verdict.status}`}
                  role="presentation"
                >
                  <span style={{ width: `${verdict.index}%` }} />
                </div>
                <p className="verdict-pattern">
                  {tEngine(messageKey(verdict.patternCode), verdict.patternParams)}
                </p>
              </div>
            ) : (
              blockReason && <div className="notice">{blockReason}</div>
            )}

            <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 6 }}>
              {t("formStep.tierComputedHint")}
            </p>
          </div>

          <div className="field">
            <label>{t("formStep.regionLabel")}</label>
            <input
              type="text"
              value={form.region}
              onChange={(e) => setField("region", e.target.value)}
              placeholder={t("formStep.regionPlaceholder")}
            />
          </div>

          <div className="field">
            <label>{t("formStep.priceLabel")}</label>
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setField("price", e.target.value)}
              placeholder={t("formStep.pricePlaceholder")}
              required
            />
          </div>

          {verdict?.ok && sellerPrice > 0 && (
            <div className="price-breakdown">
              <div>
                <span>{t("formStep.sellerPriceLabel")}</span>
                <b>{formatPrice(sellerPrice)}</b>
              </div>
              <div>
                <span>{t("formStep.feeLabel")}</span>
                <b>
                  {transferFee > 0
                    ? `+ ${formatPrice(transferFee)}`
                    : formatPrice(transferFee)}
                </b>
              </div>
              <div className="price-total">
                <span>{t("formStep.totalLabel")}</span>
                <b>{formatPrice(sellerPrice + transferFee)}</b>
              </div>
            </div>
          )}

          <div className="field">
            <label>{t("formStep.descriptionLabel")}</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>

          {blockReason && verdict?.ok && <div className="notice">{blockReason}</div>}

          <button
            className="btn btn-accent"
            type="submit"
            disabled={loading || blocked}
          >
            {loading ? t("formStep.loading") : t("formStep.button")}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="empty-state">
          <h2>{t("doneStep.title")}</h2>
          <p>{t("doneStep.subtitle")}</p>
        </div>
      )}
    </div>
  );
}
