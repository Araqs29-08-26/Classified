import { cookies, headers } from "next/headers";

import { routing } from "@/i18n/routing";
import "./globals.css";

// Заглушка для адресов, не совпавших ни с одним маршрутом: /foo, /ru/foo и т.п.
// Страница [locale]/not-found.tsx сюда не подходит — она срабатывает только когда
// «не найдено» объявляет сам код, например для снятого с публикации объявления.
// Эта живёт вне [locale], поэтому <html>, <body> и выбор языка делает сама.

const LOCALE_LABELS: Record<string, string> = {
  hy: "Հայ",
  ru: "Ру",
  en: "Eng",
};

const SWITCH_ORDER = ["hy", "ru", "en"];

// Заголовок вкладки задаётся статически: not-found.tsx не умеет собирать метаданные
// под язык запроса. Поэтому он нейтрален к языку — цифры читаются одинаково всюду.
export const metadata = {
  title: "Araqs — 404",
};

/** Тот же порядок предпочтений, что и у middleware: выбор человека, потом браузер, потом язык по умолчанию. */
function pickLocale(saved: string | undefined, acceptLanguage: string): string {
  const known = (l: string) => routing.locales.includes(l as (typeof routing.locales)[number]);

  if (saved && known(saved)) return saved;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split("=")[1]) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (known(base)) return base;
  }

  return routing.defaultLocale;
}

export default async function NotFound() {
  const locale = pickLocale(
    cookies().get("NEXT_LOCALE")?.value,
    headers().get("accept-language") ?? ""
  );

  const messages = (await import(`../../messages/${locale}.json`)).default;
  const t = messages.notFound;

  return (
    <html lang={locale}>
      <body>
        <header className="site-header">
          <div className="bar">
            <a href={`/${locale}`} className="brand">
              <span className="mark">Aq</span>
              <span className="name">Araqs</span>
            </a>
            {/* Язык здесь — догадка, поэтому выход на другие языки виден сразу. */}
            <div className="lang-switch" role="group" aria-label="Язык / Լեզու / Language">
              {SWITCH_ORDER.map((l) => (
                <a
                  key={l}
                  href={`/${l}`}
                  lang={l}
                  className={"lang-btn" + (l === locale ? " active" : "")}
                >
                  {LOCALE_LABELS[l]}
                </a>
              ))}
            </div>
          </div>
        </header>

        <main className="wrap" style={{ paddingTop: 40 }}>
          <div className="empty-state">
            <h2>{t.title}</h2>
            <p>{t.subtitle}</p>
            <p style={{ marginTop: 16 }}>
              <a href={`/${locale}`} className="btn btn-accent">
                {t.cta}
              </a>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
