// AI food estimate for the nutrition log: free text (uk/ru/en) → items with kcal/macros.
// Uses the same xAI key as ai-assistant (env XAI_API_KEY or Vault `xai_api_key`).
// Identical queries are cached in public.food_cache; separate daily limit (ai_usage.food_msgs).
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const DEFAULT_MODEL = "grok-4.20-0309-non-reasoning";
const DAILY_LIMIT = 60;   // AI estimates per user per day (cache hits are free)
const MAX_PARTS = 6;
const MAX_TOKENS = 400;

const SYSTEM = `Ти — нутриціолог. Оціни калорійність і БЖВ їжі з короткого опису (українською, російською або англійською, можливі помилки).
Поверни JSON: items — окремі продукти/страви з опису. name_uk — коротка назва українською (до 40 символів). grams — вага в г або обʼєм у мл (unit "мл" для напоїв).
Якщо кількість не вказана — бери типову порцію (ресторан/фастфуд — стандартна порція відомих мереж). kcal, protein, fat, carbs, alcohol_g — на всю вказану кількість, не на 100 г. alcohol_g — грами чистого спирту.
Якщо текст не є їжею чи напоєм — поверни items: []. Не додавай продуктів, яких немає в описі. Відповідай лише JSON.`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name_uk: { type: "string" }, grams: { type: "number" }, unit: { type: "string", enum: ["г", "мл"] },
          kcal: { type: "number" }, protein: { type: "number" }, fat: { type: "number" }, carbs: { type: "number" },
          alcohol_g: { type: "number" },
        },
        required: ["name_uk", "grams", "unit", "kcal", "protein", "fat", "carbs", "alcohol_g"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

type Item = { name_uk: string; grams: number; unit: string; kcal: number; protein: number; fat: number; carbs: number; alcohol_g: number };
const norm = (t: string) => t.toLowerCase().replace(/ё/g, "е").replace(/[’ʼ'`]/g, "ʼ").replace(/\s+/g, " ").trim().slice(0, 200);
const num = (v: unknown, max: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0; };
const clean = (items: Item[]) => (Array.isArray(items) ? items : []).slice(0, 8).map((i) => ({
  name_uk: String(i.name_uk ?? "").slice(0, 60) || "Страва",
  grams: Math.round(num(i.grams, 5000)) || 100,
  unit: i.unit === "мл" ? "мл" : "г",
  kcal: Math.round(num(i.kcal, 10000)),
  protein: +num(i.protein, 1000).toFixed(1), fat: +num(i.fat, 1000).toFixed(1),
  carbs: +num(i.carbs, 1000).toFixed(1), alcohol_g: +num(i.alcohol_g, 500).toFixed(1),
}));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: u, error: ue } = await userClient.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (ue || !u?.user) return json({ error: "unauthorized" }, 401);
  const uid = u.user.id;

  let body: { parts?: string[] } = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const parts = [...new Set((body.parts ?? []).map((p) => norm(String(p ?? ""))).filter((p) => p.length >= 2))].slice(0, MAX_PARTS);
  if (!parts.length) return json({ error: "empty" }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const results: Record<string, Item[]> = {};

  // 1) cache
  const { data: cached } = await admin.from("food_cache").select("q, items, hits").in("q", parts);
  for (const c of cached ?? []) {
    results[c.q] = c.items as Item[];
    admin.from("food_cache").update({ hits: (c.hits ?? 0) + 1 }).eq("q", c.q).then(() => {});
  }
  const todo = parts.filter((p) => !(p in results));
  if (!todo.length) return json({ ok: true, results, cached: parts.length });

  // 2) key + limit
  let key = Deno.env.get("XAI_API_KEY") || null;
  if (!key) { const { data } = await admin.rpc("get_app_secret", { p_name: "xai_api_key" }); key = (data as string | null) || null; }
  if (!key) return json({ ok: false, configured: false, results, error: "not_configured" });
  let model = Deno.env.get("XAI_MODEL") || null;
  if (!model) { const { data } = await admin.rpc("get_app_secret", { p_name: "xai_model" }); model = (data as string | null) || DEFAULT_MODEL; }

  const failed: string[] = [];
  let limited = false;
  await Promise.all(todo.map(async (q) => {
    const { data: take } = await admin.rpc("ai_food_take", { p_user: uid, p_limit: DAILY_LIMIT });
    const t0 = Array.isArray(take) ? take[0] : take;
    if (!t0?.allowed) { limited = true; failed.push(q); return; }
    try {
      const r = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model, temperature: 0, max_tokens: MAX_TOKENS,
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: q }],
          response_format: { type: "json_schema", json_schema: { name: "food", schema: SCHEMA, strict: true } },
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) { console.error("xai status", r.status); failed.push(q); return; }
      const d = await r.json();
      const items = clean(JSON.parse(d?.choices?.[0]?.message?.content ?? "{}").items);
      results[q] = items;
      const tk = Number(d?.usage?.total_tokens ?? 0);
      if (tk) await admin.rpc("ai_usage_add_tokens", { p_user: uid, p_tokens: tk });
      if (items.length) await admin.from("food_cache").upsert({ q, items, model });
    } catch (e) { console.error("food estimate", String(e)); failed.push(q); }
  }));
  return json({ ok: true, configured: true, results, failed, limited, limit: DAILY_LIMIT });
});
