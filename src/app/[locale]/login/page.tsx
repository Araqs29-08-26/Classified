import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("title") };
}

export default function LoginPage() {
  return <LoginClient />;
}
