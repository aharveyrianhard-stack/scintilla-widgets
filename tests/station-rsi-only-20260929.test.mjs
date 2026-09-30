/* S3-RSI-ONLY (29 Sep 2026) — the Station's RSI pane as the Indicator Lab's approved RSI-only visual.
   ============================================================================
   Spec: INDICATOR_LAB/handoffs/RSI_ONLY_STATION_VISUAL_HANDOFF_2026-09-29.md (Alan, 29 Sep: "HERE IS
   INSTRUCTIONS FOR THE UPDATED RSI ONLY OSCILLATOR FOR OUR USE IN STATION PLEASE").
   What this suite proves, without a browser:
     1. the line set: six default lines 3H 4H 6H 8H 12H dotted pink + 1D solid width 3, 2H off, no
        monthly, no signal line - the Lab's colour, opacity and width table exactly;
     2. the cloud: min and max of the four raw 2D/3D/W/2W values, hidden (never zero-filled, never
        narrowed) when any one is missing, and the missing one NAMED;
     3. the fixed 0-100 domain with pixel padding, and the 30/70/50/0/100 guides;
     4. the daily chip: "RSI D 52.3", its leader starting at the daily line's exact value, kept inside a
        bounded gutter, and marked displaced whenever it had to move;
     5. developing values on the newest bar only, a stopped source never stretched;
     6. the draw order, replayed on a recording canvas: guides, cloud, fast lines, daily, chip. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const ctxVm = { Intl, Date, Math, Number, JSON, Array, Object, Set, Map, isFinite, parseInt, console };
vm.runInNewContext(read("../station-shells/detail-v1/indicators.js"), ctxVm);
vm.runInNewContext(read("../_indicators/station-rsi-fan.js"), ctxVm);
const M = ctxVm.SC_DETAIL_MATH, F = ctxVm.SC_RSI_FAN;
const plain = (v) => JSON.parse(JSON.stringify(v));
const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html");
const H = 3600e3, D = 86400e3;

/* ---- 1 · the line set ------------------------------------------------------------------------ */
test("six default lines, the Lab's table exactly: 3H-12H dotted pink width 1, D solid width 3", () => {
  assert.deepEqual(plain(F.parseRsiParam("auto").lines), ["3h", "4h", "6h", "8h", "12h", "1D"]);
  assert.deepEqual(plain(F.parseRsiParam("1").lines), ["3h", "4h", "6h", "8h", "12h", "1D"]);
  const table = { "3h": .54, "4h": .57, "6h": .60, "8h": .63, "12h": .66, "1D": .90, "2h": .50 };
  for (const [key, alpha] of Object.entries(table)) {
    const l = F.BY_KEY[key];
    assert.equal(l.alpha, alpha, key + " opacity");
    assert.equal(l.width, key === "1D" ? 3 : 1, key + " width");
    assert.equal(!!l.dash, key !== "1D", key + (key === "1D" ? " solid" : " dotted"));
    assert.equal(F.visualInk(key), "rgba(255,79,173," + alpha.toFixed(2) + ")", key + " is #FF4FAD at its opacity");
  }
  assert.equal(F.BY_KEY["2h"].on, false, "the optional 2H stays off");
  assert.equal(F.VISUAL.ink.toUpperCase(), "#FF4FAD");
  assert.ok(F.DOT.length === 2 && F.DOT[0] <= 1.5, "a dot pattern, not a dash");
});

