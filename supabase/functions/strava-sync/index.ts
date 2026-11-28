// Strava sync for TRITON Team (phase 2, feature-flagged).
// Enabled only when STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET exist (Edge Function secrets, or Vault
// `strava_client_id` / `strava_client_secret` via get_app_secret). Optional STRAVA_WEBHOOK_VERIFY_TOKEN
// (or Vault `strava_webhook_verify_token`) enables the push-subscription webhook.
// verify_jwt=false: Strava calls the OAuth callback and the webhook without a Supabase JWT; user actions
// check the JWT themselves. Never log tokens or secrets.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.119.2";

const APP_URL = "https://palmyrateamodesa.github.io/team-training/";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const back = (k: string) => new Response(null, { status: 302, headers: { Location: APP_URL + "#strava=" + k } });

const URL_ = Deno.env.get("SUPABASE_URL")!;
const FN_URL = URL_ + "/functions/v1/strava-sync";
const svc = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function secret(env: string, vault: string) {
  const e = Deno.env.get(env);
  if (e) return e;
  const { data } = await svc.rpc("get_app_secret", { p_name: vault });
  return (data as string | null) || null;
}
async function creds() {
  const [id, sec] = await Promise.all([secret("STRAVA_CLIENT_ID", "strava_client_id"), secret("STRAVA_CLIENT_SECRET", "strava_client_secret")]);
  return id && sec ? { id, sec } : null;
}

type Link = { athlete_id: string; strava_athlete_id: number; access_token: string; refresh_token: string; expires_at: string; last_sync_at: string | null };

async function tokenReq(body: Record<string, string>) {
  const r = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("strava_token_" + r.status);
  return await r.json();
}
async function fresh(link: Link, c: { id: string; sec: string }) {
  if (new Date(link.expires_at).getTime() - Date.now() > 120_000) return link.access_token;
  const t = await tokenReq({ client_id: c.id, client_secret: c.sec, grant_type: "refresh_token", refresh_token: link.refresh_token });
  const upd = { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: new Date(t.expires_at * 1000).toISOString(), updated_at: new Date().toISOString() };
  await svc.from("strava_links").update(upd).eq("athlete_id", link.athlete_id);
  Object.assign(link, upd);
  return t.access_token as string;
}
async function api(token: string, path: string) {
  const r = await fetch("https://www.strava.com/api/v3" + path, { headers: { Authorization: "Bearer " + token } });
  if (r.status === 429) throw new Error("strava_rate_limit");
  if (!r.ok) throw new Error("strava_api_" + r.status);
  return await r.json();
}

