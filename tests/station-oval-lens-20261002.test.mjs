/* S8 (2 Oct 2026) — THE CONTEXT LENS AS AN OVAL.
   Alan: "Context lens oval-like shaped, from starting point to ending point, to save as much screen real
   estate as possible."
   The lens is drawn inside an ellipse whose long axis runs from its first bar to its last (so it tilts with
   the series), the candles clipped to it, a faint edge, no card. Long axis = the pane width × 0.28 (desktop)
   / 0.40 (phone); short axis = the least that keeps every candle inside; placed by the S1 rule where the
   rectangle used to go. Deck ⋯ → lens: OVAL (default) · BOX. Everything here is decidable without a
   browser; the headless before/after shots are in deliverables/20261002/station-floorplan/. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { OVAL, SHAPES, SHAPE_KEY, readShape, isPhone, ovalLongAxis, ovalPlotHeight, lensPlotHeight, ovalGeometry, insideOval, placeOval,
  coveredByBox, coveredByOval } from "../_indicators/station-lens.mjs";
import { bubbleBox, candleGeometry, drawCandles, drawBubble, CHAMFER } from "../_indicators/lens-bars.mjs";
import { lineTailBox, pathPoints, DEFAULTS as PLACE } from "../_indicators/lens-placement.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
/* an 8-up pane at 1680 is 419 × 277; the plot the chart draws in it is about 371 × 248 */
const PLOT = { padL: 6, padT: 8, iw: 371, ih: 248, start: 0, end: 239, rightBars: 8, yLo: 0, yHi: 100 };
const series = (fn) => Array.from({ length: 240 }, (_, i) => ({ d: `x${i}`, p: fn(i) }));
const bars = (n, fn, perSession = 4) => Array.from({ length: n }, (_, i) => {
  const p = fn(i); return { t: i * 14400e3, o: p, h: p + 1.5, l: p - 1.5, c: p + 0.3, v: 1, session: Math.floor(i / perSession) }; });
const rising = bars(48, (i) => 100 + i * 0.5 + Math.sin(i / 3) * 2);
const falling = bars(48, (i) => 124 - i * 0.5 + Math.sin(i / 3) * 2);
const flat = bars(48, (i) => 100 + Math.sin(i / 3) * 2);
const corners = (c) => [[c.x - c.w / 2, c.yH], [c.x + c.w / 2, c.yH], [c.x - c.w / 2, c.yL], [c.x + c.w / 2, c.yL]];

/* ---- 1 · the axes --------------------------------------------------------------------------------- */
test("the long axis is the pane's width × 0.28 on a desktop and × 0.32 on a phone", () => {
  /* the phone share was 0.40 on the first build; measured headlessly it covered as much as the card (+4-6%), so the
     coordinator set 0.32 (2 Oct) */
  assert.deepEqual({ ...OVAL.long }, { desktop: 0.28, phone: 0.32 });
  assert.equal(ovalLongAxis(419, false), 117, "an 8-up pane at 1680");
  assert.equal(ovalLongAxis(840, false), 235, "a 2-up pane at 1680");
  assert.equal(ovalLongAxis(390, true), 125, "the phone's one column");
  assert.equal(isPhone(390), true); assert.equal(isPhone(599), true); assert.equal(isPhone(600), false); assert.equal(isPhone(1680), false);
  assert.equal(ovalLongAxis(419, false, 100), 100, "never longer than the room the rule has left of the newest fifth");
  assert.equal(ovalPlotHeight(117), 29, "the candles' price range is drawn a quarter of the long axis tall…");
  assert.equal(ovalPlotHeight(60), 28, "…never under 28 px…"); assert.equal(ovalPlotHeight(235), 32, "…never over 32, so a wide pane's oval stays flat");
});

