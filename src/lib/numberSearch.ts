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
  /**
   * Все группы узоров номера.
   *
   * Именно список, а не одно значение: 041 10 90 90 — это и повтор блока,
   * и нули. Пока группа была одна, разделы «Повторы», «Нули» и «Мало разных
   * цифр» в фильтре стояли пустыми — номер числился только в той группе,
   * которая задала статус.
   */
  fams: string[];
  /** Группа, задавшая статус. Оставлена модулем для совместимости. */
  fam: string;
  pc: string;
  dis: number;
  op: string;
  /** Цена объявления. Модуль отбирает по ней, если задан диапазон. */
  price?: number;
  [extra: string]: unknown;
};

export type SearchQuery = {
  mask: string | null;
  where: MaskPosition;
  counts: CountCondition[];
  /** Группы узора списком: подходит номер, у которого есть хотя бы одна из них. */
  families: string[];
  statusMin: string | null;
  priceMin: number | null;
  /** null означает «без верхней границы»: потолка у цены в поиске нет. */
  priceMax: number | null;
  /** Код ошибки для словаря либо null. */
  error: string | null;
  /** Код подсказки: расшифровка запроса человеческими словами. */
  hint: string;
  /**
   * Маска так, как её набрал человек — со звёздочками.
   *
   * В подсказке показывать надо именно её: в поле mask лежит внутренняя
   * запись со знаком «?», которого человек не вводил. Увидев «5?5» вместо
   * своего «5*5», он решит, что ошибся.
   */
  maskDisplay: string | null;
};

/** Одна корзина цены для витрины. У последней верхней границы нет. */
export type PriceBucket = { code: string; min: number; max: number | null };

export const SEARCH_VERSION: string = search.VERSION;

/**
 * Готовые диапазоны цены вместо ползунка.
 *
 * У ползунка всегда есть верхний конец, и он отсекал самое дорогое — ровно те
 * номера, ради которых площадку и открывают. У последней корзины max === null.
 */
export const PRICE_BUCKETS: PriceBucket[] = search.PRICE_BUCKETS;

/** Виды узоров — для фильтра. Порядок от частых к редким. */
export const PATTERN_FAMILIES: string[] = search.FAMILIES;

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
    families?: string[];
    statusMin?: string | null;
    priceMin?: number | null;
    priceMax?: number | null;
  }
): SearchQuery {
  // Пакет типизирует families и statusMin своими объединениями строк; сайту
  // удобнее обычные строки, поэтому приводим явно.
  return search.parseQuery(text, options as never) as unknown as SearchQuery;
}

/**
 * Отбор номеров по запросу.
 *
 * Ошибка внутри модуля не должна ронять страницу. Поиск — часть каталога, а
 * не весь каталог: если он сломается, человек должен увидеть пустую выдачу и
 * шапку сайта, а не белый экран. Поэтому падение перехватывается и остаётся
 * в консоли разработчика.
 */
export function runSearch<T extends IndexRecord>(records: T[], q: SearchQuery): T[] {
  try {
    return search.search(records as never, q as never) as unknown as T[];
  } catch (error) {
    console.error("поиск не отработал", error);
    return [];
  }
}

/**
 * Номера, отличающиеся одной цифрой. Показываются, когда точных ноль.
 *
 * ПОЧЕМУ НЕ ФУНКЦИЯ МОДУЛЯ. Её findSimilar() собирает запросы-варианты сама
 * и кладёт в них устаревшее поле family вместо families. Отбор в том же
 * модуле читает q.families.length — и на первом же подошедшем номере падает
 * с ошибкой. На сайте это выглядело как белый экран вместо страницы: любой
 * поиск по маске без точных совпадений убивал её целиком, вместе с шапкой и
 * каталогом. В версии 1.3 поведение то же — проверено.
 *
 * Здесь запрос не собирается заново: берётся исходный и в нём подменяется
 * одна цифра маски. Все прочие условия — вид узора, повторы цифр, цена —
 * остаются как были, а сам отбор по-прежнему делает модуль.
 */
export function findSimilar<T extends IndexRecord>(records: T[], q: SearchQuery): T[] {
  if (!q.mask || q.error) return [];

  const seen = new Set<string>();
  const out: T[] = [];

  for (let i = 0; i < q.mask.length; i += 1) {
    const ch = q.mask.charAt(i);
    // Место, где цифра и так любая, подменять нечем.
    if (ch === "?" || ch === "X") continue;

    const variant: SearchQuery = {
      ...q,
      mask: q.mask.slice(0, i) + "?" + q.mask.slice(i + 1),
    };

    for (const rec of runSearch(records, variant)) {
      if (seen.has(rec.w)) continue;
      seen.add(rec.w);
      out.push(rec);
    }
  }

  return out.sort((a, b) => b.ix - a.ix);
}
