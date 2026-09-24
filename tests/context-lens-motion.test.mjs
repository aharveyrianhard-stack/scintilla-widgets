/* The lens getting out of the way — the M47 rules, against the same module the
   workshop page draws with. */
import test from "node:test";
import assert from "node:assert/strict";
import { place, placeStable, recentTrend, clearsTail, tailBox, preferFor, chamferPath,
         pathPoints, SHAPES, SHIPPED_SHAPE, TAIL_SHARE }
  from "../deliverables/20260923/context-lens-2/lens-placement.mjs";

const PLOT = { padL: 6, padT: 8, iw: 900, ih: 300, start: 0, end: 99, rightBars: 4, yLo: 0, yHi: 100 };
const line = (fn) => Array.from({ length: 100 }, (_, i) => ({ d: "2026-01-" + i, p: fn(i) }));
const rising = line((i) => 20 + i * 0.6);
const falling = line((i) => 80 - i * 0.6);
const flat = line(() => 50);
const inkFor = (series) => {
  const pts = pathPoints(PLOT, series);
  return (x, y) => pts.some((p) => Math.abs(p.x - x) < 6 && Math.abs(p.y - y) < 6);
};
const at = (series, opt = {}) => place({ plot: PLOT, series, ink: inkFor(series), ...opt });

/* A price that runs along one level and then turns is the case the rule is FOR: both
   halves of the plot are free, so what decides is where the recent action is. */
const turnsUp   = line((i) => (i < 66 ? 55 : 55 + (i - 66) * 1.2));   // flat, then away to the top
const turnsDown = line((i) => (i < 66 ? 45 : 45 - (i - 66) * 1.2));   // flat, then away to the bottom

test("price rising at the right edge puts the lens low; falling puts it high", () => {
  assert.equal(recentTrend(pathPoints(PLOT, turnsUp), PLOT).dir, "up");
  assert.equal(recentTrend(pathPoints(PLOT, turnsDown), PLOT).dir, "down");
  assert.equal(recentTrend(pathPoints(PLOT, flat), PLOT).dir, "flat");
  assert.equal(preferFor("up"), "bl");
  assert.equal(preferFor("down"), "tl");
  assert.match(at(turnsUp).spot.corner, /^b/, "rising -> the lens goes low");
  assert.match(at(turnsDown).spot.corner, /^t/, "falling -> the lens goes high");
});

/* And the hard rule still outranks the preference: on a line that runs corner to
   corner the low side is where the line itself starts, so the lens takes the free
   corner and says so rather than sitting on price. */
test("the trend is a preference, never a licence to cover the line", () => {
  const up = at(rising);
  assert.equal(up.trend.dir, "up");
  assert.equal(up.spot.corner, "tl");
  const bl = up.considered.find((c) => c.corner === "bl" && c.size === up.size);
  assert.equal(bl.clear, false);
  assert.equal(bl.refused, "would cover price");
});

test("the newest fifth of the line is never covered, at any size", () => {
  for (const series of [rising, falling, flat]) {
    const r = at(series);
    if (!r.spot) continue;
    assert.ok(clearsTail(r.spot, PLOT), `${r.spot.corner} sits clear of the tail`);
    assert.ok(r.spot.x + r.spot.w <= tailBox(PLOT).x,
      "the box ends before the last " + TAIL_SHARE * 100 + "% of the drawn width");
  }
  /* and the corners that would cover it are reported as refused, not silently dropped */
  const refused = at(rising).considered.filter((c) => /r$/.test(c.corner));
  assert.ok(refused.length, "the right-hand corners are considered");
  assert.ok(refused.every((c) => !c.clear), "and every one of them is refused");
});

