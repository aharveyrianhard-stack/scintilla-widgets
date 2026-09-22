/* THE CLOUD RIBBON ON STATION — the arithmetic, the session rules, and the wiring.
   ============================================================================
   The ribbon Alan asked for ("I want the clouds portion, just the clouds, on my station
   charts") is the Indicator Lab's approved one, so the first job of this suite is to prove
   that Station's copy computes exactly what the Lab's Cloud Workshop computes — measured
   against the values the deployed Workshop actually printed for TSLA on 22 Sep 2026.
   The second job is the session contract Alan ruled on in the 18 Sep cloud review: the
   averages stay DAILY-LOCKED on every timeframe, and no bar may show a number that did not
   exist yet while that bar was forming.
   ============================================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../_indicators/station-clouds.js");
const chart = read("../chart/index.html");
const shell = read("../station-shells/chart-v1/index.html");
const deck = read("../deck/index.html");
const context = { Intl, Date, Math, Number, JSON, Array, Object, isFinite, console };
vm.runInNewContext(source, context);
const SC = context.SC_CLOUDS;
/* the module runs in its own realm, so compare its arrays as plain data */
const plain = (value) => JSON.parse(JSON.stringify(value));

/* TSLA's last 260 completed daily closes, straight from the provider's own candle API
   (scintilla-massive-chart-api /candles?symbol=TSLA&tf=D), 9 Sep 2025 → 21 Sep 2026. */
const TSLA = [
  346.97, 347.79, 368.81, 395.94, 410.04, 421.62, 425.86, 416.85, 426.07, 434.21, 425.85, 442.79, 423.39, 440.4,
  443.21, 444.72, 459.46, 436, 429.83, 453.25, 433.09, 438.69, 435.54, 413.49, 435.9, 429.24, 435.15, 428.75,
  439.31, 447.43, 442.6, 438.97, 448.98, 433.72, 452.42, 460.55, 461.51, 440.1, 456.56, 468.37, 444.26, 462.07,
  445.91, 429.52, 445.23, 439.62, 430.6, 401.99, 404.35, 408.92, 401.25, 403.99, 395.23, 391.09, 417.78, 419.4,
  426.58, 430.17, 430.14, 429.24, 446.74, 454.53, 455, 439.58, 445.17, 451.45, 446.89, 458.96, 475.31, 489.88,
  467.26, 483.37, 481.2, 488.73, 485.56, 485.4, 475.19, 459.64, 454.43, 449.72, 438.07, 451.67, 432.96, 431.41,
  435.8, 445.01, 448.96, 447.2, 439.2, 438.57, 437.5, 419.25, 431.44, 449.36, 449.06, 435.2, 430.9, 431.46,
  416.56, 430.41, 421.81, 421.96, 406.01, 397.21, 411.11, 417.32, 425.21, 428.27, 417.07, 417.44, 410.63, 411.32,
  411.71, 411.82, 399.83, 409.38, 417.4, 408.58, 402.51, 403.32, 392.43, 405.94, 405.55, 396.73, 398.68, 399.235,
  407.82, 395.01, 391.2, 395.56, 399.27, 392.78, 380.3, 367.96, 380.85, 383.03, 385.95, 372.11, 361.83, 355.28,
  371.75, 381.26, 360.59, 352.82, 346.65, 343.25, 345.62, 348.95, 352.42, 364.2, 391.95, 388.9, 400.62, 392.5,
  386.42, 387.51, 373.72, 376.3, 378.67, 376.02, 372.8, 381.63, 390.82, 392.51, 389.37, 398.73, 411.79, 428.35,
  445, 433.45, 445.27, 443.3, 422.24, 409.99, 404.11, 417.26, 417.85, 426.01, 433.59, 440.36, 442.1, 435.79,
  415.88, 423.74, 423.7, 418.45, 391, 408.95, 396.68, 381.59, 399.15, 406.43, 411.15, 404.66, 396.38, 400.49,
  405.05, 381.61, 375.53, 375.12, 379.71, 411.84, 420.6, 425.3, 393.45, 419.77, 402.9, 394.06, 406.55, 407.76,
  394.76, 396.18, 394.46, 391.06, 380.84, 369.57, 378.93, 374.01, 319.69, 313.03, 309.22, 307.44, 298.32, 308.85,
  311.21, 322.08, 327.35, 321.55, 319.53, 328.58, 330.88, 332.81, 327.51, 339.96, 342.27, 339.3, 336.87, 351.12,
  345.13, 362.86, 348.95, 350.25, 345.82, 354.81, 348.75, 367.95, 356.09, 357.01, 376.365, 354.08, 368.16, 367.81,
  363.56, 365.44, 358.97, 356.58, 358.08, 366.2, 364.27, 375.3
];
/* One daily bar per weekday, stamped the way the provider stamps them (00:00 New York). */
const SESSION_MS = 86400000;
const dailyPoints = (closes, startISO = "2025-09-09T04:00:00.000Z") => {
  const start = Date.parse(startISO);
  let at = start, day = 0;
  return closes.map((close) => {
    const stamp = at;
    do { at += SESSION_MS; day = new Date(at).getUTCDay(); } while (day === 0 || day === 6);
    return { d: new Date(stamp).toISOString(), p: close };
  });
};

