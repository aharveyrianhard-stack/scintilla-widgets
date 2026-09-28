/* P2 (27 Sep 2026, evening). Alan: "The six-line multi-timeframe RSI fan goes on the Station two-chart
   pages too - those should have the oscillator."
   What this suite proves, without a browser:
     1. every page in deck/scenes.js that shows exactly two charts asks each pane for the fan
        (study "RSI" -> ?rsi=auto, the Lab's default six lines), whatever the clock says;
     2. the 4-up and 8-up pages ask for nothing new;
     3. the deck hands a two-chart preset's study to every slot, and keeps it on a second visit
        in the same session (a remembered wall is symbols only). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const sceneCtx = { globalThis: {} };
vm.runInNewContext(read("../deck/scenes.js"), sceneCtx);
const scenes = sceneCtx.globalThis.StationScenes;
const deck = read("../deck/index.html");
const arr = (x) => Array.from(x || []);

const liftFrom = (src, name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `declares ${name}`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
};

/* Mon 11:00 ET (market), Mon 17:00 ET (late), Sun 21:30 ET (night) */
const CLOCKS = ["2026-09-28T15:00:00Z", "2026-09-28T21:00:00Z", "2026-09-28T01:30:00Z"];
const TWO_UP_WORKFLOW = ["mainIndexes3D", "spyQqq1D", "intraday30m"];
const TWO_UP_PRESETS = ["focus2", "internalsFast"];

test("every two-chart workflow page asks each pane for the six-line fan, in every session", () => {
  const found = [];
  for (const id of arr(scenes.WORKFLOW_IDS)) {
    for (const at of CLOCKS) {
      const state = scenes.workflowPageState(id, { at, visit: 0 });
      if (state.chartCount !== 2) continue;
      if (!found.includes(id)) found.push(id);
      assert.equal(state.tickers.length, 2, `${id}: two charts`);
      assert.deepEqual(arr(state.stacks), ["RSI", "RSI"], `${id} at ${at}: both panes carry the study`);
      assert.equal(scenes.studyQuery(state.stacks[0]), "&rsi=auto", `${id}: the pane's query is the fan`);
    }
  }
  assert.deepEqual(found.sort(), TWO_UP_WORKFLOW.slice().sort(), "the two-chart workflow pages are exactly these three");
  /* the leaders switch by the clock and keep the fan either way */
  assert.deepEqual(arr(scenes.workflowPageState("mainIndexes3D", { at: CLOCKS[0] }).tickers), ["SPY", "QQQ"]);
  assert.deepEqual(arr(scenes.workflowPageState("mainIndexes3D", { at: CLOCKS[2] }).tickers), ["ESUSD", "NQUSD"]);
  /* 28 Sep: INTRADAY · 30M is two targets now (never a leader beside a stock) - still with the fan */
  assert.deepEqual(arr(scenes.workflowPageState("intraday30m", { at: CLOCKS[2], visit: 0 }).tickers), ["MU", "WMT"]);
});

test("the 4-up and 8-up pages are unchanged: only the oscillator twins carried the study before, and still do", () => {
  const studied = ["otherIndexesOsc", "targetsOsc"];
  for (const id of arr(scenes.WORKFLOW_IDS)) {
    if (TWO_UP_WORKFLOW.includes(id)) continue;
    const state = scenes.workflowPageState(id, { at: CLOCKS[0], visit: 0 });
    assert.notEqual(state.chartCount, 2, `${id} is not a two-chart page`);
    const want = studied.includes(id) ? "RSI" : "";
    assert.ok(arr(state.stacks).every((s) => s === want), `${id}: stacks ${JSON.stringify(arr(state.stacks))}`);
  }
  assert.equal(scenes.workflowPageState("macroIntraday", { at: CLOCKS[0] }).chartCount, 4);
  assert.equal(scenes.workflowPageState("intraday1h", { at: CLOCKS[0] }).chartCount, 4);
});

test("the two-chart menu presets declare the study; presetStacks covers all eight slots or gives none", () => {
  for (const id of TWO_UP_PRESETS) {
    const preset = scenes.PRESETS[id];
    assert.equal(preset.chartCount, 2, `${id} is two charts`);
    assert.equal(preset.study, "RSI", `${id} carries the fan`);
    assert.deepEqual(arr(scenes.presetStacks(preset)), Array(8).fill("RSI"));
  }
  for (const [id, preset] of Object.entries(scenes.PRESETS))
    if (!TWO_UP_PRESETS.includes(id)) assert.equal(scenes.presetStacks(preset), null, `${id}: no study, no stacks`);
  assert.equal(scenes.presetStacks({ study: "NOT_A_STACK" }), null, "an unknown study is never guessed at");
  /* the workbench keeps its own declared stack (ribbon + 8D EMA + 100D SMA) */
  assert.deepEqual(arr(scenes.workbenchState("oscWorkbench").stacks), ["OSCILLATOR", "OSCILLATOR"]);
});

test("the deck hands a preset's study to its slots and keeps it on a second visit", () => {
  const code = [liftFrom(deck, "fixedSceneState"), liftFrom(deck, "withPageStacks"),
    "({ fixedSceneState, withPageStacks })"].join("\n");
  const api = vm.runInNewContext(code, { SceneModel: scenes, BASKET_OFFSET: 0, familyFor: () => null, Object, Array, String });
  for (const id of TWO_UP_PRESETS) {
    const fixed = api.fixedSceneState(id);
    assert.deepEqual(arr(fixed.tickers), arr(scenes.PRESETS[id].tickers));
    assert.deepEqual(arr(fixed.stacks), Array(8).fill("RSI"), `${id}: every slot asks for the fan`);
    const remembered = { charts: ["MU", "NVDA", "", "", "", "", "", ""], chartCount: 2, range: "3h" };
    assert.deepEqual(arr(api.withPageStacks(remembered, fixed).stacks), Array(8).fill("RSI"), `${id}: a revisit keeps the fan`);
  }
  const plain = api.fixedSceneState("indexLeadership");
  assert.equal(plain.stacks, undefined, "a preset without a study adds nothing to its panes");
  assert.equal(api.withPageStacks({ charts: [] }, plain).stacks, undefined);
  const own = { charts: [], stacks: ["CLOUDS"] };
  assert.equal(api.withPageStacks(own, api.fixedSceneState("focus2")), own, "a state that already names its stacks is left alone");
  assert.match(deck, /withPageStacks\(completeNamedPresetState\(editable, fixed\), fixed\)/, "boot path keeps the study");
  assert.match(deck, /withPageStacks\(completeNamedPresetState\(editableState\(requested\), fixed\), fixed\)/, "page change keeps the study");
});
