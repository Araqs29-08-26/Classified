/*!
 * ДВИЖОК ОЦЕНКИ КРАСОТЫ ТЕЛЕФОННЫХ НОМЕРОВ ARAQS — версия 3.1 (08.09.2026)
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
 *         heldOverLimit: true,  // владеет ли номером дольше двух лет (Viva)
 *         monthsHeld: 40,       // устаревшее: точное число месяцев
 *         entity: "individual", // "individual" | "legal"
 *         messages: dict        // необязательно: словарь, чтобы получить и текст
 *     });
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AraqsNumberEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const VERSION = "3.1";

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

/* ЦЕНА — ДИАПАЗОН, А НЕ ОДНО ЧИСЛО (версия 3.0).
   Продавец сам выбирает цену внутри диапазона. Границы имеют разный смысл:
     НИЖНЯЯ  — логика оператора: сколько стоит у оператора новый номер той же
               категории. Ниже этой суммы продавать смысла нет.
     ВЕРХНЯЯ — рыночная логика: 75-й процентиль запрашиваемых цен на list.am
               внутри того же статуса (385 объявлений, выгрузка 05.09.2026).
     РЕКОМЕНДАЦИЯ — точка внутри. Стоит на рыночной медиане статуса и
               сдвигается индексом красоты. Именно здесь работают
               повторяемость цифры и ритм: статус они не меняют.
   Бронзовый p75 понижен со 100 000 до 80 000: в этом статусе всего 21
   объявление, и сырое значение было выше, чем у Серебряного. */
const MARKET_P75 = {
  "Обычный":0, "Бронзовый":80000, "Серебряный":100000, "Золотой":380000,
  "Платиновый":500000, "Бриллиантовый":1100000, "Элит":1800000, "Премиум":2900000
};
const MARKET_MED = {
  "Обычный":0, "Бронзовый":50000, "Серебряный":45000, "Золотой":105000,
  "Платиновый":180000, "Бриллиантовый":300000, "Элит":1200000, "Премиум":1500000
};
/* Границы подуровней Премиума по индексу и их рыночные (медиана, потолок).
   В версии 2.0 пороги 93/97 оставляли подуровень P1 пустым — на рынке
   премиальные номера не опускаются ниже индекса 93. */
const PREMIUM_SUBLEVEL_INDEX = [["P3",98],["P2",95],["P1",0]];
const PREMIUM_SUBLEVEL_MARKET = {
  P1:[1000000,2500000], P2:[1500000,4000000], P3:[3000000,10000000]
};
/* Насколько индекс двигает рекомендацию от рыночной медианы статуса. */
const REC_SWING = 1.6;
const INDEX_BASE = {"Обычный":3,"Бронзовый":15,"Серебряный":30,"Золотой":45,
                    "Платиновый":60,"Бриллиантовый":72,"Элит":82,"Премиум":90};
const INDEX_TOP  = {"Обычный":9,"Бронзовый":24,"Серебряный":39,"Золотой":54,
                    "Платиновый":69,"Бриллиантовый":79,"Элит":89,"Премиум":100};
/* Типичный индекс внутри статуса — медиана по 385 объявлениям list.am.
   Полосы индекса шире, чем то, что встречается на рынке: почти все номера
   статуса сидят у нижнего края. Отсчёт положения рекомендации идёт от
   типичного индекса, иначе она у всех оказывается ниже рыночной медианы. */
const INDEX_MID  = {"Обычный":3,"Бронзовый":16,"Серебряный":31,"Золотой":47,
                    "Платиновый":62,"Бриллиантовый":75,"Элит":86,"Премиум":96};
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
    const len = b - a + 1;
    // При равной длине выигрывает БОЛЕЕ ПРАВЫЙ блок: номер читается
    // и группируется с конца (0XX AB CD EF).
    if(len > best[0] || (len === best[0] && b > best[3])) best = [len, d, a, b];
  }
  return best;
}