test("the short axis is the least that keeps every candle inside the clip; it tilts with the series", () => {
  for (const [name, b] of [["rising", rising], ["falling", falling], ["flat", flat]]) {
    const g = ovalGeometry(b, { long: 117 });
    assert.ok(g, name);
    assert.equal(g.a * 2, 117, `${name}: the long axis is the one asked for`);
    assert.ok(g.b * 2 >= OVAL.minShort && g.b <= g.a, `${name}: short axis ${g.b * 2} px, between the floor and the long axis`);
    assert.ok(g.b === OVAL.minShort / 2 || g.b % OVAL.step === 0, `${name}: the floor or a 4 px step, so a tick does not resize it`);
    for (const c of g.candles.candles) for (const [x, y] of corners(c)) assert.ok(insideOval(g, x, y, 0.01), `${name}: candle ${c.i} is inside the ellipse`);
    /* CH1 (5 Oct): the plot is as tall as the window's move, never under the 27 Sep height (lensPlotHeight) */
    assert.ok(g.candles.candles.length === 48 && g.plotH === lensPlotHeight(b, 117) && g.plotH >= 29);
    /* minimal: without the air, the floor and the step, one pixel less cuts a candle */
    const tight = ovalGeometry(b, { long: 117, pad: 0, step: 1, minShort: 0 });
    const smaller = { ...tight, b: tight.b - 1 };
    assert.ok(g.b >= tight.b, `${name}: the shipped oval is at least the tight one`);
    assert.ok(tight.candles.candles.some((c) => corners(c).some(([x, y]) => !insideOval(smaller, x, y, 0))), `${name}: one pixel less and a candle is cut`);
  }
  const up = ovalGeometry(rising, { long: 117 }), down = ovalGeometry(falling, { long: 117 }), side = ovalGeometry(flat, { long: 117 });
  assert.ok(up.theta < -0.1 && down.theta > 0.1, `rising tilts up (canvas y grows down: ${up.theta.toFixed(2)}), falling tilts down (${down.theta.toFixed(2)})`);
  assert.ok(Math.abs(side.theta) < 0.05, "a sideways series lies flat");
  assert.ok(Math.abs(up.theta) <= OVAL.maxTilt * Math.PI / 180 + 1e-9, "never steeper than 30°");
  /* the start and the end points sit ON the long axis, inset from its tips */
  const across = (g, p) => { const dx = p.x - g.centre.x, dy = p.y - g.centre.y; return Math.abs(-dx * Math.sin(g.theta) + dy * Math.cos(g.theta)); };
  const along = (g, p) => Math.hypot(p.x - g.centre.x, p.y - g.centre.y) / g.a;
  for (const g of [up, down, side]) {
    assert.ok(across(g, g.start) < 1e-6 && across(g, g.end) < 1e-6, "the first and last bar are on the long axis");
    assert.ok(Math.abs(along(g, g.start) - OVAL.inset) < 0.02 && Math.abs(along(g, g.end) - OVAL.inset) < 0.02, "at 82% of the way to each tip");
  }
  assert.equal(ovalGeometry([], { long: 117 }), null); assert.equal(ovalGeometry(rising, { long: 0 }), null);
});

/* ---- 2 · the screen it saves ---------------------------------------------------------------------- */
test("on an 8-up pane the oval covers well under half of what the 27 Sep card covered", () => {
  const g = ovalGeometry(rising, { long: ovalLongAxis(419, false) });
  const box = bubbleBox(PLOT, "M");
  assert.deepEqual(box, { w: 93, h: 68 });
  assert.equal(coveredByBox(box.w, box.h), 93 * 68 - CHAMFER * CHAMFER / 2);
  assert.ok(coveredByOval(g) < coveredByBox(box.w, box.h) * 0.55, `oval ${coveredByOval(g)} px² vs card ${coveredByBox(box.w, box.h)} px²`);
  assert.ok(g.bbox.w <= 117 && g.bbox.h < 60, `the box around the tilted oval: ${g.bbox.w} × ${g.bbox.h}`);
  assert.deepEqual({ x: Math.round(g.origin.x + g.centre.x), y: Math.round(g.origin.y + g.centre.y) }, { x: Math.round(g.bbox.w / 2), y: Math.round(g.bbox.h / 2) }, "the ellipse's centre is the box's centre");
});

