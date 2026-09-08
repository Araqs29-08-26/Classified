import { redirect } from "next/navigation";

/** Старый адрес условий использования — раздел переехал в «Правила». */
export default function TermsMoved({
  params: { locale },
}: {
  params: { locale: string };
}) {
  redirect(`/${locale}/rules/terms`);
}
