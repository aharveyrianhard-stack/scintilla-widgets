/* O1-STATION-FIXES (27 Sep 2026, evening): Alan's Station list, section D.
   The lens rules live in station-lens.test.mjs, the merged SPY + QQQ page in station-scenes.test.mjs, the
   stamp in station-stale-bar-20260925.test.mjs; this file holds the rest: the load order, the crosshair,
   the top margin, the Geiger chip's spot, and the grey squares at the top of the panes. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { emptiestSpot, pathPoints, tailBox, topRightSpot } from "../_indicators/lens-placement.mjs";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const chart = read("../chart/index.html");
const shell = read("../station-shells/chart-v1/index.html");
const deck = read("../deck/index.html");
const detail = read("../deck/detail.js");

function fnFrom(src, name, bindings = {}) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") depth--;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${src.slice(start, end)})`, bindings);
}

test("both chart copies stay byte-identical", () => {
  assert.equal(chart, shell);
});

test("the load queue serves the price first, then the ribbon, then the lens, then the RSI fan", () => {
  const priority = fnFrom(deck, "chartLoadPriority");
  assert.equal(priority("MU|3D|240|0"), 0, "a price read");
  assert.equal(priority("MU|3D|240|0|clouds"), 1);
  assert.equal(priority("MU|3D|240|0|lens"), 2);
  assert.equal(priority("MU|1D|240|0|rsi"), 3);
  assert.equal(priority(undefined), 0, "an unlabelled read is treated as a price");
  assert.match(deck, /chartDataLoadQueue\.push\(\{ token:event\.data\.token, priority:chartLoadPriority\(event\.data\.req\),/);
  assert.match(deck, /const CHART_DATA_LOAD_LIMIT = 4;/, "how many run at once is unchanged");
  /* the sort keeps first-come order inside a rank */
  const q = [{ t: "a", priority: 2 }, { t: "b", priority: 0 }, { t: "c", priority: 1 }, { t: "d", priority: 0 }, { t: "e", priority: 2 }];
  const sorted = q.map((job, i) => ({ job, i })).sort((a, b) => (a.job.priority || 0) - (b.job.priority || 0) || a.i - b.i).map((x) => x.job.t);
  assert.deepEqual(sorted, ["b", "d", "c", "a", "e"]);
  assert.match(deck, /\.sort\(\(a, b\) => \(a\.job\.priority \|\| 0\) - \(b\.job\.priority \|\| 0\) \|\| a\.i - b\.i\)/);
});

test("the lens module is fetched at boot on a pane that carries one, not on its first paint", () => {
  assert.match(chart, /\nif \(BUBBLE_REQUEST\) scLens\(\);\n/);
});