/* The Lab's approved model, transcribed from chart-workshop/model.mjs computeAverages.
   If Station's copy ever drifts from this, the suite says so in numbers. */
function referenceAverages(closes) {
  let e8 = null, e13 = null, e21 = null;
  const sums = { 50:0, 100:0, 200:0 };
  return closes.map((close, i) => {
    e8 = e8 === null ? close : (2 / 9) * close + (1 - 2 / 9) * e8;
    e13 = e13 === null ? close : (2 / 14) * close + (1 - 2 / 14) * e13;
    e21 = e21 === null ? close : (2 / 22) * close + (1 - 2 / 22) * e21;
    const ma = {};
    for (const n of [50, 100, 200]) {
      sums[n] += close;
      if (i >= n) sums[n] -= closes[i - n];
      ma["s" + n] = i + 1 >= n ? sums[n] / n : null;
    }
    return { e8, e13, e21, ...ma };
  });
}

test("the averages are the Lab's averages — measured against what the Cloud Workshop printed", () => {
  const rows = SC.dailyRows(dailyPoints(TSLA));
  assert.equal(rows.length, TSLA.length);
  const round = (value) => Math.round(value * 100) / 100;
  /* The deployed workshop (scintilla-widgets-cfntmj6bw…/chart-workshop/, read 22 Sep 2026)
     labelled TSLA's ribbon with these five numbers. They are the second-newest completed
     session, because the workshop anchors a daily value at the NEXT supplied session and no
     next session exists yet. Station shows the newest completed session instead — the same
     arithmetic, one session less of lag — so both rows are pinned here. */
  const settled = rows.at(-2), newest = rows.at(-1);
  assert.equal(round(settled.e8), 362.18);
  assert.equal(round(settled.e13), 360.71);
  assert.equal(round(settled.e21), 358.13);
  assert.equal(round(settled.s50), 350.25);
  assert.equal(round(settled.s200), 397.33);
  assert.equal(round(newest.e13), 362.8);
  assert.equal(round(newest.e21), 359.69);
  assert.equal(round(newest.s50), 349.6);
  assert.equal(round(newest.s200), 397.06);
  assert.equal(newest.close, 375.3, "the newest completed session is the one Station draws to");
});

test("every row matches an independent run of the approved formula, to the last bit", () => {
  const rows = SC.dailyRows(dailyPoints(TSLA));
  const reference = referenceAverages(TSLA);
  for (let i = 0; i < rows.length; i++) {
    for (const key of ["e8", "e13", "e21"]) {
      if (i < SC.EMA_SEED_WARMUP) { assert.equal(rows[i][key], null, key + " is withheld while the seed still shows"); continue; }
      assert.equal(rows[i][key], reference[i][key], key + " at row " + i);
    }
    for (const key of ["s50", "s100", "s200"]) assert.equal(rows[i][key], reference[i][key], key + " at row " + i);
  }
});

