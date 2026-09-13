import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

/**
 * Письмо администратору о жалобе на объявление.
 *
 * Письмо должно само говорить, от кого оно и что с ним делать. Первая же
 * жалоба пришла владельцу без подписи и без порядка действий — он не
 * понял ни кто пишет, ни как отвечать. Поэтому здесь есть и подпись, и
 * пошаговый разбор, и обратный адрес подавшего, если тот его оставил.
 *
 * Жалоба к этому моменту уже лежит в таблице reports — письмо только
 * уведомляет. На вход приходит только номер жалобы, всё остальное берётся
 * из базы: текст письма нельзя подсунуть снаружи.
 */
const REQUIRED = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SUPPORT_TO"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const SITE = "https://araqs.com";

/** Коды причин расшифровываются здесь: администратор читает по-русски. */
const REASONS: Record<string, string> = {
  not_owner: "номер продаёт не владелец",
  fraud: "мошенничество",
  wrong_data: "неверные данные: цена, статус или оператор",
  spam: "спам или оскорбления",
};

const LISTING_STATE: Record<string, string> = {
  active: "показывается в каталоге",
  hidden: "скрыто",
  sold: "продано",
  reserved: "забронировано",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Пробелы в номере: глазом читается быстрее, чем сплошная цепочка цифр. */
function prettyNumber(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || !d.startsWith("374")) return raw;
  return `+374 ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ sent: false, reason: "method_not_allowed" }, 405);
  }

  const missing = REQUIRED.filter((key) => !Deno.env.get(key));
  if (missing.length > 0) {
    console.error("нет секретов: " + missing.join(", "));
    return json({ sent: false, reason: "not_configured", missing });
  }

  let body: { reportId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ sent: false, reason: "bad_request" }, 400);
  }

  const reportId = String(body.reportId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) {
    return json({ sent: false, reason: "bad_request" }, 400);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: report, error } = await db
    .from("reports")
    .select("id, listing_id, reporter_id, reason, contact, comment, created_at")
    .eq("id", reportId)
    .maybeSingle();

  if (error || !report) {
    console.error("жалоба не найдена: " + String(error?.message ?? reportId));
    return json({ sent: false, reason: "not_found" }, 404);
  }

  const { data: listing } = await db
    .from("listings")
    .select("phone_number, status_tier, price, listing_status")
    .eq("id", report.listing_id)
    .maybeSingle();

  // Если человек был вошедшим, контакт есть и без формы — в его профиле.
  let fromProfile: string | null = null;
  if (report.reporter_id) {
    const { data: rp } = await db
      .from("profiles")
      .select("email, phone")
      .eq("id", report.reporter_id)
      .maybeSingle();
    fromProfile = rp?.email ?? rp?.phone ?? null;
  }

  const replyTo = String(report.contact ?? fromProfile ?? "").trim();

  // Сколько жалоб на это же объявление всего: третья жалоба гораздо
  // важнее первой, и это должно быть видно из письма.
  const { count } = await db
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", report.listing_id);

  const number = prettyNumber(String(listing?.phone_number ?? ""));
  const price = Number(listing?.price ?? 0).toLocaleString("ru-RU");

  const text = [
    "Это автоматическое письмо с сайта araqs.com.",
    "Посетитель пожаловался на объявление.",
    "",
    "ЧТО СЛУЧИЛОСЬ",
    "Причина: " + (REASONS[report.reason] ?? report.reason),
    "Пояснение: " + (report.comment ? String(report.comment) : "не оставлено"),
    "Подана: " + new Date(String(report.created_at)).toLocaleString("ru-RU"),
    "",
    "ОБЪЯВЛЕНИЕ",
    "Номер: " + number,
    "Статус: " + String(listing?.status_tier ?? "—") + ", цена " + price + " ֏",
    "Сейчас: " +
      (LISTING_STATE[String(listing?.listing_status ?? "")] ??
        String(listing?.listing_status ?? "—")),
    "Всего жалоб на него: " + String(count ?? 1),
    "Ссылка: " + SITE + "/ru/listing/" + report.listing_id,
    "",
    "КТО ПОДАЛ",
    replyTo
      ? "Ответить: " + replyTo +
        (replyTo.includes("@")
          ? " — можно просто нажать «Ответить» в этом письме"
          : "")
      : "Контакт не оставлен — ответить некуда.",
    "",
    "ЧТО ДЕЛАТЬ",
    "1. Открыть объявление по ссылке выше и посмотреть, похоже ли на правду.",
    "2. Если жалоба по делу — скрыть объявление:",
    "   Supabase → Table Editor → listings, найти строку по номеру,",
    "   поставить listing_status = hidden.",
    "3. Отметить разобранной:",
    "   Supabase → Table Editor → reports, столбец status:",
    "   resolved — жалоба подтвердилась и меры приняты;",
    "   dismissed — жалоба не подтвердилась.",
    "4. Если оставлен контакт — ответить подавшему.",
    "",
    "Все жалобы сразу с контактами и ценами:",
    "Supabase → Table Editor → admin_reports",
    "",
    "---",
    "Письмо отправлено сайтом автоматически на адрес поддержки.",
    "Номер жалобы: " + report.id,
  ].join("\n");

  // Строка → байты UTF-8 здесь, а не внутри библиотеки: именно на этом
  // превращении кириллица и терялась, превращаясь в вопросительные знаки.
  const bytes = new TextEncoder().encode(text);

  const user = Deno.env.get("SMTP_USER")!;
  const port = Number(Deno.env.get("SMTP_PORT"));

  const transporter = nodemailer.createTransport({
    host: Deno.env.get("SMTP_HOST")!,
    port,
    secure: port === 465,
    auth: { user, pass: Deno.env.get("SMTP_PASS")! },
  });

  try {
    const info = await transporter.sendMail({
      from: `"Araqs — жалобы" <${user}>`,
      to: Deno.env.get("SUPPORT_TO")!,
      // Ответ уйдёт подавшему, а не в пустоту, если тот оставил почту.
      replyTo: replyTo.includes("@") ? replyTo : undefined,
      subject: `Araqs: жалоба на ${number}`,
      text: bytes,
      textEncoding: "base64",
      encoding: "utf-8",
      alternatives: [],
    });
    console.log("отправлено: " + String(info?.response ?? ""));
    return json({ sent: true });
  } catch (mailError) {
    console.error("не отправилось: " + String(mailError));
    return json({ sent: false, reason: "smtp_failed" });
  }
});
