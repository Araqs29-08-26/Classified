/*!
 * ДВИЖОК ОЦЕНКИ КРАСОТЫ ТЕЛЕФОННЫХ НОМЕРОВ ARAQS — версия 2.0 (07.09.2026)
 *
 * Что делает: по армянскому мобильному номеру определяет узор, статус по
 * восьмиступенчатой шкале, индекс красоты 0-100, диапазон цены продавца,
 * сбор оператора за переоформление и полную стоимость для покупателя.
 *
 * Внешних зависимостей нет. Работает и в браузере, и в Node.
 * Идентичен по логике araqs_number_engine.py — сверено на тысячах номеров,
 * расхождений ноль.
 *
 * ИЗМЕНЕНИЯ В ВЕРСИИ 2.0 (07.09.2026)
 * Движок больше не возвращает готовые фразы. Вместо них — КОДЫ и параметры,
 * а тексты живут на стороне сайта. Так добавление языка не требует правки
 * движка: переводится словарь, логика остаётся одна.
 *     v.statusCode   -> "premium"
 *     v.patternCode  -> "run.5"        v.patternParams -> { digit: "1" }
 *     v.noteCodes    -> [ { code: "note.crossesCode", params: {} }, ... ]
 *     v.feeCode      -> "fee.viva.free"  v.feeParams -> { months: 40, limit: 24 }
 *     v.errorCode    -> "error.multipleNumbers" (когда ok = false)
 * Готовый русский словарь — в отдельном файле araqs-engine-messages-ru.json.
 * Он же образец для перевода: ключи те же, меняются только строки.
 *
 * ИЗМЕНЕНИЯ В ВЕРСИИ 1.2 (07.09.2026)
 * Исправлен дефект разбора букв (несимметричная таблица подмены и молчаливое
 * выбрасывание посторонних букв — «09L 11 11 01» оценивалось как другой номер).
 *
 * Использование:
 *     const v = AraqsNumberEngine.evaluate("+374 91 11 11 01", {
 *         operator: "team",     // "viva" | "team" | "ucom" | null (по коду)
 *         monthsHeld: 40,       // сколько месяцев продавец владеет номером
 *         entity: "individual", // "individual" | "legal"
 *         messages: dict        // необязательно: словарь, чтобы получить и текст
 *     });
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AraqsNumberEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const VERSION = "2.0";

/* ===================== СПРАВОЧНИКИ ===================== */

const STATUS_ORDER = ["Обычный","Бронзовый","Серебряный","Золотой",
                      "Платиновый","Бриллиантовый","Элит","Премиум"];

// Машинный код статуса. Русское название остаётся для совместимости, но на
// сайте для показа нужно брать код и переводить его словарём.
const STATUS_CODE = {
  "Обычный":"plain", "Бронзовый":"bronze", "Серебряный":"silver", "Золотой":"gold",
  "Платиновый":"platinum", "Бриллиантовый":"diamond", "Элит":"elite", "Премиум":"premium"
};

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

// Названия операторов — торговые марки, не переводятся.
const OPERATOR_NAME = { viva:"Viva", team:"Team", ucom:"Ucom" };

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

// ТАБЛИЦА ПОДМЕНЫ БУКВ.
// Продавцы в объявлениях пишут буквы вместо цифр, чтобы обойти поиск:
// «Օ.9.6.З.З.З.З.4.8» вместо «096333348». Здесь только те буквы, которые
// визуально неотличимы от цифры.
//
// ВАЖНО: таблица обязана быть симметричной по регистру. Если заглавная буква
// читается как цифра, то и строчная тоже — начертание от регистра не зависит.
// В версиях до 1.2 симметрии не было, и часть номеров разбиралась неверно.
const HOMOGLYPHS = {
  "O":"0","o":"0",          // латинские
  "О":"0","о":"0",          // кириллические
  "Օ":"0","օ":"0",          // армянские
  "l":"1",                  // латинская строчная L
  "І":"1","і":"1",          // украинская I
  "З":"3","з":"3",
  "Ч":"4","ч":"4",
  "Б":"6","б":"6"
};

// Разделители, которые продавцы ставят внутри номера: 0.9.1-11 11 01
const SEPARATORS = " \u00a0.-–—*()/,`'\"\t";

/* ===================== НОРМАЛИЗАЦИЯ ===================== */

function digitsToWindow(digits){
  if(digits.indexOf("00374") === 0) digits = digits.slice(5);
  else if(digits.indexOf("374") === 0) digits = digits.slice(3);
  else if(digits.charAt(0) === "0" && digits.length === 9) digits = digits.slice(1);
  return digits.length === 8 ? digits : null;
}

