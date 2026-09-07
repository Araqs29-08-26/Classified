/**
 * Приёмочный тест «Движка оценки номеров».
 *
 * Прогоняет 15 эталонных случаев из контрольного набора
 * (Araqs_kontrolny_nabor_06-09-26.xlsx, лист «Эталонные случаи»).
 * Должно совпасть 15 из 15 — иначе движок встроен неправильно.
 *
 * Плюс две отдельные проверки из пакета передачи:
 *  — 077 24 44 44 даёт разный сбор за переоформление при 40 и при 5 месяцах владения;
 *  — номер с буквами вместо цифр («О9I 11 11 O1») разбирается корректно.
 *
 * Запуск: npm run test:engine
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const engine = require("../src/lib/araqs-number-engine.js");

/** @type {{n:number,number:string,status:string|null,index:number|null,note:string}[]} */
const CASES = [
  { n: 1, number: "055 909090", status: "Премиум", index: 93, note: "блок «90» трижды подряд, не зеркало" },
  { n: 2, number: "077 123456", status: "Премиум", index: 90, note: "полная последовательность из 6 цифр" },
  { n: 3, number: "091 11 11 01", status: "Премиум", index: 98, note: "пять единиц подряд с учётом кода" },
  { n: 4, number: "077 77 77 97", status: "Премиум", index: 100, note: "шесть семёрок подряд с учётом кода" },
  { n: 5, number: "033 333030", status: "Премиум", index: 96, note: "пять троек подряд с учётом кода" },
  { n: 6, number: "099 06 66 66", status: "Премиум", index: 94, note: "пять шестёрок подряд" },
  { n: 7, number: "096 656669", status: "Золотой", index: 46, note: "блок только из трёх шестёрок" },
  { n: 8, number: "096 660067", status: "Золотой", index: 49, note: "три шестёрки подряд" },
  { n: 9, number: "033 19 44 44", status: "Бриллиантовый", index: 74, note: "четыре четвёрки в конце" },
  { n: 10, number: "096 030000", status: "Премиум", index: 98, note: "четыре нуля в конце" },
  { n: 11, number: "055 203-203", status: "Платиновый", index: 61, note: "повтор тройки «203»" },
  { n: 12, number: "041 140041", status: "Элит", index: 86, note: "зеркало 140041" },
  { n: 13, number: "033 36 36 11", status: "Золотой", index: 49, note: "повтор пары «36»" },
  { n: 14, number: "091 47 82 63", status: "Обычный", index: 3, note: "узора нет, не публикуется" },
  { n: 15, number: "033 3X XX XX", status: null, index: null, note: "номер не распознаётся" },
];

let passed = 0;
const failures = [];

console.log(`Движок версии ${engine.VERSION}\n`);
console.log("№   номер            ожидали          получили         индекс  итог");
console.log("─".repeat(78));

for (const c of CASES) {
  const v = engine.evaluate(c.number);

  const gotStatus = v.ok ? v.status : null;
  const gotIndex = v.ok ? v.index : null;
  const ok = gotStatus === c.status && gotIndex === c.index;

  if (ok) passed += 1;
  else failures.push({ ...c, gotStatus, gotIndex });

  console.log(
    String(c.n).padEnd(4) +
      c.number.padEnd(17) +
      String(c.status ?? "не распознан").padEnd(17) +
      String(gotStatus ?? "не распознан").padEnd(17) +
      String(gotIndex ?? "—").padEnd(8) +
      (ok ? "✓" : "✗")
  );
}

console.log("─".repeat(78));
console.log(`Эталонных случаев пройдено: ${passed} из ${CASES.length}\n`);

// --- Проверка срока владения у Viva -------------------------------------
const long = engine.evaluate("077 24 44 44", { monthsHeld: 40 });
const short = engine.evaluate("077 24 44 44", { monthsHeld: 5 });
const feeVaries = long.transferFee !== short.transferFee && long.transferFee === 500;

console.log("Срок владения (Viva, 077 24 44 44):");
console.log(`  40 месяцев → сбор ${long.transferFee} ֏`);
console.log(`   5 месяцев → сбор ${short.transferFee} ֏`);
console.log(`  ${feeVaries ? "✓" : "✗"} сбор зависит от срока владения\n`);

// --- Проверка разбора букв вместо цифр -----------------------------------
// С версии 1.2 буква внутри номера — это отказ, а не догадка. Раньше движок
// подменял «О» на 0 и «I» на 1 и в итоге оценивал совсем другой номер.
const withLetters = engine.evaluate("О9I 11 11 O1");
const plain = engine.evaluate("091 11 11 01");
const lettersOk = !withLetters.ok && plain.ok;

console.log("Буквы вместо цифр («О9I 11 11 O1»):");
console.log(
  `  ${lettersOk ? "✓" : "✗"} номер отклонён, а не разобран наугад` +
    `${withLetters.ok ? ` — но получили ${withLetters.status}, индекс ${withLetters.index}` : ""}` +
    `${plain.ok ? "" : " — и чистый 091 11 11 01 тоже не распознан"}\n`
);

// --- Проверка публикуемости ----------------------------------------------
const ordinary = engine.evaluate("091 47 82 63");
const publishOk = ordinary.ok && ordinary.publishable === false;
console.log("Запрет публикации «Обычных»:");
console.log(`  ${publishOk ? "✓" : "✗"} 091 47 82 63 → publishable = ${ordinary.publishable}\n`);

const allOk = passed === CASES.length && feeVaries && lettersOk && publishOk;

if (!allOk) {
  if (failures.length) {
    console.log("Не совпали:");
    for (const f of failures) {
      console.log(
        `  №${f.n} ${f.number}: ожидали ${f.status ?? "не распознан"}/${f.index ?? "—"}, ` +
          `получили ${f.gotStatus ?? "не распознан"}/${f.gotIndex ?? "—"} — ${f.note}`
      );
    }
  }
  process.exitCode = 1;
} else {
  console.log("Все проверки пройдены.");
}
