/* D2 (27 Sep) — ONE RSI PANE THAT IS THE CHART'S OWN TIMEFRAME.
   Alan, 27 Sep: "I think the RSI as an oscillator pane on the chart is just easier… it has to be a
   Station chart." The Hub's company view asks the Station pane for ?rsi=chart (or the range itself,
   ?rsi=1h … ?rsi=1W): one RSI(14) line computed on bars of the chart's own timeframe.
   What this proves, without a browser:
     1. the default six-line fan is unchanged (the new timeframes are OFF in it);
     2. ?rsi=chart follows the pane's range, 15m through 1W, and ?rsi=<range> names the same line;
     3. a same-timeframe line lands every value on its own bar (no lag, no carry);
     4. the chart page reads the lines per pane, draws a lone line solid, and both twins match. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const context = { Intl, Date, Math, Number, JSON, Array, Object, Set, isFinite, parseInt, console };
vm.runInNewContext(read("../station-shells/detail-v1/indicators.js"), context);
vm.runInNewContext(read("../_indicators/station-rsi-fan.js"), context);
const F = context.SC_RSI_FAN;
const plain = (v) => JSON.parse(JSON.stringify(v));
const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html");

test("the default fan is still the Lab's six; the chart's own timeframes are off in it", () => {
  assert.deepEqual(plain(F.parseRsiParam("1").lines), ["3h","4h","6h","8h","12h","1D"]);
  assert.deepEqual(plain(F.parseRsiParam("auto").lines), ["3h","4h","6h","8h","12h","1D"]);
  for (const k of ["15m","30m","1h","3D","1W"]) assert.equal(F.BY_KEY[k].on, false, k + " is not in the default fan");
});

test("?rsi=chart is one line, the pane's own range, 15m through 1W", () => {
  const req = F.parseRsiParam("chart");
  assert.equal(req.on, true); assert.equal(req.explicit, true, "shown at phone width too");
  const want = { "15m":"15m", "30m":"30m", "1h":"1h", "2h":"2h", "3h":"3h", "4h":"4h", "6h":"6h", "12h":"12h", "1D":"1D", "3D":"3D", "1W":"1W" };
  for (const [range, key] of Object.entries(want)) assert.deepEqual(plain(F.linesFor(req, range)), [key], range);
  assert.deepEqual(plain(F.linesFor(req, "5y")), [], "an unknown range draws nothing rather than a guess");
  assert.deepEqual(plain(F.linesFor(F.parseRsiParam("1"), "1W")), ["3h","4h","6h","8h","12h","1D"], "a fixed request ignores the range");
});

test("?rsi=<range> names the same single line the Hub's timeframe row sends", () => {
  for (const [q, key] of [["1h","1h"],["4h","4h"],["1D","1D"],["3D","3D"],["1W","1W"],["w","1W"]])
    assert.deepEqual(plain(F.parseRsiParam(q).lines), [key], q);
});

test("a same-timeframe line puts each value on its own bar: 1h, 3D and 1W", () => {
  const H = 3600000, D = 86400000;
  for (const [key, step, dur] of [["1h", H, H], ["3D", 3 * D, 3 * D], ["1W", 7 * D, 7 * D]]) {
    const t0 = Date.UTC(2026, 0, 5, 14);
    const times = Array.from({ length: 20 }, (_, i) => t0 + i * step);
    const series = times.map((t, i) => ({ t, end: t + F.BY_KEY[key].durMs, v: i }));
    const out = F.sampleToChart(times, series, dur, F.carryBars(key, dur));
    assert.deepEqual(plain(out), times.map((_, i) => i), key + ": bar i shows value i");
  }
});

test("the chart page reads the lines per pane, draws a lone line solid, and the twins match", () => {
  assert.match(chart, /const rsiLinesFor = \(host\)/);
  assert.equal((chart.match(/RSI_REQUEST\.lines\.map/g) || []).length, 0, "no fixed list is read where a pane's list belongs");
  assert.match(chart, /const solo = o\.fan\.lines\.length === 1;/);
  /* 28 Sep: no dashed daily any more - every line is solid, told apart by weight and its right-edge tag */
  assert.match(chart, /ctx\.lineWidth = solo \? 1\.4 : \(spec\.width \|\| 1\);/);
  assert.equal(chart, twin, "chart and station-shells/chart-v1 stay the same file");
});
