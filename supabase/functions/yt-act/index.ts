import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const ACCOUNTS = ["personal", "scintilla", "soundscapes", "golf", "ai_research", "fitness"] as const;
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
/* Y4 (6 Oct 2026) — Alan: "Watch later: 'shared watch later write failed, try again' … It's important for me to
   save the watch later ones." Measured that morning: the Personal Google sign-in answers invalid_grant, and a
   save stopped THERE, before our own list was touched — so nothing could be saved while the sign-in was down,
   although the list the Station and the Hub read (yt_watch_later) lives in our own database.
   The save is now our own list. YouTube's playlist is a copy that follows when the sign-in works: what could not
   be copied waits in WATCH_LATER_PENDING_KEY and is sent with the next save or removal that finds the sign-in
   alive (WATCH_LATER_PENDING_PER_CALL at a time — each playlist write costs 50 units of the YouTube allowance). */
const WATCH_LATER_PENDING_KEY = "yt_wl_pending_personal_v1";
const WATCH_LATER_PENDING_PER_CALL = 8;
const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;

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
  /* This is the saved list itself: the cross-device table the Station and the Hub read. Its write is the one
     that must land, so its error is returned — a save is only reported as saved when this row is written. */
  const write = include
    ? await sb.from("yt_watch_later").upsert({ video_id: videoId, updated_at: new Date().toISOString() })
    : await sb.from("yt_watch_later").delete().eq("video_id", videoId);
  if (write?.error) return { error: String(write.error.message || write.error) };
  const cached = await readWatchCache(sb);
  if (cached) {
    const next = new Set(cached);
    if (include) next.add(videoId); else next.delete(videoId);
    await writeWatchCache(sb, Array.from(next));
  }
  return { error: null };
}

/* What YouTube's playlist still has to be told. One video is in at most one of the two lists: a save after a
   removal cancels the removal, and the other way round. */
function pendingLists(value: unknown) {
  let parsed: any = null;
  try { parsed = JSON.parse(typeof value === "string" ? value : "null"); } catch (_) {}
  const clean = (list: unknown) => Array.from(new Set((Array.isArray(list) ? list : [])
    .filter((id) => typeof id === "string" && VIDEO_ID.test(id)))) as string[];
  return { add: clean(parsed?.add), remove: clean(parsed?.remove) };
}
function pendingWith(pending: { add: string[]; remove: string[] }, videoId: string, include: boolean | null) {
  const add = pending.add.filter((id) => id !== videoId), remove = pending.remove.filter((id) => id !== videoId);
  if (include === true) add.push(videoId);
  if (include === false) remove.push(videoId);
  return { add, remove };
}
async function readPending(sb: any) {
  const { data } = await sb.from("app_config").select("value").eq("key", WATCH_LATER_PENDING_KEY).maybeSingle();
  return pendingLists(data?.value);
}
async function writePending(sb: any, pending: { add: string[]; remove: string[] }) {
  await sb.from("app_config").upsert({ key: WATCH_LATER_PENDING_KEY, value: JSON.stringify(pending) });
}
/* One video, told to the playlist. ok = the playlist now agrees. A save YouTube already holds and an
   already-complete YouTube-side removal both count as agreed — and because our own list is written before this
   is asked, a stale local star never survives either of them. */
