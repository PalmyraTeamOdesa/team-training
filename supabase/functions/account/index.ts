// Account helper:
//  - register: creates an already-confirmed email+password user (built-in SMTP can only mail team members),
//    new members start as status='pending' until the coach approves them.
//  - coach_set_password: the admin sets a temporary password for an athlete who forgot theirs.
//  - admin_expel / admin_restore: the admin removes a person from the club (keeps history) or brings them back.
//  - admin_create_user: the admin creates an approved account (optionally as section coach / member) with a temp password.
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
  if (b.action === "admin_create_user") {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: c } = await admin.from("coaches").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!c) return json({ error: "Лише адміністратор може додавати людей" }, 403);
    const email = String(b.email ?? "").trim().toLowerCase();
    const full_name = String(b.full_name ?? "").trim().slice(0, 80);
    const SECS = ["bike", "swim", "run"];
    const coachOf = (Array.isArray(b.coach_sections) ? b.coach_sections : []).map(String).filter((x) => SECS.includes(x));
    const memberOf = (Array.isArray(b.member_sections) ? b.member_sections : []).map(String).filter((x) => SECS.includes(x));
    if (!EMAIL.test(email) || email.length > 120) return json({ error: "Невірний email" }, 400);
    if (!full_name) return json({ error: "Вкажіть імʼя" }, 400);
    const abc = "abcdefghjkmnpqrstuvwxyz23456789";
    const rnd = crypto.getRandomValues(new Uint8Array(10));
    const temp = "Tri-" + Array.from(rnd, (x) => abc[x % abc.length]).join("");
    const { data: cu, error } = await admin.auth.admin.createUser({ email, password: temp, email_confirm: true, user_metadata: { full_name } });
    if (error || !cu?.user) {
      const taken = /already|registered|exists/i.test(error?.message ?? "");
      return json({ error: taken ? "Цей email уже зареєстровано" : "Не вдалося створити акаунт" }, taken ? 409 : 400);
    }
    const id = cu.user.id;
    // profile row is created by the auth trigger; approve it (coach-only accounts skip the athlete questionnaire)
    await admin.from("profiles").upsert({ id, full_name, status: "active", onboarded: coachOf.length > 0 && !memberOf.length }, { onConflict: "id" });
    if (coachOf.length) await admin.from("section_coaches").insert(coachOf.map((s) => ({ section_id: s, user_id: id })));
    if (memberOf.length) await admin.from("section_members").insert(memberOf.map((s) => ({ section_id: s, athlete_id: id })));
    return json({ ok: true, id, password: temp });
  }
  if (b.action === "admin_expel" || b.action === "admin_restore") {
    // expel: remove section roles, status=blocked, ban the login; history (logs, marks, points, awards) is kept
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: c } = await admin.from("coaches").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!c) return json({ error: "Лише адміністратор може виключати людей" }, 403);
    const target = String(b.user_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(target)) return json({ error: "bad id" }, 400);
    const { data: tc } = await admin.from("coaches").select("user_id").eq("user_id", target).maybeSingle();
    if (tc) return json({ error: "Адміністратора виключити не можна" }, 403);
    if (b.action === "admin_expel") {
      await admin.from("section_coaches").delete().eq("user_id", target);
      await admin.from("section_members").delete().eq("athlete_id", target);
      await admin.from("profiles").update({ status: "blocked", paused: false, paused_note: "", paused_at: null }).eq("id", target);
      const { error } = await admin.auth.admin.updateUserById(target, { ban_duration: "876000h" });
      if (error) return json({ error: "Не вдалося закрити вхід" }, 400);
    } else {
      await admin.from("profiles").update({ status: "active" }).eq("id", target);
      const { error } = await admin.auth.admin.updateUserById(target, { ban_duration: "none" });
      if (error) return json({ error: "Не вдалося відновити вхід" }, 400);
    }
    return json({ ok: true });
  }
  return json({ error: "unknown action" }, 400);
});
