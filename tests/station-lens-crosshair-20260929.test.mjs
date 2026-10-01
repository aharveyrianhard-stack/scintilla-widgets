/* S1, 29 Sep: the lens matches the live price; a lens on every scene; the crosshair readout in one fixed
   spot; slow clouds. Alan's words are in each section. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { liveBars, lensFor, lensForRange, parseBubble, freshness, hoursOf, marketOf, RANGES } from "../_indicators/station-lens.mjs";
import { barsToRequest, sessionsOf, TIMEFRAMES } from "../_indicators/lens-bars.mjs";

const NY = (y, mo, d, hm, off = 4) => { const [h, m] = hm.split(":").map(Number); return Date.UTC(y, mo - 1, d, h + off, m); };
const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const lens = fs.readFileSync(new URL("../_indicators/station-lens.mjs", import.meta.url), "utf8");
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const sceneCtx = { globalThis: {} };
vm.runInNewContext(fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8"), sceneCtx);
const scenes = sceneCtx.globalThis.StationScenes;
const liftFrom = (src, name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `declares ${name}`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (depth === 0) break; } }
  return src.slice(start, i + 1);
};

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

/* ---- 2. "THERE IS STILL A TON OF CHARTS WITHOUT A CONTEXT LENS… CONTEXT LENSES FOR SHORT TERM CHARTS ARE
   STILL USEFUL TO SHOW THE ZOOMED OUT VIEW." ---- */
const THIRTEEN = ["wkIndexes", "wkMacro", "macro1D", "scintillas", "macroCrossAsset", "macroIntraday", "intraday4h",
  "intraday1h", "intraday30m", "companyLeadership", "focus2", "internalsFast", "todo"];

test("2: the rule - the lens shows the view the chart cannot", () => {
  for (const r of ["15m", "30m", "1h", "2h", "3h", "4h", "6h", "12h"]) assert.equal(lensForRange(r), "1d:60", r);
  assert.equal(lensForRange("1D"), "30m:3");
  assert.equal(lensForRange("3D"), "4h:12");
  assert.equal(lensForRange("1W"), "1d:20");
  assert.equal(RANGES.length, 11, "every range on the ladder");
  for (const r of RANGES) assert.equal(scenes.lensForRange(r), lensForRange(r), `the deck and the pane agree on ${r}`);
  assert.deepEqual(parseBubble("1d:60"), { timeframe: "1d", sessions: 60, key: "1d:60" });
  assert.equal(parseBubble("1d:4"), null); assert.equal(parseBubble("1d:91"), null);
  assert.equal(TIMEFRAMES["1d"].tf, "D");
  assert.equal(barsToRequest("1d", 60), 65);
  assert.equal(hoursOf("1d", "SPY"), "allday"); assert.equal(hoursOf("1d", "ESUSD"), "allday");
  /* a daily bar is stamped at New York midnight: whole-day hours keep it */
  assert.equal(sessionsOf([{ t: NY(2026, 9, 28, "00:00"), o: 1, h: 1, l: 1, c: 1 }], "allday").length, 1);
});

test("2: the page's lens when it fits the pane's range; that range's lens when the wall's timeframe moved it", () => {
  assert.equal(lensFor("4h:12", "3D").key, "4h:12");
  assert.equal(lensFor("30m:3", "3D").key, "30m:3", "an intraday lens on a 3-day chart still fits (as before)");
  assert.equal(lensFor("4h:12", "1h").key, "1d:60", "a 3-day page switched to 1h: the zoomed-out lens");
  assert.equal(lensFor("1d:60", "1D").key, "30m:3");
  assert.equal(lensFor("1d:60", "1W").key, "1d:60");
  assert.equal(lensFor("", "3D"), null, "no request, no lens");
});

