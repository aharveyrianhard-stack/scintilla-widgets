/* W5 (22 Oct 2026). Alan, ~19:10 ET: "just as long as you keep the exact same VWAP thing that I have, and … my clouds … these lines
   for previous day high, previous day low, pre-market high, pre-market low … I need it to fucking work."
   live-v1 against his TradingView (read off his layout jFFDn9JS by the coordinator, read-only):
   1. His VWAP: TradingView's, anchored at his session's start (04:00 stocks, 18:00 the CME day on futures), Band #1 = +/- one standard
      deviation (ta.vwap: sqrt(sum(v x hlc3^2)/sum(v) - vwap^2)); the 09:30 line kept, fainter.
   2. His Day Levels: PDH PDL PDO PDC (previous regular session), PMH PML (today 04:00-09:30), OPEN (today 09:30); futures: the previous
      CME session (the provider's daily bar when it has it), no pre-market; names merged where they touch; PDH/PDL heavier.
   3. His clouds V17: the current session's bars carry the averages WITH the current session's close (live while it forms).
   4. Futures: the 18:00-17:00 session, Sunday 18:00 to Friday 17:00, no pre/after shading, the macro quote's own fields.
   5. It must not fail: amber when late, red when stale or not answering (the chart steps back), retries 15 s / 30 s / 60 s, words. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const live = fs.readFileSync(new URL("../station-shells/live-v1/index.html", import.meta.url), "utf8");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
/* one top-level function, exactly: from its line to the first line that is just "}" */
const fn = (name) => grab(live, new RegExp("\\n(?:async )?function " + name + "\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}\\n|\\nfunction " + name + "\\([^)]*\\) \\{[^\\n]*\\}\\n"), name);
const plain = (v) => JSON.parse(JSON.stringify(v));
function api(extra) {
  const src = [
    grab(live, /const ET_FMT = [\s\S]*?hourCycle:"h23" \}\);/, "the New York clock"), grab(live, /const MON = \[[^\]]*\];/, "MON"),
    "const ET_CACHE = new Map();", fn("etParts"),
    grab(live, /const FUTURES = Object\.freeze\(\[[^\]]*\]\);/, "the futures"), fn("isFutures"), fn("sessionDay"), fn("inSession"),
    fn("hlc3"), grab(live, /const VWAP_BAND_MULT = 1;/, "the band's multiplier"), fn("vwapCalc"), fn("vwapSeries"),
    fn("dayLevels"), fn("levelLabels"), fn("ageText"),
    grab(live, /const POLL = Object\.freeze\(\{[^}]*\}\);/, "POLL"), fn("failBackoff"), fn("failureWords"), fn("nextBarRead"), fn("stateText"),
    extra || "",
    "globalThis.out = { etParts, isFutures, sessionDay, inSession, vwapCalc, vwapSeries, dayLevels, levelLabels, failBackoff, failureWords, nextBarRead, stateText, FUTURES };"
  ].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); return ctx.out;
}
const at = (hhmm, day = "2026-10-22") => Date.parse(day + "T" + hhmm + ":00-04:00");
const bar = (hhmm, o, h, l, c, v, day) => ({ t:at(hhmm, day), o, h, l, c, v });

test("W5 · his VWAP: Band #1 is TradingView's one standard deviation, computed here independently", () => {
  const A = api();
  const bars = [bar("04:00", 10, 11, 9, 10.5, 100), bar("04:05", 10.5, 12, 10, 11, 300), bar("09:30", 11, 13, 10.5, 12, 500),
    bar("09:35", 12, 12.5, 11, 11.2, 0), bar("16:00", 11, 11.5, 10.8, 11.1, 50)];
  const r = A.vwapCalc(bars, 300000, "0400", 1);
  let pv = 0, vv = 0, p2v = 0;
  bars.forEach((b, i) => {
    const s = (b.h + b.l + b.c) / 3; if (b.v > 0) { pv += s * b.v; vv += b.v; p2v += s * s * b.v; }
    const w = pv / vv, sd = Math.sqrt(Math.max(p2v / vv - w * w, 0));
    assert.ok(Math.abs(r.vwap[i] - w) < 1e-12, "vwap " + i); assert.ok(Math.abs(r.upper[i] - (w + sd)) < 1e-12, "upper " + i);
    assert.ok(Math.abs(r.lower[i] - (w - sd)) < 1e-12, "lower " + i);
  });
  assert.equal(r.upper[0] - r.vwap[0], 0, "one bar: no spread yet");
  const two = A.vwapCalc(bars, 300000, "0400", 2);
  assert.ok(Math.abs((two.upper[2] - two.vwap[2]) - 2 * (r.upper[2] - r.vwap[2])) < 1e-12, "the multiplier scales the deviation");
  assert.deepEqual(plain(A.vwapSeries(bars, 300000, "0400")), plain(r.vwap), "the line itself is unchanged by the band");
});

