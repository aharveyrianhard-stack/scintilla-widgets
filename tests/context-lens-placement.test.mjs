/* The Context Lens placement rule, checked against the same module the workshop page
   draws with (deliverables/20260923/context-lens-2/lens-placement.mjs). */
import test from "node:test";
import assert from "node:assert/strict";
import { CORNERS, DEFAULTS, candidateRects, clearsPrice, pathPoints, inkShare, choose }
  from "../deliverables/20260923/context-lens-2/lens-placement.mjs";

const PLOT = { padL: 6, padT: 8, iw: 900, ih: 300, start: 0, end: 99, rightBars: 4, yLo: 0, yHi: 100 };
const line = (fn) => Array.from({ length: 100 }, (_, i) => ({ d: `2026-01-${i}`, p: fn(i) }));
const rising = line((i) => i);                       // bottom-left to top-right
const falling = line((i) => 99 - i);                 // top-left to bottom-right
const flat = line(() => 50);                         // straight through the middle
/* ink that only knows about the price line itself, so the tests measure the rule and
   not a canvas: a pixel is "drawn on" if a visible bar sits within 6px of it. */
const inkFor = (series) => {
  const pts = pathPoints(PLOT, series);
  return (x, y) => pts.some((p) => Math.abs(p.x - x) < 6 && Math.abs(p.y - y) < 6);
};

test("six candidate corners, all inside the plot the chart actually drew", () => {
  const rects = candidateRects(PLOT, "M");
  assert.equal(rects.length, 6);
  assert.deepEqual(rects.map((r) => r.corner).sort(), [...CORNERS].sort());
  for (const r of rects) {
    assert.ok(r.x >= PLOT.padL && r.x + r.w <= PLOT.padL + PLOT.iw, `${r.corner} inside width`);
    assert.ok(r.y >= PLOT.padT && r.y + r.h <= PLOT.padT + PLOT.ih, `${r.corner} inside height`);
  }
});

test("a box the price line crosses is refused even when no bar lands inside it", () => {
  /* two bars either side of the box: endpoints outside, the drawn segment straight through */
  const pts = [{ x: 100, y: 0 }, { x: 300, y: 300 }];
  const box = { x: 180, y: 130, w: 40, h: 40 };
  assert.equal(clearsPrice(box, pts, 0), false);
});

test("the margin is real: the same corner passes at 2px and fails at 24px", () => {
  const pts = [{ x: 0, y: 120 }, { x: 900, y: 120 }];
  const box = { x: 400, y: 140, w: 100, h: 60 };
  assert.equal(clearsPrice(box, pts, 2), true);
  assert.equal(clearsPrice(box, pts, 24), false);
});

test("a rising chart puts the lens where the price is not", () => {
  const r = choose({ plot: PLOT, series: rising, ink: inkFor(rising), prefer: "tr" });
  assert.equal(r.kind, "inset");
  assert.equal(r.spot.clear, true);
  const open = r.considered.filter((c) => c.clear && c.size === r.size);
  assert.ok(r.spot.ink <= Math.min(...open.map((c) => c.ink)) + 0.021, "chosen corner is the emptiest, or tied with it");
  assert.ok(["tl", "bl", "br", "bc", "tc"].includes(r.spot.corner), `rising chart should not sit on the top right, got ${r.spot.corner}`);
});

test("a falling chart moves the lens to the other side", () => {
  const up = choose({ plot: PLOT, series: rising, ink: inkFor(rising), prefer: "tr" });
  const down = choose({ plot: PLOT, series: falling, ink: inkFor(falling), prefer: "tr" });
  assert.equal(down.kind, "inset");
  assert.equal(down.spot.clear, true);
  assert.notEqual(down.spot.corner, up.spot.corner);
  assert.ok(["tr", "bl"].includes(down.spot.corner), `falling chart should sit top-right or bottom-left, got ${down.spot.corner}`);
});

test("when corners are equally empty the preferred one wins, and changing it moves the lens", () => {
  const a = choose({ plot: PLOT, series: flat, ink: inkFor(flat), prefer: "tr" });
  const b = choose({ plot: PLOT, series: flat, ink: inkFor(flat), prefer: "bl" });
  assert.equal(a.spot.corner, "tr");
  assert.equal(b.spot.corner, "bl");
});

test("no room at the asked size means shrink, and no room at all means the shelf", () => {
  /* Busy on the left two thirds, quiet on the lower right: a big lens cannot clear the
     busy part, a smaller one can. This is the case that makes the size step real. */
  const busyLeft = line((i) => (i < 70 ? (i % 2 ? 95 : 5) : 5));
  const r = choose({ plot: PLOT, series: busyLeft, ink: inkFor(busyLeft), size: "L", prefer: "tr" });
  assert.equal(r.kind, "inset");
  assert.notEqual(r.size, "L");
  assert.equal(r.shrunk, true);
  assert.equal(r.spot.clear, true);

  const covering = (x, y) => y > 0;                       // every pixel drawn on
  const noRoom = choose({ plot: PLOT, series: flat, ink: covering, size: "L", prefer: "tr", margin: 200 });
  assert.equal(noRoom.kind, "shelf");
  assert.equal(noRoom.spot, null);
  assert.match(noRoom.why, /parks below the chart/);
});

test("a corner that clears price but is already painted over is refused as too busy", () => {
  const halfBusy = (x) => x < 500;                 // the left half of the pane is solid ink
  const pts = [{ x: 0, y: 160 }, { x: 900, y: 160 }];   // price straight across the middle
  const r = choose({ plot: PLOT, series: flat, points: pts, ink: (x) => halfBusy(x),
                     size: "S", prefer: "tl", maxInk: 0.55 });
  assert.equal(r.kind, "inset");
  assert.ok(r.spot.x > 400, "it must move out of the painted half");
  const refusedBusy = r.considered.filter((c) => c.refused === "too busy");
  assert.ok(refusedBusy.length >= 1, "the painted corners are named as too busy, not as covering price");
  const loose = choose({ plot: PLOT, series: flat, points: pts, ink: (x) => halfBusy(x),
                         size: "S", prefer: "tl", maxInk: 1 });
  const tl = loose.considered.find((c) => c.corner === "tl" && c.size === loose.size);
  assert.equal(tl.clear, true, "raising the ceiling makes the painted corner allowed again");
  assert.notEqual(loose.spot.corner, "tl", "allowed is not chosen: the emptiest corner still wins");
});

test("the ink share is measured, not assumed", () => {
  const rect = { x: 0, y: 0, w: 60, h: 60 };
  assert.equal(inkShare(rect, () => false), 0);
  assert.equal(inkShare(rect, () => true), 1);
  assert.ok(Math.abs(inkShare(rect, (x) => x < 30) - 0.5) < 0.06);
});

test("the defaults are the ones the page shows as recommended", () => {
  assert.equal(DEFAULTS.margin, 8);
  assert.equal(DEFAULTS.prefer, "tr");
  assert.equal(DEFAULTS.size, "M");
  assert.equal(DEFAULTS.view, "context");
});
