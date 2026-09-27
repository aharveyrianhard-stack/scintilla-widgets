/* The Context Lens, round 3: the intraday-bars bubble on the 3-day line pages.
   Checked against the same module the workshop page draws with
   (deliverables/20260926/context-lens-3/lens-bars.mjs, which re-exports /_indicators/lens-bars.mjs
   since 27 Sep, CL4: the live chart draws it now, at 60% of the 26 Sep size). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { etParts, sessionsOf, lastSessions, flatten, barsToRequest, gapOf, gapsOf, dayDirection, barColour,
  layout, candleGeometry, axisTicks, bubbleBox, placeBubble, lapRequests, DIALS, BUBBLE_SIZES, FLOOR, CEILING, TIMEFRAMES, HOURS, PALETTE }
  from "../deliverables/20260926/context-lens-3/lens-bars.mjs";
import { pathPoints } from "../deliverables/20260923/context-lens-2/lens-placement.mjs";

const HERE = new URL(".", import.meta.url);
const read = (rel) => fs.readFileSync(new URL(rel, HERE), "utf8");

/* a session of 30-minute bars in New York time; t is the bar's START */
const NY = (day, hm) => {
  const [h, m] = hm.split(":").map(Number);
  /* 25 Sep 2026 is in daylight time: ET = UTC-4 */
  return Date.UTC(2026, 8, day, h + 4, m);
};
function session(day, from, to, price, step = 30) {
  const out = [];
  let p = price;
  for (let m = from; m < to; m += step) {
    const o = p, c = p + (m % 60 ? -0.4 : 0.6);
    out.push({ t: NY(day, `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`), o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c, v: 1000 + m });
    p = c;
  }
  return out;
}
const MIN = (h, m) => h * 60 + m;
const threeDays = [...session(23, MIN(4, 0), MIN(20, 0), 100), ...session(24, MIN(4, 0), MIN(20, 0), 104), ...session(25, MIN(4, 0), MIN(20, 0), 98)];

test("bars are stamped in New York, and a session is a New York day", () => {
  const p = etParts(NY(25, "09:30"));
  assert.equal(p.day, "2026-09-25"); assert.equal(p.minutes, MIN(9, 30)); assert.equal(p.weekday, "FRI"); assert.equal(p.hm, "09:30");
});

test("regular hours keep 13 thirty-minute bars a session (09:30 to 15:30 starts); extended keep 32", () => {
  const reg = sessionsOf(threeDays, "regular");
  assert.equal(reg.length, 3);
  for (const s of reg) assert.equal(s.bars.length, 13, `${s.day} regular`);
  assert.equal(etParts(reg[0].bars[0].t).hm, "09:30");
  assert.equal(etParts(reg[0].bars[12].t).hm, "15:30");
  const ext = sessionsOf(threeDays, "extended");
  for (const s of ext) assert.equal(s.bars.length, 32, `${s.day} extended`);
  assert.deepEqual(reg.map((s) => s.day), ["2026-09-23", "2026-09-24", "2026-09-25"]);
});

test("the last N sessions are the newest ones, in order, and flatten numbers them", () => {
  const two = lastSessions(threeDays, 2, "regular");
  assert.deepEqual(two.map((s) => s.day), ["2026-09-24", "2026-09-25"]);
  const flat = flatten(two);
  assert.equal(flat.length, 26);
  assert.equal(flat[0].session, 0); assert.equal(flat[25].session, 1);
  assert.ok(flat.every((b, i) => !i || b.t > flat[i - 1].t), "ascending");
});

test("bad bars are dropped, never drawn: a zero close or a missing time is not a candle", () => {
  const bars = [...session(25, MIN(9, 30), MIN(16, 0), 50), { t: NaN, o: 1, h: 1, l: 1, c: 1 }, { t: NY(25, "12:00"), o: 50, h: 50, l: 50, c: 0 }];
  const s = sessionsOf(bars, "regular");
  assert.equal(s.length, 1); assert.equal(s[0].bars.length, 13);
});

test("the request covers extended hours even when only the regular session is drawn, and never exceeds 240", () => {
  assert.equal(barsToRequest("30m", 3), 128);     // (3 + 1 spare) × 32
  assert.equal(barsToRequest("1h", 3), 64);
  assert.equal(barsToRequest("15m", 3), 240);     // 4 × 64 = 256, capped
  assert.equal(barsToRequest("30m", 1), 64);
  for (const k of Object.keys(TIMEFRAMES)) assert.ok(TIMEFRAMES[k].extended > TIMEFRAMES[k].regular);
  assert.equal(HOURS.regular.open, MIN(9, 30)); assert.equal(HOURS.regular.close, MIN(16, 0));
});

