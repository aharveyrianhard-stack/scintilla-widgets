/* SCI-31 — a live stream showed up where it was SCHEDULED, not where it happened.
   ==============================================================================
   Measured on the live feed at 23 Sep 14:30 ET. Both of Verified Investing's streams
   were in youtube_videos and neither was on the grid:

     lS4LtT8LZcY  "A New AI Killer For Stocks…"   published_at 2026-09-22T18:45:34Z
                                                  actually started 2026-09-23T13:00:18Z
     f7JOaa_BJfs  "Bitcoin WARNING…"              published_at 2026-09-22T18:47:33Z
                                                  actually started 2026-09-23T17:30:25Z

   YouTube's channel feed dates a stream from when it was SCHEDULED, so both carried
   yesterday's date. 242 feed rows hold a newer publish time and the grid's first page
   is 200, so they were not on it. Future Investing's GPU-futures stream (rxvVxxBwJTc,
   published 16:39Z, on air from 17:00Z) was published minutes before it started, which
   is exactly why that one came through.

   What this file holds:
     1. The grid is ordered by when a stream actually happened, not by the date the
        feed handed it while it was still only scheduled.
     2. A stream on air says LIVE. One still to come says when it starts, and is not
        dropped on the way in.
     3. The database change can land before or after the shells: an older feed still
        reads, and a shell that meets an older feed still fills.
     4. Both mounted shells carry it, because the deck pins each pane to its own
        surface and a fix applied to one is not applied to the Station.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SHELLS = ["scintilla-video-v1", "personal-video-v1"];
const SRC = new Map(SHELLS.map((name) =>
  [name, fs.readFileSync(new URL(`../station-shells/${name}/index.html`, import.meta.url), "utf8")]));
const SWEEP = fs.readFileSync(new URL("../supabase/functions/yt-rss-sweep/index.ts", import.meta.url), "utf8");
const SQL = fs.readFileSync(new URL("../supabase/migrations/20260923_youtube_live_streams.sql", import.meta.url), "utf8");

function source(src, name) {
  let start = src.indexOf(`async function ${name}(`);
  if (start === -1) start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = src.indexOf("{", start); i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    if (src[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return src.slice(start, end);
}
function ctxWith(src, names, extra = {}) {
  const ctx = {
    Intl, Date, Math, Number, String, isFinite, encodeURIComponent, Promise,
    esc: (s) => String(s == null ? "" : s),
    videoPublishedMs: (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}[T ]/.test(v) ? Date.parse(v) : null),
    ...extra,
  };
  vm.createContext(ctx);
  for (const line of src.match(/^const (?:START_TIME_NY|START_DAY_NY|NY_DAY)\s*=\s*new Intl[^;]+;$/gm) || []) {
    vm.runInContext(line, ctx);
  }
  for (const n of names) vm.runInContext(source(src, n), ctx);
  return ctx;
}

/* published 2026-09-22 18:45Z, on air 2026-09-23 13:00Z — the row Alan could not find */
const AI_KILLER = {
  video_id: "lS4LtT8LZcY", title: "A New AI Killer For Stocks…", duration: "18:32",
  published_at: "2026-09-22T18:45:34+00:00", feed_at: "2026-09-23T13:00:18+00:00",
  live_state: "was_live", starts_at: null,
};
const NOW = Date.parse("2026-09-23T18:20:00Z"); // 14:20 ET, when Alan looked

