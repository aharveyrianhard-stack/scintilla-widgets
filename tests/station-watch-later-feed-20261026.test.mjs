/* WATCH LATER as a feed you can play through (26 Oct 2026, coordinator). Alan: "the watch later is supposed to … show me the
   feed … a scrollable area of what's in my watch later, and for me to play that and for that to run through … It looks like
   it's just a filter and it shows me the stars, or it doesn't show me the stars. It's useless." */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const shell = read("../station-shells/personal-video-v1/index.html");
const twin = read("../station-shells/scintilla-video-v1/index.html");

function fnText(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") { depth -= 1; if (depth === 0) { end = i + 1; break; } }
  }
  return source.slice(start, end);
}
function fnFromSource(source, name, bindings = {}) {
  return vm.runInNewContext(`(${fnText(source, name)})`, bindings);
}
/* 28 Oct: watchOrder places a saved stream with the grid's own helpers, lifted out together as they are */
function orderCtx(source) {
  const ctx = vm.createContext({ Intl, Date, isFinite, Array, Set });
  for (const line of source.match(/^const (?:NY_DAY|DUE_BEFORE_MS|DUE_AFTER_MS|ON_AIR_PIN_HOURS|VIDEO_PUBLISHED_SHAPE)\s*=[^;]+;$/gm) || []) vm.runInContext(line, ctx);
  for (const name of ["videoPublishedMs", "videoWhen", "onAirNow", "streamPlace", "watchOrder"]) vm.runInContext(fnText(source, name), ctx);
  return ctx;
}
const ids = (rows) => Array.from(rows, (v) => v.video_id);   // a plain array of this realm, whatever realm built the list

test("WATCH LATER: the twin shells stay byte-identical", () => {
  assert.equal(shell, twin);
});

test("WATCH LATER: a tab on the bar beside SCINTILLA and PERSONAL, on every channel feed", () => {
  assert.match(shell, /\] : \[SUBSCRIBED, WATCH_LIST\];/, "PERSONAL carries the shared list too");
  assert.match(shell, /FEED === "scintilla" \? \[\n  SCINTILLA_SUBSCRIBED,\n  WATCH_LIST,\n\]/, "SCINTILLA too");
  assert.match(shell, /w\.innerHTML = '<span class="wl-long">WATCH LATER<\/span><span class="wl-short">LATER<\/span>';/);
  assert.match(shell, /w\.addEventListener\("click", \(\) => showWatchLater\(true\)\);/);
  assert.match(shell, /if \(key === FEED\) showWatchLater\(false\); else \{ rememberWatchTab\(false\); switchFeed\(key\); \}/,
    "a feed tab leaves Watch Later: this feed's list at once, the other feed through the deck");
  assert.match(shell, /if \(l\.id === "watch"\) continue;/, "the old chip in the ⋯ is gone (the tab replaces it)");
});

test("WATCH LATER: lit tabs - the saved list lights only WATCH LATER", () => {
  const box = { querySelectorAll: () => btns };
  const mk = (feed, list) => ({ dataset: list ? { list } : { feed }, cls: new Set(), attrs: {},
    classList: { toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); } }, setAttribute(k, v) { this.attrs[k] = v; } });
  const btns = [mk("scintilla"), mk("personal"), mk(null, "watch")];
  for (const b of btns) b.classList._s = b.cls;
  const paint = (FEED, LIST) => fnFromSource(shell, "paintFeedSwitch", { el: () => box, FEED, LIST })();
  paint("personal", "watch");
  assert.deepEqual(btns.map((b) => b.cls.has("on")), [false, false, true]);
  paint("personal", "default");
  assert.deepEqual(btns.map((b) => b.cls.has("on")), [false, true, false]);
});

