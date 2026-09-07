/*!
 * ДВИЖОК ОЦЕНКИ КРАСОТЫ ТЕЛЕФОННЫХ НОМЕРОВ ARAQS — версия 1.1 (06.09.2026)
 *
 * Что делает: по армянскому мобильному номеру определяет узор, статус по
 * восьмиступенчатой шкале, индекс красоты 0-100, диапазон цены продавца,
 * сбор оператора за переоформление и полную стоимость для покупателя.
 *
 * Внешних зависимостей нет. Работает и в браузере, и в Node.
 * Идентичен по логике araqs_number_engine.py — сверено на 383 номерах,
 * расхождений ноль.
 *
 * Использование:
 *     const v = AraqsNumberEngine.evaluate("+374 91 11 11 01", {
 *         operator: "team",     // "viva" | "team" | "ucom" | null (по коду)
 *         monthsHeld: 40,       // сколько месяцев продавец владеет номером
 *         entity: "individual"  // "individual" | "legal"
 *     });
 *     v.status  -> "Премиум"
 *     v.totalMax -> 25350700
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AraqsNumberEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const VERSION = "1.1";

/* ===================== СПРАВОЧНИКИ ===================== */

const STATUS_ORDER = ["Обычный","Бронзовый","Серебряный","Золотой",
                      "Платиновый","Бриллиантовый","Элит","Премиум"];

// Прайсы операторов за подключение нового номера соответствующей категории.
// Проверено на viva.am, telecomarmenia.am, ucom.am 05-06.09.2026.
// У Team 6 категорий, у Ucom 5 — наши Элит и Премиум ложатся на верхнюю.
const OPERATOR_PRICES = {
  viva:{"Обычный":0,"Бронзовый":9000,"Серебряный":25000,"Золотой":65000,
        "Платиновый":200000,"Бриллиантовый":450000,"Элит":650000,"Премиум":1100000},
  team:{"Обычный":0,"Бронзовый":8000,"Серебряный":20000,"Золотой":60000,
        "Платиновый":140000,"Бриллиантовый":350000,"Элит":350000,"Премиум":350000},
  ucom:{"Обычный":0,"Бронзовый":8000,"Серебряный":20000,"Золотой":60000,
        "Платиновый":150000,"Бриллиантовый":400000,"Элит":400000,"Премиум":400000}
};

// Подсказка по коду. ВАЖНО: в Армении работает переносимость номера,
// поэтому код НЕ гарантирует оператора — спрашивайте у продавца.
const CODE_OPERATOR_HINT = {
  "33":"team","43":"team","91":"team","96":"team","99":"team",
  "77":"viva","93":"viva","94":"viva","97":"viva","98":"viva",
  "41":"ucom","44":"ucom","55":"ucom","95":"ucom"
};
const LANDLINE_CODES = new Set(["10","11","12"]);

// Правила переоформления (անվանափոխություն), источники операторов, 06.09.2026.
const VIVA_FIXED = 500, TEAM_FIXED = 700;
const VIVA_FREE_AFTER_MONTHS = { individual: 24, legal: 6 };
const UCOM_FLAT_STATUSES = new Set(["Бронзовый","Серебряный"]);
const UCOM_FLAT_FEE = 1000, UCOM_SHARE = 0.5;

// Диапазоны цены продавца: 25-й и 75-й процентили внутри статуса
// по 385 объявлениям list.am (05.09.2026), сглаженные до монотонных.
const SELLER_BANDS = {
  "Обычный":[0,0,0], "Бронзовый":[15000,25000,40000], "Серебряный":[25000,50000,90000],
  "Золотой":[50000,95000,190000], "Платиновый":[100000,200000,500000],
  "Бриллиантовый":[250000,400000,800000], "Элит":[600000,1000000,1800000],
  "Премиум":[1100000,1500000,2500000]
};
const PREMIUM_SUBLEVELS = {
  P1:[1100000,1500000,2500000], P2:[2000000,3000000,6000000], P3:[4000000,8000000,25000000]
};
const INDEX_BASE = {"Обычный":3,"Бронзовый":15,"Серебряный":30,"Золотой":45,
                    "Платиновый":60,"Бриллиантовый":72,"Элит":82,"Премиум":90};
