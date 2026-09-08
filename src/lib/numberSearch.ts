/**
 * Обёртка над модулем поиска (src/lib/araqs/araqs-number-search.js).
 *
 * Поиск отвечает на вопрос «какие номера мне подходят», в отличие от движка
 * оценки, который отвечает «сколько стоит вот этот номер».
 *
 * ЗАМЕЧАНИЕ О МАСШТАБЕ. Модуль умеет строить условие для базы (toSql) — так
 * и надо будет делать, когда объявлений станет много. Сейчас каталог целиком
 * приходит на страницу и всё равно перебирается в памяти, поэтому используется
 * search(): результат тот же, а кода и мест для ошибки меньше. Момент перехода
 * — сотни объявлений; тогда пригодится db/listing-index.sql из пакета.
 */
import search from "./araqs/araqs-number-search.js";
import type { EngineOk } from "./numberEngine";

export type MaskPosition = "any" | "start" | "middle" | "end";

export type CountCondition = { digit: string; min: number };

export type IndexRecord = {
  w: string;
  st: string;
  st_rank: number;
  ix: number;
  fam: string;
  pc: string;
  dis: number;
  op: string;
  [extra: string]: unknown;
};

export type SearchQuery = {
  mask: string | null;
  where: MaskPosition;
  counts: CountCondition[];
  family: string | null;
  statusMin: string | null;
  /** Код ошибки для словаря либо null. */
  error: string | null;
  /** Код подсказки: расшифровка запроса человеческими словами. */
  hint: string;
};

export const SEARCH_VERSION: string = search.VERSION;

/** Виды узоров — для выпадающего списка. Порядок от частых к редким. */
export const PATTERN_FAMILIES = [
  "run",
  "block",
  "pairs",
  "pal",
  "seq",
  "zeros",
  "rhythm",
  "distinct",
] as const;

/** Запись индекса из вердикта движка. null, если номер не распознан. */
export function buildIndex(verdict: EngineOk): IndexRecord | null {
  // Типы пакета описывают вердикт шире, чем нужно сайту, — приводим явно.
  return search.buildIndex(verdict as never) as IndexRecord | null;
}

export function parseQuery(
  text: string,
  options?: {
    where?: MaskPosition;
    counts?: CountCondition[];
    family?: string | null;
    statusMin?: string | null;
  }
): SearchQuery {
  // Пакет типизирует family и statusMin своими объединениями строк; сайту
  // удобнее обычные строки, поэтому приводим явно.
  return search.parseQuery(text, options as never) as SearchQuery;
}

export function runSearch<T extends IndexRecord>(records: T[], q: SearchQuery): T[] {
  return search.search(records as never, q as never) as unknown as T[];
}

/** Номера, отличающиеся одной цифрой. Показываются, когда точных ноль. */
export function findSimilar<T extends IndexRecord>(records: T[], q: SearchQuery): T[] {
  return search.findSimilar(records as never, q as never) as unknown as T[];
}