/* Разбирает произвольную запись номера. -> { window, reason }
 *
 * Почему не просто «выбросить всё, кроме цифр»: так делалось до версии 1.2,
 * и это давало молчаливо неверный ответ. Например «09L 11 11 01»: буква L
 * выбрасывалась, оставалось ровно 8 цифр «09111101», и движок уверенно
 * оценивал СОВСЕМ ДРУГОЙ номер вместо 091 11 11 01.
 *
 * Теперь номер ищется в непрерывном участке из цифр и разделителей. Любая
 * посторонняя буква разрывает участок. Если подходящий участок один — берём
 * его. Если ни одного или несколько разных — честно говорим, что не поняли. */
function parse(raw){
  if(raw === null || raw === undefined) return { window:null, errorCode:"error.empty", errorParams:{} };
  const s = String(raw).split("").map(function(c){
    return HOMOGLYPHS[c] !== undefined ? HOMOGLYPHS[c] : c;
  }).join("");

  const regions = [];
  let current = "";
  for(let i = 0; i < s.length; i++){
    const ch = s.charAt(i);
    if((ch >= "0" && ch <= "9") || SEPARATORS.indexOf(ch) >= 0) current += ch;
    else { if(current) regions.push(current); current = ""; }
  }
  if(current) regions.push(current);

  const found = [];
  for(let i = 0; i < regions.length; i++){
    const digits = regions[i].replace(/[^0-9]/g, "");
    if(!digits) continue;
    const w = digitsToWindow(digits);
    if(w && found.indexOf(w) < 0) found.push(w);
  }

  if(found.length === 1) return { window:found[0], errorCode:null, errorParams:{} };
  if(found.length === 0) return { window:null, errorCode:"error.notRecognized", errorParams:{} };
  return { window:null, errorCode:"error.multipleNumbers", errorParams:{ numbers:found.join(", ") } };
}

