/* Y4 (6 Oct 2026) — the Station's YouTube grid: time order, no stream before it starts, the age you can read,
   where a tile came from, and a Watch Later that saves.
   Alan: "I absolutely need it in chronological order. Everything subscribed … I need to see it when it starts …
   I cannot see how long ago each thing was posted … 'shared watch later write failed, try again' and I can
   barely see the watch later thingy — maybe make it cyan like the ticker tags."
   Fixtures only: the page's functions are lifted out of both mounted shells and run as they are; the Watch Later
   function (supabase/functions/yt-act) is run whole against an in-memory table and a fake Google. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHELLS = ["scintilla-video-v1", "personal-video-v1"];
const SRC = new Map(SHELLS.map((name) => [name, fs.readFileSync(path.join(ROOT, "station-shells", name, "index.html"), "utf8")]));
const YT_ACT = fs.readFileSync(path.join(ROOT, "supabase/functions/yt-act/index.ts"), "utf8");

function source(src, name) {
  let start = src.indexOf(`async function ${name}(`);
  if (start === -1) start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, name + " exists");
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) break; }
  return src.slice(start, i + 1);
}
const constant = (src, name) => { const m = src.match(new RegExp("const " + name + " = ([^;]+(?:\\n[^;]+)?);")); assert.ok(m, name + " exists"); return "var " + name + " = " + m[1] + ";"; };
function ctxWith(src, names, globals = {}, constants = []) {
  const ctx = vm.createContext({ Date, isFinite, Array, Set, String, encodeURIComponent, ...globals });
  for (const name of constants) vm.runInContext(constant(src, name), ctx);
  for (const name of names) vm.runInContext(source(src, name), ctx);
  return ctx;
}
const css = (src) => src.slice(src.indexOf("<style"), src.indexOf("</style>"));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

test("both mounted shells carry the identical change", () => {
  assert.equal(SRC.get("scintilla-video-v1"), SRC.get("personal-video-v1"));
});

for (const [name, src] of SRC) {
  const queryCtx = (over = {}) => ctxWith(src, ["feedQuery"], {
    FEED_SELECT: "video_id", FEED_SELECT_LIVE: "video_id,feed_at,live_state,starts_at", FEED_LIVE_OK: true, LIMIT: 200, LIST: "default", MODE: "grid", TICK: "",
    FEED: "scintilla", WATCH: new Set(["abc"]), LISTS: [{ id: "default", n: "all", q: "" }, { id: "subscribed", n: "subscribed", q: "&subscription_accounts=cs.%7Bscintilla%7D" }, { id: "watch", n: "watch later", q: "" }],
    modeClause: (mode) => mode === "shorts" ? "&or=(is_short.eq.true,duration.like.0:*,duration.eq.1:00)" : "", ...over,
  }, ["NOT_UPCOMING", "SCINTILLA_SCOPE"]);

  test(name + ": THE ORDER — newest first by the moment it became watchable, and a stream still to come is not on the grid", () => {
    const q = queryCtx().feedQuery(0);
    assert.match(q, /order=feed_at\.desc/, "one clock: the actual start for a stream, the publish time for an upload");
    assert.match(q, /&live_state=neq\.upcoming/, "the five not-yet-started streams of 6 Oct are not tiles 2 to 6 any more");
    assert.doesNotMatch(q, /order=[^&]*,/, "nothing else is mixed into the order");
  });
  test(name + ": the SCINTILLA grid's scope is asked of the database — what the account carries, plus what a ticker search found", () => {
    const q = queryCtx().feedQuery(0);
    assert.ok(q.includes("&or=(subscription_accounts.cs.%7Bscintilla%7D,subscription_accounts.eq.%7B%7D)"), q);
    /* a second or= (the shorts tab) is a second condition, not a replacement */
    const shorts = queryCtx({ MODE: "shorts" }).feedQuery(0);
    assert.equal(shorts.match(/&or=\(/g).length, 2);
    /* the subscribed list and another feed carry their own scope and are not given this one */
    assert.ok(!queryCtx({ LIST: "subscribed" }).feedQuery(0).includes("subscription_accounts.eq."));
    const personal = queryCtx({ FEED: "personal", LISTS: [{ id: "default", n: "subscribed", q: "&subscription_accounts=cs.%7Bpersonal%7D" }] }).feedQuery(0);
    assert.ok(personal.includes("cs.%7Bpersonal%7D") && !personal.includes("subscription_accounts.eq.") && personal.includes("live_state=neq.upcoming"));
  });
  test(name + ": Watch Later keeps what Alan saved, whatever its state — a saved stream still to come stays listed", () => {
    const q = queryCtx({ LIST: "watch" }).feedQuery(0);
    assert.ok(q.includes("video_id=in.(abc)") && !q.includes("neq.upcoming") && !q.includes("subscription_accounts"));
  });
  test(name + ": a feed from before the stream times is left exactly as it was", () => {
    const q = queryCtx({ FEED_LIVE_OK: false }).feedQuery(0);
    assert.ok(q.includes("order=published_at.desc") && !q.includes("live_state"));
  });
  test(name + ": no cap that hides subscribed videos — the page is 200 and the grid goes on to 5,000 rows by scrolling", () => {
    assert.match(src, /const MAX_ROWS = Math\.max\(LIMIT, Math\.min\(20000, \+\(QS\.get\("max"\) \|\| 5000\)\)\);/);
    assert.match(source(src, "loadMore"), /PAGE_MORE = raw\.length >= LIMIT && PAGE_AT < MAX_ROWS;/, "the next page is asked for while pages come back full");
    assert.match(source(src, "load"), /const nextRows = liveFirst\(filterFeedRows\(raw\), await readOnAir\(\)\);/, "on air first (Y2), then time order");
  });

  test(name + ": HOW LONG AGO — every tile says it, a stream on air says LIVE · started N ago, and it can be read", () => {
    const NOW = Date.parse("2026-10-06T13:33:00Z");
    const ctx = ctxWith(src, ["videoPublishedMs", "videoAgeLabel", "videoWhen", "videoAgeHTML"], { esc, VIDEO_AGE_NONE: "", VIDEO_PUBLISHED_SHAPE: /^\d{4}-\d{2}-\d{2}[T ]/,
      Date: class extends Date { static now() { return NOW; } } });
    const upload = ctx.videoAgeHTML({ video_id: "LO8pn24ATts", published_at: "2026-10-06T01:43:42+00:00", feed_at: "2026-10-06T01:43:42+00:00", live_state: "none" });
    assert.match(upload, />11h ago</, "Market Signal's Micron / WDC / Seagate video: 11 hours");
    assert.doesNotMatch(upload, /data-live/);
    const live = ctx.videoAgeHTML({ video_id: "WcYb6afGmZc", published_at: "2026-10-05T20:00:00+00:00", feed_at: "2026-10-06T13:30:10+00:00", live_state: "live" });
    assert.match(live, /data-live="1"[^>]*>2m ago</, "2 min 50 s since the start of the stream (floored) — not 17 hours since it was scheduled");
    const ended = ctx.videoAgeHTML({ video_id: "PGzloCU5odg", published_at: "2026-10-06T12:01:28+00:00", feed_at: "2026-10-06T12:01:43+00:00", live_state: "was_live" });
    assert.match(ended, />1h ago</); assert.doesNotMatch(ended, /data-live/);
    const style = css(src);
    assert.match(style, /\.cap \.s \.age\[data-live\]::before\{ content:"LIVE \\00B7  started ";/);
    const age = style.match(/\.cap \.s \.age\{([^}]*)\}/)[1];
    assert.match(age, /color:var\(--ink2\)/, "the title's ink (11.96:1), not the dimmest one");
    assert.match(age, /font-size:10px/); assert.match(age, /font-weight:600/);
    assert.doesNotMatch(style, /body\.tiny \.cap \.s\{ display:none; \}/, "the smallest slots keep the age");
    assert.match(style, /body\.tiny \.cap \.s \.ch\{ display:none; \}/);
  });

  test(name + ": WHERE IT CAME FROM — a bell for a subscribed channel, a magnifier for a ticker-search result", () => {
    const ctx = ctxWith(src, ["videoSource", "sourceHTML"]);
    assert.equal(ctx.videoSource({ subscription_accounts: ["scintilla"] }), "sub");
    assert.equal(ctx.videoSource({ subscription_accounts: ["personal", "scintilla"] }), "sub");
    assert.equal(ctx.videoSource({ subscription_accounts: [] }), "search");
    assert.equal(ctx.videoSource({}), "search");
    assert.match(ctx.sourceHTML({ subscription_accounts: ["scintilla"] }), /data-src="sub" title="a channel this feed is subscribed to"/);
    assert.match(ctx.sourceHTML({ subscription_accounts: [] }), /data-src="search" title="found by the ticker search/);
    assert.match(source(src, "cardHTML"), /videoBadgeHTML\(v\) \+ sourceHTML\(v\)/, "on every tile, in the picture's corner");
    assert.match(css(src), /\.src\[data-src="search"\]\{ color:var\(--crk\); \}/, "the search mark is the ticker tag's cyan");
  });

  test(name + ": WATCH LATER you can see — a plate in the ticker tag's cyan, a filled SAVED state, the same on the bar", () => {
    const mk = (bind) => ctxWith(src, ["starHTML"], { esc, FEED: "scintilla", ...bind }).starHTML({ video_id: "vidX" });
    const unsaved = mk({ WATCH_READY: true, WATCH: new Set() }), saved = mk({ WATCH_READY: true, WATCH: new Set(["vidX"]) });
    assert.match(unsaved, /class="star"[^>]*aria-label="save to SCINTILLA Watch Later"[\s\S]*☆<\/span><b class="w">LATER<\/b>/);
    assert.match(saved, /class="star on"[^>]*aria-label="remove from SCINTILLA Watch Later"[\s\S]*★<\/span><b class="w">SAVED<\/b>/);
    const style = css(src), star = style.match(/\n\.star\{([^}]*)\}/)[1];
    assert.match(star, /border:1px solid var\(--crk\)/); assert.match(star, /color:var\(--crk\)/);
    assert.match(style, /\.star\.on\{ background:rgba\(0,212,255,\.92\); color:#04040a; \}/, "saved = the ticker tag's own fill");
    assert.match(style, /\.tk\{[^}]*background:rgba\(0,212,255,\.9\)/, "…which is this cyan");
    assert.match(style, /\.card:has\(\.star\.on\) \.cap\{ box-shadow:inset 0 2px 0 var\(--crk\); \}/, "a saved tile carries a cyan line");
    assert.match(style, /#bar #bWatchBar\{ color:var\(--crk\); border-color:var\(--crk\); \}/);
    assert.match(style, /#bar #bWatchBar\.on\{ background:rgba\(0,212,255,\.92\)/);
    assert.doesNotMatch(style, /\.star\.on\{ color:var\(--vol\)/, "the orange star is gone");
  });

  test(name + ": a refused save never reads as saved — 'ok:false' without an error word is a failure too", async () => {
    const run = async (answer) => {
      const ctx = ctxWith(src, ["ytAct"], { SB: "http://sb.test", PUBLIC: "pub", JSON, Object, Error,
        fetch: async () => ({ ok: true, status: 200, json: async () => answer }) });
      return ctx.ytAct("star", { videoId: "vidX" });
    };
    await assert.rejects(run({ ok: false, status: 403 }));
    await assert.rejects(run({ error: "personal YouTube authorization unavailable", code: "invalid_grant" }), /authorization unavailable/, "what the old function answered on 6 Oct");
    const ok = await run({ ok: true, saved: true, youtube: "waiting" });
    assert.equal(ok.saved, true, "what the new function answers while the Google sign-in is down");
  });
}

/* ---------- the Watch Later function, run whole ---------- */
function db(tables) {
  const log = [];
  function query(table) {
    const q = { filters: [], op: "select", payload: null, single: false };
    const key = table === "app_config" ? "key" : "video_id";
    const run = () => {
      const rows = () => tables[table].filter((row) => q.filters.every((f) => f(row)));
      if (tables.__fail === table && q.op !== "select") return { data: null, error: { message: "permission denied for table " + table } };
      if (q.op === "upsert") { for (const row of [].concat(q.payload)) { const i = tables[table].findIndex((r) => r[key] === row[key]); if (i >= 0) tables[table][i] = { ...tables[table][i], ...row }; else tables[table].push({ ...row }); log.push([table, "upsert", row[key]]); } return { data: null, error: null }; }
      if (q.op === "delete") { for (const row of rows()) { tables[table].splice(tables[table].indexOf(row), 1); log.push([table, "delete", row[key]]); } return { data: null, error: null }; }
      const out = rows().map((r) => ({ ...r }));
      return { data: q.single ? (out[0] || null) : out, error: null };
    };
    const api = { select: () => api, eq: (k, v) => { q.filters.push((r) => r[k] === v); return api; }, in: (k, list) => { q.filters.push((r) => list.includes(r[k])); return api; },
      maybeSingle: () => { q.single = true; return api; }, upsert: (p) => { q.op = "upsert"; q.payload = p; return api; }, delete: () => { q.op = "delete"; return api; },
      insert: (p) => { q.op = "upsert"; q.payload = p; return api; }, then: (ok, bad) => Promise.resolve().then(run).then(ok, bad) };
    return api;
  }
  return { tables, log, client: { from: query } };
}
let harness = 0;
async function act(body, { tables, google = "dead", playlist = [] } = {}) {
  const store = db(tables); const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url), method = init.method || "GET"; calls.push(method + " " + u.replace(/https:\/\/www\.googleapis\.com\/youtube\/v3\//, "yt:").replace(/access_token=[^&]+/, ""));
    const answer = (status, obj) => ({ ok: status < 300, status, json: async () => obj, text: async () => JSON.stringify(obj) });
    if (u.includes("oauth2.googleapis.com")) return google === "dead" ? answer(400, { error: "invalid_grant" }) : answer(200, { access_token: "tok" });
    if (u.includes("/playlists?")) return answer(200, { items: [{ id: "PL1", snippet: { title: "SCINTILLA · Watch Later" } }] });
    if (u.includes("/playlistItems?") && method === "GET") { const id = (u.match(/videoId=([^&]+)/) || [])[1]; return answer(200, { items: id ? (playlist.includes(id) ? [{ id: "item-" + id }] : []) : playlist.map((v) => ({ contentDetails: { videoId: v } })) }); }
    if (u.includes("/playlistItems?") && method === "POST") { if (google === "quota") return answer(403, { error: { message: "quotaExceeded" } }); playlist.push(JSON.parse(init.body).snippet.resourceId.videoId); return answer(200, { id: "new" }); }
    if (u.includes("/playlistItems?") && method === "DELETE") { const id = u.split("id=item-")[1]; playlist.splice(playlist.indexOf(id), 1); return answer(204, null); }
    throw new Error("unexpected request " + method + " " + u);
  };
  globalThis.__y4 = { createClient: () => store.client };
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "http://db.test", SUPABASE_SERVICE_ROLE_KEY: "service", SUPABASE_ANON_KEY: "pub" })[k] || "" }, serve: (h) => { globalThis.__y4.handler = h; } };
  const js = stripTypeScriptTypes(YT_ACT, { mode: "strip" }).replace(/import \{ createClient \} from "https:\/\/esm\.sh\/[^"]+";/, "const { createClient } = globalThis.__y4;");
  const file = path.join(os.tmpdir(), "y4-ytact-" + process.pid + "-" + (harness++) + ".mjs");
  fs.writeFileSync(file, js);
  try {
    await import(pathToFileURL(file).href);
    const response = await globalThis.__y4.handler(new Request("http://fn.test/yt-act", { method: "POST", headers: { apikey: "pub", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    return { status: response.status, answer: await response.json(), tables: store.tables, log: store.log, calls, playlist };
  } finally { globalThis.fetch = realFetch; fs.unlinkSync(file); delete globalThis.Deno; }
}
const config = (extra = {}) => Object.entries({ YT_OAUTH_CLIENT_ID: "id", YT_OAUTH_CLIENT_SECRET: "secret", YT_REFRESH_TOKEN_PERSONAL: "refresh", yt_wl_playlist_personal: "PL1",
  yt_wl_playlist_personal_migration_v1: "PL1:", ...extra }).map(([key, value]) => ({ key, value }));
const pendingOf = (tables) => JSON.parse(tables.app_config.find((r) => r.key === "yt_wl_pending_personal_v1")?.value || "null");

test("THE FAULT, 6 Oct: the Google sign-in answers invalid_grant — and the save still lands in our own list", async () => {
  const tables = { app_config: config({ yt_wl_playlist_personal_ids_v1: JSON.stringify(["old00000001"]) }), yt_watch_later: [{ video_id: "old00000001", updated_at: "2026-09-29T15:45:55Z" }] };
  const { answer, calls } = await act({ action: "star", videoId: "LO8pn24ATts", account: "personal" }, { tables });
  assert.deepEqual([answer.ok, answer.saved, answer.youtube, answer.code, answer.error], [true, true, "waiting", "invalid_grant", undefined], "no error word: the page reads it as saved");
  assert.deepEqual(tables.yt_watch_later.map((r) => r.video_id), ["old00000001", "LO8pn24ATts"], "the list the Station and the Hub read");
  assert.deepEqual(JSON.parse(tables.app_config.find((r) => r.key === "yt_wl_playlist_personal_ids_v1").value), ["old00000001", "LO8pn24ATts"], "and its cache");
  assert.deepEqual(pendingOf(tables), { add: ["LO8pn24ATts"], remove: [] }, "YouTube's playlist is owed one video");
  assert.deepEqual(calls, ["POST https://oauth2.googleapis.com/token"], "Google was asked once, after our own write");
  assert.doesNotMatch(JSON.stringify(answer), /refresh|secret|tok/, "nothing secret in the answer");
});
test("a removal while the sign-in is down also lands, and cancels a save that was still owed", async () => {
  const tables = { app_config: config({ yt_wl_pending_personal_v1: JSON.stringify({ add: ["LO8pn24ATts"], remove: [] }) }), yt_watch_later: [{ video_id: "LO8pn24ATts" }, { video_id: "old00000001" }] };
  const first = await act({ action: "unstar", videoId: "LO8pn24ATts" }, { tables });
  assert.equal(first.answer.saved, true);
  assert.deepEqual(tables.yt_watch_later.map((r) => r.video_id), ["old00000001"]);
  assert.deepEqual(pendingOf(tables), { add: [], remove: ["LO8pn24ATts"] });
  await act({ action: "unstar", videoId: "old00000001" }, { tables });
  assert.deepEqual(pendingOf(tables), { add: [], remove: ["LO8pn24ATts", "old00000001"] });
});
test("the sign-in comes back: the next save copies itself AND what was owed to YouTube's playlist", async () => {
  const tables = { app_config: config({ yt_wl_pending_personal_v1: JSON.stringify({ add: ["LO8pn24ATts", "PGzloCU5odg"], remove: ["gone0000001"] }) }),
    yt_watch_later: [{ video_id: "LO8pn24ATts" }, { video_id: "PGzloCU5odg" }] };
  const playlist = ["gone0000001", "old00000001"];
  const { answer } = await act({ action: "star", videoId: "8oCPuyVdKVM" }, { tables, google: "alive", playlist });
  assert.deepEqual([answer.ok, answer.saved, answer.youtube, answer.copied, answer.waiting], [true, true, "copied", 4, 0]);
  assert.deepEqual([...playlist].sort(), ["8oCPuyVdKVM", "LO8pn24ATts", "PGzloCU5odg", "old00000001"].sort(), "the playlist now agrees with our list");
  assert.deepEqual(pendingOf(tables), { add: [], remove: [] });
  assert.deepEqual(tables.yt_watch_later.map((r) => r.video_id).sort(), ["8oCPuyVdKVM", "LO8pn24ATts", "PGzloCU5odg"].sort());
});
test("the neighbours: YouTube refuses the copy (allowance spent) — the save stands, the copy waits; and only a few are sent per call", async () => {
  const tables = { app_config: config(), yt_watch_later: [] };
  const { answer } = await act({ action: "star", videoId: "LO8pn24ATts" }, { tables, google: "quota" });
  assert.deepEqual([answer.ok, answer.saved, answer.youtube, answer.status], [true, true, "waiting", 403]);
  assert.deepEqual(pendingOf(tables), { add: ["LO8pn24ATts"], remove: [] });
  assert.equal(tables.yt_watch_later.length, 1);
  const many = Array.from({ length: 30 }, (_, i) => "v" + String(i).padStart(10, "0"));
  const big = { app_config: config({ yt_wl_pending_personal_v1: JSON.stringify({ add: many, remove: [] }) }), yt_watch_later: [] };
  const run = await act({ action: "star", videoId: "LO8pn24ATts" }, { tables: big, google: "alive", playlist: [] });
  assert.equal(run.answer.copied, 8, "8 playlist writes a call at most — 50 units each of a 10,000-unit day");
  assert.equal(run.answer.waiting, 23);
  assert.match(YT_ACT, /const WATCH_LATER_PENDING_PER_CALL = 8;/);
});
test("our own list cannot be written: THAT is a failed save, and it says so", async () => {
  const tables = { app_config: config(), yt_watch_later: [], __fail: "yt_watch_later" };
  const { answer, calls } = await act({ action: "star", videoId: "LO8pn24ATts" }, { tables, google: "alive" });
  assert.deepEqual([answer.ok, answer.saved, answer.error], [false, false, "the watch-later list could not be written"]);
  assert.equal(calls.length, 0, "YouTube is not told about a save we did not keep");
});
test("what did not change: the caller's key is still required, a missing video id is refused before anything is written, reading the list needs no sign-in", async () => {
  const tables = { app_config: config({ yt_wl_playlist_personal_ids_v1: JSON.stringify(["old00000001"]) }), yt_watch_later: [{ video_id: "old00000001" }] };
  const none = await act({ action: "star" }, { tables });
  assert.equal(none.answer.error, "no videoId"); assert.equal(none.log.length, 0);
  const bad = await act({ action: "star", videoId: "x'); drop table--" }, { tables });
  assert.equal(bad.answer.error, "no videoId");
  const list = await act({ action: "list" }, { tables });
  assert.deepEqual([list.answer.ok, list.answer.ids, list.calls.length], [true, ["old00000001"], 0]);
  assert.match(YT_ACT, /if \(!CALLER_KEYS\.has\(req\.headers\.get\("apikey"\) \|\| ""\)\) return J\(\{ error: "unauthorized" \}, 401\);/);
  assert.doesNotMatch(YT_ACT, /eyJhbGciOi|sb_secret_|AIza[0-9A-Za-z_-]{20,}/, "no key in the source");
});
