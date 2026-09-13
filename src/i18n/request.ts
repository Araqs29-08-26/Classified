import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Тексты сайта: основной словарь плюс словарь раздела недвижимости.
 *
 * Разнесены по двум файлам не ради порядка, а ради работы в четыре руки.
 * Словарь весит семьдесят тысяч знаков; если двое правят его одновременно,
 * Git сводит правки плохо и молча — теряется то, что писали вчера. Два файла
 * правятся независимо и не сталкиваются.
 *
 * Раздел номеров живёт в messages/<язык>.json, раздел недвижимости —
 * в messages/realty.<язык>.json под ключом «realty». Общее — шапка, подвал,
 * вход, кабинет, правила — остаётся в основном файле: оно одно на оба раздела.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as never)) {
    locale = routing.defaultLocale;
  }

  const [common, realty] = await Promise.all([
    import(`../../messages/${locale}.json`),
    import(`../../messages/realty.${locale}.json`),
  ]);

  return {
    locale,
    timeZone: "UTC",
    // Слияние только по верхнему уровню: разделы не пересекаются, а глубокое
    // слияние лишь скрыло бы случайное совпадение имён.
    messages: { ...common.default, ...realty.default },
  };
});
