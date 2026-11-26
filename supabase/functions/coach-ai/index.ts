// TRITON coach-ai: (1) evaluates a «Зробив інакше» session vs the planned board task,
// (2) writes a short daily readiness tip. Deterministic rules first, xAI text on top; never fails hard.
// Key: Vault `xai_api_key` via public.get_app_secret (service role) or env XAI_API_KEY. Active members / admin only.
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const DEFAULT_MODEL = "grok-4.20-0309-non-reasoning";
const XAI_URL = "https://api.x.ai/v1/chat/completions";
const kyivDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const SPEED: Record<string, number> = { bike: 27, run: 10, swim: 2.5 };

// planned minutes / km from coach text like "50 км, темп 30", "1 год 30 хв", "10×500"
function parsePlan(t: string, sport: string) {
  const s = (t || "").toLowerCase().replace(",", ".");
  let min = 0, km = 0;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:год|г\b|h)/); if (h) min += parseFloat(h[1]) * 60;
  const m = s.match(/(\d+)\s*(?:хв|мин|min|')/); if (m) min += parseInt(m[1]);
  const k = s.match(/(\d+(?:\.\d+)?)\s*(?:км|km)/); if (k) km = parseFloat(k[1]);
  const rep = s.match(/(\d+)\s*[x×х]\s*(\d+)/);
  if (rep && !km) { const n = +rep[1], d = +rep[2]; km = sport === "swim" || d >= 50 ? (n * d) / 1000 : 0; if (!km && !min) min = n * d; }
  const mt = s.match(/(\d{3,5})\s*м\b/); if (mt && !km) km = +mt[1] / 1000;
  if (!min && km) min = (km / (SPEED[sport] || 25)) * 60 * (sport === "swim" ? 1.3 : 1);
  const hard = /(інтервал|поріг|z4|z5|vo2|спринт|темпов|интервал|порог|×|x\d)/.test(s);
  return { min: Math.round(min), km, IF: hard ? 0.88 : 0.72 };
}
function loadOf(min: number, IF: number) { return Math.round((min / 60) * IF * IF * 100); }

async function ai(key: string, model: string, system: string, user: string, max = 220) {
  try {
    const r = await fetch(XAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: max, temperature: 0.4, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) { console.error("xai", r.status); return null; }
    const d = await r.json();
    return { text: String(d?.choices?.[0]?.message?.content ?? "").trim(), tokens: Number(d?.usage?.total_tokens ?? 0) };
  } catch (e) { console.error("xai fail", String(e)); return null; }
}

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
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const [{ data: pr }, { data: co }] = await Promise.all([
    admin.from("profiles").select("status, age, full_name, q").eq("id", uid).maybeSingle(),
    admin.from("coaches").select("user_id").eq("user_id", uid).maybeSingle(),
  ]);
  if (!co && pr?.status !== "active") return json({ error: "forbidden" }, 403);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const secret = async (name: string, env: string) => {
    const e = Deno.env.get(env); if (e) return e;
    const { data } = await admin.rpc("get_app_secret", { p_name: name });
    return (data as string | null) || null;
  };
  const key = await secret("xai_api_key", "XAI_API_KEY");
  const model = (await secret("xai_model", "XAI_MODEL")) || DEFAULT_MODEL;
  const addTokens = async (tk: number) => { if (tk) await admin.rpc("ai_usage_add_tokens", { p_user: uid, p_tokens: tk }); };

  // ---------- «Зробив інакше» ----------
  if (body.mode === "alt") {
    const postId = Number(body.post_id), athleteId = String(body.athlete_id || "");
    if (!postId || !athleteId) return json({ error: "args" }, 400);
    const { data: bp } = await admin.from("board_posts").select("id, section_id, day, plan").eq("id", postId).maybeSingle();
    if (!bp) return json({ error: "not found" }, 404);
    if (athleteId !== uid && !co) {
      const { data: sc } = await admin.from("section_coaches").select("user_id").eq("section_id", bp.section_id).eq("user_id", uid).maybeSingle();
      if (!sc) return json({ error: "forbidden" }, 403);
    }
    const [{ data: mk }, { data: ln }, { data: ap }, { data: sec }] = await Promise.all([
      admin.from("board_marks").select("*").eq("post_id", postId).eq("athlete_id", athleteId).maybeSingle(),
      admin.from("board_lines").select("text").eq("post_id", postId).eq("athlete_id", athleteId).maybeSingle(),
      admin.from("profiles").select("age, full_name").eq("id", athleteId).maybeSingle(),
      admin.from("sections").select("sport, name").eq("id", bp.section_id).maybeSingle(),
    ]);
    if (!mk || mk.status !== "alt") return json({ error: "no alt mark" }, 404);
    const sport = sec?.sport || bp.section_id;
    const planText = [ln?.text, bp.plan].filter(Boolean).join(" · ");
    const pl = parsePlan(planText, sport);
    const plannedMin = pl.min || 60;
    const planned = loadOf(plannedMin, pl.IF);
    const hrMax = 220 - (ap?.age || 35);
    let min = Number(mk.time_min || 0);
    if (!min && mk.dist_km) min = (Number(mk.dist_km) / (SPEED[sport] || 25)) * 60;
    if (!min) min = 45;
    const IF = mk.hr ? clamp(0.45 + 0.65 * ((Number(mk.hr) - 0.5 * hrMax) / (0.45 * hrMax)), 0.45, 1.1) : 0.7;
    let actual = loadOf(min, IF);
    let ratio = planned ? actual / planned : 1;
    let verdict = ratio >= 1.2 ? "Навантаження більше за план — наступні 1–2 дні варто легше."
      : ratio >= 0.8 ? "Навантаження приблизно як у плані — заміна зарахована."
      : ratio >= 0.4 ? "Вийшло легше за план — частково закрили обсяг."
      : "Значно легше за план — це скоріше відновлення.";
    let source = "rules";
    if (key) {
      const sys = `Ти — помічник тренера тріатлон-клубу. Оціни тренування, зроблене замість плану. Відповідай ЛИШЕ JSON: {"actual_load":число,"planned_load":число,"verdict":"до 200 символів українською"}. Навантаження у балах типу TSS (година в зоні порогу = 100). Опорні оцінки за правилами: факт ${actual}, план ${planned}. Відхиляйся від них лише за явних причин у тексті.`;
      const usr = `Секція: ${sec?.name || sport}. План тренера: «${planText || "не вказано"}». Спортсмен зробив інакше: «${mk.comment || "без опису"}». Час: ${mk.time_min ?? "—"} хв, дистанція: ${mk.dist_km ?? "—"} км, середній пульс: ${mk.hr ?? "—"} (макс. ≈${hrMax}).`;
      const r = await ai(key, model, sys, usr, 200);
      if (r?.text) {
        await addTokens(r.tokens);
        try {
          const j = JSON.parse(r.text.replace(/^```(?:json)?|```$/g, "").trim());
          const a = Math.round(Number(j.actual_load)), p = Math.round(Number(j.planned_load));
          if (a >= 0 && a < 600) actual = a;
          if (p > 0 && p < 600) { ratio = actual / p; }
          else ratio = planned ? actual / planned : 1;
          if (j.verdict) verdict = String(j.verdict).slice(0, 240);
          source = "ai";
          if (p > 0 && p < 600) { const row = { post_id: postId, athlete_id: athleteId, actual_load: actual, planned_load: p, ratio: Math.round(ratio * 100) / 100, verdict, source, updated_at: new Date().toISOString() };
            await admin.from("alt_reviews").upsert(row);
            await admin.from("workout_logs").update({ tss: actual }).eq("athlete_id", athleteId).eq("board_post_id", postId);
            return json({ ok: true, ...row }); }
        } catch { /* keep rules */ }
      }
    }
    const row = { post_id: postId, athlete_id: athleteId, actual_load: actual, planned_load: planned, ratio: Math.round(ratio * 100) / 100, verdict, source, updated_at: new Date().toISOString() };
    await admin.from("alt_reviews").upsert(row);
    await admin.from("workout_logs").update({ tss: actual }).eq("athlete_id", athleteId).eq("board_post_id", postId);
    return json({ ok: true, ...row });
  }

  // ---------- daily readiness tip ----------
  if (body.mode === "tip") {
    const day = kyivDay();
    const { data: rd } = await admin.from("readiness").select("*").eq("athlete_id", uid).eq("day", day).maybeSingle();
    if (!rd) return json({ error: "no readiness" }, 404);
    const tag = "ai:" + rd.level;
    if (rd.tip && rd.tip_source === tag) return json({ ok: true, tip: rd.tip, source: rd.tip_source });
    if (!key) return json({ ok: false, configured: false });
    const kid = (pr?.age ?? 30) < 18;
    const sys = `Ти — тренер тріатлон-клубу TRITON. Дай одну коротку пораду на сьогодні (1–2 речення, до 220 символів, українською) щодо відновлення, сну, води або харчування з урахуванням готовності. Без діагнозів і ліків; при болю порадь не терпіти і сказати тренеру.${kid ? " Користувач — дитина: без порад про калорії та схуднення." : ""} Без вступів і емодзі.`;
    const usr = `Готовність ${rd.score}%. Рівень: ${rd.level}. Причини: ${(rd.reasons || []).join(", ") || "немає"}. План на сьогодні: ${rd.adapted || rd.original || "відпочинок"}.`;
    const r = await ai(key, model, sys, usr, 160);
    if (!r?.text) return json({ ok: false });
    await addTokens(r.tokens);
    const tip = r.text.replace(/^["«]|["»]$/g, "").slice(0, 300);
    await admin.from("readiness").update({ tip, tip_source: tag }).eq("athlete_id", uid).eq("day", day);
    return json({ ok: true, tip, source: tag });
  }
  return json({ error: "mode" }, 400);
});
