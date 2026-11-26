// TRITON avatar-gen: AI avatar from a prompt (images/generations) or an edit of the user's photo (images/edits)
// with xAI grok-imagine-image-2.0. Active members / admin only. Hard limit 5 per user per rolling 7 days
// (public.avatar_gen_take, atomic). Key from Vault `xai_api_key` / env XAI_API_KEY — never returned or logged.
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MODEL = "grok-imagine-image-2.0";
const LIMIT = 5;
const PRICE = { generate: 0.04, edit: 0.05 }; // 1K·low output $0.04 (+ $0.01 per input image for edits)
const STYLE = "Square profile avatar, one subject centered, head and shoulders, clean simple background, friendly sporty vibe, no text, no watermark.";

function b64ToDataUri(b64: string, mime = "image/jpeg") { return `data:${mime};base64,${b64}`; }
async function urlToDataUri(u: string) {
  const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("fetch image " + r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return b64ToDataUri(btoa(s), r.headers.get("content-type") || "image/jpeg");
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
    admin.from("profiles").select("status").eq("id", uid).maybeSingle(),
    admin.from("coaches").select("user_id").eq("user_id", uid).maybeSingle(),
  ]);
  if (!co && pr?.status !== "active") return json({ error: "forbidden" }, 403);

  let body: { mode?: string; prompt?: string; image?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const left = async () => {
    const { count } = await admin.from("avatar_gens").select("id", { count: "exact", head: true })
      .eq("user_id", uid).neq("status", "failed").gt("created_at", new Date(Date.now() - 7 * 864e5).toISOString());
    return Math.max(0, LIMIT - (count ?? 0));
  };
  if (body.mode === "status") return json({ ok: true, left: await left(), limit: LIMIT });

  const mode = body.mode === "edit" ? "edit" : body.mode === "generate" ? "generate" : null;
  const prompt = String(body.prompt ?? "").trim().slice(0, 400);
  if (!mode) return json({ error: "mode" }, 400);
  if (prompt.length < 3) return json({ error: "prompt", text: "Опишіть, що згенерувати" }, 400);
  const image = String(body.image ?? "");
  if (mode === "edit" && !/^data:image\/(jpeg|png);base64,/.test(image)) return json({ error: "image", text: "Потрібне фото JPG або PNG" }, 400);
  if (image.length > 4_500_000) return json({ error: "image too big" }, 413);

  const sec = async (name: string, env: string) => {
    const e = Deno.env.get(env); if (e) return e;
    const { data } = await admin.rpc("get_app_secret", { p_name: name });
    return (data as string | null) || null;
  };
  const key = await sec("xai_api_key", "XAI_API_KEY");
  if (!key) return json({ ok: false, configured: false, text: "АІ ще не підключено" });

  const { data: take, error: te } = await admin.rpc("avatar_gen_take", { p_user: uid, p_mode: mode, p_prompt: prompt, p_limit: LIMIT });
  if (te) { console.error("take", te.message); return json({ error: "usage_error" }, 500); }
  const t0 = Array.isArray(take) ? take[0] : take;
  if (!t0?.allowed) return json({ ok: false, limited: true, left: 0, text: `Ліміт: ${LIMIT} АІ-аватарів за 7 днів. Спробуйте пізніше.` });
  const gid = t0.gen_id;

  const fullPrompt = mode === "generate" ? `${STYLE} ${prompt}` : `${prompt}. Keep the person recognizable; output a square profile avatar.`;
  const call = async (extra: Record<string, unknown>) => {
    const ep = mode === "edit" ? "https://api.x.ai/v1/images/edits" : "https://api.x.ai/v1/images/generations";
    const payload: Record<string, unknown> = { model: MODEL, prompt: fullPrompt, response_format: "b64_json", ...extra };
    if (mode === "edit") payload.image = { url: image, type: "image_url" };
    return await fetch(ep, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(90000) });
  };
  try {
    let r = await call({ aspect_ratio: "1:1", resolution: "1k", quality: "low" });
    if (r.status === 400 || r.status === 422) { console.error("xai params rejected", r.status, (await r.text()).slice(0, 300)); r = await call({}); }
    if (!r.ok) {
      const t = (await r.text()).slice(0, 300); console.error("xai", r.status, t);
      await admin.from("avatar_gens").update({ status: "failed", model: MODEL }).eq("id", gid);
      const blocked = /safety|policy|moderat|violat/i.test(t);
      return json({ ok: false, left: await left(), text: blocked ? "Запит відхилено правилами безпеки. Спробуйте інший опис." : "Не вдалося згенерувати. Спробуйте ще раз." }, 502);
    }
    const d = await r.json();
    const it = d?.data?.[0] ?? {};
    const out = it.b64_json ? b64ToDataUri(it.b64_json, "image/jpeg") : it.url ? await urlToDataUri(it.url) : null;
    if (!out) throw new Error("empty result");
    await admin.from("avatar_gens").update({ status: "ok", model: MODEL, cost_usd: PRICE[mode] }).eq("id", gid);
    return json({ ok: true, image: out, left: await left(), mode, revised: it.revised_prompt ?? null });
  } catch (e) {
    console.error("gen fail", String(e));
    await admin.from("avatar_gens").update({ status: "failed", model: MODEL }).eq("id", gid);
    return json({ ok: false, left: await left(), text: "Не вдалося згенерувати. Спробуйте ще раз." }, 502);
  }
});
