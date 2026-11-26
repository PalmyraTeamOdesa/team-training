// AI assistant for TRITON team: sport & health topics only.
// Requires secret GEMINI_API_KEY (optional GEMINI_MODEL). Without it returns {configured:false}.
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
  const msgs = (body.messages ?? []).slice(-12).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    text: String(m.text ?? "").slice(0, 2000),
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
      configured: !!Deno.env.get("GEMINI_API_KEY"),
      redflag: true,
      text: "Це може бути серйозно. Припиніть тренування і зверніться до лікаря. Якщо симптоми сильні або раптові — телефонуйте 103. Я повідомив тренера Дмитра.",
    });
  }

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ configured: false, text: "АІ ще не підключено" });

  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM + (kid ? "\nКористувач — дитина до 18 років." : "") + `\nІмʼя користувача: ${name}.` }] },
      contents: msgs.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { maxOutputTokens: 600, temperature: 0.5 },
    }),
  });
  if (!r.ok) return json({ configured: true, error: "ai_error", status: r.status }, 502);
  const d = await r.json();
  const text = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
  return json({ configured: true, text: text || "Не вдалося отримати відповідь. Спробуйте ще раз." });
});
