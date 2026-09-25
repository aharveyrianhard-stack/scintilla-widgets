/* THE RSI FAN ON STATION CHARTS (P2-STATION-RSI-FAN, SCI-11, 25 Sep 2026).
   ============================================================================
   Alan: "We do have a multi-timeframe RSI… I believe it's six lines… you do have the RSI."
   What this suite proves, without a browser:
     1. the arithmetic: the RSI the fan draws is the detail view's Wilder RSI, checked against
        a textbook series whose first value is worked out by hand below;
     2. the Lab's inputs: length 14, 2H off, 3H 4H 6H 8H 12H D on, 30/50/70, upper green /
        lower red, one non-grey ink per line;
     3. the placement rule: no chart bar shows a source value that had not finished yet, and a
        source that stopped is never stretched flat to the present;
     4. the query (?rsi=) and the three deck pages (ids, order, study);
     5. the wiring pins: both chart twins load the two modules, the provider client maps 8h. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const context = { Intl, Date, Math, Number, JSON, Array, Object, Set, isFinite, parseInt, console };
vm.runInNewContext(read("../station-shells/detail-v1/indicators.js"), context);
vm.runInNewContext(read("../_indicators/station-rsi-fan.js"), context);
const M = context.SC_DETAIL_MATH, F = context.SC_RSI_FAN;
const plain = (v) => JSON.parse(JSON.stringify(v));
const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html");
const provider = read("../_provider/provider.js");
const sceneCtx = { globalThis: {} };
vm.runInNewContext(read("../deck/scenes.js"), sceneCtx);
const scenes = sceneCtx.globalThis.StationScenes;

/* Wilder's 14-period example as StockCharts tabulates it (33 closes). By hand, the first value:
   the first 14 changes gain 3.34 in total and lose 1.40, so
     RS  = (3.34 / 14) / (1.40 / 14) = 2.385714
     RSI = 100 - 100 / (1 + 2.385714) = 70.464
   StockCharts prints 70.53 because it rounds the two averages to 0.24 and 0.10 first; the
   unrounded value is the one TradingView's ta.rsi computes. The rest were checked the same way
   in an independent computation (Python, this run). */
const WILDER = [44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,
  46.00,46.03,46.41,46.22,45.64,46.21,46.25,45.71,46.45,45.78,45.35,44.03,44.18,44.22,44.57,43.42,42.66,43.13];
const WILDER_RSI = [70.46,66.25,66.48,69.35,66.29,57.92,62.88,63.21,56.01,62.34,54.67,50.39,40.02,41.49,41.90,45.50,37.32,33.09,37.79];

test("the fan's RSI is the detail view's Wilder RSI, and it matches the hand-checked series", () => {
  const rsi = M.rsiSeries(WILDER.map((c) => ({ c })), 14);
  for (let i = 0; i < 14; i++) assert.equal(rsi[i], null, "no value before fourteen changes exist");
  assert.ok(Math.abs(rsi[14] - 70.464) < 0.001, "first value, by hand: " + rsi[14]);
  WILDER_RSI.forEach((want, k) => assert.ok(Math.abs(rsi[14 + k] - want) < 0.006, `bar ${14 + k}: ${rsi[14 + k]} vs ${want}`));
  /* lineSeries is the same numbers, shifted into time, with the warm-up withheld */
  const bars = Array.from({ length: 400 }, (_, i) => ({ t: Date.UTC(2026, 0, 1) + i * 3 * 3600e3, c: 100 + Math.sin(i / 7) * 5 + i * 0.01 }));
  const series = F.lineSeries("3h", bars, M);
  const direct = M.rsiSeries(bars, 14);
  assert.equal(series.length, 400);
  assert.ok(series.slice(0, F.WARMUP).every((s) => s.v === null), "the warm-up is computed, never drawn");
  assert.equal(series[399].v, direct[399], "after the warm-up the value is exactly the detail view's");
  assert.equal(series[399].end - series[399].t, 3 * 3600e3, "a 3H bar finishes three hours after its stamp");
});

