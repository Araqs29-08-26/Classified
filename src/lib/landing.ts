import type { Listing } from "./supabase";

/**
 * Страницы под поисковые запросы.
 *
 * Человек ищет не «доску объявлений», а «գոլդ համար» или «красивый номер
 * Viva». Такая страница отвечает ровно на его запрос: объясняет, о чём речь,
 * и сразу показывает подходящие номера. С неё он попадает в каталог.
 *
 * Ключевые слова взяты у владельца площадки — он знает рынок. Отдельно учтено,
 * что армянские запросы часто набирают латиницей: «gexecik hamar», «gold
 * hamar», «vip hamar». Это не выдумка, а то, как люди действительно пишут;
 * такие написания разобраны на отдельной странице-словаре.
 */
export type Landing = {
  slug: string;
  /** По каким операторам отбирать. Пусто — по всем. */
  operators?: string[];
  /** По каким статусам отбирать. Пусто — по всем. */
  tiers?: string[];
  /**
   * По каким узорам отбирать — начала кодов движка.
   *
   * Коды вида «pal.5» или «run.3» выдаёт сам движок; сравниваем по началу,
   * чтобы «зеркальные» покрывали и pal.4, и pal.5, и pal.6.
   */
  patterns?: string[];
};

export const LANDINGS: Landing[] = [
  { slug: "viva", operators: ["Viva"] },
  { slug: "ucom", operators: ["Ucom"] },
  { slug: "team", operators: ["Team Telecom"] },
  { slug: "gold", tiers: ["Золотой"] },
  { slug: "vip", tiers: ["Премиум", "Элит", "Бриллиантовый"] },
  { slug: "mirror", patterns: ["pal."] },
  { slug: "triple", patterns: ["run.3", "run.4", "run.5", "run.6"] },
  { slug: "round", patterns: ["zeros.tail."] },
];

export function findLanding(slug: string): Landing | null {
  return LANDINGS.find((l) => l.slug === slug) ?? null;
}

/**
 * Подходит ли объявление этой странице.
 *
 * Код узора приходит отдельным доводом: в объявлении он может быть не
 * сохранён (старые записи), и тогда страница считает его движком.
 */
export function matchesLanding(
  landing: Landing,
  listing: Listing,
  patternCode: string | null
): boolean {
  if (landing.operators && !landing.operators.includes(listing.operator)) {
    return false;
  }
  if (landing.tiers && !landing.tiers.includes(listing.status_tier)) {
    return false;
  }
  if (landing.patterns) {
    if (!patternCode) return false;
    if (!landing.patterns.some((p) => patternCode.startsWith(p))) return false;
  }
  return true;
}