test("the crosshair: the price at 11 px or more, and the percent from the current price, green above and red below", () => {
  /* S5 (1 Oct): the hovered level's price and percent moved to the level tag on the horizontal line, at 11 px
     (the corner readout now reads the hovered DATE - tests/station-crosshair-s5-20261001.test.mjs) */
  /* S16 (6 Oct): the level tag is crosshairLevelTag - still 11 px times the pane scale, the percent now UNDER the price */
  assert.match(chart, /const font = Math\.round\(11 \* k \* 10\) \/ 10, f = "600 " \+ font;/);
  assert.match(chart, /const pct = nowPx > 0 \? \(price \/ nowPx - 1\) \* 100 : null;/);
  assert.match(chart, /lines\.push\(\{ text: o\.pctText, font: f, ink: o\.up \? "bull" : "bear"/, "green above the current price, red below");
  assert.match(chart, /pctText: chartPctText\(pct\), up: pct >= 0, scale \}\);/);   /* S16b: no `avoid` after it - the label holds the pointer's line */
  /* S1 (29 Sep): the readout's percent, green or red, in one fixed spot (S16: under the price)
     (tests/station-lens-crosshair-20260929.test.mjs holds the placement) */
  assert.match(chart, /rows\.push\(\{ text: o\.pctText, font: "700 " \+ pctFont, size: pctFont, ink: o\.up \? "bull" : "bear"/);
  assert.match(chart, /const nowPx = g\.livePriceValue != null \? g\.livePriceValue : g\.dayPx;/, "the same one price the badge and line use");
});

test("the plot starts under the badge (capped at 18% of the pane), with TradingView-like price margins", () => {
  assert.match(chart, /const padT = Math\.max\(\(ipadProfile \? 7 : 8\) \* scale, Math\.min\(Math\.round\(h \* \.18\), badgeBottom \+ 5\)\),/);
  /* CH1 (5 Oct): the margins live in chPriceRange, which also folds the visible clouds into the range */
  assert.match(chart, /yLo: yLo >= 0 \? Math\.max\(0, yLo - yRange \* \.06\) : yLo - yRange \* \.06, yHi: yHi \+ yRange \* \.08/);
  assert.match(chart, /const fit = chPriceRange\(lo, hi, cloudMap, start, end\);/);
  /* the badge lost its grey frame */
  assert.match(chart, /background:rgba\(5,6,12,\.76\); border:0; border-radius:4px;/);
});

test("the Geiger chip takes the TOP RIGHT, in the badge row, clear of the price scale; the deck's tag pushes it left (28 Sep)", () => {
  /* 27 Sep (O1) the chip hunted for the emptiest patch inside the plot; 28 Sep Alan: "I feel like the
     Geiger should take the TOP RIGHT." */
  const plot = { padL: 6, padT: 34, iw: 371, ih: 214, start: 0, end: 239, rightBars: 8, yLo: 0, yHi: 100 };
  const box = { w: 92, h: 16 };
  const badge = { x: 8, y: 7, w: 180, h: 22 };
  const top = topRightSpot({ plot, box, badge });
  assert.equal(top.spot.x + box.w, plot.padL + plot.iw - 2, "right-aligned to the plot's right edge, left of the price scale");
  assert.ok(top.spot.y + box.h <= plot.padT, "above the plot: never on the price line or the live price label");
  const tag = { x: 330, y: 6, w: 30, h: 20 };
  const pushed = topRightSpot({ plot, box, badge, keepOut: [tag] });
  const hits = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  assert.ok(!hits(pushed.spot, tag) && !hits(pushed.spot, badge), "slides left of the deck's tag, never onto the badge");
  assert.match(chart, /node\.className = "sc-nchart__live-geiger is-float";/);
  assert.match(chart, /import\("\/_indicators\/lens-placement\.mjs"\)/);
  assert.match(chart, /const res = P\.topRightSpot\(\{ plot, box, badge, keepOut \}\);/);
});

test("no grey DETAIL badge on the wall, and the expand square only shows under a pointer", () => {
  assert.match(detail, /if \(!detailBadgeOn\(\)\) \{/);
  assert.match(detail, /\.get\("detail"\) === "1"/);
  assert.match(deck, /@media \(hover:hover\)\{ \.chart-full\{ opacity:0;/);
  assert.match(deck, /\.chart-pane:hover \.chart-full, \.chart-full:focus-visible\{ opacity:1; \}/);
});

test("the ribbon's browser copy: v2 is about a quarter of the size and gives back exactly the same bars; v1 still reads", () => {
  const pack = fnFrom(chart, "cloudPack"), unpack = fnFrom(chart, "cloudUnpack", { Number, Array, Date, parseInt });
  const pts = []; let t = Date.parse("2020-10-01T04:00:00.000Z");
  for (let i = 0; i < 1500; i++) {
    const day = new Date(t).getUTCDay();
    t += (day === 5 ? 3 : 1) * 86400000 + (i === 700 ? 3600000 : i === 900 ? -3600000 : 0);   // weekends, and the clock changes
    pts.push({ d: new Date(t).toISOString(), p: +(100 + (i % 97) * 3.17).toFixed(2) });
  }
  const v2 = pack(pts);
  const back = unpack(JSON.parse(JSON.stringify(v2)));
  assert.deepEqual(JSON.parse(JSON.stringify(back)), pts, "the same timestamps and closes, bar for bar");
  const v1Len = JSON.stringify({ ts: 1, pts, asked: 1500 }).length, v2Len = JSON.stringify({ ts: 1, asked: 1500, ...v2 }).length;
  assert.ok(v2Len * 3.5 < v1Len, `v2 ${v2Len} vs v1 ${v1Len} characters`);
  assert.deepEqual(JSON.parse(JSON.stringify(unpack({ ts: 1, pts: pts.slice(0, 3) }))), pts.slice(0, 3), "a v1 copy is read as it is");
  assert.equal(unpack({ v: 2, t0: 1, s: "0,1", c: [1] }), null, "a damaged copy is no copy");
  assert.match(chart, /const tsOf = \(k\) => \{ const m = \/\^\\\{"ts":\(\\d\+\)\/\.exec/, "eviction reads the age from the first characters");
});
