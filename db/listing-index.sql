-- ============================================================================
-- ПОИСКОВЫЙ ИНДЕКС ОБЪЯВЛЕНИЙ ARAQS
-- Набросок под PostgreSQL. Для другой базы поменяются только типы.
--
-- Заполняется ОДИН РАЗ при подаче объявления результатом buildIndex(вердикт).
-- Пересчитывается только при смене версии движка — тогда прогоняются все
-- объявления заново, и это единственный случай, когда числа могут поехать.
--
-- ВАЖНО ДЛЯ ЧЕСТНОСТИ ЦЕНЫ: статус и индекс сохраняются на момент публикации
-- вместе с версией движка. Если завтра логика изменится, старые объявления
-- не должны молча переоцениться у продавца за спиной — сначала показываем
-- ему, что изменилось.
-- ============================================================================

CREATE TABLE listing_index (
    listing_id   BIGINT PRIMARY KEY REFERENCES listing(id) ON DELETE CASCADE,

    -- Окно анализа: код оператора (2 цифры) + тело номера (6 цифр).
    -- Именно по нему работает маска. Полный номер с ведущим нулём
    -- хранится в таблице объявления, здесь он не дублируется.
    w            CHAR(8)     NOT NULL,

    -- Сколько раз встречается каждая цифра. Плоские столбцы, а не JSON:
    -- запрос «пятёрка не менее пяти раз» превращается в d5 >= 5 и берётся
    -- прямо из индекса. В JSON это был бы перебор.
    d0 SMALLINT NOT NULL DEFAULT 0,  d1 SMALLINT NOT NULL DEFAULT 0,
    d2 SMALLINT NOT NULL DEFAULT 0,  d3 SMALLINT NOT NULL DEFAULT 0,
    d4 SMALLINT NOT NULL DEFAULT 0,  d5 SMALLINT NOT NULL DEFAULT 0,
    d6 SMALLINT NOT NULL DEFAULT 0,  d7 SMALLINT NOT NULL DEFAULT 0,
    d8 SMALLINT NOT NULL DEFAULT 0,  d9 SMALLINT NOT NULL DEFAULT 0,

    st           VARCHAR(10) NOT NULL,   -- gold, premium, ...
    st_rank      SMALLINT    NOT NULL,   -- 0..7, чтобы искать «от Золотого»
    sublevel     VARCHAR(2),             -- P1/P2/P3 у Премиума, иначе NULL
    ix           SMALLINT    NOT NULL,   -- индекс красоты 0..100

    -- ГРУППА УЗОРА — НЕ ОДНА. Номер почти всегда попадает в несколько сразу:
    -- 041 10 90 90 — это и пары, и нули, и зеркало. В первой версии группа
    -- была одна, и из-за этого фильтр «вид узора» на сайте показывал пустоту.
    -- Отдельный булев столбец на группу: база индексирует их напрямую,
    -- а «любая из выбранных» превращается в обычный OR.
    fam_run      BOOLEAN NOT NULL DEFAULT FALSE,
    fam_seq      BOOLEAN NOT NULL DEFAULT FALSE,
    fam_block    BOOLEAN NOT NULL DEFAULT FALSE,
    fam_pal      BOOLEAN NOT NULL DEFAULT FALSE,
    fam_pairs    BOOLEAN NOT NULL DEFAULT FALSE,
    fam_zeros    BOOLEAN NOT NULL DEFAULT FALSE,
    fam_rhythm   BOOLEAN NOT NULL DEFAULT FALSE,
    fam_distinct BOOLEAN NOT NULL DEFAULT FALSE,
    fam_tail     BOOLEAN NOT NULL DEFAULT FALSE,

    -- Признаки, по которым заказчик просил уметь искать напрямую.
    zeros        SMALLINT NOT NULL DEFAULT 0,  -- нулей в номере, «круглые цифры»
    pa           SMALLINT NOT NULL DEFAULT 0,  -- пар по разбивке, включая разрозненные
    maxrep       SMALLINT NOT NULL DEFAULT 0,  -- сколько раз самая частая цифра
    tail         CHAR(1),                      -- цифра, на которую кончаются ВСЕ пары

    fam          VARCHAR(10) NOT NULL,   -- первая группа, для совместимости
    pc           VARCHAR(32) NOT NULL,   -- точный код узора
    dis          SMALLINT    NOT NULL,   -- сколько разных цифр в теле

    operator         VARCHAR(6) NOT NULL,   -- viva | team | ucom, от продавца
    held_over_limit  BOOLEAN,               -- дольше двух лет? NULL = не знаю

    -- ЦЕНА. Рыночная цена — то, что платит покупатель ЦЕЛИКОМ, вместе со
    -- сбором за переоформление. Она НЕ зависит от оператора: одинаковые по
    -- узору номера стоят покупателю одинаково. Сбор вычитается из неё, и
    -- вот остаток продавцу у Viva, Team и Ucom получается разный.
    price_min        INTEGER NOT NULL,
    price_typical    INTEGER NOT NULL,
    price_max        INTEGER NOT NULL,
    seller_asking    INTEGER,               -- что продавец назначил на деле
    transfer_fee     INTEGER NOT NULL,      -- ВНУТРИ price_*, не сверх
    seller_gets      INTEGER,               -- seller_asking минус сбор
    operator_price   INTEGER,               -- прайс оператора, ориентир

    engine_version   VARCHAR(8) NOT NULL,
    scored_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Маска «в конце» — это LIKE '%77', а обычный индекс такому не помогает.
-- Индекс по перевёрнутой строке превращает «оканчивается на» в
-- «начинается с», и поиск по концу номера — самый частый — становится
-- быстрым. Для «в начале» и «в середине» работает обычный текстовый индекс.
CREATE INDEX listing_index_w_idx      ON listing_index (w varchar_pattern_ops);
CREATE INDEX listing_index_w_rev_idx  ON listing_index (reverse(w) varchar_pattern_ops);

CREATE INDEX listing_index_rank_idx   ON listing_index (st_rank, ix DESC);
CREATE INDEX listing_index_fam_idx    ON listing_index (fam);
CREATE INDEX listing_index_zeros_idx  ON listing_index (zeros);
CREATE INDEX listing_index_pa_idx     ON listing_index (pa);
CREATE INDEX listing_index_maxrep_idx ON listing_index (maxrep);
-- Частичные индексы: строк с этими признаками мало, полный индекс не нужен.
CREATE INDEX listing_index_tail_idx   ON listing_index (tail) WHERE tail IS NOT NULL;
CREATE INDEX listing_index_price_idx  ON listing_index (seller_asking);
CREATE INDEX listing_index_digits_idx ON listing_index (d0,d1,d2,d3,d4,d5,d6,d7,d8,d9);

-- ----------------------------------------------------------------------------
-- ПРИМЕРЫ ЗАПРОСОВ (их же строит toSql() в модуле поиска)
-- ----------------------------------------------------------------------------

-- «77» в конце номера
--   SELECT * FROM listing_index WHERE w LIKE '%77' ORDER BY ix DESC;
--   быстрый вариант через перевёрнутый индекс:
--   SELECT * FROM listing_index WHERE reverse(w) LIKE '77%' ORDER BY ix DESC;

-- пятёрка не менее пяти раз, где угодно
--   SELECT * FROM listing_index WHERE d5 >= 5 ORDER BY ix DESC;

-- всё сразу: «00» в конце И пятёрка не менее трёх раз И от Золотого
--   SELECT * FROM listing_index
--    WHERE w LIKE '%00' AND d5 >= 3 AND st_rank >= 3
--    ORDER BY ix DESC;

-- зеркальные ИЛИ с нулями — группа узора теперь множественная
--   SELECT * FROM listing_index
--    WHERE (fam_pal = TRUE OR fam_zeros = TRUE) ORDER BY ix DESC;

-- три нуля и больше в номере
--   SELECT * FROM listing_index WHERE zeros >= 3 ORDER BY ix DESC;

-- ДОРОЖЕ МИЛЛИОНА. Верхней границы у запроса нет намеренно: потолок
-- в 1 100 000 отсекал весь верх рынка, где и стоят самые дорогие номера.
--   SELECT * FROM listing_index WHERE seller_asking >= 1000000 ORDER BY ix DESC;

-- ----------------------------------------------------------------------------
-- ПОЗИЦИИ МАСКИ
-- Считаются по ТЕЛУ номера, а не по всему окну: когда человек пишет
-- «в начале», он имеет в виду начало своего номера, а не код оператора.
-- Код — первые две цифры окна, поэтому под него идут два подчёркивания.
--
--   где угодно   w LIKE '%текст%'
--   в начале     w LIKE '__текст%'
--   в середине   w LIKE '___текст_'
--   в конце      w LIKE '%текст'
-- ----------------------------------------------------------------------------
