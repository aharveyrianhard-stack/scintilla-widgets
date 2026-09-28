/* I3 · 28 SEP · ROTATION INSIDE THE SLOT, and the three live hotfixes kept through the zoom-fan merge.
   Alan, ~09:55 ET: "within the slot, switch between them… a very simple, soft, flowy experience; I don't
   have to maintain it" and "I need some visual reminder of which charts rotate". The page lap is kept;
   rotating slots step inside the page's dwell and carry "↻ at/of" in their badge row. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(read("deck/scenes.js"), context);
const scenes = context.globalThis.StationScenes;
const deck = read("deck/index.html");
const chart = read("chart/index.html");
const arr = (x) => Array.from(x);
const MARKET = new Date("2026-09-23T15:00:00Z");   /* Wednesday 11:00 ET: SPY/QQQ lead */
const EARLY = new Date("2026-09-23T10:00:00Z");    /* Wednesday 06:00 ET: ES/NQ lead */

test("every rotating slot is marked, every fixed slot is not", () => {
  const rotating = { intraday30m:[0, 1], intraday1h:[0, 1, 2, 3], intraday4h:[2, 3, 4, 5], sectors3D:[6, 7], macroIntraday:[0, 1, 2] };
  for (const id of scenes.WORKFLOW_IDS) {
    const tickers = arr(scenes.workflowPageState(id, { visit:0, at:MARKET }).tickers);
    const marks = arr(scenes.workflowSlotRotation(id, { visit:0, at:MARKET }));
    assert.equal(marks.length, tickers.length, id);
    const marked = marks.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(marked, rotating[id] || [], id);
  }
});

test("a slot's mark names exactly what the slot shows at every step, and no page shows a name twice", () => {
  for (const at of [MARKET, EARLY]) for (const id of scenes.WORKFLOW_IDS) for (let visit = 0; visit < 12; visit++) {
    const tickers = arr(scenes.workflowPageState(id, { visit, at }).tickers);
    const marks = arr(scenes.workflowSlotRotation(id, { visit, at }));
    marks.forEach((m, i) => {
      if (!m) return;
      assert.ok(m.at >= 1 && m.at <= m.of && m.of === m.names.length, id);
      assert.equal(m.names[m.at - 1], tickers[i], `${id} visit ${visit} slot ${i}`);
    });
    assert.equal(new Set(tickers).size, tickers.length, `${id} visit ${visit}`);
  }
});

test("the cycles: 30M leader 1/2 and target k/8; 1H targets k/8; 4H targets k/2; SECTORS k/5; MACRO 4H k/2", () => {
  const m = (id, visit, at = MARKET) => arr(scenes.workflowSlotRotation(id, { visit, at })).map((x) => (x ? x.at + "/" + x.of : "-"));
  assert.deepEqual(m("intraday30m", 0), ["1/2", "1/8"]);
  assert.deepEqual(m("intraday30m", 1), ["2/2", "2/8"]);
  assert.deepEqual(m("intraday1h", 2), ["1/2", "3/8", "3/8", "3/8"]);
  assert.deepEqual(m("intraday4h", 1), ["-", "-", "2/2", "2/2", "2/2", "2/2"]);
  assert.deepEqual(m("sectors3D", 4).slice(6), ["5/5", "5/5"]);
  assert.deepEqual(m("macroIntraday", 0), ["1/2", "1/2", "1/2", "-"]);
  /* outside the market the 30M leader slot cycles ES/NQ */
  assert.deepEqual(arr(scenes.workflowSlotRotation("intraday30m", { visit:0, at:EARLY })[0].names), ["ESUSD", "NQUSD"]);
  /* the windows themselves are the ones the page always had */
  assert.deepEqual(arr(scenes.workflowPageState("intraday30m", { visit:1, at:MARKET }).tickers), ["QQQ", "NBIS"]);
});

test("the lap is unchanged (as live at bca97fa): 23 pages by day, 17 by night; slot steps are a third of the dwell, never under 8 s", () => {
  assert.equal(scenes.rotationScenesFor("day").length, 23);
  assert.equal(scenes.rotationScenesFor("night").length, 17);
  assert.equal(scenes.slotStepMs(33), 11000);
  assert.equal(scenes.slotStepMs(20), 8000);
  assert.equal(scenes.slotStepMs(60), 20000);
  assert.match(deck, /const ROTATE_SECONDS = \[20,33,60\];/);
});