test("a gap is a session's first open against the previous session's last close, and the largest one is the one named", () => {
  const s = sessionsOf(threeDays, "regular");
  const all = gapsOf(s);
  assert.equal(all.length, 2, "three sessions have two gaps between them");
  assert.equal(all[0].from, s[0].bars[12].c); assert.equal(all[0].to, s[1].bars[0].o); assert.equal(all[0].day, "2026-09-24");
  assert.equal(all[1].day, "2026-09-25");
  for (const g of all) assert.ok(Math.abs(g.pct - (g.to / g.from - 1) * 100) < 1e-9);
  /* the Wednesday-to-Thursday gap here is 104 vs ~101.6 (about +2.4%), Thursday-to-Friday 98 vs ~105.6 (about -7%) */
  const g = gapOf(s);
  assert.equal(g.day, "2026-09-25"); assert.ok(g.pct < -5, `largest by size: ${g.pct}`);
  assert.equal(gapOf(s.slice(2)), null, "one session has no gap to measure");
});

test("daily up is green and daily down is red, by the newest daily close against the one before; unknown is unknown", () => {
  assert.equal(dayDirection([{ c: 10 }, { c: 11 }]), "up");
  assert.equal(dayDirection([{ c: 10 }, { c: 10 }]), "up", "unchanged is at-or-above, the pane's own rule");
  assert.equal(dayDirection([{ c: 10 }, { c: 9 }]), "down");
  assert.equal(dayDirection([{ c: 10 }]), null);
  assert.equal(barColour({ o: 1, c: 2 }, "bar", "down"), PALETTE.bull, "a bar colours itself by its own close");
  assert.equal(barColour({ o: 2, c: 1 }, "bar", "up"), PALETTE.bear);
  assert.equal(barColour({ o: 1, c: 2 }, "day", "down"), PALETTE.bear, "in day mode the day decides");
  /* no grey: every colour the bubble uses for a bar is the bull or the bear, never the dim ink */
  for (const mode of ["bar", "day"]) for (const day of ["up", "down", null])
    for (const bar of [{ o: 1, c: 2 }, { o: 2, c: 1 }, { o: 1, c: 1 }])
      assert.ok([PALETTE.bull, PALETTE.bear].includes(barColour(bar, mode, day)), `${mode}/${day} never grey`);
});

test("the box inside the box: head, candles, optional volume, axis, and a price tag only when there is room", () => {
  const L = layout({ x: 10, y: 20, w: 200, h: 120 }, { volume: false });
  assert.equal(L.head.h, 15); assert.equal(L.axis.h, 12);
  assert.ok(L.tag && L.tag.w === 40, "a 200px bubble carries a 40px price tag");
  assert.equal(L.vol, null);
  assert.ok(L.plot.y > L.head.y + L.head.h - 1 && L.plot.y + L.plot.h <= L.axis.y, "candles sit between the head and the axis");
  const V = layout({ x: 10, y: 20, w: 200, h: 120 }, { volume: true });
  assert.ok(V.vol && V.vol.h > 0 && V.vol.y >= V.plot.y + V.plot.h, "volume is a strip under the candles");
  assert.ok(V.plot.h < L.plot.h, "volume takes its height from the candles, not from the axis");
  const tiny = layout({ x: 0, y: 0, w: 110, h: 84 }, { volume: true });
  assert.equal(tiny.tag, null, "no room for a tag under 120px");
  assert.equal(tiny.vol, null, "no volume strip on a bubble that cannot hold one");
});

