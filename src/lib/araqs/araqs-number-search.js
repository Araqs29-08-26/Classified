/*!
 * ПОИСК НОМЕРОВ ARAQS — версия 1.0 (08.09.2026)
 *
 * Отдельный модуль. Движок оценки (araqs-number-engine.js) отвечает на вопрос
 * «сколько стоит вот этот номер». Этот модуль отвечает на другой вопрос:
 * «какие номера из объявлений мне подходят».
 *
 * ТРИ СПОСОБА ИСКАТЬ — работают ВМЕСТЕ, а не вместо друг друга
 *
 *   1. МАСКА С ПОЗИЦИЕЙ (взято с topnomer.ru).
 *      Человек пишет кусок номера и говорит, где он должен стоять:
 *      в начале, в середине, в конце — или где угодно.
 *          «77» в конце      -> 0XX XX XX 77
 *          «515» в середине  -> 0XX X 515 XX
 *      Дополнение к их схеме: у них позиций три, у нас четыре — добавлено
 *      «где угодно», потому что чаще всего человеку всё равно, где именно.
 *
 *   2. КОЛИЧЕСТВО ЦИФР, БЕЗ ПРИВЯЗКИ К МЕСТУ (наше дополнение).
 *          «пятёрка не менее пяти раз» -> 055 25 45 65 и 044 555550
 *      Маской это не выражается в принципе: цифры стоят вразброс.
 *
 *   3. КАТЕГОРИЯ УЗОРА (тоже с topnomer.ru, у них это ссылки-разделы).
 *          «Повторы», «Последовательности», «Зеркальные», «Пары», «Нули»
 *      Считать ничего не нужно: движок уже присвоил каждому номеру
 *      семейство узора при подаче объявления.
 *
 * ГЛАВНОЕ: все три условия складываются. Можно искать
 * «пятёрка не менее четырёх раз И номер оканчивается на 00 И статус от Золотого» —
 * ни один из изученных сайтов так не умеет.
 *
 * ПОДСТАНОВОЧНЫЕ ЗНАКИ В МАСКЕ
 *      ?  или  X   — ровно одна любая цифра:  «5?5» найдёт 505, 515, 525…
 *      *           — любое количество любых цифр (в том числе ноль)
 *      Пробелы, точки и дефисы внутри маски игнорируются.
 *
 * КАК ЭТО РАБОТАЕТ НА САЙТЕ
 *      При подаче объявления один раз вызывается buildIndex(вердикт движка)
 *      и результат кладётся в базу рядом с объявлением. Дальше поиск идёт
 *      по этим полям и номера не перебираются. Раздел «Поле индекса» ниже —
 *      это готовое описание для разработчика.
 *
 * Внешних зависимостей нет. Работает и в браузере, и в Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AraqsNumberSearch = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const VERSION = "1.0";

// Порядок статусов. Нужен, чтобы искать «от Золотого и выше»: в базе
// хранится номер по этой шкале (st_rank), и сравнение становится обычным >=.
const STATUS_RANK = ["plain","bronze","silver","gold","platinum","diamond","elite","premium"];

/* ===================== ПОЛЕ ИНДЕКСА =====================
   Что кладём в базу рядом с объявлением. Всё это движок уже посчитал —
   отдельных вычислений не нужно.

     w    строка(8)   окно анализа: код оператора + 6 цифр. По нему маска
     dc   объект      сколько раз встречается каждая цифра: {"4":5,"1":2}
     st   строка      код статуса: gold, premium, ...
     ix   число       индекс красоты 0-100
     fam  строка      семейство узора: run, seq, block, pal, pairs, zeros...
     pc   строка      точный код узора: block.pair.x2
     st_rank целое    номер статуса по шкале 0-7 — чтобы искать «от Золотого»
     dis  число       сколько разных цифр в теле номера
     op   строка      оператор: viva, team, ucom
     d0..d9 целые     то же, что dc, но плоскими столбцами — для базы

   В SQL это одна таблица; поле dc удобно держать как JSON, а для быстрого
   поиска «цифра N не менее K раз» — как десять маленьких целых столбцов
   d0..d9. Второй вариант быстрее и проще индексируется. */

