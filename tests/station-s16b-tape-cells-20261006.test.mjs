/* S16b (6 Oct 2026): the tape cell as a price line with the Geiger bar under it, and the hover's one label, pinned.
   Alan, on the tape cells (~09:40 ET): "These look like Wi-Fi bars … I'm all for having the Geiger bar, but with a little
   price line, maybe the Geiger thing below, lined up in the same left-to-right space."
   Alan, on the hover (~10:00 ET): "the stray label was not on the horizontal level of the hover … another extra one".
   1. Every tape cell ends in ONE mark: today's price line, and directly under it, exactly as wide, the Geiger bar.
   2. The line is one colour, the day's (the percent's sign); the bar keeps the Station's Geiger colours.
   3. The hover: exactly one price-and-percent label on the pointer's pane, on the pointer's own line - always; the
      current-price marker is what steps aside.
   The real page's measurement on live, S16 and S16b (deliverables/20261006/station-tape-cells/harness) is pinned too:
   there the labels are counted from what the canvas was actually asked to draw, not from the page's own notes. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const chart = read("../chart/index.html"), shell = read("../station-shells/chart-v1/index.html"), deck = read("../deck/index.html");
const run = (tag) => JSON.parse(read("../deliverables/20261006/station-tape-cells/harness/" + tag + ".json"));
const live = run("live"), s16 = run("s16"), s16b = run("s16b");
const lift = (src, name) => {
  const start = src.indexOf(`function ${name}(`); assert.notEqual(start, -1, `declares ${name}`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (depth === 0) break; } }
  return src.slice(start, i + 1);
};
const fn = (src, name, pre = "") => vm.runInNewContext(pre + "(" + lift(src, name) + ")");
const measure = (text, font) => text.length * 0.6 * parseFloat(font.split(" ")[1]);
const overlap = (a, b) => a.y < b.y + b.h && b.y < a.y + a.h;
const HOVERS = ["XLI-high", "XLI-mid", "XLI-low", "ESUSD-high", "ESUSD-mid", "ESUSD-low"], AT = ["XLI-at-price", "ESUSD-at-price"];

test("S16b · the chart page and its shell copy are still one file", () => { assert.equal(chart, shell); });

test("S16b · hover: the pointer's label never leaves the pointer's line", () => {
  const tag = fn(chart, "crosshairLevelTag");
  const o = { w: 425, plotTop: 34, plotBottom: 300, priceText: "172.05", pctText: "−0.00%", up: false, scale: 1 };
  for (let sy = 34; sy <= 300; sy++) {
    const T = tag(measure, { ...o, sy });
    /* the box holds the line between its top and its bottom, at every height of the plot */
    assert.ok(T.box.y <= sy && T.box.y + T.box.h >= sy, "pointer " + sy + ": box " + T.box.y + "…" + (T.box.y + T.box.h));
    /* and away from the plot's two edges the price row is centred on it */
    if (sy >= 34 + 9 && sy <= 300 - 23) assert.ok(Math.abs(T.lines[0].y - sy) <= 1.5, "price row on the line at " + sy);
  }
  assert.doesNotMatch(lift(chart, "crosshairLevelTag"), /avoid/, "nothing moves it off the line");
  assert.doesNotMatch(lift(chart, "scChartOverlay"), /avoid:/);
});

test("S16b · hover: the current-price marker steps clear of the label, to the nearer side that fits", () => {
  const clear = fn(chart, "liveMarkerClear");
  const box = { y: 149, h: 30 };
  assert.equal(clear(60, 12, box, 34, 300), 60, "clear of the label: it stays");
  assert.equal(clear(145, 12, box, 34, 300), 136, "its middle above the label's middle: just above");
  assert.equal(clear(165, 12, box, 34, 300), 180, "below the middle: just under");
  assert.equal(clear(36, 12, { y: 34, h: 30 }, 34, 300), 65, "no room above at the plot's top: under");
  assert.equal(clear(288, 12, { y: 270, h: 30 }, 34, 300), 257, "no room under at the plot's bottom: above");
  assert.equal(clear(40, 12, { y: 34, h: 30 }, 34, 50), 40, "no room either side: it stays");
  assert.equal(clear(100, 12, null, 34, 300), 100);
  for (let top = 34; top <= 288; top++) for (const y of [34, 90, 149, 230, 270]) {
    const b = { y, h: 30 }, at = clear(top, 12, b, 34, 300);
    assert.ok(!overlap({ y: at, h: 12 }, b), `marker ${top}, label ${y}: ${at}`); assert.ok(at >= 34 && at + 12 <= 300);
  }
  assert.match(lift(chart, "scChartOverlay"), /if \(T\) liveTop = liveMarkerClear\(liveTop, 12, T\.box, padT, padT \+ ih\);/);
});

