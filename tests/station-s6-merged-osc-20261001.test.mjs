/* S6 (1 Oct 2026) — THE MERGED RSI + WILLIAMS OSCILLATOR, AND THE PANE SWITCH.
   Alan, 1 Oct ~10:35 ET: "the merged oscillators, RSI and Williams alone without stochastic… wherever we have oscillators
   on Station and on Hub present the merged; as I expand into more real estate, present the individuals." · "the Geiger
   momentum is 60/40 RSI Williams — that one is correct. We keep it."
   What this suite proves, without a browser:
     1. the two maps and the blend are the Geiger publisher's: RSI 23 -> -1 … 77 -> +1, Williams -90 -> -1 … -10 -> +1, 60/40;
     2. on saved chart-API bars (tests/fixtures/s6-geiger-bars-20261001.json) the Station's RSI, Williams and merged value at
        the newest bar equal what the publisher's own code (copied below, verbatim) produces for the same 230 bars;
     3. the three series keep the RSI series' clock, and composed bars carry their high and low honestly;
     4. the pane switch: merged in compact panes, three stacked when expanded, ?osc= wins;
     5. the wiring: both chart twins load the module and draw through it; the deck and the Hub can say "expanded". */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const context = { Intl, Date, Math, Number, JSON, Array, Object, Set, Map, isFinite, parseInt, console };
vm.runInNewContext(read("../station-shells/detail-v1/indicators.js"), context);
vm.runInNewContext(read("../_indicators/station-rsi-fan.js"), context);
vm.runInNewContext(read("../_indicators/station-osc-merge.js"), context);
const D = context.SC_DETAIL_MATH, F = context.SC_RSI_FAN, O = context.SC_OSC_MERGE;
const plain = (v) => JSON.parse(JSON.stringify(v));
const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html");
const fixture = JSON.parse(read("./fixtures/s6-geiger-bars-20261001.json"));

/* ---- THE PUBLISHER, VERBATIM -------------------------------------------------------------------------------------
   scintilla-provider-massive, services/hot-query/geiger-publish-artifact.mjs @ origin/provider/live-20260929 (2cce315),
   lines 41-63 and 188-202; momentum_mix from control/acceptance/EQUALIZER_SNAPSHOT_2026-08-18.json (rsi 0.6, williams 0.4).
   Copied, not imported: the provider repo is read-only to this lane. */
const PUB = (() => {
  const cl = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x))
  function rsiLast (c, p = 14) {
    let g = 0, l = 0
    for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d }
    g /= p; l /= p
    for (let i = p + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (p - 1) + (d > 0 ? d : 0)) / p; l = (l * (p - 1) + (d < 0 ? -d : 0)) / p }
    return 100 - 100 / (1 + (l === 0 ? 1e9 : g / l))
  }
  const RSI_OS = 23, RSI_OB = 77, W_OS = -90, W_OB = -10, RSI_PERIOD = 14, WILLIAMS_PERIOD = 14
  const wRSI = 0.6, wWill = 0.4, wSum = (wRSI + wWill) || 1
  return function rung (series) {
    const b = series.slice(-230)
    const c = b.map(x => +x.c), h = b.map(x => +x.h), l = b.map(x => +x.l)
    const close = c[c.length - 1]
    let momSigned = null, rsi = null, wr = null
    if (c.length >= RSI_PERIOD + 1 && c.length >= WILLIAMS_PERIOD) {
      rsi = rsiLast(c, RSI_PERIOD)
      let hh = -1e18, ll = 1e18
      for (let j2 = c.length - WILLIAMS_PERIOD; j2 < c.length; j2++) { if (h[j2] > hh) hh = h[j2]; if (l[j2] < ll) ll = l[j2] }
      wr = hh > ll ? (hh - close) / (hh - ll) * -100 : -50
      momSigned = (cl((rsi - RSI_OS) / (RSI_OB - RSI_OS) * 2 - 1) * wRSI + cl((wr - W_OS) / (W_OB - W_OS) * 2 - 1) * wWill) / wSum
    }
    return { rsi14: +rsi.toFixed(4), williams14: +wr.toFixed(4), momentum_signed: +momSigned.toFixed(6), raw: { rsi, wr, momSigned } }
  }
})();