function buildIndex(verdict){
  if(!verdict || !verdict.ok) return null;
  const dc = verdict.digitCounts || {};
  const rec = {
    w: verdict.window,
    dc: dc,
    st: verdict.statusCode,
    st_rank: STATUS_RANK.indexOf(verdict.statusCode),
    ix: verdict.index,
    fam: verdict.patternFamily,
    pc: verdict.patternCode,
    dis: verdict.distinct !== undefined ? verdict.distinct
         : new Set(String(verdict.window).slice(2).split("")).size,
    op: verdict.operator
  };
  // Плоские столбцы d0..d9 — для базы. В JS-поиске не используются,
  // но пусть уходят в индекс, чтобы разработчик не считал их заново.
  for(let d = 0; d <= 9; d++) rec["d" + d] = dc[String(d)] || 0;
  return rec;
}

/* ===================== РАЗБОР ЗАПРОСА =====================
   Человек пишет в строку поиска что угодно. Задача — понять, что он имел
   в виду, и НЕ угадывать там, где угадывание может обмануть.

   Возвращается объект вида
     { mask: "77", where: "end", counts: [{digit:"5", min:5}],
       family: null, statusMin: null, error: null, hint: "..." }

   Поле hint — человеческая расшифровка того, как понят запрос. Её стоит
   показывать под строкой поиска: «ищем номера, где 77 стоит в конце».
   Это дешёвая страховка от молчаливого недопонимания. */

const MASK_CHARS = "0123456789?X*";
const SEPARATORS = "  .-–—()/";

function cleanMask(text){
  let out = "";
  const s = String(text).toUpperCase();
  for(let i = 0; i < s.length; i++){
    const ch = s.charAt(i);
    if(SEPARATORS.indexOf(ch) >= 0) continue;
    if(MASK_CHARS.indexOf(ch) < 0) return null;   // посторонний символ
    out += ch;
  }
  return out;
}

/* «5x5», «5*5», «пять пятёрок» — все формы записи «цифра N раз».
   Ловим только однозначные: цифра, знак умножения, число. */
const COUNT_RE = /^([0-9])\s*[xх×*]\s*([1-8])$/i;
const COUNT_RE_REV = /^([1-8])\s*[xх×*]\s*([0-9])$/i;

function parseQuery(text, options){
  options = options || {};
  const q = {
    mask: null, where: options.where || "any",
    counts: [], family: options.family || null,
    statusMin: options.statusMin || null,
    error: null, hint: ""
  };
  const raw = String(text === undefined || text === null ? "" : text).trim();

  // Условия «цифра N раз» из отдельного элемента интерфейса
  if(options.counts) q.counts = options.counts.slice();

  if(!raw){
    if(!q.counts.length && !q.family && !q.statusMin) q.error = "search.empty";
    return q;
  }

  // «5x5» — пятёрка пять раз. Разбирается ДО маски: в маске «x» означает
  // любую цифру, и без этой проверки запрос прочитался бы как «5?5».
  let m = raw.match(COUNT_RE) || raw.match(COUNT_RE_REV);
  if(m){
    const digit = raw.match(COUNT_RE) ? m[1] : m[2];
    const times = raw.match(COUNT_RE) ? m[2] : m[1];
    q.counts.push({ digit: digit, min: parseInt(times, 10) });
    q.hint = "search.hint.count";
    return q;
  }

  const mask = cleanMask(raw);
  if(mask === null){ q.error = "search.badChars"; return q; }
  if(!mask){ q.error = "search.empty"; return q; }
  if(mask.replace(/\*/g, "").length > 8){ q.error = "search.tooLong"; return q; }

  q.mask = mask;
  q.hint = "search.hint." + q.where;
  return q;
}

/* ===================== СОПОСТАВЛЕНИЕ =====================
   Маска превращается в регулярное выражение по окну из 8 цифр.
   ? и X — одна любая цифра, * — любое количество. */

function maskToRegExp(mask, where){
  let body = "";
  for(let i = 0; i < mask.length; i++){
    const ch = mask.charAt(i);
    if(ch === "?" || ch === "X") body += "\\d";
    else if(ch === "*") body += "\\d*";
    else body += ch;
  }
  // Позиция считается по ТЕЛУ номера (6 цифр после кода оператора):
  // «в начале» человек имеет в виду начало номера, а не код оператора.
  // Код в окне — первые две цифры, поэтому тело начинается с позиции 2.
  if(where === "start")  return new RegExp("^\\d{2}" + body);
  if(where === "end")    return new RegExp(body + "$");
  if(where === "middle") return new RegExp("^\\d{3}" + body + "\\d");
  return new RegExp(body);                       // any
}