// ---------- mapping Strava activity → workout_logs row ----------
function sportOf(t: string) {
  const s = (t || "").toLowerCase();
  if (s.includes("swim")) return "swim";
  if (s.includes("ride") || s.includes("cycl") || s === "velomobile" || s === "handcycle") return "bike";
  if (s.includes("run") || s === "walk" || s === "hike") return "run";
  return "gym";
}
type Prof = { q: { form?: { ftp?: number; lthr?: number; hrMax?: number } } | null };
function load(sport: string, durS: number, np: number, hr: number, p: Prof) {
  const f = p?.q?.form || {};
  const ftp = +(f.ftp || 0), h = durS / 3600;
  if (sport === "bike" && ftp && np) { const IF = np / ftp; return { tss: Math.round(h * IF * IF * 100), IF: +IF.toFixed(2) }; }
  const lt = +(f.lthr || 0) || (+(f.hrMax || 0) ? Math.round(+f.hrMax! * 0.89) : 0);
  if (hr && lt) { const IF = Math.min(1.3, hr / lt); return { tss: Math.round(h * IF * IF * 100), IF: +IF.toFixed(2) }; }
  return { tss: Math.round((durS / 60) * 25 / 60 * 1.1), IF: null };
}
// deno-lint-ignore no-explicit-any
function rowOf(a: any, uid: string, p: Prof) {
  const sport = sportOf(a.sport_type || a.type);
  const dur = a.moving_time || a.elapsed_time || 0;
  const distM = +a.distance || 0;
  const dist = distM > 0 ? (sport === "swim" ? Math.round(distM) : +(distM / 1000).toFixed(2)) : null;
  const np = a.device_watts ? Math.round(a.weighted_average_watts || 0) : 0;
  const L = load(sport, dur, np || (a.device_watts ? a.average_watts : 0), a.average_heartrate || 0, p);
  const pace = dist && (sport === "run" || sport === "swim") ? Math.round(sport === "run" ? dur / dist : dur / dist * 100) : null;
  return {
    athlete_id: uid, day: String(a.start_date_local || a.start_date).slice(0, 10), sport, title: String(a.name || "").slice(0, 120) || "Strava",
    status: "done", duration_min: Math.max(1, Math.min(1440, Math.round(dur / 60))), distance: dist,
    avg_power: a.average_watts ? Math.round(a.average_watts) : null, np: np || null, max_power: a.max_watts ? Math.round(a.max_watts) : null,
    avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null, max_hr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    cadence: a.average_cadence ? Math.round(sport === "run" ? a.average_cadence * 2 : a.average_cadence) : null,
    elevation_m: a.total_elevation_gain && sport !== "swim" ? Math.round(a.total_elevation_gain) : null,
    kcal: a.calories ? Math.round(a.calories) : a.kilojoules ? Math.round(a.kilojoules) : null,
    pace_sec: pace, tss: L.tss, intensity: L.IF, started_at: a.start_date, external_id: "strava:" + a.id,
    device: a.device_name ? String(a.device_name).slice(0, 60) : "Strava", source: "strava",
    decoupling: a.__dec != null ? a.__dec : null,
    route_polyline: a.map?.summary_polyline || null,
  };
}
function weekStart(day: string) {
  const d = new Date(day + "T00:00:00Z");
  const i = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - i);
  return { ws: d.toISOString().slice(0, 10), i };
}
// ---------- stream helpers (same formulas as the file importer in src/import.js) ----------
const avgOf = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function npOf(samples: number[], times: number[] | null) {
  let s = samples;
  if (times && times.length === samples.length && times.length > 1) {
    const t0 = times[0], t1 = times[times.length - 1];
    if (t1 - t0 >= 60 && t1 - t0 < 86400) { const r: number[] = []; let j = 0; for (let t = t0; t <= t1; t++) { while (j + 1 < times.length && times[j + 1] <= t) j++; r.push(samples[j]); } s = r; }
  }
  if (s.length < 60) return 0;
  const roll: number[] = []; let a = 0;
  for (let i = 0; i < s.length; i++) { a += s[i]; if (i >= 30) a -= s[i - 30]; if (i >= 29) roll.push(a / 30); }
  return Math.pow(roll.reduce((x, v) => x + v ** 4, 0) / roll.length, 0.25);
}
// aerobic decoupling Pa:Hr (%), warm-up (10 min) skipped; null when < 40 min or no power+HR
function decOf(t: number[], pw: number[], hr: number[]) {
  const v: { t: number; pw: number; hr: number }[] = [];
  for (let i = 0; i < t.length; i++) { const x = { t: t[i], pw: pw[i], hr: hr[i] }; if (isFinite(x.t) && x.pw >= 0 && x.pw < 3000 && x.hr > 40 && x.hr < 230) v.push(x); }
  if (v.length < 120) return null;
  v.sort((a, b) => a.t - b.t);
  const t0 = v[0].t + 600, t1 = v[v.length - 1].t;
  if (t1 - v[0].t < 2400) return null;
  const w = v.filter((x) => x.t >= t0); if (w.length < 100) return null;
  const mid = (t0 + t1) / 2, A = w.filter((x) => x.t < mid), B = w.filter((x) => x.t >= mid);
  if (A.length < 40 || B.length < 40) return null;
  const ef = (h: typeof v) => avgOf(h.map((x) => x.pw)) / avgOf(h.map((x) => x.hr));
  const e1 = ef(A), e2 = ef(B);
  if (!(e1 > 0) || avgOf(A.map((x) => x.pw)) < 50) return null;
  const d = (e1 - e2) / e1 * 100;
  return isFinite(d) ? Math.max(-30, Math.min(40, +d.toFixed(1))) : null;
}
// Detail + streams for ONE activity (2 requests). Strava's API has no original .fit/.gpx, so HR/power/cadence come from streams;
// the route (latlng) and altitude series are NOT stored (the workout_logs schema keeps summary numbers only, like the file importer).
// deno-lint-ignore no-explicit-any
async function enrich(token: string, a: any) {
  // deno-lint-ignore no-explicit-any
  const out: any = { ...a };
  try {
    const d = await api(token, "/activities/" + encodeURIComponent(String(a.id)) + "?include_all_efforts=false");
    Object.assign(out, d);
  } catch (e) { if ((e as Error).message === "strava_rate_limit") throw e; }
  if (out.manual) return out;
  try {
    const keys = ["time", "heartrate", "cadence"].concat(out.device_watts ? ["watts"] : []).join(",");
    const S = await api(token, "/activities/" + encodeURIComponent(String(a.id)) + "/streams?key_by_type=true&keys=" + keys);
    const g = (k: string): number[] => (S && S[k] && Array.isArray(S[k].data) ? S[k].data.map((x: unknown) => +(x as number)) : []);
    const t = g("time"), hr = g("heartrate"), w = g("watts"), cad = g("cadence");
    const hv = hr.filter((x) => x > 30 && x < 230);
    if (hv.length > 30) { if (!out.average_heartrate) out.average_heartrate = avgOf(hv); out.max_heartrate = Math.max(out.max_heartrate || 0, ...hv); }
    const cv = cad.filter((x) => x > 0);
    if (cv.length > 30 && !out.average_cadence) out.average_cadence = avgOf(cv);
    if (w.length > 30 && out.device_watts) {
      const wv = w.map((x) => (isFinite(x) && x >= 0 && x < 3000 ? x : 0));
      if (!out.average_watts) out.average_watts = avgOf(wv);
      out.max_watts = Math.max(out.max_watts || 0, ...wv);
      const np = npOf(wv, t.length === wv.length ? t : null);
      if (np) out.weighted_average_watts = np;
      if (hr.length === wv.length && t.length === wv.length) out.__dec = decOf(t, wv, hr);
    }
  } catch (e) { if ((e as Error).message === "strava_rate_limit") throw e; /* streams are optional (manual / private / no sensors) */ }
  return out;
}
// empty placeholder = a log with no real data: no external id / file, never imported from a device, and either a missed day
// (status skipped) or a «done» record with no metrics at all. Anything with metrics, a file or an external id is real data → stays «duplicate».
// deno-lint-ignore no-explicit-any
function isPlaceholder(l: any) {
  if (l.external_id || l.file_path || l.source === "file" || l.source === "strava" || l.source === "garmin" || l.source === "board") return false;
  if (l.status === "skipped") return true;
  return !(l.duration_min > 0) && !(+l.distance > 0) && !l.avg_power && !l.np && !l.avg_hr && !l.max_hr && !(l.tss > 0) && !(l.kcal > 0);
}
// local midnight..midnight of `day` in the client's timezone (IANA name, else fixed offset in minutes) as epoch seconds
function tzOffsetMin(tz: string, atMs: number) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const o: Record<string, number> = {}; for (const p of f.formatToParts(new Date(atMs))) if (p.type !== "literal") o[p.type] = +p.value;
  return (Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second) - Math.floor(atMs / 1000) * 1000) / 60000;
}
function dayRange(day: string, tz: string | null, offMin: number | null) {
  const [y, m, d] = day.split("-").map(Number);
  const utcMid = Date.UTC(y, m - 1, d);
  const at = (dd: number) => {
    if (tz) { try { const g = utcMid + dd * 864e5; let off = tzOffsetMin(tz, g - 12 * 3600e3); off = tzOffsetMin(tz, g - off * 60e3); return Math.floor((g - off * 60e3) / 1000); } catch (_) { /* bad tz → fall through */ } }
    return Math.floor((utcMid + dd * 864e5 - (offMin || 0) * 60e3) / 1000);
  };
  return { after: at(0), before: at(1) };
}
type Source = "backfill" | "webhook" | "manual" | "manual_day";
// deno-lint-ignore no-explicit-any
async function store(db: SupabaseClient, uid: string, acts: any[], source: Source, token: string | null = null) {
  const all = acts.filter((a) => a && a.id);
  if (!all.length) return { imported: 0, skipped: 0, filled: 0, rate_limited: false };
  const { data: prof } = await db.from("profiles").select("q").eq("id", uid).maybeSingle();
  // per-activity result, saved to strava_activity_sync so the UI can show «у TRITON ✓» / «не імпортовано» + reason
  // deno-lint-ignore no-explicit-any
  const rec = new Map<number, any>();
  // deno-lint-ignore no-explicit-any
  const note = (a: any, status: string, reason: string | null, logId: number | null) => rec.set(+a.id, {
    athlete_id: uid, strava_activity_id: +a.id, start_date: a.start_date || null, name: String(a.name || "").slice(0, 120) || null,
    sport_type: String(a.sport_type || a.type || "").slice(0, 40) || null, distance_m: a.distance != null ? +a.distance : null,
    moving_s: a.moving_time != null ? Math.round(+a.moving_time) : null, status, reason, workout_log_id: logId, source, synced_at: new Date().toISOString(),
  });
  const cand = all.filter((a) => !a.manual_only);
  const pairs = cand.map((a) => ({ a, r: rowOf(a, uid, prof as Prof) }));
  for (const { a, r } of pairs) if (r.duration_min < 1) note(a, "skipped", "too_short", null);
  const rows = pairs.filter((x) => x.r.duration_min >= 1);
  let imported = 0, skipped = 0, filled = 0, rateLimited = false;
  if (rows.length) {
    const days = [...new Set(rows.map((x) => x.r.day))].sort();
    const { data: ex } = await db.from("workout_logs").select("id,day,sport,title,started_at,duration_min,distance,avg_power,np,avg_hr,max_hr,tss,kcal,external_id,file_path,source,workout_id,status").eq("athlete_id", uid).gte("day", days[0]).lte("day", days[days.length - 1]);
    const have = ex || [];
    const { data: plans } = await db.from("plan_weeks").select("week_start,days").eq("athlete_id", uid).in("week_start", [...new Set(days.map((d) => weekStart(d).ws))]);
    for (const { a, r: r0 } of rows) {
      let r = r0;
      const t = Date.parse(r.started_at);
      const same = have.find((l) => l.external_id === r.external_id);
      if (same) { skipped++; note(a, "imported", null, same.id); continue; }
      const near = have.find((l) => l.started_at && Math.abs(Date.parse(l.started_at) - t) <= 300_000 && (!l.duration_min || Math.abs(l.duration_min - r.duration_min) <= Math.max(5, l.duration_min * 0.15)));
      // an empty placeholder (missed / metric-less record) on that day is filled instead of reported as a duplicate; real data is never touched
      const ph = near ? (isPlaceholder(near) ? near : null) : have.find((l) => l.day === r.day && l.sport === r.sport && isPlaceholder(l));
      if (near && !ph) { skipped++; note(a, "skipped", "duplicate", near.id); continue; }
      // full detail + streams only for activities we really write (2 requests each; stops quietly on 429)
      if (token && !rateLimited) {
        try { r = rowOf(await enrich(token, a), uid, prof as Prof); } catch (e) { if ((e as Error).message === "strava_rate_limit") rateLimited = true; else console.error("enrich", (e as Error).message); }
      }
      // auto-match a planned workout of the same sport on that day
      const { ws, i } = weekStart(r.day);
      const pw = (plans || []).find((p) => p.week_start === ws);
      // deno-lint-ignore no-explicit-any
      const it = pw && Array.isArray(pw.days) ? ((pw.days as any[]).find((d) => d && d.i === i) || (pw.days as any[])[i])?.items?.find((x: any) => x && x.sport === r.sport && x.w) : null;
      const planW = it && !have.some((l) => l.day === r.day && l.status === "done" && l.workout_id === it.w) ? it.w : null;
      if (ph) {
        // UPDATE only (no INSERT → no notification trigger); keeps id, workout_id/plan link, title, note, rpe
        // deno-lint-ignore no-unused-vars
        const { athlete_id: _u, day: _d, ...rest } = r;
        const patch = { ...rest, title: ph.title || r.title, workout_id: ph.workout_id || planW, skip_reason: null, status: "done" };
        const { data, error } = await db.from("workout_logs").update(patch).eq("id", ph.id).eq("athlete_id", uid).is("external_id", null).select("id");
        if (error) { console.error("fill", error.code); skipped++; note(a, "error", "db_error", null); continue; }
        if (data && data.length) { filled++; Object.assign(ph, { external_id: r.external_id, source: "strava", status: "done", duration_min: r.duration_min, started_at: r.started_at }); note(a, "imported", "filled_placeholder", ph.id); }
        else { skipped++; note(a, "skipped", "duplicate", ph.id); }
        continue;
      }
      const row = { ...r, workout_id: planW };
      const { data, error } = await db.from("workout_logs").upsert(row, { onConflict: "athlete_id,external_id", ignoreDuplicates: true }).select("id,day,sport,title,started_at,duration_min,distance,avg_power,np,avg_hr,max_hr,tss,kcal,external_id,file_path,source,workout_id,status");
      if (error) { console.error("insert", error.code); skipped++; note(a, "error", "db_error", null); continue; }
      if (data && data.length) { imported++; have.push(data[0]); note(a, "imported", null, data[0].id); } else { skipped++; note(a, "skipped", "duplicate", null); }
    }
  }
  // never downgrade an activity we already imported earlier (e.g. a re-sync sees it as «already there»)
  const ids = [...rec.keys()];
  if (ids.length) {
    const { data: old } = await db.from("strava_activity_sync").select("strava_activity_id").eq("athlete_id", uid).eq("status", "imported").in("strava_activity_id", ids);
    for (const o of old || []) rec.delete(+o.strava_activity_id);
    if (rec.size) {
      const { error } = await db.from("strava_activity_sync").upsert([...rec.values()], { onConflict: "athlete_id,strava_activity_id" });
      if (error) console.error("sync-log", error.code);
    }
  }
  return { imported, skipped, filled, rate_limited: rateLimited };
}
// First sync after connecting (backfilled_at is null) = backfill: last 30 days in at most 2 Strava requests
// (covers yesterday / the day before / today and gives the AI planner some history). Later syncs are incremental.
async function syncUser(uid: string, c: { id: string; sec: string }, source: Source = "manual") {
  const { data: link } = await svc.from("strava_links").select("*").eq("athlete_id", uid).maybeSingle();
  if (!link) return { error: "not_connected" };
  const token = await fresh(link as Link, c);
  const backfill = !link.backfilled_at;
  const since = backfill ? Date.now() - 30 * 864e5 : link.last_sync_at ? Date.parse(link.last_sync_at) - 3 * 864e5 : Date.now() - 30 * 864e5;
  // deno-lint-ignore no-explicit-any
  const acts: any[] = [];
  for (let page = 1; page <= (backfill ? 2 : 3); page++) {
    const a = await api(token, `/athlete/activities?after=${Math.floor(since / 1000)}&per_page=100&page=${page}`);
    if (!Array.isArray(a) || !a.length) break;
    acts.push(...a);
    if (a.length < 100) break;
  }
  const res = await store(svc, uid, acts, backfill ? "backfill" : source);
  const now = new Date().toISOString();
  await svc.from("strava_links").update(backfill ? { last_sync_at: now, backfilled_at: now } : { last_sync_at: now }).eq("athlete_id", uid);
  return { ...res, backfill, total: acts.length };
}

