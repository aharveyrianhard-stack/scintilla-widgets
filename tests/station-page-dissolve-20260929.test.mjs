/* S2 · 29 SEP · PAGE CHANGES DISSOLVE LIKE THE IN-SLOT ROTATION.
   Alan: "THIS METHOD HOW IT LOOKS WHEN THE SAME CHART ROTATIONS HAPPEN - CAN IT BE TESTED TO SEE IF IT
   WORKS FOR THE WHOLE ENTIRE ROTATION SOMEHOW? ITS VERY SMOOTH AND THE PAGE CHANGES ARE VERY ROUGH."
   The rule this file holds: across the whole rotation, no page change leaves a chart pane blank for more
   than 100 ms, and no pane's box moves except the one move the next page's own layout asks for - with no
   old chart shown in a box it did not have.
   The measured proof is the headless run in deliverables/20260929/station-rotation (every workflow page
   in rotation order, twice: cold, then warm). STATION_BROWSER_GATE=1 re-runs it here in a headless
   browser against the live chart API (about ten minutes). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(read("deck/scenes.js"), context);
const scenes = context.globalThis.StationScenes;
const deck = read("deck/index.html");
const DIR = "deliverables/20260929/station-rotation";
const MAX_BLANK_MS = 100;

/* One page change breaks the rule when a pane is blank for more than 100 ms, a pane's box moves more
   than the one move its page's layout asks for, or an old chart is shown in a box it did not have. */
export function violations(rows) {
  const out = [];
  for (const r of rows) {
    if (r.maxBlankMs > MAX_BLANK_MS) out.push(`${r.lap}:${r.id} blank ${r.maxBlankMs} ms`);
    if (r.unplannedMoves > 0) out.push(`${r.lap}:${r.id} ${r.unplannedMoves} extra box moves`);
    if (r.wrongBoxMs > 0) out.push(`${r.lap}:${r.id} old chart in a new box for ${r.wrongBoxMs} ms`);
  }
  return out;
}
const section = (from, to) => deck.slice(deck.indexOf(from), deck.indexOf(to, deck.indexOf(from) + 1));
function fromDeck(name, bindings = {}) {
  const at = deck.indexOf("const " + name + " = ");
  assert.ok(at > 0, name);
  const statement = deck.slice(at, deck.indexOf(";\n", at));
  return vm.runInNewContext(statement.replace(/^const [A-Za-z]+ = /, "(") + ")", bindings);
}

test("a rotation step or a page button dissolves; a phone wall, an expanded pane, SCRATCH and CUSTOM keep the old path", () => {
  const body = section("function pageDissolves(", "\nconst srcRange");
  const run = (vars, requested, options) => vm.runInNewContext("(" + body.replace(/^function pageDissolves/, "function") + ")(requested, options)",
    Object.assign({ STACKED:false, SOLO:null, MEDIA_STAGE:0, el:() => ({}), requested, options }, vars));
  assert.equal(run({}, "ai1", { rotate:true }), true);
  assert.equal(run({}, "ai1", { screen:true }), true);
  assert.equal(run({}, "ai1", {}), false, "a ticker edit or a chart-count choice is not a page change");
  assert.equal(run({ STACKED:true }, "ai1", { rotate:true }), false);
  assert.equal(run({ SOLO:"c1" }, "ai1", { rotate:true }), false);
  assert.equal(run({}, "scratch", { screen:true }), false);
  assert.equal(run({}, "custom", { screen:true }), false);
  const apply = section("async function applyScene(", "\nfunction moveNamedSceneToCustom");
  assert.match(apply, /const fade = pageDissolves\(requested, options\) \? beginPageFade\(\) : null;\n  SCENE = requested; APPLYING_SCENE = true; installSceneState\(state\);/,
    "the fade exists before the page's state is installed, so the parked frames are kept");
  assert.match(apply, /await dissolveToPage\(fade, options\?\.rotate \? PAGE_READY_MAX_MS : PAGE_READY_HAND_MS\)/);
});