function normalize(raw){ return parse(raw).window; }

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
  // R(статус, код узора, параметры, начало и конец подсветки)
  const R = (status, code, params, a, b) =>
    ({ status:status, patternCode:code, patternParams:params || {}, a:a, b:b });
  const WHOLE_A = 2, WHOLE_B = 7;

  // --- Премиум ---
  if(d.run >= 6) return R("Премиум", "run.6plus", {n:d.run, digit:rd}, d.run_a, d.run_b);
  if(d.run === 5) return R("Премиум", "run.5", {digit:rd}, d.run_a, d.run_b);
  if(d.seq >= 6) return R("Премиум", "seq.6", {n:d.seq, text:d.seq_text}, d.seq_a, d.seq_b);
  if(d.block_k === 2 && d.block_r >= 3) return R("Премиум", "block.pair.x3", {block:d.block_text, reps:d.block_r}, d.block_a, d.block_b);
  if(d.zeros_tail >= 4) return R("Премиум", "zeros.tail.4plus", {n:d.zeros_tail}, d.zt_a, d.zt_b);

  // --- Элит ---
  if(d.pal >= 6) return R("Элит", "pal.6", {n:d.pal, text:d.pal_text}, d.pal_a, d.pal_b);
  if(d.block_k >= 4 && d.block_r >= 2) return R("Элит", "block.k4.x2", {block:d.block_text}, d.block_a, d.block_b);
  if(d.run === 4 && d.run_at_end && "019".indexOf(rd) >= 0) return R("Элит", "run.4.end.lucky", {digit:rd}, d.run_a, d.run_b);

  // --- Бриллиантовый ---
  if(d.run === 4 && d.run_at_end) return R("Бриллиантовый", "run.4.end", {digit:rd}, d.run_a, d.run_b);
  if(d.run === 4 && d.run_crosses) return R("Бриллиантовый", "run.4.cross", {digit:rd}, d.run_a, d.run_b);
  if(d.zeros_tail === 3 && d.distinct <= 3) return R("Бриллиантовый", "zeros.tail.3.clean", {}, d.zt_a, d.zt_b);
  if(d.block_k === 3 && d.block_r >= 2 && d.distinct <= 2)
    return R("Бриллиантовый", "block.triple.x2.clean", {block:d.block_text, distinct:d.distinct}, d.block_a, d.block_b);

  // --- Платиновый ---
  if(d.run === 4) return R("Платиновый", "run.4", {digit:rd}, d.run_a, d.run_b);
  if(d.pairs >= 3) return R("Платиновый", "pairs.3", {}, d.pairs_a, d.pairs_b);
  if(d.block_k === 3 && d.block_r >= 2) return R("Платиновый", "block.triple.x2", {block:d.block_text}, d.block_a, d.block_b);
  if(d.seq === 5) return R("Платиновый", "seq.5", {text:d.seq_text}, d.seq_a, d.seq_b);
  if(d.zeros_tail === 3) return R("Платиновый", "zeros.tail.3", {}, d.zt_a, d.zt_b);

  // --- Золотой ---
  if(d.block_k === 2 && d.block_r === 2) return R("Золотой", "block.pair.x2", {block:d.block_text}, d.block_a, d.block_b);
  if(d.run === 3 && (d.run_at_end || d.run_crosses)) return R("Золотой", "run.3.strong", {digit:rd}, d.run_a, d.run_b);
  if(d.distinct <= 2) return R("Золотой", "distinct.le2", {distinct:d.distinct}, WHOLE_A, WHOLE_B);
  if(d.seq === 4) return R("Золотой", "seq.4", {text:d.seq_text}, d.seq_a, d.seq_b);
  if(d.pal === 5) return R("Золотой", "pal.5", {text:d.pal_text}, d.pal_a, d.pal_b);

  // --- Серебряный ---
  if(d.run === 3) return R("Серебряный", "run.3", {digit:rd}, d.run_a, d.run_b);
  if(d.pairs === 2) return R("Серебряный", "pairs.2", {}, d.pairs_a, d.pairs_b);
  if(d.distinct === 3) return R("Серебряный", "distinct.3", {}, WHOLE_A, WHOLE_B);
  if(d.pal === 4) return R("Серебряный", "pal.4", {text:d.pal_text}, d.pal_a, d.pal_b);

  // --- Бронзовый ---
  if(d.zeros_tail === 2) return R("Бронзовый", "zeros.tail.2", {}, d.zt_a, d.zt_b);
  if(d.run === 2 && d.run_at_end) return R("Бронзовый", "run.2.end", {digit:rd}, d.run_a, d.run_b);
  if(d.distinct === 4) return R("Бронзовый", "distinct.4", {}, WHOLE_A, WHOLE_B);
  if(d.seq === 3) return R("Бронзовый", "seq.3", {text:d.seq_text}, d.seq_a, d.seq_b);
  if(d.run === 2) return R("Бронзовый", "run.2", {digit:rd}, d.run_a, d.run_b);

  return R("Обычный", "none", {}, -1, -1);
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
  const F = (amount, code, params) => ({ amount:amount, code:code, params:params || {} });

  if(status === "Обычный") return F(0, "fee.plain", {});

  if(op === "viva"){
    const limit = VIVA_FREE_AFTER_MONTHS[entity] || VIVA_FREE_AFTER_MONTHS.individual;
    if(monthsHeld === null || monthsHeld === undefined)
      return F(VIVA_FIXED + price, "fee.viva.unknownMonths", {fixed:VIVA_FIXED, limit:limit});
    if(monthsHeld >= limit)
      return F(VIVA_FIXED, "fee.viva.free", {fixed:VIVA_FIXED, months:monthsHeld, limit:limit});
    return F(VIVA_FIXED + price, "fee.viva.pending",
             {fixed:VIVA_FIXED, months:monthsHeld, limit:limit, remaining:limit - monthsHeld});
  }
  if(op === "team") return F(TEAM_FIXED + price, "fee.team", {fixed:TEAM_FIXED});
  if(op === "ucom"){
    if(UCOM_FLAT_STATUSES.has(status)) return F(UCOM_FLAT_FEE, "fee.ucom.flat", {flat:UCOM_FLAT_FEE});
    return F(Math.round(price * UCOM_SHARE), "fee.ucom.half", {share:UCOM_SHARE});
  }
  return F(price, "fee.unknownOperator", {});
}

/* ===================== СЛОВАРЬ И ПОДСТАНОВКА =====================
   Движок текстов не содержит. Словарь передаётся снаружи: объект вида
   { "run.5": "пять цифр {digit} подряд", ... }. Подстановка — по {имени}. */

function fill(template, params){
  return String(template).replace(/\{(\w+)\}/g, function(m, key){
    return (params && params[key] !== undefined) ? String(params[key]) : m;
  });
}

/* Превращает коды вердикта в текст по словарю. Если ключа нет — возвращает
   сам код, чтобы пропажа перевода была видна, а не молча пустая строка. */
