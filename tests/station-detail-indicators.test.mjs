/* THE DETAIL VIEW'S FOUR READINGS, CHECKED AGAINST ARITHMETIC DONE BY HAND.
   ============================================================================
   Alan asked for RSI, Williams %R, Stochastic, MACD and the relative-volume batteries on
   one zoomed ticker. Our stores hold none of that combination on an arbitrary timeframe
   (FMP daily has williams but no stochastic and no macd; MASSIVE minute has macd and rsi
   but no williams and no stochastic; relative volume is in no indicator store at all), so
   the detail view computes them from the chart API's bars. That makes the arithmetic OUR
   claim, and this suite is where it is proved — every expected number below is worked out
   in the comment beside it, not taken from the code's own output.

   The test series (18 bars) is deliberately small and regular so the extremes and the
   means can be done on paper:
     closes 100 102 101 103 102 104 103 105 104 106 105 107 106 108 107 109 108 110
     high = close + 1, low = close - 1 for every bar. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const context = { Intl, Date, Math, Number, JSON, Array, Object, isFinite, console };
vm.runInNewContext(read("../station-shells/detail-v1/indicators.js"), context);
const M = context.SC_DETAIL_MATH;

const CLOSES = [100,102,101,103,102,104,103,105,104,106,105,107,106,108,107,109,108,110];
const BARS = CLOSES.map((c, i) => ({ t: Date.UTC(2026, 8, 1) + i * 3600e3, o: c, h: c + 1, l: c - 1, c, v: 1000 }));
const near = (actual, expected, eps, what) =>
  assert.ok(actual != null && Math.abs(actual - expected) < eps,
    `${what}: got ${actual}, expected ~${expected}`);

test("RSI(14) equals the hand-computed Wilder value, then its hand-computed smoothing", () => {
  /* The first 14 changes are +2,-1 repeating: seven gains of 2 (=14) and seven losses of 1 (=7).
     avg gain 14/14 = 1, avg loss 7/14 = 0.5, RS = 2, RSI = 100 - 100/3 = 66.6666…  */
  const rsi = M.rsiSeries(BARS, 14);
  assert.equal(rsi[13], null, "RSI needs 14 changes, so bar 13 cannot have one");
  near(rsi[14], 100 - 100 / 3, 1e-9, "RSI at bar 14");
  /* Bar 15 closes +2: avg gain = (1*13 + 2)/14 = 15/14, avg loss = (0.5*13 + 0)/14 = 6.5/14,
     RS = 15/6.5, RSI = 100 - 100/(1 + 15/6.5) = 69.7674…  */
  near(rsi[15], 100 - 100 / (1 + 15 / 6.5), 1e-9, "RSI at bar 15 (Wilder smoothing)");
});

test("Williams %R(14) equals the hand-computed range position", () => {
  /* Bar 14 looks back over bars 1..14: highest high 109 (bar 13's 108 + 1), lowest low 100
     (bar 2's 101 - 1), close 107.  (109 - 107) / (109 - 100) x -100 = -22.2222…  */
  const w = M.williamsSeries(BARS, 14);
  assert.equal(w[12], null, "not enough bars for a 14-bar window at bar 12");
  near(w[14], -200 / 9, 1e-9, "Williams %R at bar 14");
  /* Bar 13 looks back over bars 0..13: high 109, low 99, close 108 → (109-108)/10 x -100 = -10 */
  near(w[13], -10, 1e-9, "Williams %R at bar 13");
});

test("Stochastic(14,3,3): raw %K, then the two 3-bar means, all by hand", () => {
  const s = M.stochasticSeries(BARS, 14, 3, 3);
  /* raw %K = (close - lowest low) / (highest high - lowest low) x 100
       bar 13: (108 - 99)/(109 - 99) = 90
       bar 14: (107 - 100)/(109 - 100) = 77.7777…
       bar 15: (109 - 100)/(110 - 100) = 90
       bar 16: (108 - 101)/(110 - 101) = 77.7777…
       bar 17: (110 - 101)/(111 - 101) = 90 */
  near(s.raw[13], 90, 1e-9, "raw %K at 13");
  near(s.raw[14], 700 / 9, 1e-9, "raw %K at 14");
  near(s.raw[15], 90, 1e-9, "raw %K at 15");
  near(s.raw[16], 700 / 9, 1e-9, "raw %K at 16");
  near(s.raw[17], 90, 1e-9, "raw %K at 17");
  /* %K is the 3-bar mean of raw: (90 + 77.7778 + 90)/3 = 85.9259…  */
  near(s.k[15], (90 + 700 / 9 + 90) / 3, 1e-9, "%K at 15");
  near(s.k[16], (700 / 9 + 90 + 700 / 9) / 3, 1e-9, "%K at 16");
  /* %D is the 3-bar mean of %K: (85.9259 + 81.8519 + 85.9259)/3 = 84.5679…  */
  const k15 = (90 + 700 / 9 + 90) / 3, k16 = (700 / 9 + 90 + 700 / 9) / 3, k17 = (90 + 700 / 9 + 90) / 3;
  near(s.d[17], (k15 + k16 + k17) / 3, 1e-9, "%D at 17");
  assert.equal(s.d[16], null, "%D cannot exist before three %K values do");
});