test("WATCH LATER: latest to oldest by the video's own time - the grid's order - and the queue plays down it", () => {
  /* 28 Oct, Alan 04:3x: "I thought we said that the YouTube videos for my watch later would always be organized from latest to oldest."
     26 Oct built "newest first" as the newest STAR first, so last night's run of stars, made down the grid newest video first, read
     oldest on top. The rows are this morning's shape (ids made up); the clock is 04:40 ET, 28 Oct; no star time is passed at all. */
  const NOW = Date.parse("2026-10-28T08:40:00Z");
  const row = (id, at, live = "none", startsAt = null) => ({ video_id:id, feed_at:at, published_at:at, live_state:live, starts_at:startsAt });
  const saved = [
    row("oct26-starred-last", "2026-10-26T16:38:00Z"),
    row("run-4-10pm", "2026-10-27T20:10:00Z"), row("run-7pm", "2026-10-27T23:00:00Z"), row("was-live-9pm", "2026-10-28T01:00:00Z", "was_live"),
    row("today-5pm", "2026-10-28T21:00:00Z", "upcoming", "2026-10-28T21:00:00Z"),
    row("today-2pm", "2026-10-28T18:00:00Z", "upcoming", "2026-10-28T18:00:00Z"),
    row("tomorrow-8-15am", "2026-10-29T12:15:00Z", "upcoming", "2026-10-29T12:15:00Z"),
    row("on-air", "2026-10-28T08:20:00Z", "live"),
  ];
  const { watchOrder } = orderCtx(shell);
  const want = ["on-air", "today-2pm", "today-5pm", "tomorrow-8-15am", "was-live-9pm", "run-7pm", "run-4-10pm", "oct26-starred-last"];
  assert.deepEqual(ids(watchOrder(saved, NOW)), want, "on air, today's streams soonest first, another day's, then newest to oldest");
  assert.deepEqual(ids(watchOrder(saved.slice().reverse(), NOW)), want, "the read has no order; the list does");
  const tie = [row("b", "2026-10-27T22:00:00Z"), row("a", "2026-10-27T22:00:00Z")];
  assert.deepEqual(ids(watchOrder(tie, NOW)), ["a", "b"]);
  assert.deepEqual(ids(watchOrder(tie.slice().reverse(), NOW)), ["a", "b"], "equal times keep one order from read to read");
  for (const name of ["scintilla-video-v1", "personal-video-v1"]) assert.match(name === "personal-video-v1" ? shell : twin, /function watchOrder\(rows, nowMs\)/);
  const rows = watchOrder(saved, NOW);
  const queueRows = fnFromSource(shell, "queueRows");
  const queuedVideo = fnFromSource(shell, "queuedVideo", { UNAVAILABLE_VIDEO_IDS: new Set() });
  const watch = new Set(want);
  assert.equal(queuedVideo(queueRows(rows, "watch", watch), "was-live-9pm", 1).video_id, "run-7pm", "after a video, the next older one");
  /* un-starring the one playing takes it off the list, and the next saved one still follows it */
  const without = new Set(want.filter((id) => id !== "was-live-9pm"));
  assert.ok(!ids(queueRows(rows, "watch", without)).includes("was-live-9pm"));
  assert.equal(queuedVideo(queueRows(rows, "watch", without, "was-live-9pm"), "was-live-9pm", 1).video_id, "run-7pm");
});

test("WATCH LATER: the run keeps its list while the column shows the feed; at its bottom it plays what was starred meanwhile", () => {
  const { watchOrder } = orderCtx(shell);
  const watchQueueRows = fnFromSource(shell, "watchQueueRows", { watchOrder });
  const queueRows = fnFromSource(shell, "queueRows");
  const queuedVideo = fnFromSource(shell, "queuedVideo", { UNAVAILABLE_VIDEO_IDS: new Set() });
  const watchRunWrap = fnFromSource(shell, "watchRunWrap");
  const w1 = { video_id:"w1", feed_at:"2026-10-27T13:00:00Z" }, w2 = { video_id:"w2", feed_at:"2026-10-27T15:00:00Z" },
    f1 = { video_id:"f1", feed_at:"2026-10-28T02:00:00Z" }, f2 = { video_id:"f2", feed_at:"2026-10-28T01:00:00Z" };
  const env = { CUR:w2, QUEUE:{ list:"watch", rows:[w2, w1], played:new Set(["w2"]) }, LIST:"default", ROWS:[f1, f2], BYID:{ f1, f2 },
    WATCH:new Set(["w1", "w2", "f2"]), queueRows, watchQueueRows, inMode:() => true };
  const run = fnFromSource(shell, "visibleQueue", env)();
  assert.deepEqual(ids(run), ["f2", "w2", "w1"], "the Watch Later run, latest to oldest: the feed's new star, the newest video, on top");
  assert.equal(queuedVideo(run, "w2", 1).video_id, "w1", "down the list from where it started");
  assert.equal(queuedVideo(run, "w1", 1), null, "the bottom");
  assert.equal(watchRunWrap(run, "watch", new Set(["w2", "w1"]), new Set(), new Set()).video_id, "f2", "then what was starred while watching");
  assert.equal(watchRunWrap(run, "watch", new Set(["w2", "w1", "f2"]), new Set(), new Set()), null, "and then the end");
  assert.equal(watchRunWrap(run, "default", new Set(), new Set(), new Set()), null, "a feed's run never wraps");
  env.CUR = null;   /* stopped: the column's own list again */
  assert.deepEqual(ids(fnFromSource(shell, "visibleQueue", env)()), ["f1", "f2"]);
  assert.match(shell, /if \(!queued\) QUEUE = \{ list:LIST, rows:ROWS\.slice\(\), played:new Set\(\) \};/, "a play that is not a queue step sets the run");
  assert.match(shell, /QUEUE\.played\.add\(v\.video_id\);/, "every video the run shows is counted");
  assert.match(shell, /CUR = null; QUEUE = \{ list:"", rows:\[\], played:new Set\(\) \};/, "stopping ends it");
  assert.match(shell, /\(direction > 0 \? watchRunWrap\(rows, runList, QUEUE\.played, skipped, UNAVAILABLE_VIDEO_IDS\) : null\)/, "NEXT and the end of a video use it");
  assert.match(shell, /if \(QUEUE\.list === LIST && CUR\) QUEUE\.rows = ROWS\.slice\(\);/, "its list read again keeps it fresh");
});

