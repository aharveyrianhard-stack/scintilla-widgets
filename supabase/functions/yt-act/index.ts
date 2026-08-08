import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";

function adminKey() {
  const current = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (current) {
    try {
      const keys = JSON.parse(current);
      if (typeof keys.default === "string" && keys.default) return keys.default;
      const first = Object.values(keys).find((v) => typeof v === "string" && v);
      if (typeof first === "string") return first;
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

const SB_KEY = adminKey();

function callerKeys() {
  const keys = new Set<string>();
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) keys.add(legacy);
  const current = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (current) {
    try {
      for (const value of Object.values(JSON.parse(current))) {
        if (typeof value === "string" && value) keys.add(value);
      }
    } catch (_) {}
  }
  return keys;
}

const CALLER_KEYS = callerKeys();
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};
const J = (o: unknown) => new Response(JSON.stringify(o), { headers: CORS });

// v6: prefer Supabase's current secret-key environment over the legacy
// service-role key. This restores the admin client used to read the OAuth
// configuration behind RLS while keeping a legacy fallback. Gateway JWT
// verification is disabled because current publishable keys are not JWTs;
// the handler accepts only this project's own public keys instead.
async function accessToken(sb: ReturnType<typeof createClient>) {
  const { data: cfg, error } = await sb
    .from("app_config")
    .select("key,value")
    .in("key", ["YT_OAUTH_CLIENT_ID", "YT_OAUTH_CLIENT_SECRET", "YT_REFRESH_TOKEN"]);
  if (error) return { error: "oauth config unavailable" };

  const c: Record<string, string> = {};
  for (const row of cfg || []) c[row.key] = row.value;
  if (!c.YT_OAUTH_CLIENT_ID || !c.YT_OAUTH_CLIENT_SECRET || !c.YT_REFRESH_TOKEN) {
    return { error: "not connected" };
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.YT_OAUTH_CLIENT_ID,
      client_secret: c.YT_OAUTH_CLIENT_SECRET,
      refresh_token: c.YT_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const body = await r.json();
  if (!r.ok || !body.access_token) {
    return { error: "youtube authorization unavailable", status: r.status, code: body.error || null };
  }
  return { token: body.access_token as string };
}

async function yt(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch("https://www.googleapis.com/youtube/v3/" + path, {
    method,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  try {
    return { status: r.status, body: JSON.parse(text) };
  } catch (_) {
    return { status: r.status, body: null };
  }
}

async function logSub(sb: ReturnType<typeof createClient>, channelId: string, title: string, action: string) {
  try {
    await sb.from("yt_sub_log").insert({ channel_id: channelId, channel_title: title || null, action });
  } catch (_) {}
}

async function ensurePlaylist(sb: ReturnType<typeof createClient>, token: string) {
  const { data: saved } = await sb.from("app_config").select("value").eq("key", "yt_wl_playlist").maybeSingle();
  if (saved?.value) return saved.value as string;

  const mine = await yt(token, "GET", "playlists?part=snippet&mine=true&maxResults=50");
  const found = (mine.body?.items || []).find(
    (item: { snippet?: { title?: string } }) => item.snippet?.title === "SCINTILLA · Watch Later",
  );
  let id = found?.id as string | undefined;
  if (!id) {
    const made = await yt(token, "POST", "playlists?part=snippet,status", {
      snippet: { title: "SCINTILLA · Watch Later", description: "Saved from the SCINTILLA hub" },
      status: { privacyStatus: "private" },
    });
    id = made.body?.id;
  }
  if (id) await sb.from("app_config").upsert({ key: "yt_wl_playlist", value: id });
  return id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!CALLER_KEYS.has(req.headers.get("apikey") || "")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: CORS });
  }
  if (!SB_URL || !SB_KEY) return J({ error: "backend credentials unavailable" });

  const sb = createClient(SB_URL, SB_KEY);
  const auth = await accessToken(sb);
  if (!auth.token) return J({ error: auth.error, status: auth.status || null, code: auth.code || null });
  const token = auth.token;

  let input: Record<string, string> = {};
  try {
    input = await req.json();
  } catch (_) {}
  const action = input.action || new URL(req.url).searchParams.get("action") || "";

  if (action === "list") {
    const playlist = await ensurePlaylist(sb, token);
    if (!playlist) return J({ error: "no playlist" });
    const ids: string[] = [];
    let pageToken = "";
    for (let page = 0; page < 4; page++) {
      const r = await yt(
        token,
        "GET",
        "playlistItems?part=contentDetails&maxResults=50&playlistId=" + playlist +
          (pageToken ? "&pageToken=" + pageToken : ""),
      );
      if (r.status >= 300) return J({ error: "playlist read failed", status: r.status });
      for (const item of r.body?.items || []) {
        const videoId = item.contentDetails?.videoId;
        if (videoId) ids.push(videoId);
      }
      pageToken = r.body?.nextPageToken || "";
      if (!pageToken) break;
    }
    return J({ ok: true, ids });
  }

  if (action === "star") {
    if (!input.videoId) return J({ error: "no videoId" });
    const playlist = await ensurePlaylist(sb, token);
    if (!playlist) return J({ error: "no playlist" });
    const existing = await yt(
      token,
      "GET",
      "playlistItems?part=id&playlistId=" + playlist + "&videoId=" + input.videoId + "&maxResults=1",
    );
    if (existing.body?.items?.[0]) return J({ ok: true, already: true });
    const added = await yt(token, "POST", "playlistItems?part=snippet", {
      snippet: { playlistId: playlist, resourceId: { kind: "youtube#video", videoId: input.videoId } },
    });
    return J({ ok: added.status < 300, status: added.status });
  }

  if (action === "unstar") {
    if (!input.videoId) return J({ error: "no videoId" });
    const playlist = await ensurePlaylist(sb, token);
    if (!playlist) return J({ error: "no playlist" });
    const found = await yt(
      token,
      "GET",
      "playlistItems?part=id&playlistId=" + playlist + "&videoId=" + input.videoId + "&maxResults=1",
    );
    const item = found.body?.items?.[0];
    if (!item) return J({ ok: true, note: "not in playlist" });
    const removed = await yt(token, "DELETE", "playlistItems?id=" + item.id);
    return J({ ok: removed.status < 300, status: removed.status });
  }

  if (action === "sub") {
    if (!input.channelId) return J({ error: "no channelId" });
    const added = await yt(token, "POST", "subscriptions?part=snippet", {
      snippet: { resourceId: { kind: "youtube#channel", channelId: input.channelId } },
    });
    const duplicate = !!(added.body?.error && /subscriptionDuplicate/.test(JSON.stringify(added.body.error)));
    const ok = added.status < 300 || duplicate;
    if (ok) {
      try {
        const { data: saved } = await sb.from("app_config").select("value").eq("key", "yt_sub_channels").maybeSingle();
        const channels = saved?.value ? JSON.parse(saved.value) : { ids: [], ts: 0 };
        if (!channels.ids.includes(input.channelId)) {
          channels.ids = [...channels.ids, input.channelId];
          await sb.from("app_config").upsert({ key: "yt_sub_channels", value: JSON.stringify(channels) });
        }
      } catch (_) {}
      await logSub(sb, input.channelId, input.channelTitle || "", duplicate ? "sub_dup" : "sub");
    }
    return J({ ok, already: duplicate, status: added.status });
  }

  if (action === "unsub") {
    if (!input.channelId) return J({ error: "no channelId" });
    const found = await yt(
      token,
      "GET",
      "subscriptions?part=id&mine=true&forChannelId=" + input.channelId + "&maxResults=1",
    );
    const item = found.body?.items?.[0];
    let ok = true;
    let status = 204;
    if (item?.id) {
      const removed = await yt(token, "DELETE", "subscriptions?id=" + item.id);
      ok = removed.status < 300;
      status = removed.status;
    }
    if (ok) {
      try {
        const { data: saved } = await sb.from("app_config").select("value").eq("key", "yt_sub_channels").maybeSingle();
        const channels = saved?.value ? JSON.parse(saved.value) : { ids: [], ts: 0 };
        channels.ids = channels.ids.filter((id: string) => id !== input.channelId);
        await sb.from("app_config").upsert({ key: "yt_sub_channels", value: JSON.stringify(channels) });
      } catch (_) {}
      await logSub(sb, input.channelId, input.channelTitle || "", "unsub");
    }
    return J({ ok, status });
  }

  return J({ error: "unknown action" });
});