test("the Lab's inputs: RSI 14, 2H off by default, the six lines Alan named on, one non-grey ink", () => {
  assert.equal(F.LENGTH, 14);
  assert.deepEqual(plain(F.LINES.map((l) => l.label)), ["2H","3H","4H","6H","8H","12H","D"]);
  assert.deepEqual(plain(F.LINES.filter((l) => l.on).map((l) => l.label)), ["3H","4H","6H","8H","12H","D"],
    "the experiment script: 2H OFF by default, the other six ON");
  const alphas = F.LINES.map((l) => l.alpha);
  assert.deepEqual(plain(alphas), [...alphas].sort((a, b) => a - b), "slower is more solid, as in the script");
  assert.equal(F.INK.family.toUpperCase(), "#526DFF", "the script's RSI family colour");
  assert.equal(F.INK.upper.toUpperCase(), "#39D98A", "upper boundary green");
  assert.equal(F.INK.lower.toUpperCase(), "#F05B78", "lower boundary red");
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r, g, b] = rgb(F.INK.family);
  assert.ok(Math.max(r, g, b) - Math.min(r, g, b) > 24, "the line ink is a colour, never a grey");
  assert.ok(!(r > 230 && g > 230 && b > 230), "and never white");
  for (const l of F.LINES) assert.match(F.ink(l.key), /^rgba\(82,109,255,0\.\d\d\)$/, l.label + " uses the one family ink");
  assert.ok(F.PANEL_SHARE <= 0.28, "the panel never takes more than 28% of the pane");
});

test("?rsi= parsing: 1, a picked list, auto, off, and unknown tokens reported, not guessed", () => {
  assert.deepEqual(plain(F.parseRsiParam(null)), { on:false, explicit:false, lines:[], dropped:[] });
  assert.deepEqual(plain(F.parseRsiParam("1").lines), ["3h","4h","6h","8h","12h","1D"]);
  assert.equal(F.parseRsiParam("1").explicit, true);
  assert.deepEqual(plain(F.parseRsiParam("2h,4h,1D")), { on:true, explicit:true, lines:["2h","4h","1D"], dropped:[] });
  assert.deepEqual(plain(F.parseRsiParam("1D,2H").lines), ["2h","1D"], "the fan's own order, whatever the URL's");
  assert.deepEqual(plain(F.parseRsiParam("d, 8h").lines), ["8h","1D"], "D and 1D are the daily line");
  assert.deepEqual(plain(F.parseRsiParam("4h,5m")), { on:true, explicit:true, lines:["4h"], dropped:["5m"] });
  assert.equal(F.parseRsiParam("5m").on, false, "nothing recognised is nothing drawn");
  assert.equal(F.parseRsiParam("0").on, false);
  const auto = F.parseRsiParam("auto");
  assert.equal(auto.on, true); assert.equal(auto.explicit, false);
  assert.equal(F.visibleAt(auto, 390), false, "a deck page's fan is hidden on a 390 px pane");
  assert.equal(F.visibleAt(auto, 391), true);
  assert.equal(F.visibleAt(F.parseRsiParam("1"), 390), true, "a typed ?rsi= always shows");
});

const H = 3600e3, D = 86400e3;
const ny = (iso) => Date.parse(iso);

test("no peeking: a daily line on a 4H chart shows yesterday until today's daily bar has finished", () => {
  /* Daily bars stamped at midnight New York (04:00Z in September) finish 20 h later. */
  const daily = [ny("2026-09-22T04:00:00Z"), ny("2026-09-23T04:00:00Z")].map((t, i) => ({ t, end: t + 20 * H, v: 40 + i * 10 }));
  const chart4h = ["2026-09-23T08:00:00Z","2026-09-23T12:00:00Z","2026-09-23T16:00:00Z","2026-09-23T20:00:00Z","2026-09-24T08:00:00Z"].map(ny);
  assert.equal(F.carryBars("1D", 4 * H), 5, "a daily value may stand for a day's five 4H bars");
  const out = F.sampleToChart(chart4h, daily, 4 * H, F.carryBars("1D", 4 * H));
  assert.deepEqual(plain(out), [40, 40, 40, 50, 50],
    "Tuesday's value through Wednesday's session; Wednesday's appears on the bar that ends at its 20:00 close");
});

test("a 3H line on a daily chart shows each day's last finished 3H value", () => {
  const days = ["2026-09-22T04:00:00Z","2026-09-23T04:00:00Z"].map(ny);
  const three = [];
  for (const [day, base] of [["2026-09-22", 10], ["2026-09-23", 20]])
    ["08","11","14","17","20"].forEach((hh, k) => { const t = ny(day + "T" + hh + ":00:00Z"); three.push({ t, end: t + 3 * H, v: base + k }); });
  assert.equal(F.carryBars("3h", D), 0, "a 3H value never stands for a later day");
  assert.deepEqual(plain(F.sampleToChart(days, three, D, 0)), [14, 24], "the day's last 3H bar, never the next day's");
});

