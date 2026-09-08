import { redirect } from "@/i18n/navigation";

/**
 * Старый адрес переоформления.
 *
 * Раздел переехал в «Правила». Страница остаётся, чтобы ранее разосланные
 * ссылки и записи поисковиков не упирались в 404.
 */
export default function TransferMoved({
  params: { locale },
}: {
  params: { locale: string };
}) {
  redirect({ href: "/rules/transfer", locale });
}
