/* CL4, 27 Sep: the context lens on the live chart pane — /_indicators/station-lens.mjs.
   Sizes at 60% of the 26 Sep review, 8 px text floor, stale looks stale, and one read per chart per
   refresh. O1 (same evening): the emptiest dark space instead of fixed bottom-left, 4h on the 3-day
   charts and 30m on the daily ones. */
import test from "node:test";
import assert from "node:assert/strict";
import { parseBubble, wanted, lastOpenedSession, freshness, placeLens, ensure, framePath, markIndex,
  INK, REFRESH_MS, RANGES } from "../_indicators/station-lens.mjs";
import { bubbleBox, drawBubble, layout, sessionsOf, flatten, axisTicks, candleGeometry, fmtPrice, TIMEFRAMES, barsToRequest,
  FLOOR, CEILING, BUBBLE_SIZES, SHRINK, CHAMFER, MIN_FONT } from "../_indicators/lens-bars.mjs";
import { pathPoints, candidateRects, tailBox, emptiestSpot, COVER_COST } from "../_indicators/lens-placement.mjs";

/* an 8-up pane at 1680 is 419 × 277; the plot the chart draws in it is about 371 × 248 */
const PLOT = { padL: 6, padT: 8, iw: 371, ih: 248, start: 0, end: 239, rightBars: 8, yLo: 0, yHi: 100 };
const line = (fn) => Array.from({ length: 240 }, (_, i) => ({ d: `x${i}`, p: fn(i) }));
const NY = (y, mo, d, hm, off = 4) => { const [h, m] = hm.split(":").map(Number); return Date.UTC(y, mo - 1, d, h + off, m); };

test("60% of the 26 Sep bubble: 93 × 68 on an 8-up pane, with the floor and the ceiling scaled the same", () => {
  assert.equal(SHRINK, 0.6);
  assert.deepEqual({ ...BUBBLE_SIZES.M }, { w: 0.252, h: 0.276 });
  assert.deepEqual({ ...FLOOR }, { w: 79, h: 50 });           // was 132 × 84
  assert.deepEqual({ ...CEILING }, { w: 204, h: 126 });       // was 340 × 210
  const box = bubbleBox(PLOT, "M");
  assert.deepEqual(box, { w: 93, h: 68 });
  assert.deepEqual(bubbleBox({ ...PLOT, iw: 342, ih: 440 }, "M"), { w: 86, h: 69 }, "a tall phone pane: never taller than 0.8 of its width");
  const share = (box.w * box.h) / (419 * 277);
  assert.ok(share > 0.05 && share < 0.06, `about 5.4% of the pane, got ${(share * 100).toFixed(1)}%`);
});

test("the placement rule's own S fraction no longer overrides the box it is asked to place", () => {
  const [r] = candidateRects(PLOT, "S", { boxW: 93, boxH: 68 });
  assert.equal(r.w, 93); assert.equal(r.h, 68);
  /* without boxW/boxH the 23 Sep lens is unchanged: 0.24 × 0.36 of the plot, floored at 116 × 74 */
  const [old] = candidateRects(PLOT, "S", {});
  assert.equal(old.w, 116); assert.equal(old.h, Math.round(248 * 0.36));
});

/* O1 (27 Sep), Alan: "position must seek the emptiest dark space (not fixed)". An ink function stands in
   for the chart's canvas: here the line and a cloud block painted over part of the plot. */
const inkOf = (...blocks) => (x, y) => blocks.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
const overlap = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

test("bottom-left when bottom-left is as empty as anywhere", () => {
  const flatHigh = line(() => 90);                 // the line runs along the top: the bottom is empty
  const res = placeLens({ plot: PLOT, series: flatHigh, ink: () => false });
  assert.equal(res.spot.corner, "bl");
  assert.equal(res.spot.x, PLOT.padL + 6);
  assert.equal(res.spot.y + res.spot.h, PLOT.padT + PLOT.ih - 6, "on the bottom edge of the plot, 6 px in");
  assert.match(res.why, /bottom-left/);
});