test("W5 · his VWAP's anchor: 04:00 on a stock, 18:00 on futures - the CME session, overnight included, reset at 18:00", () => {
  const A = api();
  const cme = [bar("16:55", 100, 100, 100, 100, 10), bar("18:00", 200, 200, 200, 200, 10), bar("23:55", 300, 300, 300, 300, 10),
    bar("03:00", 400, 400, 400, 400, 10, "2026-10-23"), bar("16:55", 500, 500, 500, 500, 10, "2026-10-23"), bar("18:00", 600, 600, 600, 600, 10, "2026-10-23")];
  const v = A.vwapCalc(cme, 300000, "1800", 1).vwap;
  assert.equal(v[0], 100, "the 16:55 bar closes Thursday's session");
  assert.equal(v[1], 200, "18:00 opens Friday's session - a new VWAP");
  assert.equal(v[2], 250); assert.equal(v[3], 300, "past midnight it carries on");
  assert.equal(v[4], 350, "16:55 Friday: the session's last bar");
  assert.equal(v[5], 600, "18:00 Friday opens the next session");
  assert.equal(A.sessionDay(at("18:05"), true), "2026-10-23", "an 18:05 bar on Thursday belongs to Friday's session");
  assert.equal(A.sessionDay(at("16:55"), true), "2026-10-22"); assert.equal(A.sessionDay(at("18:05"), false), "2026-10-22");
  /* the shell picks the anchor by the symbol */
  assert.match(fn("recompute"), /vwapCalc\(S\.bars, TF\.ms, FUT \? "1800" : "0400", VWAP_BAND_MULT\)/);
  assert.deepEqual(plain(A.FUTURES), ["ESUSD", "NQUSD", "CLUSD", "GCUSD", "SIUSD"]);
  assert.equal(A.isFutures("nqusd"), true); assert.equal(A.isFutures("SPY"), false);
});

test("W5 · his Day Levels on a stock: PDH PDL PDO PDC from the previous regular session, PMH PML from today's pre-market, OPEN at 09:30", () => {
  const A = api();
  const y = "2026-10-21";
  const bars = [
    bar("08:00", 270, 279, 269, 271, 10, y),                                   /* yesterday's pre-market: never PD* */
    bar("09:30", 276.86, 277.2, 276.1, 276.5, 10, y), bar("12:00", 276.5, 277.7, 275.3, 276.0, 10, y), bar("15:55", 276.0, 276.6, 275.9, 276.45, 10, y),
    bar("16:30", 276.45, 280, 274, 276, 10, y),                                /* yesterday's after-hours: never PD* */
    bar("04:00", 275.0, 275.2, 274.1, 274.5, 10), bar("09:25", 274.5, 274.9, 273.72, 274.6, 10),
    bar("09:30", 274.81, 275.5, 274.4, 275.0, 10), bar("19:20", 276.6, 276.7, 276.5, 276.62, 10)];
  const L = A.dayLevels(bars, false);
  assert.equal(L.today, "2026-10-22"); assert.equal(L.prev, y);
  assert.deepEqual(plain(Object.fromEntries(L.levels.map((l) => [l.key, l.value]))),
    { PDH:277.7, PDL:275.3, PDO:276.86, PDC:276.45, PMH:275.2, PML:273.72, OPEN:274.81 }, "IWM's own numbers, 22 Oct");
  /* in the pre-market there is no OPEN yet - absent, never guessed */
  const early = A.dayLevels(bars.slice(0, 7), false);
  assert.deepEqual(plain(early.levels.map((l) => l.key)), ["PDH", "PDL", "PDO", "PDC", "PMH", "PML"]);
});