function matches(rec, q){
  if(!rec || !q || q.error) return false;

  if(q.mask){
    if(!maskToRegExp(q.mask, q.where).test(rec.w)) return false;
  }
  for(let i = 0; i < q.counts.length; i++){
    const c = q.counts[i];
    if((rec.dc[c.digit] || 0) < c.min) return false;
  }
  if(q.family && rec.fam !== q.family) return false;
  if(q.statusMin && STATUS_RANK.indexOf(rec.st) < STATUS_RANK.indexOf(q.statusMin)) return false;
  return true;
}

/* Поиск по списку. Результат отсортирован по индексу красоты вниз:
   если человек не сказал иначе, красивое показываем первым. */
function search(records, q, limit){
  const out = [];
  for(let i = 0; i < records.length; i++)
    if(matches(records[i], q)) out.push(records[i]);
  out.sort(function(a, b){ return b.ix - a.ix; });
  return limit ? out.slice(0, limit) : out;
}

/* ===================== ПОХОЖИЕ =====================
   Идея с topnomer.ru: если по точной маске ничего не нашлось, показать
   близкие варианты, а не пустую страницу. «Близкий» — тот, где маска
   совпала бы при замене одной цифры.

   Работает только для маски без «*»: длина должна быть известна. */

function findSimilar(records, q, limit){
  if(!q.mask || q.mask.indexOf("*") >= 0) return [];
  const variants = [];
  for(let i = 0; i < q.mask.length; i++){
    const ch = q.mask.charAt(i);
    if(ch === "?" || ch === "X") continue;
    variants.push({ mask: q.mask.slice(0, i) + "?" + q.mask.slice(i + 1),
                    where: q.where, counts: q.counts,
                    family: q.family, statusMin: q.statusMin, error: null });
  }
  const seen = {}, out = [];
  for(let v = 0; v < variants.length; v++){
    const found = search(records, variants[v]);
    for(let i = 0; i < found.length; i++){
      if(seen[found[i].w]) continue;
      seen[found[i].w] = true;
      out.push(found[i]);
    }
  }
  out.sort(function(a, b){ return b.ix - a.ix; });
  return limit ? out.slice(0, limit) : out;
}

/* ===================== ГОТОВЫЙ SQL ДЛЯ РАЗРАБОТЧИКА =====================
   Возвращает кусок условия WHERE и параметры к нему. На сайте поиск должен
   идти в базе, а не в JavaScript: JS-версия выше нужна для тестера и для
   небольших списков. */

function toSql(q, table){
  const t = (table || "listing_index") + ".";
  const where = [], params = [];
  if(q.mask){
    let like = "";
    for(let i = 0; i < q.mask.length; i++){
      const ch = q.mask.charAt(i);
      like += (ch === "?" || ch === "X") ? "_" : (ch === "*" ? "%" : ch);
    }
    if(q.where === "start")      like = "__" + like + "%";
    else if(q.where === "end")   like = "%" + like;
    else if(q.where === "middle")like = "___" + like + "_";
    else                          like = "%" + like + "%";
    where.push(t + "w LIKE ?"); params.push(like);
  }
  for(let i = 0; i < q.counts.length; i++){
    where.push(t + "d" + q.counts[i].digit + " >= ?");
    params.push(q.counts[i].min);
  }
  if(q.family){ where.push(t + "fam = ?"); params.push(q.family); }
  if(q.statusMin){
    where.push(t + "st_rank >= ?"); params.push(STATUS_RANK.indexOf(q.statusMin));
  }
  return { where: where.length ? where.join(" AND ") : "1=1", params: params };
}

return {
  VERSION: VERSION,
  STATUS_RANK: STATUS_RANK,
  buildIndex: buildIndex,
  parseQuery: parseQuery,
  maskToRegExp: maskToRegExp,
  matches: matches,
  search: search,
  findSimilar: findSimilar,
  toSql: toSql
};
});
