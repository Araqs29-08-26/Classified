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
 * hamar», «vip hamar». Это не выдумка, а то, как люди действительно пишут.
 */
export type Landing = {
  slug: string;
  /** По каким операторам отбирать. Пусто — по всем. */
  operators?: string[];
  /** По каким статусам отбирать. Пусто — по всем. */
  tiers?: string[];
};

export const LANDINGS: Landing[] = [
  { slug: "viva", operators: ["Viva"] },
  { slug: "ucom", operators: ["Ucom"] },
  { slug: "team", operators: ["Team Telecom"] },
  { slug: "gold", tiers: ["Золотой"] },
  { slug: "vip", tiers: ["Премиум", "Элит", "Бриллиантовый"] },
];

export function findLanding(slug: string): Landing | null {
  return LANDINGS.find((l) => l.slug === slug) ?? null;
}

/** Подходит ли объявление этой странице. */
export function matchesLanding(landing: Landing, listing: Listing): boolean {
  if (landing.operators && !landing.operators.includes(listing.operator)) {
    return false;
  }
  if (landing.tiers && !landing.tiers.includes(listing.status_tier)) {
    return false;
  }
  return true;
}
