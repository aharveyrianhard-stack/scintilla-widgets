import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const src = deck.match(/const SELF_UPDATE_IDLE_MS = [\s\S]*?\nfunction selfUpdatePlan\(seen, tags, idleMs, videoOnStage, deckPending\) \{[\s\S]*?\n\}\n/)[0]
  .replace(/let SELF_UPDATE_SEEN[\s\S]*?capture:true \}\);\n/, "");
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
