/* CH1 (5 Oct 2026) — DYNAMIC ANCHORS. Alan: "anchor the oscillators intelligently so that it always looks nice and
   clean. Always. Establish the boundaries dynamically."
   RULE A  the lens frames its own window: its candle plot is as tall as the move it holds (6 px per 1% of range),
           never under the 27 Sep height, never over the cap the pane gives; refitted from its own candles.
   RULE B  the oscillator pane keeps 0-100 numbers; its room always holds the 30/70 bands and stretches only as far as
           the visible traces go (+4), never past 0/100; a band outside the room is not drawn.
   RULE C  the price pane's y range fits the visible bars and the visible clouds, then the 6%/8% margins, never under 0.
   RULE D  the Geiger chip, the lens and the cloud labels never sit on the price trace (the headless overflow check). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { OVAL, PX_PER_PCT, lensRangePct, lensPlotHeight, ovalPlotHeight, ovalGeometry } from "../_indicators/station-lens.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");
const chart = read("../chart/index.html");
const ctx = { window: {} };
vm.runInNewContext(read("../_indicators/station-rsi-fan.js"), ctx);
vm.runInNewContext(read("../_indicators/station-osc-merge.js"), ctx);
const O = ctx.SC_OSC_LAB || ctx.window.SC_OSC_LAB;
const bars = (n, lo, hi) => Array.from({ length: n }, (_, i) => ({ t: i, o: lo, h: hi, l: lo, c: hi, v: 1, session: 0 }));

test("RULE A · the lens plot is 6 px per 1% of its window's range, floored at the 27 Sep height, capped by the pane", () => {
  assert.equal(PX_PER_PCT, 6);
  assert.ok(Math.abs(lensRangePct(bars(10, 168, 185)) - 9.63) < 0.01, "CBRS's three sessions: 168..185 is 9.6% of their middle");
  assert.equal(lensRangePct(bars(10, 100, 100)), 0, "a flat window spans nothing");
  assert.equal(lensRangePct([]), 0);
  const long = 470, cap = 280;
  assert.equal(lensPlotHeight(bars(10, 100, 101.5), long, cap), ovalPlotHeight(long), "a quiet day (1.5%) keeps the old slim height");
  assert.equal(lensPlotHeight(bars(10, 168, 185), long, cap), 58, "CBRS's window stands 58 px tall (9.6% x 6)");
  assert.equal(lensPlotHeight(bars(10, 100, 300), long, cap), Math.round(long * OVAL.plotShareMax), "a +100% window stops at 30% of the long axis");
  assert.equal(lensPlotHeight(bars(10, 100, 300), long, 60), 60, "…or at the cap the pane gives, whichever is less");
  assert.equal(lensPlotHeight(bars(10, 100, 300), 117, 20), ovalPlotHeight(117), "a cap under the floor never squashes below the floor");
  /* the oval takes that height, and keeps every candle inside its own frame (candleGeometry's own min/max) */
  const g = ovalGeometry(bars(30, 168, 185), { long, maxPlotH: cap });
  assert.equal(g.plotH, 58);
  const g2 = ovalGeometry(bars(30, 168, 185), { long, plotH: 32 });
  assert.equal(g2.plotH, 32, "an explicit height (the ladder's step-down) is honoured");
  assert.ok(g.b > g2.b, "a taller plot needs a taller oval");
  const src = read("../_indicators/station-lens.mjs");
  assert.match(src, /ovalGeometry\(bars, \{ long, maxPlotH: cap \}\)/, "the pane passes its cap (28% of the plot)");
  assert.match(src, /for \(const h of \[Math\.round\(\(geo\.plotH \+ ovalPlotHeight\(long\)\) \/ 2\), ovalPlotHeight\(long\)\]\)/, "a taller oval that finds no dark space steps down instead of vanishing");
  assert.equal(OVAL.paneShare, 0.28); assert.equal(OVAL.plotShareMax, 0.30);
});

