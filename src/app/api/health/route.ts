import { NextResponse } from "next/server";

import { supabase } from "@/lib/supabase";

/**
 * Проверка живости сайта — для внешнего наблюдателя.
 *
 * Главная страница отвечает «200» и тогда, когда база недоступна: каталог
 * просто выходит пустым. Внешняя проверка по главной такую поломку не
 * заметит, поэтому нужен отдельный адрес, который смотрит глубже.
 *
 * Здесь делается самый дешёвый запрос, какой возможен: счёт строк без их
 * чтения. Если база отвечает — 200, если нет — 503, и наблюдатель поднимает
 * тревогу.
 *
 * Секретов в ответе нет: только «работает или нет», число живых объявлений и
 * время ответа базы. Это открытый адрес, и знать о нём никому не вредно.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();

  const { count, error } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("listing_status", "active");

  const ms = Date.now() - started;

  if (error) {
    return NextResponse.json(
      { ok: false, база: "не отвечает", ms },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { ok: true, объявлений: count ?? 0, ms },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
