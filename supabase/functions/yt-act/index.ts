import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const ACCOUNTS = ["personal", "scintilla"] as const;
type Account = typeof ACCOUNTS[number];
/* Watch Later is the one real Personal YouTube identity. SCINTILLA feed
   subscriptions are project-side RSS channel membership, not a browser OAuth
   flow and not a second device-code connection. */
const ACTION_ACCOUNT: Account = "personal";
/* This is the existing cross-device list used by the Hub Social YouTube
   surface.  Station must attach to it, never fork a second Station list. */
const WATCH_LATER_PLAYLIST_TITLE = "SCINTILLA · Watch Later";
const LEGACY_WATCH_LATER_PLAYLIST_TITLES = new Set(["Station Watch Later"]);
const WATCH_LATER_MIGRATION_KEY = "yt_wl_playlist_personal_migration_v1";
const WATCH_LATER_CACHE_KEY = "yt_wl_playlist_personal_ids_v1";

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

async function playlistVideoIds(token: string, playlistId: string) {
  const ids: string[] = [];
  let pageToken = "";
  for (let page = 0; page < 4; page++) {
    const r = await yt(
      token,
      "GET",
      "playlistItems?part=contentDetails&maxResults=50&playlistId=" + encodeURIComponent(playlistId) +
        (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""),
    );
    if (r.status >= 300) return { ok: false, ids };
    for (const item of r.body?.items || []) {
      const videoId = item.contentDetails?.videoId;
      if (videoId) ids.push(videoId);
    }
    pageToken = r.body?.nextPageToken || "";
    if (!pageToken) break;
  }
  return { ok: true, ids };
}

function watchCacheIds(value: unknown) {
  try {
    const ids = JSON.parse(typeof value === "string" ? value : "[]");
    if (!Array.isArray(ids)) return null;
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{6,}$/.test(id))));
  } catch (_) {
    return null;
  }
}

async function readWatchCache(sb: any) {
  const { data } = await sb.from("app_config").select("value")
    .eq("key", WATCH_LATER_CACHE_KEY).maybeSingle();
  return watchCacheIds(data?.value);
}

async function writeWatchCache(sb: any, ids: string[]) {
  await sb.from("app_config").upsert({
    key: WATCH_LATER_CACHE_KEY,
    value: JSON.stringify(Array.from(new Set(ids))),
  });
}

async function updateWatchCache(sb: any, videoId: string, include: boolean) {
  const cached = await readWatchCache(sb);
  if (cached) {
    const next = new Set(cached);
    if (include) next.add(videoId); else next.delete(videoId);
    await writeWatchCache(sb, Array.from(next));
  }
  /* This is the fast, cross-device read model.  Google remains the authority
     for writes, but Station and Hub never wait on its playlist endpoint just
     to render a saved-video list. */
  if (include) {
    await sb.from("yt_watch_later").upsert({ video_id: videoId, updated_at: new Date().toISOString() });
  } else {
    await sb.from("yt_watch_later").delete().eq("video_id", videoId);
  }
}

async function migrateLegacyWatchLater(
  sb: any,
  token: string,
  canonicalId: string,
  legacyIds: string[],
  migrationMark: string,
) {
  if (!legacyIds.length || migrationMark === canonicalId + ":" + legacyIds.join(",")) return;
  const canonical = await playlistVideoIds(token, canonicalId);
  if (!canonical.ok) return;
  const already = new Set(canonical.ids);
  let complete = true;
  for (const legacyId of legacyIds) {
    if (!legacyId || legacyId === canonicalId) continue;
    const legacy = await playlistVideoIds(token, legacyId);
    if (!legacy.ok) { complete = false; continue; }
    for (const videoId of legacy.ids) {
      if (already.has(videoId)) continue;
      const added = await yt(token, "POST", "playlistItems?part=snippet", {
        snippet: { playlistId: canonicalId, resourceId: { kind: "youtube#video", videoId } },
      });
      if (added.status < 300) already.add(videoId);
      else complete = false;
    }
  }
  if (complete) {
    await sb.from("app_config").upsert({
      key: WATCH_LATER_MIGRATION_KEY,
      value: canonicalId + ":" + legacyIds.join(","),
    });
  }
}