test("candle geometry: one slot per bar, bodies never under a pixel, a half slot of air at each session break, prices inside the box", () => {
  const bars = flatten(lastSessions(threeDays, 3, "regular"));
  const box = { x: 0, y: 0, w: 200, h: 100 };
  const g = candleGeometry(bars, box);
  assert.equal(g.candles.length, 39);
  assert.deepEqual(g.breaks, [13, 26]);
  assert.ok(Math.abs(g.slot - 200 / 40) < 1e-9, "39 bars plus two half-slot breaks");
  for (const c of g.candles) {
    assert.ok(c.w >= 1);
    assert.ok(c.x > box.x && c.x < box.x + box.w, "inside horizontally");
    for (const y of [c.yO, c.yC, c.yH, c.yL]) assert.ok(y >= box.y && y <= box.y + box.h, "inside vertically");
    assert.ok(c.yH <= Math.min(c.yO, c.yC) && c.yL >= Math.max(c.yO, c.yC), "wick spans the body");
  }
  assert.ok(g.candles[13].x - g.candles[12].x > g.candles[12].x - g.candles[11].x, "the break is visible as air");
  assert.equal(candleGeometry([], box).candles.length, 0);
});

test("the tiny axis names each session once, and hours when there is only one session", () => {
  const sessions = lastSessions(threeDays, 3, "regular");
  const bars = flatten(sessions);
  const g = candleGeometry(bars, { x: 0, y: 0, w: 200, h: 100 });
  const ticks = axisTicks(bars, g, sessions);
  assert.deepEqual(ticks.map((t) => t.label), ["WED 23", "THU 24", "FRI 25"]);
  assert.ok(ticks.every((t, i) => !i || t.x > ticks[i - 1].x));
  const one = lastSessions(threeDays, 1, "regular");
  const ob = flatten(one);
  const ot = axisTicks(ob, candleGeometry(ob, { x: 0, y: 0, w: 200, h: 100 }), one);
  assert.deepEqual(ot.map((t) => t.label), ["10", "12", "14"]);
});

/* ---- placement: the 23 Sep rule, asked for a bubble-shaped box ---- */
const PLOT = { padL: 6, padT: 8, iw: 540, ih: 240, start: 0, end: 239, rightBars: 8, yLo: 0, yHi: 100 };
const line = (fn) => Array.from({ length: 240 }, (_, i) => ({ d: `2026-${i}`, p: fn(i) }));
const inkFor = (series) => { const pts = pathPoints(PLOT, series); return (x, y) => pts.some((p) => Math.abs(p.x - x) < 5 && Math.abs(p.y - y) < 5); };

test("a bubble is wider than it is tall, and never under the floor", () => {
  for (const k of Object.keys(BUBBLE_SIZES)) {
    assert.ok(BUBBLE_SIZES[k].w > 0 && BUBBLE_SIZES[k].w < 0.5, `${k} under half the width`);
    const b = bubbleBox(PLOT, k);
    assert.ok(b.w > b.h, `${k} wider than tall on a Station pane`);
    assert.ok(b.w >= FLOOR.w && b.h >= FLOOR.h);
  }
  const phone = bubbleBox({ ...PLOT, iw: 300, ih: 160 }, "S");
  assert.equal(phone.w, FLOOR.w); assert.equal(phone.h, FLOOR.h);
  /* a 2-up pane (840 × 554, plot about 790 × 500) is capped: a glance, not a poster */
  const twoUp = bubbleBox({ ...PLOT, iw: 790, ih: 500 }, "L");
  assert.equal(twoUp.w, CEILING.w); assert.equal(twoUp.h, CEILING.h);
  /* an 8-up pane (419 × 277, plot about 370 × 230) is the fraction itself */
  const eightUp = bubbleBox({ ...PLOT, iw: 370, ih: 230 }, "M");
  assert.equal(eightUp.w, Math.round(370 * BUBBLE_SIZES.M.w)); assert.equal(eightUp.h, Math.round(230 * BUBBLE_SIZES.M.h));
});

/* a line that runs high and then rises leaves the bottom empty; one that runs low and then falls leaves the top */
const risingLate = line((i) => (i < 160 ? 72 : 72 + (i - 160) * 0.3));
const fallingLate = line((i) => (i < 160 ? 28 : 28 - (i - 160) * 0.3));