test("a session the source never delivered is a gap, not a flat line, and the label names the day", () => {
  /* 25 Sep, seen live: the chart API's 3H bars ended on 23 Sep while its daily bars reached 24 Sep.
     A day-count allowance carried the 23rd across the 24th as a flat line; the bar count does not. */
  const days = ["2026-09-22T04:00:00Z","2026-09-23T04:00:00Z","2026-09-24T04:00:00Z"].map(ny);
  const three = [];
  for (const [day, base] of [["2026-09-22", 10], ["2026-09-23", 20]])
    ["08","11","14","17","20"].forEach((hh, k) => { const t = ny(day + "T" + hh + ":00:00Z"); three.push({ t, end: t + 3 * H, v: base + k }); });
  const values = F.sampleToChart(days, three, D, F.carryBars("3h", D));
  assert.deepEqual(plain(values), [14, 24, null], "the 24th has no 3H bars, so it has no 3H value");
  const status = F.lineStatus(three, values, 2);
  assert.equal(status.stale, true, "the line does not reach the last completed bar");
  assert.equal(new Date(status.t).toISOString().slice(0, 10), "2026-09-23", "and the label names the 23rd");
  assert.equal(F.lineStatus(three, values, 1).stale, false, "a line that reaches the last bar carries no date");
});

test("a stopped source stops on the chart the bar after it stopped", () => {
  const chart = []; for (let i = 0; i < 40; i++) chart.push(ny("2026-08-10T04:00:00Z") + i * D);
  const eight = []; for (let i = 0; i < 25; i++) { const t = ny("2026-08-10T12:00:00Z") + i * 8 * H; eight.push({ t, end: t + 8 * H, v: 50 + (i % 3) }); }
  const out = F.sampleToChart(chart, eight, D, F.carryBars("8h", D));
  const lastEnd = eight[eight.length - 1].end;
  const firstAfter = chart.findIndex((t, i) => (i + 1 < chart.length ? chart[i + 1] : t + D) >= lastEnd);
  assert.ok(out.slice(0, firstAfter + 1).every((v) => v != null), "drawn through the bar it finished in");
  assert.ok(out.slice(firstAfter + 1).every((v) => v === null), "and nothing after: no flat line to the present");
  assert.equal(F.lineStatus(eight, out, chart.length - 1).stale, true);
});

test("a weekend is not a gap: the chart's own bars already skip it", () => {
  /* Friday's daily bar finishes at 20:00 New York (00:00Z Saturday); the next 4H bars are Monday's. */
  const fri = { t: ny("2026-09-04T04:00:00Z"), end: ny("2026-09-05T00:00:00Z"), v: 55 };
  const chart = ["2026-09-04T16:00:00Z","2026-09-04T20:00:00Z","2026-09-08T08:00:00Z","2026-09-08T12:00:00Z"].map(ny);
  assert.deepEqual(plain(F.sampleToChart(chart, [fri], 4 * H, F.carryBars("1D", 4 * H))), [null, 55, 55, 55],
    "Friday's value appears on the bar its session closed in and holds into Tuesday morning (Labor Day Monday)");
});

test("how much source history a line asks for: the chart's span plus the warm-up, bounded", () => {
  assert.equal(F.sourceLimit("1D", 0), F.MIN_SOURCE);
  assert.equal(F.sourceLimit("2h", 10 * 365 * D), F.MAX_SOURCE, "a decade of 2H bars is capped");
  const year3h = F.sourceLimit("3h", 365 * D);
  assert.equal(year3h, Math.ceil(252 * 6) + F.WARMUP + 50, "a year of 3H bars, extended session, plus warm-up");
  assert.ok(F.MAX_SOURCE <= 8000, "never beyond the provider client's own clamp");
});

