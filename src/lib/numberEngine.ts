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
 * Поправки к словарям движка.
 *
 * Правятся только тексты, расчёт не трогается: статус, индекс и сбор движок
 * считает как считал.
 *
 * «note.notPublishable» — движок называет обычные номера непубликуемыми, так
 * было, пока площадка принимала только номера с узором. Решением владельца
 * от 09.09.2026 размещение бесплатно для всех статусов, включая обычные.
 *
 * «search.badChars» — строка осталась от версии поиска 1.0, где «*» означала
 * любое количество цифр. С версии 1.2 «*» — ровно одна любая цифра (так же,
 * как в поиске автомобильных номеров на roadpolice.am), а количество задаётся
 * буквой «x»: «5x5» — пятёрка пять раз. Оставить прежний текст значило бы
 * учить человека тому, чего модуль больше не делает.
 */
const OVERRIDES: Record<string, Record<string, string>> = {
  ru: {
    "note.notPublishable":
      "Узор не найден — номер обычный. Разместить его всё равно можно: размещение бесплатное для всех статусов.",
    "search.badChars":
      "В запросе есть посторонние символы. Можно вводить цифры и «*» вместо одной любой цифры. Пробелы и дефисы не мешают.",
  },
  hy: {
    "note.notPublishable":
      "Նախշ չի գտնվել — համարը սովորական է։ Այն միևնույն է կարելի է տեղադրել. տեղադրումն անվճար է բոլոր կարգավիճակների համար։",
    "search.badChars":
      "Հարցման մեջ կան կողմնակի նշաններ։ Կարելի է մուտքագրել թվանշաններ և «*»՝ մեկ ցանկացած թվանշանի փոխարեն։ Բացատներն ու գծիկները չեն խանգարում։",
  },
  en: {
    "note.notPublishable":
      "No pattern found — the number is an ordinary one. You can still post it: posting is free for every status.",
    "search.badChars":
      "The query contains characters that do not belong. You can enter digits and “*” for one any digit. Spaces and hyphens do not matter.",
  },
};

/**
 * Значение в словаре — строка либо список форм для склонения.
 *
 * «цифра 4 встречается 3 раза» и «…5 раз» — разные формы одного текста;
 * движок выбирает нужную сам по правилу из ключа «_plural».
 */
export type DictionaryValue = string | string[];

const DICTIONARIES: Record<string, Record<string, DictionaryValue>> = Object.fromEntries(
  Object.entries({ ru, hy, en }).map(([locale, dict]) => [
    locale,
    { ...dict, ...OVERRIDES[locale] },
  ])
);

export type Operator = "viva" | "team" | "ucom";

/**
 * Один найденный признак номера.
 *
 * Признаков в номере бывает несколько, и показывать надо все: движок версии 4
 * научился их перечислять именно потому, что про 041 10 90 90 прежняя версия
 * говорила «пара 90 повторена дважды» и молчала про три нуля.
 */
export type Feature = {
  code: string;
  params: Record<string, string | number>;
  /** Границы подсветки внутри окна. -1, если подсвечивать нечего. */
  from: number;
  to: number;
  /** true только у признака, задавшего статус. */
  main: boolean;
  /** «price» — заложен в цену; «info» — показан, но в цену не входит. */
  affects: "price" | "info";
  /** Признак словами, уже на нужном языке. */
  text: string;
};

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
  patternFrom: number;
  patternTo: number;
  /** Найденный узор словами. */
  pattern: string;
  /** Все найденные признаки: первый задал статус, остальные под ним. */
  features: Feature[];
  /** Все группы узоров номера списком: один номер попадает сразу в несколько. */
  featureFamilies: string[];
  operator: Operator;
  operatorFromCode: boolean;
  heldOverLimit: boolean | null;
  entity: "individual" | "legal";
  digitCounts: Record<string, number>;
  distinct: number;
  /**
   * РЫНОЧНАЯ ЦЕНА — то, что платит покупатель целиком, вместе со сбором за
   * переоформление. От оператора НЕ зависит: одинаковые по узору номера стоят
   * покупателю одинаково, чья бы ни была симка.
   */
  priceMin: number;
  priceTypical: number;
  priceMax: number;
  /** Сбор оператора — ВНУТРИ рыночной цены, не сверх неё. */
  transferFee: number;
  feeCode: string;
  /** Как посчитан сбор — словами. */
  feeNote: string;
  /** Что останется продавцу: цена минус сбор. Вот это от оператора зависит. */
  sellerGetsMin: number;
  sellerGetsTypical: number;
  sellerGetsMax: number;
  /** Прайс оператора на такой же новый номер — ориентир, не часть расчёта. */
  operatorPrice: number;
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
  operator?: Operator | "auto" | null;
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

/** Код движка → название оператора, как оно пишется на сайте. */
export const OPERATOR_NAME: Record<Operator, string> = Object.fromEntries(
  Object.entries(OPERATOR_CODE).map(([name, code]) => [code, name])
) as Record<Operator, string>;

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
  const value = dict[code];
  if (value === undefined) return code;
  // У склоняемых текстов берём первую форму: без числа выбрать всё равно нечего.
  return Array.isArray(value) ? value[0] : value;
}

export function evaluateNumber(input: string, options?: EngineOptions): EngineResult {
  const { locale = "ru", ...rest } = options ?? {};
  return engine.evaluate(input, {
    ...rest,
    // Типы пакета описывают словарь строже, чем он есть: в нём бывают и
    // списки форм для склонения. Приводим явно, значение верное.
    messages: (DICTIONARIES[locale] ?? DICTIONARIES.ru) as never,
  }) as EngineResult;
}
