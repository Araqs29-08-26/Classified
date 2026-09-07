// Сверка движка оценки со всем контрольным набором разработчика.
//
// test-engine.mjs проверяет 15 показательных случаев и читается человеком.
// Этот прогон — про полноту: 385 реальных номеров рынка со всеми числами
// (статус, подуровень, индекс, код узора, диапазон цены, сбор, полная стоимость)
// плюс разбор букв в записи. Набор снят из таблицы разработчика движка,
// ожидаемые значения — его.
//
// Запуск: npm run test:control

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const engine = require("../src/lib/araqs-number-engine.js");

const set = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "control-set.json"), "utf8")
);

const shown = (v) => (v === null || v === undefined ? "—" : v);
let failed = 0;

// --- 385 номеров рынка: сверяем каждое число ------------------------------
const marketBad = [];
const kinds = {};

for (const c of set.market) {
  const v = engine.evaluate(c.number);
  const checks = {
    статус: [c.status, v.status],
    подуровень: [c.sublevel, v.sublevel ?? null],
    индекс: [c.index, v.index],
    "код узора": [c.patternCode, v.patternCode],
    "цена от": [c.sellerMin, v.sellerMin],
    "цена до": [c.sellerMax, v.sellerMax],
    сбор: [c.transferFee, v.transferFee],
    "полная от": [c.totalMin, v.totalMin],
    "полная до": [c.totalMax, v.totalMax],
  };

  const bad = Object.entries(checks).filter(([, [want, got]]) => String(want) !== String(got));
  if (bad.length) {
    for (const [field] of bad) kinds[field] = (kinds[field] ?? 0) + 1;
    if (marketBad.length < 10) {
      marketBad.push(
        `${c.number}: ` + bad.map(([f, [w, g]]) => `${f} ждали ${shown(w)}, получили ${shown(g)}`).join("; ")
      );
    }
  }
}

// --- буквы в записи --------------------------------------------------------
const letterBad = [];
for (const c of set.letters) {
  const v = engine.evaluate(c.input);
  // В таблице отказ записан словами, движок же в этом случае просто не отдаёт номер.
  const want = c.window === "не распознан" ? null : c.window;
  const got = v.ok ? v.window : null;
  if (String(got) !== String(want)) {
    letterBad.push(`«${c.input}»: ждали ${shown(want)}, получили ${shown(got)} — ${c.why}`);
  }
}

// --- показательные случаи --------------------------------------------------
const refBad = [];
for (const c of set.refs) {
  const v = engine.evaluate(c.number);
  const gotStatus = v.ok ? v.status : null;
  const ok = !v.ok
    ? c.status === null
    : String(gotStatus) === String(c.status) &&
      (c.patternCode === null || String(v.patternCode) === String(c.patternCode)) &&
      (c.index === null || String(v.index) === String(c.index));
  if (!ok) {
    refBad.push(
      `${c.number}: ждали ${shown(c.status)}/${shown(c.patternCode)}/${shown(c.index)}, ` +
        `получили ${shown(gotStatus)}/${shown(v.patternCode)}/${shown(v.index)} — ${c.expects}`
    );
  }
}

// пересчитываем провалы рынка честно, по номерам
let marketFailedCount = 0;
for (const c of set.market) {
  const v = engine.evaluate(c.number);
  const bad =
    String(c.status) !== String(v.status) ||
    String(c.sublevel) !== String(v.sublevel ?? null) ||
    String(c.index) !== String(v.index) ||
    String(c.patternCode) !== String(v.patternCode) ||
    String(c.sellerMin) !== String(v.sellerMin) ||
    String(c.sellerMax) !== String(v.sellerMax) ||
    String(c.transferFee) !== String(v.transferFee) ||
    String(c.totalMin) !== String(v.totalMin) ||
    String(c.totalMax) !== String(v.totalMax);
  if (bad) marketFailedCount++;
}

const line = "─".repeat(78);
console.log(line);
console.log(`Контрольный набор движка — версия движка ${engine.VERSION}`);
console.log(line);
console.log(`Прогон по рынку:      ${set.market.length - marketFailedCount} из ${set.market.length}`);
console.log(`Буквы в записи:       ${set.letters.length - letterBad.length} из ${set.letters.length}`);
console.log(`Показательные случаи: ${set.refs.length - refBad.length} из ${set.refs.length}`);
console.log(line);

if (Object.keys(kinds).length) {
  console.log("\nПо каким полям расходится:");
  for (const [f, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) console.log(`  ${f}: ${n}`);
}
for (const [title, list] of [
  ["Рынок", marketBad],
  ["Буквы", letterBad],
  ["Показательные", refBad],
]) {
  if (list.length) {
    console.log(`\n${title} — расхождения:`);
    list.forEach((l) => console.log("  " + l));
  }
}

failed = marketFailedCount + letterBad.length + refBad.length;
if (failed) {
  console.log(`\nНе сошлось: ${failed}.`);
  process.exitCode = 1;
} else {
  console.log("\nВсё сошлось.");
}
