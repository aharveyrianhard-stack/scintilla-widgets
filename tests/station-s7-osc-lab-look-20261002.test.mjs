/* S7 (2 Oct 2026) — THE OSCILLATOR PANE THE WAY INDICATOR LAB DRAWS IT. BRIEF-20261002-S7-OSCILLATOR-LAB-LOOK item 1.
   Alan, 2 Oct ~09:25 ET: "MRG — what is MRG?… Take a look at how Indicator Lab put it on the TradingView desktop app
   ('Scintilla RSI plus Williams MTF review V2'). Take it as the guide. Display the merged one — the merged one is enough."
   The guide (read only): INDICATOR_LAB/sprints/2026-10-02-rotation/SCINTILLA_RSI_Williams_MTF_REVIEW_V2_Clear_Value.pine —
   RSI 14 solid, Williams %R 14 + 100 dotted, one pink, the RSI-only 2D/3D/W/2W cloud; "No Stoch, W/K dedupe, Geiger blend,
   new smoothing, clamping or normalization."
   This suite replaces S6's (station-s6-merged-osc-20261001) and F1's (f1-osc-readout-20261001), which pinned the 60/40 blend,
   the three-pane switch and the MRG chip, all removed here. What it proves, without a browser:
     1. on the saved 230 chart-API bars (tests/fixtures/s6-geiger-bars-20261001.json) the Williams line is ta.wpr(14) + 100 at
        every bar, digit for digit, and the RSI is the RSI the publisher computes (unchanged);
     2. no blend and no clamp: a bar with RSI 90 draws at 90, Williams −3 draws at 97;
     3. the cloud is the min/max of the four slow RSI endpoints, none when one is missing, never from Williams;
     4. the pane drawer, run on a recording canvas: ONE pane in every mode, RSI solid / Williams dotted at the Lab's widths and
        opacities in the Lab's paint order, guides 30/70 solid 20/80 dashed 50 dotted (no 0/100), the two chips at their exact
        heights, the hover on one row (compact "D R49.2 W85.6", expanded every timeframe);
     5. the wiring: both twins identical, no MRG / blend / split left. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const context = { Intl, Date, Math, Number, JSON, Array, Object, Set, Map, isFinite, parseInt, console };
vm.runInNewContext(read("../station-shells/detail-v1/indicators.js"), context);
vm.runInNewContext(read("../_indicators/station-rsi-fan.js"), context);
vm.runInNewContext(read("../_indicators/station-osc-merge.js"), context);
const D = context.SC_DETAIL_MATH, F = context.SC_RSI_FAN, O = context.SC_OSC_LAB;
const plain = (v) => JSON.parse(JSON.stringify(v));
const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html");
const fixture = JSON.parse(read("./fixtures/s6-geiger-bars-20261001.json"));

/* TradingView's ta.wpr(length), written out independently: 100 * (close - highest(high)) / (highest(high) - lowest(low)) */
function taWpr(bars, length) {
  return bars.map((b, i) => {
    if (i < length - 1) return null;
    const win = bars.slice(i - length + 1, i + 1);
    const hh = Math.max(...win.map((x) => x.h)), ll = Math.min(...win.map((x) => x.l));
    return hh === ll ? null : 100 * (b.c - hh) / (hh - ll);
  });
}
/* the publisher's RSI (geiger-publish-artifact.mjs rsiLast, as S6's suite copied it) — the RSI did not change */
function rsiLast(c, p = 14) {
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  g /= p; l /= p;
  for (let i = p + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (p - 1) + (d > 0 ? d : 0)) / p; l = (l * (p - 1) + (d < 0 ? -d : 0)) / p; }
  return 100 - 100 / (1 + (l === 0 ? 1e9 : g / l));
}

test("1 · on the saved chart-API bars the Williams line is ta.wpr(14) + 100 at every bar, digit for digit", () => {
  assert.equal(Object.keys(fixture.series).length, 3);
  for (const [name, series] of Object.entries(fixture.series)) {
    assert.equal(series.length, 230, name);
    const bars = series.map((b) => ({ t:b.t, h:+b.h, l:+b.l, c:+b.c }));
    const ref = taWpr(bars, 14), mine = O.williamsValues(bars);
    const rsiSeries = bars.map((b, i) => ({ t:b.t, end:b.t + 1, v:50, approx:false }));
    const plotted = O.deriveSets(rsiSeries, mine).williams.map((p) => p.v);
    let n = 0;
    for (let i = 0; i < bars.length; i++) {
      if (ref[i] == null) { assert.equal(plotted[i], null, name + " bar " + i); continue; }
      /* the same number to the last printed digit, and within a hair of the float */
      assert.equal(plotted[i].toFixed(10), (ref[i] + 100).toFixed(10), name + " bar " + i);
      assert.ok(Math.abs(plotted[i] - (ref[i] + 100)) < 1e-9);
      assert.ok(plotted[i] >= 0 && plotted[i] <= 100, "plotted on 0..100");
      assert.equal(O.toNative(plotted[i]).toFixed(8), ref[i].toFixed(8), "the native value comes back");
      n++;
    }
    assert.equal(n, 230 - 13, name + ": every bar from the 14th has a value");
  }
});

