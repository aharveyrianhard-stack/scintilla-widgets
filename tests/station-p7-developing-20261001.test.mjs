/* P7 (1 Oct 2026): developing bars for the RSI fan's slow context. The chart API serves the bar still
   forming on request (forming=1, marked forming:true); the fan uses it as the developing tip only. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const context = { console, Intl, Date, Math };
context.window = context;
vm.runInNewContext(read("../station-shells/detail-v1/indicators.js"), context);
vm.runInNewContext(read("../_indicators/station-rsi-fan.js"), context);
const F = context.SC_RSI_FAN;
const chart = read("../chart/index.html");
const provider = read("../_provider/provider.js");
const DAY = 864e5, HOUR = 36e5;
const W0 = Date.UTC(2026, 3, 5, 4);                 /* Sunday 5 Apr 2026, ET midnight: a provider week stamp */
const weeks = (n, forming) => Array.from({ length: n }, (_, i) => ({ t: W0 + i * 7 * DAY, c: 100 + 10 * Math.sin(i / 3) + i * 0.1 }))
  .concat(forming ? [{ t: W0 + n * 7 * DAY, c: 130, forming: true }] : []);

test("the forming mark survives the RSI series and a composed width", () => {
  const s = F.lineSeries("cW", weeks(60, true));
  assert.equal(s.at(-1).forming, true);
  assert.equal(s.at(-2).forming, undefined);
  const twoW = F.composeBars(weeks(60, true), F.BY_KEY.c2W.compose);
  assert.equal(twoW.at(-1).forming, true, "a 2W whose newest week is forming is forming");
  const done = F.composeBars(weeks(60, false), F.BY_KEY.c2W.compose);
  assert.ok(!done.some((b) => b.forming));
});

test("a forming bar is never a finished value: sampling, the label and the day's direction ignore it", () => {
  const withF = F.lineSeries("cW", weeks(60, true)), without = F.lineSeries("cW", weeks(60, false));
  /* daily chart bars across the last weeks, running past the forming week's nominal end */
  const times = Array.from({ length: 40 }, (_, i) => W0 + (60 * 7 - 30) * DAY + i * DAY);
  const a = Array.from(F.sampleToChart(times, withF, DAY, F.carryBars("cW", DAY)));
  const formingV = withF.at(-1).v, finishedV = new Set(withF.slice(0, -1).map((p) => p.v));
  assert.ok(!a.includes(formingV), "the forming value is never sampled as finished");
  assert.ok(a.every((v) => v == null || finishedV.has(v)));
  /* the label and the day's direction read the newest FINISHED bar, exactly as without the forming one */
  assert.equal(F.lineStatus(withF, a, 39).value, without.at(-1).v);
  assert.equal(F.lineStatus(withF, a, 39).t, without.at(-1).t);
  assert.equal(F.dayDirection(withF), F.dayDirection(without));
});

test("the developing tip is the forming bar, and says developing", () => {
  const s = F.lineSeries("cW", weeks(60, true));
  const formingStart = W0 + 60 * 7 * DAY;
  /* the newest chart bar: Thursday of the forming week */
  const times = [formingStart - 3 * DAY, formingStart + 1 * DAY, formingStart + 2 * DAY, formingStart + 4 * DAY];
  const values = F.sampleToChart(times, s, DAY, F.carryBars("cW", DAY));
  const dev = F.developingTip(values, times, s, DAY, formingStart + 4 * DAY + 15 * HOUR);
  assert.ok(dev.tip && dev.tip.forming && dev.tip.developing === true);
  assert.equal(dev.values.at(-1), s.at(-1).v);
  /* without the forming bar the right edge has no W at all on a weekly chart - the "W missing" */
  const w = F.lineSeries("cW", weeks(60, false));
  const wkTimes = [formingStart - 7 * DAY, formingStart + 4 * DAY + 11 * HOUR];   /* last completed week, then the live point */
  const plain = F.developingTip(F.sampleToChart(wkTimes, w, 7 * DAY, F.carryBars("cW", 7 * DAY)), wkTimes, w, 7 * DAY, Date.now());
  assert.equal(plain.values.at(-1), null);
  const fixed = F.developingTip(F.sampleToChart(wkTimes, s, 7 * DAY, F.carryBars("cW", 7 * DAY)), wkTimes, s, 7 * DAY, Date.now());
  assert.equal(fixed.values.at(-1), s.at(-1).v);
});

test("a crypto week has seven days: the last finished W carries across the whole next week", () => {
  assert.equal(F.carryBars("cW", DAY), 5);
  assert.equal(F.carryBars("cW", DAY, { sevenDay: true }), 7);
  assert.equal(F.carryBars("c2W", DAY, { sevenDay: true }), 14);
  assert.equal(F.carryBars("c3D", DAY, { sevenDay: true }), F.carryBars("c3D", DAY), "never shorter than the stock rule");
  /* Saturday of a crypto week: a forming bar is current although its stock-week end has passed */
  const s = F.lineSeries("cW", weeks(60, true));
  const formingStart = W0 + 60 * 7 * DAY;
  const sat = formingStart + 6 * DAY;
  const times = [sat - 2 * DAY, sat - DAY, sat];
  const dev = F.developingTip(F.sampleToChart(times, s, DAY, F.carryBars("cW", DAY, { sevenDay: true })), times, s, DAY, sat + 12 * HOUR);
  assert.equal(dev.values.at(-1), s.at(-1).v);
  assert.ok(dev.values.every((v) => v != null), "no Friday gap");
});

test("wiring: fetchRsiSource asks for the forming bar on D, 2D, 3D, W and 2W; the price chart never does", () => {
  assert.match(chart, /const RSI_FORMING_TFS = \["1D", "2D", "3D", "1W", "2W"\];/);
  assert.match(chart, /const forming = !RSI_REQUEST\.chart && RSI_FORMING_TFS\.includes\(tf\);/);
  assert.match(chart, /forming \? fetchProviderCandles\(t, "1D", 3, 1, true\)\.catch\(\(\) => \[\]\) : Promise\.resolve\(\[\]\)/);
  assert.match(chart, /F\.carryBars\(key, chartDur, \{ sevenDay: chMarketOf\(t\) === "CRYPTO" \}\)/);
  /* the price chart's own read passes no forming flag */
  assert.match(chart, /const rows = await fetchProviderCandles\(t, e\[0\], limit, 2\);/);
  assert.equal(read("../chart/index.html"), read("../station-shells/chart-v1/index.html"), "the twins stay identical");
});

test("wiring: the provider client sends forming=1, marks the row, and never caches a forming answer", () => {
  assert.match(provider, /'&authority=provider&limit=' \+ bounded \+ \(forming \? '&forming=1' : ''\);/);
  assert.match(provider, /var cached = forming \? null : candleCacheGet\(url\);/);
  assert.match(provider, /if \(!forming && payload && Array\.isArray\(payload\.series\)/);
  assert.match(provider, /forming: bar\.forming === true/);
});
