/**
 * Контрольный лист из пакета, проверенный машиной.
 *
 * Руками эти таблицы сверять долго и легко ошибиться, а числа в них взяты из
 * самого движка — значит, сверку можно провести кодом и увидеть расхождения
 * сразу, а не по одному.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ARAQS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "src", "lib", "araqs"
);
const E = require(path.join(ARAQS, "araqs-number-engine.js"));
const S = require(path.join(ARAQS, "araqs-number-search.js"));
const ru = require(path.join(ARAQS, "messages.ru.json"));

let bad = 0;
const check = (what, got, want) => {
  const ok = String(got) === String(want);
  if (!ok) { bad++; console.log("  РАСХОЖДЕНИЕ", what, "— получено", got, "ожидалось", want); }
  return ok;
};

console.log("1. Оценка номера");
const CASES = [
  ["+374 41 10 90 90", "ucom", "Золотой", 53, 50000, 380000, 30000],
  ["+374 93 90 99 77", "viva", "Серебряный", 31, 20000, 100000, 500, true],
  ["+374 44 84 14 14", "ucom", "Золотой", 52, 50000, 380000, 30000],
  ["+374 11 22 07 44", "viva", "Серебряный", 30, 20000, 100000, 25500],
  ["+374 98 90 12 34", "viva", "Платиновый", 60, 50000, 500000, 200500],
  ["+374 77 10 98 76", "viva", "Золотой", 45, 50000, 380000, 65500],
  ["+374 41 23 45 67", "ucom", "Премиум", 90, 700000, 2500000, 200000],
  ["+374 44 55 66 77", "ucom", "Премиум", 91, 700000, 2500000, 200000],
  ["+374 91 47 82 63", "team", "Обычный", 3, 0, 0, 0],
];
for (const [num, op, status, ix, pMin, pMax, fee, held = false] of CASES) {
  const v = E.evaluate(num, { operator: op, heldOverLimit: held, messages: ru });
  if (!v.ok) { bad++; console.log("  не разобран:", num); continue; }
  check(num + " статус", v.status, status);
  check(num + " индекс", v.index, ix);
  check(num + " цена от", v.priceMin, pMin);
  check(num + " цена до", v.priceMax, pMax);
  check(num + " сбор", v.transferFee, fee);
  check(num + " продавцу макс", v.sellerGetsMax, Math.max(0, pMax - fee));
}
const broken = E.evaluate("09L 11 11 01", { messages: ru });
check("«09L 11 11 01» не распознан", broken.ok, false);

console.log("2. Цена не зависит от оператора");
for (const num of ["+374 41 10 90 90", "+374 44 84 14 14"]) {
  const prices = ["viva", "team", "ucom"].map((op) => {
    const v = E.evaluate(num, { operator: op, heldOverLimit: false, messages: ru });
    return v.priceMin + "–" + v.priceMax;
  });
  check(num + " одинаковая цена у трёх операторов", new Set(prices).size, 1);
  const fees = ["viva", "team", "ucom"].map(
    (op) => E.evaluate(num, { operator: op, heldOverLimit: false, messages: ru }).transferFee
  );
  check(num + " сборы Viva/Team/Ucom", fees.join(","), "65500,60700,30000");
}
const vivaLong = E.evaluate("+374 41 10 90 90", {
  operator: "viva", heldOverLimit: true, messages: ru,
});
check("Viva дольше двух лет — сбор", vivaLong.transferFee, 500);

console.log("3. Поиск");
const q5x5 = S.parseQuery("5x5");
check("«5x5» — счётчик, а не маска", JSON.stringify(q5x5.counts), '[{"digit":"5","min":5}]');
check("«5x5» без маски", q5x5.mask, null);
const q5m5 = S.parseQuery("5*5");
check("«5*5» — маска", q5m5.mask, "5?5");
check("«5*5» без счётчика", q5m5.counts.length, 0);
const qDots = S.parseQuery("096.33.33.48");
check("«096.33.33.48» — маска по всему окну", qDots.mask, "96333348");
const qBad = S.parseQuery("абв");
check("«абв» — понятная ошибка", qBad.error, "search.badChars");
const qEmpty = S.parseQuery("");
check("пустой запрос — код «пусто»", qEmpty.error, "search.empty");

console.log("Корзины цены: у последней потолка нет");
const last = S.PRICE_BUCKETS[S.PRICE_BUCKETS.length - 1];
check("последняя корзина", last.max, null);

console.log("Виды узора: девять кнопок");
check("видов узора", S.FAMILIES.length, 9);

console.log(bad === 0 ? "\nВсё сошлось." : "\nРасхождений: " + bad);
process.exit(bad === 0 ? 0 : 1);