test("1 · the RSI is unchanged: the RSI series passes through untouched and equals the publisher's on the same bars", () => {
  for (const [name, series] of Object.entries(fixture.series)) {
    const bars = series.map((b) => ({ t:b.t, h:+b.h, l:+b.l, c:+b.c }));
    const rsi = D.rsiSeries(bars, 14)[bars.length - 1];
    assert.ok(Math.abs(rsi - rsiLast(bars.map((b) => b.c))) < 1e-9, name);
  }
  const rsi = [{ t:1, end:2, v:null, approx:false }, { t:2, end:3, v:60, approx:false }, { t:3, end:4, v:40, approx:false, forming:true }];
  const sets = O.deriveSets(rsi, [-30, null, -70]);
  assert.equal(sets.rsi, rsi, "the very same series");
  assert.deepEqual(Object.keys(sets).sort(), ["rsi", "williams"], "two sets, no merged");
  assert.deepEqual(plain(sets.williams.map((p) => [p.t, p.end, p.v, !!p.forming])), [[1, 2, 70, false], [2, 3, null, false], [3, 4, 30, true]],
    "Williams keeps the RSI clock, shifted by +100");
});

test("1 · Williams follows ta.wpr on a flat range (na, never −50) and refuses a bar without its high and low", () => {
  const flat = Array.from({ length:14 }, (_, i) => ({ t:i, h:10, l:10, c:10 }));
  assert.equal(O.williamsValues(flat)[13], null);
  const ramp = Array.from({ length:20 }, (_, i) => ({ t:i, h:i + 1, l:i, c:i + 1 }));
  const w = O.williamsValues(ramp);
  assert.equal(w[12], null); assert.ok(w[13] === 0);
  assert.equal(O.toPlot(w[13]), 100);
  const holed = ramp.map((b, i) => (i === 15 ? { t:b.t, c:b.c } : b));
  assert.equal(O.williamsValues(holed)[15], null);
  assert.equal(O.williamsValues(holed)[19], null);
});

test("2 · no blend, no clamp, no normalisation: the module carries none of S6's maps; 90 stays 90, −3 draws at 97", () => {
  for (const gone of ["blend", "mapRsi", "mapWilliams", "MIX", "toPane", "resolveMode", "splitBlock", "splitPanes", "LOOKS", "parseOscParam"])
    assert.equal(O[gone], undefined, gone + " is gone");
  assert.equal(O.toPlot(-3), 97); assert.equal(O.toPlot(-100), 0); assert.equal(O.toPlot(0), 100);
  assert.equal(O.lookY(90, 100, 66), F.rsiY(90, 100, 66), "90 on the Lab pane sits where 90 sits on the RSI-only scale");
  assert.ok(O.lookY(97, 0, 106) < O.lookY(90, 0, 106));
});

test("3 · the cloud is RSI-only: min/max of the four slow RSI endpoints, none when one is missing", () => {
  assert.deepEqual(plain(F.CONTEXT.map((c) => c.label)), ["2D", "3D", "W", "2W"]);
  const parts = [[40], [55], [62], [48]].map((values, k) => ({ key:F.CONTEXT[k].key, values }));
  assert.deepEqual(plain(F.cloudAt(parts, 0).band), { lo:40, hi:62 });
  const missing = parts.map((p, k) => (k === 2 ? { key:p.key, values:[null] } : p));
  assert.equal(F.cloudAt(missing, 0).band, null);
  /* the chart builds the cloud from the RSI set only; the Williams set carries none */
  assert.match(chart, /const sets = SETS\.length > 1 \? \{ rsi, williams:\{ lines:keys\.map\(\(k\) => sampledSet\(k, "williams"\)\), cloud:null \} \} : null;/);
  assert.match(chart, /const SETS = window\.SC_OSC_LAB && !RSI_REQUEST\.chart && keys\.length > 1 \? \["rsi", "williams"\] : \["rsi"\];/);
});