test("the maps are the publisher's bounds: RSI 23 -> -1, 77 -> +1; Williams -90 -> -1, -10 -> +1; clamped", () => {
  assert.equal(O.RSI_OS, 23); assert.equal(O.RSI_OB, 77); assert.equal(O.W_OS, -90); assert.equal(O.W_OB, -10);
  assert.equal(O.mapRsi(23), -1); assert.equal(O.mapRsi(77), 1); assert.equal(O.mapRsi(50), 0);
  assert.equal(O.mapRsi(5), -1); assert.equal(O.mapRsi(95), 1);
  assert.equal(O.mapWilliams(-90), -1); assert.equal(O.mapWilliams(-10), 1); assert.equal(O.mapWilliams(-50), 0);
  assert.equal(O.mapWilliams(-100), -1); assert.equal(O.mapWilliams(0), 1);
  assert.equal(O.mapRsi(null), null); assert.equal(O.mapWilliams(NaN), null);
});

test("the blend is 60% RSI + 40% Williams, and the pane draws it on 0-100 as (m + 1) * 50", () => {
  assert.deepEqual(plain(O.MIX), { rsi:0.6, williams:0.4 });
  assert.equal(O.blend(77, -10), 1); assert.equal(O.blend(23, -90), -1); assert.equal(O.blend(50, -50), 0);
  /* RSI at +1, Williams at -1: 0.6 - 0.4 */
  assert.ok(Math.abs(O.blend(80, -95) - 0.2) < 1e-12);
  /* RSI 59.5 -> (36.5/54)*2-1 = 0.351852; Williams -30 -> (60/80)*2-1 = 0.5; 0.6*0.351852 + 0.4*0.5 */
  assert.ok(Math.abs(O.blend(59.5, -30) - (0.6 * (36.5 / 54 * 2 - 1) + 0.4 * 0.5)) < 1e-12);
  assert.equal(O.blend(null, -30), null); assert.equal(O.blend(50, null), null);
  assert.equal(O.toPane(-1), 0); assert.equal(O.toPane(0), 50); assert.equal(O.toPane(1), 100);
  assert.ok(Math.abs(O.fromPane(O.toPane(0.37)) - 0.37) < 1e-12);
});

test("on saved chart-API bars the Station's RSI, Williams and merged value equal the publisher's own numbers", () => {
  assert.equal(Object.keys(fixture.series).length, 3);
  for (const [name, series] of Object.entries(fixture.series)) {
    assert.equal(series.length, 230, name);
    const pub = PUB(series);
    const bars = series.map((b) => ({ t:b.t, h:+b.h, l:+b.l, c:+b.c }));
    const last = bars.length - 1;
    /* the Station's RSI arithmetic (detail-v1 rsiSeries, the fan's) over the same 230 bars, seeded the same way */
    const rsi = D.rsiSeries(bars, 14)[last];
    const wr = O.williamsValues(bars)[last];
    const merged = O.blend(rsi, wr);
    assert.ok(Math.abs(rsi - pub.raw.rsi) < 1e-9, name + " RSI " + rsi + " vs " + pub.raw.rsi);
    assert.equal(wr, pub.raw.wr, name + " Williams");
    assert.ok(Math.abs(merged - pub.raw.momSigned) < 1e-9, name + " merged");
    /* and as the publisher writes them into the artifact */
    assert.equal(+rsi.toFixed(4), pub.rsi14, name);
    assert.equal(+wr.toFixed(4), pub.williams14, name);
    assert.equal(+merged.toFixed(6), pub.momentum_signed, name);
  }
});

test("Williams %R(14) follows the publisher on a flat range (-50) and refuses a bar without its high and low", () => {
  const flat = Array.from({ length:14 }, (_, i) => ({ t:i, h:10, l:10, c:10 }));
  assert.equal(O.williamsValues(flat)[13], -50);
  const ramp = Array.from({ length:20 }, (_, i) => ({ t:i, h:i + 1, l:i, c:i + 1 }));
  const w = O.williamsValues(ramp);
  assert.equal(w[12], null); assert.ok(w[13] === 0);   /* closing on the 14-bar high (-0 is 0) */
  const holed = ramp.map((b, i) => (i === 15 ? { t:b.t, c:b.c } : b));
  const wh = O.williamsValues(holed);
  assert.equal(wh[15], null);
  assert.equal(wh[19], null);   /* 6..19 still holds bar 15 */
});