const INDEX_TOP  = {"Обычный":9,"Бронзовый":24,"Серебряный":39,"Золотой":54,
                    "Платиновый":69,"Бриллиантовый":79,"Элит":89,"Премиум":100};
const INDEX_RANGE = {"Обычный":"0–9","Бронзовый":"15–24","Серебряный":"30–39","Золотой":"45–54",
                     "Платиновый":"60–69","Бриллиантовый":"72–79","Элит":"82–89","Премиум":"90–100"};

const HOMOGLYPHS = {"О":"0","о":"0","O":"0","o":"0","Օ":"0",
                    "З":"3","з":"3","б":"6","Ч":"4","І":"1","l":"1"};

/* ===================== НОРМАЛИЗАЦИЯ ===================== */

function normalize(raw){
  if(raw === null || raw === undefined) return null;
  let s = String(raw).split("").map(c => HOMOGLYPHS[c] !== undefined ? HOMOGLYPHS[c] : c).join("");
  s = s.replace(/[^0-9]/g,"");
  if(s.indexOf("00374") === 0) s = s.slice(5);
  else if(s.indexOf("374") === 0) s = s.slice(3);
  else if(s.charAt(0) === "0" && s.length === 9) s = s.slice(1);
  return s.length === 8 ? s : null;
}

/* ===================== ПОИСК УЗОРОВ ===================== */
/* Все примитивы считаются на 8-значном окне: код (2) + тело (6).
   Узор, целиком лежащий внутри кода оператора, не засчитывается — он
   достаётся бесплатно всем абонентам этого кода, а рынок платит за редкость. */

function runsOf(s){
  const out = []; let i = 0;
  while(i < s.length){
    let j = i;
    while(j + 1 < s.length && s.charAt(j+1) === s.charAt(i)) j++;
    out.push([s.charAt(i), i, j]); i = j + 1;
  }
  return out;
}

function bestRun(w){
  let best = [0, null, -1, -1];
  const rs = runsOf(w);
  for(let n = 0; n < rs.length; n++){
    const d = rs[n][0], a = rs[n][1], b = rs[n][2];
    if(b < 2) continue;
    if(b - a + 1 > best[0]) best = [b - a + 1, d, a, b];
  }
  return best;
}

function bestBlock(w){
  const n = w.length; let best = [0,0,-1,-1], span = 0;
  for(let k = 2; k <= Math.floor(n/2); k++){
    for(let a = 0; a + 2*k <= n; a++){
      if(w.slice(a, a+k) !== w.slice(a+k, a+2*k)) continue;
      let r = 2, j = a + 2*k;
      while(j + k <= n && w.slice(j, j+k) === w.slice(a, a+k)){ r++; j += k; }
      const b = a + k*r - 1;
      if(b < 2) continue;
      if(k*r > span){ best = [k, r, a, b]; span = k*r; }
    }
  }
  return best;
}

function bestSeq(w){
  let best = [0,-1,-1];
  const steps = [1,-1];
  for(let si = 0; si < 2; si++){
    const step = steps[si]; let a = 0;
    while(a < w.length){
      let b = a;
      while(b + 1 < w.length &&
            ((((+w.charAt(b+1)) - (+w.charAt(b))) % 10) + 10) % 10 === ((step % 10) + 10) % 10) b++;
      if(b - a + 1 > best[0] && b >= 2) best = [b - a + 1, a, b];
      a = b > a ? b + 1 : a + 1;
    }
  }
  return best;
}

