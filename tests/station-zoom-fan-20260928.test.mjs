/* STATION · 28 SEP 2026 — shorter first views, the lens rule rewritten, the Geiger chip top right,
   matching pairs on the two-chart pages, and the Lab's FULL RSI fan.
   ============================================================================
   Alan, 28 Sep:
     · lookbacks "APPROVED (1W 3y->2y, 3D 2y->1y, 1D 11 1/2->6 months, 4h 12->6 weeks; still zoom out)";
     · "It's going to require you to re-study the context lens locations… rewrite the rules so it fits";
     · "I feel like the Geiger should take the TOP RIGHT";
     · "S&P futures and Amazon. Then S&P futures and NASDAQ. It's really weird.";
     · "Three hour, four hour, six hour, eight hour, 12 hour - that's not the full fan. And I only see one
       line in most of these."
   Everything here is decidable without a browser; the headless screenshots are in
   deliverables/20260928/station-zoom-fan/. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { emptiestSpot, lineTailBox, tailBox, pathPoints, topRightSpot, clearsPrice } from "../_indicators/lens-placement.mjs";
import { placeLens, lensBoxes, LENS_TOLERANCE, SETTLE_MS } from "../_indicators/station-lens.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html");
const lensSrc = read("../_indicators/station-lens.mjs");
const plain = (v) => JSON.parse(JSON.stringify(v));
const ctx = { Intl, Date, Math, Number, JSON, Array, Object, Set, Map, isFinite, parseInt, console };
vm.runInNewContext(read("../station-shells/detail-v1/indicators.js"), ctx);
vm.runInNewContext(read("../_indicators/station-rsi-fan.js"), ctx);
const M = ctx.SC_DETAIL_MATH, F = ctx.SC_RSI_FAN;
const sceneCtx = { globalThis: {} };
vm.runInNewContext(read("../deck/scenes.js"), sceneCtx);
const scenes = sceneCtx.globalThis.StationScenes;
const H = 3600e3, D = 86400e3;

/* ---- 1 · the first view ------------------------------------------------------------------ */
test("every chart opens on the approved window and still reads the same bars", () => {
  const views = JSON.parse(chart.match(/const CHART_VIEW_BARS = Object\.freeze\((\{[^}]*\})\)/)[1]);
  assert.deepEqual(views, { "15m":128, "30m":96, "1h":80, "2h":96, "3h":120, "4h":120, "6h":120, "12h":120, "1D":126, "3D":120, "1W":104 },
    "1W 2 years, 3D 1 year, 1D 6 months, 4h 6 weeks, 1h a week, 30m three sessions (and the four in between)");
  const reads = chart.match(/const CHART_DB_RANGE = (\{[^}]*\})/)[1];
  for (const [range, n] of Object.entries({ "1D":240, "3D":240, "4h":240, "1W":157, "30m":240 }))
    assert.match(reads, new RegExp(`"${range}":\\["[^"]+",${n}\\]`), `${range} still reads ${n} bars, so zooming out keeps working`);
  for (const range of Object.keys(views)) assert.ok(views[range] < (range === "1W" ? 157 : 240), `${range} opens on part of what it reads`);
  /* a deep ?bars= link opens on all of it; a double-click comes back to the first view */
  assert.match(chart, /if \(chartBarsOverride\(\)\) return 0;/);
  assert.match(chart, /view = \{ start:chartDefaultStart\(host, pts\), end:last \};/);
  assert.match(chart, /cv\.addEventListener\("dblclick", \(e\) => \{ e\.preventDefault\(\); hideScrub\(\); resetChartView\(host\); \}\);/);
  assert.equal(chart, twin, "chart and station-shells/chart-v1 stay the same file");
});