test("rising puts the bubble low and falling puts it high, and it never sits on the price", () => {
  const r = placeBubble({ plot: PLOT, series: risingLate, ink: inkFor(risingLate), size: "M", prefer: "auto" });
  assert.equal(r.kind, "inset");
  assert.ok(r.spot.corner.startsWith("b"), `rising: low, got ${r.spot.corner}`);
  assert.equal(r.trend.dir, "up");
  const f = placeBubble({ plot: PLOT, series: fallingLate, ink: inkFor(fallingLate), size: "M", prefer: "auto" });
  assert.equal(f.kind, "inset");
  assert.ok(f.spot.corner.startsWith("t"), `falling: high, got ${f.spot.corner}`);
  assert.equal(f.trend.dir, "down");
  for (const res of [r, f]) {
    assert.ok(res.spot.w >= FLOOR.w && res.spot.h >= FLOOR.h);
    assert.ok(res.considered.every((c) => c.size === res.size));
    assert.equal(res.spot.refused, null, "the chosen corner was not a refused one");
  }
  /* a straight diagonal covers both corners on its own side: the rule refuses them, whatever the trend prefers */
  const diagonal = line((i) => 5 + i * 0.38);
  const d = placeBubble({ plot: PLOT, series: diagonal, ink: inkFor(diagonal), size: "M", prefer: "auto" });
  assert.equal(d.kind, "inset");
  assert.notEqual(d.spot.corner, "bl", "bottom-left is under the line");
  assert.ok(d.considered.find((c) => c.corner === "bl").refused, "and it is reported as refused, not silently skipped");
});

test("the ladder shrinks before it shelves, and a line through everything parks the bubble under the chart", () => {
  const zigzag = line((i) => 50 + 45 * Math.sin(i / 3));
  const res = placeBubble({ plot: PLOT, series: zigzag, ink: inkFor(zigzag), size: "L" });
  assert.equal(res.kind, "shelf");
  assert.equal(res.size, "S", "it tried every step down first");
  assert.equal(res.shrunk, true);
});

test("a fixed corner is honoured when it clears the price, and refused when it would cover it", () => {
  const bl = placeBubble({ plot: PLOT, series: risingLate, ink: inkFor(risingLate), size: "M", prefer: "bl" });
  assert.equal(bl.spot.corner, "bl");
  const tl = placeBubble({ plot: PLOT, series: risingLate, ink: inkFor(risingLate), size: "M", prefer: "tl" });
  assert.equal(tl.kind, "inset");
  assert.notEqual(tl.spot.corner, "tl", "top-left is on the line, so the wish is refused");
  assert.notEqual(tl.spot.corner, "tr", "the tail (the newest fifth) is never covered");
});

test("the pane's badge is a keep-out: the bubble tucks under it rather than covering it, and says so", () => {
  const badge = { x: PLOT.padL + 8, y: PLOT.padT + 7, w: 96, h: 14 };      // where .sc-nchart__live sits
  const free = placeBubble({ plot: PLOT, series: fallingLate, ink: inkFor(fallingLate), size: "M", prefer: "auto" });
  assert.equal(free.spot.corner, "tl", "without the badge the falling line puts it top left");
  const kept = placeBubble({ plot: PLOT, series: fallingLate, ink: inkFor(fallingLate), size: "M", prefer: "auto", keepOut: [badge] });
  assert.equal(kept.kind, "inset");
  assert.equal(kept.spot.corner, "tl");
  assert.equal(kept.tucked, true);
  assert.ok(kept.spot.y >= badge.y + badge.h + 8, "moved down past the badge with the usual clearance");
  assert.ok(kept.why.includes("tucked under the badge"));
  /* a badge so tall the tuck would push the box onto the line: refused and named, and the bubble goes elsewhere */
  const tall = { x: PLOT.padL + 8, y: PLOT.padT + 7, w: 96, h: 150 };
  const elsewhere = placeBubble({ plot: PLOT, series: fallingLate, ink: inkFor(fallingLate), size: "M", prefer: "auto", keepOut: [tall] });
  assert.notEqual(elsewhere.spot && elsewhere.spot.corner, "tl");
  const tl = elsewhere.considered.find((c) => c.corner === "tl" && c.size === elsewhere.size);
  assert.equal(tl.refused, "would cover the badge");
  /* an empty keep-out list changes nothing */
  const same = placeBubble({ plot: PLOT, series: fallingLate, ink: inkFor(fallingLate), size: "M", prefer: "auto", keepOut: [] });
  assert.equal(same.spot.corner, "tl"); assert.equal(same.tucked, false);
});

/* ---- the cost of a build, held to the real deck ---- */
const scenes = (() => {
  const source = read("../deck/scenes.js");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  return context.globalThis.StationScenes;
})();

