/* STATION · RM1 (7 Oct 2026) — THE NIGHT RELOAD, and the rule it stands beside.
   ============================================================================
   Alan, 7 Oct: "When I leave Scintilla open and the Station open, it takes a lot of RAM in Activity Monitor
   after a while. When I quit and come back, it's perfectly fine… at least a calendar of overnight quitting
   and restarting would be nice - but for the Station that means opening the Station in the Brave PWA, X in
   the Brave PWA, executing the extension in the X PWA."
   The stopgap is a new schedule, so it is tested TOGETHER with its neighbour (Alan, 3 Oct: "something always
   new from one new rule bites us later"): selfUpdatePlan decides whether the page may reload at all - two
   quiet minutes across the deck and its panes (M51), no video on stage, a live X pane's 30 minutes - and the
   night rule only decides whether tonight's reload is due. It reloads the Station page and nothing else:
   the X window and its extension are never spoken to.
   Decided without a browser; the headless end-to-end run on a moved clock is in
   deliverables/20261007/rm1-memory/. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");

const planSrc = deck.match(/const SELF_UPDATE_IDLE_MS = [\s\S]*?\nfunction selfUpdatePlan\(seen, tags, idleMs, videoOnStage, deckPending, xLive, xHeldMs, xPending, chartPending\) \{[\s\S]*?\n\}\n/)[0]
  .replace(/let SELF_UPDATE_SEEN[\s\S]*?capture:true \}\);\n/, "").replace(/function xPaneLive[\s\S]*?\n/, "");
const fn = (name) => { const s = deck.search(new RegExp("^function " + name + "\\b", "m")); assert.ok(s >= 0, name + " is declared at column 0"); return deck.slice(s, deck.indexOf("\n}\n", s) + 3); };
const constLine = (name) => deck.match(new RegExp("^const " + name + " = [^\\n]*\\n", "m"))[0];
const { selfUpdatePlan, nightReloadDue, nightHold, placeToKeep, placeKept, RULE, DEFAULT_ON, IDLE, HOLD, KEEP_MAX } = new Function(
  planSrc + constLine("NIGHT_RELOAD_DEFAULT_ON") + constLine("NIGHT_RELOAD_RULE") + constLine("KEEP_PLACE_KEY") + fn("nightReloadDue") + fn("nightHold") + fn("placeToKeep") + fn("placeKept") +
  "return { selfUpdatePlan, nightReloadDue, nightHold, placeToKeep, placeKept, RULE: NIGHT_RELOAD_RULE, DEFAULT_ON: NIGHT_RELOAD_DEFAULT_ON, IDLE: SELF_UPDATE_IDLE_MS, HOLD: X_HOLD_MAX_MS, KEEP_MAX: KEEP_PLACE_MAX_MS };")();
const H = 3600000;
const TAGS = { deck: "d1", chart: "c1", provider: "p1", video: "v1", personalVideo: "pv1", x: "x1" };

test("the rule is 3 to 5 in the morning, after four hours open; thirty hours open is overdue", () => {
  assert.deepEqual({ ...RULE }, { fromHour: 3, toHour: 5, minOpenMs: 4 * H, overdueMs: 30 * H });
  assert.equal(DEFAULT_ON, true);
  assert.equal(nightReloadDue(true, 5 * H, 3, RULE).due, true);
  assert.equal(nightReloadDue(true, 5 * H, 5, RULE).due, false, "5 am is past the window");
  assert.equal(nightReloadDue(true, 5 * H, 15, RULE).due, false, "never in the working day");
  assert.equal(nightReloadDue(true, 3 * H, 4, RULE).due, false, "opened at 1 am: left alone tonight");
  assert.equal(nightReloadDue(true, 0, 4, RULE).due, false, "a page that has just loaded is never due - this is what makes it once a night");
  assert.equal(nightReloadDue(true, 30 * H, 15, RULE).due, true, "a Mac that slept through its night");
  assert.deepEqual(nightReloadDue(false, 40 * H, 3, RULE), { due: false, why: "switched off" });
});

/* What the deck does on each three-minute check, written out as the deck writes it. */
const decide = ({ seen = TAGS, tags = TAGS, idleMs, videoOnStage = false, pending = false, xLive = false, xHeldMs = 0, on = true, openMs, hour, up = { browserFull: false, floating: false } }) => {
  const plan = selfUpdatePlan(seen, tags, idleMs, videoOnStage, pending, xLive, xHeldMs, false, false);
  if (plan.reloadPage) return "reload: release";
  const night = nightReloadDue(on, openMs, hour, RULE);
  if (night.due && tags.deck && selfUpdatePlan(null, tags, idleMs, videoOnStage, true, xLive, xHeldMs, false, false).reloadPage && !nightHold(up)) return "reload: night";
  return "nothing";
};
const quiet = { idleMs: 10 * 60000, openMs: 8 * H, hour: 3 };

