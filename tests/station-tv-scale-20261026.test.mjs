/* TV SCALE (26 Oct 2026, coordinator). Alan, moving the Station from the iMac's screen to the TV: "everything gets much
   smaller. I see two videos of the YouTube per row. I see more rows of context lenses. It's shifting. I would prefer if the
   computer one kind of stays the same even if it's on the Apple TV, please."
   A window bigger than the computer's in both directions lays the wall out at the computer's size and magnifies the page. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const deck = read("../deck/index.html");

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
const REF = Object.freeze({ w:1416, h:883 });
const tvScaleOf = fnFromSource(deck, "tvScaleOf", { TV_SCALE_REF:REF, TV_SCALE_MIN:1.05, TV_SCALE_MAX:3 });

test("TV SCALE: the reference is the iMac screen window measured 26 Oct (1416 × 883 CSS px at Brave's 75 %)", () => {
  assert.match(deck, /const TV_SCALE_REF = Object\.freeze\(\{ w:1416, h:883 \}\), TV_SCALE_MIN = 1\.05, TV_SCALE_MAX = 3;/);
});

test("TV SCALE: the TV is magnified, the computer and the MacBook are not", () => {
  assert.equal(tvScaleOf(2560, 1363, "auto", false), 1.544, "the TV window, 1920 × 1050 points at 75 %");
  assert.equal(tvScaleOf(1416, 883, "auto", false), 1, "the iMac screen window: unchanged");
  assert.equal(tvScaleOf(1311, 737, "auto", false), 1, "the MacBook (X column 236 px = 18 % of ~1311): unchanged");
  assert.equal(tvScaleOf(1450, 900, "auto", false), 1, "a window a hair bigger than the computer's: unchanged");
  assert.equal(tvScaleOf(2560, 800, "auto", false), 1, "wider but not taller: unchanged (never below 1)");
  assert.equal(tvScaleOf(1920, 1022, "auto", false), 1.157, "the TV at 100 %: the same wall, magnified less");
  assert.equal(tvScaleOf(9000, 6000, "auto", false), 3, "capped");
});

test("TV SCALE: never on the iPad page, and ?tvscale=0 turns it off for one load", () => {
  assert.equal(tvScaleOf(2560, 1363, "ipad", false), 1);
  assert.equal(tvScaleOf(2560, 1363, "auto", true), 1);
  assert.match(deck, /tvScaleOf\(innerWidth, innerHeight, VIEW, QS\.get\("tvscale"\) === "0"\)/);
});

test("TV SCALE: the zoom is set before the first fit and first in every relayout", () => {
  assert.match(deck, /\napplyTvScale\(\);   \/\* before the first fit/);
  assert.match(deck, /function relayout\(\) \{\n  applyTvScale\(\);/);
  assert.match(deck, /document\.documentElement\.style\.zoom = s === 1 \? "" : String\(s\);/);
});

test("TV SCALE: every place that turns a client position into a style length divides by the zoom", () => {
  for (const [what, re] of [
    ["the timeframe tag at the seam", /Math\.round\(seam \/ deckZoom\(\) - 4\)/],
    ["the SIMPLE split drag", /\(e\.clientY - drag\.top\) \/ deckZoom\(\) \/ Math\.max\(1, drag\.h\)/],
    ["the dock group under a scrolling strip", /dock\.getBoundingClientRect\(\)\.bottom \/ deckZoom\(\) \+ 2/],
    ["the dock magnifier's pointer", /\(clientX - dock\.getBoundingClientRect\(\)\.left\) \/ deckZoom\(\) \/ dockFit\(\)/],
    ["the trackpad relay into a chart", /clientX:\(Number\(data\.clientX \|\| 0\) - rect\.left\) \/ deckZoom\(\)/],
    ["the page-jump panel", /panel\.style\.top = Math\.round\(box\.bottom \/ deckZoom\(\) \+ 6\)/],
    ["the ticker suggestions", /W = innerWidth \/ z, H = innerHeight \/ z/],
  ]) assert.match(deck, re, what);
});
