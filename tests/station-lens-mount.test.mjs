/* M58 · THE CONTEXT LENS IS MOUNTED IN THE CHART PANE.
   ============================================================================
   Alan, 23 Sep: "It's just a view of the current bars with the opposite view, and
   another view of the one that we're in on the charts and what it is."

   What these tests hold:
     1. the shipped rule (/_indicators/station-lens.js, which the pane loads) still
        agrees with M51's reviewed lens-view.mjs about WHAT the lens shows. A copy that
        drifts is the thing that makes a page and its proof disagree;
     2. the pane actually mounts it: the script tag, the LENS chip on by default,
        the toggle, the draw call inside the chart's own draw, and the twin file;
     3. the lens is the OPPOSITE zoom of the live bars and never shows a bar the main
        chart has not reached;
     4. the lens has its own reserved band: the price is scaled into a shorter plot, so
        the two views cannot overlap however the chart is panned or zoomed;
     5. it costs no request, no timer and no second geometry read, and it takes the
        main chart's day-direction colour rather than a grey of its own. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

import * as M51 from "../deliverables/20260924/station-calm/lens/lens-view.mjs";

const require = createRequire(import.meta.url);
const SHIPPED = require("../_indicators/station-lens.js");

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const SHELL = "station-shells/chart-v1/index.html";
const TWIN = "chart/index.html";
const shell = read(SHELL);
const lensJs = read("_indicators/station-lens.js");

/* the pane's own lens block, so a test reads what the pane runs */
const block = (name) => {
  const m = shell.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n\\}\\n"));
  assert.ok(m, name + " must exist in " + SHELL);
  return m[0];
};
const drawLensSrc = block("drawLens");

/* The rules below are about what the pane DOES, so they read the code with the prose
   stripped out - otherwise a comment saying "no grey lines" fails a no-grey test. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const plain = (v) => JSON.parse(JSON.stringify(v));

/* ---- 1. the shipped copy has not drifted from the reviewed modules ------------- */