test("a simple average appears only when its whole window exists, and is exact when it does", () => {
  const closes = Array.from({ length:210 }, (_, i) => 100 + i);
  const rows = SC.dailyRows(dailyPoints(closes));
  assert.equal(rows[48].s50, null, "49 closes cannot make a 50-day average");
  assert.equal(rows[49].s50, 100 + 24.5, "the 50th close completes it: mean of 100…149");
  assert.equal(rows[198].s200, null);
  assert.equal(rows[199].s200, 100 + 99.5, "mean of 100…299 over the first complete 200-day window");
});

test("an exponential average seeds on the first close and is withheld until that seed is gone", () => {
  const closes = Array.from({ length:80 }, () => 50);
  closes[0] = 10;                                   /* a seed deliberately far from the truth */
  const rows = SC.dailyRows(dailyPoints(closes));
  assert.equal(rows[0].e13, null, "the first rows are not drawn at all");
  assert.equal(rows[SC.EMA_SEED_WARMUP - 1].e21, null);
  const shown = rows[SC.EMA_SEED_WARMUP].e21;
  assert.ok(Math.abs(shown - 50) < .2, "by the time it is drawn the seed is worth less than a pixel, saw " + shown);
});

test("a transient live tick is never mistaken for a completed session", () => {
  const points = dailyPoints([100, 101, 102]);
  points.push({ d:new Date(Date.parse(points.at(-1).d) + 3600000).toISOString(), p:400, live:true });
  const rows = SC.dailyRows(points);
  assert.equal(rows.length, 3, "the live point is dropped, not averaged");
  assert.deepEqual(plain(rows.map((row) => row.close)), [100, 101, 102]);
});

/* ---- the session contract: which value a bar is allowed to show ---- */
const at = (iso) => Date.parse(iso);
const threeSessions = SC.dailyRows(dailyPoints([100, 110, 120], "2026-09-16T04:00:00.000Z"));

test("an intraday bar shows the last session that had already closed — never its own", () => {
  /* 16, 17 and 18 Sep are the three daily observations; these are 15-minute bars. */
  const bars = [
    at("2026-09-17T13:30:00Z"), at("2026-09-17T19:45:00Z"),
    at("2026-09-18T13:30:00Z"), at("2026-09-18T19:45:00Z"),
    at("2026-09-21T13:30:00Z")
  ];
  const mapped = SC.mapBarsToDaily(bars, threeSessions, SC.timeframeKind("15m"));
  assert.deepEqual(plain(mapped.map((row) => row && row.close)), [100, 100, 110, 110, 120],
    "17 Sep sees 16 Sep's average all day; 18 Sep sees 17 Sep's; only after 18 Sep closes is it used");
});

test("a daily bar shows its own completed session, exactly as TradingView does", () => {
  const bars = threeSessions.map((row) => row.time);
  const mapped = SC.mapBarsToDaily(bars, threeSessions, SC.timeframeKind("1D"));
  assert.deepEqual(plain(mapped.map((row) => row.close)), [100, 110, 120]);
});

test("a weekly bar shows the newest session inside its own week, and never borrows the next one", () => {
  const daily = SC.dailyRows(dailyPoints([10, 11, 12, 13, 14, 15, 16], "2026-09-14T04:00:00.000Z"));
  /* one completed weekly bar, stamped at its Sunday start; the following week is still forming */
  const weekly = [at("2026-09-13T04:00:00Z")];
  const mapped = SC.mapBarsToDaily(weekly, daily, SC.timeframeKind("1W"));
  assert.equal(mapped[0].close, 14, "Friday 18 Sep is the last session of that week");
  const threeDay = SC.mapBarsToDaily([at("2026-09-15T04:00:00Z")], daily, SC.timeframeKind("3D"));
  assert.equal(threeDay[0].close, 13, "a three-day bar (15-17 Sep) stops at 17 Sep, not at the 18th");
});

test("a bar older than every average shows none, rather than the oldest one it can find", () => {
  const mapped = SC.mapBarsToDaily([at("2026-09-10T13:30:00Z")], threeSessions, SC.timeframeKind("1h"));
  assert.equal(mapped[0], null);
});

