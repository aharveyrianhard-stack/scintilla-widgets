/* W2 (22 Oct 2026). Alan, 22 Oct ~17:55 ET: "Our own … chart … from trading live bars from the whole tape … the trading view is
   more delayed … If we can make it, I might not need to draw there." Earlier: "It's not precise enough. I need the bars, I need
   everything."
   station-shells/live-v1 is the house live-bar chart for the WIDGETS wall's two big slots, beside tv-v1 (the free TradingView embed,
   measured by W1 as 15-20 minutes delayed and Cboe One volume only):
   1. Candles and volume from the chart API through the one provider client, intervals 1m 5m 15m 30m 1h 1D, tv-v1's address keys.
   2. VWAP from the full volume, two session anchors (09:30, 04:00), TradingView's hlc3 definition, printed to the cent.
   3. His clouds painted by chart-v1's own code - the copy is pinned byte-identical here - over the same arithmetic file.
   4. Live: the newest bars read 3 s after each close (forming:true skips the client's half-hour bar store), the stream price every
      5 s, the bar still forming drawn chart-v1's way, the age of the last bar on the strip.
   5. It tells the deck SCINTILLA_LIVE_STATE, never tv-v1's SCINTILLA_TV_STATE (the WIDGETS deck re-points a slot to tv-v1 on that). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const live = read("../station-shells/live-v1/index.html");
const chart = read("../station-shells/chart-v1/index.html");
const provider = read("../_provider/provider.js");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fn = (src, name) => grab(src, new RegExp("\\n(?:async )?function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"), name);
const plain = (v) => JSON.parse(JSON.stringify(v));
/* a top-level definition's full text, braces matched past strings and comments - for the byte-identity pins */
function definition(src, head) {
  const at = src.indexOf(head);
  assert.ok(at >= 0, head + " must exist");
  if (!head.startsWith("function ")) return src.slice(at, src.indexOf("\n", at));
  let k = src.indexOf("{", at), depth = 0, quote = null;
  for (; k < src.length; k++) {
    const c = src[k], n = src[k + 1];
    if (quote) { if (c === "\\") { k++; continue; } if (c === quote) quote = null; continue; }
    if (c === "/" && n === "*") { k = src.indexOf("*/", k + 2) + 1; continue; }
    if (c === "/" && n === "/") { k = src.indexOf("\n", k); continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++; else if (c === "}" && --depth === 0) break;
  }
  return src.slice(at, k + 1);
}
function api(extra) {
  const src = [
    grab(live, /const TFS = Object\.freeze\(\[[\s\S]*?\]\);/, "the six intervals"), fn(live, "tfOf"),
    grab(live, /const ET_FMT = [\s\S]*?hourCycle:"h23" \}\);/, "the New York clock"), grab(live, /const MON = \[[^\]]*\];/, "MON"),
    grab(live, /const ET_CACHE = new Map\(\);/, "the clock's cache"), fn(live, "etParts"), fn(live, "inSession"),
    fn(live, "hlc3"), fn(live, "vwapSeries"), fn(live, "fmtPx"), fn(live, "fmtVol"), fn(live, "fmtVwap"), fn(live, "spreadTags"),
    fn(live, "niceStep"), fn(live, "stepDecimals"), fn(live, "ageText"), fn(live, "barsFromRows"), fn(live, "mergeTail"),
    fn(live, "lastCompleted"), fn(live, "formingBucket"), grab(live, /const POLL = Object\.freeze\(\{[^}]*\}\);/, "POLL"),
    fn(live, "nextBarRead"), fn(live, "stateText"), extra || "",
    "globalThis.out = { TFS, tfOf, etParts, inSession, vwapSeries, fmtPx, fmtVol, fmtVwap, spreadTags, niceStep, stepDecimals, ageText, barsFromRows, mergeTail, lastCompleted, formingBucket, POLL, nextBarRead, stateText };"
  ].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); return ctx.out;
}
/* New York 22 Oct 2026 is EDT (UTC-4): hh:mm ET -> ms */
const at = (hhmm, day = "2026-10-22") => Date.parse(day + "T" + hhmm + ":00-04:00");
const bar = (hhmm, o, h, l, c, v, day) => ({ t:at(hhmm, day), o, h, l, c, v });

