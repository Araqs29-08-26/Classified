import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

/**
 * Письмо продавцу от покупателя.
 *
 * Продавец мог зарегистрироваться по почте — тогда телефона у него нет и
 * кнопка «Связаться» раньше не показывала ничего. Письмо уходит отсюда, а не
 * из браузера: адрес продавца не должен попасть на страницу, иначе его
 * соберут так же, как собирают телефоны.
 *
 * На вход приходит только номер письма. Само письмо к этому моменту уже
 * лежит в таблице listing_messages — там же проверены объявление, длина
 * текста и частота обращений. Взять отсюда чужой адрес, подставив свой
 * текст, нельзя: адрес берётся по продавцу из базы.
 *
 * О кодировке: тело уходит готовыми байтами UTF-8 в base64 — русский текст
 * в письмах уже ломался на переносе строк и на переводе в однобайтовый набор.
 */
const REQUIRED = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const SITE = "https://araqs.com";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
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

  let body: { messageId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ sent: false, reason: "bad_request" }, 400);
  }

  const messageId = String(body.messageId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
    return json({ sent: false, reason: "bad_request" }, 400);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: message, error } = await db
    .from("listing_messages")
    .select("id, listing_id, seller_id, writer_name, writer_contact, body, sent_at")
    .eq("id", messageId)
    .maybeSingle();

  if (error || !message) {
    console.error("письмо не найдено: " + String(error?.message ?? messageId));
    return json({ sent: false, reason: "not_found" }, 404);
  }

  // Повторный вызов не должен слать второе письмо: страницу могли обновить.
  if (message.sent_at) {
    return json({ sent: true, reason: "already_sent" });
  }

  const [{ data: seller }, { data: listing }] = await Promise.all([
    db.from("profiles").select("email").eq("id", message.seller_id).maybeSingle(),
    db.from("listings").select("phone_number").eq("id", message.listing_id).maybeSingle(),
  ]);

  const to = String(seller?.email ?? "").trim();
  if (!to) {
    console.error("у продавца нет почты: " + message.seller_id);
    return json({ sent: false, reason: "no_email" });
  }

  const number = String(listing?.phone_number ?? "");
  const text = [
    "Вам написали по объявлению на Araqs.",
    "",
    "Номер: " + number,
    "Объявление: " + SITE + "/ru/listing/" + message.listing_id,
    "",
    message.writer_name ? "Кто пишет: " + message.writer_name : null,
    "Куда ответить: " + message.writer_contact,
    "",
    message.body,
    "",
    "---",
    "Письмо отправлено через сайт araqs.com. Ваш адрес покупателю не показан:",
    "чтобы ответить, напишите по контакту выше.",
  ].filter((line) => line !== null).join("\n");

  // Строка → байты UTF-8 здесь, а не внутри библиотеки: именно на этом
  // превращении кириллица и терялась, превращаясь в вопросительные знаки.
  const bytes = new TextEncoder().encode(text);

  const user = Deno.env.get("SMTP_USER")!;
  const port = Number(Deno.env.get("SMTP_PORT"));

  const transporter = nodemailer.createTransport({
    host: Deno.env.get("SMTP_HOST")!,
    port,
    // 465 — шифрование с первого знака, 587 — с переходом по ходу разговора.
    secure: port === 465,
    auth: { user, pass: Deno.env.get("SMTP_PASS")! },
  });

  try {
    const contact = String(message.writer_contact);
    const info = await transporter.sendMail({
      from: `"Araqs" <${user}>`,
      to,
      replyTo: contact.includes("@") ? contact : undefined,
      subject: "Araqs: вам написали по объявлению",
      // Готовые байты вместо строки — преобразовывать уже нечего.
      text: bytes,
      textEncoding: "base64",
      encoding: "utf-8",
      alternatives: [],
    });

    await db
      .from("listing_messages")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", messageId);

    console.log("отправлено: " + String(info?.response ?? ""));
    return json({ sent: true });
  } catch (mailError) {
    console.error("не отправилось: " + String(mailError));
    return json({ sent: false, reason: "smtp_failed" });
  }
});