async function playlistSet(token: string, playlist: string, videoId: string, include: boolean) {
  const found = await yt(token, "GET",
    "playlistItems?part=id&playlistId=" + playlist + "&videoId=" + videoId + "&maxResults=1");
  if (found.status >= 300) return { ok: false, status: found.status };
  const item = found.body?.items?.[0];
  if (include) {
    if (item) return { ok: true, status: 200, already: true };
    const added = await yt(token, "POST", "playlistItems?part=snippet", {
      snippet: { playlistId: playlist, resourceId: { kind: "youtube#video", videoId } },
    });
    return { ok: added.status < 300, status: added.status };
  }
  if (!item) return { ok: true, status: 204, already: true };
  const removed = await yt(token, "DELETE", "playlistItems?id=" + item.id);
  return { ok: removed.status < 300, status: removed.status };
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
  /* The channel feeds Alan named on 22 Sep (soundscapes, golf, ai_research, fitness) subscribe the
     way SCINTILLA does above: project-side RSS membership under the account's own cache key, which
     the sweep polls and tags. A channel feed fills without any Google identity of its own. */
  const CHANNEL_FEEDS = ACCOUNTS.filter((a) => a !== "personal" && a !== "scintilla") as Account[];
  if (action === "sub" && CHANNEL_FEEDS.includes(input.account as Account)) {
    const feedAccount = input.account as Account;
    const channelId = String(input.channelId || "");
    if (!channelId) return J({ error: "no channelId" });
    const cacheKey = "yt_sub_channels_" + feedAccount;
    const { data: saved } = await sb.from("app_config").select("key,value").in("key", [cacheKey]);
    const config: Record<string, string> = {};
    for (const row of saved || []) config[row.key] = row.value;
    let ids: string[] = [];
    try { const parsed = JSON.parse(config[cacheKey] || "{}"); ids = Array.isArray(parsed.ids) ? parsed.ids.filter((id: unknown) => typeof id === "string") : []; } catch (_) {}
    const already = ids.includes(channelId);
    if (!already) ids.push(channelId);
    await sb.from("app_config").upsert({
      key: cacheKey,
      value: JSON.stringify({ ids: Array.from(new Set(ids)), ts: Math.floor(Date.now() / 1000) }),
    });
    if (!already) await logSub(sb, channelId, input.channelTitle || "", "feed_sub", feedAccount);
    return J({ ok: true, already, account: feedAccount, target: feedAccount + "_feed" });
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

  if (action === "star" || action === "unstar") {
    const videoId = String(input.videoId || "");
    if (!VIDEO_ID.test(videoId)) return J({ error: "no videoId" });
    const include = action === "star";
    /* 1 · OUR OWN LIST. This is the save. It needs no Google sign-in. */
    const saved = await updateWatchCache(sb, videoId, include);
    if (saved.error) return J({ ok: false, saved: false, error: "the watch-later list could not be written", account });
    /* 2 · YOUTUBE'S PLAYLIST, a copy. When the sign-in is down the change waits its turn. */
    let pending = pendingWith(await readPending(sb), videoId, include);
    const auth = await accessToken(sb, account);
    if (!auth.token) {
      await writePending(sb, pending);
      return J({ ok: true, saved: true, account, youtube: "waiting", waiting: pending.add.length + pending.remove.length,
        why: auth.error, code: auth.code || null });
    }
    const playlist = await ensurePlaylist(sb, auth.token);
    if (!playlist) {
      await writePending(sb, pending);
      return J({ ok: true, saved: true, account, youtube: "waiting", waiting: pending.add.length + pending.remove.length, why: "no playlist" });
    }
    /* this change first, then what was waiting — oldest first, a few at a time */
    const queue = [[videoId, include] as [string, boolean],
      ...pending.remove.filter((id) => id !== videoId).map((id) => [id, false] as [string, boolean]),
      ...pending.add.filter((id) => id !== videoId).map((id) => [id, true] as [string, boolean])]
      .slice(0, WATCH_LATER_PENDING_PER_CALL);
    let status = 0, copied = 0, thisOne = false;
    for (const [id, want] of queue) {
      const told = await playlistSet(auth.token, playlist, id, want);
      if (id === videoId) { thisOne = told.ok; status = told.status; }
      if (told.ok) { pending = pendingWith(pending, id, null); copied++; }
    }
    await writePending(sb, pending);
    return J({ ok: true, saved: true, account, youtube: thisOne ? "copied" : "waiting", status, copied,
      waiting: pending.add.length + pending.remove.length });
  }

  const auth = await accessToken(sb, account);
  if (!auth.token) {
    return J({ error: auth.error, account, status: auth.status || null, code: auth.code || null });
  }
  const token = auth.token;

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
