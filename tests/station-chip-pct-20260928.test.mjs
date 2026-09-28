/* N10-STATION-CHIP-PCT (28 Sep 2026). Alan, ~13:30 ET:
     "Let's make the Geiger chip bigger. We have a ton of space there. Give it more space to see the green
      to red a little better. It seems undersized versus the numerical value - maintain proportions, match
      the height of the numerical value. Don't go too crazy on the 8-chart layouts."
     "I see the percentage thing, but you're taking over chart space. The percentage should be on the
      pane. Is the percentage based on the current price as a denominator?"
   What this suite proves, without a browser (the headless shots in deliverables/20260928/station-chip-pct
   measure the same things on the real wall):
     1. the chip's size: the number takes the badge price's size, the bar is that number's cap height and
        a pane-dependent number of ems long - modest on 8-up and phone panes;
     2. the zero tick is drawn in the reading's own green/red, never grey, around the dark notch;
     3. the size is set before the rotation list measures the chip, and on every placement;
     4. the crosshair label sits in the price-scale gutter, right of the plot, at 1680 and at 390 wide,
        and the percent is (level ÷ current price − 1), current = the live quote or the last bar. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const context = { Date, Math, Number, JSON, Array, Object, String, RegExp };
vm.runInNewContext(read("../_indicators/station-geiger-bar.js"), context);
const G = context.SC_GEIGER_BAR;
const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html");
const plain = (v) => JSON.parse(JSON.stringify(v));

function fnFrom(source, name, bindings = {}) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}

test("the two chart twins stay byte-identical (the deck mounts the shell)", () => {
  assert.equal(twin, chart);
});

test("chip size: the pane sizes measured on the live wall map to modest 8-up / phone and larger 4-, 2- and 1-up", () => {
  /* 28 Sep, 1680 x 1050 headless: 8-up and 6-up 419 x 277 (badge 12 px), 4-up 840 x 277 and 2-up 840 x 554
     (badge 13.86 px), one chart alone 1680 x 1021 (badge 16 px); a phone pane 390 x 473 (badge 12 px). */
  assert.deepEqual(plain(G.chipSize(419, 277, 12)), { tier: "s", font: 12, barEm: 5, key: "s:12" });
  assert.deepEqual(plain(G.chipSize(390, 473, 12)), { tier: "s", font: 12, barEm: 5, key: "s:12" });
  assert.deepEqual(plain(G.chipSize(840, 277, 13.86)), { tier: "m", font: 13.9, barEm: 5.5, key: "m:13.9" });
  assert.deepEqual(plain(G.chipSize(840, 554, 13.86)), { tier: "l", font: 13.9, barEm: 6, key: "l:13.9" });
  assert.deepEqual(plain(G.chipSize(1680, 1021, 16)), { tier: "xl", font: 16, barEm: 7, key: "xl:16" });
  /* the bar in px: 8-up 60 (was 48), 4-up ~76, 2-up ~83, alone 112 - the 8-up grows least */
  const px = (z) => z.font * z.barEm;
  assert.equal(px(G.chipSize(419, 277, 12)), 60);
  assert.ok(px(G.chipSize(419, 277, 12)) < px(G.chipSize(840, 277, 13.86)));
  assert.ok(px(G.chipSize(840, 277, 13.86)) < px(G.chipSize(840, 554, 13.86)));
  assert.ok(px(G.chipSize(840, 554, 13.86)) < px(G.chipSize(1680, 1021, 16)));
});

test("chip size: the number follows the badge, clamped to 11..18 px; an unreadable badge size is 12 px", () => {
  assert.equal(G.chipSize(419, 277, 9).font, 11);
  assert.equal(G.chipSize(1680, 1021, 22).font, 18);
  assert.equal(G.chipSize(419, 277, NaN).font, 12);
  assert.equal(G.chipSize(419, 277, undefined).font, 12);
  assert.equal(G.chipSize(0, 0, 12).tier, "s", "a pane with no size yet is the modest size");
});

