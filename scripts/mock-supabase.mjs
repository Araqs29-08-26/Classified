/**
 * Локальная заглушка Supabase — ТОЛЬКО для проверки вёрстки в этой среде.
 * Рабочая среда сборки не имеет доступа к supabase.co, поэтому без заглушки
 * страницы отрисовываются пустыми и проверить таблицу объявлений нельзя.
 *
 * Данные — реальные две записи с боевого сайта (сняты из RSC-payload).
 * В продакшне не используется: там сайт ходит в настоящий Supabase.
 *
 * Запуск:  node scripts/mock-supabase.mjs
 * Затем:   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 npm run build && npm start
 */
import { createServer } from "node:http";

const LISTINGS = [
  {
    id: "5ca6faaa-2bde-47a5-95a1-949e02c3983a",
    seller_id: "b4553109-3b5f-454e-9896-183a52974792",
    phone_number: "+37444841414",
    operator: "Ucom",
    region: null,
    price: 65000,
    status_tier: "Золотой",
    description: null,
    sms_verified: true,
    listing_status: "active",
    created_at: "2026-09-01T13:25:55.701716+00:00",
    updated_at: "2026-09-01T13:25:55.701716+00:00",
    number_type: "Мобильный",
  },
  {
    id: "a8a5ae18-a00c-4080-aaa0-f00d53976d0a",
    seller_id: "664e1265-3ac3-489d-8356-81b8c9a99fb2",
    phone_number: "+37495250806",
    operator: "Ucom",
    region: null,
    price: 30000,
    status_tier: "Обычный",
    description: null,
    sms_verified: true,
    listing_status: "active",
    created_at: "2026-09-01T13:59:21.734554+00:00",
    updated_at: "2026-09-01T13:59:21.734554+00:00",
    number_type: "Мобильный",
  },
];

const PROFILES = [
  { id: "b4553109-3b5f-454e-9896-183a52974792", phone: "37477674901" },
  { id: "664e1265-3ac3-489d-8356-81b8c9a99fb2", phone: null },
];

const eqValue = (v) => (v?.startsWith("eq.") ? decodeURIComponent(v.slice(3)) : null);

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const table = url.pathname.replace("/rest/v1/", "");
  const single = (req.headers.accept ?? "").includes("pgrst.object");

  let rows = table === "listings" ? [...LISTINGS] : table === "profiles" ? [...PROFILES] : [];

  for (const [key, raw] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    const want = eqValue(raw);
    if (want !== null) rows = rows.filter((r) => String(r[key]) === want);
  }

  const order = url.searchParams.get("order");
  if (order?.startsWith("created_at.desc")) {
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  res.writeHead(200, {
    "content-type": single
      ? "application/vnd.pgrst.object+json; charset=utf-8"
      : "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(single ? (rows[0] ?? null) : rows));
}).listen(54321, "127.0.0.1", () =>
  console.log("mock supabase → http://127.0.0.1:54321")
);
