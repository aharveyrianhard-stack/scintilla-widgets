/* The preset scenes paint their DECLARED rows — the first-basket-forever class, closed.
   ====================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/scene-declared-rows.mjs
   The three filed defects of round 4 were all one shape: a scene's declared rows never
   reached the wall. Cohort and family scenes are proven; this closes the class for the
   remaining scene kinds — the fixed preset (macroCrossAsset) and the time-windowed preset
   (indexNow), asserted page-against-model IN the same browser so the time dependence
   cancels out: whatever the model declares for "now" is exactly what the wall must carry.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();

/* ---- 1: the fixed preset — declared tickers, exactly, in order ---- */
const p1 = await context.newPage();
const errs1 = []; p1.on("pageerror", (e) => errs1.push(String(e)));
await p1.goto(origin + "/deck/?scene=macroCrossAsset", { waitUntil: "domcontentloaded" });
await p1.waitForTimeout(4000);
const s1 = await p1.evaluate(() => ({
  wall: CHARTS.slice(0, CHART_COUNT),
  count: CHART_COUNT,
  declared: Array.from(StationScenes.PRESETS.macroCrossAsset.tickers),
}));
assert.deepEqual(s1.wall, ["US10Y", "DXUSD", "GCUSD", "SIUSD", "CLUSD", "BTCUSD"],
  "the wall carries the preset's declared rows, in declared order");
assert.deepEqual(s1.wall, s1.declared, "…and they equal the model's own declaration");
assert.equal(s1.count, 6);
const shot1 = await shoot(p1, "scene-macro-preset-declared-rows");
assert.deepEqual(errs1, []);
await p1.close();

/* ---- 2: the time-windowed preset — page against model, same instant ---- */
const p2 = await context.newPage();
const errs2 = []; p2.on("pageerror", (e) => errs2.push(String(e)));
await p2.goto(origin + "/deck/?scene=indexNow", { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(4000);
const s2 = await p2.evaluate(() => {
  const declared = StationScenes.indexNowTickersFor(new Date());
  const windowed = StationScenes.basketWindow(declared, 0, StationScenes.PRESETS.indexNow.chartCount);
  return { wall: CHARTS.slice(0, CHART_COUNT), expect: Array.from(windowed.tickers) };
});
assert.ok(s2.expect.length > 0, "the model declares a non-empty basket for now");
assert.deepEqual(s2.wall, s2.expect,
  "the wall equals the model's declaration for this instant — no stale window, no first-basket-forever");
assert.deepEqual(errs2, []);
await p2.close();

console.log("scene-declared-rows proof PASSED");

record(`## ${nowStamp()} — the preset scenes paint their declared rows: the first-basket class closed for every scene kind

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/scene-declared-rows.mjs\` (asserts inline)

- **Fixed preset** (${shot1}): /deck?scene=macroCrossAsset carries exactly US10Y · DXUSD · GCUSD · SIUSD · CLUSD · BTCUSD — the model's own frozen declaration, in order, at chartCount 6.
- **Time-windowed preset**: /deck?scene=indexNow's wall equals \`indexNowTickersFor(new Date())\` windowed by the model itself, compared IN the same browser at the same instant so the time dependence cancels — whatever the model declares for now is what the wall carries.
- With the cohort and family proofs of round 4, every scene KIND is now browser-proven to deliver its declared rows: fixed presets, time-windowed presets, cohort membership, family baskets. Also recorded from this sweep: /parity makes NO data reads at all (a static analysis page — authority-clean by construction).

Rollback: this unit adds a proof only; no served file changed.
`);

await close();