function longestPalindrome(w, minLen){
  minLen = minLen || 4;
  let best = [0,-1,-1];
  for(let a = 0; a < w.length; a++){
    for(let b = a + minLen - 1; b < w.length; b++){
      const part = w.slice(a, b+1);
      if(part === part.split("").reverse().join("") &&
         new Set(part.split("")).size > 1 && b >= 2 && (b - a + 1) > best[0])
        best = [b - a + 1, a, b];
    }
  }
  return best;
}

function pairChain(w){
  let best = [0,-1,-1];
  for(let a = 0; a < w.length - 1; a++){
    let cnt = 0, j = a;
    while(j + 1 < w.length && w.charAt(j) === w.charAt(j+1)){ cnt++; j += 2; }
    if(cnt >= 2 && a + 2*cnt - 1 >= 2 && cnt > best[0]) best = [cnt, a, a + 2*cnt - 1];
  }
  return best;
}

function zerosTail(w){ return w.length - w.replace(/0+$/,"").length; }

function analyze(w){
  const r = bestRun(w), bl = bestBlock(w), sq = bestSeq(w),
        pl = longestPalindrome(w), pc = pairChain(w);
  const last = w.length - 1, zt = zerosTail(w);
  return {
    run:r[0], run_digit:r[1], run_a:r[2], run_b:r[3],
    run_crosses:(r[2] < 2 && r[3] >= 2), run_at_end:(r[3] === last),
    block_k:bl[0], block_r:bl[1], block_a:bl[2], block_b:bl[3],
    block_crosses:(bl[2] < 2 && bl[3] >= 2), block_text: bl[0] ? w.slice(bl[2], bl[2]+bl[0]) : "",
    seq:sq[0], seq_a:sq[1], seq_b:sq[2], seq_text: sq[0] ? w.slice(sq[1], sq[2]+1) : "",
    pal:pl[0], pal_a:pl[1], pal_b:pl[2], pal_text: pl[0] ? w.slice(pl[1], pl[2]+1) : "",
    pairs:pc[0], pairs_a:pc[1], pairs_b:pc[2],
    zeros_tail:zt, zt_a:last - zt + 1, zt_b:last,
    distinct:new Set(w.slice(2).split("")).size, last:last
  };
}

/* ===================== ПРАВИЛА «УЗОР → СТАТУС» =====================
   Проверяются сверху вниз, срабатывает первое подходящее.
   Полный разбор с обоснованием каждого правила — в спецификации, раздел 3. */

