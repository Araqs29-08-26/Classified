/**
 * Типы для araqs-number-engine.js
 *
 * Файл движка написан на обычном JavaScript намеренно: он одинаково работает
 * в браузере, в Node и на сервере, и его не нужно собирать. Эти типы дают
 * TypeScript-проекту полную подсказку и проверку без переписывания движка.
 *
 * Подключение:
 *     import * as AraqsEngine from "@/lib/araqs/araqs-number-engine";
 *     const v = AraqsEngine.evaluate("091 11 11 01", { operator: "viva" });
 */

/** Машинный код статуса. На экран выводится через словарь: "status." + код. */
export type StatusCode =
  | "plain" | "bronze" | "silver" | "gold"
  | "platinum" | "diamond" | "elite" | "premium";

/** Подуровень Премиума. Для остальных статусов — null. */
export type Sublevel = "P1" | "P2" | "P3" | null;

export type Operator = "viva" | "team" | "ucom";

/** Крупная группа узора. На экран — через словарь: "family." + код. */
export type PatternFamily =
  | "run" | "seq" | "block" | "pal"
  | "pairs" | "zeros" | "rhythm" | "distinct" | "none";

/** Пояснение к оценке: код текста плюс подстановки. */
export interface NoteCode {
  code: string;
  params: Record<string, string | number>;
}

export interface EvaluateOptions {
  /** Оператор от продавца. Не задан — берётся подсказка по коду номера. */
  operator?: Operator | "auto" | null;
  /**
   * Владеет ли продавец номером дольше льготного срока (два года у Viva).
   * true / false / null («не знаю»). Точный срок спрашивать не нужно.
   */
  heldOverLimit?: boolean | null;
  /** Устаревшее: точное число месяцев. Сводится к heldOverLimit. */
  monthsHeld?: number | null;
  entity?: "individual" | "legal";
  /** Словарь текстов. Без него вердикт содержит только коды. */
  messages?: Record<string, string> | null;
}

export interface Verdict {
  ok: boolean;
  version: string;
  raw: string;

  /** Окно анализа: код оператора (2 цифры) + тело номера (6 цифр). */
  window: string;
  code: string;
  body: string;

  status: string;              // русское название, для совместимости
  statusCode: StatusCode;
  statusName: string;          // перевод, если передан словарь
  sublevel: Sublevel;
  index: number;               // индекс красоты 0-100
  indexRange: string;

  patternCode: string;         // "block.pair.x2"
  patternFamily: PatternFamily;
  patternParams: Record<string, string | number>;
  pattern: string;             // текст, если передан словарь
  /** Какие позиции окна подсветить. -1, если узора нет. */
  patternFrom: number;
  patternTo: number;

  operator: Operator;
  operatorFromCode: boolean;   // true — оператор угадан по коду, а не задан
  heldOverLimit: boolean | null;
  monthsHeld: number | null;
  entity: "individual" | "legal";

  /** Сколько раз встречается каждая цифра окна: { "4": 5, "1": 2 }. */
  digitCounts: Record<string, number>;
  dominantDigit: string | null;
  dominantCount: number;
  distinct: number;            // сколько разных цифр в теле номера

  /** Диапазон цены продавца: прайс оператора — рекомендация — рынок. */
  sellerMin: number;
  sellerTypical: number;
  sellerMax: number;

  transferFee: number;
  feeCode: string;
  feeParams: Record<string, string | number>;
  feeNote: string;             // текст, если передан словарь

  totalMin: number;
  totalTypical: number;
  totalMax: number;

  /** false — статус «Обычный», объявление не публикуется. */
  publishable: boolean;

  noteCodes: NoteCode[];
  notes: string[];             // тексты, если передан словарь

  errorCode: string | null;
  errorParams: Record<string, string | number>;
  error: string;
}

export declare const VERSION: string;
export declare const STATUS_ORDER: string[];
export declare const STATUS_CODE: Record<string, StatusCode>;
export declare const OPERATOR_NAME: Record<Operator, string>;
export declare const OPERATOR_PRICES: Record<Operator, Record<string, number>>;
export declare const CODE_OPERATOR_HINT: Record<string, Operator>;
export declare const MARKET_P75: Record<string, number>;
export declare const MARKET_MED: Record<string, number>;
export declare const PREMIUM_SUBLEVEL_MARKET: Record<string, [number, number]>;
export declare const INDEX_RANGE: Record<string, string>;

/** Главная функция. Разбирает любую запись номера и возвращает вердикт. */
export declare function evaluate(raw: string, options?: EvaluateOptions): Verdict;

/** Приводит запись номера к 8-значному окну. null — не распознан. */
export declare function normalize(raw: string): string | null;

export declare function parse(raw: string): {
  window: string | null;
  errorCode: string | null;
  errorParams: Record<string, string | number>;
};

/** Подставляет тексты словаря в уже посчитанный вердикт (для смены языка). */
export declare function localize(v: Verdict, messages: Record<string, string>): Verdict;

/** Подстановка {имя} в строку словаря. */
export declare function fill(template: string, params: Record<string, unknown>): string;

/** Диапазон цены отдельно: [нижняя, рекомендация, верхняя]. */
export declare function priceRange(
  operator: Operator, status: string, index: number, sublevel?: Sublevel
): [number, number, number];

export declare function transferFee(
  operator: Operator, status: string,
  monthsHeld?: number | null, entity?: "individual" | "legal",
  heldOverLimit?: boolean | null
): { amount: number; code: string; params: Record<string, string | number> };

export declare function patternFamily(patternCode: string): PatternFamily;

/** Готовый многострочный текст. Работает только с локализованным вердиктом. */
export declare function explain(v: Verdict): string;

/** Разделяет разряды неразрывными пробелами и добавляет знак драма. */
export declare function money(n: number): string;