test("S16b · hover, the real page: exactly one price-and-percent label on XLI and on ESUSD, on the pointer's level, at every height", () => {
  for (const k of HOVERS.concat(AT)) {
    /* live: two labels - the pointer's and the corner readout, the one that was not on the pointer's level */
    assert.equal(live.hover[k].labelCount, 2, k + " live"); assert.equal(live.hover[k].percentTextsOnHoverLayer, 2, k);
    assert.ok(live.hover[k].notes.corner && live.hover[k].notes.pointer, k + " live: corner readout and pointer label");
    /* S16b: one percent text on the whole hover layer, one label, the pointer inside it */
    const h = s16b.hover[k];
    assert.equal(h.percentTextsOnHoverLayer, 1, k + ": one percent text drawn by the hover");
    assert.equal(h.labelCount, 1, k); assert.equal(h.labels[0].onCursorLevel, true, k); assert.ok(h.labels[0].offCursorPx <= 1, k + ": " + h.labels[0].offCursorPx + " px off the pointer");
    assert.ok(h.labels[0].pctY > h.labels[0].priceY, k + ": the percent under the price");
    assert.equal(h.notes.corner, null, k + ": no corner readout");
    /* everything the hover added: that label's two rows and the date tag - nothing else */
    assert.equal(h.hoverAdded.length, 3, k + ": " + JSON.stringify(h.hoverAdded.map((d) => d.text)));
    /* the only other percent on the pane is the badge at the top, there with or without the pointer */
    assert.equal(h.domPercentTexts.length, 1, k); assert.ok(h.domPercentTexts[0].y < h.plot.top, k);
    /* the marker and the label do not touch */
    assert.ok(!overlap(h.notes.pointer, h.notes.marker), k + ": label clear of the current-price marker");
  }
  /* S16 at the three heights was already one label; exactly on the current price its label had stepped off the line */
  for (const k of HOVERS) { assert.equal(s16.hover[k].labelCount, 1, k); assert.equal(s16.hover[k].labels[0].onCursorLevel, true, k); }
  for (const k of AT) { assert.equal(s16.hover[k].labelCount, 1, k); assert.ok(s16.hover[k].labels[0].offCursorPx > 10, k + " S16: off the line by " + s16.hover[k].labels[0].offCursorPx); }
  assert.equal(s16b.pageErrors.length, 0); assert.equal(s16b.ready, true);
});

/* ---- the tape cell ---- */
const tapeSpark = fn(deck, "tapeSpark", "const TAPE_SPARK_W = 44, TAPE_SPARK_H = 11, TAPE_OPEN_MIN = 570;\n");
const tapeLineSide = fn(deck, "tapeLineSide");
const etOf = (t) => ({ day: "d" + Math.floor(t / 1440), min: t % 1440 });
const bars = (startMin, closes, open) => closes.map((c, i) => ({ t: startMin + i * 15, o: i === 0 ? open : closes[i - 1], c }));

