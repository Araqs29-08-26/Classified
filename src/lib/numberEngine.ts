/**
 * Обёртка над движком оценки номеров (araqs-number-engine.js).
 *
 * Движок написан на обычном JavaScript и одинаков для сайта и для Python-близнеца,
 * поэтому типы описаны здесь, а не в нём. Здесь же — единственное место, где код
 * от движка превращается в ключ словаря переводов.
 */
import engine from "./araqs-number-engine.js";

/** Что движок вернул: либо разобранный номер, либо отказ с кодом причины. */
export type EngineResult = EngineOk | EngineFail;

export type EngineOk = {
  ok: true;
  version: string;
  /** Восемь значащих цифр номера. */
  window: string;
  /** Русское название статуса — оно же ключ в разделе tiers словарей. */
  status: string;
  statusCode: string;
  sublevel: string | null;
  /** Индекс красоты, 0–100. */
  index: number;
  /** Код найденного узора, например "run.5". Текст — в разделе engine словарей. */
  patternCode: string;
  patternParams: Record<string, string | number>;
  /** Границы узора внутри window — включительные индексы, считая с нуля. */
  patternFrom: number | null;
  patternTo: number | null;
  operator: "viva" | "team" | "ucom" | null;
  operatorFromCode: boolean;
  /** Диапазон цены продавца. */
  sellerMin: number;
  sellerTypical: number;
  sellerMax: number;
  transferFee: number;
  feeCode: string;
  feeParams: Record<string, string | number>;
  totalMin: number;
  totalTypical: number;
  totalMax: number;
  publishable: boolean;
  noteCodes: { code: string; params: Record<string, string | number> }[];
};

export type EngineFail = {
  ok: false;
  version: string;
  errorCode: string;
  errorParams: Record<string, string | number>;
};

export type EngineOptions = {
  operator?: "viva" | "team" | "ucom" | null;
  monthsHeld?: number | null;
  entity?: "individual" | "legal";
};

/** Диапазон индекса красоты для каждого статуса, например «90–100». */
export const INDEX_RANGE: Record<string, string> = engine.INDEX_RANGE;

export const ENGINE_VERSION: string = engine.VERSION;

/**
 * Названия операторов на сайте → коды, которые понимает движок.
 *
 * «Других» здесь намеренно нет: их тарифов на переоформление мы не знаем.
 * Движок в этом случае считает по прайсу Viva и сам предупреждает об этом
 * строкой fee.unknownOperator — лучше честная оговорка, чем выдуманное число.
 */
export const OPERATOR_CODE: Record<string, "viva" | "team" | "ucom"> = {
  Viva: "viva",
  Ucom: "ucom",
  "Team Telecom": "team",
};

export function evaluateNumber(input: string, options?: EngineOptions): EngineResult {
  return engine.evaluate(input, options) as EngineResult;
}

/**
 * Код движка → ключ в разделе engine словарей.
 *
 * Точки заменяются на подчёркивания: система переводов считает точку вложенностью,
 * а среди кодов есть и "run.4", и "run.4.end" — один ключ не может быть
 * одновременно строкой и веткой.
 */
export function messageKey(code: string): string {
  return code.replace(/\./g, "_");
}
