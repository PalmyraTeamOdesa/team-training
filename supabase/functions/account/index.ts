// Account helper:
//  - register: creates an already-confirmed email+password user (built-in SMTP can only mail team members),
//    new members start as status='pending' until the coach approves them.
//  - coach_set_password: the coach sets a temporary password for an athlete who forgot theirs.
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  if (b.action === "register") {
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    const full_name = String(b.full_name ?? "").trim().slice(0, 80);
    if (!EMAIL.test(email) || email.length > 120) return json({ error: "Невірний email" }, 400);
    if (password.length < 8 || password.length > 72) return json({ error: "Пароль має містити щонайменше 8 символів" }, 400);
    if (!full_name) return json({ error: "Вкажіть імʼя" }, 400);
    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
    if (error) {
      const taken = /already|registered|exists/i.test(error.message);
      return json({ error: taken ? "Цей email уже зареєстровано. Увійдіть або попросіть тренера скинути пароль." : "Не вдалося створити акаунт" }, taken ? 409 : 400);
    }
    return json({ ok: true });
  }

  if (b.action === "coach_set_password") {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: c } = await admin.from("coaches").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!c) return json({ error: "forbidden" }, 403);
    const athlete = String(b.athlete_id ?? "");
    const { data: isCoach } = await admin.from("coaches").select("user_id").eq("user_id", athlete).maybeSingle();
    if (isCoach) return json({ error: "forbidden" }, 403);
    const abc = "abcdefghjkmnpqrstuvwxyz23456789";
    const rnd = crypto.getRandomValues(new Uint8Array(10));
    const temp = "Tri-" + Array.from(rnd, (x) => abc[x % abc.length]).join("");
    const { error } = await admin.auth.admin.updateUserById(athlete, { password: temp });
    if (error) return json({ error: "Не вдалося змінити пароль" }, 400);
    return json({ ok: true, password: temp });
  }
  return json({ error: "unknown action" }, 400);
});