test("the emptiest dark space, not fixed: a line through the bottom-left sends the lens where nothing is drawn", () => {
  /* a 3-day line that rises from the bottom-left corner - the lens used to sit on its far past */
  const rising = line((i) => 5 + i * 0.38);
  const pts = pathPoints(PLOT, rising);
  const ink = (x, y) => pts.some((p) => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 3);
  const res = placeLens({ plot: PLOT, series: rising, ink });
  assert.notEqual(res.spot.corner, "bl");
  assert.equal(res.covers, false, "it clears the line");
  assert.ok(res.spot.x + res.spot.w <= tailBox(PLOT).x, "never in the newest fifth");
  /* a painted block (a cloud) makes a region busy: the lens avoids it */
  const cloud = { x: PLOT.padL, y: PLOT.padT, w: 200, h: 120 };
  const res2 = placeLens({ plot: PLOT, series: line(() => 50), ink: inkOf(cloud) });
  assert.ok(!overlap(res2.spot, cloud), "not on the painted block");
});

test("never over the newest fifth or the badge, and it does not hop on a small change", () => {
  const badge = { x: PLOT.padL, y: PLOT.padT + PLOT.ih - 80, w: 140, h: 80 };
  const res = placeLens({ plot: PLOT, series: line(() => 90), keepOut: [badge], ink: () => false });
  assert.ok(!overlap(res.spot, badge), "not on the badge");
  assert.ok(res.spot.x + res.spot.w <= tailBox(PLOT).x);
  /* a deck arrow on the left edge: the nearest clear spot to bottom-left, to its right */
  const arrow = { x: -6, y: PLOT.padT + PLOT.ih - 60, w: 26, h: 72 };
  const slid = placeLens({ plot: PLOT, series: line(() => 90), slidePast: [arrow], ink: () => false });
  assert.ok(slid.spot.x >= arrow.x + arrow.w, "right of the arrow");
  /* hold: a spot already held stays unless another is clearly emptier */
  const box = { w: 93, h: 68 };
  const held = { x: PLOT.padL + 120, y: PLOT.padT + 40, ...box };
  const again = emptiestSpot({ plot: PLOT, box, points: pathPoints(PLOT, line(() => 90)), ink: () => false, prev: held });
  assert.equal(again.held, true); assert.equal(again.spot.x, held.x);
  /* a plot too small to hold the box left of the newest fifth: no lens, and the reason */
  const tiny = placeLens({ plot: { ...PLOT, iw: 100, ih: 60 }, series: line(() => 50) });
  assert.equal(tiny.spot, null); assert.match(tiny.why, /smaller than the box/);
  assert.equal(COVER_COST, 0.25);
});

test("the lens-start mark: the chart bar that holds the lens' first candle", () => {
  const days = Array.from({ length: 10 }, (_, i) => ({ d: new Date(Date.UTC(2026, 8, 14 + i * 3)).toISOString(), p: 1 }));
  assert.equal(markIndex(days, Date.UTC(2026, 8, 20, 13)), 2, "inside the third 3-day bar");
  assert.equal(markIndex(days, Date.UTC(2026, 8, 1)), -1, "before the chart: no mark");
});

/* a fake 2D context that records every font it is given */
function recorder() {
  const fonts = [], texts = [];
  const ctx = new Proxy({}, {
    get(target, k) {
      if (k === "measureText") return (s) => ({ width: String(s).length * 4.8 });
      if (k === "fillText") return (s) => texts.push({ s, font: target.font });
      if (k in target) return target[k];
      return () => {};
    },
    set(target, k, v) { target[k] = v; if (k === "font") fonts.push(v); return true; },
  });
  return { ctx, fonts, texts };
}
function threeSessions() {
  const bars = [];
  for (const d of [23, 24, 25]) for (let k = 0; k < 13; k++) {
    const t = NY(2026, 9, d, "09:30") + k * 1800e3, o = 100 + k, c = k % 2 ? o + 1 : o - 1;
    bars.push({ t, o, h: Math.max(o, c) + 0.5, l: Math.min(o, c) - 0.5, c, v: 1000 });
  }
  return sessionsOf(bars);
}