test("W5 · his Day Levels on futures: the previous CME session (the provider's daily bar when it has it), today's 18:00 open, no pre-market", () => {
  const A = api();
  const bars = [bar("18:00", 29984, 29990, 29900, 29950, 10, "2026-10-21"), bar("08:40", 29500, 29993.25, 29038.25, 29200, 10),
    bar("16:55", 29150, 29160, 29140, 29142, 10), bar("18:00", 29112.25, 29120, 29100, 29110, 10), bar("19:10", 29112, 29112, 29092, 29094, 10)];
  const fromBars = A.dayLevels(bars, true);
  assert.equal(fromBars.today, "2026-10-23"); assert.equal(fromBars.prev, "2026-10-22"); assert.equal(fromBars.prevFrom, "5m");
  assert.deepEqual(plain(Object.fromEntries(fromBars.levels.map((l) => [l.key, l.value]))), { PDH:29993.25, PDL:29038.25, PDO:29984, PDC:29142, OPEN:29112.25 });
  /* FMP's 5-minute NQ series had no 08:45 bar on 22 Oct; the daily bar holds the true low */
  const daily = [{ t:Date.parse("2026-10-22T04:00:00Z"), o:29984, h:29993.25, l:29033, c:29142, forming:false }];
  const L = A.dayLevels(bars, true, daily);
  assert.equal(L.prevFrom, "daily");
  assert.deepEqual(plain(Object.fromEntries(L.levels.map((l) => [l.key, l.value]))), { PDH:29993.25, PDL:29033, PDO:29984, PDC:29142, OPEN:29112.25 });
  assert.ok(!L.levels.some((l) => l.key === "PMH" || l.key === "PML"), "a futures session has no pre-market");
});

test("W5 · his labels: names that would touch share one label, highest price first; PDH and PDL heavier", () => {
  const A = api();
  const Y = (v) => 1000 - v;                          /* one pixel per dollar */
  const g = A.levelLabels([{ key:"PDH", value:500 }, { key:"PDC", value:495 }, { key:"PDO", value:450 }, { key:"PDL", value:441 }, { key:"PML", value:300 }], Y, 12);
  assert.deepEqual(plain(g.map((x) => x.text)), ["PDH · PDC", "PDO · PDL", "PML"]);
  assert.match(live, /const LEVEL_STYLE = Object\.freeze\(\{ PDH:\[2, \[\]\], PDL:\[2, \[\]\], PDO:\[1, \[5, 3\]\], PDC:\[1, \[5, 3\]\], PMH:\[1, \[1\.5, 2\.5\]\], PML:\[1, \[1\.5, 2\.5\]\], OPEN:\[1, \[\]\] \}\);/);
  assert.match(fn("draw"), /drawLevels\(ctx, S\.levels, first, last, X, Y, plotW\);/);
  assert.match(fn("draw"), /drawLevelLabels\(ctx, S\.levels, Y, plotW, padT, priceBottom\);/);
  assert.match(fn("recompute"), /S\.levels = dayLevels\(TF\.key === "5m" \? S\.bars : S\.levelBars, FUT, S\.dailyBars\);/, "from 5-minute bars on every intraday width");
});

test("W5 · his clouds V17: the current session's bars carry the averages with the current session's close; futures map into their CME session", () => {
  const map = fn("cloudMapNow"), today = fn("cloudToday");
  assert.match(map, /const times = S\.bars\.map\(\(b\) => FUT && !TF\.daily \? b\.t \+ 6 \* 3600000 : b\.t\);/);
  assert.match(map, /for \(let i = S\.bars\.length - 1; i >= 0 && sessionDay\(S\.bars\[i\]\.t, fut\) === dayNow; i--\) map\[i\] = today;/);
  assert.match(today, /if \(last\.day >= dayNow\) \{ S\.cloudToday = last; return; \}/, "a settled session: its own close");
  assert.match(today, /window\.SC_CLOUDS\.dailyRows\(S\.cloudPts\.concat\(\[\{ d:dayNow \+ "T16:00:00Z", p:live \}\]\)\)/, "a forming one: the live price, through station-clouds.js itself");
  assert.match(today, /sessionDay\(q\.at, fut\) === dayNow \? q\.price : newest\.c/, "only a price of that session; else the newest bar's close");
  /* the painting itself is still chart-v1's byte for byte (pinned in the W2 file) and the arithmetic station-clouds.js */
  assert.match(live, /<script src="\/_indicators\/station-clouds\.js"><\/script>/);
});