test("the price scale, the clouds and the fan all follow the visible window", () => {
  /* price: the visible bars only */
  assert.match(chart, /for \(let i = start; i <= end; i\+\+\) \{\s*const q = pts\[i\]; if \(q\.p < lo\) lo = q\.p; if \(q\.p > hi\) hi = q\.p;/);
  /* clouds: drawn from the visible start to end */
  assert.match(chart, /drawCloudRibbon\(ctx, \{ map:cloudMap, start, end, X, Y,/);
  /* the fan: its vertical scale is fitted to what is visible, always showing 30 and 70 */
  assert.match(chart, /for \(let i = o\.start; i <= o\.end; i\+\+\) \{\s*for \(const line of o\.fan\.lines\)/);
  assert.match(chart, /const yLo = Math\.max\(0, Math\.min\(30, isFinite\(lo\) \? lo : 30\) - 4\), yHi = Math\.min\(100, Math\.max\(70, isFinite\(hi\) \? hi : 70\) \+ 4\);/);
});

/* ---- 2 · the lens rule ------------------------------------------------------------------- */
const wide = { padL: 6, padT: 34, iw: 792, ih: 300, start: 0, end: 125, rightBars: 20, yLo: 0, yHi: 100 };
const line = (n, f) => Array.from({ length: n }, (_, i) => ({ p: f(i) }));

test("rule 1: the newest fifth is a fifth of the DRAWN line, not of the plot (the names column is out too)", () => {
  const pts = pathPoints(wide, line(126, (i) => 50 + Math.sin(i / 9) * 20));
  const t = lineTailBox(wide, pts);
  const right = pts[pts.length - 1].x, left = pts[0].x;
  assert.ok(Math.abs(t.x - (right - 0.2 * (right - left))) < 1e-6, "the last fifth of the line's own width");
  assert.ok(t.x < tailBox(wide).x, "stricter than the old right-fifth-of-the-plot when the line ends before the plot's edge");
  assert.equal(t.x + t.w, wide.padL + wide.iw, "and everything right of it, to the plot's edge");
  const box = { w: 150, h: 80 };
  const res = emptiestSpot({ plot: wide, box, points: pts, ink: () => false, prefer: "bl" });
  assert.ok(res.spot.x + box.w <= t.x + 0.5, "the chosen spot never enters it");
});

test("rules 2-4: never on the badge or the chip, the least-drawn spot wins, bottom-left when about as empty", () => {
  /* a line along the top of the plot: the whole lower band is empty */
  const pts = pathPoints(wide, line(126, (i) => 85 + Math.sin(i / 6) * 5));
  const ink = () => false;
  const res = placeLens({ plot: wide, points: pts, ink });
  assert.equal(res.spot.corner, "bl", "empty everywhere: bottom-left");
  assert.equal(LENS_TOLERANCE, 0.05, "'about as empty' is within 5% of the box");
  /* ink everywhere in the bottom-left: the emptiest patch elsewhere wins */
  const busyBL = (x, y) => x < 200 && y > 200;
  const moved = placeLens({ plot: wide, points: pts, ink: busyBL });
  assert.notEqual(moved.spot.corner, "bl", "a painted bottom-left gives way to an emptier spot");
  assert.ok(clearsPrice(moved.spot, pts, 0), "and the spot it takes does not cross the price line");
  /* the chip and the badge are keep-outs */
  const chip = { x: 20, y: 250, w: 200, h: 80 };
  const kept = placeLens({ plot: wide, points: pts, ink, keepOut: [chip] });
  const hit = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  assert.ok(!hit(kept.spot, chip), "never on a keep-out");
  assert.match(lensSrc, /if \(chip\) keepOut\.push\(chip\);/, "the pane hands the Geiger chip in as a keep-out");
  assert.match(lensSrc, /for \(const id of \["edgePrev", "edgeNext", "tfNow"\]\)/, "and the deck's arrows and timeframe tag");
});

test("rule 3b: a lens that would sit on the price line shrinks before it does", () => {
  const boxes = lensBoxes(wide);
  assert.ok(boxes.length === 3 && boxes[0].w > boxes[1].w && boxes[1].w > boxes[2].w, "usual, one smaller, smallest");
  assert.ok(boxes[2].w >= 79 && boxes[2].h >= 50, "never under the floor");
  /* a zig-zag with a gap only big enough for the smaller box, low on the left */
  const gapLine = line(126, (i) => (i < 40 ? (i % 2 ? 95 : 60) : 30 + (i % 7) * 9));
  const pts = pathPoints(wide, gapLine);
  const res = placeLens({ plot: wide, points: pts, ink: () => false });
  assert.ok(res.spot, "a spot is found");
  if (!res.covers) assert.ok(clearsPrice(res.spot, pts, 0), "the spot it takes is clear of the line");
});

test("rule 6: while the view moves the lens holds still, and is placed again once it has been still", () => {
  assert.equal(SETTLE_MS, 200);
  assert.match(lensSrc, /if \(since < SETTLE_MS && host\._lens && host\._lens\.spot && host\._lens\.t === t && host\._lens\.key === want\.key\) \{/);
  assert.match(chart, /host\._viewMovedAt = performance\.now\(\);\s*scChartDraw\(host\);/, "every view change is stamped");
  /* the chip is placed before the lens, so the lens can step around it */
  assert.match(chart, /placeGeiger\(host\);\s*if \(BUBBLE_REQUEST \|\| host\.querySelector\("\.sc-nchart__lens"\)\) lensPaint\(host\);/);
});

/* ---- 3 · the Geiger chip, top right --------------------------------------------------------- */
test("the chip sits in the badge row at the plot's right edge; with no room there, just inside the plot", () => {
  const plot = { padL: 6, padT: 34, iw: 371, ih: 214 };
  const box = { w: 96, h: 16 };
  const r = topRightSpot({ plot, box, badge: { x: 8, y: 7, w: 180, h: 22 } });
  assert.equal(r.spot.x + box.w + 2, plot.padL + plot.iw);
  assert.ok(r.spot.y >= 0 && r.spot.y + box.h <= plot.padT);
  const crowded = topRightSpot({ plot, box, badge: { x: 8, y: 7, w: 330, h: 22 } });
  assert.equal(crowded.spot.y, plot.padT + 2, "a badge as wide as the row pushes the chip just inside the plot");
  assert.match(crowded.why, /inside the plot/);
});

/* ---- 4 · the pairs: UNCHANGED at Alan's request ------------------------------------------------- */
/* 28 Sep ~09:55 ET, Alan: "it was just me surprised" - keep the rotating leader-beside-target pages as they
   were. These pins hold the dedbc31 layout so a pairing change cannot slip back in unasked. */
test("the intraday pages keep the rotating leader beside the targets (dedbc31 layout, not re-paired)", () => {
  const targets = ["A","B","C","D","E","F","G","H"];
  const at = "2026-09-28T15:00:00Z";
  const s = (id, visit) => Array.from(scenes.workflowPageState(id, { at, visit, targets }).tickers);
  assert.deepEqual(s("intraday4h", 0), ["SPY","QQQ","A","B","C","D"]);
  assert.deepEqual(s("intraday1h", 0), ["SPY","A","B","C"]);
  assert.deepEqual(s("intraday1h", 1), ["QQQ","D","E","F"], "slot 1 still alternates between the two leaders");
  assert.deepEqual(s("intraday30m", 0), ["SPY","A"]);
  assert.deepEqual(s("intraday30m", 2), ["SPY","C"], "one target at a time, one step per visit");
  assert.equal(scenes.rotationScenesFor("day").length, 23, "the day lap: 23 pages, as before");
  assert.equal(scenes.rotationScenesFor("night").length, 17, "the night lap: 17 pages, as before");
});

/* ---- 5 · the full fan --------------------------------------------------------------------- */
test("the fan is the Lab's V4: six lines 3H-D and the slow context cloud of 2D, 3D, W and 2W", () => {
  assert.deepEqual(plain(F.parseRsiParam("1").lines), ["3h","4h","6h","8h","12h","1D"]);
  assert.deepEqual(plain(F.CONTEXT.map((c) => c.label)), ["2D","3D","W","2W"]);
  const widths = F.LINES.filter((l) => l.on).map((l) => l.width);
  assert.deepEqual(plain(widths), plain(widths.slice().sort((a, b) => a - b)), "slower lines are heavier");
  assert.match(chart, /const rsiContextFor = \(host\) => !RSI_REQUEST\.chart && rsiLinesFor\(host\)\.length > 1;/,
    "the cloud rides the full fan, never the Hub's lone ?rsi=chart line");
});

test("missing widths are composed on the Eastern clock from bars the fan already reads", () => {
  /* 4H bars at 00, 04, 08, 12, 16, 20 ET (04Z... in September) → 8H at 00/08/16, 12H at 00/12 */
  const four = Array.from({ length: 12 }, (_, i) => ({ t: Date.UTC(2026, 8, 21, 4 + 4 * i), c: 100 + i }));
  const eight = F.composeBars(four, F.BY_KEY["8h"].compose);
  assert.deepEqual(plain(eight.map((b) => [new Date(b.t).toISOString().slice(11, 16), b.c, b.n])),
    [["04:00",101,2],["12:00",103,2],["20:00",105,2],["04:00",107,2],["12:00",109,2],["20:00",111,2]],
    "pairs of 4H bars, closing on the second one's close");
  const twelve = F.composeBars(four, F.BY_KEY["12h"].compose);
  assert.deepEqual(plain(twelve.map((b) => [b.c, b.n])), [[102,3],[105,3],[108,3],[111,3]]);
  /* 2D pairs weekdays from a fixed anchor: a new day never re-pairs the old ones */
  const days = [];
  for (let d = Date.UTC(2026, 8, 14, 4); days.length < 10; d += D) { const w = new Date(d).getUTCDay(); if (w >= 1 && w <= 5) days.push({ t: d, c: days.length }); }
  const a = F.composeBars(days.slice(0, 9), F.BY_KEY.c2D.compose), b = F.composeBars(days, F.BY_KEY.c2D.compose);
  assert.deepEqual(plain(a.slice(0, 4)), plain(b.slice(0, 4)), "the pairs already made stay the same pairs");
  assert.ok(b.every((x) => x.n <= 2));
});

test("pickSource: the served width unless it is missing, too short, or stopped earlier", () => {
  const bars = (n, endT, step) => Array.from({ length: n }, (_, i) => ({ t: endT - (n - 1 - i) * step, c: 1 }));
  const now = Date.UTC(2026, 8, 28, 12);
  assert.equal(F.pickSource("8h", [], bars(500, now, 8 * H)).from, "composed", "none served (futures 8H)");
  assert.equal(F.pickSource("8h", bars(2800, now - 40 * D, 8 * H), bars(1500, now, 8 * H)).from, "composed", "served stopped in August");
  assert.equal(F.pickSource("12h", bars(45, now, 12 * H), bars(84, now, 12 * H)).from, "composed", "served has 45, composed 84");
  assert.equal(F.pickSource("12h", bars(3000, now, 12 * H), bars(1000, now, 12 * H)).from, "served", "a full served series wins");
});

test("a short history is still drawn (warmed up over 42+ bars) and marked approximate; a full one is not", () => {
  assert.equal(F.warmFor(45), 42); assert.equal(F.warmFor(82), 42); assert.equal(F.warmFor(254), 84); assert.equal(F.warmFor(300), 150);
  const bars = Array.from({ length: 82 }, (_, i) => ({ t: Date.UTC(2026, 7, 30) + i * 6 * H, c: 100 + Math.sin(i / 5) * 3 }));
  const s = F.lineSeries("6h", bars, M);
  assert.equal(s.filter((x) => x.v != null).length, 40, "82 bars, 42 warm-up, 40 drawn");
  assert.ok(s[81].approx, "and marked ≈");
  assert.match(chart, /\(line\.approx \? "≈" : ""\)/, "the legend says ≈ for those");
});

test("the context cloud is the band between the lowest and highest of the four, only where all four are known", () => {
  const env = F.envelope([[40, 50, null], [45, 55, 60], [42, 52, 61], [48, 49, 62]]);
  assert.deepEqual(plain(env), [{ lo: 40, hi: 48 }, { lo: 49, hi: 55 }, null]);
  /* a 3D bar that spans a weekend has finished on its last session's evening, told by the next stamp */
  const thu = Date.UTC(2026, 8, 17, 4), tue = Date.UTC(2026, 8, 22, 4);
  const s = F.lineSeries("c3D", [{ t: thu, c: 1 }, { t: tue, c: 2 }], M);
  assert.equal(new Date(s[0].end).toISOString(), "2026-09-22T00:00:00.000Z", "Thursday's 3D bar ends Monday 20:00 ET, not Saturday");
});

test("colour: each line green when its RSI is at or above a day earlier, red when below - the pane's own inks", () => {
  const up = [{ t: 0, end: 20 * H, v: 50 }, { t: D, end: D + 20 * H, v: 55 }];
  const down = [{ t: 0, end: 20 * H, v: 50 }, { t: D, end: D + 20 * H, v: 45 }];
  assert.equal(F.dayDirection(up), "up"); assert.equal(F.dayDirection(down), "down");
  const pal = { bull: "#00FFA3", bear: "#FF2D55" };
  assert.match(F.lineInk("1D", "up", pal), /^rgba\(0,255,163,1\.00\)$/);
  assert.match(F.lineInk("3h", "down", pal), /^rgba\(255,45,85,0\.52\)$/, "fast lines lighter, slow ones solid");
  assert.match(chart, /ctx\.strokeStyle = F\.lineInk\(line\.key, line\.dir, pal, solo \? 1 : 0\);/);
});

test("the fetch plan: every line's width, the widths it is composed from, and the cloud's", () => {
  const plan = Object.fromEntries(F.fetchPlan(["3h","4h","6h","8h","12h","1D"], 182 * D, true));
  assert.deepEqual(Object.keys(plan).sort(), ["12h","1D","1W","3D","3h","4h","6h","8h"].sort());
  assert.ok(plan["4h"] >= 2 * F.sourceLimit("8h", 182 * D) - 1 && plan["4h"] >= 3 * F.sourceLimit("12h", 182 * D) - 1 || plan["4h"] === F.MAX_SOURCE,
    "enough 4H bars to compose 8H and 12H");
  assert.ok(!("2W" in plan) && !("2D" in plan), "2D and 2W are composed, never asked for (the API's 2D stopped, futures have no 2W)");
});