test("bars that share one session are one run, so a redraw costs one shape per session", () => {
  const bars = [];
  for (const day of ["2026-09-17", "2026-09-18", "2026-09-21"])
    for (const hour of ["13:30", "15:30", "17:30", "19:30"]) bars.push(at(day + "T" + hour + ":00Z"));
  const mapped = SC.mapBarsToDaily(bars, threeSessions, SC.timeframeKind("1h"));
  const runs = SC.runs(mapped, 0, bars.length - 1);
  assert.equal(runs.length, 3, "twelve bars, three sessions, three runs");
  assert.deepEqual(plain(runs.map((run) => [run.from, run.to])), [[0, 3], [4, 7], [8, 11]]);
});

/* ---- the clouds themselves ---- */
const row = (e13, e21, s50, s200) => ({ e13, e21, s50, s200, close:e13, f:e13 >= e21, m:e21 >= s50, o:s50 >= s200 });

test("the three clouds tile the space between the lines exactly once — no hole, no overlap", () => {
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let trial = 0; trial < 400; trial++) {
    const a = row(...Array.from({ length:4 }, () => 100 + random() * 40));
    const b = row(...Array.from({ length:4 }, () => 100 + random() * 40));
    const bands = SC.cloudPolygons(a, b);
    for (const t of [.01, .37, .5, .74, .99]) {
      const value = (band, key) => key === "lo"
        ? band.previousLo + (band.lo - band.previousLo) * ((t - band.t0) / (band.t1 - band.t0))
        : band.previousHi + (band.hi - band.previousHi) * ((t - band.t0) / (band.t1 - band.t0));
      const slice = bands.filter((band) => t >= band.t0 && t <= band.t1)
        .map((band) => [value(band, "lo"), value(band, "hi")])
        .sort((x, y) => x[0] - y[0]);
      const lines = ["e13", "e21", "s50", "s200"].map((key) => a[key] + (b[key] - a[key]) * t).sort((x, y) => x - y);
      assert.ok(slice.length, "a cross-section is always covered");
      assert.ok(Math.abs(slice[0][0] - lines[0]) < 1e-9, "the ribbon starts at the lowest line");
      assert.ok(Math.abs(slice.at(-1)[1] - lines.at(-1)) < 1e-9, "and ends at the highest");
      for (let i = 1; i < slice.length; i++)
        assert.ok(Math.abs(slice[i][0] - slice[i - 1][1]) < 1e-9,
          "each band starts where the last one ended: no hole and no overlap");
    }
  }
});

test("the fastest cloud owns the space it shares with a slower one", () => {
  /* 13 and 21 sit inside the 50/200 span, so that strip belongs to the fast cloud. */
  const only = SC.cloudBands(row(120, 118, 110, 140));
  const fast = only.filter((band) => band.layer === "fast");
  assert.equal(fast.length, 1);
  assert.deepEqual([fast[0].lo, fast[0].hi], [118, 120]);
  for (const band of only.filter((b) => b.layer !== "fast"))
    assert.ok(band.hi <= 118 + 1e-9 || band.lo >= 120 - 1e-9, "no slower band paints over the fast one");
});

test("direction is the only colour: indigo above, neon pink below, and never white", () => {
  const up = SC.cloudBands(row(130, 125, 120, 110));
  const down = SC.cloudBands(row(110, 115, 120, 130));
  assert.ok(up.every((band) => band.bullish && band.color === SC.PALETTE.blue));
  assert.ok(down.every((band) => !band.bullish && band.color === SC.PALETTE.pink));
  assert.equal(SC.PALETTE.blue, "#3455FF");
  assert.equal(SC.PALETTE.pink, "#FF00A8");
  const inks = [...up, ...down].map(SC.cloudInk)
    .concat(SC.SPECS.map((spec) => SC.lineInk(SC.PALETTE.blue, spec.blueOpacity)))
    .concat(SC.SPECS.map((spec) => SC.lineInk(SC.PALETTE.pink, spec.pinkOpacity)));
  for (const ink of inks) {
    const [r, g, b] = ink.match(/\d+/g).map(Number);
    assert.ok(!(r > 200 && g > 200 && b > 200), "no ink washes out to white: " + ink);
  }
});

