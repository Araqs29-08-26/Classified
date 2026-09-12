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
 * КОГДА ЧАСТЬ ЦИФР НЕ ВАЖНА
 *      *   звёздочка — ровно ОДНА любая цифра: «5*5» найдёт 505, 515, 525…
 *      Пробел и дефис — просто разделители, они игнорируются.
 *
 *      Почему именно звёздочка и почему одна цифра, а не «сколько угодно»:
 *      ровно так работает поиск автомобильных номеров на roadpolice.am, а
 *      этот сайт в Армении знают все. Их примеры — 11**111, 1*AA*1*: каждая
 *      звёздочка стоит на месте одного символа. Заводить свою систему знаков
 *      там, где у людей уже есть привычная, — значит учить их заново.
 *
 *      Знаки ? . X работают так же, для тех, кто привык к ним по другим
 *      сайтам, но в интерфейсе показывается только звёздочка.
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

const VERSION = "1.3";

// Все группы узоров. Номер почти всегда попадает в несколько сразу, поэтому
// в индексе это СПИСОК. В версии 1.0 группа была одна — та, что задала
// статус, — и из-за этого фильтр «вид узора» показывал пустоту: номер с
// парами и нулями числился только в «парах».
const FAMILIES = ["run","seq","block","pal","pairs","zeros","rhythm","distinct","tail"];

// Диапазоны цены для витрины. Последний намеренно БЕЗ верхней границы:
// потолок в 1 100 000 отсекал весь верх рынка, где и находятся самые
// дорогие номера. max: null означает «сколько угодно».
const PRICE_BUCKETS = [
  { code: "price.to50k",    min: 0,       max: 50000 },
  { code: "price.50to150k", min: 50000,   max: 150000 },
  { code: "price.150to500k",min: 150000,  max: 500000 },
  { code: "price.500kto1m", min: 500000,  max: 1000000 },
  { code: "price.over1m",   min: 1000000, max: null }
];

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
  const w = verdict.window;
  const fams = verdict.featureFamilies || (verdict.patternFamily ? [verdict.patternFamily] : []);
  const rec = {
    w: w,
    dc: dc,
    st: verdict.statusCode,
    st_rank: STATUS_RANK.indexOf(verdict.statusCode),
    ix: verdict.index,
    fams: fams.slice(),            // СПИСОК групп узора, а не одна
    fam: fams[0] || "none",        // оставлено для совместимости
    pc: verdict.patternCode,
    dis: verdict.distinct !== undefined ? verdict.distinct
         : new Set(String(w).slice(2).split("")).size,
    op: verdict.operator,
    // Признаки, по которым заказчик просил уметь искать напрямую.
    zeros: (String(w).match(/0/g) || []).length,
    pa: countAlignedPairs(w),                       // пары по разбивке
    maxrep: Math.max.apply(null, Object.keys(dc).map(function(k){ return dc[k]; }).concat([0])),
    tail: sameTail(w)                               // все пары кончаются на эту цифру
  };
  // Плоские столбцы для базы: d0..d9 и fam_* — их база индексирует напрямую.
  for(let d = 0; d <= 9; d++) rec["d" + d] = dc[String(d)] || 0;
  FAMILIES.forEach(function(f){ rec["fam_" + f] = fams.indexOf(f) >= 0; });
  return rec;
}

function countAlignedPairs(w){
  let n = 0;
  for(let i = 0; i + 1 < w.length; i += 2) if(w.charAt(i) === w.charAt(i+1)) n++;
  return n;
}

