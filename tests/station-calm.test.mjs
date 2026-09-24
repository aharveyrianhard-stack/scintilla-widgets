/* M51 · nothing reloads under Alan's hand.
   Alan, 24 Sep: "Whatever refreshes happen on the station for the charts, they're kind of
   refreshing the YouTube feed when I'm scrolling."
   The deck listens for input on its own document only; every pane he touches is an iframe, and a
   frame's pointer, wheel, touch and scroll events never reach the parent. These tests pin the two
   halves of the repair: each shell reports "in use", and the deck's quiet window spans all panes. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const deck = read("deck/index.html");
const feed = read("station-shells/personal-video-v1/index.html");
const SHELLS = ["station-shells/chart-v1/index.html", "station-shells/x-v2/index.html",
                "station-shells/personal-video-v1/index.html", "station-shells/scintilla-video-v1/index.html"];

const fn = (src, name) => new Function(src + "\nreturn " + name + ";")();
const lastInput = fn(deck.match(/function stationLastInput\(localAt, paneTimes\) \{[\s\S]*?\n\}/)[0], "stationLastInput");
const planSrc = deck.match(/const SELF_UPDATE_IDLE_MS = [\s\S]*?\nfunction selfUpdatePlan\([\s\S]*?\n\}\n/)[0]
  .replace(/let SELF_UPDATE_SEEN[\s\S]*?capture:true \}\);\n/, "")
  .replace(/const PANE_ACTIVITY[\s\S]*?\n\}\n/, "")
  .replace(/function stationIdleMs[\s\S]*?\n\}\n/, "")
  .replace(/function xPaneLive[\s\S]*?\n/, "");
const plan = fn(planSrc, "selfUpdatePlan");
const refreshPlan = fn(feed.match(/function videoRefreshPlan\(state\) \{[\s\S]*?\n\}/)[0], "videoRefreshPlan");

const TAGS = { deck:"d1", chart:"c1", provider:"p1", video:"v1", personalVideo:"pv1", x:"x1" };
const QUIET = 180000, BUSY = 30000;

/* ---- the pane tells the deck ---------------------------------------------------------------- */

test("every shell that takes input reports itself in use, at most once a second", () => {
  for (const path of SHELLS) {
    const src = read(path);
    assert.match(src, /reportStationActivity/, path + " reports activity");
    assert.match(src, /sc: "station-activity"/, path + " uses the deck's message path");
    assert.match(src, /if \(now - last < 1000\) return;/, path + " throttles to one message a second");
    for (const ev of ["pointermove", "wheel", "touchmove", "scroll", "keydown"])
      assert.ok(src.includes('"' + ev + '"'), path + " listens for " + ev);
    assert.match(src, /capture: true/, path + " hears events from inside its own page");
    assert.match(src, /if \(window\.parent === window\) return;/, path + " stays silent when opened on its own");
  }
});

