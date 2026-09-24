import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const src = deck.match(/const SELF_UPDATE_IDLE_MS = [\s\S]*?\nfunction selfUpdatePlan\(seen, tags, idleMs, videoOnStage, deckPending, xLive, xHeldMs, xPending\) \{[\s\S]*?\n\}\n/)[0]
  .replace(/let SELF_UPDATE_SEEN[\s\S]*?capture:true \}\);\n/, "")
  .replace(/function xPaneLive[\s\S]*?\n/, "");
const plan = new Function(src + "return selfUpdatePlan;")();
const A = { deck:"d1", chart:"c1", provider:"p1" };

test("the first look only records the versions", () => {
  const r = plan(null, A, 0, false, false);
  assert.deepEqual(r.seen, A); assert.equal(r.remountCharts, false); assert.equal(r.reloadPage, false);
});
test("a new chart page or provider reloads the charts only, never the page", () => {
  const r = plan(A, { ...A, chart:"c2" }, 0, true, false);
  assert.equal(r.remountCharts, true); assert.equal(r.reloadPage, false); assert.equal(r.seen.chart, "c2");
  assert.equal(plan(A, { ...A, provider:"p2" }, 0, false, false).remountCharts, true);
});
test("a new deck waits for two idle minutes and for no video on the stage", () => {
  const busy = plan(A, { ...A, deck:"d2" }, 30000, false, false);
  assert.equal(busy.reloadPage, false); assert.equal(busy.deckPending, true);
  assert.equal(plan(A, { ...A, deck:"d2" }, 180000, true, false).reloadPage, false, "a video on stage is never cut off");
  assert.equal(plan(A, A, 180000, false, true).reloadPage, true, "a pending deck reloads once idle and quiet");
});
test("a failed version read never triggers anything", () => {
  const r = plan(A, { deck:"", chart:"", provider:"" }, 999999, false, false);
  assert.equal(r.remountCharts, false); assert.equal(r.reloadPage, false); assert.deepEqual(r.seen, A);
});
test("the deck checks every three minutes and first after fifteen seconds", () => {
  assert.match(deck, /setTimeout\(selfUpdateCheck, 15000\);\nsetInterval\(selfUpdateCheck, SELF_UPDATE_MS\);/);
  assert.match(deck, /const SELF_UPDATE_MS = 180000;/);
  assert.match(deck, /fetch\(path, \{ method:"HEAD", cache:"no-store" \}\)/);
});
test("the deck watches its own file, not the redirect page its tidied address points at", () => {
  assert.match(deck, /const files = \{ deck: "\/deck\/index\.html", chart: STATION_SHELL\.chart \+ "\/index\.html", provider: "\/_provider\/provider\.js",/);
});

test("a changed video pane reloads the page the careful way: idle and no video on stage (23 Sep)", () => {
  const A2 = { deck:"d1", chart:"c1", provider:"p1", video:"v1", personalVideo:"pv1", x:"x1" };
  assert.equal(plan(A2, { ...A2, video:"v2" }, 30000, false, false, false, 0, false).reloadPage, false, "not while someone is using it");
  assert.equal(plan(A2, { ...A2, video:"v2" }, 30000, false, false, false, 0, false).deckPending, true);
  assert.equal(plan(A2, { ...A2, personalVideo:"pv2" }, 180000, true, false, false, 0, false).reloadPage, false, "never over a playing video");
});

/* M29, 23 Sep: the update must stop killing the X pane. */
const B = { deck:"d1", chart:"c1", provider:"p1", video:"v1", personalVideo:"pv1", x:"x1" };

test("a new X shell reloads that frame only, and never the whole page", () => {
  const r = plan(B, { ...B, x:"x2" }, 180000, false, false, false, 0, false);
  assert.equal(r.remountX, true, "the X frame alone");
  assert.equal(r.reloadPage, false, "the page is not reloaded for one pane");
  assert.equal(r.remountCharts, false);
});

test("a new X shell waits while the X pane is live, and is not forgotten", () => {
  const live = plan(B, { ...B, x:"x2" }, 180000, false, false, true, 0, false);
  assert.equal(live.remountX, false, "a working picture is not cut off");
  assert.equal(live.xPending, true, "the change is remembered");
  assert.equal(live.heldForX, true);
  assert.equal(live.seen.x, "x1", "the old tag stays until the reload actually happens");
  /* it lands the moment X is no longer live, with no new tag needed */
  const later = plan(live.seen, { ...B }, 180000, false, false, false, 0, live.xPending);
  assert.equal(later.remountX, true);
});

test("a new deck waits for a live X pane as well as for a playing video", () => {
  const held = plan(B, { ...B, deck:"d2" }, 180000, false, false, true, 1000, false);
  assert.equal(held.reloadPage, false, "an X pane showing the feed is not reloaded out from under it");
  assert.equal(held.heldForX, true);
  assert.equal(held.deckPending, true, "and the deck update is still owed");
  assert.equal(plan(B, { ...B, deck:"d2" }, 180000, false, false, false, 0, false).reloadPage, true, "idle X, normal reload");
});

test("the hold on a deck update is bounded, so a Station cannot stay hours behind", () => {
  assert.equal(plan(B, { ...B, deck:"d2" }, 180000, false, false, true, 1799000, false).reloadPage, false);
  assert.equal(plan(B, { ...B, deck:"d2" }, 180000, false, false, true, 1800001, false).reloadPage, true,
    "after the bounded hold the deck does update; the pane re-attaches on its own");
});

test("the deck reloads the X frame, not the page, and listens for the pane's heartbeat", () => {
  assert.match(deck, /if \(plan\.remountX\) for \(const pane of PANES\) \{\n\s*if \(pane\.def\.kind !== "x" \|\| !pane\.frame\) continue;/);
  assert.match(deck, /event\.data\?\.type === "SCINTILLA_X_LIVE"/);
  assert.match(deck, /const X_HOLD_MAX_MS = 1800000;/);
});