function classify(w, d){
  const rd = d.run_digit;
  const R = (status, pattern, a, b) => ({status:status, pattern:pattern, a:a, b:b});
  const WHOLE_A = 2, WHOLE_B = 7;

  // --- Премиум ---
  if(d.run >= 6) return R("Премиум", d.run + " одинаковых цифр подряд (" + new Array(d.run+1).join(rd) + ")", d.run_a, d.run_b);
  if(d.run === 5) return R("Премиум", "пять цифр " + rd + " подряд", d.run_a, d.run_b);
  if(d.seq >= 6) return R("Премиум", "полная последовательность из " + d.seq + " цифр (" + d.seq_text + ")", d.seq_a, d.seq_b);
  if(d.block_k === 2 && d.block_r >= 3) return R("Премиум", "пара «" + d.block_text + "» повторена " + d.block_r + " раза подряд", d.block_a, d.block_b);
  if(d.zeros_tail >= 4) return R("Премиум", d.zeros_tail + " нуля в конце номера", d.zt_a, d.zt_b);

  // --- Элит ---
  if(d.pal >= 6) return R("Элит", "зеркальный участок из " + d.pal + " цифр («" + d.pal_text + "»)", d.pal_a, d.pal_b);
  if(d.block_k >= 4 && d.block_r >= 2) return R("Элит", "блок «" + d.block_text + "» повторён дважды", d.block_a, d.block_b);
  if(d.run === 4 && d.run_at_end && "019".indexOf(rd) >= 0) return R("Элит", "четыре цифры " + rd + " подряд в самом конце номера", d.run_a, d.run_b);

  // --- Бриллиантовый ---
  if(d.run === 4 && (d.run_at_end || d.run_crosses))
    return R("Бриллиантовый", "четыре цифры " + rd + " подряд " + (d.run_at_end ? "в конце номера" : "с продолжением в код оператора"), d.run_a, d.run_b);
  if(d.zeros_tail === 3 && d.distinct <= 3) return R("Бриллиантовый", "три нуля в конце при малом числе разных цифр", d.zt_a, d.zt_b);
  if(d.block_k === 3 && d.block_r >= 2 && d.distinct <= 2)
    return R("Бриллиантовый", "тройка «" + d.block_text + "» повторена дважды, номер всего из " + d.distinct + " цифр", d.block_a, d.block_b);

  // --- Платиновый ---
  if(d.run === 4) return R("Платиновый", "четыре цифры " + rd + " подряд", d.run_a, d.run_b);
  if(d.pairs >= 3) return R("Платиновый", "три пары одинаковых цифр подряд", d.pairs_a, d.pairs_b);
  if(d.block_k === 3 && d.block_r >= 2) return R("Платиновый", "тройка «" + d.block_text + "» повторена дважды", d.block_a, d.block_b);
  if(d.seq === 5) return R("Платиновый", "последовательность из пяти цифр (" + d.seq_text + ")", d.seq_a, d.seq_b);
  if(d.zeros_tail === 3) return R("Платиновый", "три нуля в конце номера", d.zt_a, d.zt_b);

  // --- Золотой ---
  if(d.block_k === 2 && d.block_r === 2) return R("Золотой", "пара «" + d.block_text + "» повторена дважды", d.block_a, d.block_b);
  if(d.run === 3 && (d.run_at_end || d.run_crosses)) return R("Золотой", "три цифры " + rd + " подряд в сильной позиции", d.run_a, d.run_b);
  if(d.distinct <= 2) return R("Золотой", "весь номер состоит всего из " + d.distinct + " разных цифр", WHOLE_A, WHOLE_B);
  if(d.seq === 4) return R("Золотой", "последовательность из четырёх цифр (" + d.seq_text + ")", d.seq_a, d.seq_b);
  if(d.pal === 5) return R("Золотой", "зеркальный участок из 5 цифр («" + d.pal_text + "»)", d.pal_a, d.pal_b);

  // --- Серебряный ---
  if(d.run === 3) return R("Серебряный", "три цифры " + rd + " подряд", d.run_a, d.run_b);
  if(d.pairs === 2) return R("Серебряный", "две пары одинаковых цифр подряд", d.pairs_a, d.pairs_b);
  if(d.distinct === 3) return R("Серебряный", "номер состоит всего из 3 разных цифр", WHOLE_A, WHOLE_B);
  if(d.pal === 4) return R("Серебряный", "зеркальный участок из 4 цифр («" + d.pal_text + "»)", d.pal_a, d.pal_b);

  // --- Бронзовый ---
  if(d.zeros_tail === 2) return R("Бронзовый", "два нуля в конце номера", d.zt_a, d.zt_b);
  if(d.run === 2 && d.run_at_end) return R("Бронзовый", "пара " + rd + rd + " в конце номера", d.run_a, d.run_b);
  if(d.distinct === 4) return R("Бронзовый", "номер состоит из 4 разных цифр", WHOLE_A, WHOLE_B);
  if(d.seq === 3) return R("Бронзовый", "три цифры подряд по порядку (" + d.seq_text + ")", d.seq_a, d.seq_b);
  if(d.run === 2) return R("Бронзовый", "пара " + rd + rd + " в номере", d.run_a, d.run_b);

  return R("Обычный", "выраженного узора не найдено", -1, -1);
}

