/**
 * Определение оператора по коду армянского номера.
 *
 * Внимание: из-за переносимости номеров (MNP, действует в Армении с 01.04.2014)
 * код номера НЕ гарантирует оператора — это подсказка, которую продавец подтверждает сам.
 */
const PREFIX_TO_OPERATOR: Record<string, string> = {
  "77": "Viva",
  "93": "Viva",
  "94": "Viva",
  "98": "Viva",
  "49": "Viva",

  "91": "Team Telecom",
  "96": "Team Telecom",
  "99": "Team Telecom",
  "43": "Team Telecom",
  "33": "Team Telecom",

  "55": "Ucom",
  "95": "Ucom",
  "41": "Ucom",
  "44": "Ucom",
};

/**
 * Коды фиксированной (городской) связи Еревана.
 *
 * 10 — Team Telecom (бывший АрменТел / Beeline), исторический и самый массовый код.
 * 11 и 12 — Ucom, фиксированная телефония по оптоволокну.
 * 15 — OVIO (бывший Ростелеком Армения / GNC-Alfa). Этого оператора на площадке
 * пока нет в списке, поэтому оператор остаётся неопределённым, а продавец
 * указывает его сам.
 *
 * Как и с мобильными, MNP делает код лишь подсказкой, а не гарантией.
 */
const LANDLINE_PREFIX_TO_OPERATOR: Record<string, string | null> = {
  "10": "Team Telecom",
  "11": "Ucom",
  "12": "Ucom",
  "15": null,
};

/** Оставить только цифры и срезать код страны 374 либо ведущий 0. */
function digits(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("374")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  return d;
}

export function normalizePhone(input: string): string {
  return digits(input);
}

export function detect(input: string): {
  operator: string | null;
  numberType: string;
} {
  const d = digits(input);
  const prefix = d.slice(0, 2);

  if (d.length === 8) {
    // Городские коды Еревана тоже восьмизначные, поэтому проверяем их первыми:
    // иначе +374 11 22 07 44 считался бы мобильным с неизвестным оператором.
    if (prefix in LANDLINE_PREFIX_TO_OPERATOR) {
      return {
        operator: LANDLINE_PREFIX_TO_OPERATOR[prefix],
        numberType: "Городской",
      };
    }
    return {
      operator: PREFIX_TO_OPERATOR[prefix] ?? null,
      numberType: "Мобильный",
    };
  }
  if (d.length > 0 && d.length <= 6) {
    return { operator: null, numberType: "Короткий" };
  }
  return { operator: null, numberType: "Городской" };
}