function localize(v, messages){
  if(!v || !messages) return v;
  const get = (code, params) => (messages[code] !== undefined ? fill(messages[code], params) : code);
  if(!v.ok){ v.error = get(v.errorCode, v.errorParams); v.notes = [v.error]; return v; }
  v.statusName = get("status." + v.statusCode, {});
  v.pattern = get(v.patternCode, v.patternParams);
  v.feeNote = get(v.feeCode, v.feeParams);
  v.notes = v.noteCodes.map(function(n){ return get(n.code, n.params); });
  return v;
}

/* ===================== ГЛАВНАЯ ФУНКЦИЯ ===================== */

function evaluate(raw, options){
  options = options || {};
  const parsed = parse(raw);
  const w = parsed.window;
  if(!w) return localize({ ok:false, version:VERSION, raw:String(raw === undefined ? "" : raw),
                           errorCode:parsed.errorCode, errorParams:parsed.errorParams,
                           noteCodes:[], notes:[] }, options.messages);

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

  // Пояснения тоже кодами: сайт переводит их своим словарём.
  const noteCodes = [];
  const note = (code, params) => noteCodes.push({ code:code, params:params || {} });
  if(d.run_crosses || d.block_crosses) note("note.crossesCode");
  if(d.distinct <= 2) note("note.clean", {distinct:d.distinct});
  if(d.run_at_end && d.run >= 3) note("note.endsLast");
  if(operatorFromCode) note("note.operatorFromCode", {operator:OPERATOR_NAME[operator] || operator});
  if(operator === "viva" && monthsHeld === null && c.status !== "Обычный")
    note("note.askMonthsHeld", {limit:VIVA_FREE_AFTER_MONTHS[entity] || 24});
  const rawStr = String(raw);
  for(let i = 0; i < rawStr.length; i++){
    if(HOMOGLYPHS[rawStr.charAt(i)] !== undefined){ note("note.homoglyphs"); break; }
  }
  if(LANDLINE_CODES.has(code)) note("note.landline");
  if(c.status === "Обычный") note("note.notPublishable");

  return localize({
    ok:true, version:VERSION, raw:String(raw), window:w, code:code, body:body,
    status:c.status, statusCode:STATUS_CODE[c.status],
    sublevel:sublevel, index:index, indexRange:INDEX_RANGE[c.status],
    patternCode:c.patternCode, patternParams:c.patternParams,
    patternFrom:c.a, patternTo:c.b,
    operator:operator, operatorFromCode:operatorFromCode,
    monthsHeld:monthsHeld, entity:entity,
    sellerMin:band[0], sellerTypical:band[1], sellerMax:band[2],
    transferFee:fee.amount, feeCode:fee.code, feeParams:fee.params,
    totalMin:band[0] + fee.amount, totalTypical:band[1] + fee.amount, totalMax:band[2] + fee.amount,
    publishable:c.status !== "Обычный",
    noteCodes:noteCodes, notes:[]
  }, options.messages);
}

function money(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ֏"; }

/* Готовый текст. Работает только если вердикт уже локализован словарём
   (передайте messages в evaluate) — иначе вернутся коды, и это заметно. */
function explain(v){
  if(!v || !v.ok) return v && v.error ? v.error : (v && v.errorCode) || "";
  let head = "0" + v.code + " " + v.body + "  →  " + (v.statusName || v.status);
  if(v.sublevel) head += " (" + v.sublevel + ")";
  head += ",  " + v.index + "/100";
  const lines = [head, "", v.pattern || v.patternCode].concat(v.notes || []);
  if(v.publishable){
    lines.push("",
      money(v.sellerMin) + " – " + money(v.sellerMax) + " (" + money(v.sellerTypical) + ")",
      money(v.transferFee) + "  " + (v.feeNote || v.feeCode),
      money(v.totalMin) + " – " + money(v.totalMax));
  }
  return lines.join("\n");
}

return {
  VERSION: VERSION,
  STATUS_ORDER: STATUS_ORDER,
  STATUS_CODE: STATUS_CODE,
  OPERATOR_NAME: OPERATOR_NAME,
  OPERATOR_PRICES: OPERATOR_PRICES,
  CODE_OPERATOR_HINT: CODE_OPERATOR_HINT,
  SELLER_BANDS: SELLER_BANDS,
  PREMIUM_SUBLEVELS: PREMIUM_SUBLEVELS,
  INDEX_RANGE: INDEX_RANGE,
  parse: parse,
  normalize: normalize,
  analyze: analyze,
  classify: classify,
  beautyIndex: beautyIndex,
  transferFee: transferFee,
  evaluate: evaluate,
  localize: localize,
  fill: fill,
  explain: explain,
  money: money
};
});