test("chip CSS: the bar is the number's cap height, the zero tick is the reading's own colour, nothing grey", () => {
  const block = chart.slice(chart.indexOf("/* N10 (28 Sep), Alan: \"Let's make the Geiger chip bigger"));
  const css = block.slice(0, block.indexOf(".sc-nchart__msg{"));
  assert.match(css, /\.is-float\{ font-size:var\(--gchip-font,12px\);/);
  assert.match(css, /\.is-float \.sc-gbar__v\{ font-size:1em; \}/, "the number is the chip's font size");
  assert.match(css, /\.is-float \.sc-gbar\{ width:var\(--gchip-bar,5em\); height:\.7em; height:1cap;/, "bar height = cap height");
  assert.match(css, /\.sc-gbar::after\{[^}]*top:-3px; bottom:-3px;[^}]*\n?[^}]*currentColor 3px/, "tick stubs above and below");
  assert.match(css, /clip-path:inset\(-3px 0\)/, "the stubs are not clipped away; the fill still ends at the track");
  assert.doesNotMatch(css, /#[0-9a-fA-F]{6}\b|#fff\b|white|grey|gray/i, "the new rules add no colour of their own");
  /* the dark notch is still there (the original rule), now 2 px to sit under the tick */
  assert.match(chart, /\.sc-gbar::before\{[^}]*background:#05060c;/);
  assert.match(css, /\.is-float \.sc-gbar::before\{ left:calc\(50% - 1px\); width:2px; \}/);
});

test("chip size is applied from the live pane, before the rotation list measures it and on every placement", () => {
  const style = {}, node = { dataset: {}, style: { setProperty: (k, v) => { style[k] = v; } } };
  const badge = {}, area = { clientWidth: 840, clientHeight: 554 };
  const host = { querySelector: (sel) => (sel === ".sc-nchart__area" ? area : sel === ".sc-nchart__live" ? badge : null) };
  const size = fnFrom(chart, "sizeGeigerChip", { window: { SC_GEIGER_BAR: G }, getComputedStyle: () => ({ fontSize: "13.86px" }), parseFloat });
  size(host, node);
  assert.equal(node.dataset.size, "l:13.9");
  assert.deepEqual(style, { "--gchip-font": "13.9px", "--gchip-bar": "6em" });
  area.clientWidth = 419; area.clientHeight = 277;
  size(host, node);
  assert.equal(node.dataset.size, "s:13.9");
  assert.equal(style["--gchip-bar"], "5em");
  const paint = fnFrom(chart, "paintGeigerBar").toString();
  assert.ok(paint.indexOf("sizeGeigerChip(host, node)") < paint.indexOf("paintRotationMark(badge)"), "sized before the rotation list fits itself");
  const place = fnFrom(chart, "placeGeiger").toString();
  assert.ok(place.indexOf("sizeGeigerChip(host, node)") < place.indexOf("node.offsetWidth"), "sized before the chip's box is measured");
});

/* monospace stand-in: 0.6 em per character, as SF Mono / Menlo */
const measure = (text, font) => text.length * 0.6 * parseFloat(font.split(" ")[1]);
const label = fnFrom(chart, "crosshairLabel");

test("the crosshair label sits in the price-scale gutter, never left of the plot's right edge", () => {
  const panes = [
    { name: "8-up 1680", w: 419, plotRight: 377, h: 277 },
    { name: "2-up 1680", w: 840, plotRight: 798, h: 554 },
    { name: "phone 390", w: 390, plotRight: 348, h: 473 },
    { name: "alone 1680", w: 1680, plotRight: 1638, h: 1021 }
  ];
  for (const p of panes) for (const priceText of ["68.12", "492.49", "1,049.47", "7,012.25", "12.3456"]) {
    const L = label(measure, { w: p.w, h: p.h, plotRight: p.plotRight, sy: 120, priceText, pctText: "−8.94%", up: false, priceFont: 11, scale: 1 });
    assert.ok(L.x >= p.plotRight, `${p.name} ${priceText}: box at ${L.x}, plot ends ${p.plotRight}`);
    assert.ok(L.x + L.w <= p.w, `${p.name} ${priceText}: inside the pane`);
    assert.deepEqual(plain(L.lines.map((l) => l.text).slice(1)), ["−8.94%", "from now"]);
    assert.equal(L.lines[1].ink, "bear");
    for (const l of L.lines) assert.ok(measure(l.text, l.font) <= L.w, `${p.name}: "${l.text}" fits the box`);
  }
});

test("a price too wide at 8 px drops its commas first; an extreme one may push left, and is the only case", () => {
  const o = { w: 840, h: 554, plotRight: 798, sy: 100, pctText: "+0.28%", up: true, priceFont: 11, scale: 1 };
  assert.equal(label(measure, { ...o, priceText: "1,049.47" }).priceText, "1049.47");
  assert.equal(label(measure, { ...o, priceText: "492.49" }).priceText, "492.49", "a short price keeps its text");
  const btc = label(measure, { ...o, priceText: "112,345.67" });
  assert.equal(btc.priceText, "112345.67");
  assert.ok(btc.x < o.plotRight && o.plotRight - btc.x <= 5, "nine digits at 7 px overlap the plot by a few px at most");
});

test("the price line sits on the crosshair; near the pane's bottom the box stays inside", () => {
  const o = { w: 419, h: 277, plotRight: 377, priceText: "492.49", pctText: "−3.60%", up: false, priceFont: 11, scale: 1 };
  const mid = label(measure, { ...o, sy: 120 });
  assert.ok(Math.abs(mid.lines[0].y - 120) <= 1, "price line centre on the crosshair");
  const low = label(measure, { ...o, sy: 270 });
  assert.ok(low.y + low.h <= o.h - 1);
  const top = label(measure, { ...o, sy: 0 });
  assert.ok(top.y >= 1);
});

test("the percent is from the CURRENT price: live quote, else the last bar - unchanged, and said on the pane", () => {
  assert.match(chart, /const nowPx = livePriceValue != null \? livePriceValue : dayPx;/);
  assert.match(chart, /const pct = nowPx > 0 \? \(price \/ nowPx - 1\) \* 100 : null;/);
  assert.match(chart, /const dayPx = chDayPrice\(host, pts\);/);
  assert.match(fnFrom(chart, "chDayPrice").toString(), /const live = quotePrice\(liveQuote\[[\s\S]*if \(live != null\) return live;[\s\S]*pts\[pts\.length - 1\]\.p/);
  const L = label(measure, { w: 419, h: 277, plotRight: 377, sy: 100, priceText: "492.49", pctText: "", up: true, priceFont: 11, scale: 1 });
  assert.equal(L.lines.length, 1, "no current price, no percent and no \"from now\"");
});