test("the deck counts a message from any pane as Alan's hand on the Station", () => {
  assert.match(deck, /event\.data\?\.sc === "station-activity"/);
  assert.match(deck, /PANE_ACTIVITY\.set\(/);
  assert.match(deck, /stationIdleMs\(\)/, "the plan is given the shared idle time, not the deck's own");
});

test("the quiet window is the newest touch anywhere, deck or pane", () => {
  assert.equal(lastInput(1000, []), 1000, "with no panes it is the deck's own input");
  assert.equal(lastInput(1000, [5000, 2000]), 5000, "a pane that was touched later wins");
  assert.equal(lastInput(9000, [5000]), 9000, "the deck's own input still counts");
  assert.equal(lastInput(0, []), 0);
  assert.equal(lastInput(null, [undefined, "7000"]), 7000, "a malformed beat never breaks the count");
});

/* ---- nothing reloads while a pane is in use --------------------------------------------------- */

test("a page reload waits for two quiet minutes across every pane", () => {
  const busy = plan(TAGS, { ...TAGS, deck:"d2" }, BUSY, false, false, false, 0, false, false);
  assert.equal(busy.reloadPage, false, "not while a pane says it is in use");
  assert.equal(busy.deckPending, true, "and not forgotten");
  assert.equal(plan(TAGS, { ...TAGS, deck:"d2" }, QUIET, false, false, false, 0, false, false).reloadPage, true);
});

test("a chart remount waits too — a white frame coming back is a reload to the eye", () => {
  const busy = plan(TAGS, { ...TAGS, chart:"c2" }, BUSY, false, false, false, 0, false, false);
  assert.equal(busy.remountCharts, false);
  assert.equal(busy.chartPending, true);
  const quiet = plan(TAGS, { ...TAGS, chart:"c2" }, QUIET, false, false, false, 0, false, true);
  assert.equal(quiet.remountCharts, true, "the held change runs once the desk is quiet");
  assert.equal(quiet.chartPending, false);
  assert.equal(plan(TAGS, TAGS, BUSY, false, false, false, 0, false, true).remountCharts, false,
    "a pending chart change still waits");
});

test("the X frame is not reloaded under his hand either", () => {
  const busy = plan(TAGS, { ...TAGS, x:"x2" }, BUSY, false, false, false, 0, false, false);
  assert.equal(busy.remountX, false, "not while the Station is in use");
  assert.equal(busy.xPending, true, "remembered");
  assert.equal(plan(TAGS, { ...TAGS, x:"x2" }, QUIET, false, false, false, 0, true, false).remountX, true);
});

test("a quiet Station still updates — the calm is not a freeze", () => {
  const r = plan(TAGS, { deck:"d2", chart:"c2", provider:"p2", video:"v1", personalVideo:"pv1", x:"x2" },
    QUIET, false, false, false, 0, false, false);
  assert.equal(r.reloadPage, true);
  assert.equal(r.remountX, true);
});

/* ---- the feed keeps its place ----------------------------------------------------------------- */

test("the feed holds its own refresh while the pointer is in the list", () => {
  const base = { visible:true, playing:false, pagedPast:false, pointerInList:false };
  assert.deepEqual(refreshPlan({ ...base, pointerInList:true }), { load:false, hold:true, why:"Alan's pointer is in the list" });
  assert.equal(refreshPlan(base).load, true, "and refreshes as soon as his hand is elsewhere");
  assert.equal(refreshPlan({ ...base, playing:true }).load, false, "never over a playing video");
  assert.equal(refreshPlan({ ...base, playing:true }).hold, false);
  assert.equal(refreshPlan({ ...base, pagedPast:true }).load, false, "never reloads page one under a paged grid");
  assert.equal(refreshPlan({ ...base, visible:false }).load, false, "nothing happens off screen");
});

test("a held refresh runs the moment the pointer leaves, and is not forgotten", () => {
  assert.match(feed, /el\("grid"\)\.addEventListener\("pointerleave", \(\) => \{ POINTER_IN_LIST = false; runHeldRefresh\(\); \}/);
  assert.match(feed, /function runHeldRefresh\(\) \{[\s\S]*?if \(!REFRESH_HELD\) return;[\s\S]*?if \(plan\.load\) load\(false, true\);/);
  assert.match(feed, /if \(plan\.hold\) REFRESH_HELD = true;/, "the two-minute pass banks the held refresh");
});

test("a repaint puts the same video back under the top edge, not the same pixel count", () => {
  assert.match(feed, /const grid = el\("grid"\), keep = scrollAnchor\(grid\);/);
  assert.match(feed, /restoreAnchor\(grid, keep\);/);
  const anchor = fn(feed.match(/function scrollAnchor\(grid\) \{[\s\S]*?\n\}/)[0], "scrollAnchor");
  const restore = fn(feed.match(/function restoreAnchor\(grid, anchor\) \{[\s\S]*?\n\}/)[0], "restoreAnchor");
  /* a hand-built grid: five 100px tiles, scrolled 20px into the third */
  const cards = (ids, h = 100) => ids.map((id, i) => ({ dataset:{ v:id }, offsetTop:i * h, offsetHeight:h }));
  const grid = { scrollTop: 220, _cards: cards(["a","b","c","d","e"]),
    querySelectorAll(){ return this._cards; },
    querySelector(sel){ const id = sel.match(/data-v="(.*)"\]/)[1]; return this._cards.find((c) => c.dataset.v === id) || null; } };
  const keep = anchor(grid);
  assert.equal(keep.id, "c", "the tile under the top edge");
  assert.equal(keep.delta, -20);
  /* two newer videos arrive at the top: the raw number would now show tile "a" */
  grid._cards = cards(["new1","new2","a","b","c","d","e"]);
  grid.scrollTop = 0;
  restore(grid, keep);
  assert.equal(grid.scrollTop, 420, "the same video stays under his eye");
  /* and when that video has gone from the list, the old position is still honoured */
  grid._cards = cards(["x","y","z"]); grid.scrollTop = 0;
  restore(grid, keep);
  assert.equal(grid.scrollTop, 220);
});

/* ---- M51 · the Context Lens is a live second zoom, not a trip through history ------------------
   Alan, 24 Sep: "We don't need the context lens replay shit. It's just a view of the current bars
   with the opposite view." Nothing in the lens was ever CALLED a replay — what he was watching is
   the old "CONTEXT · FULL HISTORY" view, a mode you picked from a dropdown that left the current
   bars behind. That mode is gone: the lens now takes the opposite zoom of whatever the main chart
   is showing, on the same live bars, and the wide view is a multiple of the window on screen and
   never the whole history. These are the tests that pin the two modes. */
const lens = await import("../deliverables/20260924/station-calm/lens/lens-view.mjs");

test("zoomed out, the lens zooms in on the newest bars", () => {
  const v = lens.lensView({ total: 400, start: 200, end: 399 });
  assert.equal(v.mode, "detail");
  assert.equal(v.bars, 30);
  assert.equal(v.end, 399, "it ends on the same bar as the main chart");
  assert.equal(v.start, 370);
  assert.equal(v.label, "ZOOM · LAST 30 BARS");
});

test("zoomed in, the lens pulls back — a multiple of the window, never the whole history", () => {
  const v = lens.lensView({ total: 400, start: 380, end: 399 });
  assert.equal(v.mode, "wide");
  assert.equal(v.bars, 120, "six times the twenty bars on screen");
  assert.equal(v.end, 399);
  assert.ok(v.bars < 400, "the full history is exactly what Alan did not want");
  assert.equal(v.label, "WIDER · LAST 120 BARS");
});

test("the pulled-back view stops at the oldest bar there is", () => {
  const v = lens.lensView({ total: 50, start: 30, end: 49 });
  assert.equal(v.mode, "wide");
  assert.equal(v.start, 0);
  assert.equal(v.bars, 50);
});

test("when the chart already shows everything, the lens zooms in instead of repeating it", () => {
  const v = lens.lensView({ total: 20, start: 0, end: 19 });
  assert.equal(v.mode, "detail", "there is nothing wider to show");
  assert.equal(v.bars, 19);
});

test("the switch happens at the stated zoom, not by feel", () => {
  assert.equal(lens.lensView({ total: 400, start: 340, end: 399 }).mode, "wide", "60 bars on screen is zoomed in");
  assert.equal(lens.lensView({ total: 400, start: 339, end: 399 }).mode, "detail", "61 is zoomed out");
});

test("too few bars for a second view says so instead of drawing nonsense", () => {
  const v = lens.lensView({ total: 4, start: 0, end: 3 });
  assert.equal(v.mode, "none");
  assert.equal(v.label, "");
  assert.match(v.why, /too few bars/);
  assert.equal(lens.lensView({ total: 0, start: 0, end: 0 }).mode, "none");
});

test("both panes always end on the same bar, in either mode", () => {
  for (const main of [{ total:400, start:0, end:399 }, { total:400, start:390, end:399 },
                      { total:400, start:100, end:250 }, { total:9, start:0, end:8 }]) {
    assert.ok(lens.endsTogether(lens.lensView(main), main), JSON.stringify(main));
  }
});

test("the heading says the span in plain dates", () => {
  const v = lens.lensView({ total: 400, start: 200, end: 399 });
  const dateAt = (i) => "2026-01-" + String(i).padStart(3, "0");
  assert.equal(lens.lensSpan(v, dateAt), "2026-01-370 → 2026-01-399");
  assert.equal(lens.lensSpan(lens.lensView({ total: 2, start: 0, end: 1 }), dateAt), "", "no span when there is no view");
});
