/* Retained non-equity rows must not paint an invented day change, an endless retry, or an
   old line as current. Exercises the real provider client with the same harness shape as
   station-provider-native-client. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");
const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");

const owned = Array.from({ length: 364 }, (_, i) => `SYM${String(i).padStart(4, "0")}`);
const universe = { provider:"MASSIVE", symbols:owned, count:364,
  universe_sha256:"ab8f7965258d939f0a97fbfeac9a271547c258df7a2616aff6ccff746bb5d9d3" };
const response = (body, code = 200) => Promise.resolve({ ok:code >= 200 && code < 300, status:code, json:async () => body });

function load(tables) {
  const fetch = (url) => String(url).includes("/universe") ? response(universe) : response(null, 503);
  const window = { fetch };
  vm.runInNewContext(source, {
    window, fetch, Date, Promise, String, Object, Number, parseInt, isFinite,
    encodeURIComponent, JSON, Error, Math, Array, RegExp, console, setTimeout, clearTimeout, AbortController,
  });
  const paths = [];
  window.scBindProviderClient(async (path) => {
    paths.push(path);
    for (const [prefix, rows] of tables) if (path.startsWith(prefix)) return rows;
    return owned.map((ticker) => ({ ticker }));
  });
  return { window, paths };
}

test("an incoherent retained previous close is withheld; a coherent one is kept", async () => {
  const { window } = load([["live_quotes", [
    { ticker:"CLUSD", price:102.4, change:2.05, chg_pct:1.03, prev_close:81.25, updated_ts:"2026-09-17T03:20:00Z" },
    { ticker:"BTCUSD", price:76352.995, change:1118.022, chg_pct:0.27, prev_close:76144.99, updated_ts:"2026-09-17T03:20:01Z" },
    { ticker:"US10Y", price:4.695, change:null, chg_pct:null, prev_close:null, updated_ts:"2026-08-14T23:33:50Z" },
  ]]]);
  const rows = await window.SC_NON_EQUITY.quotes(["CLUSD", "BTCUSD", "US10Y"]);
  const by = Object.fromEntries(rows.map((r) => [r.ticker, r]));
  assert.equal(by.CLUSD.prev_close, null, "CLUSD's weeks-old previous close must not reach the pane");
  assert.equal(by.CLUSD.chg_pct, null);
  assert.equal(by.CLUSD.prev_close_withheld, "RETAINED_PREV_CLOSE_INCOHERENT");
  assert.equal(by.CLUSD.price, 102.4, "the price itself is carried unchanged");
  assert.equal(by.BTCUSD.prev_close, 76144.99, "a self-consistent row keeps its reference");
  assert.equal(by.US10Y.prev_close, null);
  assert.equal(by.US10Y.prev_close_withheld, undefined, "an already-absent reference is not relabelled");
});

test("an empty filtered retained history read is named; a populated read clears the name", async () => {
  const empty = load([["ohlcv_history", []]]);
  await assert.rejects(() => empty.window.SC_PROVIDER.marketCandles("TICK", "180", { limit:240 }),
    (error) => error.scAbsence === "NO_RETAINED_HISTORY");
  assert.equal(empty.window.SC_PROVIDER.absenceFor("TICK", "180"), "NO_RETAINED_HISTORY");
  assert.equal(empty.window.SC_PROVIDER.absenceFor("TICK"), null, "the quote lane is not named by a history read");
  assert.ok(empty.paths.some((p) => /ohlcv_history\?.*ticker=eq\.TICK&tf=eq\.180/.test(p)));

  const full = load([["ohlcv_history", [{ ticker:"VIX", timestamp:1786730400, close:14.38 }]]]);
  full.window.SC_PROVIDER.noteAbsence("VIX", "180", "NO_RETAINED_HISTORY");
  const rows = await full.window.SC_PROVIDER.marketCandles("VIX", "180", { limit:240 });
  assert.equal(rows.length, 1);
  assert.equal(full.window.SC_PROVIDER.absenceFor("VIX", "180"), null);
});

test("stale series and stale quotes carry a visible date on the pane", () => {
  assert.match(chart, /const CHART_STALE_MS = 4 \* 86400000;/);
  assert.match(chart, /chartStartDate\(pts\[0\]\.d\) \+\s*\n\s*chartStaleSuffix\(pts\[pts\.length - 1\]\.d\)/);
  assert.match(chart, /age > CHART_STALE_MS \? "quote as of " \+ chartStartDate\(at\.toISOString\(\)\)/);
});

test("/pulse reads its mixed macro set through the routed market quote reader", () => {
  const pulse = fs.readFileSync(new URL("../pulse/index.html", import.meta.url), "utf8");
  assert.match(pulse, /SC_PROVIDER\.marketQuotes\(MACRO_SET\.concat\(\["VIX"\]\)\)/);
  assert.doesNotMatch(pulse, /SC_NON_EQUITY\.quotes\(MACRO_SET/,
    "the non-equity adapter refuses provider-owned symbols, so it cannot serve SPY/QQQ");
});

test("the news page prints stored snippets as plain text, exactly as the Hub does", () => {
  const news = fs.readFileSync(new URL("../news/index.html", import.meta.url), "utf8");
  /* the page must convert before escaping, and must still escape */
  assert.match(news, /const snip = stripNewsMarkup\(r\.snippet\);/);
  assert.match(news, /\(snip \? '<span class="sn">' \+ esc\(snip\) \+ "<\/span>" : ""\)/);
  assert.doesNotMatch(news, /esc\(r\.snippet\)/, "the raw stored snippet must not reach the page");
  const fn = news.match(/function stripNewsMarkup\(s\) \{[\s\S]*?\n\}/)[0];
  const stripNewsMarkup = new Function("return " + fn + "; stripNewsMarkup")() ||
    new Function(fn + "; return stripNewsMarkup;")();
  const stored = '<a href="https://news.google.com/rss/articles/ABC?oc=5" target="_blank">SLV - iShares Silver Trust Volatility &amp; Greeks</a>  <font color="#6f6f6f">Finviz</font>';
  const out = stripNewsMarkup(stored);
  assert.doesNotMatch(out, /[<>]/, "no markup survives to the screen");
  assert.doesNotMatch(out, /https?:\/\//, "bare source URLs are dropped, as on the Hub");
  assert.match(out, /SLV - iShares Silver Trust Volatility/);
  assert.equal(stripNewsMarkup(null), "");
  assert.equal(stripNewsMarkup("already plain text"), "already plain text");
});

test("/analytics shows one day's sector ranking, not the whole dated history", () => {
  const a = fs.readFileSync(new URL("../analytics/index.html", import.meta.url), "utf8");
  assert.match(a, /sector_rankings\?select=[^']*&order=date\.desc,rank\.asc&limit=200'/, "newest date first");
  assert.match(a, /const latestDate=S\.sect\[0\]\?S\.sect\[0\]\.date:null;/);
  assert.match(a, /const latest=latestDate\?S\.sect\.filter\(r=>r\.date===latestDate\):S\.sect;/);
  assert.match(a, /const _rows=srt\('sect',latest\.slice\(0,22\)\);/, "the table is built from the latest day only");
  assert.doesNotMatch(a, /order=rank\.asc&limit=100/, "the undated read is gone");
});
