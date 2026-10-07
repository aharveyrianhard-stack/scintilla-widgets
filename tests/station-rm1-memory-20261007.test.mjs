/* STATION · RM1 (7 Oct 2026) — what a left-open Station holds on to, and the night reload.
   ============================================================================
   Alan, 7 Oct: "When I leave Scintilla open and the Station open, it takes a lot of RAM in Activity Monitor
   after a while. When I quit and come back, it's perfectly fine… at least a calendar of overnight quitting
   and restarting would be nice."
   The chart's copy of its own pixels is handed back once the lens has its place. MEASURED on live b859b30,
   headless at 1680x1050 retina: ten charts held 53.7 of the Station's 54.9 MB of buffers - 9.8 MB for each
   two-up chart, 2.4 MB for each eight-up one, more on the iMac's larger panes - and a parked chart, which
   never paints again, kept its copy for as long as it stayed parked.
   (The night reload has its own file: station-rm1-night-reload-20261007.test.mjs.)
   Decided without a browser; the headless soaks are in deliverables/20261007/rm1-memory/. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { inkReader, emptiestSpot, summedInk } from "../_indicators/lens-placement.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const lensSrc = read("../_indicators/station-lens.mjs"), placeSrc = read("../_indicators/lens-placement.mjs");

/* a canvas that counts how often it is read; a band of "ink" across its middle */
function fakeCanvas(cssW, cssH, dpr = 2) {
  const W = cssW * dpr, H = cssH * dpr; let reads = 0;
  return { width: W, height: H, clientWidth: cssW, reads: () => reads,
    getContext: () => ({ getImageData: (x, y, w, h) => {
      reads++; const data = new Uint8ClampedArray(w * h * 4);
      for (let row = Math.floor(h * 0.4); row < Math.floor(h * 0.6); row++) for (let col = 0; col < w; col++) data[(row * w + col) * 4 + 3] = 255;
      return { data };
    } }) };
}

test("the reader takes the whole canvas once, and gives it back when told", () => {
  const cv = fakeCanvas(400, 200), ink = inkReader(cv);
  assert.equal(ink.held(), 0, "nothing is read until a question is asked");
  assert.equal(ink(200, 100), true, "the band is ink"); assert.equal(ink(200, 20), false, "above it is not");
  assert.equal(cv.reads(), 1, "one read for any number of questions");
  assert.equal(ink.held(), 800 * 400 * 4, "four bytes for every pixel of the canvas: this is the copy that was kept");
  ink.release();
  assert.equal(ink.held(), 0, "handed back");
  assert.equal(ink(200, 100), true, "a later question reads the canvas again and gets the same answer");
  assert.equal(cv.reads(), 2);
});

test("placing a lens needs the pixels once; the table it sums is what scores every candidate", () => {
  const cv = fakeCanvas(400, 200), ink = inkReader(cv);
  const plot = { padL: 10, padT: 10, iw: 380, ih: 180, start: 0, end: 99 };
  const points = Array.from({ length: 100 }, (_, i) => ({ x: 10 + i * 3.8, y: 100 }));
  const first = emptiestSpot({ plot, box: { w: 90, h: 44 }, points, ink });
  assert.ok(first.spot, "a place is found");
  assert.equal(cv.reads(), 1);
  ink.release();
  const again = emptiestSpot({ plot, box: { w: 90, h: 44 }, points, ink, prev: first.spot });
  assert.equal(cv.reads(), 1, "the same paint asked again: answered from the summed table, the canvas is not read again");
  assert.deepEqual({ x: again.spot.x, y: again.spot.y }, { x: first.spot.x, y: first.spot.y }, "and the lens stays where it was");
  assert.equal(ink.held(), 0, "the pixels stay handed back");
  /* the table itself is small: one count per 3 px step, not four bytes per device pixel */
  assert.equal(typeof summedInk(plot, () => false)({ x: 20, y: 20, w: 30, h: 30 }), "number");
});

test("the chart's lens hands the copy back as soon as its place is chosen", () => {
  assert.match(lensSrc, /host\._lensPlaced = \{ sig, where, geo \};\n[^\n]*\n\s+if \(inkAt && typeof inkAt\.release === "function"\) inkAt\.release\(\);/,
    "right after the placement, before anything is drawn");
  assert.match(placeSrc, /read\.release = \(\) => \{ data = null; \};/);
  const after = lensSrc.slice(lensSrc.indexOf("inkAt.release();") + "inkAt.release();".length);
  assert.doesNotMatch(after, /inkAt/, "nothing reads the pixels after the release (a new use must be looked at)");
});
