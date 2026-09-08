import { redirect } from "@/i18n/navigation";

/** Старый адрес условий использования — раздел переехал в «Правила». */
export default function TermsMoved({
  params: { locale },
}: {
  params: { locale: string };
}) {
  redirect({ href: "/rules/terms", locale });
}