test("2: the thirteen pages that had none now carry one, and all 27 scenes carry one on every slot", () => {
  const at = new Date("2026-09-29T15:00:00Z");
  const presetsCode = [liftFrom(deck, "fixedSceneState"), "({ fixedSceneState })"].join("\n");
  const api = vm.runInNewContext(presetsCode, { SceneModel: scenes, BASKET_OFFSET: 0, familyFor: () => null, Object, Array, String });
  const lensOf = (id) => {
    if (scenes.WORKFLOW_PAGES[id]) return Array.from(scenes.workflowPageState(id, { at }).bubbles);
    const st = api.fixedSceneState(id) || Object.assign({}, scenes.PRESETS[id]);
    const n = Math.max(1, (st.tickers || []).length);
    return st.bubbles ? Array.from(st.bubbles) : Array(n).fill(st.bubble);
  };
  const all = Object.keys(scenes.WORKFLOW_PAGES).concat(["scintillas", "companyLeadership", "focus2", "macroCrossAsset", "internalsFast", "todo"]);
  assert.equal(all.length, 27);
  for (const id of THIRTEEN) assert.ok(all.includes(id));
  for (const id of all) {
    const got = lensOf(id);
    assert.ok(got.length && got.every((b) => parseBubble(b)), `${id}: a lens on every slot (${got})`);
  }
  assert.ok(lensOf("wkIndexes").every((b) => b === "1d:20"));
  assert.ok(lensOf("intraday1h").every((b) => b === "1d:60"));
  assert.ok(lensOf("macroIntraday").every((b) => b === "1d:60"));
  assert.ok(lensOf("macroCrossAsset").every((b) => b === "4h:12"));
  assert.ok(lensOf("scintillas").every((b) => b === "30m:3"));
  assert.deepEqual(lensOf("todo"), ["1d:60", "1d:60", "1d:60", "1d:60", "30m:3", "30m:3"], "TO-DO's two 1D slots get the 1D lens");
  /* the deck: a named page with no per-slot list falls back to its preset's bubble, then its range's lens */
  assert.match(deck, /: named \? SceneModel\.lensForRange\(SLOT_RANGES\[i\] \|\| state\.range \|\| RANGE\) : ""/);
  assert.match(deck, /const named = !\["live", "custom", "cohort", "scratch"\]\.includes\(SCENE\);/);
  assert.match(deck, /bubble: SceneModel\.PRESETS\.scintillas\.bubble/);
});

