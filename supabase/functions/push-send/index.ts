// Web Push delivery for TRITON Team.
// VAPID private key and webhook secret come from Vault (get_app_secret) or env.
// Never log keys, endpoints, or auth tokens.
import { createClient } from "npm:@supabase/supabase-js@2.119.2";
import { buildPushPayload } from "npm:@block65/webcrypto-web-push@2.0.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const SUBJECT = "https://palmyrateamodesa.github.io/team-training/";

type Link = Record<string, string> | null;
type SubRow = { id: number; endpoint: string; p256dh: string; auth: string };

function safeEq(a: string, b: string) {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let r = 0;
  for (let i = 0; i < ba.length; i++) r |= ba[i] ^ bb[i];
  return r === 0;
}

function clip(s: string, n = 140) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

function deepLink(kind: string, link: Link) {
  const L = link || {};
  const q = (k: string, v?: string) => (v ? `&${k}=${encodeURIComponent(v)}` : "");
  if (L.t === "dm" || kind === "dm") return `#go=dm${q("u", L.a || L.u)}`;
  if (L.t === "secchat" || kind === "sec_chat") return `#go=secchat${q("s", L.s)}`;
  if (L.t === "teamchat" || L.t === "chat" || kind === "chat") return `#go=teamchat`;
  if (L.t === "alt") return `#go=alt${q("s", L.s)}${q("post", L.post)}${q("a", L.a)}${q("d", L.d)}`;
  if (L.t === "board") return `#go=board${q("s", L.s)}${q("d", L.d)}`;
  if (L.t === "ready") return `#go=ready${q("a", L.a)}`;
  if (L.t === "events" || L.t === "ride") return `#go=events`;
  if (L.t === "feed" || L.t === "club") return `#go=feed${q("seg", L.seg)}`;
  if (L.t === "today") return `#go=today`;
  if (kind === "request") return `#go=req`;
  if (kind === "announce") return L.t === "feed" ? `#go=feed` : `#go=events`;
  if (kind === "comment" || kind === "join") return `#go=feed`;
  if (kind === "award") return `#go=ach`;
  if (kind === "points" || kind === "board" || kind === "board_mark") return `#go=board${q("s", L.s)}`;
  if (kind === "test") return `#go=today`;
  return `#go=today`;
}

function tagFor(kind: string, link: Link) {
  const L = link || {};
  if (kind === "chat") return "chat-team";
  if (kind === "sec_chat") return "chat-sec-" + (L.s || "x");
  if (kind === "dm") return "chat-dm-" + (L.a || L.u || "x");
  return "n-" + kind;
}

function prefColumn(kind: string, isCoach: boolean): "chats" | "dms" | "news" | "awards" | "coach_alerts" {
  if (kind === "chat" || kind === "sec_chat") return "chats";
  if (kind === "dm") return "dms";
  if (kind === "award" || kind === "points") return "awards";
  if (kind === "wellness" || kind === "skip" || kind === "redflag") return "coach_alerts";
  if (kind === "request") return isCoach ? "coach_alerts" : "news";
  return "news";
}

async function secretOf(admin: ReturnType<typeof createClient>, name: string, env: string) {
  const e = Deno.env.get(env);
  if (e) return e;
  const { data } = await admin.rpc("get_app_secret", { p_name: name });
  return (data as string | null) || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const webhookSecret = await secretOf(admin, "push_webhook_secret", "PUSH_WEBHOOK_SECRET");
  const given = req.headers.get("x-push-secret") || "";
  const isWebhook = !!(webhookSecret && given && safeEq(given, webhookSecret));

  let body: {
    action?: string;
    user_id?: string;
    kind?: string;
    title?: string;
    body?: string;
    link?: Link;
    notif_id?: number;
  } = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  let userId = body.user_id || "";
  let kind = body.kind || "test";
  let title = clip(String(body.title || ""), 80);
  let text = clip(String(body.body || ""), 160);
  let link: Link = body.link && typeof body.link === "object" ? body.link : null;

  if (!isWebhook) {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: u, error: ue } = await userClient.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (ue || !u?.user) return json({ error: "unauthorized" }, 401);
    if (body.action !== "test") return json({ error: "forbidden" }, 403);
    const uid = u.user.id;
    const [{ data: pr }, { data: co }] = await Promise.all([
      admin.from("profiles").select("status").eq("id", uid).maybeSingle(),
      admin.from("coaches").select("user_id").eq("user_id", uid).maybeSingle(),
    ]);
    if (!co && pr?.status !== "active") return json({ error: "forbidden" }, 403);
    userId = uid;
    kind = "test";
    title = "TRITON Team";
    text = "Сповіщення працюють. Так виглядатимуть повідомлення з чату та новини.";
    link = { t: "today" };
  }

  if (!userId) return json({ error: "user" }, 400);

  const [{ data: prof }, { data: coachRow }] = await Promise.all([
    admin.from("profiles").select("status").eq("id", userId).maybeSingle(),
    admin.from("coaches").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  const isCoach = !!coachRow;
  if (!isCoach && prof?.status !== "active") return json({ ok: true, skipped: "locked", sent: 0 });

  if (kind !== "test") {
    const { data: prefs } = await admin.from("push_prefs").select("chats,dms,news,awards,coach_alerts").eq("user_id", userId).maybeSingle();
    const col = prefColumn(kind, isCoach);
    if (prefs && prefs[col] === false) return json({ ok: true, skipped: "pref", sent: 0 });
  }

  const vapidPublic = (await secretOf(admin, "vapid_public_key", "VAPID_PUBLIC_KEY")) ||
    Deno.env.get("VAPID_PUBLIC_KEY") || null;
  const vapidPrivate = await secretOf(admin, "vapid_private_key", "VAPID_PRIVATE_KEY");
  if (!vapidPublic || !vapidPrivate) return json({ error: "not_configured" }, 500);

  const { data: subs, error: se } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);
  if (se) return json({ error: "db" }, 500);
  const list = (subs || []) as SubRow[];
  if (!list.length) return json({ ok: true, sent: 0, status: 0 });

  const payload = {
    title: title || "TRITON",
    body: text,
    tag: tagFor(kind, link),
    renotify: kind === "chat" || kind === "sec_chat" || kind === "dm",
    url: "./" + deepLink(kind, link),
  };

  let lastStatus = 0;
  let sent = 0;
  const dead: number[] = [];

  for (const s of list) {
    try {
      const built = await buildPushPayload(
        { data: JSON.stringify(payload), options: { ttl: 60 * 60 * 12, urgency: "normal" } },
        { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
        { subject: SUBJECT, publicKey: vapidPublic, privateKey: vapidPrivate },
      );
      const res = await fetch(s.endpoint, built);
      lastStatus = res.status;
      if (res.status === 404 || res.status === 410) dead.push(s.id);
      else if (res.status >= 200 && res.status < 300) sent++;
      else if (res.status === 401 || res.status === 403) dead.push(s.id);
    } catch {
      // leave the subscription; a later attempt may succeed
    }
  }

  if (dead.length) {
    await admin.from("push_subscriptions").delete().in("id", dead);
  }

  return json({ ok: true, sent, status: lastStatus, removed: dead.length });
});
