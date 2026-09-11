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
  if (c.expectPriceMin !== undefined && v.priceMin !== c.expectPriceMin)
    return fail(c.input + " — нижняя граница рыночной цены", c.expectPriceMin, v.priceMin);
  if (c.expectPriceMax !== undefined && v.priceMax !== c.expectPriceMax)
    return fail(c.input + " — верхняя граница рыночной цены", c.expectPriceMax, v.priceMax);
  // Рыночная цена НЕ должна зависеть от оператора — ради этого и затевалась
  // версия 5.0. Проверяем прямо: три оператора, цена одна.
  if (v.publishable) {
    const byOp = ["viva", "team", "ucom"].map(function (op) {
      const x = E.evaluate(c.input, { operator: op });
      return x.priceMin + "/" + x.priceTypical + "/" + x.priceMax;
    });
    if (new Set(byOp).size !== 1)
      return fail(c.input + " — цена разная у разных операторов", "одна цена", byOp.join(" | "));
    // А вот остаток продавцу обязан от оператора зависеть, иначе сбор потерян.
    const fees = ["viva", "team", "ucom"].map(function (op) {
      return E.evaluate(c.input, { operator: op }).transferFee;
    });
    const gets = ["viva", "team", "ucom"].map(function (op) {
      const x = E.evaluate(c.input, { operator: op });
      return x.priceTypical - x.transferFee;
    });
    gets.forEach(function (g, i) {
      const x = E.evaluate(c.input, { operator: ["viva","team","ucom"][i] });
      if (Math.max(0, g) !== x.sellerGetsTypical)
        fail(c.input + " — остаток продавцу посчитан неверно", Math.max(0, g), x.sellerGetsTypical);
    });
    if (fees[0] === fees[1] && fees[1] === fees[2] && fees[0] > 1000)
      return fail(c.input + " — сбор одинаков у всех операторов", "разные сборы", fees.join(", "));
  }
  // Движок обязан показывать ВСЕ найденные признаки, а не только главный.
  if (c.expectExtraFeatures !== undefined) {
    const extra = v.features.filter(function (f) { return !f.main; }).length;
    if (extra !== c.expectExtraFeatures)
      return fail(c.input + " — дополнительных признаков", c.expectExtraFeatures, extra);
  }
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
    const uniq = v => Array.from(new Set(
      (Array.isArray(v) ? v.join(" ") : String(v)).match(/\{\w+\}/g) || [])).sort().join(",");
    const need = uniq(ref[k]);
    const have = uniq(dict[k]);
    if (need !== have) fail("словарь " + lang + ", ключ " + k + " — подстановки",
                            need || "нет", have || "нет");
  });
});

console.log("5. Лестница не переходит через девятку");
[["41234567", 7], ["98901234", 5], ["77109876", 4], ["55890123", 4], ["77123456", 6]]
  .forEach(function (row) {
    const got = E.analyze(row[0]).seq;
    if (got !== row[1]) fail("лестница в " + row[0], row[1], got);
  });
if (E.analyze("89012345").seq_text.indexOf("89") === 0)
  fail("лестница 8901", "обрыв на девятке", E.analyze("89012345").seq_text);

console.log("6. Склонения числительных");
["ru", "hy", "en"].forEach(function (lang) {
  const dict = require("../../src/lib/araqs/messages." + lang + ".json");
  if (!dict._plural) fail("словарь " + lang, "объявленное правило _plural", "нет");
  Object.keys(dict).forEach(function (k) {
    const v = dict[k];
    if (k.charAt(0) === "_" || !Array.isArray(v)) return;
    if (v.length < 2)
      fail("словарь " + lang + ", ключ " + k, "минимум 2 формы", v.length);
    // Список форм имеет смысл только там, где есть число, по которому выбирать.
    if (v.every(function (f) { return !/\{(n|reps|min)\}/.test(String(f)); }))
      fail("словарь " + lang + ", ключ " + k, "форму выбирает число {n}", "числа в строке нет");
  });
});
if (E.pickPlural(["один", "два", "много"], {n: 1}, "ru") !== "один")  fail("склонение ru n=1", "один", "?");
if (E.pickPlural(["один", "два", "много"], {n: 3}, "ru") !== "два")   fail("склонение ru n=3", "два", "?");
if (E.pickPlural(["один", "два", "много"], {n: 7}, "ru") !== "много") fail("склонение ru n=7", "много", "?");
if (E.pickPlural(["one", "many"], {n: 1}, "en") !== "one")            fail("склонение en n=1", "one", "?");
if (E.pickPlural(["one", "many"], {n: 5}, "en") !== "many")           fail("склонение en n=5", "many", "?");

console.log(failed === 0
  ? "\nВсё сошлось."
  : "\nРасхождений: " + failed + ". Это значит, что поведение движка изменилось — " +
    "разберитесь в причине, прежде чем править контрольный набор.");
process.exit(failed === 0 ? 0 : 1);
