import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import SellClient from "./SellClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "sell" });
  return { title: t("title"), description: t("subtitle") };
}

export default function SellPage() {
  return <SellClient />;
}
