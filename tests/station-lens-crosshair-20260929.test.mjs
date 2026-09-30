/* S1, 29 Sep: the lens matches the live price; a lens on every scene; the crosshair readout in one fixed
   spot; slow clouds. Alan's words are in each section. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { liveBars } from "../_indicators/station-lens.mjs";

const NY = (y, mo, d, hm, off = 4) => { const [h, m] = hm.split(":").map(Number); return Date.UTC(y, mo - 1, d, h + off, m); };
const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const lens = fs.readFileSync(new URL("../_indicators/station-lens.mjs", import.meta.url), "utf8");

test("the pinned chart shell is the chart, byte for byte", () => {
  assert.equal(shell, chart);
});

/* ---- 1. "I SAW A CONTEXT BAR FOR SPY THAT DIDNT MATCH THE LIVE PRICE OF THE CHART" ---- */
const bar = (hm, o, c, day = 29) => ({ t: NY(2026, 9, day, hm), o, h: Math.max(o, c) + 0.1, l: Math.min(o, c) - 0.1, c, v: 1 });
const q = (price, hm, day = 29) => ({ price, updated_ts: new Date(NY(2026, 9, day, hm)).toISOString() });
const NOW = NY(2026, 9, 29, "14:47");

test("1: a live price in a later bucket forms a new candle, opened at the last close, and it is the newest close", () => {
  const bars = [bar("13:30", 763.5, 763.8), bar("14:00", 763.8, 763.97)];
  const r = liveBars(bars, q(764.8, "14:46:59".slice(0, 5)), { minutes: 30, hours: "extended", nowMs: NOW });
  assert.equal(r.bars.length, 3);
  const f = r.bars[2];
  assert.equal(f.t, NY(2026, 9, 29, "14:30"), "the 14:30 bucket");
  assert.equal(f.o, 763.97); assert.equal(f.c, 764.8); assert.equal(f.h, 764.8); assert.equal(f.l, 763.97);
  assert.equal(f.live, true);
  assert.equal(r.forming.mode, "new");
  assert.equal(bars.length, 2, "the completed bars are never mutated");
});

test("1: tick to tick, a forming candle keeps its open and widens its high and low", () => {
  const bars = [bar("14:00", 763.8, 763.97)];
  const a = liveBars(bars, q(765.2, "14:35"), { minutes: 30, hours: "extended", nowMs: NOW });
  const b = liveBars(bars, q(764.1, "14:40"), { minutes: 30, hours: "extended", nowMs: NOW, carry: a.forming });
  const f = b.bars[b.bars.length - 1];
  assert.equal(f.o, 763.97); assert.equal(f.h, 765.2); assert.equal(f.l, 763.97); assert.equal(f.c, 764.1);
});

test("1: after hours (outside the lens's hours) the live price extends the newest candle", () => {
  /* Alan's SPY, 29 Sep 20:00 ET: the 19:30 bar closed 766.07, the badge said 764.20 */
  const bars = [bar("19:00", 766.0, 766.02), bar("19:30", 765.5, 766.0693)];
  const r = liveBars(bars, { price: 764.2, updated_ts: "2026-09-30T00:00:00.012Z" }, { minutes: 30, hours: "extended", nowMs: NY(2026, 9, 29, "20:30") });
  assert.equal(r.bars.length, 2);
  const f = r.bars[1];
  assert.equal(f.c, 764.2); assert.equal(f.l, 764.2); assert.equal(f.o, 765.5); assert.equal(f.live, true);
  assert.equal(r.forming.mode, "extend");
});

test("1: a 4-hour lens at 14:47 forms the 12:00 candle; a daily lens forms today's", () => {
  const four = liveBars([bar("08:00", 762, 763.3)], q(764.8, "14:46"), { minutes: 240, hours: "extended", nowMs: NOW });
  assert.equal(four.bars[1].t, NY(2026, 9, 29, "12:00"));
  const d = (day, c) => ({ t: NY(2026, 9, day, "00:00"), o: c - 1, h: c + 1, l: c - 2, c, v: 1 });
  const daily = liveBars([d(25, 760), d(28, 765.61)], q(764.8, "14:46"), { minutes: 1440, hours: "allday", nowMs: NOW });
  assert.equal(daily.bars.length, 3);
  assert.equal(daily.bars[2].t, NY(2026, 9, 29, "00:00"), "today's daily bucket");
  assert.equal(daily.bars[2].c, 764.8);
});

test("1: a price older than the newest bar, or stamped in the future, changes nothing; an untimed one extends", () => {
  const bars = [bar("14:00", 763.8, 763.97)];
  assert.equal(liveBars(bars, q(700, "13:59"), { minutes: 30, nowMs: NOW }).bars, bars);
  assert.equal(liveBars(bars, q(700, "18:00"), { minutes: 30, nowMs: NOW }).bars, bars);
  const u = liveBars(bars, { price: 764, updated_ts: null }, { minutes: 30, nowMs: NOW });
  assert.equal(u.bars[0].c, 764);
  assert.equal(liveBars(bars, null).bars, bars);
});

test("1: the pane hands the lens the badge's own quote, and the lens records the price it shows", () => {
  assert.match(chart, /quote: \(host\) => liveQuote\[host && host\.dataset \? host\.dataset\.t : ""\] \|\| null/);
  assert.match(lens, /const live = liveBars\(flatten\(sessionsOf\(entry\.bars, hours\)\), quote,/);
  assert.match(lens, /last: last\.c, lastT:/);
  /* freshness is still judged on completed bars: a forming candle cannot make a stale lens look fresh */
  assert.match(lens, /const fresh = freshness\(done, /);
  /* a tick redraws the lens but does not re-read the chart's pixels to place it again */
  assert.match(lens, /host\._lensPlaced && host\._lensPlaced\.sig === sig/);
});