test("every piece of text is 8 px or more, and under 120 px wide a day label is its weekday alone", () => {
  const sessions = threeSessions(), bars = flatten(sessions);
  const { ctx, fonts, texts } = recorder();
  drawBubble(ctx, { x: 0, y: 0, w: 93, h: 68 }, { bars, sessions, day: "up", symbol: "MU", timeframe: "30M", colour: "bar", volume: false, font: 7 });
  assert.ok(fonts.length >= 2);
  for (const f of fonts) assert.ok(parseFloat(f) >= MIN_FONT, `font ${f}`);
  assert.equal(MIN_FONT, 8);
  const labels = texts.map((t) => t.s);
  assert.ok(labels.includes("WED") && labels.includes("FRI"), `weekday labels (the workshop's drawing), got ${labels.join(" | ")}`);
  assert.ok(!labels.some((s) => /^[A-Z]{3} \d+$/.test(s)), "no day numbers at 93 px");
  assert.ok(!labels.includes("3 SESSIONS"), "the session count drops under 150 px");
  assert.equal(layout({ x: 0, y: 0, w: 93, h: 68 }).tag, null, "the price tag drops under 120 px (the badge already shows price)");
  /* wide enough, the day number comes back */
  const g = candleGeometry(bars, { x: 0, y: 0, w: 300, h: 80 });
  assert.equal(axisTicks(bars, g, sessions)[0].label, "WED 23");
  assert.equal(axisTicks(bars, g, sessions, { weekdayOnly: true })[0].label, "WED");
  /* candles about 2 px apart at this size */
  const small = candleGeometry(bars, layout({ x: 0, y: 0, w: 93, h: 68 }).plot);
  assert.ok(small.slot > 1.8 && small.slot < 2.4, `slot ${small.slot}`);
});

test("the chamfer is 8 px and the bubble's own colours are true greys, none brighter than 210", () => {
  assert.equal(CHAMFER, 8);
  const pts = [];
  const ctx = { beginPath() {}, closePath() {}, moveTo: (x, y) => pts.push([x, y]), lineTo: (x, y) => pts.push([x, y]) };
  framePath(ctx, 93, 68, "bl");
  assert.deepEqual(pts, [[0, 0], [85, 0], [93, 8], [93, 68], [0, 68]], "bottom-left: the top-right corner, facing the chart, is cut");
  for (const [name, hex] of Object.entries(INK)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, `${name} ${hex} is a grey`);
    assert.ok(Math.max(r, g, b) <= 210, `${name} ${hex} is not white`);
  }
});

test("the switch: 4h:12 and 30m:3 on the 3-day and daily charts, nothing otherwise", () => {
  assert.deepEqual(parseBubble("30m:3"), { timeframe: "30m", sessions: 3, key: "30m:3" });
  assert.deepEqual(parseBubble("4h:12"), { timeframe: "4h", sessions: 12, key: "4h:12" });
  for (const bad of ["", null, "30m", "30m:0", "4h:16", "2h:3", "30m:3;x"]) assert.equal(parseBubble(bad), null, String(bad));
  assert.deepEqual([...RANGES], ["3D", "1D"]);
  assert.equal(wanted(parseBubble("4h:12"), "3D"), true);
  assert.equal(wanted(parseBubble("30m:3"), "1D"), true);
  for (const r of ["1W", "3h", "4h"]) assert.equal(wanted(parseBubble("30m:3"), r), false, r);
});

test("the Station's drawing: no ticker, no WED/THU/FRI, commas in prices, the timeframe tag only", () => {
  const sessions = threeSessions(), bars = flatten(sessions).map((b) => ({ ...b, o: b.o * 11, h: b.h * 11, l: b.l * 11, c: b.c * 11 }));
  const { ctx, texts } = recorder();
  drawBubble(ctx, { x: 0, y: 0, w: 160, h: 90 }, { bars, sessions, day: "up", symbol: null, axis: false, timeframe: "4H", colour: "bar", volume: false, font: 8 });
  const labels = texts.map((t) => t.s);
  assert.ok(!labels.includes("MU"), "the badge names the ticker; the lens does not repeat it");
  assert.ok(!labels.some((s) => /^(MON|TUE|WED|THU|FRI)\b/.test(s)), `no day labels, got ${labels.join(" | ")}`);
  assert.ok(labels.includes("4H"));
  assert.ok(labels.some((s) => /^\d{1,3}(,\d{3})+$/.test(s)), `a comma in the last-price tag, got ${labels.join(" | ")}`);
  assert.equal(fmtPrice(1085.02), "1,085"); assert.equal(fmtPrice(30892.4), "30,892"); assert.equal(fmtPrice(485.85), "485.9");
});

