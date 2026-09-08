/**
 * Категории номеров и сборы за переоформление — по каждому оператору.
 *
 * Числа взяты со страниц самих операторов (снимок 09.09.2026) и совпадают
 * с прайсами внутри движка оценки: страница и расчёт на карточках не должны
 * расходиться.
 *
 * ВАЖНО. Здесь только то, что оператор публикует сам. Категории, которых у
 * оператора нет, не выдумываются: у Team и Ucom нет отдельных категорий выше
 * «Бриллиантового», и об этом сказано прямо, а не заполнено похожей цифрой.
 *
 * Названия категорий — операторские, а не наши. Наша шкала статусов построена
 * по шкале Viva, поэтому у Viva они совпадают, а у Team и Ucom — свои.
 */
export type TransferCategory = {
  /** Ключ в разделе tiers словарей сайта либо собственное название категории. */
  tier: string;
  price: number;
};

export type OperatorTransfer = {
  key: "viva" | "team" | "ucom";
  name: string;
  /** Что берётся сверх категории, в драмах. */
  fixed: number;
  categories: TransferCategory[];
  links: { url: string; key: string }[];
};

export const OPERATOR_TRANSFER: OperatorTransfer[] = [
  {
    key: "viva",
    name: "Viva",
    fixed: 500,
    categories: [
      { tier: "Премиум", price: 1100000 },
      { tier: "Элит", price: 650000 },
      { tier: "Бриллиантовый", price: 450000 },
      { tier: "Платиновый", price: 200000 },
      { tier: "Золотой", price: 65000 },
      { tier: "Серебряный", price: 25000 },
      { tier: "Бронзовый", price: 9000 },
      { tier: "Обычный", price: 0 },
    ],
    links: [
      {
        url: "https://www.viva.am/ru/individual-customers/services/comfortable-communication/number-re-registration",
        key: "linkTransfer",
      },
      {
        url: "https://www.viva.am/ru/individual-customers/services/number-selection",
        key: "linkCategories",
      },
    ],
  },
  {
    key: "team",
    name: "Team Telecom",
    fixed: 700,
    categories: [
      { tier: "Бриллиантовый", price: 350000 },
      { tier: "Платиновый", price: 140000 },
      { tier: "Золотой", price: 60000 },
      { tier: "Серебряный", price: 20000 },
      { tier: "Бронзовый", price: 8000 },
      { tier: "Никелевый", price: 2000 },
    ],
    links: [
      {
        url: "https://www.telecomarmenia.am/hy/b2c-subscriber-service/number-replacement/158/",
        key: "linkTransfer",
      },
      {
        url: "https://www.telecomarmenia.am/hy/b2c-subscriber-service/nice-number-selection/157/",
        key: "linkCategories",
      },
      {
        url: "https://www.telecomarmenia.am/hy/fixed-services/nice-number-selection/1226",
        key: "linkLandline",
      },
    ],
  },
  {
    key: "ucom",
    name: "Ucom",
    fixed: 0,
    categories: [
      { tier: "Бриллиантовый", price: 400000 },
      { tier: "Платиновый", price: 150000 },
      { tier: "Золотой", price: 60000 },
      { tier: "Серебряный", price: 20000 },
      { tier: "Бронзовый", price: 8000 },
    ],
    links: [
      {
        url: "https://www.ucom.am/services/general_service/nice-numbers",
        key: "linkTransfer",
      },
    ],
  },
];

/** Сколько Ucom берёт за переоформление недорогих категорий. */
export const UCOM_FLAT = 1000;
