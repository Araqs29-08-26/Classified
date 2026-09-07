/**
 * Классификатор статуса номера — версия 1, восстановленная с работающего сайта.
 *
 * ВНИМАНИЕ. Этот файл — временный. По решению от 06.09.2026 его заменит отдельный
 * «Движок оценки номеров» (araqs-number-engine.js): он анализирует 8 цифр вместо 6,
 * возвращает индекс красоты 0–100, узор словами, диапазон цены, сбор оператора за
 * переоформление и полную стоимость для покупателя. Здесь алгоритм сохранён один в один
 * с прежним сайтом, чтобы восстановленная версия вела себя ровно как боевая — и чтобы
 * замену движка можно было проверить сравнением.
 *
 * Известное ограничение версии 1: тексты «Почему» захардкожены по-русски и не переводятся,
 * поэтому на /hy и /en они остаются русскими. В движке это решается словарями переводов.
 */

export type ClassifyResult = { tier: string; reason: string };

function digitCounts(s: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const ch of s) m[ch] = (m[ch] ?? 0) + 1;
  return m;
}

/** Последние 6 цифр; null, если цифр меньше шести. */
function last6(input: string): string | null {
  const d = input.replace(/\D/g, "");
  return d.length < 6 ? null : d.slice(-6);
}

/** Длина самой длинной серии одинаковых цифр подряд. */
function maxRun(s: string): number {
  let best = 1;
  let cur = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1]) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

/** Число непересекающихся пар одинаковых соседних цифр (жадно слева направо). */
function pairCount(s: string): number {
  let n = 0;
  let i = 0;
  while (i < s.length - 1) {
    if (s[i] === s[i + 1]) {
      n += 1;
      i += 2;
    } else {
      i += 1;
    }
  }
  return n;
}

/** Длина самой длинной последовательности с шагом +1 или −1. */
function maxSeq(s: string): number {
  let best = 1;
  let up = 1;
  let down = 1;
  for (let i = 1; i < s.length; i++) {
    const cur = Number(s[i]);
    const prev = Number(s[i - 1]);
    up = cur === prev + 1 ? up + 1 : 1;
    down = cur === prev - 1 ? down + 1 : 1;
    best = Math.max(best, up, down);
  }
  return best;
}

/** Количество нулей в конце. */
function trailingZeros(s: string): number {
  let n = 0;
  for (let i = s.length - 1; i >= 0 && s[i] === "0"; i--) n += 1;
  return n;
}

/** Строгое чередование ABABAB, причём A ≠ B. */
function isAlternating(s: string): boolean {
  const a = s[0];
  const b = s[1];
  if (a === b) return false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== (i % 2 === 0 ? a : b)) return false;
  }
  return true;
}

export function classify(input: string): ClassifyResult | null {
  const s = last6(input);
  if (!s) return null;

  const counts = digitCounts(s);
  const maxCount = Math.max(...Object.values(counts));
  const run = maxRun(s);
  const pairs = pairCount(s);
  const seq = maxSeq(s);
  const zeros = trailingZeros(s);

  if (maxCount >= 5) {
    return { tier: "Премиум", reason: `${maxCount} из 6 последних цифр совпадают` };
  }

  if (maxCount === 4 || zeros >= 4) {
    return {
      tier: "Элит",
      reason:
        zeros >= 4
          ? `номер заканчивается на ${zeros} нулей`
          : "одна цифра повторяется 4 раза",
    };
  }

  if (isAlternating(s) || pairs >= 3) {
    return {
      tier: "Бриллиантовый",
      reason: "чередующийся или парный узор во всех 6 цифрах",
    };
  }

  if (
    s.slice(0, 3) === s.slice(3, 6) ||
    s === [...s].reverse().join("") ||
    (maxCount === 3 && run >= 3)
  ) {
    return {
      tier: "Платиновый",
      reason: "номер зеркальный или содержит тройной повтор подряд",
    };
  }

  if (maxCount === 3 || pairs === 2 || seq >= 4) {
    return {
      tier: "Золотой",
      reason: "цифра повторяется трижды или две пары подряд",
    };
  }

  if (pairs === 1 || seq === 3) {
    return {
      tier: "Серебряный",
      reason: "есть одна пара одинаковых цифр подряд или короткая последовательность",
    };
  }

  if (Object.keys(counts).length <= 5) {
    return { tier: "Бронзовый", reason: "есть хотя бы одна повторяющаяся цифра" };
  }

  return { tier: "Обычный", reason: "заметного узора в номере нет" };
}
