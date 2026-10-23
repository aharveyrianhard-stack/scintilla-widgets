/* W9 (22 Oct 2026), Alan: "put them on the feed at the time they're actually scheduled. And at time that live videos
   are scheduled, do a pull … If you have to reduce the amount of queries of the other videos where we search for tickers
   to give room for this, do that … I already see live videos on there for tomorrow, and then tomorrow I'm going to have
   to go and find them in the bottom."
   1. The Station's order (both video twins): on air first; a stream whose hour has come at the top even before YouTube
      calls it live; the rest of today's streams next, soonest first, "LIVE at 9:00am"; another day's stream not on the
      feed until its day; one whose hour passed an hour ago without a start back at its hour, "set for 8:15am".
      The clocks are tonight's and tomorrow's, the times are tomorrow's seven SCINTILLA streams as measured at
      23 Oct 00:00 ET (videos and channels made up).
   2. The staged collector and SQL: the pull at the hour, the streams the three-day window let go of, the day's units. */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const SHELLS = ["scintilla-video-v1", "personal-video-v1"];
const SRC = Object.fromEntries(SHELLS.map((n) => [n, read(`../station-shells/${n}/index.html`)]));
const STAGED = "../staged/w9-live-scheduled-20261022/";
const FN = STAGED + "supabase/functions/";

