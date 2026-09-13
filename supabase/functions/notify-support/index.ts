import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.14";

/**
 * Письмо администратору о новом обращении в поддержку.
 *
 * Само обращение к этому моменту уже лежит в таблице support_requests —
 * письмо только уведомляет.
 *
 * Имя отправителя называет раздел — «Araqs — поддержка»: в один и тот же
 * ящик падают и обращения, и жалобы, и разобрать их надо не читая.
 *
 * О кодировке. Русский текст в письмах ломался три раза подряд, поэтому
 * здесь ничего не отдано на откуп: тело уходит готовыми байтами UTF-8,
 * кодировка задана явно — base64, в нём нечему ломаться ни при переносе
 * строк, ни при переводе в однобайтовый набор.
 */
const REQUIRED = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SUPPORT_TO"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function cut(value: unknown, limit: number): string {
  return String(value ?? "").slice(0, limit);
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

  let body: { contact?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ sent: false, reason: "bad_request" }, 400);
  }

  const contact = cut(body.contact, 200);
  const message = cut(body.message, 4000);
  if (!contact || !message) {
    return json({ sent: false, reason: "bad_request" }, 400);
  }

  const text = [
    "Это автоматическое письмо с сайта araqs.com.",
    "Человек написал через форму поддержки.",
    "",
    "КУДА ОТВЕТИТЬ",
    contact +
      (contact.includes("@")
        ? " — можно просто нажать «Ответить» в этом письме"
        : ""),
    "",
    "ОБРАЩЕНИЕ",
    message,
    "",
    "---",
    "Обращение сохранено: Supabase → Table Editor → support_requests.",
  ].join("\n");

  // Строка → байты UTF-8 здесь, а не внутри библиотеки: именно на этом
  // превращении кириллица и терялась, превращаясь в вопросительные знаки.
  const bytes = new TextEncoder().encode(text);
  console.log(`текст: ${text.length} знаков, ${bytes.length} байт`);

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
    const info = await transporter.sendMail({
      from: `"Araqs — поддержка" <${user}>`,
      to: Deno.env.get("SUPPORT_TO")!,
      replyTo: contact.includes("@") ? contact : undefined,
      subject: "Araqs: обращение в поддержку",
      // Готовые байты вместо строки — преобразовывать уже нечего.
      text: bytes,
      textEncoding: "base64",
      encoding: "utf-8",
      alternatives: [],
    });
    console.log("отправлено: " + String(info?.response ?? ""));
    return json({ sent: true, response: String(info?.response ?? "") });
  } catch (error) {
    console.error("не отправилось: " + String(error));
    return json({ sent: false, reason: "smtp_failed", detail: String(error) });
  }
});