test("W5 · futures: Sunday 18:00 to Friday 17:00, a daily 17:00-18:00 break, no pre/after shading, the macro quote's own fields", () => {
  const A = api();
  const f = (iso) => A.inSession(Date.parse(iso), true);
  assert.equal(f("2026-10-22T19:30:00-04:00"), true, "Thursday evening: open");
  assert.equal(f("2026-10-22T17:30:00-04:00"), false, "the daily break");
  assert.equal(f("2026-10-23T16:59:00-04:00"), true); assert.equal(f("2026-10-23T17:00:00-04:00"), false, "Friday 17:00: closed for the weekend");
  assert.equal(f("2026-10-24T12:00:00-04:00"), false, "Saturday"); assert.equal(f("2026-10-25T17:59:00-04:00"), false);
  assert.equal(f("2026-10-25T18:00:00-04:00"), true, "Sunday 18:00: open");
  assert.equal(A.inSession(Date.parse("2026-10-22T21:00:00-04:00"), false), false, "a stock is closed at 21:00 - unchanged");
  assert.equal(A.nextBarRead(at("19:31"), 300000, at("19:20"), 0, false, false, false, true).why, "retry", "futures at 19:31 are in session");
  assert.equal(A.nextBarRead(at("19:31"), 300000, at("19:20"), 0, false, false, false, false).why, "retry", "so is a stock until 20:00");
  assert.equal(A.nextBarRead(at("17:30"), 300000, at("16:55"), 0, false, false, false, true).why, "closed", "the CME break");
  assert.match(fn("draw"), /if \(!TF\.daily && !FUT\) \{/, "no pre/after-market shading on futures");
  assert.match(fn("readQuote"), /const when = q\.observed_at \|\| q\.updated_ts \|\| q\.price_observation_utc, prev = q\.previous_close != null \? q\.previous_close : q\.prev_close;/,
    "a futures row says updated_ts and prev_close");
});

test("W5 · it must not fail: amber when late, red when stale or not answering, the chart steps back; retries 15 s, 30 s, then every 60 s; words", () => {
  const A = api('var S = { loading:false, error:null, errorNamed:false }; var TF = { key:"5m", ms:300000 };');
  const last = { t:at("19:15") };
  assert.equal(A.stateText(at("19:21"), last, null, 1074, false, 0).level, "ok");
  assert.equal(A.stateText(at("19:27"), last, null, 1074, false, 0).level, "late", "the 19:20 bar is overdue");
  const stale = A.stateText(at("19:46"), last, null, 1074, false, 0);
  assert.equal(stale.level, "stale"); assert.match(stale.text, /^<b>stale<\/b> · whole tape · last bar 19:15/);
  const down = A.stateText(at("19:21"), last, null, 1074, false, 2);
  assert.equal(down.level, "down"); assert.match(down.text, /^<b>no reply<\/b> · retrying · whole tape · last bar 19:15/);
  assert.equal(A.stateText(at("19:21"), last, null, 1074, false, 1).level, "late", "one failed read: amber");
  assert.match(A.stateText(at("19:21"), last, null, 1074, true, 0).text, / · CME session 18:00 · /);
  assert.equal(A.stateText(at("21:30"), { t:at("19:55") }, null, 1074, false, 0).level, "ok", "closed hours are not stale");
  assert.deepEqual([1, 2, 3, 4, 9].map(A.failBackoff), [15000, 30000, 60000, 60000, 60000]);
  assert.match(A.failureWords("ZZZZ", "5m", "NOT_SERVED_BY_CHART_API", true), /^ZZZZ is not a symbol the chart API tracks - nothing to draw/);
  assert.match(A.failureWords("SPY", "5m", "provider unreachable: network", false), /did not answer .* trying again$/);
  assert.match(fn("scheduleBars"), /: S\.readFails > 0 \? \{ at:Date\.now\(\) \+ failBackoff\(S\.readFails\), why:"recover" \}/);
  assert.match(fn("pollBars"), /S\.readFails\+\+;/); assert.match(fn("pollBars"), /S\.readFails = 0;/);
  assert.match(live, /#area\[data-level="stale"\] #cv, #area\[data-level="down"\] #cv\{ opacity:\.5; \}/, "the chart steps back");
  assert.match(live, /#strip \.state\[data-level="stale"\] b, #strip \.state\[data-level="down"\] b\{ color:var\(--bear\); \}/);
  assert.match(fn("loadAll"), /const sameChart = S\.bars\.length >= 2 && S\.loadedKey === SYMBOL \+ "\|" \+ TF\.key;/, "a reload after a failure keeps the chart on screen");
});