test("the EMA is seeded with a simple mean, and MACD's three lines are hand-checkable", () => {
  /* ema(2) of 1,2,3,4: seed = mean(1,2) = 1.5; k = 2/3;
     3*2/3 + 1.5/3 = 2.5; 4*2/3 + 2.5/3 = 3.5 */
  assert.deepEqual(M.emaSeries([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
  /* MACD(2,3,2) of 1..6:
       ema2 = [-, 1.5, 2.5, 3.5, 4.5, 5.5]
       ema3 = [-, -, 2, 3, 4, 5]        (seed mean(1,2,3) = 2, k = 0.5)
       line = ema2 - ema3 = 0.5 from bar 2 on; signal = ema2 of a constant 0.5 = 0.5;
       histogram = 0 */
  const m = M.macdSeries([1, 2, 3, 4, 5, 6].map((c) => ({ c, h: c, l: c, v: 1 })), 2, 3, 2);
  assert.equal(m.line[1], null, "the slow EMA does not exist yet at bar 1");
  for (const i of [2, 3, 4, 5]) near(m.line[i], 0.5, 1e-12, `MACD line at ${i}`);
  near(m.signal[3], 0.5, 1e-12, "signal at 3");
  near(m.histogram[5], 0, 1e-12, "histogram at 5");
  /* On the standard 12/26/9 the line cannot start before bar 25 and the signal before bar 33. */
  const long = Array.from({ length: 40 }, (_, i) => ({ c: 100 + i, h: 101 + i, l: 99 + i, v: 1 }));
  const std = M.macdSeries(long, 12, 26, 9);
  assert.equal(std.line[24], null);
  assert.ok(std.line[25] != null, "MACD line starts at bar 25");
  assert.equal(std.signal[32], null);
  assert.ok(std.signal[33] != null, "the 9-bar signal starts nine bars after the line does");
});

test("a flat window returns nothing rather than a made-up 0, 50 or -100", () => {
  const flat = Array.from({ length: 20 }, (_, i) => ({ t: i * 3600e3, o: 5, h: 5, l: 5, c: 5, v: 10 }));
  assert.equal(M.williamsSeries(flat, 14)[19], null, "%R is undefined when high == low");
  assert.equal(M.stochasticSeries(flat, 14, 3, 3).raw[19], null, "%K is undefined when high == low");
  /* RSI of an unchanging series has no losses at all; Wilder's definition gives 100, and that
     is a real reading, not an invented one. */
  assert.equal(M.rsiSeries(flat, 14)[19], 100);
});

test("no reading looks ahead: a bar's value never changes when later bars arrive", () => {
  const prefix = BARS.slice(0, 16);
  for (const [name, fn] of [["rsi", (b) => M.rsiSeries(b, 14)],
                            ["williams", (b) => M.williamsSeries(b, 14)],
                            ["stochastic %K", (b) => M.stochasticSeries(b, 14, 3, 3).k]]) {
    const whole = fn(BARS), part = fn(prefix);
    assert.deepEqual(part[15], whole[15], `${name} at bar 15 changed when bars 16-17 arrived`);
  }
});

/* ---- relative volume ------------------------------------------------------------- */
/* 14:30Z is 10:30 in New York while the eastern clock is on daylight time, so these bars
   all land in the same intraday slot on four different sessions. */
const atET = (day, hourUTC, min, v) => ({ t: Date.UTC(2026, 8, day, hourUTC, min), o: 1, h: 1, l: 1, c: 1, v });

test("intraday relative volume compares the same time of day, and says which slot", () => {
  const bars = [atET(21, 14, 30, 100), atET(21, 17, 30, 9999),   /* a different slot must not vote */
                atET(22, 14, 30, 200), atET(23, 14, 30, 300), atET(24, 14, 30, 400)];
  const r = M.relativeVolume(bars, "3h", { sessions: 20 });
  assert.equal(r.basis, "time-of-day");
  assert.equal(r.slot, "10:30");
  assert.equal(r.n, 3, "three previous sessions carried a 10:30 bar");
  near(r.average, 200, 1e-9, "average of 100, 200, 300");
  near(r.value, 2, 1e-9, "400 / 200");
  assert.equal(r.thin, true, "three sessions is not the twenty asked for, and says so");
});

test("today's own session never votes in its own average", () => {
  const bars = [atET(24, 14, 30, 50), atET(24, 14, 30, 400)];   /* same session, same slot */
  const r = M.relativeVolume(bars, "3h", { sessions: 20 });
  assert.equal(r.value, null);
  assert.equal(r.reason, "NO_MATCHING_SLOT_IN_HISTORY");
});

test("a daily timeframe says 'daily' instead of pretending to know the time of day", () => {
  const bars = Array.from({ length: 21 }, (_, i) => ({ t: Date.UTC(2026, 8, 1) + i * 86400e3, o: 1, h: 1, l: 1, c: 1,
    v: i === 20 ? 250 : 100 }));
  const r = M.relativeVolume(bars, "1D", { sessions: 20 });
  assert.equal(r.basis, "daily");
  assert.equal(r.n, 20);
  assert.equal(r.thin, false);
  near(r.value, 2.5, 1e-9, "250 / 100");
});

test("readings() answers every panel at once and names what it could not compute", () => {
  const r = M.readings(BARS, "3h", {});
  assert.ok(r.rsi.value != null && r.williams.value != null && r.stochastic.k != null);
  assert.equal(r.macd.line, null, "eighteen bars cannot carry a 26-bar EMA");
  assert.equal(r.macd.need, 34, "and the panel is told how many bars it would take");
  assert.equal(r.relativeVolume.value, null, "these bars are one per hour on one day");
  assert.equal(r.bars, 18);
});