test("deck: the next name fades in over the one on screen, only after it has drawn; the old frame goes last", () => {
  assert.match(deck, /iframe\.slot-next\{ opacity:0;[^}]*transition:opacity \.9s ease; \}/);
  assert.match(deck, /d\.sc === "chart-data-state" && CLEAN\(d\.ticker\) === job\.ticker && d\.hasSeries\) job\.ready\(\)/);
  const fade = deck.slice(deck.indexOf("function crossFadeSlot"), deck.indexOf("function stepRotatingSlots"));
  assert.ok(fade.indexOf('f.classList.add("in")') < fade.indexOf("old.remove()"), "fade in before the old frame leaves");
  assert.ok(fade.indexOf("pane.frame = f") < fade.indexOf("old.remove()"));
  assert.match(fade, /job\.timer = setTimeout\(drop, SLOT_READY_MAX_MS\)/);
  assert.match(deck, /const SLOT_FADE_MS = 900, SLOT_READY_MAX_MS = 9000, SLOT_STAGGER_MS = 700/);
  assert.match(deck, /setInterval\(stepRotatingSlots, 1000\);/);
});

test("deck: held slots, admission, quotes, Geiger and the shared zoom reach the incoming frame", () => {
  assert.match(deck, /if \(slotHeld\(pane\)\) return;/);
  assert.match(deck, /pane\.node\.matches\(":hover"\)/);
  assert.match(deck, /item\.slotNext && item\.slotNext\.frame\.contentWindow === event\.source/);
  assert.match(deck, /const incoming = PANES\.map\(\(p\) => p\.slotNext && p\.slotNext\.ticker\)/);
  assert.match(deck, /for \(const pane of PANES\) if \(pane\.slotNext\) postDeckGeiger\(pane\.slotNext\.frame\);/);
  assert.match(deck, /LAST_CHART_VIEW = \{ from:event\.data\.from/);
  /* any scene install cancels a fade in flight and takes the new page's marks */
  assert.match(deck, /function installSceneState\(state\) \{\n  cancelSlotFades\(\);\n  SLOT_ROT\.marks = Array\.isArray\(state\.rotation\)/);
  assert.match(deck, /rotation: SceneModel\.workflowSlotRotation\(scene, opts\)/);
});

test("chart: the badge row carries '↻ at/of' from deck-rotation, and nothing on a fixed slot", () => {
  assert.match(chart, /if \(d\.sc === "deck-rotation"\)/);
  assert.match(chart, /const text = "\\u21bb " \+ ROTATION_MARK\.at \+ "\/" \+ ROTATION_MARK\.of;/);
  assert.match(chart, /if \(!ROTATION_MARK\) \{ if \(node\) node\.remove\(\); return; \}/);
  assert.match(chart, /paintRotationMark\(badge\);\n  return \{ ticker, change, previous, historyWindow, lastBar \};/);
  const css = chart.match(/\.sc-nchart__live-rot\{([^}]*)\}/)[1];
  assert.match(css, /font:700 11px/);
  for (const hex of css.match(/#[0-9a-f]{6}/gi) || []) {
    const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    assert.ok(Math.max(...c) <= 210 && Math.max(...c) - Math.min(...c) <= 24, hex);
  }
  assert.equal(read("station-shells/chart-v1/index.html"), chart);
});

test("merge kept live's three hotfixes: 04:00-20:00 lens, no STALE before the first bar, both equalizer receipts", () => {
  assert.match(read("_indicators/lens-bars.mjs"), /hours: "extended",/);
  const lens = read("_indicators/station-lens.mjs");
  assert.match(lens, /HOURS\[lens\.hours\]\.open \+ \(lens\.minutes \|\| 30\) \+ SERVE_GRACE_MIN/);
  assert.match(lens, /const fresh = freshness\(sessions, Date\.now\(\), deps\.settled, \{ hours: hoursOf\(want\.timeframe, t\), minutes: TIMEFRAMES\[want\.timeframe\]\.minutes \}\);/);
  /* and the zoom branch's hold-still rule sits in front of it */
  assert.ok(lens.indexOf("since < SETTLE_MS") < lens.indexOf("const fresh = freshness(sessions"));
  const provider = read("_provider/provider.js");
  assert.match(provider, /f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1/);
  assert.match(provider, /d0da9a466c8f51dd48c0f7c45c9e731afc255e91c60c398c356d76af53d91728/);
});
