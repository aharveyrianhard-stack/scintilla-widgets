/* F1 (1 Oct 2026) — THE MERGED PANE'S HOVER READOUT, COMPACT-ONLY. BRIEF-20261001-F1-FOLLOWUPS item 2.
   S6 decision 2, the coordinator's call: keep the full readout on expanded charts, show only the merged values on compact
   panes. On an 8-up pane the full readout ("3H 54.0 R41.8 W−23.7 …") wrapped to three rows over the oscillator.
   What this suite proves, without a browser (the headless shots in deliverables/20261001/f1-osc-readout prove the drawing):
     1. which readout a pane gets: compact (inside the deck or the Hub, not ⤢ / EXPAND) -> merged; expanded or lone -> full;
     2. the item text: compact "3H 70.1", full "3H 70.1 R54.8 W−20.5";
     3. the wiring: both chart twins pass the readout to the pane, and a compact hover never wraps. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const context = { Intl, Date, Math, Number, JSON, Array, Object, Set, Map, isFinite, parseInt, console };
vm.runInNewContext(read("../_indicators/station-osc-merge.js"), context);
const O = context.SC_OSC_MERGE;
const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html");

test("which readout: compact panes (8-up, Hub not expanded) -> merged only; expanded or lone -> full", () => {
  /* the 8-up deck pane and the Hub's company chart are embedded (?bare=1 / ?bare=hub) */
  assert.equal(O.readoutFor({ embedded:true, deckFull:false, hubSplit:null }), "merged", "8-up deck pane");
  assert.equal(O.readoutFor({ embedded:true, deckFull:false, hubSplit:false }), "merged", "Hub company chart, not expanded");
  assert.equal(O.readoutFor({ embedded:true, deckFull:true, hubSplit:null }), "full", "the deck's ⤢ pane");
  assert.equal(O.readoutFor({ embedded:true, deckFull:false, hubSplit:true }), "full", "the Hub's EXPAND");
  assert.equal(O.readoutFor({ embedded:false, deckFull:false, hubSplit:null }), "full", "the chart opened alone (SPY 1D), any height");
  assert.equal(O.readoutFor(null), "full");
});

test("the item text: compact prints the merged value alone, expanded keeps merged + R + W (S6's form unchanged)", () => {
  assert.equal(O.hoverItem("3H", 70.12, 54.83, -20.46, "merged"), "3H 70.1");
  assert.equal(O.hoverItem("3H", 70.12, 54.83, -20.46, "full"), "3H 70.1 R54.8 W−20.5");
  assert.equal(O.hoverItem("4H", 61.2, 58.43, -30.06), "4H 61.2 R58.4 W−30.1", "no readout named = the full one, as S6 pinned it");
  assert.equal(O.hoverItem("D", null, 50, -50, "merged"), "D —", "no merged value: a dash, never borrowed from R or W");
  assert.equal(O.hoverItem("12H", 9.94, null, null, "merged"), "12H 9.9");
});

test("wiring: both twins identical; the pane gets its readout from readoutFor, only when the merged set is shown alone", () => {
  assert.equal(chart, twin, "chart/index.html and station-shells/chart-v1/index.html stay byte-identical");
  assert.match(chart, /const oscReadoutFor = \(\) => window\.SC_OSC_MERGE\.readoutFor\(\{ deckFull:OSC_DECK_FULL, hubSplit:OSC_HUB_SPLIT, embedded:BARE \|\| HUB_PANE \}\);/);
  assert.match(chart, /scrubIx:null, oscMode, oscReadout:oscMode === "merged" \? oscReadoutFor\(\) : "full",/,
    "three stacked panes (split) always read in full");
  assert.match(chart, /M\.hoverItem\(name, v, srcAt\("rsi", line\.key, at\), srcAt\("williams", line\.key, at\), readout\)/);
});

test("a compact hover is ONE row: the title steps aside while hovering, and what does not fit is left off, never wrapped", () => {
  const src = chart.slice(chart.indexOf("function drawRsiOnly("), chart.indexOf("function drawOsc("));
  assert.match(src, /const readout = src && o\.oscReadout === "merged" \? "merged" : "full";/);
  assert.match(src, /const oneRow = readout === "merged" && at != null;/);
  assert.match(src, /for \(const item of oneRow \? items\.slice\(1\) : items\)/);
  assert.match(src, /if \(oneRow\) \{ offRow\.push\(item\.text\); continue; \}\s*x = left \+ 3; y \+= lineH; rows\+\+;/);
  /* what was drawn is reported, so a proof can read it */
  assert.match(src, /readout:src \? readout : null, readoutRows:rows, leftOff:offRow\.length \? offRow : null/);
  /* the full readout still wraps as before (expanded panes have the room; nothing there changed) */
  assert.match(src, /hover:at != null \? \(oneRow \? drawn : items\.slice\(1\)\.map\(\(i\) => i\.text\)\) : null/);
});