async function ensurePlaylist(sb: any, token: string) {
  const { data: cfg } = await sb.from("app_config")
    .select("key,value").in("key", [
      "yt_wl_playlist_personal",
      "yt_wl_playlist",
      WATCH_LATER_MIGRATION_KEY,
    ]);
  const saved: Record<string, string> = {};
  for (const row of cfg || []) saved[row.key] = row.value;
  const existingId = saved.yt_wl_playlist_personal;
  const legacyIds = new Set<string>([saved.yt_wl_playlist].filter(Boolean));
  let canonicalId: string | undefined;
  /* A playlist id can survive after the YouTube account that created it is
     changed or disconnected. Never let that stale id brick Watch Later. */
  if (existingId) {
    const check = await yt(token, "GET", "playlists?part=id,snippet&id=" + encodeURIComponent(existingId));
    const existing = check.body?.items?.[0];
    if (check.status < 300 && existing?.id === existingId &&
        existing?.snippet?.title === WATCH_LATER_PLAYLIST_TITLE) canonicalId = existingId;
    else legacyIds.add(existingId);
  }

  let mineItems: Array<{ id?: string; snippet?: { title?: string } }> = [];
  if (!canonicalId || saved[WATCH_LATER_MIGRATION_KEY] === undefined) {
    const mine = await yt(token, "GET", "playlists?part=snippet&mine=true&maxResults=50");
    mineItems = mine.body?.items || [];
  }
  if (!canonicalId) {
    const found = mineItems.find((item) => item.snippet?.title === WATCH_LATER_PLAYLIST_TITLE);
    canonicalId = found?.id;
  }
  if (!canonicalId) {
    const made = await yt(token, "POST", "playlists?part=snippet,status", {
      snippet: { title: WATCH_LATER_PLAYLIST_TITLE, description: "Saved from SCINTILLA" },
      status: { privacyStatus: "private" },
    });
    canonicalId = made.body?.id;
  }
  if (!canonicalId) return null;

  for (const item of mineItems) {
    if (item.id && LEGACY_WATCH_LATER_PLAYLIST_TITLES.has(item.snippet?.title || "")) legacyIds.add(item.id);
  }
  const legacy = Array.from(legacyIds).filter((id) => id && id !== canonicalId).sort();
  await sb.from("app_config").upsert({ key: "yt_wl_playlist_personal", value: canonicalId });
  if (legacy.length) {
    await migrateLegacyWatchLater(sb, token, canonicalId, legacy, saved[WATCH_LATER_MIGRATION_KEY] || "");
  }
  return canonicalId;
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
  if (action === "sub" && input.account === "scintilla") {
    const channelId = String(input.channelId || "");
    if (!channelId) return J({ error: "no channelId" });
    const cacheKey = "yt_sub_channels_scintilla";
    const { data: saved } = await sb.from("app_config").select("key,value")
      .in("key", [cacheKey, "yt_sub_channels"]);
    const config: Record<string, string> = {};
    for (const row of saved || []) config[row.key] = row.value;
    let ids: string[] = [];
    try { const parsed = JSON.parse(config[cacheKey] || config.yt_sub_channels || "{}"); ids = Array.isArray(parsed.ids) ? parsed.ids.filter((id) => typeof id === "string") : []; } catch (_) {}
    const already = ids.includes(channelId);
    if (!already) ids.push(channelId);
    await sb.from("app_config").upsert({
      key: cacheKey,
      value: JSON.stringify({ ids: Array.from(new Set(ids)), ts: Math.floor(Date.now() / 1000) }),
    });
    if (!already) await logSub(sb, channelId, input.channelTitle || "", "feed_sub", "scintilla");
    return J({ ok: true, already, account: "scintilla", target: "scintilla_feed" });
  }
  const account = ACTION_ACCOUNT;
  if (action === "list") {
    const cached = await readWatchCache(sb);
    if (cached) return J({ ok: true, account, ids: cached, cached: true });
    const auth = await accessToken(sb, account);
    if (!auth.token) {
      return J({ error: auth.error, account, status: auth.status || null, code: auth.code || null });
    }
    const token = auth.token;
    const playlist = await ensurePlaylist(sb, token);
    if (!playlist) return J({ error: "no playlist", account });
    const listed = await playlistVideoIds(token, playlist);
    if (!listed.ok) return J({ error: "playlist read failed", account });
    await writeWatchCache(sb, listed.ids);
    return J({ ok: true, account, ids: listed.ids });
  }

  const auth = await accessToken(sb, account);
  if (!auth.token) {
    return J({ error: auth.error, account, status: auth.status || null, code: auth.code || null });
  }
  const token = auth.token;

  if (action === "star") {
    if (!input.videoId) return J({ error: "no videoId" });
    const playlist = await ensurePlaylist(sb, token);
    if (!playlist) return J({ error: "no playlist", account });
    const existing = await yt(
      token,
      "GET",
      "playlistItems?part=id&playlistId=" + playlist + "&videoId=" + input.videoId + "&maxResults=1",
    );
    if (existing.body?.items?.[0]) {
      /* A previous YouTube-side save can predate the local read model. Repair
         that harmless drift here so the next Hub/Station read agrees. */
      await updateWatchCache(sb, input.videoId, true);
      return J({ ok: true, already: true, account });
    }
    const added = await yt(token, "POST", "playlistItems?part=snippet", {
      snippet: { playlistId: playlist, resourceId: { kind: "youtube#video", videoId: input.videoId } },
    });
    const ok = added.status < 300;
    if (ok) await updateWatchCache(sb, input.videoId, true);
    return J({ ok, status: added.status, account });
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
    if (!item) {
      /* Likewise, a stale local star must not survive an already-complete
         YouTube-side removal. */
      await updateWatchCache(sb, input.videoId, false);
      return J({ ok: true, note: "not in playlist", account });
    }
    const removed = await yt(token, "DELETE", "playlistItems?id=" + item.id);
    const ok = removed.status < 300;
    if (ok) await updateWatchCache(sb, input.videoId, false);
    return J({ ok, status: removed.status, account });
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
