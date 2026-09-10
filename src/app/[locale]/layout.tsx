import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LANDINGS } from "@/lib/landing";
import { SITE_URL } from "@/lib/site";
import BrandMark from "./BrandMark";
import LanguageSwitcher from "./LanguageSwitcher";
import AccountLink from "./AccountLink";
import SupportButton from "./SupportButton";
import "../globals.css";

// Страницы намеренно рендерятся на каждый запрос (как и на прежнем сайте):
// список объявлений всегда свежий, а next-intl читает cookie языка.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "home" });
  const tSeo = await getTranslations({ locale, namespace: "seo" });

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `Araqs — ${t("title")}`,
      template: "Araqs — %s",
    },
    description: t("subtitle"),
    /**
     * Связь языковых версий между собой.
     *
     * Без неё поисковик считает три перевода одной страницы дублями и
     * показывает в выдаче только один — обычно не тот, на языке которого
     * человек искал.
     */
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, `${SITE_URL}/${l}`]),
        ["x-default", `${SITE_URL}/${routing.defaultLocale}`],
      ]),
    },
    /** Как выглядит ссылка, когда её отправляют в мессенджере. */
    openGraph: {
      type: "website",
      siteName: tSeo("siteName"),
      title: `Araqs — ${t("title")}`,
      description: t("subtitle"),
      url: `${SITE_URL}/${locale}`,
      locale,
    },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as any)) notFound();

  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <header className="site-header">
            <div className="bar">
              <Link href="/" className="brand">
                <BrandMark size={32} />
                <span className="name">Araqs</span>
              </Link>
              <nav className="nav-actions">
                <Link href="/" className="nav-link">
                  {t("buy")}
                </Link>
                <Link href="/new" className="nav-link">
                  {t("sell")}
                </Link>
                <Link href="/rules" className="nav-link">
                  {t("rules")}
                </Link>
                {/* Оценка — вход для того, кто ещё не решил, продавать ли:
                    сначала человек узнаёт цену, а размещает уже потом. */}
                <Link href="/sell" className="btn btn-accent">
                  {t("evaluate")}
                </Link>
                <AccountLink />
                <LanguageSwitcher />
              </nav>
            </div>
          </header>

          <main className="wrap">{children}</main>

          {/* Поддержка ушла из меню в угол экрана: она нужна редко, но всегда. */}
          <SupportButton />

          <SiteFooter locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

async function SiteFooter({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });

  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <BrandMark size={30} inverted />
        <span>Araqs</span>
      </div>

      {/* Подборки в подвале — чтобы поисковик их обошёл, а человек нашёл.
          Страница, на которую ниоткуда не ведёт ссылка, остаётся невидимой. */}
      <div className="footer-links">
        {LANDINGS.map((l) => (
          <Link key={l.slug} href={`/numbers/${l.slug}`}>
            {t(`landing.${l.slug}.h1`)}
          </Link>
        ))}
      </div>

      <div className="footer-links">
        <Link href="/rules">{t("rulesNav.posting")}</Link>
        <Link href="/rules/transfer">{t("rulesNav.transfer")}</Link>
        <Link href="/rules/promo">{t("rulesNav.promo")}</Link>
        <Link href="/rules/terms">{t("rulesNav.terms")}</Link>
        <Link href="/privacy">{t("legal.privacyNav")}</Link>
      </div>

      <p>{t("footer")}</p>
      {/* Владельца ищут в подвале — там это привычное место. Полные
          реквизиты остаются в «Условиях использования». */}
      <p className="footer-company">{t("company")}</p>
    </footer>
  );
}
