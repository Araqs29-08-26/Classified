/**
 * Прайс платных услуг — в одном месте.
 *
 * Цены лежат здесь, а не в словарях: словари переводятся, а сумма во всех
 * трёх языках одна. Названия и описания услуг — в разделах promo и promoPage
 * словарей.
 */
export const PROMO_PRICES = {
  top: 1000,
  highlight: 2000,
  urgent: 700,
} as const;

export type PromoKind = keyof typeof PROMO_PRICES;

/** Порядок в окне: от самой заметной услуги к самой простой. */
export const PROMO_KINDS: PromoKind[] = ["top", "highlight", "urgent"];

/** Плата за каждое второе и последующее объявление одного пользователя. */
export const EXTRA_LISTING_PRICE = 500;

/** Срок действия продвижения в днях. */
export const PROMO_DAYS = 30;

/**
 * Месячные подписки.
 *
 * «Магазин» снимает доплату за второе и последующие объявления: limit — сколько
 * объявлений разрешено держать, null — без ограничения. «Охотник» к объявлениям
 * не относится вовсе: это уведомление о появлении нужной комбинации.
 */
export const SUBSCRIPTIONS = [
  { plan: "shop_50", price: 10000, limit: 50 },
  { plan: "shop_100", price: 15000, limit: 100 },
  { plan: "shop_unlimited", price: 100000, limit: null },
] as const;

export const HUNTER_PRICE = 1000;