test("S16b · tape cell: one mark - the price line, the Geiger bar under it, one width; no rungs anywhere", () => {
  assert.match(deck, /\.tape \.mk\{ flex:none; display:flex; flex-direction:column; gap:1px; width:44px; \}/);
  assert.match(deck, /\.tape \.gb\{[^}]*width:100%; height:4px;/); assert.match(deck, /\.tape \.spark\{[^}]*width:100%; height:11px;/);
  assert.match(deck, /'<span class="mk"><svg class="spark" viewBox="0 0 ' \+ TAPE_SPARK_W \+ " " \+ TAPE_SPARK_H \+ '" preserveAspectRatio="none" aria-hidden="true"><path><\/path><\/svg>' \+\s+'<span class="gb"><i><\/i><\/span><\/span>';/);
  assert.doesNotMatch(lift(deck, "tapeRow"), /label === "FAVORITES"/, "both tapes carry the same cell");
  assert.doesNotMatch(deck, /function tapeRungs\(|<span class="g">|\.tape \.g\b/);
  assert.match(deck, /\.tape\{ flex:none; height:22px;/, "the row is still 22 px");
  /* the real page */
  for (const [name, n] of [["favorites", 63], ["liked", 85]]) {
    const t = s16b.tapes[name];
    assert.ok(t.n > 0); assert.equal(t.withRungs, 0); assert.equal(live.tapes[name].withRungs, live.tapes[name].n, name + " live: the rungs");
    assert.equal(t.withBar, t.n); assert.equal(t.withLineBox, t.n);
    assert.equal(t.barUnderLine, t.n, name + ": the bar is under the line in every cell"); assert.equal(t.sameLeftRight, t.n, name + ": same left edge, same width");
    assert.ok(t.withLine >= t.n - 3, name + ": " + t.withLine + " of " + t.n + " lines drawn");
    assert.equal(t.tallest, 22);
    for (const m of t.sample) { assert.equal(m.bar.w, 44); assert.equal(m.bar.h, 4); assert.equal(m.line.w, 44); assert.equal(m.line.h, 11); }
  }
  assert.equal(s16b.tapes.rowPx, 22); assert.equal(s16b.tapes.stripPx, 46, "the strip is still 46 px");
  assert.ok(s16b.tapes.favorites.meanWidth < s16.tapes.favorites.meanWidth - 30, "FAVORITES cells are narrower than S16's line-beside-bar");
});

test("S16b · tape cell: the line is one colour, the day's - the sign of the percent beside it", () => {
  assert.equal(tapeLineSide({ pct: 1.2 }, { dayUp: false }), " up", "the quote's percent decides");
  assert.equal(tapeLineSide({ pct: -0.1 }, { dayUp: true }), " dn");
  assert.equal(tapeLineSide({ pct: 0 }, { dayUp: false }), " up", "flat has a side - never a grey");
  assert.equal(tapeLineSide(undefined, { dayUp: false }), " dn", "no quote yet: the line's own last point against its open");
  assert.equal(tapeLineSide({ pct: null }, { dayUp: true }), " up");
  assert.equal(tapeLineSide({ pct: 2 }, null), "", "no line, no colour");
  assert.match(deck, /\.tape \.spark path\{ fill:none; stroke:none;/, "a line with no side is not drawn - never a grey one");
  assert.match(deck, /\.tape \.spark\.up path\{ stroke:var\(--bull\); \} \.tape \.spark\.dn path\{ stroke:var\(--bear\); \}/);
  /* one path: a day that crosses its open is still one line */
  const cross = tapeSpark(bars(1440 + 570, [101, 99, 100.5], 100), etOf);
  assert.equal((cross.d.match(/M/g) || []).length, 1); assert.equal((cross.d.match(/L/g) || []).length, 3); assert.equal(cross.w, 44); assert.equal(cross.h, 11);
  for (const m of cross.d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)) { assert.ok(+m[1] >= 0 && +m[1] <= 44); assert.ok(+m[2] >= 0 && +m[2] <= 11); }
  /* the real page: every drawn line is one colour and it is the percent's; S16 had two-colour lines and lines against the percent */
  for (const name of ["favorites", "liked"]) { const t = s16b.tapes[name];
    assert.equal(t.lineOneColour, t.withLine, name); assert.equal(t.lineFollowsDay, t.lineWithDaySign, name); assert.equal(t.lineWithDaySign, t.withLine, name); }
  assert.ok(s16.tapes.favorites.lineFollowsDay < s16.tapes.favorites.withLine, "S16: some lines disagreed with the percent beside them");
});

test("S16b · tape cell: the Geiger bar keeps the Station's colours and reading; the lines are read for both tapes through the one provider read", () => {
  for (const name of ["favorites", "liked"]) assert.equal(s16b.tapes[name].barTrueGreenRed, s16b.tapes[name].barWithSide, name + ": true green / red");
  assert.match(deck, /\.tape \.gb\.up\{ color:var\(--bull\); \} \.tape \.gb\.down\{ color:var\(--bear\); \}/);
  assert.match(lift(deck, "refreshTapeSparks"), /const names = tapeNames\(\); if \(!names\.length\) return;/);
  assert.match(lift(deck, "refreshTapeSparks"), /P\.sparklines\(b, TAPE_SPARK_TF, TAPE_SPARK_BARS\)/);
  assert.doesNotMatch(lift(deck, "refreshTapeSparks"), /fetch\(/);
  assert.match(deck, /const TAPE_LISTS_MS = 300000, TAPE_QUOTE_MS = 15000, TAPE_GEIGER_MS = 60000, TAPE_BATCH = 40;/, "lists, prices and Geiger keep their clocks");
});
