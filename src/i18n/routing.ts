import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ru", "hy", "en"],
  defaultLocale: "ru",
  localeDetection: true,
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