test("no monthly RSI and no signal line anywhere in the fan or its pane", () => {
  const keys = F.LINES.concat(F.CONTEXT).map((l) => l.label);
  assert.ok(!keys.some((k) => /^(M|1M|MO|MONTH)$/i.test(k)), "no monthly line or cloud source: " + keys.join(","));
  assert.deepEqual(plain(F.parseRsiParam("1m").lines), [], "a monthly request is not recognised");
  const pane = chart.slice(chart.indexOf("function drawRsiOnly("), chart.indexOf("const cloudSpecOptions"));
  assert.ok(pane.length > 1000, "the RSI-only pane is in the chart");
  assert.doesNotMatch(pane, /signal|sma\(|ema\(/i, "no signal-line moving average is drawn");
});

/* ---- 2 · the cloud ---------------------------------------------------------------------------- */
test("the cloud is the min and max of the four raw values at each bar", () => {
  const parts = [
    { key: "c2D", values: [44, 61.2, 30] }, { key: "c3D", values: [47, 58, 35] },
    { key: "cW", values: [52, 55.5, 70] }, { key: "c2W", values: [49, 57, 0] }];
  assert.deepEqual(plain(F.cloudAt(parts, 0)), { band: { lo: 44, hi: 52 }, missing: [] });
  assert.deepEqual(plain(F.cloudAt(parts, 1)), { band: { lo: 55.5, hi: 61.2 }, missing: [] }, "not an average: 55.5 to 61.2");
  assert.deepEqual(plain(F.cloudAt(parts, 2)), { band: { lo: 0, hi: 70 }, missing: [] }, "an RSI of 0 is a value, not a missing one");
  assert.deepEqual(plain(F.envelope(parts.map((p) => p.values))), [{ lo: 44, hi: 52 }, { lo: 55.5, hi: 61.2 }, { lo: 0, hi: 70 }],
    "the pane's band (envelope) and the named check (cloudAt) agree");
});

test("one missing endpoint hides that segment and names the source; it never narrows to the other three", () => {
  const parts = [
    { key: "c2D", values: [44, 50] }, { key: "c3D", values: [47, 51] },
    { key: "cW", values: [52, 53] }, { key: "c2W", values: [null, 54] }];
  const c = F.cloudAt(parts, 0);
  assert.equal(c.band, null, "hidden, not {lo:44, hi:52}");
  assert.deepEqual(plain(c.missing), ["2W"]);
  assert.deepEqual(plain(F.cloudAt(parts, 1).band), { lo: 50, hi: 54 }, "the next bar, with all four, is drawn");
  assert.equal(F.envelope(parts.map((p) => p.values))[0], null);
  const noSource = [{ key: "c2D", values: [44] }, { key: "c3D", values: null }, { key: "cW", values: [52] }, { key: "c2W", values: [49] }];
  assert.deepEqual(plain(F.cloudAt(noSource, 0)), { band: null, missing: ["3D"] }, "a source that could not be read is named");
  assert.equal(F.envelope([[1], [2], [3]]), null, "three lists are not a cloud");
  /* the pane: the hidden state is spelled out in its title row */
  assert.match(chart, /"CLOUD HIDDEN · " \+ \(absent\.length \? absent\.join\(" "\) : c\.missing\.join\("\/"\) \+ " missing"\)/);
});

/* ---- 3 · the scale and the guides -------------------------------------------------------------- */
test("a fixed 0-100 domain with pixel padding, whatever the data", () => {
  const top = 200, h = 80, p = F.VISUAL.padPx;
  assert.equal(F.rsiY(100, top, h), top + p, "100 sits padPx inside the top");
  assert.equal(F.rsiY(0, top, h), top + h - p, "0 sits padPx inside the bottom");
  assert.equal(F.rsiY(50, top, h), top + h / 2, "50 is the middle");
  assert.ok(p >= 1.5, "room for half of the daily's width-3 stroke");
  assert.deepEqual(plain(F.VISUAL.domain), [0, 100]);
  const g = Object.fromEntries(F.VISUAL.guides.map((x) => [x.v, x]));
  assert.deepEqual(Object.keys(g).map(Number).sort((a, b) => a - b), [0, 30, 50, 70, 100]);
  for (const v of [30, 70]) { assert.equal(g[v].opacity, .70); assert.equal(g[v].width, 1); assert.equal(g[v].dash, null); }
  assert.equal(g[50].opacity, .30); assert.ok(g[50].dash, "50 dotted");
  for (const v of [0, 100]) assert.equal(g[v].opacity, .15);
  assert.equal(F.VISUAL.cloud.ink.toUpperCase(), "#C84C86"); assert.equal(F.VISUAL.cloud.opacity, .30);
});

/* ---- 4 · the daily chip -------------------------------------------------------------------------- */
test("chip text: RSI D and the value at one decimal", () => {
  assert.equal(F.chipText(52.34), "RSI D 52.3");
  assert.equal(F.chipText(52.36), "RSI D 52.4");
  assert.equal(F.chipText(null), "RSI D —");
});

test("the chip sits beside the exact point when the gutter has room, its leader from that point", () => {
  const P = F.chipPlacement({ px: 300, py: 240, cw: 60, ch: 12, left: 6, right: 400, top: 200, bottom: 280 });
  assert.equal(P.x, 306, "gap px right of the point, not out in the future whitespace");
  assert.equal(P.y, 234, "vertically centred on the value");
  assert.equal(P.displaced, false);
  assert.deepEqual(plain(P.leader), { x1: 300, y1: 240, x2: 306, y2: 240 }, "a short horizontal leader from the exact point");
});

test("no room on the right: the chip moves, never over its point, the leader still starts at the value", () => {
  const P = F.chipPlacement({ px: 390, py: 240, cw: 60, ch: 12, left: 6, right: 400, top: 200, bottom: 280 });
  assert.ok(P.x + P.w <= 400, "inside the bounded gutter");
  assert.equal(P.displaced, true);
  assert.ok(P.y + P.h <= 240 || P.y >= 240, "the chip does not cover the point's height");
  assert.equal(P.leader.x1, 390); assert.equal(P.leader.y1, 240, "the leader starts at the mathematical point");
  assert.ok(P.leader.x2 >= P.x && P.leader.x2 <= P.x + P.w && P.leader.y2 >= P.y && P.leader.y2 <= P.y + P.h, "and ends on the chip");
});

test("a value at the pane's edge: the chip is clamped inside, flagged displaced, the leader shows by how much", () => {
  const top = 200, bottom = 280;
  const high = F.chipPlacement({ px: 300, py: top + 1, cw: 60, ch: 12, left: 6, right: 400, top, bottom });
  assert.equal(high.y, top); assert.equal(high.displaced, true);
  assert.equal(high.leader.y1, top + 1, "the leader keeps the true height");
  const low = F.chipPlacement({ px: 390, py: bottom - 1, cw: 60, ch: 12, left: 6, right: 400, top, bottom });
  assert.ok(low.y >= top && low.y + low.h <= bottom, "never clipped");
  assert.equal(low.displaced, true);
});

/* ---- 5 · developing values ------------------------------------------------------------------------ */
test("developing: the newest chart bar shows the forming source bar; earlier bars keep the finished rule", () => {
  /* a 4H chart on Tuesday; daily source bars Mon (finished) and Tue (forming) */
  const mon = Date.UTC(2026, 8, 28, 4), tue = Date.UTC(2026, 8, 29, 4);
  const series = [{ t: mon, end: mon + 20 * H, v: 48 }, { t: tue, end: tue + 20 * H, v: 53 }];
  const chartTimes = [tue + 5 * H, tue + 9 * H, tue + 13 * H];   /* 4H bars from 05:00 ET; the last ends 17:00 ET, before the daily's 20:00 */
  const finished = F.sampleToChart(chartTimes, series, 4 * H, F.carryBars("1D", 4 * H));
  assert.deepEqual(plain(finished), [48, 48, 48], "no peeking: Monday's close until Tuesday's has finished");
  const now = tue + 15 * H;
  const dev = F.developingTip(finished, chartTimes, series, 4 * H, now);
  assert.deepEqual(plain(dev.values), [48, 48, 53], "only the newest bar shows Tuesday's developing value");
  assert.equal(dev.tip.developing, true); assert.equal(dev.tip.t, tue);
  assert.deepEqual(plain(finished), [48, 48, 48], "the finished values are not mutated");
  const after = F.developingTip(finished, chartTimes, series, 4 * H, tue + 21 * H);
  assert.equal(after.tip.developing, false, "after 20:00 ET the same value is confirmed");
});

test("developing never stretches a stopped source to the present", () => {
  const aug = Date.UTC(2026, 7, 18, 4);
  const series = [{ t: aug, end: aug + 8 * H, v: 40 }];
  const chartTimes = [Date.UTC(2026, 8, 28, 4), Date.UTC(2026, 8, 29, 4)];
  const values = [null, null];
  const dev = F.developingTip(values, chartTimes, series, D, Date.UTC(2026, 8, 29, 18));
  assert.equal(dev.tip, null); assert.deepEqual(plain(dev.values), [null, null]);
});

/* ---- 6 · the pane, replayed on a recording canvas ---------------------------------------------- */
function recordingCtx() {
  const ops = [], state = { fillStyle: "", strokeStyle: "", lineWidth: 1, dash: [], globalAlpha: 1, font: "10px x" };
  const stack = [], path = [];
  const ctx = new Proxy(state, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "save") return () => stack.push({ ...state, dash: state.dash.slice() });
      if (k === "restore") return () => { const s = stack.pop(); if (s) Object.assign(state, s); };
      if (k === "setLineDash") return (d) => { state.dash = Array.from(d); };
      if (k === "measureText") return (s) => ({ width: String(s).length * 5 });
      if (k === "beginPath") return () => { path.length = 0; };
      if (k === "moveTo" || k === "lineTo") return (x, y) => path.push([x, y]);
      if (k === "stroke") return () => ops.push({ op: "stroke", style: state.strokeStyle, width: state.lineWidth, dash: state.dash.slice(), path: path.slice() });
      if (k === "fill") return () => ops.push({ op: "fill", style: state.fillStyle, path: path.slice() });
      if (k === "fillRect") return (x, y, w, h) => ops.push({ op: "fillRect", style: state.fillStyle, box: [x, y, w, h] });
      if (k === "fillText") return (s, x, y) => ops.push({ op: "text", style: state.fillStyle, text: s, x, y });
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  return { ctx, ops };
}
const paneSrc = chart.slice(chart.indexOf("function drawRsiOnly("), chart.indexOf("const cloudSpecOptions"));
const paneCtx = { window: { SC_RSI_FAN: F }, Math, Number, Array, Object, Date, isFinite,
  rsiAsOf: (ms) => new Date(ms).toISOString().slice(0, 10) };
vm.runInNewContext(paneSrc + "\nthis.drawRsiOnly = drawRsiOnly;", paneCtx);
const n = 40, X = (i) => 10 + i * 8;
const wave = (base, amp, k) => Array.from({ length: n }, (_, i) => +(base + amp * Math.sin(i / k)).toFixed(3));
function fan({ missing2W } = {}) {
  const line = (key, vals) => ({ key, values: vals, status: { value: vals[n - 1], t: 0, stale: false }, approx: false, from: "served", tip: null });
  const lines = [line("3h", wave(50, 14, 2)), line("4h", wave(50, 12, 3)), line("6h", wave(50, 10, 4)),
    line("8h", wave(50, 9, 5)), line("12h", wave(50, 8, 6)), line("1D", wave(52, 6, 8))];
  const parts = ["c2D", "c3D", "cW", "c2W"].map((key, k) => ({ key, values: wave(48 + k * 2, 3, 9),
    value: null, absence: null, from: "served", tip: null }));
  if (missing2W) parts[3].values = parts[3].values.map((v, i) => (i >= 30 ? null : v));
  const band = F.envelope(parts.map((p) => p.values));
  return { lines, cloud: { band, last: band[n - 1], parts } };
}
const draw = (f, extra) => {
  const rec = recordingCtx();
  const out = paneCtx.drawRsiOnly(rec.ctx, { fan: f, X, start: 0, end: n - 1, last: n - 1, left: 6, width: 340, top: 200, height: 80,
    gap: 6, hairline: "#868AAA", font: 7.6, chipFont: 8.6, gutterRight: 398, scrubIx: null, dateAt: () => null, ...extra });
  return { out, ops: rec.ops };
};

test("the draw order: guides, cloud, the five dotted lines, the solid daily, then the chip", () => {
  const { out, ops } = draw(fan());
  const idx = (pred) => ops.findIndex(pred);
  const lastIdx = (pred) => { for (let i = ops.length - 1; i >= 0; i--) if (pred(ops[i])) return i; return -1; };
  const guide = lastIdx((o) => o.op === "stroke" && o.path.length === 2 && o.path[0][1] === o.path[1][1] && o.style.startsWith("rgba(255,79,173") && o.width === 1 && o.path[0][0] === 6);
  const cloud = idx((o) => o.op === "fill" && o.style === "rgba(200,76,134,0.30)");
  const fast = ops.map((o, i) => [o, i]).filter(([o]) => o.op === "stroke" && o.path.length === n && o.width === 1);
  const daily = idx((o) => o.op === "stroke" && o.width === 3);
  const chipText = idx((o) => o.op === "text" && /^RSI D /.test(o.text));
  assert.ok(guide >= 0 && cloud > guide, "the cloud is drawn after the guides");
  assert.equal(fast.length, 5, "five fast lines");
  assert.ok(fast.every(([o, i]) => i > cloud && o.dash.length === 2), "all dotted, all above the cloud");
  assert.ok(daily > fast[fast.length - 1][1], "the daily after every fast line");
  assert.deepEqual(ops[daily].dash, [], "the daily is solid");
  assert.equal(ops[daily].style, "rgba(255,79,173,0.90)");
  assert.ok(chipText > daily, "the chip last");
  assert.equal(ops.filter((o) => o.op === "text" && /^(3H|4H|6H|8H|12H)$/.test(o.text)).length, 0, "no right-edge intraday tags");
  assert.equal(out.mode, "rsi-only");
});

test("the chip reads the daily line's newest value and its leader starts exactly on that line", () => {
  const f = fan(), { out, ops } = draw(f);
  const v = f.lines[5].values[n - 1];
  assert.equal(out.chip.text, "RSI D " + v.toFixed(1));
  assert.equal(out.chip.value, +v.toFixed(2));
  assert.equal(out.chip.x, +X(n - 1).toFixed(2));
  assert.equal(out.chip.y, +F.rsiY(v, 200, 80).toFixed(2), "anchored to the value's own height");
  assert.equal(out.chip.leader.x1, X(n - 1)); assert.equal(out.chip.leader.y1, F.rsiY(v, 200, 80));
  const dailyStroke = ops.find((o) => o.op === "stroke" && o.width === 3);
  const [lx, ly] = dailyStroke.path[dailyStroke.path.length - 1];
  assert.equal(lx, out.chip.leader.x1); assert.equal(ly, out.chip.leader.y1, "the leader starts where the daily line ends");
  const b = out.chip.box;
  assert.ok(b.x >= 6 && b.x + b.w <= 398 && b.y >= 200 && b.y + b.h <= 280, "inside the bounded gutter and the pane");
  assert.ok(ops.some((o) => o.op === "text" && o.text === out.chip.text && o.style === "rgba(255,79,173,0.95)"), "pink text at 95%");
  assert.ok(ops.some((o) => o.op === "fillRect" && o.style === "rgba(255,79,173,0.18)"), "muted pink chip at 18%");
  assert.ok(ops.some((o) => o.op === "stroke" && o.style === "rgba(255,79,173,0.55)" && o.width === 1), "the width-1 leader at 55%");
});

test("the chip hides when the view is panned into history (no label for a bar that is off screen)", () => {
  const { out } = draw(fan(), { end: 25 });
  assert.equal(out.chip, null);
});

test("a missing 2W hides the cloud's affected bars and the pane names it", () => {
  const { out, ops } = draw(fan({ missing2W: true }));
  assert.equal(out.cloud.lo, null); assert.deepEqual(plain(out.cloud.missing), ["2W"]);
  assert.ok(ops.some((o) => o.op === "text" && o.text === "CLOUD HIDDEN · 2W missing"), "the title row says which source");
  const fill = ops.find((o) => o.op === "fill" && o.style === "rgba(200,76,134,0.30)");
  const maxX = Math.max(...fill.path.map((p) => p[0]));
  assert.ok(maxX <= X(29) + 1e-9, "the fill stops at the last bar where all four exist");
});

test("hover names every timeframe and its value at that bar; the crosshair runs through the pane", () => {
  const f = fan(), { out, ops } = draw(f, { scrubIx: 12 });
  const want = ["3H", "4H", "6H", "8H", "12H", "D"].map((lab, k) => lab + " " + f.lines[k].values[12].toFixed(1));
  for (const w of want) assert.ok(out.hover.includes(w), "hover shows " + w);
  assert.ok(out.hover.some((t) => /^2D–2W \d/.test(t)), "and the cloud's range");
  assert.ok(ops.some((o) => o.op === "stroke" && o.path.length === 2 && o.path[0][0] === o.path[1][0] &&
    Math.abs(o.path[0][0] - (Math.round(X(12)) + .5)) < 1e-9 && o.path[0][1] === 200 && o.path[1][1] === 280), "the time line crosses the pane");
});

test("wiring: the full fan draws the RSI-only pane, the lone line keeps its path, the twins match", () => {
  assert.match(chart, /host\._rsiDrawn = fanBlock \? \(fan\.lines\.length > 1 \? drawRsiOnly\(ctx, fanOpts\) : drawRsiFan\(ctx, fanOpts\)\) : null;/);
  assert.match(chart, /F\.developingTip\(finished, times, got\.series, chartDur, Date\.now\(\)\)/, "developing values on the newest bar");
  assert.match(chart, /async function fetchRsiSource\(t, tf, need\)/, "the same source pipeline");
  assert.equal(chart, twin, "chart/ and station-shells/chart-v1/ stay byte-identical");
});

test("the RSI study pages are the same six, and the fan's arithmetic is still the detail view's Wilder RSI", () => {
  const sceneCtx = { globalThis: {} };
  vm.runInNewContext(read("../deck/scenes.js"), sceneCtx);
  const src = read("../deck/scenes.js");
  const ids = Array.from(src.matchAll(/(\w+):\s*Object\.freeze\(\{[^\n]*study:"RSI"/g)).map((m) => m[1]);
  assert.deepEqual(ids, ["mainIndexes3D", "spyQqq1D", "otherIndexesOsc", "targetsOsc", "intraday30m", "focus2", "internalsFast"]);
  const bars = Array.from({ length: 400 }, (_, i) => ({ t: Date.UTC(2026, 0, 1) + i * D, c: 100 + Math.sin(i / 7) * 5 }));
  const s = F.lineSeries("1D", bars, M), direct = M.rsiSeries(bars, 14);
  assert.equal(s[399].v, direct[399]);
});
