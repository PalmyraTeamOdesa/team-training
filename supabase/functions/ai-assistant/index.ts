// AI assistant for TRITON team: sport & health topics only.
// Uses the xAI API (OpenAI-compatible chat completions). The key is read server-side from
// Supabase Vault (secret name `xai_api_key`, via public.get_app_secret, service role only)
// or from the Edge Function secret XAI_API_KEY. Model: Vault `xai_model` / env XAI_MODEL.
// Without a key it returns {configured:false}.
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const RED_FLAGS = [
  /біль?\s*(у|в)\s*груд/i, /болить\s*(у|в)?\s*груд/i, /боль\s*в\s*груди/i, /тисне\s*(у|в)\s*груд/i,
  /задишк/i, /одышк/i, /не\s*можу\s*дихати/i, /непритомн/i, /знепритомн/i, /обморок/i, /втрати\w*\s*свідом/i,
  /потеря\w*\s*сознан/i, /запаморочен/i, /головокруж/i, /онімі/i, /онемен/i, /аритмі/i, /перебо\w*\s*(в|у)\s*серц/i,
  /серцебитт/i, /серце\s*(калатає|зупиня|колоти)/i, /кров\s*(у|в|з)/i, /кровотеч/i, /перелом/i, /гостр\w*\s*біль/i,
  /сильн\w*\s*біль/i, /температур\w*\s*(3[89]|4\d)/i, /судом/i, /інсульт/i, /інфаркт/i, /травмува/i,
];

const DEFAULT_MODEL = "grok-4.20-0309-non-reasoning"; // cheapest current chat model, no reasoning tokens
const MAX_TOKENS = 350;       // cap per answer
const LIMIT_ATHLETE = 30;     // messages per day (Europe/Kyiv)
const LIMIT_COACH = 100;      // coach: higher cap
const XAI_URL = "https://api.x.ai/v1/chat/completions";

const SYSTEM = `Ти — АІ-асистент велосипедної і тріатлонної команди TRITON (Одеса). Тренер команди — Дмитро.
Відповідай українською, коротко (до 120 слів), дружньо і конкретно.
Тема лише спорт і здоровий спосіб життя: тренування (вело, біг, плавання, зал), відновлення, сон, харчування спортсмена, інвентар, техніка, змагання.
На будь-які інші теми ввічливо відмов і поясни, що допомагаєш лише зі спортом і здоровʼям.
Ти не лікар: не став діагнозів і не призначай ліків. За будь-яких тривожних симптомів радь звернутися до лікаря і повідомити тренера.
Не змінюй план тренувань сам: зміни плану погоджує тренер через «Запит на зміну».
Для дітей до 18 років не давай порад щодо калорій, дієт чи схуднення.`;

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

  let body: { messages?: { role: string; text: string }[] } = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const msgs = (body.messages ?? []).slice(-8).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    text: String(m.text ?? "").slice(0, 1500),
  })).filter((m) => m.text);
  const last = [...msgs].reverse().find((m) => m.role === "user")?.text ?? "";
  if (!last) return json({ error: "empty" }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: prof } = await admin.from("profiles").select("full_name, age").eq("id", uid).maybeSingle();
  const name = prof?.full_name || "Спортсмен";
  const kid = (prof?.age ?? 30) < 18;

  if (RED_FLAGS.some((r) => r.test(last))) {
    const { data: coaches } = await admin.from("coaches").select("user_id");
    if (coaches?.length) {
      await admin.from("notifications").insert(coaches.filter((c) => c.user_id !== uid).map((c) => ({
        user_id: c.user_id, kind: "redflag", title: `${name}: тривожний симптом`, body: last.slice(0, 200),
      })));
    }
    return json({
      configured: true,
      redflag: true,
      text: "Це може бути серйозно. Припиніть тренування і зверніться до лікаря. Якщо симптоми сильні або раптові — телефонуйте 103. Я повідомив тренера Дмитра.",
    });
  }

  const secret = async (name: string, env: string) => {
    const e = Deno.env.get(env);
    if (e) return e;
    const { data } = await admin.rpc("get_app_secret", { p_name: name });
    return (data as string | null) || null;
  };
  const key = await secret("xai_api_key", "XAI_API_KEY");
  if (!key) return json({ configured: false, text: "АІ ще не підключено" });
  const model = (await secret("xai_model", "XAI_MODEL")) || DEFAULT_MODEL;

  const { data: isCoach } = await admin.from("coaches").select("user_id").eq("user_id", uid).maybeSingle();
  const limit = isCoach ? LIMIT_COACH : LIMIT_ATHLETE;
  const { data: take, error: te } = await admin.rpc("ai_usage_take", { p_user: uid, p_limit: limit });
  if (te) return json({ configured: true, error: "usage_error" }, 500);
  const t0 = Array.isArray(take) ? take[0] : take;
  if (!t0?.allowed) {
    return json({
      configured: true, limited: true, limit, used: t0?.used ?? limit,
      text: `Ліміт запитань до асистента на сьогодні вичерпано (${limit}). Завтра він знову буде доступний. З терміновими питаннями пишіть тренеру в чат.`,
    });
  }

  const r = await fetch(XAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      temperature: 0.5,
      messages: [
        { role: "system", content: SYSTEM + (kid ? "\nКористувач — дитина до 18 років." : "") + `\nІмʼя користувача: ${name}.` },
        ...msgs.map((m) => ({ role: m.role, content: m.text })),
      ],
    }),
  });
  if (!r.ok) {
    console.error("xai status", r.status);
    return json({ configured: true, error: "ai_error", status: r.status }, 502);
  }
  const d = await r.json();
  const text = String(d?.choices?.[0]?.message?.content ?? "").trim();
  const tk = Number(d?.usage?.total_tokens ?? 0);
  if (tk) await admin.rpc("ai_usage_add_tokens", { p_user: uid, p_tokens: tk });
  return json({ configured: true, used: t0.used, limit, text: text || "Не вдалося отримати відповідь. Спробуйте ще раз." });
});
