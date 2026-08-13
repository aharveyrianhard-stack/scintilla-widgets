import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const ACCOUNTS = ["personal", "scintilla"] as const;
type Account = typeof ACCOUNTS[number];
/* Station has two visible stored feeds, but one real YouTube identity.  The
   personal refresh token is the single durable authority for Watch Later and
   channel subscriptions; never surface a second device-code connection. */
const ACTION_ACCOUNT: Account = "personal";
/* This is the existing cross-device list used by the Hub Social YouTube
   surface.  Station must attach to it, never fork a second Station list. */
const WATCH_LATER_PLAYLIST_TITLE = "SCINTILLA · Watch Later";

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
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: CORS });

function configName(prefix: string, account: Account) {
  return prefix + "_" + account.toUpperCase();
}

async function accessToken(sb: any, account: Account) {
  const refreshKey = configName("YT_REFRESH_TOKEN", account);
  const { data: cfg, error } = await sb.from("app_config")
    .select("key,value")
    .in("key", ["YT_OAUTH_CLIENT_ID", "YT_OAUTH_CLIENT_SECRET", refreshKey]);
  if (error) return { error: "oauth config unavailable" };

  const c: Record<string, string> = {};
  for (const row of cfg || []) c[row.key] = row.value;
  if (!c.YT_OAUTH_CLIENT_ID || !c.YT_OAUTH_CLIENT_SECRET || !c[refreshKey]) {
    return { error: account + " YouTube is not connected" };
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.YT_OAUTH_CLIENT_ID,
      client_secret: c.YT_OAUTH_CLIENT_SECRET,
      refresh_token: c[refreshKey],
      grant_type: "refresh_token",
    }),
  });
  const body = await r.json();
  if (!r.ok || !body.access_token) {
    return {
      error: account + " YouTube authorization unavailable",
      status: r.status,
      code: body.error || null,
    };
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

async function logSub(
  sb: any,
  channelId: string,
  title: string,
  action: string,
  account: Account,
) {
  try {
    await sb.from("yt_sub_log").insert({
      channel_id: channelId,
      channel_title: title || null,
      action: action + ":" + account,
    });
  } catch (_) {}
}

async function ensurePlaylist(sb: any, token: string) {
  const { data: cfg } = await sb.from("app_config")
    .select("key,value").eq("key", "yt_wl_playlist_personal");
  const saved: Record<string, string> = {};
  for (const row of cfg || []) saved[row.key] = row.value;
  const existingId = saved.yt_wl_playlist_personal;
  /* A playlist id can survive after the YouTube account that created it is
     changed or disconnected. Never let that stale id brick Watch Later. */
  if (existingId) {
    const check = await yt(token, "GET", "playlists?part=id,snippet&id=" + encodeURIComponent(existingId));
    const existing = check.body?.items?.[0];
    if (check.status < 300 && existing?.id === existingId &&
        existing?.snippet?.title === WATCH_LATER_PLAYLIST_TITLE) return existingId;
  }

  const mine = await yt(token, "GET", "playlists?part=snippet&mine=true&maxResults=50");
  const found = (mine.body?.items || []).find(
    (item: { snippet?: { title?: string } }) => item.snippet?.title === WATCH_LATER_PLAYLIST_TITLE,
  );
  let id = found?.id as string | undefined;
  if (!id) {
    const made = await yt(token, "POST", "playlists?part=snippet,status", {
      snippet: { title: WATCH_LATER_PLAYLIST_TITLE, description: "Saved from SCINTILLA" },
      status: { privacyStatus: "private" },
    });
    id = made.body?.id;
  }
  if (id) {
    await sb.from("app_config").upsert({ key: "yt_wl_playlist_personal", value: id });
  }
  return id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!CALLER_KEYS.has(req.headers.get("apikey") || "")) return J({ error: "unauthorized" }, 401);
  if (!SB_URL || !SB_KEY) return J({ error: "backend credentials unavailable" }, 503);

  const sb = createClient(SB_URL, SB_KEY);
  let input: Record<string, string> = {};
  try {
    input = await req.json();
  } catch (_) {}
  const action = input.action || new URL(req.url).searchParams.get("action") || "";
  const account = ACTION_ACCOUNT;
  const auth = await accessToken(sb, account);
  if (!auth.token) {
    return J({ error: auth.error, account, status: auth.status || null, code: auth.code || null });
  }
  const token = auth.token;

  if (action === "list") {
    const playlist = await ensurePlaylist(sb, token);
    if (!playlist) return J({ error: "no playlist", account });
    const ids: string[] = [];
    let pageToken = "";
    for (let page = 0; page < 4; page++) {
      const r = await yt(
        token,
        "GET",
        "playlistItems?part=contentDetails&maxResults=50&playlistId=" + playlist +
          (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""),
      );
      if (r.status >= 300) return J({ error: "playlist read failed", status: r.status, account });
      for (const item of r.body?.items || []) {
        const videoId = item.contentDetails?.videoId;
        if (videoId) ids.push(videoId);
      }
      pageToken = r.body?.nextPageToken || "";
      if (!pageToken) break;
    }
    return J({ ok: true, account, ids });
  }

  if (action === "star") {
    if (!input.videoId) return J({ error: "no videoId" });
    const playlist = await ensurePlaylist(sb, token);
    if (!playlist) return J({ error: "no playlist", account });
    const existing = await yt(
      token,
      "GET",
      "playlistItems?part=id&playlistId=" + playlist + "&videoId=" + input.videoId + "&maxResults=1",
    );
    if (existing.body?.items?.[0]) return J({ ok: true, already: true, account });
    const added = await yt(token, "POST", "playlistItems?part=snippet", {
      snippet: { playlistId: playlist, resourceId: { kind: "youtube#video", videoId: input.videoId } },
    });
    return J({ ok: added.status < 300, status: added.status, account });
  }

  if (action === "unstar") {
    if (!input.videoId) return J({ error: "no videoId" });
    const playlist = await ensurePlaylist(sb, token);
    if (!playlist) return J({ error: "no playlist", account });
    const found = await yt(
      token,
      "GET",
      "playlistItems?part=id&playlistId=" + playlist + "&videoId=" + input.videoId + "&maxResults=1",
    );
    const item = found.body?.items?.[0];
    if (!item) return J({ ok: true, note: "not in playlist", account });
    const removed = await yt(token, "DELETE", "playlistItems?id=" + item.id);
    return J({ ok: removed.status < 300, status: removed.status, account });
  }

  const cacheKey = "yt_sub_channels_" + account;
  if (action === "sub") {
    if (!input.channelId) return J({ error: "no channelId" });
    const added = await yt(token, "POST", "subscriptions?part=snippet", {
      snippet: { resourceId: { kind: "youtube#channel", channelId: input.channelId } },
    });
    const duplicate = !!(added.body?.error && /subscriptionDuplicate/.test(JSON.stringify(added.body.error)));
    const ok = added.status < 300 || duplicate;
    if (ok) {
      // Force the next collector run to refresh this account's authoritative list.
      await sb.from("app_config").upsert({ key: cacheKey, value: "" });
      await logSub(sb, input.channelId, input.channelTitle || "", duplicate ? "sub_dup" : "sub", account);
    }
    return J({ ok, already: duplicate, status: added.status, account });
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
      await sb.from("app_config").upsert({ key: cacheKey, value: "" });
      await logSub(sb, input.channelId, input.channelTitle || "", "unsub", account);
    }
    return J({ ok, status, account });
  }

  return J({ error: "unknown action" }, 400);
});