function sameTail(w){
  const t = w.charAt(1);
  for(let i = 3; i < w.length; i += 2) if(w.charAt(i) !== t) return null;
  return t;
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

// Звёздочка — одна любая цифра, как на roadpolice.am. Точка, ? и X
// принимаются как её синонимы, но в интерфейсе не показываются.
const MASK_CHARS = "0123456789?X*.";
const SEPARATORS = "  -–—()/+";   // плюс — для записи вида +374…

function cleanMask(text){
  let out = "";
  const s = String(text).toUpperCase();
  for(let i = 0; i < s.length; i++){
    const ch = s.charAt(i);
    if(SEPARATORS.indexOf(ch) >= 0) continue;
    if(MASK_CHARS.indexOf(ch) < 0) return null;   // посторонний символ
    out += ch;
  }
  // ОСОБЫЙ СЛУЧАЙ: человек вставил в поиск целый номер, записанный точками.
  // Продавцы на list.am так пишут постоянно — «096.33.33.48», — чтобы их
  // номер не находился поиском. Если убрать точки и остаётся ровно столько
  // цифр, сколько в номере, значит это номер, а не маска: точки тут
  // разделители. Иначе запрос молча превратился бы в «096?33?33?48» и
  // отвалился бы с ошибкой «слишком длинно», что человеку непонятно.
  let onlyDigits = out.replace(/\./g, "");
  if(/^[0-9]+$/.test(onlyDigits) && onlyDigits.length >= 6){
    // Приводим к тем же 8 цифрам, по которым работает индекс: отбрасываем
    // международный префикс и ведущий ноль, как это делает сам движок.
    if(onlyDigits.indexOf("00374") === 0)     onlyDigits = onlyDigits.slice(5);
    else if(onlyDigits.indexOf("374") === 0)  onlyDigits = onlyDigits.slice(3);
    if(onlyDigits.length === 9 && onlyDigits.charAt(0) === "0") onlyDigits = onlyDigits.slice(1);
    return onlyDigits;
  }

  // Все синонимы приводим к одному виду: каждый знак — РОВНО одна цифра.
  // «Сколько угодно цифр» намеренно не поддерживается: на roadpolice.am
  // такого нет, а лишняя возможность здесь только путает.
  return out.replace(/[.X*]/g, "?");
}

/* Сокращения вида «5x5» («пятёрка пять раз») здесь больше НЕТ.
   Заказчик убрал его сознательно: рядом стоит отдельный элемент «цифра —
   не менее N раз», и вторая, невидимая запись того же самого только путала.
   Хуже всего было то, что человек набирал «5*5», имея в виду маску, а
   получал фильтр по количеству — молча и не тем. Теперь всё, что набрано
   в строке, читается как маска, и ничего не угадывается. */

function parseQuery(text, options){
  options = options || {};
  const q = {
    mask: null, where: options.where || "any",
    counts: [],
    // families — СПИСОК: «покажи зеркальные ИЛИ с нулями». Старое поле
    // family по-прежнему принимается, чтобы не ломать уже написанный код.
    families: options.families ? options.families.slice()
              : (options.family ? [options.family] : []),
    family: options.family || null,
    statusMin: options.statusMin || null,
    zerosMin: options.zerosMin || null,     // нулей в номере не меньше
    pairsMin: options.pairsMin || null,     // пар по разбивке не меньше
    repeatMin: options.repeatMin || null,   // самая частая цифра не реже
    sameTail: options.sameTail || false,    // все пары кончаются одинаково
    // Цена. max: null означает «без верхней границы» — потолка тут нет.
    priceMin: options.priceMin != null ? options.priceMin : null,
    priceMax: options.priceMax != null ? options.priceMax : null,
    error: null, hint: "", maskDisplay: null
  };
  const raw = String(text === undefined || text === null ? "" : text).trim();

  // Условия «цифра N раз» из отдельного элемента интерфейса
  if(options.counts) q.counts = options.counts.slice();

  const hasFilter = q.counts.length || q.families.length || q.statusMin ||
                    q.zerosMin || q.pairsMin || q.repeatMin || q.sameTail ||
                    q.priceMin != null || q.priceMax != null;
  if(!raw){
    if(!hasFilter) q.error = "search.empty";
    return q;
  }

  const mask = cleanMask(raw);
  if(mask === null){ q.error = "search.badChars"; return q; }
  if(!mask){ q.error = "search.empty"; return q; }
  if(mask.length > 8){ q.error = "search.tooLong"; return q; }

  q.mask = mask;
  // В подсказке нельзя показывать внутреннюю форму: человек набрал «5*5»,
  // а видел «5?5» — знак, которого он не вводил. Показываем его запись.
  q.maskDisplay = mask.replace(/\?/g, "*");
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
    body += (ch === "?" || ch === "X" || ch === "*" || ch === ".") ? "\\d" : ch;
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
  // Группа узора: достаточно попадания в ЛЮБУЮ из выбранных.
  if(q.families.length){
    const have = rec.fams || (rec.fam ? [rec.fam] : []);
    let hit = false;
    for(let i = 0; i < q.families.length; i++)
      if(have.indexOf(q.families[i]) >= 0){ hit = true; break; }
    if(!hit) return false;
  }
  if(q.statusMin && STATUS_RANK.indexOf(rec.st) < STATUS_RANK.indexOf(q.statusMin)) return false;
  if(q.zerosMin  != null && (rec.zeros  || 0) < q.zerosMin)  return false;
  if(q.pairsMin  != null && (rec.pa     || 0) < q.pairsMin)  return false;
  if(q.repeatMin != null && (rec.maxrep || 0) < q.repeatMin) return false;
  if(q.sameTail && !rec.tail) return false;
  if(q.priceMin != null && !(rec.price >= q.priceMin)) return false;
  if(q.priceMax != null && !(rec.price <= q.priceMax)) return false;
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
      // Каждый знак подстановки — ровно один символ, поэтому «_», а не «%».
      like += (ch === "?" || ch === "X" || ch === "*" || ch === ".") ? "_" : ch;
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
  // Группа узора — отдельный булев столбец на каждую группу: база
  // индексирует их напрямую, и «любая из выбранных» превращается в OR.
  if(q.families.length){
    where.push("(" + q.families.map(function(f){ return t + "fam_" + f + " = TRUE"; }).join(" OR ") + ")");
  }
  if(q.zerosMin  != null){ where.push(t + "zeros >= ?");  params.push(q.zerosMin); }
  if(q.pairsMin  != null){ where.push(t + "pa >= ?");     params.push(q.pairsMin); }
  if(q.repeatMin != null){ where.push(t + "maxrep >= ?"); params.push(q.repeatMin); }
  if(q.sameTail)         { where.push(t + "tail IS NOT NULL"); }
  if(q.priceMin != null) { where.push(t + "price >= ?"); params.push(q.priceMin); }
  // Верхней границы может не быть вовсе — это и есть «дороже миллиона».
  if(q.priceMax != null) { where.push(t + "price <= ?"); params.push(q.priceMax); }
  if(q.statusMin){
    where.push(t + "st_rank >= ?"); params.push(STATUS_RANK.indexOf(q.statusMin));
  }
  return { where: where.length ? where.join(" AND ") : "1=1", params: params };
}

return {
  VERSION: VERSION,
  STATUS_RANK: STATUS_RANK,
  FAMILIES: FAMILIES,
  PRICE_BUCKETS: PRICE_BUCKETS,
  countAlignedPairs: countAlignedPairs,
  sameTail: sameTail,
  buildIndex: buildIndex,
  parseQuery: parseQuery,
  maskToRegExp: maskToRegExp,
  matches: matches,
  search: search,
  findSimilar: findSimilar,
  toSql: toSql
};
});
