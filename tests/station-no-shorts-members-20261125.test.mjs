/* 25 Nov 2026 (coordinator). Alan: "the station, can we get the YouTube shorts off of it? No more shorts. And then there's
   videos that are members only content. Let's avoid that because then it stops playing because it's members only content."
   Pinned here: every list of the Station's video pane asks the feed for station_ok (no Shorts, no members-only), the
   database rule behind it, the classifier that marks them from YouTube's own lists, and the player no longer counting a
   members-only video's silent "not started" as a video that started. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const shell = read("station-shells/scintilla-video-v1/index.html");
const twin = read("station-shells/personal-video-v1/index.html");
const migration = read("supabase/migrations/20261125_youtube_station_ok.sql");
const classifier = read("supabase/functions/yt-classify/index.ts");

function fnText(src, name) {
  const start = src.search(new RegExp("(async )?function " + name + "\\("));
  assert.notEqual(start, -1, name + " must exist");
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) break; }
  return src.slice(start, i + 1);
}

test("the twins stay byte-identical", () => {
  assert.equal(shell, twin);
});

test("every read of the pane asks for station_ok: the grid, on air, Watch Later", () => {
  assert.match(shell, /const STATION_OK_CLAUSE = "&station_ok=is\.true";/);
  assert.match(fnText(shell, "feedQuery"), /q \+= modeClause\(\);/, "the grid's list");
  assert.match(fnText(shell, "feedQuery"), /\.join\(","\) \+ "\)" \+ modeClause\(\);/, "Watch Later's id read");
  assert.match(fnText(shell, "onAirQuery"), /q \+= modeClause\(\);/, "the on-air read");
  const box = vm.createContext({});
  vm.runInContext('const STATION_OK_CLAUSE = "&station_ok=is.true"; const LONG_CLAUSE = "&is_short=eq.false"; let STATION_OK = true;\n' +
    fnText(shell, "modeClause") + "\nglobalThis.mc = modeClause; globalThis.off = () => { STATION_OK = false; };", box);
  assert.equal(box.mc(), "&station_ok=is.true");
  box.off();
  assert.equal(box.mc(), "&is_short=eq.false", "a feed without the column: the old videos test, never an empty pane");
});

test("no tab can bring Shorts back", () => {
  assert.match(shell, /const MODE = "videos";/);
  assert.doesNotMatch(shell, /SHORT_CLAUSE|MODE_DEFAULT|function setMode|no shorts in this list|shorts are under SHORTS/);
  assert.match(fnText(shell, "visibleRows"), /WATCH\.has\(v\.video_id\) && inMode\(v\)/, "the saved list too");
  assert.match(fnText(shell, "inMode"), /video\.members_only === true/, "a members-only row is refused on the page as well");
});

/* the player: a members-only video never errors. Checked headless 25 Nov: loaded into the pane's player, -0aaODOwgAU went
   -1, 3 (a moment), -1 and stayed there; an ordinary video reached 1 within a second. */
function playerBox() {
  const box = vm.createContext({ Number, Set, setTimeout: (f) => { box.__timer = f; return 1; }, clearTimeout: () => {} });
  vm.runInContext(`
    let PLAYER_TOKEN = 1, PLAYER_ACCEPTED_TOKEN = 0, PLAYER_ENDED_TOKEN = 0, PLAYER_FALLBACK = 0, CUR = { video_id: "m1" };
    let YT_PLAYER_REQUEST = null; const UNAVAILABLE_VIDEO_IDS = new Set(); let NOW_STATE = -1; const YT_PLAYER = { getPlayerState: () => NOW_STATE }; const marks = []; const notices = []; const steps = [];
    const markPlayer = (s) => marks.push(s); const captureActiveVideoPosition = () => {}; const setAutoplayBlockedState = () => {};
    const soundOnPlaying = () => {}; const clearPlayerPositionPoll = () => {}; const clearVideoPosition = () => {}; const advanceQueue = () => {};
    let PLAYER_POSITION = {}; const setTransportNotice = (t) => notices.push(t);
    const stepQueue = (d, skipped) => { steps.push([...skipped]); return true; };
    const playerEventMatchesRequest = (e, r) => !!r && r.token === PLAYER_TOKEN;
    function clearPlayerFallback() { PLAYER_FALLBACK = 0; }
    ${fnText(shell, "handlePlayerStateChange")}
    let STALL_SKIPS = 0;
    ${fnText(shell, "playerStateNow")}
    ${fnText(shell, "armPlayerFallback")}
    globalThis.api = { handlePlayerStateChange, armPlayerFallback,
      req: (auto) => { YT_PLAYER_REQUEST = { token: PLAYER_TOKEN, auto, video: CUR, direction: 1, originVideo: CUR }; PLAYER_ACCEPTED_TOKEN = 0; },
      state: () => ({ accepted: PLAYER_ACCEPTED_TOKEN, stalls: STALL_SKIPS, notices: notices.slice(), steps: steps.slice(), unavailable: [...UNAVAILABLE_VIDEO_IDS] }),
      setStalls: (n) => { STALL_SKIPS = n; }, setNow: (s) => { NOW_STATE = s; } };`, box);
  const raw = box.api.state; box.api.state = () => JSON.parse(JSON.stringify(raw()));   /* plain arrays, not the sandbox's */
  return box;
}

