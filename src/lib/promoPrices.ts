/**
 * Прайс платного продвижения — в одном месте.
 *
 * Цены лежат здесь, а не в словарях: словари переводятся, а сумма во всех
 * трёх языках одна. Тексты услуг — в разделе promo словарей.
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
