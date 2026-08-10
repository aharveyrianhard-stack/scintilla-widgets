import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const ACCOUNTS = ["personal", "scintilla"] as const;
type Account = typeof ACCOUNTS[number];

function keyFromJson(name: string, preferred: string) {
  const raw = Deno.env.get(name);
  if (!raw) return "";
  try {
    const keys = JSON.parse(raw);
    if (typeof keys[preferred] === "string" && keys[preferred]) return keys[preferred];
    const first = Object.values(keys).find((value) => typeof value === "string" && value);
    return typeof first === "string" ? first : "";
  } catch (_) {
    return "";
  }
}

const SB_KEY = keyFromJson("SUPABASE_SECRET_KEYS", "default") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CALLER_KEYS = new Set([
  keyFromJson("SUPABASE_PUBLISHABLE_KEYS", "default"),
  Deno.env.get("SUPABASE_ANON_KEY") || "",
].filter(Boolean));
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};
const J = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS });

function accountFrom(req: Request): Account | null {
  const value = new URL(req.url).searchParams.get("account") || "";
  return ACCOUNTS.includes(value as Account) ? value as Account : null;
}

function configName(prefix: string, account: Account) {
  return prefix + "_" + account.toUpperCase();
}

async function channelIdentity(accessToken: string) {
  const r = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=1",
    { headers: { Authorization: "Bearer " + accessToken } },
  );
  const body = await r.json();
  const channel = body.items?.[0];
  if (!r.ok || !channel?.id) {
    return { error: body.error?.message || "YouTube channel identity unavailable", status: r.status };
  }
  return { id: channel.id as string, title: String(channel.snippet?.title || "") };
}

// Each Station YouTube identity gets its own pending device code, refresh
// token, channel ID, title and subscription cache. The browser still performs
// Google's required user-consent gesture; this function never sees a password.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!CALLER_KEYS.has(req.headers.get("apikey") || "")) return J({ error: "unauthorized" }, 401);
  if (!SB_URL || !SB_KEY) return J({ error: "backend credentials unavailable" });

  const sb = createClient(SB_URL, SB_KEY);
  const step = new URL(req.url).searchParams.get("step") || "status";

  if (step === "status") {
    const keys = ACCOUNTS.flatMap((account) => [
      configName("YT_REFRESH_TOKEN", account),
      configName("YT_CHANNEL_ID", account),
      configName("YT_CHANNEL_TITLE", account),
    ]);
    const { data, error } = await sb.from("app_config").select("key,value").in("key", keys);
    if (error) return J({ error: "oauth status unavailable" });
    const c: Record<string, string> = {};
    for (const row of data || []) c[row.key] = row.value;
    return J({
      accounts: Object.fromEntries(ACCOUNTS.map((account) => [account, {
        connected: !!c[configName("YT_REFRESH_TOKEN", account)],
        channel_id: c[configName("YT_CHANNEL_ID", account)] || null,
        channel_title: c[configName("YT_CHANNEL_TITLE", account)] || null,
      }])),
    });
  }

  const account = accountFrom(req);
  if (!account) return J({ error: "account must be personal or scintilla" }, 400);
  const pendingKey = "yt_device_code_" + account;
  const { data: cfg, error } = await sb.from("app_config")
    .select("key,value")
    .in("key", ["YT_OAUTH_CLIENT_ID", "YT_OAUTH_CLIENT_SECRET", pendingKey]);
  if (error) return J({ error: "oauth config unavailable" });
  const c: Record<string, string> = {};
  for (const row of cfg || []) c[row.key] = row.value;
  if (!c.YT_OAUTH_CLIENT_ID || !c.YT_OAUTH_CLIENT_SECRET) {
    return J({ error: "no oauth client configured" });
  }

  if (step === "start") {
    const r = await fetch("https://oauth2.googleapis.com/device/code", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: c.YT_OAUTH_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/youtube",
      }),
    });
    const body = await r.json();
    if (!r.ok || !body.device_code) {
      return J({ error: "device flow failed", status: r.status, code: body.error || null });
    }
    const { error: saveError } = await sb.from("app_config").upsert({
      key: pendingKey,
      value: body.device_code,
    });
    if (saveError) return J({ error: "could not save pending authorization" });
    return J({
      account,
      user_code: body.user_code,
      url: body.verification_url || "https://www.google.com/device",
      expires_in: body.expires_in,
      interval: body.interval || 5,
    });
  }

  if (step === "poll") {
    if (!c[pendingKey]) return J({ error: "no pending device code" });
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: c.YT_OAUTH_CLIENT_ID,
        client_secret: c.YT_OAUTH_CLIENT_SECRET,
        device_code: c[pendingKey],
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const body = await r.json();
    if (body.access_token && body.refresh_token) {
      const identity = await channelIdentity(body.access_token);
      if (!identity.id) return J({ error: identity.error, status: identity.status || null });
      const { error: saveError } = await sb.from("app_config").upsert([
        { key: configName("YT_REFRESH_TOKEN", account), value: body.refresh_token },
        { key: configName("YT_CHANNEL_ID", account), value: identity.id },
        { key: configName("YT_CHANNEL_TITLE", account), value: identity.title || account },
        { key: pendingKey, value: "" },
        { key: "yt_sub_channels_" + account, value: "" },
      ]);
      if (saveError) return J({ error: "could not save authorization" });
      return J({ ok: true, connected: true, account, channel_id: identity.id, channel_title: identity.title });
    }
    return J({ ok: false, account, status: body.error || "pending" });
  }

  return J({ error: "unknown step" });
});