for (const name of SHELLS) {
  const src = SRC.get(name);

  test(`${name}: the grid asks for the stream times and orders by them`, () => {
    const ctx = ctxWith(src, ["feedQuery"], {
      FEED_SELECT: "video_id,title,channel,channel_id,tickers,duration,is_short,thumb_url,published_at,subscription_accounts",
      FEED_LIVE_OK: true, LIMIT: 200, LIST: "default", MODE: "grid", TICK: "",
      LISTS: [{ id: "default", n: "all", q: "" }], modeClause: () => "",
    });
    vm.runInContext("FEED_SELECT_LIVE = FEED_SELECT + ',feed_at,live_state,starts_at'", ctx);
    const q = ctx.feedQuery(0);
    assert.match(q, /order=feed_at\.desc/, "ordered by when the stream happened");
    for (const col of ["feed_at", "live_state", "starts_at"]) assert.ok(q.includes(col), `asks for ${col}`);

    ctx.FEED_LIVE_OK = false; // the database change has not landed yet
    const older = ctx.feedQuery(0);
    assert.match(older, /order=published_at\.desc/, "falls back to the publish time");
    assert.ok(!older.includes("feed_at"), "and stops asking for columns that are not there");
  });

  test(`${name}: one refused read drops back, it does not empty the grid`, async () => {
    let asked = [];
    const ctx = ctxWith(src, ["readFeed"], {
      FEED_LIVE_OK: true,
      feedQuery: (offset) => (globalThis.__live ? "live" : "old") + ":" + offset,
      pg: async (path) => { asked.push(path); if (path.startsWith("live")) throw new Error("pg 400"); return [{ video_id: "ok" }]; },
    });
    vm.runInContext("feedQuery = (offset) => (FEED_LIVE_OK ? 'live' : 'old') + ':' + offset", ctx);
    const rows = await ctx.readFeed(0);
    assert.deepEqual(rows, [{ video_id: "ok" }], "the second read serves the grid");
    assert.deepEqual(asked, ["live:0", "old:0"], "asked once with the new columns, once without");
    assert.equal(ctx.FEED_LIVE_OK, false, "the session remembers, so it does not fail twice");

    ctx.pg = async () => { throw new Error("pg 503"); };
    await assert.rejects(() => ctx.readFeed(0), /503/, "a genuinely broken feed is still reported");
  });

  test(`${name}: on air says LIVE, still to come says when`, () => {
    const ctx = ctxWith(src, ["startLabel", "videoBadgeHTML"]);
    const live = ctx.videoBadgeHTML({ live_state: "live", duration: "LIVE" });
    assert.match(live, /class="dur live">LIVE</, "a stream on air says LIVE");

    const soon = ctx.videoBadgeHTML({ live_state: "upcoming", starts_at: "2026-09-23T19:30:00+00:00" });
    assert.match(soon, /class="dur soon">3:30pm</, "3:30pm New York, not 19:30 UTC");

    const later = ctx.videoBadgeHTML({ live_state: "upcoming", starts_at: "2026-09-25T13:30:00+00:00" });
    assert.match(later, /Sep 25 9:30am/, "another day carries its day");

    assert.equal(ctx.videoBadgeHTML({ live_state: "upcoming", starts_at: null }), "",
      "no start time means no badge, never an invented one");
    assert.match(ctx.videoBadgeHTML({ live_state: "was_live", duration: "18:32" }), />18:32</,
      "a finished stream shows the length it ran");
    assert.match(ctx.videoBadgeHTML({ live_state: "none", duration: "13:33" }), />13:33</);
  });

  test(`${name}: a stream is as old as its start, not as its scheduled date`, () => {
    const ctx = ctxWith(src, ["videoAgeLabel", "videoWhen", "videoAgeHTML"], {
      VIDEO_AGE_NONE: "", VIDEO_PUBLISHED_SHAPE: /^\d{4}-\d{2}-\d{2}[T ]/,
    });
    vm.runInContext(source(src, "videoPublishedMs"), ctx);
    assert.equal(ctx.videoAgeLabel(AI_KILLER.published_at, NOW), "23h ago", "what the old bytes said");
    assert.equal(ctx.videoAgeLabel(AI_KILLER.feed_at, NOW), "5h ago", "what it actually is");
    assert.equal(ctx.videoWhen(AI_KILLER), AI_KILLER.feed_at);
    assert.match(ctx.videoAgeHTML(AI_KILLER), /data-published="2026-09-23T13:00:18\+00:00"/,
      "and the in-place clock keeps counting from the start, not the schedule");
    assert.equal(ctx.videoWhen({ published_at: "2026-09-01T00:00:00+00:00" }), "2026-09-01T00:00:00+00:00",
      "a row from before the feed knew about streams is unchanged");
  });

  test(`${name}: a stream going on air repaints the grid`, () => {
    const load = source(src, "load");
    assert.match(load, /v\.feed_at \|\| "", v\.live_state \|\| "", v\.duration \|\| ""/,
      "the change check watches the stream state, or LIVE would never appear without a reload");
  });
}