function bestBlock(w){
  const n = w.length; let best = [0,0,-1,-1], bestKey = null;
  for(let k = 2; k <= Math.floor(n/2); k++){
    for(let a = 0; a + 2*k <= n; a++){
      if(w.slice(a, a+k) !== w.slice(a+k, a+2*k)) continue;
      let r = 2, j = a + 2*k;
      while(j + k <= n && w.slice(j, j+k) === w.slice(a, a+k)){ r++; j += k; }
      const b = a + k*r - 1;
      if(b < 2) continue;
      // Охват больше -> короче блок -> правее конец.
      const key = [k*r, -k, b];
      if(bestKey === null || key[0] > bestKey[0] ||
         (key[0] === bestKey[0] && (key[1] > bestKey[1] ||
         (key[1] === bestKey[1] && key[2] > bestKey[2])))){ best = [k, r, a, b]; bestKey = key; }
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

/* Подряд идущие пары одинаковых цифр: 66-44-33. Считаются только пары,
   выровненные по естественной разбивке номера (0XX AB CD EF), то есть
   начинающиеся с чётной позиции окна. Пара, «съехавшая» на одну цифру,
   при записи номера не видна и красоты не создаёт. */
function pairChain(w){
  let best = [0,-1,-1];
  for(let a = 0; a < w.length - 1; a += 2){
    let cnt = 0, j = a;
    while(j + 1 < w.length && w.charAt(j) === w.charAt(j+1)){ cnt++; j += 2; }
    if(cnt >= 2 && a + 2*cnt - 1 >= 2 && cnt > best[0]) best = [cnt, a, a + 2*cnt - 1];
  }
  return best;
}

function zerosTail(w){ return w.length - w.replace(/0+$/,"").length; }

/* 44 55 66 77 — все четыре пары одинаковых цифр, и сами цифры идут подряд.
   В выборке рынка (385 объявлений) таких номеров не встретилось ни одного,
   поэтому оценка опирается не на цену, а на редкость. */
function pairsFormSequence(w){
  if(w.length !== 8) return false;
  const parts = [w.slice(0,2), w.slice(2,4), w.slice(4,6), w.slice(6,8)];
  for(let i = 0; i < 4; i++) if(parts[i].charAt(0) !== parts[i].charAt(1)) return false;
  const ds = parts.map(function(p){ return +p.charAt(0); });
  let asc = true, desc = true;
  for(let i = 0; i < 3; i++){
    if((((ds[i+1] - ds[i]) % 10) + 10) % 10 !== 1) asc = false;
    if((((ds[i] - ds[i+1]) % 10) + 10) % 10 !== 1) desc = false;
  }
  return asc || desc;
}

/* Ритм: одна цифра стоит через одну — 5_5_5_5. -> [длина, цифра] */
function rhythm(w){
  let best = 0, digit = null;
  const seen = {};
  for(let i = 0; i < w.length; i++) seen[w.charAt(i)] = true;
  for(const d in seen){
    for(let start = 0; start < w.length; start++){
      let k = 0, i = start;
      while(i < w.length && w.charAt(i) === d){ k++; i += 2; }
      if(k > best){ best = k; digit = d; }
    }
  }
  return [best, digit];
}

function digitCounts(w){
  const c = {};
  for(let i = 0; i < w.length; i++) c[w.charAt(i)] = (c[w.charAt(i)] || 0) + 1;
  const out = {};
  Object.keys(c).sort().forEach(function(k){ out[k] = c[k]; });
  return out;
}

function analyze(w){
  const r = bestRun(w), bl = bestBlock(w), sq = bestSeq(w),
        pl = longestPalindrome(w), pc = pairChain(w);
  const last = w.length - 1, zt = zerosTail(w);
  const dc = digitCounts(w), rh = rhythm(w);
  // При равном числе повторов побеждает цифра, встретившаяся в номере раньше.
  let domD = null, domN = 0;
  for(let i = 0; i < w.length; i++){
    const ch = w.charAt(i);
    if(dc[ch] > domN){ domN = dc[ch]; domD = ch; }
  }
  return {
    run:r[0], run_digit:r[1], run_a:r[2], run_b:r[3],
    run_crosses:(r[2] < 2 && r[3] >= 2), run_at_end:(r[3] === last),
    block_k:bl[0], block_r:bl[1], block_a:bl[2], block_b:bl[3],
    block_crosses:(bl[2] < 2 && bl[3] >= 2), block_text: bl[0] ? w.slice(bl[2], bl[2]+bl[0]) : "",
    seq:sq[0], seq_a:sq[1], seq_b:sq[2], seq_text: sq[0] ? w.slice(sq[1], sq[2]+1) : "",
    pal:pl[0], pal_a:pl[1], pal_b:pl[2], pal_text: pl[0] ? w.slice(pl[1], pl[2]+1) : "",
    pairs:pc[0], pairs_a:pc[1], pairs_b:pc[2],
    zeros_tail:zt, zt_a:last - zt + 1, zt_b:last,
    distinct:new Set(w.slice(2).split("")).size, last:last,
    /* Доминирование одной цифры во всём номере. Рынок платит за это заметно:
       внутри статуса «Золотой» номера с шестью одинаковыми цифрами стоят
       втрое дороже, чем с двумя (медианы 300 000 и 78 000 ֏). */
    digit_counts:dc, dominant:domN, dominant_digit:domD,
    rhythm:rh[0], rhythm_digit:rh[1],
    pairs_seq:pairsFormSequence(w)
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
  if(d.pairs_seq){
    const txt = [w.slice(0,2), w.slice(2,4), w.slice(4,6), w.slice(6,8)].join(" ");
    return R("Премиум", "pairs.seq", {text:txt}, 0, 7);
  }
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

  if(d.pairs >= 4) return R("Бриллиантовый", "pairs.4", {}, d.pairs_a, d.pairs_b);

  // --- Платиновый ---
  if(d.run === 4) return R("Платиновый", "run.4", {digit:rd}, d.run_a, d.run_b);
  if(d.pairs === 3) return R("Платиновый", "pairs.3", {}, d.pairs_a, d.pairs_b);
  if(d.block_k === 3 && d.block_r >= 2) return R("Платиновый", "block.triple.x2", {block:d.block_text}, d.block_a, d.block_b);
  if(d.seq === 5) return R("Платиновый", "seq.5", {text:d.seq_text}, d.seq_a, d.seq_b);
  if(d.zeros_tail === 3) return R("Платиновый", "zeros.tail.3", {}, d.zt_a, d.zt_b);

  // --- Золотой ---
  if(d.block_k === 2 && d.block_r === 2) return R("Золотой", "block.pair.x2", {block:d.block_text}, d.block_a, d.block_b);
  if(d.run === 3 && (d.run_at_end || d.run_crosses)) return R("Золотой", "run.3.strong", {digit:rd}, d.run_a, d.run_b);
  if(d.distinct <= 2) return R("Золотой", "distinct.le2", {distinct:d.distinct}, WHOLE_A, WHOLE_B);
  if(d.seq === 4) return R("Золотой", "seq.4", {text:d.seq_text}, d.seq_a, d.seq_b);
  if(d.pal === 5) return R("Золотой", "pal.5", {text:d.pal_text}, d.pal_a, d.pal_b);
  if(d.rhythm >= 4) return R("Золотой", "rhythm.4plus", {n:d.rhythm, digit:d.rhythm_digit}, 2, 7);

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
  // Доминирование одной цифры — подтверждено рынком: внутри одного статуса
  // цена растёт вместе с числом повторов доминирующей цифры.
  if(d.dominant >= 5) s += 2 * (d.dominant - 4);
  if(d.rhythm >= 4 && d.dominant < 6) s += 1;
  return Math.max(0, Math.min(INDEX_TOP[status], s));
}

/* Семейство узора — крупная группа, к которой относится найденный узор.
   Нужно сайту для витрины: «Повторы», «Последовательности», «Зеркальные»,
   «Пары». Получается из уже посчитанного кода узора бесплатно. */
const PATTERN_FAMILY = {
  run:"run", seq:"seq", block:"block", pal:"pal", pairs:"pairs",
  zeros:"zeros", rhythm:"rhythm", distinct:"distinct", none:"none"
};
function patternFamily(patternCode){
  const head = String(patternCode).split(".")[0];
  return PATTERN_FAMILY[head] || "none";
}

/* Округление до «человеческой» суммы: цены в объявлениях круглые. */
function roundPrice(x){
  if(x <= 0) return 0;
  const steps = [1000000, 100000, 10000, 5000, 1000];
  for(let i = 0; i < steps.length; i++)
    if(x >= steps[i] * 10) return Math.round(x / steps[i]) * steps[i];
  return Math.round(x / 1000) * 1000;
}

/* Диапазон цены продавца -> [нижняя, рекомендация, верхняя]. */
function priceRange(operator, status, index, sublevel){
  if(status === "Обычный") return [0,0,0];
  let op = String(operator || "viva").toLowerCase();
  if(!OPERATOR_PRICES[op]) op = "viva";
  let lo = OPERATOR_PRICES[op][status];
  let med, hi;
  if(sublevel && PREMIUM_SUBLEVEL_MARKET[sublevel]){
    med = PREMIUM_SUBLEVEL_MARKET[sublevel][0];
    hi  = PREMIUM_SUBLEVEL_MARKET[sublevel][1];
  } else {
    med = MARKET_MED[status];
    hi  = MARKET_P75[status];
  }
  // Оператор может оказаться дороже рынка (так бывает у Viva на верхних
  // категориях). Диапазон всё равно обязан быть возрастающим.
  lo = Math.max(lo, 1000);
  hi = Math.max(hi, lo * 1.5);
  med = Math.min(Math.max(med, lo), hi);

  const base = INDEX_BASE[status], mid = INDEX_MID[status], top = INDEX_TOP[status];
  let t;
  if(index <= mid) t = mid > base ? 0.5 * (index - base) / (mid - base) : 0.5;
  else             t = top > mid  ? 0.5 + 0.5 * (index - mid) / (top - mid) : 0.5;
  t = Math.min(1, Math.max(0, t));

  // Множитель геометрический: цены распределены логарифмически, и шаг
  // «в полтора раза» ощущается одинаково и на 50 тысячах, и на миллионе.
  let rec = med * Math.pow(REC_SWING, 2 * t - 1);
  rec = Math.min(Math.max(rec, lo), hi);
  return [roundPrice(lo), roundPrice(rec), roundPrice(hi)];
}

/* ===================== СБОР ЗА ПЕРЕОФОРМЛЕНИЕ =====================
   Viva  — 500 ֏ фиксированно; стоимость категории НЕ взимается, если номер
           был в пользовании не менее 24 месяцев (для юрлиц — 6 месяцев).
   Team  — 700 ֏ плюс ПОЛНАЯ текущая стоимость категории, послаблений нет.
   Ucom  — Золото/Платина/Бриллиант: 50% стоимости. Серебро и Бронза: 1 000 ֏. */

/* Владеет ли продавец номером дольше льготного срока Viva.
   Спрашивать точный срок не нужно и неприлично: достаточно «больше/меньше».
   Точное число месяцев принимается только ради совместимости. */
function heldLongEnough(entity, heldOverLimit, monthsHeld){
  if(heldOverLimit === true || heldOverLimit === false) return heldOverLimit;
  if(monthsHeld !== null && monthsHeld !== undefined && monthsHeld !== "")
    return (+monthsHeld) >= (VIVA_FREE_AFTER_MONTHS[entity] || VIVA_FREE_AFTER_MONTHS.individual);
  return null;
}

function transferFee(operator, status, monthsHeld, entity, heldOverLimit){
  const op = String(operator || "viva").toLowerCase();
  const table = OPERATOR_PRICES[op] || OPERATOR_PRICES.viva;
  const price = table[status] || 0;
  const F = (amount, code, params) => ({ amount:amount, code:code, params:params || {} });

  if(status === "Обычный") return F(0, "fee.plain", {});

  if(op === "viva"){
    const limit = VIVA_FREE_AFTER_MONTHS[entity] || VIVA_FREE_AFTER_MONTHS.individual;
    const held = heldLongEnough(entity, heldOverLimit, monthsHeld);
    if(held === null)
      return F(VIVA_FIXED + price, "fee.viva.unknownHeld", {fixed:VIVA_FIXED, limit:limit});
    if(held) return F(VIVA_FIXED, "fee.viva.free", {fixed:VIVA_FIXED, limit:limit});
    return F(VIVA_FIXED + price, "fee.viva.pending", {fixed:VIVA_FIXED, limit:limit});
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
  if(c.status === "Премиум"){
    for(let i = 0; i < PREMIUM_SUBLEVEL_INDEX.length; i++)
      if(index >= PREMIUM_SUBLEVEL_INDEX[i][1]){ sublevel = PREMIUM_SUBLEVEL_INDEX[i][0]; break; }
  }

  const explicitOperator = options.operator && options.operator !== "auto" ? String(options.operator).toLowerCase() : null;
  const operator = explicitOperator && OPERATOR_PRICES[explicitOperator]
    ? explicitOperator : (CODE_OPERATOR_HINT[code] || "viva");
  const operatorFromCode = !explicitOperator;

  const monthsHeld = (options.monthsHeld === undefined || options.monthsHeld === null ||
                      options.monthsHeld === "") ? null : Number(options.monthsHeld);
  const entity = options.entity === "legal" ? "legal" : "individual";
  const heldOverLimit = (options.heldOverLimit === true || options.heldOverLimit === false)
    ? options.heldOverLimit : null;

  const held = heldLongEnough(entity, heldOverLimit, monthsHeld);
  const band = priceRange(operator, c.status, index, sublevel);
  const fee = transferFee(operator, c.status, monthsHeld, entity, held);

  // Пояснения тоже кодами: сайт переводит их своим словарём.
  const noteCodes = [];
  const note = (code, params) => noteCodes.push({ code:code, params:params || {} });
  if(d.run_crosses || d.block_crosses) note("note.crossesCode");
  if(d.distinct <= 2) note("note.clean", {distinct:d.distinct});
  if(d.run_at_end && d.run >= 3) note("note.endsLast");
  if(operatorFromCode) note("note.operatorFromCode", {operator:OPERATOR_NAME[operator] || operator});
  if(c.status !== "Обычный" && MARKET_MED[c.status] &&
     OPERATOR_PRICES[operator][c.status] > MARKET_MED[c.status])
    note("note.operatorAboveMarket", {operator:OPERATOR_NAME[operator] || operator});
  if(d.dominant >= 5) note("note.dominant", {digit:d.dominant_digit, n:d.dominant});
  if(operator === "viva" && held === null && c.status !== "Обычный")
    note("note.askHeldOver", {limit:VIVA_FREE_AFTER_MONTHS[entity] || 24});
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
    patternCode:c.patternCode, patternFamily:patternFamily(c.patternCode),
    patternParams:c.patternParams,
    patternFrom:c.a, patternTo:c.b,
    operator:operator, operatorFromCode:operatorFromCode,
    monthsHeld:monthsHeld, heldOverLimit:held, entity:entity,
    /* Сколько раз встречается каждая цифра — чтобы сайт мог искать
       «номер, где пять пятёрок», не привязываясь к месту цифры. */
    digitCounts:d.digit_counts, dominantDigit:d.dominant_digit, dominantCount:d.dominant,
    distinct:d.distinct,
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
  MARKET_P75: MARKET_P75,
  MARKET_MED: MARKET_MED,
  PREMIUM_SUBLEVEL_MARKET: PREMIUM_SUBLEVEL_MARKET,
  INDEX_RANGE: INDEX_RANGE,
  parse: parse,
  normalize: normalize,
  analyze: analyze,
  classify: classify,
  beautyIndex: beautyIndex,
  transferFee: transferFee,
  priceRange: priceRange,
  patternFamily: patternFamily,
  heldLongEnough: heldLongEnough,
  evaluate: evaluate,
  localize: localize,
  fill: fill,
  explain: explain,
  money: money
};
});