test("the three series keep the RSI series' clock; merged exists only where both sources do", () => {
  const rsi = [{ t:1, end:2, v:null, approx:false }, { t:2, end:3, v:60, approx:false }, { t:3, end:4, v:40, approx:false, forming:true }];
  const sets = O.deriveSets(rsi, [-30, null, -70]);
  assert.deepEqual(plain(sets.williams.map((p) => [p.t, p.end, p.v, !!p.forming])), [[1, 2, -30, false], [2, 3, null, false], [3, 4, -70, true]]);
  assert.equal(sets.merged[0].v, null); assert.equal(sets.merged[1].v, null);
  assert.ok(Math.abs(sets.merged[2].v - O.toPane(O.blend(40, -70))) < 1e-12);
  assert.equal(sets.merged[2].forming, true);
  assert.equal(sets.rsi, rsi);
  /* the fan's own sampling reads them unchanged: the forming point is the developing tip only */
  assert.deepEqual(plain(F.sampleToChart([1, 2, 3], sets.merged, 1, 0)), [null, null, null]);
});

test("composed bars carry the members' highest high and lowest low, and none when a member has none", () => {
  const HOUR = 3600000, base = Date.UTC(2026, 8, 29, 13);   /* 09:00 New York */
  const four = [0, 4, 8, 12].map((k, i) => ({ t:base + k * HOUR, c:100 + i, h:101 + i + (i === 1 ? 5 : 0), l:99 + i - (i === 2 ? 4 : 0) }));
  const eight = F.composeBars(four, { from:"4h", factor:2, gridH:8 });
  assert.ok(eight.length >= 2);
  for (const b of eight) { assert.ok(Number.isFinite(b.h) && Number.isFinite(b.l)); assert.ok(b.h >= b.c && b.l <= b.c); }
  const all = Math.max(...four.map((b) => b.h)), low = Math.min(...four.map((b) => b.l));
  assert.equal(Math.max(...eight.map((b) => b.h)), all); assert.equal(Math.min(...eight.map((b) => b.l)), low);
  /* a bucket with a member lacking its range carries none */
  const holed = four.map((b, i) => (i === 1 ? { t:b.t, c:b.c } : b));
  const he = F.composeBars(holed, { from:"4h", factor:2, gridH:8 });
  assert.ok(he.some((b) => b.h == null));
  /* closes-only bars compose exactly as before (no h/l keys appear) */
  const closes = four.map((b) => ({ t:b.t, c:b.c }));
  for (const b of F.composeBars(closes, { from:"4h", factor:2, gridH:8 })) assert.deepEqual(Object.keys(b).sort(), ["c", "n", "t"]);
});

test("the pane switch: merged in compact panes, three when expanded, ?osc= always wins", () => {
  const R = (o) => O.resolveMode(o);
  /* the deck's 8-up and every wall pane: embedded, not expanded */
  assert.equal(R({ embedded:true, areaH:250 }), "merged");
  assert.equal(R({ embedded:true, areaH:900 }), "merged");
  /* the deck's ⤢ on this pane */
  assert.equal(R({ embedded:true, deckFull:true, areaH:500 }), "split");
  /* the Hub: collapsed / EXPAND */
  assert.equal(R({ embedded:true, hubSplit:false, areaH:600 }), "merged");
  assert.equal(R({ embedded:true, hubSplit:true, areaH:460 }), "split");
  /* the chart page alone: by its own room */
  assert.equal(R({ embedded:false, areaH:1000 }), "split");
  assert.equal(R({ embedded:false, areaH:O.SPLIT_MIN_H - 1 }), "merged");
  /* typed */
  assert.equal(R({ param:"merged", deckFull:true, areaH:1000 }), "merged");
  assert.equal(R({ param:"split", embedded:true, areaH:200 }), "split");
  assert.equal(O.parseOscParam("nonsense"), "auto"); assert.equal(O.parseOscParam(null), "auto");
});

