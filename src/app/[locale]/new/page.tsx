import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import NewListingClient from "./NewListingClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "newListing" });
  return { title: t("title"), description: t("subtitle") };
}

export default function NewListingPage() {
  // Suspense нужен, потому что клиентский компонент читает useSearchParams()
  return (
    <Suspense fallback={null}>
      <NewListingClient />
    </Suspense>
  );
}