/* ---- 4 · the drawer itself, run against a canvas that records what it is told -------------------------------------- */
const drawSrc = chart.slice(chart.indexOf("function drawRsiOnly(ctx, o) {"), chart.indexOf("const cloudSpecOptions"));
function recorder() {
  const ops = []; let cur = { dash:[], path:[] };
  const ctx = new Proxy({ measureText:(t) => ({ width:String(t).length * 6 }) }, {
    get(target, k) {
      if (k in target) return target[k];
      if (k === "setLineDash") return (d) => { cur.dash = Array.from(d); };
      if (k === "beginPath") return () => { cur.path = []; };
      if (k === "moveTo" || k === "lineTo") return (x, y) => { cur.path.push([x, y]); };
      if (k === "stroke") return () => ops.push({ op:"stroke", style:target.strokeStyle, width:target.lineWidth, dash:cur.dash.slice(), path:cur.path.slice() });
      if (k === "fillText") return (t, x, y) => ops.push({ op:"text", t, x, y });
      if (k === "fillRect") return (x, y, w, h) => ops.push({ op:"rect", x, y, w, h, style:target.fillStyle });
      return () => {};
    },
    set(target, k, v) { target[k] = v; return true; }
  });
  return { ctx, ops };
}
const sandbox = { window:{ SC_RSI_FAN:F, SC_OSC_LAB:O }, rsiAsOf:() => "2 OCT", isFinite, Math, Number, Object, Array, Date, String };
vm.runInNewContext(drawSrc + "\nthis.drawOsc = drawOsc; this.drawRsiOnly = drawRsiOnly;", sandbox);
const KEYS = ["3h", "4h", "6h", "8h", "12h", "1D"];
const N = 40;
/* each timeframe's RSI and Williams (+100) at the newest bar; the Daily RSI is 90 (an extreme: drawn at 90, unclamped) */
const R_LAST = { "3h":54.8, "4h":57.1, "6h":60.2, "8h":63.0, "12h":66.4, "1D":90 };
const W_LAST = { "3h":79.5, "4h":72.0, "6h":70.3, "8h":68.8, "12h":61.1, "1D":85.6 };
const lineOf = (key, last) => ({ key, values:Array.from({ length:N }, (_, i) => (i === N - 1 ? last : 50)),
  status:{ value:last, t:Date.UTC(2026, 9, 2), stale:false }, approx:false, from:"served", tip:null });
function fanFixture() {
  const cloud = { band:Array.from({ length:N }, () => ({ lo:44, hi:58 })),
    parts:F.CONTEXT.map((c, k) => ({ key:c.key, values:Array(N).fill([44, 50, 58, 52][k]), absence:null, from:"served" })) };
  const rsi = { lines:KEYS.map((k) => lineOf(k, R_LAST[k])), cloud };
  const williams = { lines:KEYS.map((k) => lineOf(k, W_LAST[k])), cloud:null };
  return { lines:rsi.lines, cloud, sets:{ rsi, williams } };
}
const TOP = 300, PH = 120;
const baseOpts = (extra) => Object.assign({ fan:fanFixture(), X:(i) => 10 + i * 10, start:0, end:N - 1, last:N - 1, left:6, width:400,
  top:TOP, height:PH, gap:6, hairline:"#556", font:9, chipFont:10, gutterRight:460, scrubIx:null, oscReadout:"compact", dateAt:() => null }, extra);
const pinkAt = (a) => F.rgba("#FF4FAD", a);
/* CH1 (5 Oct 2026), RULE B: the pane's room follows its visible traces - this fixture's values run 44 (the cloud) to 90, so the
   domain is 26..94 (the 30/70 bands always inside, a 4-point pad, never past 0/100); the 20 guide lies outside and is not drawn */
const DOM = O.oscDomain([44, 58, 90, 50, 61.1, 85.6]);
const yAt = (v) => O.lookY(v, TOP, PH, DOM);

test("4 · ONE pane in every mode: compact, the deck's ⤢ / the Hub's EXPAND, and the chart alone", () => {
  for (const oscReadout of ["compact", "full"]) {
    const r = sandbox.drawOsc(recorder().ctx, baseOpts({ oscReadout }));
    assert.equal(r.panes.length, 1, oscReadout);
    assert.equal(r.osc, "lab"); assert.equal(r.mode, "osc-lab");
    assert.equal(r.top, TOP); assert.equal(r.height, PH, "the whole block is the one pane");
  }
  /* the chart gives the pane the RSI pane's share in every mode; nothing grows it for a stack */
  assert.match(chart, /const fanBlock = !fan \|\| h < 170 \? 0 : Math\.floor\(h \* window\.SC_RSI_FAN\.PANEL_SHARE\);/);
  assert.doesNotMatch(chart, /splitBlock|splitPanes|oscModeFor|OSC_PARAM|osc-split/);
});

