/**
 * Обёртка над модулем оценки номеров (src/lib/araqs).
 *
 * Модуль приходит готовым от разработчика движка и не переписывается: он
 * одинаково работает в браузере, в Node и на сервере, у него нет зависимостей.
 * Здесь только то, что нужно сайту: типы, выбор словаря по языку и удобный
 * вызов.
 *
 * Тексты движок не содержит — он отдаёт коды, а строки берутся из его же
 * словарей messages.<язык>.json. Поэтому статус, узор, пояснения и объяснение
 * сбора приходят уже на нужном языке.
 */
import engine from "./araqs/araqs-number-engine.js";
import ru from "./araqs/messages.ru.json";
import hy from "./araqs/messages.hy.json";
import en from "./araqs/messages.en.json";

/**
 * Одна поправка к словарям движка.
 *
 * Движок называет обычные номера непубликуемыми — так было, пока за размещение
 * брали деньги и площадка принимала только номера с узором. Размещение стало
 * бесплатным для всех статусов, поэтому строка заменена. Расчёт при этом не
 * трогается: статус, индекс и сбор движок считает как считал, меняется только
 * пояснение к обычному номеру.
 */
const NOT_PUBLISHABLE = "note.notPublishable";

const PUBLISHABLE_ANYWAY: Record<string, string> = {
  ru: "Узор не найден — номер обычный. Разместить его всё равно можно: размещение бесплатное для всех статусов.",
  hy: "Նախշ չի գտնվել — համարը սովորական է։ Այն միևնույն է կարելի է տեղադրել. տեղադրումն անվճար է բոլոր կարգավիճակների համար։",
  en: "No pattern found — the number is an ordinary one. You can still post it: posting is free for every status.",
};

const DICTIONARIES: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries({ ru, hy, en }).map(([locale, dict]) => [
    locale,
    { ...dict, [NOT_PUBLISHABLE]: PUBLISHABLE_ANYWAY[locale] },
  ])
);

export type Operator = "viva" | "team" | "ucom";

export type EngineOk = {
  ok: true;
  version: string;
  /** Восемь значащих цифр номера. */
  window: string;
  /** Русское название статуса — оно же ключ в разделе tiers словарей сайта. */
  status: string;
  statusCode: string;
  /** Готовое название статуса на языке запроса. */
  statusName: string;
  sublevel: string | null;
  /** Индекс красоты, 0–100. */
  index: number;
  indexRange: string;
  patternCode: string;
  patternFamily: string;
  patternParams: Record<string, string | number>;
  /** Границы узора внутри window — включительные индексы, считая с нуля. */
  patternFrom: number | null;
  patternTo: number | null;
  /** Найденный узор словами. */
  pattern: string;
  operator: Operator | null;
  operatorFromCode: boolean;
  heldOverLimit: boolean | null;
  entity: "individual" | "legal";
  distinct: number;
  /** Диапазон цены продавца: от прайса оператора до рыночного уровня. */
  sellerMin: number;
  sellerTypical: number;
  sellerMax: number;
  transferFee: number;
  feeCode: string;
  /** Как посчитан сбор — словами. */
  feeNote: string;
  totalMin: number;
  totalTypical: number;
  totalMax: number;
  publishable: boolean;
  /** Пояснения словами, от нуля до шести. */
  notes: string[];
};

export type EngineFail = {
  ok: false;
  version: string;
  errorCode: string;
  /** Причина отказа словами. */
  error: string;
};

export type EngineResult = EngineOk | EngineFail;

export type EngineOptions = {
  operator?: Operator | null;
  /** Владеет ли продавец номером дольше льготного срока. Спрашивается только у Viva. */
  heldOverLimit?: boolean | null;
  entity?: "individual" | "legal";
  /** Язык текстов в ответе. */
  locale?: string;
};

export const ENGINE_VERSION: string = engine.VERSION;

/** Диапазон индекса красоты для каждого статуса, например «90–100». */
export const INDEX_RANGE: Record<string, string> = engine.INDEX_RANGE;

/** Прайсы операторов по категориям номера — на них считается сбор за переоформление. */
export const OPERATOR_PRICES: Record<Operator, Record<string, number>> =
  engine.OPERATOR_PRICES;

/**
 * Правила переоформления, как их знает движок.
 *
 * Вынесены наружу, чтобы страница «Переоформление» показывала ровно те числа,
 * по которым считается сбор в объявлениях, а не переписанные руками.
 */
export const TRANSFER_RULES = {
  vivaFixed: 500,
  vivaFreeAfterMonths: { individual: 24, legal: 6 },
  teamFixed: 700,
  ucomFlatFee: 1000,
} as const;

/**
 * Названия операторов на сайте → коды движка.
 *
 * «Других» здесь намеренно нет: их тарифов на переоформление мы не знаем.
 * Движок в этом случае считает по прайсу Viva и сам предупреждает об этом.
 */
export const OPERATOR_CODE: Record<string, Operator> = {
  Viva: "viva",
  Ucom: "ucom",
  "Team Telecom": "team",
};

/** Подставить значения в строку словаря: «оканчиваются на {mask}». */
export function fillMessage(
  template: string,
  params: Record<string, string | number>
): string {
  return engine.fill(template, params);
}

/** Строка из словаря движка по коду. Если ключа нет, вернётся сам код — так пропажа видна. */
export function engineMessage(code: string, locale: string): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES.ru;
  return dict[code] ?? code;
}

export function evaluateNumber(input: string, options?: EngineOptions): EngineResult {
  const { locale = "ru", ...rest } = options ?? {};
  return engine.evaluate(input, {
    ...rest,
    messages: DICTIONARIES[locale] ?? DICTIONARIES.ru,
  }) as EngineResult;
}