test("three oscillator pages, each right after its price twin, daily, with the RSI study", () => {
  const ids = Array.from(scenes.WORKFLOW_IDS);
  for (const [twin, osc] of [["spyQqq1D","spyQqqOsc"],["otherIndexes1D","otherIndexesOsc"],["targets1D","targetsOsc"]]) {
    assert.equal(ids.indexOf(osc), ids.indexOf(twin) + 1, osc + " follows " + twin);
    assert.equal(scenes.WORKFLOW_PAGES[osc].range, "1D");
    assert.equal(scenes.WORKFLOW_PAGES[osc].study, "RSI");
    const state = scenes.workflowPageState(osc, { at: "2026-09-23T14:00:00Z" });
    assert.ok(state.stacks.length === state.tickers.length && state.stacks.every((s) => s === "RSI"), "every slot carries the study");
    assert.ok(Array.from(scenes.ROTATION_SCENES).includes(osc), osc + " rotates");
  }
  assert.deepEqual(Array.from(scenes.workflowPageState("spyQqqOsc", { at: "2026-09-23T22:00:00Z" }).tickers), ["SPY","QQQ"],
    "SPY and QQQ, as the brief names them, in and out of the session");
  assert.deepEqual(Array.from(scenes.workflowPageState("otherIndexesOsc", {}).tickers), ["SMH","DIA","DRAM","MAGS","IWM","IGV"]);
  assert.deepEqual(Array.from(scenes.workflowPageState("targetsOsc", { targets:["MU","NBIS"] }).tickers), ["MU","NBIS"],
    "TARGETS · RSI reads the same shared targets list as TARGETS · DAY");
  for (const id of ["spyQqqOsc","otherIndexesOsc","targetsOsc"]) {
    const after = Array.from(scenes.rotationScenesAt("2026-09-23T22:00:00Z"));
    const inside = Array.from(scenes.rotationScenesAt("2026-09-23T14:00:00Z"));
    assert.ok(after.includes(id) && inside.includes(id), id + " rotates whenever the daily pages do");
  }
  const labels = Array.from(scenes.SCREENS).filter((s) => /Osc$/.test(s.id)).map((s) => s.short || s.label);
  assert.ok(labels.every((l) => l.length <= 11), "each rail name fits an 81 px rail button: " + labels.join(", "));
});

test("the study becomes the pane's query without touching the wall's cloud switch", () => {
  assert.equal(scenes.studyQuery("RSI"), "&rsi=auto", "no clouds= parameter: the dock keeps the ribbon");
  assert.equal(scenes.studyQuery("OSCILLATOR"), "&clouds=1&ema8=1&sma100=1", "the existing stacks are unchanged");
  assert.equal(scenes.studyQuery("CLOUDS"), "&clouds=1");
  assert.equal(scenes.studyQuery(""), "");
  const plainPage = scenes.workflowPageState("spyQqq1D", { at: "2026-09-23T14:00:00Z" });
  assert.ok(plainPage.stacks.every((s) => s === ""), "a page with no study adds nothing to its panes' URLs");
  const deck = read("../deck/index.html");
  for (const id of ["spyQqqOsc","otherIndexesOsc","targetsOsc"])
    assert.match(deck, new RegExp(`<option value="${id}">`), id + " is in the scene menu");
  assert.match(deck, /const stacks = state\.stacks \|\| \[\]/, "the deck installs a page's stacks per slot");
  assert.match(deck, /SceneModel\.studyQuery\(stack\)/, "and turns each into the pane's query");
});

test("wiring: both chart twins load the arithmetic and the fan, the panel sits under the price, 8h is mapped", () => {
  assert.equal(chart, twin, "chart/ and station-shells/chart-v1/ stay byte-identical");
  assert.match(chart, /<script src="\/station-shells\/detail-v1\/indicators\.js"><\/script>\s*<script src="\/_indicators\/station-rsi-fan\.js"><\/script>/);
  assert.match(chart, /parseRsiParam\(QS\.get\("rsi"\)\)/, "the pane reads ?rsi= from its own URL");
  assert.match(chart, /ih = h - padT - padB - fanBlock/, "the price gives up exactly the fan's band");
  assert.match(chart, /Math\.floor\(h \* window\.SC_RSI_FAN\.PANEL_SHARE\)/);
  assert.match(chart, /ensureCloudDaily\(host, t, req, generation\);\s*\/\*[^*]*\*\/\s*ensureRsiFan\(host, t, req, generation\);/,
    "the fan is asked for after the price and the ribbon");
  assert.match(chart, /acquireChartLoadPermit\(host, req \+ "\|rsi", generation\)/, "one load permit per pane for the whole fan");
  assert.match(chart, /fetchProviderCandles\(t, line\.tf, need, 2\)/, "through the pane's own provider route");
  assert.doesNotMatch(chart, /sc_rsi_/, "the fan's source bars are never written to local storage");
  assert.match(provider, /'6h':'6h','8h':'8h','12h':'12h'/, "the chart API serves 8h; the client now asks for it");
});