test("nothing on screen is re-pointed or removed while the next page is prepared", () => {
  const prep = section("function preparePageSlot(", "\nfunction clearPageSlot(");
  assert.doesNotMatch(prep, /pointChartFrame\(pane\.frame|pane\.frame\.remove|pane\.frame\s*=/, "the frame on screen is left alone");
  assert.doesNotMatch(prep, /chart-off/, "no pane is hidden before the fade");
  /* the only frame taken over is one the old page was keeping hidden */
  assert.match(prep, /if \(!shown && pane\.frame && pane\.frame\.contentWindow && pane\.reportedTicker &&/);
  const commit = section("function commitPageFade(", "\nasync function dissolveToPage(");
  assert.match(commit, /parkSpare\(pane, old, pane\.reportedTicker\)/, "the frame faded away from is parked for reuse");
  assert.match(commit, /PAGE_SETTLED = fade\.settled;\n  try \{ applyChartCount\(CHART_COUNT, true, 0\); \}/, "the layout follows in the same task");
  const sync = section("function syncChartPanes(", "\nasync function applyScene(");
  assert.match(sync, /\} else if \(ticker && o\.frame\) \{\n      if \(settled && settled\.has\(o\.def\.key\)\) return;/,
    "a settled slot is not told its name again (that made the chart show 'loading')");
});

test("the page fade is L6's: 0.9 s in 8 opacity steps, over the old charts and under the notes and the timeframe tag", () => {
  assert.match(deck, /\.chart-pane > \.body > iframe\.page-next\{ opacity:0; pointer-events:none; z-index:11; transition:opacity \.9s steps\(8, jump-end\); \}/);
  assert.match(deck, /\.chart-pane > \.body > iframe\.page-next\.in\{ opacity:1; \}/);
  assert.match(deck, /#rowTop\.page-measure iframe\{ display:none !important; \}/, "measuring the next boxes never resizes a chart");
});

test("the next page waits for the line, the price, the clouds, the lens and the chip - and never longer than its cap", () => {
  const ready = section("function pageFrameReady(", "\nfunction greetPageFrame(");
  for (const part of [/h\._series && h\._series\.length >= 2 && h\._plot/, /sc-nchart__live/, /_cloudRows/, /sc-nchart__lens/, /sc-nchart__live-geiger\.is-float/])
    assert.match(ready, part);
  assert.match(ready, /h\._dataState\.history === "absent"/, "a name with no bars (the put/call pane at night) is finished when it shows its reason");
  assert.match(deck, /const PAGE_READY_MAX_MS = 8000, PAGE_READY_HAND_MS = 3000/);
  const dissolve = section("async function dissolveToPage(", "\nwindow.addEventListener");
  assert.match(dissolve, /while \(!fade\.abandoned && Date\.now\(\) < until && !fade\.jobs\.every\(pageFrameReady\)\)/);
  assert.match(dissolve, /setTimeout\(r, SLOT_FADE_MS\)\);\n.*\n    await new Promise\(\(r\) => requestAnimationFrame\(\(\) => requestAnimationFrame\(r\)\)\);/,
    "the switch-over waits for the fade's last step to be painted");
});

test("box helpers: a transition generation is not part of what a frame shows; a sub-pixel difference is the same box", () => {
  const withoutTransition = fromDeck("withoutTransition");
  assert.equal(withoutTransition("/c?t=SPY&range=3D&transition=4&bubble=x"), "/c?t=SPY&range=3D&bubble=x");
  assert.equal(withoutTransition("/c?t=SPY&transition=4"), "/c?t=SPY");
  const sameBox = fromDeck("sameBox", { Math });
  assert.equal(sameBox({ left:0, top:0, width:419, height:277 }, { left:0.4, top:0, width:419.2, height:277 }), true);
  assert.equal(sameBox({ left:0, top:0, width:419, height:277 }, { left:0, top:0, width:559, height:277 }), false);
});

test("the whole rotation, measured headlessly on this branch: no change blanks a pane over 100 ms or moves a box", () => {
  const rows = JSON.parse(read(DIR + "/branch-1680-rows.json"));
  const pages = scenes.WORKFLOW_IDS.length;
  assert.equal(rows.filter((r) => r.lap === 1).length, pages, "every workflow page, cold");
  assert.equal(rows.filter((r) => r.lap === 2).length, pages, "every workflow page, warm");
  assert.deepEqual(rows.filter((r) => r.lap === 1).map((r) => r.id), Array.from(scenes.WORKFLOW_IDS), "in rotation order");
  assert.deepEqual(violations(rows), []);
});

test("the same check fails on the page changes live today (so it can catch a regression)", () => {
  const rows = JSON.parse(read(DIR + "/live-1680-rows.json"));
  assert.ok(violations(rows).length > 10, "live blanks panes on most changes");
});

test("headless browser gate: the whole rotation, twice, against the live chart API", { skip: !process.env.STATION_BROWSER_GATE, timeout: 1500000 }, () => {
  const out = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "rot-")), "gate.json");
  execFileSync("node", [path.join(ROOT, DIR, "harness/rotation.mjs"), ROOT, out, "--laps=2", "--window=12"], { stdio: "inherit" });
  execFileSync("node", [path.join(ROOT, DIR, "harness/analyze.mjs"), out, "--json=" + out + ".rows"], { stdio: "inherit" });
  assert.deepEqual(violations(JSON.parse(fs.readFileSync(out + ".rows", "utf8"))), []);
});
