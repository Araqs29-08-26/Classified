import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
import LanguageSwitcher from "./LanguageSwitcher";
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

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `Araqs — ${t("title")}`,
      template: "Araqs — %s",
    },
    description: t("subtitle"),
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
                <span className="mark">Aq</span>
                <span className="name">Araqs</span>
              </Link>
              <nav className="nav-actions">
                <Link href="/" className="nav-link">
                  {t("buy")}
                </Link>
                <Link href="/sell" className="nav-link">
                  {t("sell")}
                </Link>
                <Link href="/transfer" className="nav-link">
                  {t("transfer")}
                </Link>
                <Link href="/rules" className="nav-link">
                  {t("rules")}
                </Link>
                <Link href="/support" className="nav-link">
                  {t("support")}
                </Link>
                <Link href="/new" className="btn btn-accent">
                  {t("postAd")}
                </Link>
                <LanguageSwitcher />
              </nav>
            </div>
          </header>

          <main className="wrap">{children}</main>

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
      <p>{t("footer")}</p>
      <p className="footer-links">
        <Link href="/transfer">{t("nav.transfer")}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/rules">{t("nav.rules")}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/support">{t("nav.support")}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms">{t("legal.termsNav")}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy">{t("legal.privacyNav")}</Link>
      </p>
    </footer>
  );
}
