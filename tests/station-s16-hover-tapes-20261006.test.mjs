/* S16 (6 Oct 2026): the chart hover and the tape marks, pinned.
   Alan, on the hover: "on XLI … ESUSD … there is this other thing with a price percentage difference and a price at the
   lower level. It doesn't make any sense. And the price percentage change is to the left of the price on the hover. I
   thought we had already put it below the price for space saving."
   Alan, on the tapes: "it looks like signal bars — is this volume on the ticker tapes? … very different from what I'm
   used to on Station … I prefer the battery … for the favorites I would prefer that iOS stocks widget that has a little
   bit of a line."
   1. ONE price-and-percent label per pane: the pointer's pane has the level tag only, every other pane the corner readout only.
   2. In both, the percent is UNDER the price.
   3. The tapes' mark is the Station's Geiger bar (the chart chip's own functions and colours); the four rungs are gone.
   4. FAVORITES carries today's line from the open, green above the open and red below; LIKED carries the bar only.
   The real page's measurement (deliverables/20261006/station-hover-tapes/harness/s16.mjs → s16-after.json) is pinned too. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const chart = read("../chart/index.html"), shell = read("../station-shells/chart-v1/index.html"), deck = read("../deck/index.html"), provider = read("../_provider/provider.js");
const before = JSON.parse(read("../deliverables/20261006/station-hover-tapes/harness/s16-before.json"));
const after = JSON.parse(read("../deliverables/20261006/station-hover-tapes/harness/s16-after.json"));
const lift = (src, name) => {
  const start = src.indexOf(`function ${name}(`); assert.notEqual(start, -1, `declares ${name}`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (depth === 0) break; } }
  return src.slice(start, i + 1);
};
const fn = (src, name, pre = "") => vm.runInNewContext(pre + "(" + lift(src, name) + ")");
const plain = (o) => JSON.parse(JSON.stringify(o));
const measure = (text, font) => text.length * 0.6 * parseFloat(font.split(" ")[1]);   // monospace stand-in
const overlap = (a, b) => a.y < b.y + b.h && b.y < a.y + a.h;

test("S16 · the chart page and its shell copy are still one file", () => { assert.equal(chart, shell); });

test("S16 · hover: one label per pane - the level tag under the pointer, the corner readout everywhere else", () => {
  const ov = lift(chart, "scChartOverlay");
  /* S16b: the level tag is worked out first (only when the pointer is on this pane) and drawn in the else branch */
  assert.match(ov, /if \(scrubOn && hover\.local\) \{[\s\S]*?T = crosshairLevelTag\([\s\S]*?if \(sy == null\) \{[\s\S]*?crosshairReadout\([\s\S]*?\} else \{[\s\S]*?T\.lines/);
  assert.equal((ov.match(/crosshairReadout\(/g) || []).length, 1);
  assert.equal((ov.match(/crosshairLevelTag\(/g) || []).length, 1);
  /* the real page, before: both labels on the pointer's pane; after: one */
  for (const k of ["XLI-mid", "XLI-low", "ESUSD-mid", "ESUSD-low"]) {
    assert.ok(before.hover[k].readout && before.hover[k].level, k + " before: the corner readout AND the level tag");
    assert.equal(after.hover[k].readout, null, k + ": no corner readout under the pointer");
    assert.ok(after.hover[k].level, k + ": the level tag");
    assert.ok(after.hover[k].otherPane.readout && !after.hover[k].otherPane.level, k + ": the other pane keeps the corner readout, and only that");
    assert.equal(after.hover[k].otherPane.readout.mode, "synced");
  }
});

test("S16 · hover: the percent is UNDER the price - on the level tag and in the corner readout", () => {
  const tag = fn(chart, "crosshairLevelTag"), readout = fn(chart, "crosshairReadout");
  const T = tag(measure, { w: 425, sy: 140, plotTop: 34, plotBottom: 300, priceText: "174.31", pctText: "+1.99%", up: true, scale: 1 });
  assert.deepEqual(Array.from(T.lines, (l) => l.text), ["174.31", "+1.99%"]);
  assert.ok(T.lines[1].y > T.lines[0].y, "the percent's row is below the price's");
  assert.equal(T.right, 420, "both rows end on the same right edge - neither is beside the other");
  assert.equal(T.lines[0].ink, "dim"); assert.equal(T.lines[1].ink, "bull");
  assert.equal(tag(measure, { w: 425, sy: 140, plotTop: 34, plotBottom: 300, priceText: "160.03", pctText: "−6.37%", up: false, scale: 1 }).lines[1].ink, "bear");
  assert.equal(T.font, 11, "the wall's 11 px floor"); assert.equal(tag(measure, { w: 425, sy: 140, plotTop: 34, plotBottom: 300, priceText: "1", pctText: "+1%", up: true, scale: 1.5 }).font, 16.5);
  /* the price row sits on the pointer's line */
  assert.ok(Math.abs(T.lines[0].y - 140) <= 1.5, "price row centred on the line: " + T.lines[0].y);
  /* space saving: two rows are as wide as the longer text - one row with the percent on the left was 97 and 111 px */
  assert.ok(T.box.w <= 60, "174.31 over +1.99%: " + T.box.w + " px");
  assert.ok(after.hover["XLI-mid"].level.w < before.hover["XLI-mid"].level.w - 40 && after.hover["ESUSD-mid"].level.w < before.hover["ESUSD-mid"].level.w - 40);
  for (const k of ["XLI-mid", "XLI-low", "ESUSD-mid", "ESUSD-low"]) assert.ok(after.hover[k].level.pctY > after.hover[k].level.priceY, k);
  /* no percent without a current price */
  assert.equal(tag(measure, { w: 425, sy: 140, plotTop: 34, plotBottom: 300, priceText: "174.31", pctText: "", up: true, scale: 1 }).lines.length, 1);
  /* the corner readout */
  const L = readout(measure, { w: 425, h: 334, plotTop: 34, plotBottom: 313, priceText: "7,258.00", pctText: "+8.33%", up: true, scale: 1 });
  assert.deepEqual(Array.from(L.lines, (l) => l.text), ["7,258.00", "+8.33%"]);
  assert.ok(L.lines[1].y > L.lines[0].y && L.lines[1].y < L.box.y + L.box.h && L.lines[0].y > L.box.y);
  assert.ok(L.pctFont > L.priceFont, "S1 / S5 stand: the percent is still the bigger text");
});

test("S16 · hover: the level tag stays in the plot; S16b - it no longer steps off the pointer's line (the marker steps instead)", () => {
  const tag = fn(chart, "crosshairLevelTag");
  const o = { w: 425, plotTop: 34, plotBottom: 300, priceText: "7,375.12", pctText: "−6.20%", up: false, scale: 1 };
  for (let sy = 34; sy <= 300; sy += 1) {
    const T = tag(measure, { ...o, sy });
    assert.ok(T.box.y >= 34 && T.box.y + T.box.h <= 300, "inside the plot at " + sy);
    /* S16 moved the tag off the line when a marker was in the way; S16b: the same box whatever is passed */
    for (const liveY of [34, 60, 158, 250, 288]) assert.equal(tag(measure, { ...o, sy, avoid: { y: liveY, h: 12 } }).box.y, T.box.y, `pointer ${sy}, marker ${liveY}`);
  }
  /* the real page: nothing on the pointer's pane overlaps */
  for (const k of ["XLI-mid", "XLI-low", "ESUSD-mid", "ESUSD-low"]) {
    const h = after.hover[k]; assert.ok(!overlap(h.level, h.live), k + ": level tag clear of the current-price marker");
    assert.ok(!overlap(h.level, h.time), k + ": level tag clear of the time tag");
    assert.ok(h.level.x + h.level.w <= h.area.w, k + ": inside the pane");
  }
  assert.ok(overlap({ y: 127, h: 30 }, { y: 150, h: 12 }), "the helper itself detects an overlap");
});

/* ---- the tapes ---- */
const B = (() => { const ctx = { globalThis: {} }; vm.runInNewContext(read("../_indicators/station-geiger-bar.js"), ctx); return ctx.SC_GEIGER_BAR || ctx.globalThis.SC_GEIGER_BAR; })();
const tapeBattery = fn(deck, "tapeBattery");
const tapeSpark = fn(deck, "tapeSpark", "const TAPE_SPARK_W = 44, TAPE_SPARK_H = 11, TAPE_OPEN_MIN = 570;\n");
/* a stand-in clock: t is minutes since New York midnight of day 1 */
const etOf = (t) => ({ day: "d" + Math.floor(t / 1440), min: t % 1440 });
const bars = (startMin, closes, open) => closes.map((c, i) => ({ t: startMin + i * 15, o: i === 0 ? open : closes[i - 1], c }));

test("S16 · tapes: the mark is the Station's Geiger bar - green at or above zero, red below, the fill from the centre", () => {
  assert.ok(B && typeof B.model === "function");
  const now = Date.parse("2026-10-06T14:00:00Z"), at = "2026-10-06T13:59:00Z";
  const up = tapeBattery(B, { composite: 0.4, stamp: at, source: "PROVIDER_EQUALIZER" }, now);
  assert.deepEqual(plain({ side: up.side, fill: up.fill, stale: up.stale }), { side: "up", fill: "left:50%;width:20.00%", stale: false });
  const down = tapeBattery(B, { composite: -0.63, stamp: at, source: "PROVIDER_EQUALIZER" }, now);
  assert.deepEqual(plain({ side: down.side, fill: down.fill }), { side: "down", fill: "right:50%;width:31.50%" });
  assert.equal(tapeBattery(B, { composite: 0, stamp: at, source: "PROVIDER_EQUALIZER" }, now).side, "up", "zero has a side - never a grey");
  assert.equal(tapeBattery(B, { composite: 3, stamp: at, source: "PROVIDER_EQUALIZER" }, now).fill, "left:50%;width:50.00%", "clamped to half the track");
  assert.equal(tapeBattery(B, { composite: 0.4, stamp: "2026-10-06T12:00:00Z", source: "PROVIDER_EQUALIZER" }, now).stale, true, "an old reading dims, as on the charts");
  for (const none of [undefined, null, { composite: null }, { composite: NaN }]) assert.deepEqual(plain(tapeBattery(B, none, now)), { side: "", fill: "", stale: false, title: "Geiger —" });
  assert.deepEqual(plain(tapeBattery(null, { composite: 0.4 }, now)), { side: "", fill: "", stale: false, title: "Geiger —" }, "the functions not loaded: the empty track");
  /* the page */
  assert.doesNotMatch(deck, /function tapeRungs\(|<span class="g">|\.tape \.g\b/, "the four rungs are gone");
  assert.match(deck, /\.tape \.gb\.up\{ color:var\(--bull\); \} \.tape \.gb\.down\{ color:var\(--bear\); \}/);
  /* S16b: the bar became a thin strip under the price line, as wide as the line (tests/station-s16b-tape-cells-20261006.test.mjs) */
  assert.match(deck, /\.tape \.gb\{[^}]*width:100%; height:4px;/);
  assert.match(deck, /'<span class="gb"><i><\/i><\/span><\/span>'/);
  /* the real page */
  assert.equal(before.tapes.favorites.withRungs, 63); assert.equal(after.tapes.favorites.withRungs, 0); assert.equal(after.tapes.liked.withRungs, 0);
  assert.equal(after.tapes.favorites.withBar, after.tapes.favorites.n); assert.equal(after.tapes.liked.withBar, after.tapes.liked.n);
  for (const m of after.tapes.favorites.sample.concat(after.tapes.liked.sample)) {
    assert.ok(m.bar.h >= 7 && m.bar.h <= 9 && m.bar.w >= 36 && m.bar.w <= 39, m.t + " bar " + m.bar.w + " x " + m.bar.h);
    assert.equal(m.bar.color, m.bar.side === "up" ? "rgb(0, 255, 163)" : "rgb(255, 45, 85)", m.t);
  }
  assert.equal(after.tapes.tallest, 22, "no cell taller than its row"); assert.equal(after.tapes.stripPx, 46, "the strip is still 46 px");
});

test("S16 · tapes: today's line starts at the 09:30 open (S16b: one colour, on both tapes - see the S16b tests)", () => {
  /* what S16 measured on the real page stands as history: 63 FAVORITES lines, none on LIKED */
  assert.equal(after.tapes.liked.withSpark, 0); assert.ok(after.tapes.favorites.withSpark >= after.tapes.favorites.n - 3);
  const y1 = [...bars(1440 + 570 - 60, [99, 99.5, 99.8, 100], 98.9), ...bars(1440 + 570, [100.5, 101, 102], 100)];
  const upDay = tapeSpark(y1, etOf, 40, 14);
  assert.equal(upDay.open, 100, "the open is the 09:30 bar's open - the pre-market bars are not in the line");
  assert.equal(upDay.points, 4); assert.equal(upDay.session, true); assert.equal(upDay.dayUp, true);
  assert.equal(tapeSpark(bars(1440 + 570, [99, 98, 97.5], 100), etOf, 40, 14).dayUp, false);
  /* yesterday's bars never enter today's line; before 09:30 the line is the day's bars so far */
  const pre = tapeSpark([...bars(570, [50, 51], 49), ...bars(1440 + 240, [52, 53, 54], 51.5)], etOf, 40, 14);
  assert.equal(pre.session, false); assert.equal(pre.open, 51.5); assert.equal(pre.points, 4);
  /* every point is inside the box */
  for (const line of [upDay, pre]) for (const m of line.d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)) { assert.ok(+m[1] >= 0 && +m[1] <= 40); assert.ok(+m[2] >= 0 && +m[2] <= 14); }
  /* nothing to draw: no line, never a made-up flat one */
  for (const none of [null, [], [{ t: 1, o: NaN, c: 1 }], [{ t: 1, o: 0, c: 0 }]]) assert.equal(tapeSpark(none, etOf, 40, 14), null);
});

test("S16 · tapes: the lines come through the provider client's one read; the tape's other reads are untouched", () => {
  assert.match(provider, /S\.sparklines = function \(symbols, rawTf, limit, signal\) \{/);
  assert.match(provider, /jget\(API \+ '\/sparklines\?tf=' \+ encodeURIComponent\(tf\) \+ '&limit=' \+ candleBound\(limit\) \+ '&authority=provider&symbols=' \+/);
  assert.match(deck, /P\.sparklines\(b, TAPE_SPARK_TF, TAPE_SPARK_BARS\)\.catch\(\(\) => null\)/);
  assert.match(deck, /const TAPE_SPARK_MS = 300000, TAPE_SPARK_TF = "15m", TAPE_SPARK_BARS = 64;/);
  assert.match(deck, /const TAPE_LISTS_MS = 300000, TAPE_QUOTE_MS = 15000, TAPE_GEIGER_MS = 60000, TAPE_BATCH = 40;/, "lists, prices and Geiger keep their clocks");
  assert.match(deck, /if \(!tapesLive\(\) \|\| document\.hidden \|\| TAPES\.sparksBusy \|\| !P \|\| !P\.sparklines\) return;/, "nothing is read while the tapes are off, on a phone, or hidden");
  assert.doesNotMatch(lift(deck, "refreshTapeSparks"), /fetch\(/, "no second path to the chart API");
  assert.equal(after.pageErrors.length, 0);
});

test("S16 · the tape's type is the deck's own: SF Mono first, 11 px", () => {
  const f = after.tapes.font;
  assert.equal(f.cell.family, f.body.family); assert.match(f.cell.family, /^"SF Mono", "JetBrains Mono", ui-monospace, Menlo, monospace$/);
  assert.equal(f.cell.size, "11px"); assert.equal(f.label.size, "8.5px");
  assert.match(chart, /--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace;/, "the charts name the same stack");
});
