/* K1 (5 Oct 2026, SCI-13) — axis navigation in chart-v1: a drag on the date strip changes the time shown, a drag on the
   price strip stretches the price scale, a drag on the chart still pans, double-click puts both back. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const a = readFileSync(new URL("../chart/index.html", import.meta.url), "utf8"), b = readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const grab = (re) => { const m = a.match(re); assert.ok(m, "not found: " + re); return m[0]; };
const K = new Function(grab(/function chartAxisZoneOf\(plot, w, h, x, y\) \{[\s\S]*?\n\}/) + "\n" + grab(/function chartAxisSpan\(baseSpan, dx, plotW, maxSpan\) \{[\s\S]*?\n\}/) + "\n" + grab(/function chartAxisYScale\(base, dy, plotH\) \{[\s\S]*?\n\}/) + "\nreturn { chartAxisZoneOf, chartAxisSpan, chartAxisYScale };")();

test("the two chart files are still one file", () => { assert.equal(a, b); });

test("which strip a press lands on: the price gutter, the date band, or the chart", () => {
  const plot = { padL: 6, padT: 30, iw: 800, ih: 400 };            // a 848 × 451 pane: 42 px gutter, 21 px date band
  assert.equal(K.chartAxisZoneOf(plot, 848, 451, 400, 200), null, "the chart itself");
  assert.equal(K.chartAxisZoneOf(plot, 848, 451, 830, 200), "price");
  assert.equal(K.chartAxisZoneOf(plot, 848, 451, 400, 441), "time");
  assert.equal(K.chartAxisZoneOf(plot, 848, 451, 830, 441), null, "the corner belongs to neither");
  assert.equal(K.chartAxisZoneOf(plot, 848, 435, 400, 433), null, "a pane that borrows its row's dates (5 px under the plot) has no date strip");
  assert.equal(K.chartAxisZoneOf({ ...plot, fanBelow: true }, 848, 600, 400, 441), null, "under the plot sits the oscillator band, not dates");
  assert.equal(K.chartAxisZoneOf(null, 848, 451, 830, 200), null);
});

test("the date strip: half a plot-width left doubles the bars shown, right halves them, inside 8 bars and the whole series", () => {
  assert.equal(K.chartAxisSpan(125, -400, 800, 2000), 250);
  assert.equal(K.chartAxisSpan(125, 400, 800, 2000), 63);
  assert.equal(K.chartAxisSpan(125, 0, 800, 2000), 125);
  assert.equal(K.chartAxisSpan(125, -4000, 800, 240), 240, "never more than the series holds");
  assert.equal(K.chartAxisSpan(125, 4000, 800, 240), 8, "never under eight bars");
});

test("the price strip: half a plot-height down doubles the range shown, up halves it, between a quarter and eight times", () => {
  assert.equal(K.chartAxisYScale(1, 200, 400), 2); assert.equal(K.chartAxisYScale(1, -200, 400), 0.5); assert.equal(K.chartAxisYScale(2, 0, 400), 2);
  assert.equal(K.chartAxisYScale(1, 5000, 400), 8); assert.equal(K.chartAxisYScale(1, -5000, 400), 0.25);
});

test("wiring: the stretch is applied in the draw, put back by double-click and by a new symbol or range; a press on a strip never pans", () => {
  assert.match(a, /if \(host\._yScale && host\._yScale !== 1\) \{ const mid = \(yLo \+ yHi\) \/ 2, half = \(yHi - yLo\) \/ 2 \* host\._yScale;/);
  assert.match(grab(/function resetChartView\(host, notify\) \{[\s\S]*?\n\}/), /host\._yScale = 1;/);
  assert.equal((a.match(/host\._view = null; host\._yScale = 1;/g) || []).length, 2, "the two places a new symbol or range clears the view");
  assert.match(a, /if \(gesture\.type === "pending" && gesture\.zone\) \{ show\(e\.clientX, e\.clientY\); return; \}/);
  assert.match(a, /cv\.style\.cursor = z === "time" \? "ew-resize" : z === "price" \? "ns-resize" : "";/);
});
