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

const DICTIONARIES: Record<string, Record<string, string>> = { ru, hy, en };

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

export function evaluateNumber(input: string, options?: EngineOptions): EngineResult {
  const { locale = "ru", ...rest } = options ?? {};
  return engine.evaluate(input, {
    ...rest,
    messages: DICTIONARIES[locale] ?? DICTIONARIES.ru,
  }) as EngineResult;
}
