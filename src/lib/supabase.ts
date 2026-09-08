import { createClient } from "@supabase/supabase-js";

// Публичные значения проекта Supabase «Araqs» (регион eu-central-1, Франкфурт).
// anon-ключ публичный по своей природе: доступ к данным ограничивают политики RLS.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://icyjcwuqdjkqxgylmqjl.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeWpjd3VxZGprcXhneWxtcWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTMwMDgsImV4cCI6MjEwMzU2OTAwOH0.lXC1yT9bilZ5ecN1hDSafXxysbEN3l-73zqJfLhTXy4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Tier = {
  name: string;
  price: number;
  /** Разовый сбор платформы за размещение. Не путать со сбором ОПЕРАТОРА за переоформление — тот считает движок. */
  platformFee: number;
};

/** 8 статусов по шкале Viva, от дорогого к дешёвому. Порядок значим: TIERS[0] задаёт максимум слайдера цены. */
export const TIERS: Tier[] = [
  { name: "Премиум", price: 1100000, platformFee: 25000 },
  { name: "Элит", price: 650000, platformFee: 15000 },
  { name: "Бриллиантовый", price: 450000, platformFee: 10000 },
  { name: "Платиновый", price: 200000, platformFee: 5000 },
  { name: "Золотой", price: 65000, platformFee: 0 },
  { name: "Серебряный", price: 25000, platformFee: 0 },
  { name: "Бронзовый", price: 9000, platformFee: 0 },
  { name: "Обычный", price: 0, platformFee: 0 },
];

/**
 * «Другие» — для мелких провайдеров помимо трёх крупных: OVIO на городском
 * коде 15 и прочих, особенно на коротких номерах. Логотипа у них нет,
 * поэтому в оформлении используется монограмма.
 */
export const OPERATORS = ["Viva", "Ucom", "Team Telecom", "Другие"];

export const OPERATOR_META: Record<
  string,
  { abbr: string; color: string; logo?: string }
> = {
  Viva: { abbr: "V", color: "#c9532e", logo: "/operators/viva.png" },
  Ucom: { abbr: "U", color: "#2e6b78", logo: "/operators/ucom.png" },
  "Team Telecom": { abbr: "TT", color: "#7a3dad", logo: "/operators/team.png" },
  "Другие": { abbr: "?", color: "#5c6773" },
};

export const NUMBER_TYPES = ["Мобильный", "Городской", "Короткий"];

export const TIER_EMOJI: Record<string, string> = {
  Премиум: "👑",
  Элит: "✨",
  Бриллиантовый: "💎",
  Платиновый: "🔷",
  Золотой: "🥇",
  Серебряный: "🥈",
  Бронзовый: "🥉",
  Обычный: "⚪",
};

/** Только число, без знака валюты — для диапазонов вида «50 000 – 190 000 ֏». */
export function formatAmount(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

/** Локаль форматирования зашита ru-RU намеренно — так же, как на исходном сайте. */
export function formatPrice(value: number): string {
  return value === 0
    ? "Бесплатно"
    : new Intl.NumberFormat("ru-RU").format(value) + " ֏";
}

export type Listing = {
  id: string;
  seller_id: string;
  phone_number: string;
  operator: string;
  region: string | null;
  price: number;
  status_tier: string;
  description: string | null;
  sms_verified: boolean;
  listing_status: string;
  created_at: string;
  updated_at: string;
  number_type: string;
  /* --- оценка движка на момент публикации (Задача 9г) --- */
  months_held: number | null;
  beauty_index: number | null;
  pattern_code: string | null;
  pattern_params: Record<string, string | number> | null;
  engine_version: string | null;
  evaluated_at: string | null;
};

export type Profile = {
  id: string;
  display_name: string | null;
  phone: string | null;
  created_at: string;
};