function source(src, name) {
  let start = src.indexOf(`async function ${name}(`);
  if (start === -1) start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    if (src[i] === "}") depth -= 1;
    if (depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(name + " never closes");
}
function pane(src) {
  const ctx = { Intl, Date, Math, Number, String, Array, Set, isFinite, esc: (s) => String(s == null ? "" : s) };
  vm.createContext(ctx);
  for (const line of src.match(/^const (?:START_TIME_NY|START_DAY_NY|NY_DAY|DUE_BEFORE_MS|DUE_AFTER_MS|ON_AIR_PIN_HOURS)\s*=[^;]+;$/gm) || []) vm.runInContext(line, ctx);
  vm.runInContext(src.match(/^const VIDEO_PUBLISHED_SHAPE = [^;]+;$/m)[0], ctx);
  vm.runInContext(src.match(/^const notOnTheFeedYet = [^;]+;$/m)[0] + "\nglobalThis.notOnTheFeedYet = notOnTheFeedYet;", ctx);
  for (const n of ["videoPublishedMs", "startLabel", "streamPlace", "scheduledInPlace", "onAirNow", "liveFirst", "videoBadgeHTML", "videoAgeHTML", "videoWhen", "videoAgeLabel"]) {
    vm.runInContext(source(src, n), ctx);
  }
  vm.runInContext("VIDEO_AGE_NONE = ''", ctx);
  return ctx;
}
const at = (iso) => Date.parse(iso);
const up = (id, starts, published) => ({ video_id: id, live_state: "upcoming", starts_at: starts, feed_at: starts, published_at: published, duration: null });
const upload = (id, published) => ({ video_id: id, live_state: "none", feed_at: published, published_at: published, duration: "12:00" });
/* tomorrow's seven SCINTILLA streams, as the feed served them at 23 Oct 00:00 ET (page 1, latest start first) */
const TOMORROW = [
  up("wrapup1620", "2026-10-23T20:20:00+00:00", "2026-10-22T20:36:00+00:00"),
  up("ai_1430", "2026-10-23T18:30:00+00:00", "2026-10-23T01:33:00+00:00"),
  up("crypto1330", "2026-10-23T17:30:00+00:00", "2026-10-22T19:56:00+00:00"),
  up("daytrd0930", "2026-10-23T13:30:00+00:00", "2026-10-18T20:43:00+00:00"),
  up("gameplan900", "2026-10-23T13:00:00+00:00", "2026-10-22T18:34:00+00:00"),
  up("bitcoin0900", "2026-10-23T13:00:00+00:00", "2026-10-22T13:30:00+00:00"),
  up("premkt0815", "2026-10-23T12:15:00+00:00", "2026-10-17T21:42:00+00:00"),
];
const UPLOADS = [upload("upload2331", "2026-10-23T03:31:00+00:00"), upload("upload2325", "2026-10-23T03:25:00+00:00"), upload("upload2258", "2026-10-23T02:58:00+00:00")];
/* deeper on the page: today's 8:15am that was never re-asked (still "upcoming"), and a stream four days out the feed files
   at the hour its page was made */
const STALE = up("premkt_thu", "2026-10-22T12:15:00+00:00", "2026-10-17T21:41:00+00:00");
const FAR = { ...up("etf_oct26", "2026-10-26T17:00:00+00:00", "2026-10-21T21:18:00+00:00"), feed_at: "2026-10-21T21:18:00+00:00" };
const PAGE = [...TOMORROW, ...UPLOADS, FAR, STALE];
/* arrays made inside the vm carry that realm's prototype: strict deepEqual wants this realm's */
const ids = (rows) => Array.from(rows, (v) => v.video_id);

for (const name of SHELLS) {
  const ctx = pane(SRC[name]);
  test(`W9 · ${name}: tonight, tomorrow's streams are not on the feed yet; the newest upload is on top`, () => {
    const now = at("2026-10-23T03:59:00Z");   // Thu 23:59 ET
    const rows = ctx.scheduledInPlace(PAGE, now);
    assert.deepEqual(ids(rows), ["upload2331", "upload2325", "upload2258", "premkt_thu"],
      "the seven of tomorrow and the one four days out wait for their day; Thursday's unasked 8:15am keeps its hour");
    assert.equal(ctx.streamPlace(TOMORROW[0], now), "later");
    assert.match(ctx.videoBadgeHTML(STALE, now), />set for 8:15am</, "an hour long gone does not claim to be coming");
  });
  test(`W9 · ${name}: in the morning the day's streams lead the page, soonest first, each "LIVE at …"`, () => {
    const now = at("2026-10-23T11:30:00Z");   // Fri 07:30 ET
    const rows = ctx.scheduledInPlace(PAGE, now);
    assert.deepEqual(ids(rows).slice(0, 7), ["premkt0815", "gameplan900", "bitcoin0900", "daytrd0930", "crypto1330", "ai_1430", "wrapup1620"]);
    assert.deepEqual(ids(rows).slice(7), ["upload2331", "upload2325", "upload2258", "premkt_thu"], "then the feed as before");
    assert.match(ctx.videoBadgeHTML(rows[0], now), /<span class="dur soon">LIVE at 8:15am<\/span>/);
    assert.match(ctx.videoBadgeHTML(rows[6], now), />LIVE at 4:20pm</);
    assert.equal(ctx.videoAgeHTML(rows[0]), "", "a stream still to come has no age; its corner says when");
  });
  test(`W9 · ${name}: at its hour a stream is at the top, before YouTube calls it live and after`, () => {
    let now = at("2026-10-23T12:14:00Z");     // 08:14 ET, a minute before the pre-market show
    let rows = ctx.scheduledInPlace(PAGE, now);
    assert.equal(rows[0].video_id, "premkt0815");
    assert.match(ctx.videoBadgeHTML(rows[0], now), /<span class="dur soon due">LIVE at 8:15am<\/span>/, "its time has come: bright");
    now = at("2026-10-23T13:01:00Z");         // 09:01 ET: the 8:15 show never re-asked, the two 9:00 streams not yet called live
    rows = ctx.scheduledInPlace(PAGE, now);
    assert.deepEqual(ids(rows).slice(0, 4), ["premkt0815", "gameplan900", "bitcoin0900", "daytrd0930"], "due first, earliest first, then today");
    /* the pull has caught the 9:00 game plan: YouTube calls it live, with its real start */
    const onAir = { ...TOMORROW[4], live_state: "live", feed_at: "2026-10-23T13:00:30+00:00", started_at: "2026-10-23T13:00:30+00:00", duration: "LIVE" };
    const page = PAGE.map((v) => (v.video_id === onAir.video_id ? onAir : v));
    rows = ctx.liveFirst(ctx.scheduledInPlace(page, now), [onAir], now);
    assert.deepEqual(ids(rows).slice(0, 3), ["gameplan900", "premkt0815", "bitcoin0900"], "on air first, then what is due");
    assert.match(ctx.videoBadgeHTML(rows[0], now), /class="dur live">LIVE</);
  });
  test(`W9 · ${name}: an hour past its start with no start, a stream goes back to its hour and says so`, () => {
    const now = at("2026-10-23T13:20:00Z");   // 09:20 ET: 65 minutes after 8:15, still "upcoming" in the table
    assert.equal(ctx.streamPlace(TOMORROW[6], now), "past");
    const rows = ctx.scheduledInPlace(PAGE, now);
    assert.deepEqual(ids(rows), ["gameplan900", "bitcoin0900", "daytrd0930", "crypto1330", "ai_1430", "wrapup1620",
      "premkt0815", "upload2331", "upload2325", "upload2258", "premkt_thu"], "it leaves the top for the page's own place: its hour");
    assert.match(ctx.videoBadgeHTML(TOMORROW[6], now), />set for 8:15am</);
    assert.equal(ctx.streamPlace({ ...TOMORROW[6], live_state: "was_live" }, now), null, "a stream that ran is an ordinary row at its real start");
    assert.equal(ctx.streamPlace({ ...TOMORROW[6], starts_at: null }, now), null, "no start time: an ordinary row, no invented badge");
  });
  test(`W9 · ${name}: the pages behind the first drop another day's streams too, and Watch Later keeps its order`, () => {
    const now = at("2026-10-23T03:59:00Z");
    assert.equal(ctx.notOnTheFeedYet(FAR, now), true);
    assert.equal(ctx.notOnTheFeedYet(STALE, now), false);
    assert.equal(ctx.notOnTheFeedYet(UPLOADS[0], now), false);
    const src = SRC[name];
    assert.match(source(src, "loadMore"), /filter\(\(v\) => !known\.has\(v\.video_id\) && !notOnTheFeedYet\(v\)\)/);
    assert.match(source(src, "load"), /const nextRows = liveFirst\(LIST === "watch" \? kept : scheduledInPlace\(kept\), await readOnAir\(\)\);/);
    assert.match(source(src, "load"), /streamPlace\(v\) \|\| ""\]\.join\("\|"\)/, "a stream becoming due repaints the page");
    assert.match(src, /\.dur\.soon\.due\{ color:#fff; \}/);
  });
}
test("W9 · the two video shells stay byte-identical twins", () => {
  assert.equal(SRC["personal-video-v1"], SRC["scintilla-video-v1"]);
});

/* ---------------- the staged collector, cron and searches ---------------- */
const DUE = await import(new URL(FN + "_shared/yt-live-due.mjs", import.meta.url));
const NOTICE = await import(new URL(FN + "_shared/yt-upload-notice.mjs", import.meta.url));
const SWEEP = read(FN + "yt-rss-sweep/index.ts");
const FEED = read(FN + "youtube-feed/index.ts");
const SQL = (f) => read(STAGED + "sql/" + f);

test("W9 · the door's and the pass's windows, the once-only settle and the day's count", () => {
  const now = Date.parse("2026-10-23T13:01:00Z") / 1000;
  assert.deepEqual(DUE.dueWindow(now), { from: "2026-10-23T12:46:00.000Z", to: "2026-10-23T13:03:00.000Z" });
  assert.deepEqual(DUE.settleWindow(now), { from: "2026-10-23T07:01:00.000Z", to: "2026-10-23T13:03:00.000Z" });
  /* Thursday's 8:15am show: last asked 20 Oct, before its hour -> asked once; once asked after its hour -> left alone */
  assert.equal(DUE.needsSettling({ live_scheduled_at: "2026-10-22T12:15:00Z", live_checked_ts: Date.parse("2026-10-20T21:40:00Z") / 1000 }), true);
  assert.equal(DUE.needsSettling({ live_scheduled_at: "2026-10-22T12:15:00Z", live_checked_ts: now }), false);
  assert.equal(DUE.needsSettling({ live_scheduled_at: null, live_checked_ts: 0 }), false);
  const row = DUE.nextDue({ raw: null, nowSec: now, sent: 1, asked: 3, moved: ["x"] });
  assert.equal(row.calls, 1);
  assert.equal(DUE.dueCallsToday(JSON.stringify(row), now), 1);
  assert.equal(DUE.dueCallsToday(JSON.stringify({ ...row, day: "2026-10-21" }), now), 0, "a new Pacific day starts at zero");
  assert.equal(DUE.dueRoom(JSON.stringify({ ...row, calls: DUE.DUE_UNITS_PER_DAY }), now), 0, "the door stops itself at its day's ceiling");
  assert.equal(DUE.DUE_UNITS_PER_DAY, 300);
});
test("W9 · the searches give 606 units and the subscriptions' guard gets them back", () => {
  assert.equal(DUE.searchMaxUnits(undefined), 7979, "no row: 79 searches, as today");
  assert.equal(DUE.searchMaxUnits("8000"), 7979);
  assert.equal(DUE.searchMaxUnits("7400"), 7373, "the row W9 sets: 73 searches");
  assert.equal(DUE.searchMaxUnits("0"), 7979, "youtube-feed reads 0 as the default too");
  assert.equal(DUE.searchMaxUnits("12000"), 8989, "clamped at 9000 like youtube-feed");
  assert.match(FEED, /Math\.min\(9000,Math\.max\(0,\+\(C\['yt_search_budget_units'\]\|\|SEARCH_BUDGET_UNITS\)\|\|SEARCH_BUDGET_UNITS\)\)/,
    "the clamp mirrored is youtube-feed's own");
  const now = Date.parse("2026-10-23T13:01:00Z") / 1000;
  const before = NOTICE.dayGuard({ nowSec: now, ownToday: 300 });
  const after = NOTICE.dayGuard({ nowSec: now, ownToday: 300, searchUnits: DUE.searchMaxUnits("7400") });
  assert.equal(after - before, 606);
  assert.equal(NOTICE.dayGuard({ nowSec: now, ownToday: 300 }), NOTICE.dayGuard({ nowSec: now, ownToday: 300, searchUnits: 7979 }), "no row: the guard is unchanged");
  assert.ok(300 + 288 <= 606, "the door's ceiling plus the worst extra re-ask call a pass fits the room");
  assert.match(SWEEP, /passBudget\(\{ health: health0, settings, nowSec: now, ownToday: ownBefore \+ dueToday, searchUnits \}\)/,
    "the door's calls are the sweep's own when the second way works out its day");
});
test("W9 · the 5-minute pass re-asks the streams near or past their hour whatever their page's age", () => {
  assert.match(SWEEP, /const REFRESH_DAYS = 3;/, "the three-day window stays for everything else");
  const i = SWEEP.indexOf("const settle = settleWindow(now);");
  assert.ok(i > 0);
  assert.match(SWEEP, /\.\.\.settleIds, \.\.\.\(watching \|\| \[\]\)\.map/, "they go before the three-day rows, inside REFRESH_MAX");
  assert.match(SWEEP, /\.filter\(needsSettling\)/);
  assert.match(SWEEP, /due_calls: dueToday/);
  assert.match(SWEEP, /live_settle: settled/);
});
test("W9 · the door: due streams only, one call, its own count, no lock and no other row", () => {
  const door = SWEEP.slice(SWEEP.indexOf('if (ask.get("due") === "1")'), SWEEP.indexOf("const configKeys = ["));
  assert.ok(door.length > 200);
  assert.match(door, /\.eq\("live_broadcast", "upcoming"\)\.gte\("live_scheduled_at", w\.from\)\.lte\("live_scheduled_at", w\.to\)/);
  assert.equal((door.match(/apiKeyRequest\(/g) || []).length, 1, "one videos call");
  assert.match(door, /dueRoom\(d\[DUE_KEY\], now\) < 1/);
  assert.ok(!/yt_rss_running/.test(door), "it takes no lock and leaves the pass's own");
  assert.ok(!/yt_rss_result/.test(door), "and never writes the pass's result row");
  assert.ok(SWEEP.indexOf('if (ask.get("due") === "1")') < SWEEP.indexOf('const { data: cfg } = await sb.from("app_config")'), "it answers before any pass work");
});
test("W9 · the search lane deletes only its own upcoming rows, never a followed channel's stream", () => {
  assert.match(FEED, /delete\(\)\.in\('video_id',upcomingIds\)\.eq\('source','search'\)/);
});
test("W9 · the SQL: one index, a job that only calls in a due minute, the room from the searches, each with its rollback", () => {
  const idx = SQL("01_live_due_index.sql"), idxBack = SQL("01_live_due_index_ROLLBACK.sql");
  assert.match(idx, /create index if not exists youtube_videos_upcoming_due_idx\s+on public\.youtube_videos \(live_scheduled_at\)\s+where live_broadcast = 'upcoming';/);
  assert.match(idxBack, /drop index if exists public\.youtube_videos_upcoming_due_idx;/);
  const cron = SQL("02_cron_yt_live_due.sql"), cronBack = SQL("02_cron_yt_live_due_ROLLBACK.sql");
  assert.match(cron, /cron\.schedule\('yt-live-due-1m', '\* \* \* \* \*', body\)/);
  assert.match(cron, /yt-rss-sweep\?due=1/);
  assert.match(cron, new RegExp(`between now\\(\\) - interval '${DUE.DUE_TAIL_MIN} minutes' and now\\(\\) \\+ interval '${DUE.DUE_LEAD_MIN} minutes'`),
    "the job's guard and the door ask the same window");
  assert.match(cron, /where exists \(/, "a quiet minute calls nothing");
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}/.test(cron), "no key in the file");
  assert.match(cronBack, /cron\.unschedule\('yt-live-due-1m'\)/);
  const room = SQL("03_search_budget_room.sql"), roomBack = SQL("03_search_budget_room_ROLLBACK.sql");
  assert.match(room, /values \('yt_search_budget_units', '7400'\)/);
  assert.match(room, /'yt_search_budget_units_before_w9'/);
  assert.match(roomBack, /b\.key = 'yt_search_budget_units_before_w9'/);
  assert.match(roomBack, /delete from public\.app_config where key = 'yt_search_budget_units_before_w9';/);
});
test("W9 · the staged folder is the deployed v13 (scintilla-hub 09ac89d) plus W9, file for file", () => {
  /* sha256 of the files W9 leaves alone, as downloaded from the project on 23 Oct 2026 04:05Z */
  const UNCHANGED = {
    "_shared/yt-bridge.mjs": "70fe3ebfd03ba388974bab6df8e1626dcb2bc289fbb9256dc61eed2a37423fa5",
    "_shared/yt-feed-fallback.mjs": "5d97b76ad6feee029c915659c4ec78bd0d91e73500449c992213c0192e61fc1b",
    "_shared/yt-lists.mjs": "542d733e4967a50bb9cae6ea3ec5f62767a39b1b82aa881f47c9e3abfc1bc8d2",
    "_shared/yt-search-plan.mjs": "06bdd9da8c142bcf0dc26681544cd4462f701e760463818ca1ecb0803d317269",
  };
  for (const [file, sha] of Object.entries(UNCHANGED)) {
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(new URL(FN + file, import.meta.url))).digest("hex"), sha, file);
  }
  const patch = read(STAGED + "w9-functions.patch");
  for (const f of ["_shared/yt-live-due.mjs", "_shared/yt-upload-notice.mjs", "youtube-feed/index.ts", "yt-rss-sweep/index.ts"]) {
    assert.ok(patch.includes("b/supabase/functions/" + f), "the patch carries " + f);
  }
});