test("it does not jump while it is being read", () => {
  const first = at(rising);
  const next = placeStable({ plot: PLOT, series: falling, ink: inkFor(falling),
    prev: first, reading: true });
  assert.equal(next.spot.corner, first.spot.corner, "the pointer is on it, so it stays");
  assert.equal(next.moved, false);
  assert.equal(next.held, "the reader is on it");
  const released = placeStable({ plot: PLOT, series: falling, ink: inkFor(falling), prev: first });
  assert.notEqual(released.spot.corner, first.spot.corner, "off it, the new bar moves it");
  assert.equal(released.moved, true);
});

test("it does not flap: a bar that changes little leaves it where it is", () => {
  const prev = at(rising);
  const nudged = rising.map((p, i) => ({ ...p, p: p.p + (i > 90 ? 0.4 : 0) }));
  const after = placeStable({ plot: PLOT, series: nudged, ink: inkFor(nudged), prev });
  assert.equal(after.spot.corner, prev.spot.corner);
  assert.equal(after.moved, false);
});

test("the shape: two offered, the chamfer ships, and its cut faces the line", () => {
  assert.deepEqual(Object.keys(SHAPES).sort(), ["capsule", "chamfer"]);
  assert.equal(SHIPPED_SHAPE, "chamfer");
  /* a lens at the bottom-left is dodging a line above and to its right */
  assert.match(chamferPath("bl"), /100% 14px/);
  /* one at the top-left is dodging a line below and to its right */
  assert.match(chamferPath("tl"), /calc\(100% - 14px\) 100%/);
  assert.match(SHAPES.chamfer.css({ w: 200, h: 90 }, "bl"), /^clip-path:polygon/);
  assert.equal(SHAPES.capsule.css({ w: 200, h: 90 }), "border-radius:45px");
});

/* The middle step, on a real saved chart-API window rather than a drawn shape.
   SPY's sideways case is the one where the strict rule (keep the whole newest-price
   column free) leaves no corner at all: without a middle step the lens parks on the
   shelf, which on a wide short Station pane costs more than an empty upper corner. */
import fs from "node:fs";
const spy = JSON.parse(fs.readFileSync(
  new URL("../deliverables/20260923/context-lens-2/cases/SPY.json", import.meta.url), "utf8"));

test("when nothing clears the newest-price column, it takes the emptiest corner in it and says so", () => {
  const series = spy.bars.map(([t, p]) => ({ d: new Date(t).toISOString(), p }));
  const { i0, i1 } = spy.window;
  const win = series.slice(i0, i1 + 1);
  const lo = Math.min(...win.map((b) => b.p)), hi = Math.max(...win.map((b) => b.p));
  const plot = { padL: 6, padT: 8, iw: 900, ih: 300, start: 0, end: win.length - 1,
                 rightBars: 4, yLo: lo, yHi: hi };
  const pts = pathPoints(plot, win);
  const ink = (x, y) => pts.some((p) => Math.abs(p.x - x) < 6 && Math.abs(p.y - y) < 6);
  const r = place({ plot, series: win, ink });
  assert.equal(r.kind, "inset", "it finds room instead of parking on the shelf");
  /* whichever rule applied, it is named: strict keeps the whole column free, relaxed says
     it entered the column and by how much it clears the prices in it */
  assert.match(r.why, /newest prices|clears price|preferred corner/);
  if (r.relaxed) assert.match(r.why, /clear of the newest prices/);
  else assert.ok(clearsTail(r.spot, plot), "the strict rule held, so the column is untouched");
  /* relaxed does NOT mean sitting on the newest prices: it still clears them by twice
     the usual margin */
  const tail = pts.filter((p) => p.x >= tailBox(plot).x);
  assert.ok(tail.length, "the window has a tail to protect");
  for (const p of tail) {
    const inside = p.x >= r.spot.x - 16 && p.x <= r.spot.x + r.spot.w + 16 &&
                   p.y >= r.spot.y - 16 && p.y <= r.spot.y + r.spot.h + 16;
    assert.equal(inside, false, "no newest-price bar is under the lens");
  }
});
