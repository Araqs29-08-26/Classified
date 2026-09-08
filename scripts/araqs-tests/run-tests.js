/**
 * Прогон контрольных наборов. Ничего, кроме Node, не требуется.
 *
 *     node tests/run-tests.js
 *
 * Этот же файл можно подключить как npm run test:engine — он возвращает
 * код выхода 1 при любом расхождении, поэтому годится и для CI.
 *
 * Если проект использует Jest/Vitest, наборы всё равно берутся отсюда:
 * golden-cases.json и letter-cases.json — обычные JSON, их удобно
 * прогнать через it.each без переписывания.
 */
const path = require("path");
const E = require(path.join(__dirname, "..", "..", "src", "lib", "araqs", "araqs-number-engine.js"));
const S = require(path.join(__dirname, "..", "..", "src", "lib", "araqs", "araqs-number-search.js"));
const golden = require("./golden-cases.json");
const letters = require("./letter-cases.json");

let failed = 0;
const fail = (what, expected, got) => {
  failed++;
  console.error("  ПРОВАЛ  " + what + "\n          ожидали: " + expected + "\n          получили: " + got);
};

console.log("Движок версии " + E.VERSION + ", поиск версии " + S.VERSION);
if (E.VERSION !== golden.engineVersion) {
  console.warn("ВНИМАНИЕ: набор записан для версии " + golden.engineVersion +
               ", а движок версии " + E.VERSION + ". Расхождения ниже могут быть законными — " +
               "разберитесь, что изменилось в логике, прежде чем обновлять файл набора.");
}

console.log("\n1. Эталонные случаи (" + golden.cases.length + ")");
golden.cases.forEach(function (c) {
  const v = E.evaluate(c.input);
  const status = v.ok ? v.status : null;
  if (status !== c.expectStatus) return fail(c.input + " — статус", c.expectStatus, status);
  if (c.expectPatternCode && v.patternCode !== c.expectPatternCode)
    return fail(c.input + " — код узора", c.expectPatternCode, v.patternCode);
  if (c.expectIndex !== null && v.index !== c.expectIndex)
    return fail(c.input + " — индекс", c.expectIndex, v.index);
  if (c.expectSellerMin !== null && v.sellerMin !== c.expectSellerMin)
    return fail(c.input + " — нижняя граница цены", c.expectSellerMin, v.sellerMin);
  if (c.expectSellerMax !== null && v.sellerMax !== c.expectSellerMax)
    return fail(c.input + " — верхняя граница цены", c.expectSellerMax, v.sellerMax);
});

console.log("2. Разбор записи номера (" + letters.cases.length + ")");
letters.cases.forEach(function (c) {
  const got = E.normalize(c.input);
  if (got !== c.expectWindow)
    fail("«" + c.input + "»", String(c.expectWindow), String(got));
});

console.log("3. Поиск");
const demo = ["44841414", "55254565", "44555550", "77777797", "44556677"].map(function (w) {
  const rec = S.buildIndex(E.evaluate("0" + w));
  rec.num = "0" + w;
  return rec;
});
const checks = [
  ["маска 14 в конце",      { text: "14", opts: { where: "end" } },                 ["044841414"]],
  ["пятёрка не менее 5 раз",{ text: "",   opts: { counts: [{digit:"5",min:5}] } },   ["055254565", "044555550"]],
  ["семёрка не менее 6 раз",{ text: "",   opts: { counts: [{digit:"7",min:6}] } },   ["077777797"]],
  ["маска 5?5?5",           { text: "5?5?5", opts: {} },                             ["055254565", "044555550"]],
  ["мусор в запросе",       { text: "абв", opts: {} },                               "search.badChars"],
];
checks.forEach(function (row) {
  const q = S.parseQuery(row[1].text, row[1].opts);
  if (typeof row[2] === "string") {
    if (q.error !== row[2]) fail(row[0], row[2], q.error);
    return;
  }
  const got = S.search(demo, q).map(r => r.num).sort();
  const want = row[2].slice().sort();
  if (got.join(",") !== want.join(","))
    fail(row[0], want.join(", ") || "ничего", got.join(", ") || "ничего");
});

console.log("4. Словари");
["ru", "hy", "en"].forEach(function (lang) {
  let dict;
  try { dict = require("../../src/lib/araqs/messages." + lang + ".json"); }
  catch (e) { return fail("словарь " + lang, "файл на месте", "не найден"); }
  const ref = require("../../src/lib/araqs/messages.ru.json");
  const missing = Object.keys(ref).filter(k => dict[k] === undefined);
  if (missing.length) fail("словарь " + lang + " — пропущены ключи", "все " +
    Object.keys(ref).length, "нет " + missing.length + ": " + missing.slice(0, 5).join(", "));
  // Каждая подстановка {имя} из русского файла должна быть и в переводе,
  // иначе на экран уйдёт текст с потерянным числом.
  Object.keys(ref).forEach(function (k) {
    if (dict[k] === undefined) return;
    const need = (String(ref[k]).match(/\{\w+\}/g) || []).sort().join(",");
    const have = (String(dict[k]).match(/\{\w+\}/g) || []).sort().join(",");
    if (need !== have) fail("словарь " + lang + ", ключ " + k + " — подстановки",
                            need || "нет", have || "нет");
  });
});

console.log(failed === 0
  ? "\nВсё сошлось."
  : "\nРасхождений: " + failed + ". Это значит, что поведение движка изменилось — " +
    "разберитесь в причине, прежде чем править контрольный набор.");
process.exit(failed === 0 ? 0 : 1);
