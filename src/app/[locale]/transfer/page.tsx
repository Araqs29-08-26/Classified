import { redirect } from "next/navigation";

/**
 * Старый адрес переоформления.
 *
 * Раздел переехал в «Правила». Страница остаётся, чтобы ранее разосланные
 * ссылки и записи поисковиков не упирались в 404. Язык уже есть в адресе,
 * поэтому переход строится обычным redirect, без разбора языка заново.
 */
export default function TransferMoved({
  params: { locale },
}: {
  params: { locale: string };
}) {
  redirect(`/${locale}/rules/transfer`);
}