test("what the lens shows: the shipped rule matches M51 on every window", () => {
  let checked = 0;
  for (const total of [0, 1, 6, 12, 40, 61, 120, 400]) {
    for (const end of [0, 1, 5, 30, 59, 119, 399]) {
      if (end > Math.max(0, total - 1)) continue;
      for (const span of [0, 1, 4, 8, 29, 60, 61, 120, 399]) {
        const main = { total, start: end - span, end };
        assert.deepEqual(plain(SHIPPED.lensView(main)), plain(M51.lensView(main)),
          `lensView ${total}/${main.start}-${end}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 100, "the sweep actually ran");
  assert.deepEqual(plain(SHIPPED.VIEW_DEFAULTS), plain(M51.DEFAULTS));
});

/* ---- the reserved band ---------------------------------------------------------- */

const PANES = [
  { name: "wall 1680", w: 1680, h: 921 },
  { name: "phone 390", w: 390, h: 815 },
  { name: "deck pane", w: 260, h: 210 },
  { name: "tiny pane", w: 200, h: 120 },
];

test("the lens band is taken out of the pane, and a pane too small gives none", () => {
  for (const pane of PANES) {
    const band = SHIPPED.stripBand(pane.w, pane.h, true);
    assert.equal(SHIPPED.stripBand(pane.w, pane.h, false), 0, pane.name + ": off means no band");
    if (pane.w < 220 || pane.h < 150) { assert.equal(band, 0, pane.name + ": too small for a lens"); continue; }
    assert.ok(band >= 38 && band <= 70, pane.name + ": the band is a strip, not a second chart");
    assert.ok(band < pane.h * 0.35, pane.name + ": the price keeps most of the pane");
  }
});

test("the band sits under the price and never overlaps it", () => {
  for (const pane of PANES) {
    const band = SHIPPED.stripBand(pane.w, pane.h, true);
    if (!band) continue;
    const padL = 6, padT = 8, padB = 21;
    const plot = { padL, padT, iw: pane.w - padL - 42, ih: pane.h - padT - padB - band, band };
    const box = SHIPPED.stripLayout(plot);
    assert.ok(box.frame.y >= padT + plot.ih, pane.name + ": the band starts below the plot");
    assert.ok(box.frame.y + box.frame.h <= pane.h - padB + 2, pane.name + ": and above the time axis");
    assert.ok(box.line.x >= box.frame.x + box.labelW, pane.name + ": the little chart clears the words");
    assert.ok(box.line.x + box.line.w <= box.frame.x + box.frame.w, pane.name + ": inside the band");
    assert.ok(box.line.h >= 8 && box.line.w >= 10, pane.name + ": the little chart has room to draw");
  }
});

test("the pane reserves the band before it scales the price", () => {
  assert.match(shell, /const lensBand = window\.SC_LENS \? window\.SC_LENS\.stripBand\(w, h, LENS_ON\) : 0;/,
    "the band is measured from the pane size the draw already read");
  assert.match(shell, /const iw = w - padL - padR, ih = h - padT - padB - lensBand;/,
    "the plot is shorter by exactly the band");
});

/* ---- 2. the pane mounts it ----------------------------------------------------- */

test("both chart shells load the lens rule and carry the LENS chip, on by default", () => {
  for (const path of [SHELL, TWIN]) {
    const src = read(path);
    assert.match(src, /<script src="\/_indicators\/station-lens\.js"><\/script>/, path + " loads the rule");
    assert.match(src, /data-act="lens"/, path + " has the chip");
    assert.match(src, /QS\.has\("lens"\) \? QS\.get\("lens"\) !== "0" : lsGet\(LENS_KEY\) !== "0"/,
      path + " defaults the lens ON and lets ?lens=0 turn it off");
    assert.match(src, /const LENS_KEY = "station\.lens\." \+ LENS_PANE;/,
      path + " remembers the lens per pane, not once for the whole wall");
    assert.match(src, /else if \(act === "lens"\) setLens\(!LENS_ON\);/, path + " wires the chip");
    assert.match(src, /drawLens\(ctx, host, \{ pts, plot:host\._plot, c, band:lensBand, range:/,
      path + " draws the lens inside the chart's own draw, with the chart's own colour");
  }
});

test("the chart page and its shell twin stay byte-identical", () => {
  assert.equal(read(TWIN), shell, "chart/index.html must equal " + SHELL);
});

test("the lens is drawn by the pane's own 2d context, not a second chart library", () => {
  assert.doesNotMatch(drawLensSrc, /new (Chart|LightweightCharts)|createChart|<iframe|document\.createElement/,
    "no second library and no DOM node");
  for (const call of ["ctx.beginPath", "ctx.stroke", "ctx.fillText"])
    assert.ok(drawLensSrc.includes(call), "the lens draws with " + call);
});

/* ---- 3. the opposite zoom, on the same live bars ------------------------------- */

test("zoomed out gives the last 30 bars; zoomed in pulls back six times the window", () => {
  const wideOut = SHIPPED.lensView({ total: 400, start: 0, end: 399 });   // 400 bars on screen
  assert.equal(wideOut.mode, "detail");
  assert.equal(wideOut.bars, 30);
  assert.equal(wideOut.label, "ZOOM · LAST 30 BARS");

  const zoomedIn = SHIPPED.lensView({ total: 400, start: 360, end: 399 }); // 40 bars on screen
  assert.equal(zoomedIn.mode, "wide");
  assert.equal(zoomedIn.bars, 240);
  assert.equal(zoomedIn.label, "WIDER · LAST 240 BARS");
});

test("the lens never shows a bar the main chart has not reached, and never replays history", () => {
  for (let total = 8; total <= 400; total += 13) {
    for (let end = 0; end < total; end += 7) {
      for (const span of [1, 5, 30, 59, 60, 61, 150]) {
        const main = { total, start: Math.max(0, end - span), end };
        const v = SHIPPED.lensView(main);
        assert.ok(SHIPPED.endsTogether(v, main), `ends together ${total}/${end}/${span}`);
        if (v.mode === "none") continue;
        assert.ok(v.end <= total - 1 && v.start >= 0, "inside the loaded bars");
        /* the wide mode is a multiple of what is on screen, never the whole history */
        if (v.mode === "wide") assert.ok(v.bars <= v.mainBars * 6, "wide is six windows at most");
      }
    }
  }
});

test("a small pane is left alone rather than covered", () => {
  assert.match(drawLensSrc, /if \(!LENS_ON \|\| !L \|\| !o\.band\) \{ host\._lens = null; return; \}/,
    "no band means no lens, and the chart keeps its full height");
  assert.match(drawLensSrc, /if \(v\.mode === "none"\) \{ host\._lens = null; return; \}/,
    "too few bars for a second view draws nothing rather than a misleading one");
});

/* ---- 5. what it costs, and what colour it is ----------------------------------- */

test("the lens asks for nothing: no request, no clock, no second geometry read", () => {
  for (const src of [code(drawLensSrc), code(lensJs)]) {
    assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|EventSource|WebSocket/, "no request");
    assert.doesNotMatch(src, /setInterval|setTimeout|requestAnimationFrame|ResizeObserver|IntersectionObserver/,
      "no clock and no observer of its own");
    assert.doesNotMatch(src, /getBoundingClientRect|clientWidth|clientHeight|offsetWidth|getComputedStyle/,
      "no layout read — the box comes from host._plot");
    assert.doesNotMatch(src, /getImageData/, "no canvas read-back per frame");
  }
});

test("the lens repaints only when the chart repaints", () => {
  const calls = shell.match(/drawLens\(/g) || [];
  assert.equal(calls.length, 2, "one definition and exactly one call site");
  const draw = shell.match(/function scChartDraw\(host, scrub\) \{[\s\S]*?\n\}\n/)[0];
  assert.ok(draw.includes("drawLens(ctx, host,"), "the only call site is inside scChartDraw");
  const setLens = code(block("setLens"));
  assert.doesNotMatch(setLens, /fetch\(|ensureCloudDaily\(|scChartLoad\(|location\.reload/,
    "turning the lens on or off reloads nothing");
});

test("no grey line: the lens takes the main chart's day-direction colour", () => {
  const colours = code(drawLensSrc).match(/(?:strokeStyle|fillStyle) = [^;]+;/g) || [];
  assert.ok(colours.length >= 4, "the lens sets its colours explicitly");
  for (const line of colours) {
    const ok = line.includes("o.c") || line.includes("rgba(5,6,12");   // the day colour, or the panel back
    assert.ok(ok, "lens colour must be the chart's own direction colour, not a grey: " + line);
  }
  assert.doesNotMatch(code(drawLensSrc), /col\.dim|#[0-9A-F]{3,6}|grey|gray/i,
    "no grey ink and no hard-coded hue in the lens");
});

test("the pane records what the lens is showing, so a proof can read it without pixels", () => {
  assert.match(drawLensSrc, /host\._lens = \{ mode:v\.mode, bars:v\.bars/, "the lens state is on the host");
  assert.match(drawLensSrc, /rect:\{ x:box\.frame\.x, y:box\.frame\.y/, "with the band it drew");
});