/* 28 Sep: "DXUSD and US10Y say STALE 3 days"; the 30M lens said STALE before the first bar could exist. */
test("2: a daily lens is never falsely STALE - Monday morning, a late bar, the day after a holiday, futures, crypto, the dollar", () => {
  const day = (d, mo = 9) => ({ day: `2026-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, weekday: "X", dom: d, bars: [{ t: NY(2026, mo, d, "00:00") }] });
  const lensN = { hours: "allday", minutes: 1440, market: "nyse" };
  /* Monday 28 Sep 10:00 ET, newest daily candle Friday 25th */
  assert.equal(freshness([day(24), day(25)], NY(2026, 9, 28, "10:00"), null, lensN).stale, false, "Monday morning");
  /* Tuesday evening, Tuesday's bar not yet published: one session late is not stale */
  assert.equal(freshness([day(28)], NY(2026, 9, 29, "21:30"), null, lensN).stale, false);
  /* two sessions missing (Monday and Tuesday) is stale */
  assert.equal(freshness([day(25)], NY(2026, 9, 29, "21:30"), null, lensN).stale, true);
  /* the day after a holiday, with the provider's calendar: Fri 27 Nov 2026 is a session, Thu 26 Nov is not */
  const holidayCal = (ms) => { const d = new Date(ms - 4 * 3600e3 - 20 * 3600e3).toISOString().slice(0, 10);
    const walk = (x) => { for (;;) { const w = new Date(x + "T12:00:00Z").getUTCDay(); if (w >= 1 && w <= 5 && x !== "2026-11-26") return x; x = new Date(Date.parse(x + "T12:00:00Z") - 864e5).toISOString().slice(0, 10); } };
    return walk(d); };
  assert.equal(freshness([day(25, 11)], NY(2026, 11, 27, "11:00", 5), holidayCal, lensN).stale, false, "Friday after Thanksgiving");
  /* futures and crypto: four calendar days */
  assert.equal(freshness([day(25)], NY(2026, 9, 28, "10:00"), null, { ...lensN, market: "globex" }).stale, false);
  assert.equal(freshness([day(22)], NY(2026, 9, 28, "10:00"), null, { ...lensN, market: "allday" }).stale, true);
  /* the dollar keeps its published hours (P3): stock-day hours and the NYSE calendar, not CME */
  assert.equal(marketOf("DXUSD"), "nyse"); assert.equal(hoursOf("30m", "DXUSD"), "extended");
  assert.equal(marketOf("ESUSD"), "globex"); assert.equal(marketOf("BTCUSD"), "allday"); assert.equal(marketOf("US10Y"), "nyse");
});

/* ---- 3. "it removes the current price label for some reason. i dont like that. and i feel like it should
   appear in same location vertical and horizontal on all charts on that layout. plus the percentage price
   change needs to be bigger." ---- */
const fnFrom = (src, name) => vm.runInNewContext("(" + liftFrom(src, name) + ")");
const readout = fnFrom(chart, "crosshairReadout");
const measure = (text, font) => text.length * 0.6 * parseFloat(font.split(" ")[1]);   // monospace stand-in
const PANES = [
  { name: "8-up 1680", w: 419, h: 277, plotTop: 34, plotBottom: 256 },
  { name: "6-up 1680", w: 559, h: 360, plotTop: 34, plotBottom: 339 },
  { name: "2-up 1680", w: 840, h: 554, plotTop: 34, plotBottom: 533 },
  { name: "phone 390", w: 390, h: 473, plotTop: 34, plotBottom: 452 },
];

test("3: one fixed spot per pane - the plot's bottom-right corner - whatever the crosshair's y or the texts", () => {
  for (const p of PANES) {
    const a = readout(measure, { ...p, priceText: "492.49", pctText: "−3.60%", up: false, scale: 1 });
    const b = readout(measure, { ...p, priceText: "7,012.25", pctText: "+0.28%", up: true, scale: 1 });
    assert.deepEqual(a.box, b.box, `${p.name}: the box does not move`);
    assert.equal(a.box.x + a.box.w, p.w - 1, `${p.name}: right edge on the pane's edge`);
    assert.equal(a.box.y + a.box.h, p.plotBottom - 13, `${p.name}: bottom just above the time tag's row`);
    /* the same relative spot on every pane of a layout: equal panes, equal boxes */
    assert.deepEqual(readout(measure, { ...p, priceText: "68.12", pctText: "+12.4%", up: true, scale: 1 }).box, a.box);
  }
  /* the function takes no crosshair position at all */
  assert.doesNotMatch(liftFrom(chart, "crosshairReadout"), /\bsy\b/);
});

test("3: the percent is the biggest text, bigger than N10's (10.5 px), the price under it", () => {
  for (const p of PANES) {
    const L = readout(measure, { ...p, priceText: "492.49", pctText: "−3.60%", up: false, scale: 1 });
    assert.deepEqual(Array.from(L.lines, (l) => l.text), ["−3.60%", "492.49"]);
    assert.ok(L.pctFont >= 14 && L.pctFont > L.priceFont, `${p.name}: % ${L.pctFont}px > price ${L.priceFont}px`);
    assert.ok(L.lines[0].y < L.lines[1].y, "percent on top, price under it");
    assert.equal(L.lines[0].ink, "bear");
    for (const l of L.lines) assert.ok(measure(l.text, l.font) <= L.box.w - 4, `${p.name}: "${l.text}" fits`);
  }
  assert.equal(readout(measure, { ...PANES[2], priceText: "1", pctText: "+1%", up: true, scale: 1 }).pctFont, 18, "capped at 18 px");
});

test("3: the current-price label stays up while the crosshair is up; lines and time tag kept; the lens keeps out", () => {
  assert.doesNotMatch(chart, /if \(hasLiveQuote && !scrub\)/, "the label is no longer dropped while scrubbing");
  assert.match(chart, /if \(hasLiveQuote\) \{/);
  assert.match(chart, /if \(scrubOn && R && liveTop \+ 12 > R\.y - 1 && liveTop < R\.y \+ R\.h \+ 1\) liveTop = Math\.max\(padT, R\.y - 13\);/);
  assert.match(chart, /ctx\.beginPath\(\); ctx\.moveTo\(sx, padT\); ctx\.lineTo\(sx, padT \+ ih\); ctx\.stroke\(\);/, "vertical line");
  assert.match(chart, /ctx\.beginPath\(\); ctx\.moveTo\(padL, sy\); ctx\.lineTo\(padL \+ iw, sy\); ctx\.stroke\(\);/, "horizontal line");
  assert.match(chart, /const timeText = chHoverTime\(/, "time tag");
  assert.match(chart, /const nowPx = livePriceValue != null \? livePriceValue : dayPx;/, "N10: % from the current price");
  assert.match(lens, /if \(host\._readoutSpot && host\._readoutSpot\.w > 0\) keepOut\.push\(host\._readoutSpot\);/);
  assert.doesNotMatch(chart, /function crosshairLabel\(/);
});

test("3: a top-row pane (sharing the lower pane's time axis) puts the readout where the bottom row does", () => {
  assert.match(chart, /const readoutBottom = SHARED_TIME_AXIS \? padT \+ ih \+ padB - axisBand : padT \+ ih;/);
  assert.equal((chart.match(/plotBottom: readoutBottom/g) || []).length, 2, "the reserved spot and the drawn readout agree");
});

/* ---- 4. "LOADING IS SLOW AND WEIRD ON SOME CLOUDS." ---- */
test("4: one daily read per ticker - the ribbon's read is long enough for the fan's D line and the lens, and shared", async () => {
  /* the shared-read helpers, run against a fake provider */
  const code = ["const cloudDailyCache = new Map(), cloudDailyInflight = new Map();",
    "const CLOUD_DAILY_TF = 'D', CLOUD_DAILY_LIMIT = 400, CLOUD_DAILY_MAX = 6500, CLOUD_REFRESH_MS = 1800000;",
    "function cloudDailyStore() {}",
    liftFrom(chart, "dailyFlightFor"), liftFrom(chart, "sharedDaily"), "async " + liftFrom(chart, "fetchCloudDaily"),
    "({ sharedDaily, fetchCloudDaily })"].join("\n");
  let reads = 0;
  const rows = Array.from({ length: 700 }, (_, i) => ({ timestamp: 1.7e9 + i * 86400, open: 10, high: 11, low: 9, close: 10 + i / 100 }));
  /* the provider layer hands rows back NEWEST FIRST (measured: AVGO's lens read May 2025 and said STALE) */
  const fetchProviderCandles = async (t, tf, limit) => { reads++; await new Promise((r) => setTimeout(r, 20)); return rows.slice(-limit).reverse(); };
  const api = vm.runInNewContext(code, { fetchProviderCandles, Date, Math, Number, Array, Map, Promise, Error, JSON, isFinite });
  /* the ribbon (asking for the fan's 602 too), the fan's D line and the lens, all at once */
  const [ribbon, fan, lensRead] = await Promise.all([api.fetchCloudDaily("SPY", 602), api.sharedDaily("SPY", 602, false), api.sharedDaily("SPY", 65, true)]);
  assert.equal(reads, 1, "three consumers, one read");
  assert.equal(ribbon, fan); assert.equal(fan, lensRead);
  assert.equal(lensRead.rows.length, 602, "the candles are kept for the lens");
  assert.equal(lensRead.rows[lensRead.rows.length - 1].timestamp, rows[rows.length - 1].timestamp, "oldest first: the newest candle is last");
  await api.sharedDaily("SPY", 450, true);
  assert.equal(reads, 1, "a later, shorter ask is served from the finished read");
  await api.sharedDaily("SPY", 900, false);
  assert.equal(reads, 2, "a longer ask reads again");
});

test("4: the ribbon asks for the fan's D line too; the fan's D line and the daily lens go through the shared read", () => {
  assert.match(chart, /function dailyNeedFor\(host\) \{[\s\S]*?return Math\.max\(cloudDailyNeed\(range, host && host\._historyLimit\), fanDailyNeed\(host\)\);/);
  assert.match(chart, /const need = dailyNeedFor\(host\);\n  const covers = entry/);
  /* P7 (1 Oct): the shared read still answers the D line; today's forming day is read beside it */
  assert.match(chart, /if \(tf === "1D"\) \{\n\s+\/\* S1[^\n]*\n\s+const \[daily, tipRows\] = await Promise\.all\(\[sharedDaily\(t, need, false\),/);
  assert.match(chart, /fetchCandles: \(t, tf, limit, tries\) => \{\n\s+if \(tf !== "D"\) return fetchProviderCandles\(t, tf, limit, tries\);/);
  /* the browser copy stays closes-only (the store's size was the 27 Sep slow-cloud cause) */
  assert.match(chart, /const payload = JSON\.stringify\(Object\.assign\(\{ ts:Date\.now\(\), asked:[^}]*\}, cloudPack\(kept\)\)\);/);
  /* NOT L2b's Geiger hold */
  assert.doesNotMatch(chart, /geigerHold|GEIGER_HOLD|waitForSettled/);
});

test("3: the time tag stays readable - a lens it passes under fades back while the crosshair is up", () => {
  assert.match(chart, /host\._scrubTimeTag = \{ x: timeX, y: timeY - 6, w: timeW, h: 12 \};/);
  assert.match(chart, /host\._scrubLabel = null; host\._scrubTimeTag = null;/);
  assert.match(chart, /lensCv\.style\.opacity = under \? "0\.18" : "";/);
});

test("4: no second ribbon read and no ribbon redraw - the daily lens waits for the price; the fan waits for the ribbon", () => {
  assert.match(chart, /const priced = \(\) => !!\(host && host\._series && host\._series\.length >= 2 && host\.dataset\.t === t\);/);
  assert.match(chart, /return wait\(\)\.then\(\(\) => sharedDaily\(t, Math\.max\(limit, dailyNeedFor\(host\)\), true\)\)/);
  assert.match(chart, /host\._ribbonWork = ensureCloudDaily\(host, t, req, generation\);/);
  const fan = liftFrom(chart, "ensureRsiFan");
  assert.ok(fan.indexOf("host._ribbonWork") < fan.indexOf("acquireChartLoadPermit"), "the fan waits before it takes a load permit");
  assert.match(fan, /Promise\.race\(\[ribbon\.catch\(\(\) => null\), new Promise\(\(r\) => setTimeout\(r, 3000\)\)\]\)/, "3 s at most");
});