test("what a build would add to a lap: one intraday read per 3-day pane, none on the other pages", () => {
  /* the deck's own count: what workflowPageState reports for the page */
  const count = (page) => page.chartCount;
  const pagesFor = (session) => scenes.rotationScenesFor
    ? scenes.rotationScenesFor(session).map((id) => scenes.workflowPageState(id, { at: new Date("2026-09-25T15:00:00Z") }))
    : null;
  const day = pagesFor("day"), night = pagesFor("night");
  assert.ok(day && night, "the deck's lap is readable from scenes.js");
  const d = lapRequests(day, count), n = lapRequests(night, count);
  assert.equal(d.pagesWithBubble, 9, "nine 3-day pages in the day lap");
  assert.equal(n.pagesWithBubble, 9);
  assert.equal(d.requests, d.panes);
  assert.ok(d.panes >= 50 && d.panes <= 66, `day lap panes ${d.panes}`);
  /* a 3-day page shown with six charts is six reads; the two-chart SPY + QQQ page is two */
  assert.equal(lapRequests([{ range: "3D", chartCount: 6 }], count).requests, 6);
  assert.equal(lapRequests([{ range: "3D", chartCount: 2 }], count).requests, 2);
  assert.equal(lapRequests([{ range: "1D", chartCount: 2 }], count).requests, 0, "no bubble on a daily page");
  assert.equal(lapRequests([{ range: "3D", chartCount: 1 }], count, { lapMinutes: 13, refreshMin: 10 }).refreshPerLap, 1);
});

test("the recommended dials are the ones the page opens with, and they are quiet", () => {
  assert.equal(DIALS.size, "M"); assert.equal(DIALS.timeframe, "30m"); assert.equal(DIALS.sessions, 3);
  assert.equal(DIALS.hours, "regular"); assert.equal(DIALS.volume, false); assert.equal(DIALS.opacity, 0.96);
  assert.equal(DIALS.margin, 8); assert.equal(DIALS.maxInk, 0.55);
});

test("on the live Station only through the switch: the pane loads the lens module when ?bubble= asks, never the review page", () => {
  for (const rel of ["../chart/index.html", "../station-shells/chart-v1/index.html", "../deck/index.html", "../deck/scenes.js"]) {
    const src = read(rel);
    assert.ok(!/context-lens-3/.test(src), `${rel} must not reference the review page`);
  }
  for (const rel of ["../chart/index.html", "../station-shells/chart-v1/index.html"]) {
    const src = read(rel);
    assert.equal((src.match(/import\("\/_indicators\/station-lens\.mjs"\)/g) || []).length, 1, `${rel}: one lazy import`);
    assert.match(src, /let BUBBLE_REQUEST = QS\.get\("bubble"\) \|\| "";/);
    assert.match(src, /function scLens\(\) \{\n  if \(!BUBBLE_REQUEST\) return null;/, "no switch, no import");
  }
});

test("the workshop's cases are real Station names, from the chart API, covering up, down, sideways and gap", () => {
  const m = JSON.parse(read("../deliverables/20260926/context-lens-3/cases/manifest.json"));
  assert.ok(m.source.includes("/candles"));
  assert.equal(m.cases.length, 8);
  const kinds = new Set(m.cases.map((c) => c.id.split("-")[0]));
  assert.deepEqual([...kinds].sort(), ["down", "gap", "side", "up"]);
  const pages = new Set(m.cases.map((c) => c.page));
  for (const p of ["TARGETS", "SECTORS", "SPY + QQQ", "MAG 7"]) assert.ok(pages.has(p), `a case from ${p}`);
  for (const c of m.cases) {
    const doc = JSON.parse(read(`../deliverables/20260926/context-lens-3/${c.file}`));
    assert.ok(doc.threeDay.url.includes("tf=3D") && doc.threeDay.bars.length >= 200);
    assert.ok(doc.daily.url.includes("tf=D") && doc.daily.bars.length >= 400, `${c.symbol} daily closes for the clouds`);
    for (const tf of ["15", "30", "60"]) assert.ok(doc.intraday[tf].url.includes(`tf=${tf}`) && doc.intraday[tf].bars.length >= 60);
    /* the Station's own page list really carries this name */
    const onPages = Object.values(scenes.WORKFLOW_PAGES).filter((p) => p.range === "3D")
      .flatMap((p) => (p.tickers || []).concat(p.targets ? scenes.TARGETS_DEFAULT : [], p.leaders ? ["SPY", "QQQ"] : []));
    assert.ok(onPages.includes(c.symbol), `${c.symbol} is on a 3-day page`);
  }
});