test("a video asked to PLAY that sits at -1 is skipped after 10 s; a cued one is left alone", () => {
  const box = playerBox(), api = box.api;
  api.req(true);
  api.armPlayerFallback(1, new Set());
  api.handlePlayerStateChange({ data: -1 });
  api.handlePlayerStateChange({ data: 3 });
  api.handlePlayerStateChange({ data: -1 });
  assert.equal(api.state().accepted, 0, "-1, a moment of 3, -1: not acceptance on a play request");
  box.__timer();
  assert.deepEqual(api.state().unavailable, ["m1"], "the stuck video is marked unavailable");
  assert.deepEqual(api.state().notices, ["skipping unavailable video"]);
  assert.equal(api.state().steps.length, 1, "and the queue moves on");

  const cued = playerBox().api;
  cued.req(false);
  cued.handlePlayerStateChange({ data: -1 });
  assert.equal(cued.state().accepted, 1, "a cued video (he presses play) still counts as loaded at -1");

  const slow = playerBox();
  slow.api.req(true); slow.api.setNow(3);
  slow.api.armPlayerFallback(1, new Set());
  slow.api.handlePlayerStateChange({ data: 3 });
  slow.__timer();
  assert.deepEqual([slow.api.state().steps.length, slow.api.state().unavailable.length], [0, 0], "still loading at 10 s: 10 s more, no skip");
  slow.__timer();
  assert.equal(slow.api.state().steps.length, 1, "still nothing at 20 s: skipped");

  const plays = playerBox().api;
  plays.req(true); plays.setStalls(2);
  plays.handlePlayerStateChange({ data: -1 });
  plays.handlePlayerStateChange({ data: 1 });
  assert.equal(plays.state().accepted, 1, "an ordinary video is accepted when it plays");
  assert.equal(plays.state().stalls, 0, "a video that plays resets the stall count");
});

test("three stalls in a row and the pane stops skipping (a browser that blocks every start must not walk the list)", () => {
  const box = playerBox(), api = box.api;
  api.req(true); api.setStalls(3);
  api.armPlayerFallback(1, new Set());
  box.__timer();
  assert.deepEqual(api.state().steps, [], "no skip");
  assert.deepEqual(api.state().notices, ["video did not start"]);
});

test("the database rule: no Short of any kind, no members-only, a brand-new short-length upload held at most 15 minutes", () => {
  assert.match(migration, /add column if not exists members_only boolean/);
  assert.match(migration, /add column if not exists class_tries smallint not null default 0/);
  assert.match(migration, /COALESCE\(is_short, false\) = false/);
  assert.match(migration, /COALESCE\(members_only, false\) = false/);
  assert.match(migration, /NOT \(duration_sec IS NOT NULL AND duration_sec <= 60\)/, "Alan's 22 Sep rule: a minute or less is a short");
  assert.match(migration, /duration_sec <= 180 AND class_tries = 0\s+AND COALESCE\(updated_ts, 0\) > \(extract\(epoch from now\(\)\) - 900\)::bigint/, "held until first looked at, 15 minutes at most");
  assert.match(migration, /\) AS station_ok\s+FROM youtube_videos;/, "the new columns come last, so every existing read is untouched");
  assert.match(migration, /ROLLBACK/);
});

test("the classifier reads YouTube's own lists and only ever adds a Shorts flag", () => {
  assert.match(classifier, /"UUSH" \| "UUMO"/);
  assert.match(classifier, /playlistItems\?part=contentDetails&maxResults=50&playlistId=/);
  assert.match(classifier, /if \(r\.status === 404\) \{ await r\.text\(\); out\.ok = true; return out; \}/, "404 = the channel has no such list");
  assert.doesNotMatch(classifier, /is_short: false/, "never turns a Shorts flag off");
  assert.match(classifier, /members_only: false/, "a members-first video that went public comes back");
  assert.match(classifier, /pg\("yt_class_log"/, "every change is written down");
  assert.match(classifier, /const DUE_AFTER_S = \[0, 300, 1200, 3600\];/);
  assert.match(classifier, /push_cron_key_ok/, "the same caller check as yt-push");
});

test("the TV page reloads for a video-pane release too, under its own rule", () => {
  const page = read("broadcast/index.html");
  assert.match(page, /const WATCH_FILES = \[location\.pathname, "\/station-shells\/scintilla-video-v1\/"\];/);
  assert.match(page, /if \(tags\.some\(\(t\) => !t\)\) return;/, "a missing tag decides nothing");
  assert.match(page, /\(idle > 120000 && !videoBusy\(\)\) \|\| \(nightNY\(\) && idle > 3600000\)\)\) location\.reload\(\)/, "the same reload rule");
});