test("4 · the strokes: guides 80/20 dashed, 70/30 solid, 50 dotted, no 0/100; Williams dotted then RSI solid, Daily RSI last", () => {
  const { ctx, ops } = recorder();
  const r = sandbox.drawOsc(ctx, baseOpts());
  const strokes = ops.filter((o) => o.op === "stroke");
  /* the guides: 5 horizontal strokes after the seam */
  assert.deepEqual(plain(DOM), [26, 94]);
  const guides = strokes.slice(1, 5);
  const yOf = (v) => Math.round(yAt(v)) + .5;
  assert.deepEqual(plain(guides.map((g) => g.path[0][1])), [80, 70, 50, 30].map(yOf));
  assert.deepEqual(plain(guides.map((g) => g.dash)), [[4, 3], [], [1, 2], []]);
  assert.deepEqual(plain(guides.map((g) => g.style)), [pinkAt(.45), pinkAt(.70), pinkAt(.30), pinkAt(.70)]);
  assert.deepEqual(plain(r.guides.map((g) => g.v)), [80, 70, 50, 30], "0 and 100 never drawn; 20 lies outside this window's room (CH1)");
  assert.deepEqual([r.yLo, r.yHi], [26, 94], "the pane reports its room");
  /* the twelve lines, back to front */
  const lines = strokes.filter((s) => s.path.length === N);
  assert.equal(lines.length, 12);
  const want = [
    ["12h", "w"], ["8h", "w"], ["6h", "w"], ["4h", "w"], ["3h", "w"], ["1D", "w"],
    ["12h", "r"], ["8h", "r"], ["6h", "r"], ["4h", "r"], ["3h", "r"], ["1D", "r"]];
  lines.forEach((s, i) => {
    const [key, set] = want[i], spec = F.BY_KEY[key];
    const last = (set === "w" ? W_LAST : R_LAST)[key];
    assert.equal(s.path[N - 1][1], yAt(last), key + set + " ends at its own value");
    assert.equal(s.style, pinkAt(spec.alpha), key + set + " the ladder's opacity in the one pink");
    if (set === "w") { assert.deepEqual(plain(s.dash), [1, 2], key + " Williams dotted"); assert.equal(s.width, spec.daily ? 2 : 1); }
    else { assert.deepEqual(plain(s.dash), [], key + " RSI solid"); assert.equal(s.width, spec.daily ? 3 : 1); }
  });
  /* the ladder is the Lab's: 12H 66% … 3H 54%, the Daily 90% */
  assert.deepEqual(KEYS.map((k) => F.BY_KEY[k].alpha), [.54, .57, .60, .63, .66, .90]);
  /* the Daily RSI at 90 is drawn at 90: no clamp */
  assert.equal(lines[11].path[N - 1][1], yAt(90));
});

test("4 · the two daily chips at their exact heights: 'RSI D 90.0' and, further right, 'W D 85.6 · %R −14.4'", () => {
  const r = sandbox.drawOsc(recorder().ctx, baseOpts());
  assert.equal(r.chip.text, "RSI D 90.0"); assert.equal(r.chip.value, 90);
  assert.equal(r.chip.y, +yAt(90).toFixed(2));
  assert.equal(r.wChip.text, "W D 85.6 · %R −14.4"); assert.equal(r.wChip.value, 85.6); assert.equal(r.wChip.native, -14.4);
  assert.equal(r.wChip.y, +yAt(85.6).toFixed(2));
  /* further right: its right end beyond the RSI chip's (in a narrow gutter both are pulled left, right-aligned, so the left edges
     follow the text widths) */
  assert.ok(r.wChip.box.x + r.wChip.box.w > r.chip.box.x + r.chip.box.w, "the Williams chip ends further right");
  const a = r.chip.box, b = r.wChip.box;
  assert.ok(!(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y), "the chips never overlap");
  /* each leader starts at its exact point */
  assert.equal(r.chip.leader.y1, yAt(90)); assert.equal(r.wChip.leader.y1, yAt(85.6));
  assert.equal(O.williamsChip(85.6), "W D 85.6 · %R −14.4"); assert.equal(O.rsiChip(49.21), "RSI D 49.2");
});