test("both shells stay byte-identical twins", () => {
  assert.equal(SRC.get("scintilla-video-v1"), SRC.get("personal-video-v1"));
});

test("the sweep asks YouTube for the stream times and keeps what is still to come", () => {
  assert.match(SWEEP, /contentDetails,snippet,liveStreamingDetails/, "one part list, asked for on every pass");
  assert.match(SWEEP, /actualStartTime/);
  assert.match(SWEEP, /actualEndTime/);
  assert.match(SWEEP, /scheduledStartTime/);
  assert.ok(!/=== "upcoming"\) \{ dropped\+\+/.test(SWEEP),
    "a stream that has not started yet is no longer thrown away");
  assert.match(SWEEP, /secs > 0 \? secs : null/, "a live stream has no length yet, and 0 is not a length");
});

test("the sweep goes back over recent rows that are still moving", () => {
  assert.match(SWEEP, /REFRESH_DAYS = 3/, "three days back, as asked");
  assert.match(SWEEP, /REFRESH_MAX = 200/, "and a bounded number of rows per pass");
  assert.match(SWEEP, /duration_sec\.is\.null,live_broadcast\.in\.\(live,upcoming\)/,
    "live, upcoming, or no length yet");
  assert.match(SWEEP, /live_refreshed: refreshed/, "the pass reports what it re-read");
  assert.match(SWEEP, /refresh_error: refreshError/, "and says so when it could not");
});

test("the migration appends, so the view is replaced and nothing else changes", () => {
  for (const col of ["live_broadcast", "live_started_at", "live_ended_at", "live_scheduled_at", "live_checked_ts"]) {
    assert.match(SQL, new RegExp(`add column if not exists ${col}\\b`), `${col} is added`);
  }
  const view = SQL.slice(SQL.indexOf("create or replace view"));
  const list = view.slice(view.indexOf("\nselect") + 7, view.indexOf("from public.youtube_videos"));
  const names = [];
  let depth = 0, item = "";
  for (const ch of list) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) { names.push(item); item = ""; } else item += ch;
  }
  names.push(item);
  const named = names
    .map((piece) => piece.replace(/--[^\n]*/g, " ").trim())
    .filter(Boolean)
    .map((piece) => (piece.match(/(?:\bas\s+)?([a-z_]+)\s*$/i) || [])[1]);
  const before = ["video_id", "title", "channel", "channel_id", "tickers", "duration", "is_short",
    "is_sub", "watch_later", "thumb_url", "published_at", "subscription_accounts"];
  assert.deepEqual(named.slice(0, before.length), before,
    "every column the feed already serves keeps its name and position, or the replace is rejected");
  for (const col of ["feed_at", "live_state", "starts_at", "ended_at"]) {
    assert.ok(named.indexOf(col) >= before.length, `${col} is appended after them`);
  }
});

test("a row the new sweep has not reached yet reads exactly as it does today", () => {
  assert.match(SQL, /when live_broadcast is null then 'LIVE'::text/,
    "no badge silently disappears between the migration and the next sweep");
  assert.match(SQL, /coalesce\(live_started_at, live_scheduled_at, published_at\) as feed_at/,
    "and a row with no stream times still sorts by its publish time");
});
