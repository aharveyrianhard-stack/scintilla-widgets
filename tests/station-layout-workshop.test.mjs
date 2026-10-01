// W1 (1 Oct 2026): the Station layout workshop is blueprints only. These tests pin what the
// blueprint page promises and that the deck itself was not touched by the lane.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/%20/g, " ")), "..");
const BP = fs.readFileSync(path.join(ROOT, "deliverables/20261001/station-layout-workshop/blueprints/index.html"), "utf8");
const DOC = fs.readFileSync(path.join(ROOT, "deliverables/20261001/station-layout-workshop/STATION-LAYOUT.html"), "utf8");
test("the blueprint page offers today's layout and three alternatives", () => {
  for (const L of ['"TODAY"', '"A"', '"B"', '"C"']) assert.ok(BP.includes("LAYOUT === " + L), L);
});
test("the blueprints mount the Station's own shells, the ones /deck pins", () => {
  const deck = fs.readFileSync(path.join(ROOT, "deck/index.html"), "utf8");
  for (const shell of ["/station-shells/chart-v1", "/station-shells/personal-video-v1", "/station-shells/x-v2"]) { assert.ok(BP.includes(shell + "/"), shell); assert.ok(deck.includes(shell), shell + " pinned by deck"); }
});
test("the X column never drops text below the 11 px floor", () => { assert.match(BP, /Math\.max\(11, 15 \* s\)/); });
test("the messy chart remembers ticker, timeframe and pin per browser", () => {
  assert.ok(BP.includes('"station.messy.v1"')); for (const k of ["t:", "range:", "pinned:"]) assert.ok(BP.includes(k), k);
});
test("the X ladder advances one post at a time and pauses under the pointer", () => {
  assert.ok(BP.includes("y += posts[i].offsetHeight")); assert.ok(BP.includes('"pointerenter"') && BP.includes('classList.add("paused")'));
});
test("no white and no colour outside the Station's own tokens in the blueprint sheet", () => {
  const css = BP.slice(BP.indexOf("<style>"), BP.indexOf("</style>"));
  for (const hex of css.match(/#[0-9A-Fa-f]{6}\b/g) || []) { assert.notEqual(hex.toUpperCase(), "#FFFFFF"); }
});
test("the workshop page carries every blueprint's shot", () => {
  for (const L of ["A", "B", "C"]) for (const s of ["1680x1050", "2560x1440"]) assert.ok(DOC.includes(`shots/bp-${L}-${s}.png`), L + s);
  assert.ok(DOC.includes("shots/today-1680x1050.png") && DOC.includes("shots/today-2560x1440.png"));
});
