/* 1 Nov 2026 — real X on the Station's column, from the Scintilla app, and YouTube uploads on the list within a minute.
   Alan: "just like my X basically in Station", "instead of the one that auto-scrolled"; "I get notifications for videos to watch on YouTube ... faster than I see them on the station". */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const deck = read("deck/index.html");
test("the Station says where the X column is and whether it can be seen, and only on a Mac", () => {
  assert.match(deck, /function xColumnSignal\(\)/);
  assert.match(deck, /navigator\.platform !== "MacIntel" \|\| navigator\.maxTouchPoints > 0\) return/);
  assert.match(deck, /topic:"station-x", event:"rect"/);
  assert.match(deck, /elementFromPoint/, "a video or charts-only over the column must hide the X window");
  assert.match(deck, /!NO_X/, "the x column switch still rules");
  assert.match(deck, /Math\.max\(Math\.round\(r\.y\), top\)/, "the dock stays reachable above it");
  assert.match(deck, /bottom - y > 120/, "X gets only what can really be seen; the column runs under the video list");
  assert.match(deck, /sw: screen\.width, sh: screen\.height/, "the screen's size says which Mac this is");
});
test("the signal runs after everything it reads exists", () => {
  assert.ok(deck.indexOf("function xColumnSignal()") > deck.indexOf('const NO_X ='), "NO_X is declared first");
  assert.ok(deck.indexOf("function xColumnSignal()") > deck.indexOf('const SB   ='), "SB is declared first");
});
test("the two video shells stay the same file, and read the list every minute", () => {
  const a = read("station-shells/scintilla-video-v1/index.html"), b = read("station-shells/personal-video-v1/index.html");
  assert.equal(a, b);
  assert.match(a, /\}, 60000\);/);
  assert.doesNotMatch(a, /\}, 120000\);/);
});
test("the iPad is told where Share is", () => {
  assert.match(read("notify/index.html"), /IS_IPAD \? 'top right' : 'at the bottom'/);
});