test("the approved widths and opacities are carried across unchanged", () => {
  assert.deepEqual(plain(SC.SPECS.map((spec) => [spec.label, spec.width, spec.blueOpacity, spec.pinkOpacity, spec.style])), [
    ["8D", .6, 20, 8, "dashed"], ["13D", 1, 26, 10, "solid"], ["21D", 2, 32, 13, "solid"],
    ["50D", 3, 38, 16, "solid"], ["100D", 3, 41, 18.5, "dashed"], ["200D", 4, 44, 21, "solid"]
  ]);
  assert.deepEqual(plain(SC.CLOUD_LAYERS), {
    fast:{ blueOpacity:44, pinkOpacity:22 }, middle:{ blueOpacity:36, pinkOpacity:17 }, slow:{ blueOpacity:26, pinkOpacity:10 }
  });
  /* The four ribbon lines are the default; the two the Lab has not put to Alan stay off. */
  assert.deepEqual(plain(SC.activeSpecs({}).map((spec) => spec.label)), ["13D", "21D", "50D", "200D"]);
  assert.deepEqual(plain(SC.activeSpecs({ ema8:true, sma100:true }).map((spec) => spec.label)),
    ["8D", "13D", "21D", "50D", "100D", "200D"]);
});

test("the price line stays the heaviest thing on the chart", () => {
  for (const barCount of [8, 60, 240, 400]) {
    const scale = SC.displayScale(700, barCount, 2);
    for (const spec of SC.SPECS)
      assert.ok(SC.strokeWidth(spec, scale) < 2, spec.label + " must stay under the 2px price line");
    assert.ok(SC.strokeWidth(SC.SPECS[5], scale) > SC.strokeWidth(SC.SPECS[1], scale),
      "and the hierarchy 13 < 21 < 50 < 200 survives the scaling");
  }
});

test("a name is placed at its own line's height, or not placed at all", () => {
  const measure = (text) => text.length * 5;
  const items = [
    { key:"e13", y:40, value:10, bullish:true, short:"13D", full:"13D (+1.0%)" },
    { key:"e21", y:44, value:11, bullish:true, short:"21D", full:"21D (+2.0%)" },
    { key:"s200", y:200, value:12, bullish:false, short:"200D", full:"200D (−9.0%)" }
  ];
  const placed = SC.placeLabels(items, { left:100, maxRight:260, rowHeight:11, measure });
  assert.equal(placed.length, 3);
  for (const label of placed) assert.equal(label.y, items.find((item) => item.key === label.key).y,
    "a label never moves vertically to make room");
  const crowded = placed.filter((label) => label.key !== "s200");
  assert.ok(crowded.every((label) => label.compact), "two names at the same height go compact");
  assert.ok(crowded[1].x >= crowded[0].x + crowded[0].width, "and step sideways into their own lane");
  const noRoom = SC.placeLabels(items, { left:100, maxRight:112, rowHeight:11, measure });
  assert.deepEqual(plain(noRoom), [], "with no honest room, nothing is printed over the price scale");
});

test("the distance is the move from today's price to the average, signed", () => {
  assert.equal(Math.round(SC.signedPercent(390, 375) * 10) / 10, 4, "a 50-day 4% above price reads +4.0%");
  assert.equal(Math.round(SC.signedPercent(360, 375) * 10) / 10, -4);
  assert.equal(SC.signedPercent(null, 375), null);
  assert.equal(SC.signedPercent(390, 0), null);
});

/* ---- how the chart uses it ---- */
test("both chart surfaces load the ribbon module, and the pinned shell is byte-identical", () => {
  assert.match(chart, /<script src="\/_indicators\/station-clouds\.js"><\/script>/);
  assert.equal(shell, chart, "the deck mounts chart-v1: it must be the same file");
});

test("the ribbon is drawn behind the price, never over it", () => {
  const draw = chart.slice(chart.indexOf("function scChartDraw"), chart.indexOf("function clearChartRetry"));
  const ribbon = draw.indexOf("drawCloudRibbon(ctx");
  const gradient = draw.indexOf("createLinearGradient");
  const priceStroke = draw.indexOf("ctx.strokeStyle = c; ctx.lineWidth = 2");
  assert.ok(ribbon > 0 && gradient > ribbon && priceStroke > ribbon,
    "clouds are painted first, then the price fill and the price line on top");
});

