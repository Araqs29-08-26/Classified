import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("title") };
}

export default function AccountPage() {
  return <AccountClient />;
}
