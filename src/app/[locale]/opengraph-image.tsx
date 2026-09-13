import { ImageResponse } from "next/og";

/**
 * Картинка для превью ссылки в мессенджерах и соцсетях.
 *
 * Без неё ссылка на сайт приходит в WhatsApp и Telegram голой строкой и
 * выглядит как случайная — а первое, что делает продавец, получив разбор
 * номера, это пересылает ссылку.
 *
 * Рисуется здесь, а не лежит картинкой: знак и цвета меняются вместе с сайтом,
 * и держать их в двух местах значит однажды разойтись.
 *
 * Текст ЛАТИНИЦЕЙ намеренно. Встроенный шрифт умеет её наверняка, а кириллицу
 * и армянский пришлось бы подгружать отдельным файлом на каждую отрисовку —
 * лишняя причина, по которой картинка однажды не соберётся. Название страницы
 * и описание мессенджер и так покажет рядом, на нужном языке.
 *
 * runtime = "edge" здесь не для скорости. В обычном режиме сборщик картинок
 * ищет свой шрифт по пути, который на Windows складывается неверно, и вместо
 * картинки приходит ошибка. На сервере это бы не проявилось — а значит, и
 * проверить картинку до выкатки было бы нечем.
 */
export const runtime = "edge";
export const alt = "Araqs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#101418";
const AMBER = "#c9982a";
const DIM = "rgba(255,255,255,.28)";

/** Те же девять точек, что и в знаке: диагональ складывается в букву «A». */
const DOTS = [
  [false, false, true],
  [false, true, false],
  [true, false, false],
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: INK,
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: 168,
              height: 168,
              padding: 30,
              borderRadius: 44,
              background: AMBER,
            }}
          >
            {DOTS.map((row, y) => (
              <div
                key={y}
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                {row.map((lit, x) => (
                  <div
                    key={x}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 20,
                      background: lit ? INK : "rgba(16,20,24,.4)",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: -4 }}>
              Araqs
            </div>
            <div style={{ fontSize: 40, color: AMBER, marginTop: -8 }}>
              araqs.com
            </div>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 34, color: DIM, marginTop: 56 }}>
          +374 &nbsp;·&nbsp; 55 &nbsp; 90 &nbsp; 90 &nbsp; 90
        </div>
      </div>
    ),
    size
  );
}