test("WATCH LATER: GRID never stops the video where the grid is on screen with it", () => {
  const calls = [];
  const go = (env) => fnFromSource(shell, "goGrid", Object.assign({ setMenuOpen(){}, DECK_STAGE:0, parent:{ postMessage(){} }, location:{ origin:"x" },
    showWatchLater:(on) => calls.push("watch:" + on), back:() => calls.push("back"), el:() => ({ set scrollTop(v) { calls.push("top:" + v); } }) }, env))();
  go({ CUR:{}, FIXED:true, STACK:false, BESIDE:false, LIST:"watch" }); assert.deepEqual(calls.splice(0), ["watch:false"], "the wall: the feed's grid, the video plays on");
  go({ CUR:{}, FIXED:false, STACK:true, BESIDE:false, LIST:"default" }); assert.deepEqual(calls.splice(0), ["top:0"], "the phone: the top of the feed, the video plays on");
  go({ CUR:{}, FIXED:false, STACK:false, BESIDE:false, LIST:"default" }); assert.deepEqual(calls.splice(0), ["back"], "a pane whose player covers the grid still goes back");
  go({ CUR:null, FIXED:true, STACK:false, BESIDE:false, LIST:"default" }); assert.deepEqual(calls.splice(0), ["top:0"], "nothing playing: the top");
});

test("WATCH LATER: the whole saved list in one read, shorts too, no ticker filter", () => {
  assert.match(shell, /pg\("yt_watch_later\?select=video_id"\)/);
  assert.doesNotMatch(shell, /WATCH_AT|updated_at/, "28 Oct: the star's time orders nothing now");
  assert.match(shell, /return "youtube_feed\?select=" \+ \(FEED_LIVE_OK \? FEED_SELECT_LIVE : FEED_SELECT\) \+ "&limit=200" \+/);
  assert.match(shell, /if \(LIST === "watch"\) return ROWS\.filter\(\(v\) => WATCH\.has\(v\.video_id\)\);/, "the grid: no grid·videos·shorts filter");
  assert.match(shell, /if \(list === "watch"\) return queueRows\(watchQueueRows\(rows, WATCH, BYID\), list, WATCH, CUR && CUR\.video_id\);/, "the queue: the same list (the run's own, 26 Oct ~21:35)");
  assert.match(shell, /const raw = LIST === "watch" \? watchOrder\(rows\) : Array\.isArray\(rows\) \? rows : \[\];/);
});

test("WATCH LATER: the empty list says how to fill it; missing rows are counted, never hidden", () => {
  assert.match(shell, /Nothing saved yet — tap the cyan ★ on any video to save it here\./);
  assert.match(shell, /" saved video" \+ \(WATCH_MISSING === 1 \? " is" : "s are"\) \+ " no longer in the feed store<\/div>"/);
});

test("WATCH LATER: remembered on this browser, read and written inside try/catch, followed by the other feed's pane", () => {
  assert.match(shell, /const WATCH_TAB_KEY = "station\.yt\.watchTab";/);
  assert.match(shell, /function watchTabRemembered\(\) \{ try \{ return localStorage\.getItem\(WATCH_TAB_KEY\) === "1"; \} catch \(_\) \{ return false; \} \}/);
  assert.match(shell, /function rememberWatchTab\(on\) \{ try \{ localStorage\.setItem\(WATCH_TAB_KEY, on \? "1" : "0"\); \} catch \(_\) \{\} \}/);
  assert.match(shell, /window\.addEventListener\("storage", \(event\) => \{\n  if \(event\.key !== WATCH_TAB_KEY/);
});