function beautyIndex(status, d){
  let s = INDEX_BASE[status];
  if(d.run_crosses || d.block_crosses) s += 3;
  if(d.distinct <= 2) s += 3; else if(d.distinct === 3) s += 1;
  if(d.run >= 5) s += (d.run - 5) * 4;
  if((d.run_digit === "0" || d.run_digit === "1" || d.run_digit === "9") && d.run >= 4) s += 2;
  if(d.zeros_tail >= 4) s += 2;
  if(d.run_at_end && d.run >= 3) s += 1;
  return Math.max(0, Math.min(INDEX_TOP[status], s));
}

/* ===================== СБОР ЗА ПЕРЕОФОРМЛЕНИЕ =====================
   Viva  — 500 ֏ фиксированно; стоимость категории НЕ взимается, если номер
           был в пользовании не менее 24 месяцев (для юрлиц — 6 месяцев).
   Team  — 700 ֏ плюс ПОЛНАЯ текущая стоимость категории, послаблений нет.
   Ucom  — Золото/Платина/Бриллиант: 50% стоимости. Серебро и Бронза: 1 000 ֏. */

function transferFee(operator, status, monthsHeld, entity){
  const op = String(operator || "viva").toLowerCase();
  const table = OPERATOR_PRICES[op] || OPERATOR_PRICES.viva;
  const price = table[status] || 0;

  if(status === "Обычный") return { amount:0, note:"номер без узора — категорийная плата не взимается" };

  if(op === "viva"){
    const limit = VIVA_FREE_AFTER_MONTHS[entity] || VIVA_FREE_AFTER_MONTHS.individual;
    if(monthsHeld === null || monthsHeld === undefined)
      return { amount: VIVA_FIXED + price,
        note:"Viva: 500 ֏ плюс стоимость категории. Если продавец владеет номером дольше " + limit +
             " мес., категорийная плата не взимается и сбор составит всего 500 ֏ — уточните срок владения." };
    if(monthsHeld >= limit)
      return { amount: VIVA_FIXED,
        note:"Viva: номер в пользовании " + monthsHeld + " мес. — это дольше " + limit +
             " мес., поэтому платятся только фиксированные 500 ֏." };
    return { amount: VIVA_FIXED + price,
      note:"Viva: номер в пользовании " + monthsHeld + " мес., до льготы осталось " + (limit - monthsHeld) +
           " мес. — платятся 500 ֏ плюс стоимость категории." };
  }
  if(op === "team")
    return { amount: TEAM_FIXED + price, note:"Team: 700 ֏ плюс полная стоимость категории, послаблений нет." };
  if(op === "ucom"){
    if(UCOM_FLAT_STATUSES.has(status))
      return { amount: UCOM_FLAT_FEE, note:"Ucom: для Серебра и Бронзы — фиксированные 1 000 ֏." };
    return { amount: Math.round(price * UCOM_SHARE), note:"Ucom: половина стоимости категории." };
  }
  return { amount: price, note:"оператор неизвестен, взята оценка по прайсу Viva" };
}

/* ===================== ГЛАВНАЯ ФУНКЦИЯ ===================== */

