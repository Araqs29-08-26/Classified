/**
 * Типы для araqs-number-search.js
 *
 * Модуль поиска отвечает на вопрос «какие номера мне подходят», в отличие от
 * движка оценки, который отвечает «сколько стоит вот этот номер».
 *
 * На сайте поиск должен идти В БАЗЕ: buildIndex() один раз при подаче
 * объявления, дальше toSql() строит условие WHERE. Функции search() и
 * matches() нужны для тестов и для небольших списков в памяти.
 */

import type { StatusCode, PatternFamily, Verdict } from "./araqs-number-engine";

/** Где в номере должна стоять маска. Позиция считается по ТЕЛУ номера. */
export type MaskPosition = "any" | "start" | "middle" | "end";

/** «Цифра N встречается не менее K раз, где угодно в номере». */
export interface CountCondition {
  digit: string;   // "0".."9"
  min: number;     // 2..8
}

/** Запись поискового индекса. Кладётся в базу рядом с объявлением. */
export interface IndexRecord {
  /** Все группы узоров номера. Список: номер почти всегда попадает в несколько. */
  fams: PatternFamily[];
  zeros: number;        // сколько нулей в номере — «круглые цифры»
  pa: number;           // пар одинаковых цифр по разбивке, включая разрозненные
  maxrep: number;       // сколько раз встречается самая частая цифра
  tail: string | null;  // цифра, на которую кончаются ВСЕ пары, иначе null
  price?: number;       // цена объявления — для фильтра по цене
  w: string;                          // окно из 8 цифр — по нему маска
  dc: Record<string, number>;         // сколько раз встречается каждая цифра
  st: StatusCode;
  st_rank: number;                    // 0..7 — для «от Золотого и выше»
  ix: number;                         // индекс красоты, по нему сортировка
  fam: PatternFamily;
  pc: string;                         // точный код узора
  dis: number;                        // сколько разных цифр в теле
  op: string;
  /** Те же счётчики плоскими столбцами — так их индексирует база. */
  d0: number; d1: number; d2: number; d3: number; d4: number;
  d5: number; d6: number; d7: number; d8: number; d9: number;
  /** Сюда можно дописать свои поля объявления: id, цену, дату. */
  [extra: string]: unknown;
}

export interface SearchQuery {
  mask: string | null;
  where: MaskPosition;
  counts: CountCondition[];
  /** Список групп узора: подходит номер, где есть ХОТЯ БЫ ОДНА из них. */
  families: PatternFamily[];
  family: PatternFamily | null;   // устаревшее, оставлено для совместимости
  statusMin: StatusCode | null;
  zerosMin: number | null;
  pairsMin: number | null;
  repeatMin: number | null;
  sameTail: boolean;
  priceMin: number | null;
  /** null означает «без верхней границы» — потолка в поиске нет. */
  priceMax: number | null;
  /** Код ошибки для словаря: "search.empty", "search.badChars", ... */
  error: string | null;
  /** Код подсказки для словаря: "search.hint.end", "search.hint.count". */
  hint: string;
}

export interface ParseOptions {
  where?: MaskPosition;
  counts?: CountCondition[];
  families?: PatternFamily[];
  family?: PatternFamily | null;
  statusMin?: StatusCode | null;
  zerosMin?: number | null;
  pairsMin?: number | null;
  repeatMin?: number | null;
  sameTail?: boolean;
  priceMin?: number | null;
  priceMax?: number | null;
}

/** Готовые диапазоны цены для витрины. У последнего max === null. */
export interface PriceBucket { code: string; min: number; max: number | null; }
export declare const PRICE_BUCKETS: PriceBucket[];
export declare const FAMILIES: PatternFamily[];
export declare function countAlignedPairs(w: string): number;
export declare function sameTail(w: string): string | null;

export declare const VERSION: string;
export declare const STATUS_RANK: StatusCode[];

/** Из вердикта движка — запись для базы. null, если номер не распознан. */
export declare function buildIndex(verdict: Verdict): IndexRecord | null;

/**
 * Разбирает то, что человек написал в строку поиска, плюс значения
 * отдельных элементов интерфейса. Не угадывает там, где угадывание
 * может обмануть: «5x5» — это «пятёрка пять раз», а не маска «5?5».
 */
export declare function parseQuery(text: string, options?: ParseOptions): SearchQuery;

/** Маска в регулярное выражение по окну из 8 цифр. */
export declare function maskToRegExp(mask: string, where: MaskPosition): RegExp;

export declare function matches(rec: IndexRecord, q: SearchQuery): boolean;

/** Поиск в памяти. Выдача отсортирована по индексу красоты вниз. */
export declare function search<T extends IndexRecord>(
  records: T[], q: SearchQuery, limit?: number
): T[];

/** Номера, отличающиеся одной цифрой. Показывать, когда точных ноль. */
export declare function findSimilar<T extends IndexRecord>(
  records: T[], q: SearchQuery, limit?: number
): T[];

/** Готовое условие для базы: { where: "w LIKE ? AND d5 >= ?", params: [...] } */
export declare function toSql(
  q: SearchQuery, table?: string
): { where: string; params: Array<string | number> };