/* ---- 3 · where ------------------------------------------------------------------------------------ */
test("the S1 rule places the oval's box: bottom-left when it is as empty as anywhere, never the newest fifth, off the badge", () => {
  const pts = pathPoints(PLOT, series((i) => 75 + 10 * Math.sin(i / 20)));   // a line in the upper part: the bottom is empty
  const g = ovalGeometry(rising, { long: 117 });
  const box = { w: g.bbox.w, h: g.bbox.h + OVAL.tag };
  const empty = placeOval({ plot: PLOT, points: pts, ink: () => false, box });
  assert.equal(empty.kind, "inset");
  assert.deepEqual([empty.spot.x, empty.spot.y, empty.spot.w, empty.spot.h], [PLOT.padL + PLACE.edge, PLOT.padT + PLOT.ih - PLACE.edge - box.h, box.w, box.h]);
  assert.equal(empty.spot.corner, "bl"); assert.equal(empty.fallback, false);
  assert.ok(empty.spot.x + empty.spot.w <= lineTailBox(PLOT, pts).x, "left of the newest fifth");
  /* the badge sits bottom-left: the oval steps off it */
  const badge = { x: PLOT.padL, y: PLOT.padT + PLOT.ih - 30, w: 160, h: 30 };
  const dodged = placeOval({ plot: PLOT, points: pts, ink: () => false, box, keepOut: [badge] });
  assert.ok(dodged.spot, dodged.why);
  const hit = !(dodged.spot.x + dodged.spot.w <= badge.x || badge.x + badge.w <= dodged.spot.x || dodged.spot.y + dodged.spot.h <= badge.y || badge.y + badge.h <= dodged.spot.y);
  assert.equal(hit, false, "not on the badge");
  assert.ok(dodged.spot.x + dodged.spot.w <= lineTailBox(PLOT, pts).x);
  /* a pane too small for the box: no lens, and a reason */
  const tiny = placeOval({ plot: { ...PLOT, iw: 120, ih: 60 }, points: pathPoints({ ...PLOT, iw: 120, ih: 60 }, series((i) => 50)), ink: () => false, box });
  assert.equal(tiny.kind, "none"); assert.match(tiny.why, /smaller than the box/);
  /* it holds its place through a tick: the same spot comes back when nothing is clearly emptier */
  const again = placeOval({ plot: PLOT, points: pts, ink: () => false, box, prev: empty.spot });
  assert.deepEqual([again.spot.x, again.spot.y], [empty.spot.x, empty.spot.y]);
});

/* ---- 4 · the toggle, and both shapes drawing the same candle -------------------------------------- */
test("?lens= wins, then the remembered choice, oval by default; the deck's ⋯ menu carries the toggle; both chart copies hear it", () => {
  assert.deepEqual([...SHAPES], ["oval", "box"]); assert.equal(SHAPE_KEY, "station.lens.shape");
  assert.equal(readShape({}), "oval");
  assert.equal(readShape({ stored: "box" }), "box");
  assert.equal(readShape({ stored: "nonsense" }), "oval");
  assert.equal(readShape({ search: "?t=SPY&lens=box", stored: "oval" }), "box");
  assert.equal(readShape({ search: "?lens=oval&t=SPY", stored: "box" }), "oval");
  const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html"), deck = read("../deck/index.html");
  assert.equal(chart, twin, "chart/index.html and station-shells/chart-v1/index.html are the same file");
  assert.match(chart, /shape: \(\) => LENS_SHAPE/, "the pane hands its shape to the lens");
  assert.match(chart, /d\.sc === "lens-shape"/, "…hears the deck's message…");
  assert.match(chart, /addEventListener\("storage", \(e\) => \{ if \(e\.key === LENS_SHAPE_KEY/, "…and another Station window's choice");
  assert.match(deck, /<select[^>]*id="lensShape"[^>]*>\s*<option value="oval" selected>oval<\/option><option value="box">box<\/option>/, "OVAL default · BOX");
  assert.match(deck, /sc:"lens-shape", shape:s/, "the deck tells every frame");
  assert.ok(deck.indexOf('id="lensShape"') > deck.indexOf('id="moreGroup"') && deck.indexOf('id="lensShape"') < deck.indexOf('<span id="screenIndicator">'),
    "the toggle sits in the ⋯ group, not on the crowded top bar (Alan, 23 Sep)");
});

test("the box and the oval draw the same candle: drawBubble now paints through drawCandles", () => {
  const src = read("../_indicators/lens-bars.mjs");
  assert.match(src, /export function drawCandles\(ctx, bars, g/);
  assert.match(src, /drawCandles\(ctx, bars, g, \{ colour, day, pal \}\);/, "drawBubble calls it");
  assert.equal((src.match(/ctx\.setLineDash\(\[2, 1\.5\]\)/g) || []).length, 1, "one forming-candle dash, not two copies");
  /* a recording context: the same calls for the same bars either way */
  const calls = []; const rec = new Proxy({}, { get: (_, k) => (k === "fillStyle" || k === "strokeStyle" || k === "lineWidth" || k === "globalAlpha") ? undefined
    : (...a) => { calls.push(k); return undefined; }, set: () => true });
  const g = candleGeometry(rising.map((b, i) => i === 47 ? { ...b, live: true } : b), { x: 0, y: 0, w: 400, h: 35 });
  drawCandles(rec, rising.map((b, i) => i === 47 ? { ...b, live: true } : b), g, {});
  assert.ok(calls.filter((k) => k === "setLineDash").length === 2, "the forming point: dashed outline on and off");
  assert.ok(calls.includes("strokeRect") && calls.includes("fillRect"));
});
