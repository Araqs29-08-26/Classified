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

  if (d.length === 8) {
    return {
      operator: PREFIX_TO_OPERATOR[d.slice(0, 2)] ?? null,
      numberType: "Мобильный",
    };
  }
  if (d.length > 0 && d.length <= 6) {
    return { operator: null, numberType: "Короткий" };
  }
  return { operator: null, numberType: "Городской" };
}