test("W2 · one client: every bar and price through /_provider/provider.js, his clouds' arithmetic from station-clouds.js, nothing fetched around them", () => {
  const tags = [...live.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(tags, ["/_provider/provider.js", "/_indicators/station-clouds.js"]);
  assert.match(live, /SC_PROVIDER\.marketCandles\(SYMBOL, TF\.api, \{ limit, forming:true \}\)/, "the bars: the provider client's candle product");
  assert.match(live, /SC_PROVIDER\.marketQuotes\(\[sym\]\)/, "the live price: the provider client's quote product");
  assert.match(live, /SC_PROVIDER\.marketCandles\(sym, "1D", \{ limit:need \}\)/, "his clouds' daily closes: the same client chart-v1 reads them through");
  for (const bad of [/fetch\(/, /XMLHttpRequest/, /massive-chart-api/, /supabase/i, /createClient\(/, /WebSocket\(/])
    assert.doesNotMatch(live.replace(/<!--[\s\S]*?-->/g, ""), bad, "no second data path: " + bad);
  assert.match(live, /try \{ scBindProviderClient\(\); \} catch \(_\) \{\}/, "bound like chart-v1: no reader, so ownership is proven from the universe digest");
});

test("W2 · his clouds are chart-v1's own painting code, byte for byte, over the same arithmetic file", () => {
  for (const head of ["const CLOUD_EXTRAS = ", "const cloudSpecOptions = ", "function cloudLineInk(", "function drawCloudRibbon(",
    "function cloudPercentText(", "function drawCloudLabels(", "const CLOUD_LABEL_INK = "]) {
    const mine = definition(live, head), theirs = definition(chart, head);
    assert.equal(mine, theirs, head + " must be chart-v1's text exactly (change both together)");
  }
  assert.ok(definition(live, "function drawCloudRibbon(").length > 4000, "the whole ribbon painter, not a stub");
  /* the map: daily-locked on every intraday width, exactly as chart-v1's cloudMapFor */
  const map = fn(live, "cloudMapNow");
  assert.match(map, /window\.SC_CLOUDS\.timeframeKind\(TF\.daily \? "1D" : "15m"\)/, "every intraday width maps like chart-v1's intraday ranges");
  assert.match(map, /window\.SC_CLOUDS\.mapBarsToDaily\(S\.bars\.map\(\(b\) => b\.t\), S\.cloudRows, kind\)/);
  assert.match(fn(live, "readClouds"), /window\.SC_CLOUDS\.dailyRows\(pts\)/, "the rows are station-clouds.js's own");
  assert.match(fn(live, "readClouds"), /filter\(\(b\) => !b\.forming\)/, "completed daily closes only");
  assert.match(live, /drawCloudRibbon\(ctx, \{ map:cloudMap, start:first, end:last, X, Y, smooth:!CLOUD_STEPS,/);
  /* the switch: station.clouds as chart-v1 reads it; the deck's { sc:"chart", clouds } message; no write inside the deck */
  assert.match(live, /let CLOUDS_ON = QS\.has\("clouds"\) \? QS\.get\("clouds"\) !== "0" : lsGet\(CLOUD_STATE_KEY\) !== "0";/);
  assert.match(fn(live, "setClouds"), /if \(!BARE\) \{ try \{ localStorage\.setItem\(CLOUD_STATE_KEY, CLOUDS_ON \? "1" : "0"\); \} catch \(_\) \{\} \}/);
  assert.match(live, /if \(typeof d\.clouds === "boolean"\) setClouds\(d\.clouds\);/);
  assert.equal((live.match(/localStorage\.setItem\(/g) || []).length, 1, "the clouds key is the only thing this shell ever writes");
});

test("W2 · the address: ?symbol=SPY&tf=5m, and tv-v1's own keys, so a WIDGETS slot changes only its shell's path", () => {
  const A = api();
  assert.deepEqual(plain(A.TFS.map((x) => x.key)), ["1m", "5m", "15m", "30m", "1h", "1D"]);
  assert.deepEqual(plain(A.TFS.map((x) => x.tv)), ["1", "5", "15", "30", "60", "D"], "tv-v1's interval codes, the deck's memory");
  const tvShellIntervals = ["1", "5", "15", "30", "60", "D"];
  for (const code of tvShellIntervals) assert.equal(A.tfOf(code).tv, code);
  for (const [v, key] of [["5m", "5m"], ["1h", "1h"], ["1d", "1D"], ["1D", "1D"], ["60", "1h"], ["D", "1D"], ["", "5m"], [null, "5m"], ["7m", "5m"]])
    assert.equal(A.tfOf(v).key, key, String(v));
  assert.deepEqual(plain(A.TFS.map((x) => x.api)), ["1m", "5m", "15m", "30m", "1h", "1D"]);
  for (const x of A.TFS) assert.ok(new RegExp("'" + x.api + "':'").test(provider), x.api + " is a width the provider client maps");
  assert.match(live, /let SYMBOL = CLEAN\(QS\.get\("symbol"\) \|\| QS\.get\("t"\)\) \|\| "SPY";/);
  assert.match(live, /const N = \/\^\[12\]\$\/\.test\(QS\.get\("n"\) \|\| ""\) \? \+QS\.get\("n"\) : 1;/);
  assert.match(live, /const BARE = QS\.get\("bare"\) === "1";/);
});

test("W2 · VWAP from the full volume: hlc3 x volume over volume, the 04:00 and the 09:30 anchors, reset every New York day", () => {
  const A = api();
  const day = [bar("04:00", 10, 11, 9, 10, 100), bar("04:05", 10, 12, 10, 11, 0), bar("09:25", 11, 11, 11, 11, 50),
    bar("09:30", 12, 13, 11, 12, 200), bar("09:35", 12, 14, 12, 13, 300), bar("15:55", 13, 13, 13, 13, 100),
    bar("16:00", 13, 13, 12, 12, 400), bar("19:55", 12, 12, 12, 12, 10)];
  const next = [bar("04:00", 20, 20, 20, 20, 5, "2026-10-23"), bar("09:30", 30, 30, 30, 30, 5, "2026-10-23")];
  const bars = day.concat(next);
  const v4 = A.vwapSeries(bars, 300000, "0400"), v9 = A.vwapSeries(bars, 300000, "0930");
  const h = (b) => (b.h + b.l + b.c) / 3;
  const cum = (list) => list.reduce((s, b) => s + h(b) * b.v, 0) / list.reduce((s, b) => s + b.v, 0);
  assert.equal(v4[0], 10); assert.equal(v4[1], 10, "a bar with no volume keeps the average where it was");
  assert.equal(v4[4], cum(day.slice(0, 5))); assert.equal(v4[7], cum(day), "04:00 runs to the 19:55 bar");
  assert.ok(Number.isNaN(v9[0]) && Number.isNaN(v9[2]), "09:30 has not started before 09:30");
  assert.equal(v9[3], 12); assert.equal(v9[4], cum(day.slice(3, 5))); assert.equal(v9[5], cum(day.slice(3, 6)));
  assert.ok(Number.isNaN(v9[6]) && Number.isNaN(v9[7]), "the regular session's VWAP stops at 16:00");
  assert.equal(v4[8], 20, "a new day starts again"); assert.equal(v9[9], 30);
  /* the chart API's 1h bars are clock-aligned: the 09:00 bar holds 09:00-10:00 and is the 09:30 anchor's first bar */
  const hourly = [bar("08:00", 1, 1, 1, 1, 10), bar("09:00", 2, 2, 2, 2, 10), bar("15:00", 3, 3, 3, 3, 10), bar("16:00", 4, 4, 4, 4, 10)];
  const vh = A.vwapSeries(hourly, 3600000, "0930");
  assert.ok(Number.isNaN(vh[0])); assert.equal(vh[1], 2); assert.equal(vh[2], 2.5); assert.ok(Number.isNaN(vh[3]));
  assert.match(live, /S\.vw930 = TF\.daily \? \[\] : vwapSeries\(S\.bars, TF\.ms, "0930"\);/, "intraday only; a daily bar is its own session");
});

test("W2 · precise numbers: a price prints exactly the decimals the tape sent; VWAP to the cent; shares to the share", () => {
  const A = api();
  for (const [v, s] of [[764.0373, "764.0373"], [764.13, "764.13"], [764.1, "764.10"], [761.165, "761.165"], [764, "764.00"],
    [1234.5, "1,234.50"], [0.5, "0.5000"], [0.12345, "0.12345"]]) assert.equal(A.fmtPx(v), s, String(v));
  for (const v of [764.0373, 764.2883, 761.165, 708.96, 175.51]) assert.equal(+A.fmtPx(v).replace(/,/g, ""), v, "reads back as the same number");
  assert.equal(A.fmtVwap(763.756738486978), "763.76"); assert.equal(A.fmtVwap(NaN), "—");
  assert.equal(A.fmtVol(5896.6812), "5,897"); assert.equal(A.fmtVol(54033556), "54,033,556");
  assert.equal(A.niceStep(7.2, 18), 0.5); assert.equal(A.stepDecimals(0.25), 2); assert.equal(A.stepDecimals(0.5), 1); assert.equal(A.stepDecimals(1), 0);
  /* tags on the price axis never sit on each other; the live price keeps its own height */
  const placed = A.spreadTags([{ key:"live", y:100, fixed:true }, { key:"vw0400", y:104 }, { key:"vw0930", y:108 }], 15, 0, 500);
  const y = Object.fromEntries(placed.map((t) => [t.key, t.at]));
  assert.equal(y.live, 100);
  assert.ok(Math.abs(y.vw0400 - y.live) >= 15 && Math.abs(y.vw0930 - y.live) >= 15 && Math.abs(y.vw0930 - y.vw0400) >= 15);
});

test("W2 · the series: the provider's rows oldest first, the newest bars replace what they cover, a stale forming bar never stays", () => {
  const A = api();
  const rows = [{ timestamp:1792706400, open:763.99, high:764.59, low:763.75, close:764.24, volume:25772.16, forming:false },
    { timestamp:1792706100, open:763.94, high:764, low:763.94, close:764, volume:1577.95 }];
  const bars = A.barsFromRows(rows);
  assert.deepEqual(plain(bars.map((b) => b.t)), [1792706100000, 1792706400000]);
  assert.deepEqual(plain(bars[1]), { t:1792706400000, o:763.99, h:764.59, l:763.75, c:764.24, v:25772.16, forming:false }, "exactly as served");
  const series = [{ t:1, c:1 }, { t:2, c:2 }, { t:3, c:3 }, { t:4, c:4, forming:true }];
  const merged = A.mergeTail(series, [{ t:3, c:33 }, { t:4, c:4 }, { t:5, c:5, forming:true }]);
  assert.deepEqual(plain(merged.map((b) => b.c)), [1, 2, 33, 4, 5], "bar 3 corrected as served, 4 completed, 5 forming");
  assert.equal(A.lastCompleted(merged).t, 4);
  assert.equal(A.mergeTail(series, [{ t:5, c:5 }], 3).length, 3, "the series is bounded");
  assert.match(fn(live, "pollBars"), /const tail = await readBars\(TF\.daily \? 5 : 24\);/, "a poll reads the newest bars only");
});

test("W2 · the bar still forming, chart-v1's rule: a live price later than the last completed bar's period, never inside it, never in the future", () => {
  const A = api();
  const last = { t:at("18:15"), c:764.35 }, five = 300000, now = at("18:22");
  assert.equal(A.formingBucket(at("18:19"), last, five, false, now), null, "inside 18:15-18:20: not a forming bar");
  assert.equal(A.formingBucket(at("18:21") + 34000, last, five, false, now), at("18:20"), "18:21:34 is the 18:20 bar forming");
  assert.equal(A.formingBucket(at("18:40"), last, five, false, now), null, "a time in the future is a clock problem");
  assert.equal(A.formingBucket(NaN, last, five, false, now), null, "no observation time, nowhere honest to put it");
  const day = { t:Date.parse("2026-10-22T04:00:00Z") };
  assert.equal(A.formingBucket(at("18:21"), day, 86400000, true, now), null, "after hours on a settled day: no phantom bar");
  assert.equal(A.formingBucket(at("09:45", "2026-10-23"), day, 86400000, true, at("09:46", "2026-10-23")), Date.parse("2026-10-23T04:00:00Z"));
  const draw = fn(live, "draw");
  assert.match(draw, /ctx\.setLineDash\(\[4, 3\]\);[\s\S]*ctx\.arc\(x1, Y\(forming\.price\), 3, 0, Math\.PI \* 2\)/, "dashed from the last close, a hollow ring - chart-v1's drawing");
  assert.match(draw, /if \(b\.forming\) \{[\s\S]*?ctx\.setLineDash\(\[3, 2\]\); ctx\.strokeRect/, "the API's forming day (1D) is hollow and dashed");
  assert.match(fn(live, "applyQuoteToFormingDay"), /if \(!TF\.daily \|\| !b \|\| !b\.forming/, "only the forming day moves with the price; a completed bar never does");
});

test("W2 · live: the newest bars 3 s after each close, 15 s retries, quiet and closed hours slow down; the price every 5 s", () => {
  const A = api();
  assert.deepEqual(plain(A.POLL), { quoteMs:5000, lagMs:3000, retryMs:15000, retries:3, quietMs:60000, dailyMs:60000, idleMs:300000 });
  const five = 300000;
  let r = A.nextBarRead(at("18:31"), five, at("18:25"), 0, false, false, false);
  assert.deepEqual(plain(r), { at:at("18:35") + 3000, why:"close" }, "up to date: the next close plus 3 s");
  r = A.nextBarRead(at("18:30") + 3000, five, at("18:20"), 0, false, false, false);
  assert.deepEqual(plain(r), { at:at("18:30") + 18000, why:"retry" }, "the 18:25 bar is not in yet: again in 15 s");
  r = A.nextBarRead(at("18:30") + 48000, five, at("18:20"), 3, false, false, false);
  assert.equal(r.why, "close", "three retries, then the next close");
  assert.equal(A.nextBarRead(at("18:31"), five, at("18:25"), 0, true, false, false).at, at("18:31") + 60000, "quiet: once a minute");
  assert.equal(A.nextBarRead(at("20:00") + 3000, five, at("19:50"), 0, false, false, false).why, "retry", "the 20:00 close is still read");
  assert.equal(A.nextBarRead(at("21:00"), five, at("19:55"), 0, false, false, false).why, "closed");
  assert.equal(A.nextBarRead(at("21:00"), five, at("19:55"), 0, false, false, false).at, at("21:00") + 300000);
  assert.equal(A.nextBarRead(Date.parse("2026-10-24T14:00:00Z"), five, at("19:55"), 0, false, false, false).why, "closed", "Saturday");
  assert.equal(A.nextBarRead(at("11:00"), 86400000, NaN, 0, false, true, true).at, at("11:00") + 60000, "1D in the session: every minute");
  assert.equal(A.nextBarRead(at("18:00"), 86400000, NaN, 0, false, true, false).at, at("18:00") + 300000, "1D after the close, nothing forming");
  assert.match(fn(live, "readBars"), /forming:true/, "the forming read: no half-hour store, max-age 15");
  /* why forming:true - the provider client keeps an intraday series until the next half hour, and its forming path skips that store */
  assert.match(provider, /var cap = \/\^\(D\|3D\|W\|2W\|M\)\$\/\.test\(tfs\) \? 1800000 : \/\^\(1m\|2m\|3m\|5m\|10m\|15\|30\|60\)\$\/\.test\(tfs\) \? HALF_HOUR_MS : 600000;/);
  assert.match(provider, /var cached = forming \? null : candleCacheGet\(url\);/);
  assert.match(live, /setInterval\(\(\) => \{ if \(!S\.loading\) readQuote\(\); \}, POLL\.quoteMs\);/);
});

test("W2 · the age of the last completed bar is always on the strip, narrow slots included", () => {
  const extra = 'var S = { loading:false, error:null }; var TF = TFS[1];';
  const A = api(extra);
  const last = { t:at("18:15") };
  const wide = A.stateText(at("18:21") + 37000, last, { at:at("18:21") + 35000 }, 1074);
  assert.equal(wide.text, "<b>live</b> · whole tape · last bar 18:15 · closed 1 min 37 s ago · price 2 s old");
  assert.equal(A.stateText(at("18:21") + 37000, last, null, 537).text, "<b>live</b> · bar 18:15 · 1 min 37 s");
  assert.equal(A.stateText(at("18:21") + 37000, last, null, 537).late, false);
  assert.equal(A.stateText(at("18:30"), last, null, 1074).late, true, "a bar ten minutes old in the session is late (amber)");
  assert.equal(A.stateText(at("21:30"), { t:at("19:55") }, null, 1074).text, "<b>closed</b> · whole tape · last bar 19:55 · closed 1 h 30 min ago");
  assert.equal(A.ageText(97000), "1 min 37 s"); assert.equal(A.ageText(5400000), "1 h 30 min");
  assert.match(fn(live, "paintStrip"), /stateText\(now, last, q, document\.body\.clientWidth\)/);
  assert.match(live, /setInterval\(paintStrip, 1000\);/, "the age counts every second");
});

test("W2 · it tells the deck its own message, never tv-v1's, and hears the deck's symbol, clouds and interval", () => {
  const tell = fn(live, "tell");
  assert.match(tell, /type:"SCINTILLA_LIVE_STATE", n:N, ticker:SYMBOL, interval:TF\.tv, tf:TF\.key/);
  assert.doesNotMatch(live.replace(/\/\*[\s\S]*?\*\//g, ""), /type:\s*"SCINTILLA_TV_STATE"/, "the WIDGETS deck re-points a slot to tv-v1 when it hears SCINTILLA_TV_STATE");
  assert.match(tell, /if \(window\.parent === window\) return;/);
  assert.match(live, /if \(e\.origin !== location\.origin \|\| !e\.data\) return;/, "same-origin messages only");
  assert.match(live, /if \(d\.ticker\) setSymbol\(d\.ticker\);/);
  assert.match(live, /if \(d\.type === "SCINTILLA_TV_INTERVAL" \|\| d\.type === "SCINTILLA_LIVE_INTERVAL"\) setTf\(d\.interval\);/);
  assert.match(live, /postMessage\(\{ sc:"station-activity", pane:"live-v1-" \+ N, at:now \}, location\.origin\)/, "the deck's self-update never reloads under his hand");
});

test("W2 · the look: dark, candles green up and red down, VWAP in one amber family, the crosshair in the dim ink - no white anywhere", () => {
  const code = live.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const bad of [/#fff\b/i, /#ffffff/i, /\bwhite\b(?!-space)/i, /rgba?\(\s*255\s*,\s*255\s*,\s*255/])
    assert.doesNotMatch(code, bad, "no white: " + bad);
  assert.match(live, /bull:"#00FFA3", bear:"#FF2D55"/, "the Station's green and red");
  assert.match(fn(live, "draw"), /const b = bars\[i\], up = b\.c >= b\.o, x = X\(i\), ink = up \? COL\.bull : COL\.bear;/);
  assert.match(live, /vwap930:"#F2B33D", vwap400:"#B88A35"/);
  assert.match(fn(live, "drawOverlay"), /ctx\.strokeStyle = COL\.dim; ctx\.globalAlpha = \.62; ctx\.lineWidth = \.75;/, "chart-v1's crosshair ink");
  assert.match(live, /--bg:#0A0A0F/);
});