test("stale looks stale: bars older than the last session that has opened", () => {
  /* the provider's calendar, as SC_PROVIDER.expectedSettledSession answers it (Labor Day 7 Sep is a holiday) */
  const HOL = ["2026-09-07"];
  const settled = (ms) => {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });
    const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    let d = `${p.year}-${p.month}-${p.day}`;
    const ok = (x) => { const w = new Date(x + "T12:00:00Z").getUTCDay(); return w >= 1 && w <= 5 && !HOL.includes(x); };
    if (ok(d) && +p.hour >= 20) return d;
    for (let i = 0; i < 10; i++) { d = new Date(Date.parse(d + "T12:00:00Z") - 86400e3).toISOString().slice(0, 10); if (ok(d)) return d; }
    return d;
  };
  assert.equal(lastOpenedSession(NY(2026, 9, 27, "13:00"), settled), "2026-09-25", "Sunday: Friday");
  assert.equal(lastOpenedSession(NY(2026, 9, 28, "09:00"), settled), "2026-09-25", "Monday before the open: Friday");
  assert.equal(lastOpenedSession(NY(2026, 9, 28, "10:00"), settled), "2026-09-28", "Monday after the open: Monday");
  assert.equal(lastOpenedSession(NY(2026, 9, 8, "08:00"), settled), "2026-09-04", "the day after Labor Day, before the open: the Friday before");
  assert.equal(lastOpenedSession(NY(2026, 12, 21, "10:00", 5), settled), "2026-12-21", "and in winter time");
  const sessions = threeSessions();          // Wed 23 – Fri 25 Sep
  assert.equal(freshness(sessions, NY(2026, 9, 27, "13:00"), settled).stale, false, "Friday's bars on a Sunday are current");
  const monday = freshness(sessions, NY(2026, 9, 28, "11:00"), settled);
  assert.equal(monday.stale, true, "Friday's bars at 11:00 on Monday are stale");
  assert.equal(monday.label, "FRI 25"); assert.equal(monday.expected, "2026-09-28");
});

test("one read per chart per refresh, under the pane's own load permit, and none on a weekly or intraday range", async () => {
  let reads = 0, permits = 0, redraws = 0, range = "3D", request = "30m:3";
  const rows = threeSessions().flatMap((s) => s.bars).map((b) => ({ timestamp: b.t / 1000, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
  const deps = { request: () => request, range: () => range,
    fetchCandles: async (t, tf, limit) => { reads++; assert.equal(tf, "30"); assert.ok(limit <= 240); return rows; },
    permit: async () => { permits++; return () => {}; }, redraw: () => { redraws++; },
    isNamedAbsence: () => false };
  const host = { isConnected: true, dataset: { t: "LENSTEST" }, _req: "LENSTEST|3D", _transitionGeneration: 0 };
  await Promise.all([ensure(host, deps, host._req, 0), ensure(host, deps, host._req, 0)]);
  await ensure(host, deps, host._req, 0);
  assert.equal(reads, 1, "two at once and one more inside ten minutes: one read");
  assert.equal(permits, 1);
  assert.equal(REFRESH_MS, 600000);
  range = "1W";
  const other = { ...host, dataset: { t: "LENSOTHER" } };
  await ensure(other, deps, host._req, 0);
  assert.equal(reads, 1, "a weekly chart asks for nothing");
  range = "3D"; request = "";
  await ensure(other, deps, host._req, 0);
  assert.equal(reads, 1, "no switch, no read");
});

test("4h on the 3-day pages: the provider's four bars a session, twelve sessions = 48 candles, 52 asked for", () => {
  assert.deepEqual({ ...TIMEFRAMES["4h"] }, { tf: "240", minutes: 240, regular: 1, extended: 4, hours: "extended" });
  assert.equal(barsToRequest("4h", 12), 52);
  const bars = [];
  for (let d = 8; d <= 26; d++) {
    const w = new Date(Date.UTC(2026, 8, d)).getUTCDay(); if (w === 0 || w === 6) continue;
    for (const hm of ["04:00", "08:00", "12:00", "16:00"]) { const t = NY(2026, 9, d, hm); bars.push({ t, o: 10, h: 11, l: 9, c: 10.5, v: 1 }); }
  }
  const all = sessionsOf(bars, "extended"), last = all.slice(-12);
  assert.equal(flatten(last).length, 48, "inside the 40-60 Alan asked for");
  assert.equal(sessionsOf(bars, "regular").flatMap((s) => s.bars).length, all.length, "regular hours alone would keep one bar a day");
});