async function userOf(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await svc.auth.getUser(jwt);
  if (error || !data?.user) return null;
  const uid = data.user.id;
  const [{ data: pr }, { data: co }] = await Promise.all([
    svc.from("profiles").select("status").eq("id", uid).maybeSingle(),
    svc.from("coaches").select("user_id").eq("user_id", uid).maybeSingle(),
  ]);
  return { uid, member: !!co || pr?.status === "active", admin: !!co };
}
function rnd() { const b = new Uint8Array(24); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(""); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);
  try {
    // ---- Strava webhook subscription validation ----
    if (req.method === "GET" && u.searchParams.get("hub.mode") === "subscribe") {
      const vt = await secret("STRAVA_WEBHOOK_VERIFY_TOKEN", "strava_webhook_verify_token");
      if (!vt || u.searchParams.get("hub.verify_token") !== vt) return json({ error: "forbidden" }, 403);
      return json({ "hub.challenge": u.searchParams.get("hub.challenge") });
    }
    // ---- OAuth callback (browser redirect from Strava) ----
    if (req.method === "GET" && u.searchParams.get("action") === "callback") {
      const c = await creds();
      const state = u.searchParams.get("state") || "";
      const { data: stRow } = await svc.from("strava_oauth_states").select("athlete_id,created_at").eq("state", state).maybeSingle();
      if (state) await svc.from("strava_oauth_states").delete().eq("state", state);
      if (!c || !stRow || Date.now() - Date.parse(stRow.created_at) > 15 * 60_000) return back("error");
      if (u.searchParams.get("error")) return back("denied");
      const scope = u.searchParams.get("scope") || "";
      if (!/activity:read/.test(scope)) return back("denied");
      const t = await tokenReq({ client_id: c.id, client_secret: c.sec, code: u.searchParams.get("code") || "", grant_type: "authorization_code" });
      const sid = t?.athlete?.id;
      if (!sid) return back("error");
      const { data: other } = await svc.from("strava_links").select("athlete_id").eq("strava_athlete_id", sid).maybeSingle();
      if (other && other.athlete_id !== stRow.athlete_id) return back("taken");
      const { error } = await svc.from("strava_links").upsert({
        athlete_id: stRow.athlete_id, strava_athlete_id: sid, access_token: t.access_token, refresh_token: t.refresh_token,
        expires_at: new Date(t.expires_at * 1000).toISOString(), scope, athlete_name: [t.athlete.firstname, t.athlete.lastname].filter(Boolean).join(" ").slice(0, 80),
        updated_at: new Date().toISOString(),
      }, { onConflict: "athlete_id" });
      if (error) return back("error");
      // initial backfill right after connecting (failure is non-fatal: the first manual/auto sync from the app repeats it)
      try { await syncUser(stRow.athlete_id, c, "backfill"); } catch (e) { console.error("backfill", (e as Error).message); }
      return back("ok");
    }
    if (req.method !== "POST") return json({ error: "method" }, 405);
    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

    // ---- Strava webhook event (no JWT; we only trust data re-fetched from Strava with the owner's token) ----
    if (body && body.object_type && body.aspect_type && body.owner_id) {
      const c = await creds();
      if (!c) return json({ ok: true });
      const { data: link } = await svc.from("strava_links").select("*").eq("strava_athlete_id", body.owner_id).maybeSingle();
      if (!link) return json({ ok: true });
      if (body.object_type === "athlete" && body.updates && String(body.updates.authorized) === "false") {
        await svc.from("strava_links").delete().eq("athlete_id", link.athlete_id);
        return json({ ok: true });
      }
      if (body.object_type === "activity" && body.aspect_type === "create") {
        const { data: pr } = await svc.from("profiles").select("status").eq("id", link.athlete_id).maybeSingle();
        const { data: co } = await svc.from("coaches").select("user_id").eq("user_id", link.athlete_id).maybeSingle();
        if (!co && pr?.status !== "active") return json({ ok: true });
        try {
          const token = await fresh(link as Link, c);
          const a = await api(token, "/activities/" + encodeURIComponent(String(body.object_id)));
          await store(svc, link.athlete_id, [a], "webhook");
        } catch (e) { console.error("webhook", (e as Error).message); }
      }
      return json({ ok: true });
    }

    // ---- user actions ----
    const action = String(body.action || "");
    const c = await creds();
    if (action === "config") return json({ enabled: !!c });
    const me = await userOf(req);
    if (!me) return json({ error: "unauthorized" }, 401);
    if (!me.member) return json({ error: "forbidden" }, 403);
    if (!c) return json({ error: "strava_not_configured", enabled: false }, 503);

    if (action === "connect") {
      await svc.from("strava_oauth_states").delete().eq("athlete_id", me.uid);
      const state = rnd();
      await svc.from("strava_oauth_states").insert({ state, athlete_id: me.uid });
      const q = new URLSearchParams({ client_id: c.id, response_type: "code", redirect_uri: FN_URL + "?action=callback", approval_prompt: "auto", scope: "read,activity:read_all", state });
      return json({ url: "https://www.strava.com/oauth/authorize?" + q.toString() });
    }
    if (action === "sync") {
      const r = await syncUser(me.uid, c);
      if ("error" in r) return json(r, 400);
      return json({ ok: true, ...r });
    }
    if (action === "sync_day") {
      const day = String(body.day || "");
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
      if (!m || isNaN(Date.parse(day + "T00:00:00Z"))) return json({ error: "bad_day" }, 400);
      const nowUtc = Date.now();
      if (Date.parse(day + "T00:00:00Z") > nowUtc + 36 * 3600e3 || Date.parse(day + "T00:00:00Z") < nowUtc - 400 * 864e5) return json({ error: "bad_day" }, 400);
      const tz = typeof body.tz === "string" && body.tz.length < 60 ? body.tz : null;
      const off = Number.isFinite(+body.tz_offset_min) ? Math.max(-840, Math.min(840, +body.tz_offset_min)) : 0;
      const { data: link } = await svc.from("strava_links").select("*").eq("athlete_id", me.uid).maybeSingle();
      if (!link) return json({ error: "not_connected" }, 400);
      const token = await fresh(link as Link, c);
      const { after, before } = dayRange(day, tz, off);
      // 1 request for the list; then ≤ 2 requests (detail + streams) per activity we actually write; at most 6 activities
      // deno-lint-ignore no-explicit-any
      const list: any[] = await api(token, `/athlete/activities?after=${after}&before=${before}&per_page=30`);
      const acts = (Array.isArray(list) ? list : []).sort((x, y) => Date.parse(x.start_date) - Date.parse(y.start_date)).slice(0, 6);
      const res = await store(svc, me.uid, acts, "manual_day", token);
      await svc.from("strava_links").update({ last_sync_at: new Date().toISOString() }).eq("athlete_id", me.uid);
      return json({ ok: true, day, total: acts.length, ...res });
    }
    if (action === "disconnect") {
      const { data: link } = await svc.from("strava_links").select("*").eq("athlete_id", me.uid).maybeSingle();
      if (link) {
        try { const token = await fresh(link as Link, c); await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { Authorization: "Bearer " + token } }); } catch (_) { /* revoke best-effort */ }
        await svc.from("strava_links").delete().eq("athlete_id", me.uid);
      }
      return json({ ok: true });
    }
    // admin: create / inspect the Strava push subscription (one per Strava app)
    if (action === "webhook_subscribe" || action === "webhook_status") {
      if (!me.admin) return json({ error: "forbidden" }, 403);
      if (action === "webhook_status") {
        const r = await fetch(`https://www.strava.com/api/v3/push_subscriptions?client_id=${encodeURIComponent(c.id)}&client_secret=${encodeURIComponent(c.sec)}`);
        return json({ status: r.status, subscriptions: r.ok ? await r.json() : null });
      }
      const vt = await secret("STRAVA_WEBHOOK_VERIFY_TOKEN", "strava_webhook_verify_token");
      if (!vt) return json({ error: "no_verify_token" }, 400);
      const fd = new FormData();
      fd.set("client_id", c.id); fd.set("client_secret", c.sec); fd.set("callback_url", FN_URL); fd.set("verify_token", vt);
      const r = await fetch("https://www.strava.com/api/v3/push_subscriptions", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      return json({ status: r.status, id: j.id ?? null, errors: j.errors ?? null });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("strava-sync", (e as Error).message);
    return json({ error: (e as Error).message.startsWith("strava_") ? (e as Error).message : "server_error" }, 500);
  }
});