test("the three stacked panes share the block without overlap, merged on top, then RSI, then Williams", () => {
  const p = O.splitPanes(600, 400);
  assert.deepEqual(plain(p.map((x) => x.key)), ["merged", "rsi", "williams"]);
  for (let i = 1; i < 3; i++) assert.equal(p[i].top, p[i - 1].top + p[i - 1].height + O.SPLIT_GAP);
  assert.ok(p[2].top + p[2].height <= 1000);
  assert.ok(p.every((x) => x.height === p[0].height && x.height >= 120));
  /* the block: 46% when that gives each pane 70 px, raised up to 56% when not, none below that */
  assert.equal(O.splitBlock(1000), 460);
  assert.equal(O.splitBlock(554), 254);                 /* the deck's ⤢ pane at 1680: three of 80 px */
  assert.equal(O.splitBlock(400), 222);                 /* the Hub on a phone: three of 70 px, 55.5% of the pane */
  assert.equal(O.splitBlock(390), 0);                   /* 222 > 56% of 390: the merged one */
  for (const h of [400, 527, 554, 900]) { const b = O.splitBlock(h); assert.ok(b <= h * O.SPLIT_MAX_SHARE && O.splitPanes(0, b)[0].height >= O.SPLIT_MIN_PANE); }
});

test("the looks: merged in a pink-family tint of its own, RSI the approved pink, Williams the Hub's cyan on -100…0", () => {
  const L = O.LOOKS;
  assert.equal(L.rsi.ink, F.VISUAL.ink);                 /* #FF4FAD, the Lab's approved pink */
  assert.equal(L.rsi.cloud.ink, F.VISUAL.cloud.ink);
  assert.deepEqual(plain(L.rsi.guides), plain(F.VISUAL.guides));
  assert.notEqual(L.merged.ink, L.rsi.ink);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(L.merged.ink);
  assert.ok(r > 200 && b > 150 && g < 140, "merged stays in the pink family: " + L.merged.ink);
  assert.deepEqual(plain(L.merged.domain), [0, 100]);
  assert.deepEqual(plain(L.merged.guides.map((x) => x.v)), [100, 70, 50, 30, 0]);
  assert.equal(L.williams.ink, "#00D4FF");
  assert.deepEqual(plain(L.williams.domain), [-100, 0]);
  const solid = L.williams.guides.filter((x) => !x.dash && x.opacity >= .7).map((x) => x.v);
  assert.deepEqual(plain(solid), [-20, -80]);
  /* the domain's ends sit padPx inside the pane */
  assert.equal(O.lookY(L.williams, 0, 100, 60), 103); assert.equal(O.lookY(L.williams, -100, 100, 60), 157);
  assert.equal(O.chipText(L.williams, -23.44), "%R D −23.4");
  assert.equal(O.chipText(L.merged, 61.25), "MRG D 61.3");
  assert.equal(O.hoverItem("4H", 61.2, 58.43, -30.06), "4H 61.2 R58.4 W−30.1");
});

test("wiring: both chart twins load the module, draw through drawOsc, and hear the deck's ⤢ and the Hub's EXPAND", () => {
  assert.equal(chart, twin);
  assert.match(chart, /<script src="\/_indicators\/station-osc-merge\.js"><\/script>/);
  assert.ok(chart.indexOf("station-rsi-fan.js") < chart.indexOf("station-osc-merge.js"));
  assert.match(chart, /function drawOsc\(ctx, o\)/);
  assert.match(chart, /fanBlock \? \(osc \? drawOsc : fan\.lines\.length > 1 \? drawRsiOnly : drawRsiFan\)/);
  assert.match(chart, /event\.data\?\.type === "SCINTILLA_DECK_FULL_STATE"/);
  assert.match(chart, /OSC_HUB_ORIGINS = \["https:\/\/scintillahub\.ai", "https:\/\/www\.scintillahub\.ai"\]/);
  assert.match(chart, /d\.sc !== "osc"/);
  /* the fan's bars keep high and low, the daily read included */
  assert.match(chart, /sharedDaily\(t, need, true\)/);
  assert.match(chart, /b\.h = h; b\.l = l;/);
  /* the lone ?rsi=chart line (the old path) never becomes the merged set */
  assert.match(chart, /!RSI_REQUEST\.chart && keys\.length > 1 \? \["rsi", "williams", "merged"\] : \["rsi"\]/);
});