function evaluate(raw, options){
  options = options || {};
  const w = normalize(raw);
  if(!w) return { ok:false, raw:String(raw === undefined ? "" : raw), notes:["Номер не распознан."] };

  const code = w.slice(0,2), body = w.slice(2);
  const d = analyze(w);
  const c = classify(w, d);
  const index = beautyIndex(c.status, d);

  let sublevel = null;
  if(c.status === "Премиум") sublevel = index >= 97 ? "P3" : (index >= 93 ? "P2" : "P1");

  const explicitOperator = options.operator && options.operator !== "auto" ? String(options.operator).toLowerCase() : null;
  const operator = explicitOperator && OPERATOR_PRICES[explicitOperator]
    ? explicitOperator : (CODE_OPERATOR_HINT[code] || "viva");
  const operatorFromCode = !explicitOperator;

  const monthsHeld = (options.monthsHeld === undefined || options.monthsHeld === null ||
                      options.monthsHeld === "") ? null : Number(options.monthsHeld);
  const entity = options.entity === "legal" ? "legal" : "individual";

  const band = sublevel ? PREMIUM_SUBLEVELS[sublevel] : SELLER_BANDS[c.status];
  const fee = transferFee(operator, c.status, monthsHeld, entity);

  const notes = [];
  if(d.run_crosses || d.block_crosses)
    notes.push("Узор продолжается в код оператора — такие номера встречаются реже и ценятся выше.");
  if(d.distinct <= 2) notes.push("В номере всего " + d.distinct + " разные цифры — очень чистый узор.");
  if(d.run_at_end && d.run >= 3) notes.push("Узор заканчивается последней цифрой номера — так он лучше запоминается.");
  if(operatorFromCode)
    notes.push("Оператор определён по коду (" + operator.charAt(0).toUpperCase() + operator.slice(1) +
               ") — уточните у продавца, номер мог быть перенесён.");
  if(operator === "viva" && monthsHeld === null && c.status !== "Обычный")
    notes.push("Спросите у продавца, как давно он владеет номером: у Viva после 24 месяцев переоформление стоит 500 ֏ вместо полной стоимости категории.");
  if(LANDLINE_CODES.has(code))
    notes.push("Это городской номер. Шкала рассчитана на мобильные, оценка ориентировочная.");
  if(c.status === "Обычный")
    notes.push("Узор не найден — такой номер на сайте не публикуется.");

  return {
    ok:true, version:VERSION, raw:String(raw), window:w, code:code, body:body,
    status:c.status, sublevel:sublevel, index:index, indexRange:INDEX_RANGE[c.status],
    pattern:c.pattern, patternFrom:c.a, patternTo:c.b,
    operator:operator, operatorFromCode:operatorFromCode,
    monthsHeld:monthsHeld, entity:entity,
    sellerMin:band[0], sellerTypical:band[1], sellerMax:band[2],
    transferFee:fee.amount, feeNote:fee.note,
    totalMin:band[0] + fee.amount, totalTypical:band[1] + fee.amount, totalMax:band[2] + fee.amount,
    publishable:c.status !== "Обычный",
    notes:notes
  };
}

function money(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ֏"; }

function explain(v){
  if(!v || !v.ok) return "Номер не распознан.";
  let head = "0" + v.code + " " + v.body + "  →  " + v.status;
  if(v.sublevel) head += " (" + v.sublevel + ")";
  head += ",  индекс красоты " + v.index + "/100";
  const lines = [head, "", "Узор: " + v.pattern + "."].concat(v.notes);
  if(v.publishable){
    lines.push("",
      "Цена продавца: " + money(v.sellerMin) + " – " + money(v.sellerMax) + " (типично " + money(v.sellerTypical) + ")",
      "Сбор за переоформление (" + v.operator + ", " + v.status + "): " + money(v.transferFee),
      "   " + v.feeNote,
      "Полная стоимость для покупателя: " + money(v.totalMin) + " – " + money(v.totalMax));
  }
  return lines.join("\n");
}

return {
  VERSION: VERSION,
  STATUS_ORDER: STATUS_ORDER,
  OPERATOR_PRICES: OPERATOR_PRICES,
  CODE_OPERATOR_HINT: CODE_OPERATOR_HINT,
  SELLER_BANDS: SELLER_BANDS,
  PREMIUM_SUBLEVELS: PREMIUM_SUBLEVELS,
  INDEX_RANGE: INDEX_RANGE,
  normalize: normalize,
  analyze: analyze,
  classify: classify,
  beautyIndex: beautyIndex,
  transferFee: transferFee,
  evaluate: evaluate,
  explain: explain,
  money: money
};
});
