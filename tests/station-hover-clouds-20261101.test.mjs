/* 1 Nov 2026 — two asks from Alan.
   The cards: "if I hover my mouse, I can view the title of the video ... just a little bit of more information."
   The lenses: "include the moving average lines of the clouds that I use ... as a switch that I can put them on and off."
   The contract this file holds:
     1. a card keeps its one line and gains a hover layer with the title, in both mounted twins, on hover only;
     2. the first hover reads the video's one-line read or its chapters, once;
     3. the lens has the switch: off by default, remembered on this machine, its state told to the deck's dock;
     4. the lines are the clouds' own daily-locked arithmetic, and a far line is named at the edge so the candles keep their scale. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const TWINS = ["station-shells/scintilla-video-v1/index.html", "station-shells/personal-video-v1/index.html"].map(read);
const LENS = read("station-shells/lens-v1/index.html"), DECK = read("deck/index.html");

test("the twins are one page and carry the hover", () => {
  assert.equal(TWINS[0], TWINS[1]);
  assert.match(TWINS[0], /\.card:hover \.hov\{ opacity:1; \}/);
  assert.match(TWINS[0], /@media \(hover:none\)\{ \.hov\{ display:none; \} \}/, "a touch screen has no hover: the layer stays away");
  assert.match(TWINS[0], /pointer-events:none/, "the layer never catches the click that plays the video");
  assert.match(TWINS[0], /class="hov"><b>' \+ esc\(v\.title/);
});
test("the first hover reads the video's read or its chapters, once", () => {
  assert.match(TWINS[0], /card\.dataset\.hov\) return;/);
  assert.match(TWINS[0], /youtube_reads\?select=takeaway,chapters&video_id=eq\./);
  assert.match(TWINS[0], /x\.textContent = row\.takeaway \|\| ch;/);
});
test("the lens's switch is off by default and remembered on this machine", () => {
  assert.match(LENS, /CLOUDS_KEY = "station\.lenses\.clouds"/);
  assert.match(LENS, /let CLOUDS_ON = remembered\(CLOUDS_KEY\) === "1";/);
  assert.match(LENS, /SCINTILLA_LENS_CLOUDS/);
  assert.match(LENS, /clouds:CLOUDS_ON/, "the dock's chip stays true");
  assert.match(LENS, /if \(!CLOUDS_ON \|\| !P \|\| !SC \|\| document\.hidden\) return;/, "no daily read while it is off");
});
test("the lines are the clouds' own arithmetic, far lines named at the edge", () => {
  assert.match(LENS, /<script src="\/_indicators\/station-clouds\.js"><\/script>/);
  assert.match(LENS, /SC\.dailyRows\(/);
  assert.match(LENS, /SC\.mapBarsToDaily\(/);
  assert.match(LENS, /v > geo\.hi \|\| v < geo\.lo/);
  assert.match(LENS, /edge\(above, 6, "▲", false\); edge\(below, H - 6, "▼", true\);/);
  assert.match(LENS, /return \{ lo, hi, points: closes\.length, X, Y \};/);
  assert.match(LENS, /return \{ lo, hi, bars: n, X, Y \};/);
});
test("the deck's dock has the switch and keeps its style chips", () => {
  assert.match(DECK, /id="lensClouds"/);
  assert.match(DECK, /pressed\(el\("lensClouds"\), LENS_DOCK\.clouds\);/);
  assert.match(DECK, /tellLens\(\{ type:"SCINTILLA_LENS_CLOUDS", on:!LENS_DOCK\.clouds \}\)/);
  assert.match(DECK, /el\("lensStyleChips"\)\.querySelectorAll\("\[data-style\]"\)\) pressed/);
});
