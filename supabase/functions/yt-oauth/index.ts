import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";

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
const CALLER_KEYS = new Set(
  [
    keyFromJson("SUPABASE_PUBLISHABLE_KEYS", "default"),
    Deno.env.get("SUPABASE_ANON_KEY") || "",
  ].filter(Boolean),
);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};
const J = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS });

// Device authorization deliberately requires a user gesture at google.com.
// The function stores only the pending device code and the returned refresh
// token; it never receives the user's Google password.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!CALLER_KEYS.has(req.headers.get("apikey") || "")) return J({ error: "unauthorized" }, 401);
  if (!SB_URL || !SB_KEY) return J({ error: "backend credentials unavailable" });

  const sb = createClient(SB_URL, SB_KEY);
  const { data: cfg, error } = await sb
    .from("app_config")
    .select("key,value")
    .in("key", ["YT_OAUTH_CLIENT_ID", "YT_OAUTH_CLIENT_SECRET", "yt_device_code"]);
  if (error) return J({ error: "oauth config unavailable" });
  const c: Record<string, string> = {};
  for (const row of cfg || []) c[row.key] = row.value;
  if (!c.YT_OAUTH_CLIENT_ID || !c.YT_OAUTH_CLIENT_SECRET) {
    return J({ error: "no oauth client configured" });
  }

  const step = new URL(req.url).searchParams.get("step") || "start";
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
    const { error: saveError } = await sb.from("app_config").upsert({ key: "yt_device_code", value: body.device_code });
    if (saveError) return J({ error: "could not save pending authorization" });
    return J({
      user_code: body.user_code,
      url: body.verification_url || "https://www.google.com/device",
      expires_in: body.expires_in,
      interval: body.interval || 5,
    });
  }

  if (step === "poll") {
    if (!c.yt_device_code) return J({ error: "no pending device code" });
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: c.YT_OAUTH_CLIENT_ID,
        client_secret: c.YT_OAUTH_CLIENT_SECRET,
        device_code: c.yt_device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const body = await r.json();
    if (body.refresh_token) {
      const { error: saveError } = await sb.from("app_config").upsert([
        { key: "YT_REFRESH_TOKEN", value: body.refresh_token },
        { key: "yt_device_code", value: "" },
      ]);
      if (saveError) return J({ error: "could not save authorization" });
      return J({ ok: true, connected: true });
    }
    return J({ ok: false, status: body.error || "pending" });
  }

  return J({ error: "unknown step" });
});