test("4 · the hover: ONE row; compact the Daily alone 'D R90.0 W85.6', expanded every timeframe; Williams on 0-100", () => {
  const compact = sandbox.drawOsc(recorder().ctx, baseOpts({ scrubIx:N - 1, oscReadout:"compact" }));
  assert.deepEqual(plain(compact.hover), ["D R90.0 W85.6"]);
  assert.equal(compact.readoutRows, 1);
  const full = sandbox.drawOsc(recorder().ctx, baseOpts({ scrubIx:N - 1, oscReadout:"full", width:1200 }));
  assert.equal(full.hover.join(" "), "3H R54.8 W79.5 · 4H R57.1 W72.0 · 6H R60.2 W70.3 · 8H R63.0 W68.8 · 12H R66.4 W61.1 · D R90.0 W85.6");
  assert.equal(full.readoutRows, 1);
  /* a narrow expanded pane leaves the end off rather than wrapping */
  const narrow = sandbox.drawOsc(recorder().ctx, baseOpts({ scrubIx:N - 1, oscReadout:"full", width:200 }));
  assert.equal(narrow.readoutRows, 1); assert.ok(narrow.leftOff && narrow.leftOff.length > 0);
  /* at rest: the plain title */
  const rest = recorder();
  sandbox.drawOsc(rest.ctx, baseOpts());
  assert.ok(rest.ops.some((o) => o.op === "text" && o.t === "RSI + WILLIAMS %R"));
  assert.equal(O.LOOK.title, "RSI + WILLIAMS %R");
  assert.equal(O.hoverItem("3H", 54.83, 79.46), "3H R54.8 W79.5");
});

test("4 · which hover: compact inside the deck or the Hub; full on the deck's ⤢, the Hub's EXPAND, or the chart alone", () => {
  assert.equal(O.readoutFor({ embedded:true, deckFull:false, hubSplit:null }), "compact", "8-up deck pane");
  assert.equal(O.readoutFor({ embedded:true, deckFull:false, hubSplit:false }), "compact", "Hub collapsed");
  assert.equal(O.readoutFor({ embedded:true, deckFull:true, hubSplit:null }), "full", "deck ⤢");
  assert.equal(O.readoutFor({ embedded:true, hubSplit:true }), "full", "Hub EXPAND");
  assert.equal(O.readoutFor({ embedded:false }), "full", "chart alone");
});

test("4 · the RSI-only pane without the Lab look still draws as S3 did (the fallback when the module is absent)", () => {
  const f = fanFixture();
  const r = sandbox.drawRsiOnly(recorder().ctx, baseOpts({ fan:{ lines:f.lines, cloud:f.cloud } }));
  assert.equal(r.mode, "rsi-only"); assert.equal(r.wChip, null); assert.equal(r.chip.text, "RSI D 90.0");
  assert.deepEqual(plain(r.guides.map((g) => g.v)), [100, 70, 50, 30, 0]);
});

test("5 · wiring: twins identical, the module loaded after the fan, nothing of MRG / 60/40 / the three panes left", () => {
  assert.equal(chart, twin, "chart/index.html and station-shells/chart-v1/index.html stay byte-identical");
  assert.match(chart, /<script src="\/_indicators\/station-osc-merge\.js"><\/script>/);
  assert.ok(chart.indexOf("station-rsi-fan.js") < chart.indexOf("station-osc-merge.js"));
  assert.match(chart, /fanBlock \? \(osc \? drawOsc : fan\.lines\.length > 1 \? drawRsiOnly : drawRsiFan\)/);
  assert.match(chart, /scrubIx:null, oscReadout:osc \? oscReadoutFor\(\) : null,/);
  assert.match(chart, /event\.data\?\.type === "SCINTILLA_DECK_FULL_STATE"/);
  assert.match(chart, /d\.sc !== "osc"/);
  assert.match(chart, /sharedDaily\(t, need, true\)/, "the daily bars keep their high and low for Williams");
  assert.match(chart, /b\.h = h; b\.l = l;/);
  const mod = read("../_indicators/station-osc-merge.js");
  for (const gone of [/MRG D/, /MERGED RSI\+%R/, /60\/40/]) assert.doesNotMatch(chart, gone);
  /* the module: one pink family only (the orchid and the cyan of S6 are gone) */
  for (const gone of [/MRG D/, /MERGED RSI\+%R/, /ORCHID|#E86BF0/, /CYAN|#00D4FF/, /0\.6, williams:0\.4/]) assert.doesNotMatch(mod, gone);
  assert.doesNotMatch(chart, /SC_OSC_MERGE/);
});