test("the deck's own wiring is the decision tested here, and the release rule's lines are as they were", () => {
  assert.match(deck, /CHART_PENDING = plan\.chartPending;\n  if \(plan\.reloadPage\) \{ location\.reload\(\); return; \}\n/, "a release still reloads first, untouched");
  assert.match(deck, /const night = nightReloadDue\(NIGHT_RELOAD_ON, Date\.now\(\) - STATION_LOADED_AT, new Date\(\)\.getHours\(\), NIGHT_RELOAD_RULE\);\n  if \(night\.due && tags\.deck && selfUpdatePlan\(null, tags, stationIdleMs\(\), selfUpdateVideoOnStage\(\), true, live,\n      X_HELD_SINCE \? Date\.now\(\) - X_HELD_SINCE : 0, false, false\)\.reloadPage && !nightHoldNow\(\)\) \{\n    stationKeepPlace\(\); location\.reload\(\); return;/,
    "the night reload asks selfUpdatePlan the release's own question, with the same hands, video and X answers, and waits for full screen and a floating video");
  assert.match(deck, /setTimeout\(selfUpdateCheck, 15000\);\nsetInterval\(selfUpdateCheck, SELF_UPDATE_MS\);/, "no second clock: it rides the three-minute check");
});

test("a quiet night reloads the Station; in the day it does not", () => {
  assert.equal(decide(quiet), "reload: night");
  assert.equal(decide({ ...quiet, hour: 11 }), "nothing");
  assert.equal(decide({ ...quiet, on: false }), "nothing", "switched off");
});

test("it never happens where a release reload would wait: a hand on any pane, a video on stage, a fresh X picture", () => {
  for (const idleMs of [0, 60000, IDLE - 1, IDLE, 10 * 60000]) for (const videoOnStage of [false, true])
    for (const [xLive, xHeldMs] of [[false, 0], [true, 60000], [true, HOLD - 1], [true, HOLD], [true, 5 * H]]) {
      const release = selfUpdatePlan(TAGS, { ...TAGS, deck: "d2" }, idleMs, videoOnStage, false, xLive, xHeldMs, false, false).reloadPage;
      assert.equal(decide({ ...quiet, idleMs, videoOnStage, xLive, xHeldMs }) === "reload: night", release,
        `idle ${idleMs} ms, video ${videoOnStage}, X live ${xLive} for ${xHeldMs} ms: the same answer a new deck gets`);
    }
  assert.equal(decide({ ...quiet, videoOnStage: true }), "nothing", "a stream being watched is never cut off");
  assert.equal(decide({ ...quiet, xLive: true, xHeldMs: 10 * 60000 }), "nothing", "an X picture that has just come on is left alone");
  assert.equal(decide({ ...quiet, xLive: true, xHeldMs: 6 * H }), "reload: night", "an X picture on all night: the pane takes it back by itself, as after a release");
});

test("the server must have just answered: the Station is never reloaded into an error page", () => {
  assert.equal(decide({ ...quiet, tags: { deck: "", chart: "", provider: "", video: "", personalVideo: "", x: "" } }), "nothing");
});

test("a failed version read still triggers nothing, night or day (the release rule's own guarantee)", () => {
  const r = selfUpdatePlan(TAGS, { deck: "", chart: "", provider: "" }, 999999, false, false);
  assert.equal(r.remountCharts, false); assert.equal(r.reloadPage, false);
});

test("one night, one reload: three days of three-minute checks on a Station nobody touches", () => {
  let loadedAt = 9 * H; const reloads = [];
  for (let now = 9 * H; now < 9 * H + 72 * H; now += 180000) {
    const hour = Math.floor(now / H) % 24;
    if (decide({ ...quiet, xLive: true, xHeldMs: now - loadedAt, openMs: now - loadedAt, hour }) === "reload: night") { reloads.push(now); loadedAt = now; }
  }
  assert.equal(reloads.length, 3, "three nights, three reloads");
  for (const at of reloads) assert.equal(Math.floor(at / H) % 24, 3, "each at the first check after 3 am");
});

test("the switch is the address, remembered on that browser, like the clouds and keepcharts switches", () => {
  assert.match(deck, /const NIGHT_RELOAD_ON = QS\.has\("nightreload"\) \? QS\.get\("nightreload"\) !== "0"\n  : remembered\("station\.nightreload"\) === "" \? NIGHT_RELOAD_DEFAULT_ON : remembered\("station\.nightreload"\) === "1";/);
  assert.match(deck, /if \(QS\.has\("nightreload"\)\) remember\("station\.nightreload", NIGHT_RELOAD_ON \? "1" : "0"\);/);
});

test("it waits for what the release rule does not look at: the browser's full screen, a floating video", () => {
  assert.equal(nightHold({ browserFull: false, floating: false }), "");
  assert.match(nightHold({ browserFull: true, floating: false }), /full screen/, "a browser cannot be put back in full screen without a hand");
  assert.match(nightHold({ browserFull: false, floating: true }), /floating/, "a floating video belongs to the page that opened it");
  assert.equal(decide({ ...quiet, up: { browserFull: true, floating: false } }), "nothing");
  assert.equal(decide({ ...quiet, up: { browserFull: false, floating: true } }), "nothing");
  assert.equal(decide({ ...quiet, tags: { ...TAGS, deck: "d2" }, up: { browserFull: true, floating: false } }), "reload: release", "the release rule itself is not changed by the hold");
  const now = fn("nightHoldNow");
  assert.match(now, /document\.fullscreenElement/); assert.match(now, /documentPictureInPicture\.window/);
});

test("the expanded pane and the place of each video list are carried over the one reload, and nothing older", () => {
  const now = 1_800_000_000_000;
  const kept = placeToKeep([["personal", 640.4], ["scintilla", 0], ["x", undefined]], "x", now);
  assert.deepEqual(kept, { at: now, solo: "x", panes: { personal: 640 } }, "only a list that was scrolled; the pane that was expanded");
  assert.deepEqual(placeKept(kept, now + 4000), { solo: "x", panes: { personal: 640 } });
  assert.deepEqual(placeKept(kept, now + KEEP_MAX), { solo: null, panes: {} }, "two minutes old: it belongs to an earlier load");
  assert.deepEqual(placeKept(null, now), { solo: null, panes: {} }); assert.deepEqual(placeKept({ at: now }, now), { solo: null, panes: {} });
  assert.deepEqual(placeToKeep([], null, now), { at: now, solo: null, panes: {} }, "nothing expanded, nothing scrolled");
  assert.equal(placeKept({ at: now, solo: 'x"],[y', panes: {} }, now).solo, null, "only a plain pane name is read back");
  assert.match(deck, /if \(solo && PANES\.some\(\(pane\) => pane\.def\.key === solo\)\) \{ try \{ if \(SOLO !== solo\) setSolo\(solo\); \} catch \(_\) \{\} solo = null; \}/,
    "it comes back through the deck's own switch, once the deck has built that pane (the deck builds after its first reads)");
  const keep = deck.slice(deck.indexOf("function stationKeepPlace()"), deck.indexOf("async function selfUpdateTags()"));
  assert.match(keep, /sessionStorage\.setItem\(KEEP_PLACE_KEY/); assert.match(keep, /sessionStorage\.removeItem\(KEEP_PLACE_KEY\)/, "used once");
  assert.doesNotMatch(keep, /fetch\(|postMessage|chrome\.|x-v2|kind === "x"/, "it reads the video lists and the expanded pane only: nothing is said to the X pane, its window or its extension");
});