test("the ribbon costs the price chart nothing: it is read after the paint, through the deck's queue", () => {
  const load = chart.slice(chart.indexOf("async function scChartLoad"), chart.indexOf("function applySharedChartView"));
  const ready = load.indexOf('reportChartDataState(host, { history:"ready"');
  const ensure = load.indexOf("ensureCloudDaily(host, t, req, generation)");
  assert.ok(ready > 0 && ensure > ready, "the daily read is asked for only after the price is on screen");
  const ensureFn = chart.slice(chart.indexOf("async function ensureCloudDaily"), chart.indexOf("function setClouds"));
  assert.match(ensureFn, /await acquireChartLoadPermit\(host, req \+ "\|clouds", generation\)/,
    "and it queues behind price reads in the same admission queue");
  assert.match(ensureFn, /paintCloudsFromCache\(host, t\)/, "cache first: a reload paints the ribbon with no request");
  assert.match(ensureFn, /entry\.pts\.length >= CLOUD_DAILY_ENOUGH && Date\.now\(\) - \(entry\.ts \|\| 0\) < CLOUD_REFRESH_MS/,
    "a cached ribbon inside the refresh window is not re-read");
  assert.match(chart, /const CLOUD_REFRESH_MS = 1800000;/, "completed daily bars are re-read at most every 30 minutes");
  assert.match(chart, /host\._cloudAbsence = String/, "a ribbon that cannot be read is recorded, not thrown at the pane");
});

test("drawing never fetches: pan, zoom, hover and a timeframe switch make no request", () => {
  const draw = chart.slice(chart.indexOf("function scChartDraw"), chart.indexOf("function clearChartRetry"));
  assert.doesNotMatch(draw, /ensureCloudDaily|fetchCloudDaily|fetch\(/,
    "the renderer reads no data at all");
  const ribbonFns = chart.slice(chart.indexOf("function drawCloudRibbon"), chart.indexOf("function cloudPercentText"));
  assert.doesNotMatch(ribbonFns, /fetch|postMessage/);
  /* the mapping from bars to sessions is remembered per (series, ribbon, timeframe) */
  assert.match(chart, /if \(cache && cache\.rows === rows && cache\.pts === pts && cache\.range === range\) return cache\.map;/);
});

test("the ribbon is on by default, and one switch drives the whole wall", () => {
  assert.match(chart, /let CLOUDS_ON = QS\.has\("clouds"\) \? QS\.get\("clouds"\) !== "0" : lsGet\(CLOUD_STATE_KEY\) !== "0";/,
    "default ON; ?clouds=0 is the only way a link turns it off");
  assert.match(chart, /const CLOUD_STATE_KEY = "station\.clouds";/);
  assert.match(chart, /if \(typeof d\.clouds === "boolean"\) setClouds\(d\.clouds\);/);
  assert.match(deck, /let CLOUDS = QS\.has\("clouds"\) \? QS\.get\("clouds"\) !== "0" : remembered\("station\.clouds"\) !== "0";/);
  assert.match(deck, /clouds\.id = "cloudsToggle";/);
  assert.match(deck, /clouds\.setAttribute\("aria-label", "Toggle chart clouds"\);/);
  assert.match(deck, /clouds\.setAttribute\("aria-pressed", CLOUDS \? "true" : "false"\);/);
  assert.match(deck, /postMessage\(\{ sc:"chart", clouds:CLOUDS \}, location\.origin\)/,
    "live frames are told directly");
  assert.doesNotMatch(deck, /chartSrc\([^)]*clouds/, "the switch is not part of a frame URL, so nothing reloads");
});

test("a new symbol never inherits the last symbol's ribbon", () => {
  const setTicker = chart.slice(chart.indexOf("function setChartTicker"), chart.indexOf("/* R22 FIX 8"));
  assert.match(setTicker, /host\._cloudRows = null; host\._cloudTicker = null;/);
  assert.match(chart, /if \(!window\.SC_CLOUDS \|\| host\.dataset\.t !== t\) return false;/,
    "a read that lands after the ticker moved on is dropped");
});
