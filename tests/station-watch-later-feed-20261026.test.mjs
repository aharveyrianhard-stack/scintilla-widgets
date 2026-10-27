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

function fnFromSource(source, name, bindings = {}) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") { depth -= 1; if (depth === 0) { end = i + 1; break; } }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}
const ids = (rows) => rows.map((v) => v.video_id);

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

test("WATCH LATER: newest star first, and the queue plays down that order", () => {
  /* restated twice on 26 Oct: newest first (20:56), oldest first (21:23), newest first again - Alan, 21:3x: "No. Watch later needs to be
     newest first, buddy." A video starred while one plays sits at the top; the run reaches it at the bottom (watchRunWrap). */
  const at = new Map([["old", Date.parse("2026-10-26T20:22:00-04:00")], ["mid", Date.parse("2026-10-26T20:35:00-04:00")],
    ["new", Date.parse("2026-10-26T20:41:00-04:00")]]);
  const watchOrder = fnFromSource(shell, "watchOrder");
  const rows = watchOrder([{ video_id:"mid" }, { video_id:"old" }, { video_id:"new" }], at);
  assert.deepEqual(ids(rows), ["new", "mid", "old"]);
  assert.deepEqual(ids(watchOrder([{ video_id:"new" }, { video_id:"just" }, { video_id:"old" }], at)), ["just", "new", "old"],
    "an id with no saved time yet was starred just now: first");
  const queueRows = fnFromSource(shell, "queueRows");
  const queuedVideo = fnFromSource(shell, "queuedVideo", { UNAVAILABLE_VIDEO_IDS: new Set() });
  const watch = new Set(["new", "mid", "old"]);
  assert.equal(queuedVideo(queueRows(rows, "watch", watch), "new", 1).video_id, "mid", "after the first saved video, the second");
  /* un-starring the one playing takes it off the list, and the next saved one still follows it */
  const without = new Set(["mid", "old"]);
  assert.deepEqual(ids(queueRows(rows, "watch", without)), ["mid", "old"]);
  assert.equal(queuedVideo(queueRows(rows, "watch", without, "new"), "new", 1).video_id, "mid");
});

test("WATCH LATER: the run keeps its list while the column shows the feed; at its bottom it plays what was starred meanwhile", () => {
  const watchOrder = fnFromSource(shell, "watchOrder");
  const watchQueueRows = fnFromSource(shell, "watchQueueRows", { watchOrder });
  const queueRows = fnFromSource(shell, "queueRows");
  const queuedVideo = fnFromSource(shell, "queuedVideo", { UNAVAILABLE_VIDEO_IDS: new Set() });
  const watchRunWrap = fnFromSource(shell, "watchRunWrap");
  const w1 = { video_id:"w1" }, w2 = { video_id:"w2" }, f1 = { video_id:"f1" }, f2 = { video_id:"f2" };
  const env = { CUR:w2, QUEUE:{ list:"watch", rows:[w2, w1], played:new Set(["w2"]) }, LIST:"default", ROWS:[f1, f2], BYID:{ f1, f2 },
    WATCH:new Set(["w1", "w2", "f2"]), WATCH_AT:new Map([["w1", 1], ["w2", 2]]), queueRows, watchQueueRows, inMode:() => true };
  const run = fnFromSource(shell, "visibleQueue", env)();
  assert.deepEqual(ids(run), ["f2", "w2", "w1"], "the Watch Later run, newest first, the feed's new star on top");
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
  assert.match(shell, /pg\("yt_watch_later\?select=video_id,updated_at"\)/);
  assert.match(shell, /return "youtube_feed\?select=" \+ \(FEED_LIVE_OK \? FEED_SELECT_LIVE : FEED_SELECT\) \+ "&limit=200" \+/);
  assert.match(shell, /if \(LIST === "watch"\) return ROWS\.filter\(\(v\) => WATCH\.has\(v\.video_id\)\);/, "the grid: no grid·videos·shorts filter");
  assert.match(shell, /if \(list === "watch"\) return queueRows\(watchQueueRows\(rows, WATCH, BYID, WATCH_AT\), list, WATCH, CUR && CUR\.video_id\);/, "the queue: the same list (the run's own, 26 Oct ~21:35)");
  assert.match(shell, /const raw = LIST === "watch" \? watchOrder\(rows, WATCH_AT\) : Array\.isArray\(rows\) \? rows : \[\];/);
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