test("RULE B · the oscillator room holds 30/70, follows the visible traces plus 4, never past 0/100; a guide outside it is not drawn", () => {
  assert.deepEqual([...O.oscDomain([45, 50, 55])], [26, 74], "a mid-range window fills the pane instead of a fifth of it");
  assert.deepEqual([...O.oscDomain([])], [26, 74], "no values: the bands and their pad");
  assert.deepEqual([...O.oscDomain([5, 97])], [1, 100], "an extreme is drawn as an extreme, with air: 97 sits under 100, never on the frame");
  assert.deepEqual([...O.oscDomain([0, 100])], [0, 100]);
  assert.deepEqual([...O.oscDomain([20, 88, null, NaN])], [16, 92], "nulls are not values");
  /* the trace is never clipped: every value inside the domain lands inside the pane, padPx in */
  for (const vals of [[45, 50, 55], [5, 97], [0, 100], [20, 88]]) {
    const d = O.oscDomain(vals);
    for (const v of vals) { const y = O.lookY(v, 300, 120, d); assert.ok(y >= 300 + 3 - 1e-9 && y <= 420 - 3 + 1e-9, `${v} in ${d} drawn inside the pane`); }
    assert.ok(O.lookY(d[1], 300, 120, d) <= O.lookY(d[0], 300, 120, d));
  }
  assert.equal(O.lookY(90, 100, 66), O.lookY(90, 100, 66, [0, 100]), "without a domain the old fixed scale");
  assert.match(chart, /domain = M\.oscDomain\(seen\);/);
  assert.match(chart, /if \(domain && \(g\.v < domain\[0\] \|\| g\.v > domain\[1\]\)\) continue;/, "a band outside the room is skipped");
  assert.match(chart, /guides:GUIDES\.filter\(\(g\) => !domain \|\| \(g\.v >= domain\[0\] && g\.v <= domain\[1\]\)\)/, "and not reported as drawn");
  assert.match(chart, /yLo:\(domain \|\| V\.domain\)\[0\], yHi:\(domain \|\| V\.domain\)\[1\], visLo:/, "the pane reports its room and what it holds");
});

test("RULE C · the price range fits the visible bars and clouds, then 6%/8% margins, never under zero, ±1 when flat", () => {
  const src = chart.slice(chart.indexOf("function chPriceRange("), chart.indexOf("if (typeof window !== \"undefined\") window.SC_CH1"));
  const box = {}; vm.runInNewContext(src + "\nthis.chPriceRange = chPriceRange;", box);
  const f = box.chPriceRange;
  let r = f(100, 200, null, 0, 9);
  assert.equal(r.yLo, 94); assert.equal(r.yHi, 208);
  const map = Array.from({ length: 10 }, (_, i) => (i < 5 ? null : { lo: 150, hi: 230, previousLo: 150, previousHi: 240 }));
  r = f(100, 200, map, 0, 9);
  assert.equal(r.yHi, 240 + 140 * .08, "the cloud above the price is inside the pane");
  r = f(100, 200, map, 0, 4);
  assert.equal(r.yHi, 208, "a cloud off screen does not count");
  r = f(30, 2180, null, 0, 9);
  assert.equal(r.yLo, 0, "a price scale never goes negative for its margin (SNDK's year)");
  r = f(50, 50, null, 0, 0);
  assert.ok(Math.abs(r.yLo - (49 - 2 * .06)) < 1e-9 && Math.abs(r.yHi - (51 + 2 * .08)) < 1e-9, "a flat window is opened ±1 then padded");
  assert.match(chart, /const fit = chPriceRange\(lo, hi, cloudMap, start, end\);/);
  assert.match(chart, /let yLo = fit\.yLo, yHi = fit\.yHi;/);
});

test("RULE D · measured headlessly at 1680 x 1050: nothing clipped, nothing on the trace, on CBRS, SNDK, BTCUSD and SPY, both hosts", () => {
  const shots = JSON.parse(read("../deliverables/20261005/ch1-anchors/shots/after-shots.json"));
  const names = shots.map((s) => s.name);
  for (const t of ["CBRS", "SNDK", "BTCUSD", "SPY"]) assert.ok(names.some((n) => n.startsWith(t + "-")), t + " was measured");
  for (const r of ["1h", "4h", "1D", "3D", "1W"]) for (const h of ["station", "hub"]) assert.ok(names.includes(`CBRS-${r}-${h}`), `CBRS ${r} ${h}`);
  for (const s of shots) {
    assert.deepEqual(s.overflow, [], s.name + " overflow: " + s.overflow.join("; "));
    assert.equal(s.errs.length, 0, s.name + " page errors");
    assert.equal(s.blockedWrites, 0, s.name + " attempted a write");
    assert.ok(s.pane.lens && s.pane.lens.spot, s.name + " drew its lens");
    assert.ok(s.pane.osc && s.pane.osc.panes[0].yLo <= 30 && s.pane.osc.panes[0].yHi >= 70, s.name + " oscillator room holds 30/70");
  }
});

test("both chart copies are the same file", () => {
  assert.equal(chart, read("../station-shells/chart-v1/index.html"));
});
