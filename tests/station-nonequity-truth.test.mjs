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

/* ONE SOURCE (2026-09-22): the retained Supabase price lanes are retired. Macro symbols reach the
   chart API; anything else that is not provider-owned equity is a NAMED absence, never a read. */
function loadApi(handlers) {
  const fetch = (url) => {
    const u = String(url);
    if (u.includes("/universe")) return response(universe);
    for (const [needle, body, code] of handlers) if (u.includes(needle)) return response(body, code);
    return response(null, 503);
  };
  const window = { fetch };
  vm.runInNewContext(source, {
    window, fetch, Date, Promise, String, Object, Number, parseInt, isFinite,
    encodeURIComponent, JSON, Error, Math, Array, RegExp, console, setTimeout, clearTimeout, AbortController,
  });
  const paths = [];
  window.scBindProviderClient(async (path) => { paths.push(path); return owned.map((ticker) => ({ ticker })); });
  return { window, paths };
}

test("the retired quote and candle lanes answer by name and never read a table", async () => {
  const { window, paths } = loadApi([]);
  await assert.rejects(() => window.SC_NON_EQUITY.quotes(["CLUSD", "US10Y"]),
    (error) => error.scAbsence === "SUPABASE_PRICE_PATH_RETIRED");
  await assert.rejects(() => window.SC_NON_EQUITY.candles("VIX", "D"),
    (error) => error.scAbsence === "SUPABASE_PRICE_PATH_RETIRED");
  assert.equal(window.SC_PROVIDER.absenceFor("CLUSD"), "SUPABASE_PRICE_PATH_RETIRED");
  assert.ok(!paths.some((p) => /live_quotes|ohlcv_history/.test(p)), "no retained price table is read");
  assert.equal(window.SC_NON_EQUITY.authority, "RETAINED_SUPABASE_NON_EQUITY_GEIGER_ONLY");
});

test("macro candles come from the chart API with the provider stated; other non-equities are a named absence", async () => {
  const bars = { symbol:"VIX", provider:"FMP", provider_symbol:"^VIX", bar_authority:"PROVIDER_BUILT",
    series:[{ t:1789617600000, o:15, h:16, l:14, c:15.5, v:0 }, { t:1789704000000, o:15.5, h:17, l:15, c:16.4, v:0 }] };
  const { window, paths } = loadApi([["/candles?symbol=VIX&tf=D", bars]]);
  window.SC_PROVIDER.noteAbsence("VIX", "D", "NO_RETAINED_HISTORY");
  const rows = await window.SC_PROVIDER.marketCandles("VIX", "D", { limit:240 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].provider, "FMP", "the provider the API stated travels with the row");
  assert.equal(rows[0].provider_symbol, "^VIX");
  assert.equal(window.SC_PROVIDER.absenceFor("VIX", "D"), null, "a served series clears the old name");
  assert.ok(!paths.some((p) => /ohlcv_history/.test(p)));
  await assert.rejects(() => window.SC_PROVIDER.marketCandles("ESUSD", "D", { limit:240 }),
    (error) => error.scAbsence === "NOT_SERVED_BY_CHART_API");
  assert.equal(window.SC_PROVIDER.absenceFor("ESUSD", "D"), "NOT_SERVED_BY_CHART_API");
});

test("macro quotes are the API's last completed close, stamped with their session; stale series become a named absence", async () => {
  const macro = { provider:"FMP", macro:{
    VIX:{ symbol:"VIX", provider:"FMP", provider_symbol:"^VIX", state:"CURRENT", absence:null,
      quote:{ price:16.4, prev_close:15.5, change:0.9, chg_pct:5.806, session_et:"2026-09-22", price_observation_utc:"2026-09-22T04:00:00.000Z", basis:"FMP_DAILY_CLOSE" } },
    DXY:{ symbol:"DXY", provider:"FMP", provider_symbol:"DX-Y.NYB", state:"FMP_MACRO_SERIES_STALE", absence:"FMP_MACRO_STALE_25_SESSIONS", quote:null } } };
  const { window } = loadApi([["/macro?symbols=", macro]]);
  const rows = await window.SC_PROVIDER.marketQuotes(["VIX", "DXY", "ESUSD"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ticker, "VIX"); assert.equal(rows[0].price, 16.4); assert.equal(rows[0].prev_close, 15.5);
  assert.equal(rows[0].provider, "FMP"); assert.equal(rows[0].price_observation_utc, "2026-09-22T04:00:00.000Z");
  assert.equal(window.SC_PROVIDER.absenceFor("DXY"), "FMP_MACRO_STALE_25_SESSIONS", "a stopped series is loud, not a line");
  assert.equal(window.SC_PROVIDER.absenceFor("ESUSD"), "NOT_SERVED_BY_CHART_API");
  assert.equal(window.SC_PROVIDER.absenceFor("VIX"), null);
});

test("a width the API refuses by name is painted by name, never retried forever", async () => {
  const refusal = { error:"no series", symbol:"VIX", tf:"180", provider:"FMP", state:"FMP_INTERVAL_NOT_SERVED", absence:"FMP_INTERVAL_NOT_SERVED" };
  const { window } = loadApi([["/candles?symbol=VIX&tf=180", refusal, 404]]);
  await assert.rejects(() => window.SC_PROVIDER.marketCandles("VIX", "3h", { limit:240 }),
    (error) => error.scAbsence === "FMP_INTERVAL_NOT_SERVED");
  assert.equal(window.SC_PROVIDER.absenceFor("VIX", "3h"), "FMP_INTERVAL_NOT_SERVED");
  /* an unnamed 503 stays transport: retryable, not a settled answer */
  const outage = loadApi([["/candles?symbol=VIX&tf=D", { error:"daily provider series refresh unavailable", state:"DAILY_REFRESH_UNAVAILABLE" }, 503]]);
  await assert.rejects(() => outage.window.SC_PROVIDER.marketCandles("VIX", "D", { limit:240 }),
    (error) => error.scTransport === true && error.scStatus === 503);
});

test("stale series and stale quotes carry a visible date on the pane", () => {
  assert.match(chart, /const CHART_STALE_MS = 4 \* 86400000;/);
  /* The window label now states its dates (2026-09-21); what this test protects - a stale series
     still carrying a visible date - is unchanged and asserted on the new construction. */
  assert.match(chart, /chartWindowLabel\(pts\) \+ chartStaleSuffix\(pts\[pts\.length - 1\]\.d\)/);
  assert.match(chart, /function chartWindowLabel\(pts\)/);
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

test("/analytics derives P/E from the provider price on the row, never the stored trailing_pe", () => {
  const a = fs.readFileSync(new URL("../analytics/index.html", import.meta.url), "utf8");
  assert.match(a, /pe:livePe\(m,'eps_ttm'\), ape:livePe\(m,'adjusted_eps_ttm'\)/);
  assert.doesNotMatch(a, /pe:m\.f\?m\.f\.trailing_pe:null/, "the stored multiple must not reach the value table");
  assert.doesNotMatch(a, /push\(\{t,pe:m\.f\.trailing_pe\}\)/, "sector comps use the same live multiple");
  assert.match(a, /select=ticker,price,market_cap,trailing_pe,adjusted_pe,eps_ttm,adjusted_eps_ttm,revenue_ttm/, "adjusted EPS is read so the adjusted multiple is live too");
  const fn = a.match(/function livePe\(m,epsField\)\{[\s\S]*?\}\n/)[0];
  const livePe = new Function(fn + "; return livePe;")();
  assert.ok(Math.abs(livePe({ q:{ price:336.13 }, f:{ eps_ttm:8.27 } }, 'eps_ttm') - 336.13 / 8.27) < 1e-12, "same formula: price / EPS");
  assert.equal(livePe({ q:{ price:null }, f:{ eps_ttm:8.27 } }, 'eps_ttm'), null, "no provider price -> no multiple, not a stale one");
  assert.equal(livePe({ q:{ price:336.13 }, f:{ eps_ttm:-1.2 } }, 'eps_ttm'), null, "negative EPS -> undefined ratio");
  assert.equal(livePe({ q:{ price:336.13 }, f:{} }, 'adjusted_eps_ttm'), null);
});

test("/heat sector chips use only the newest day's ranking, never a sector's best rank on any day", () => {
  const h = fs.readFileSync(new URL("../heat/index.html", import.meta.url), "utf8");
  assert.match(h, /sector_rankings\?select=sector_name,rank,score,date&order=date\.desc,rank\.asc&limit=200/);
  assert.match(h, /for \(const rr of latestRanks\(d\.ranks\)\)/);
  const fn = h.match(/function latestRanks\(rows\) \{[\s\S]*?\n\}\n/)[0];
  const latestRanks = new Function(fn + "; return latestRanks;")();
  const rows = [
    { sector_name:"Industrials", rank:1, date:"2026-08-06" }, { sector_name:"Crypto", rank:1, date:"2026-08-19" },
    { sector_name:"Energy", rank:1, date:"2026-09-17" }, { sector_name:"Crypto", rank:7, date:"2026-09-17" },
    { sector_name:"Industrials", rank:10, date:"2026-09-17" },
  ];
  const got = latestRanks(rows);
  assert.deepEqual(got.map((r) => r.sector_name + "#" + r.rank), ["Energy#1", "Crypto#7", "Industrials#10"]);
  assert.deepEqual(latestRanks([]), []);
  assert.deepEqual(latestRanks(null), []);
});

test("oil, gold, silver, bitcoin and the dollar index ask the chart API at every width, including 4h (Alan, 23 Sep)", async () => {
  const cases = [["CLUSD", "4h", "240"], ["GCUSD", "D", "D"], ["SIUSD", "3h", "180"], ["BTCUSD", "1h", "60"], ["DXUSD", "4h", "240"]];
  for (const [sym, range, tf] of cases) {
    const bars = { symbol:sym, provider:"FMP", provider_symbol:sym, bar_authority:"PROVIDER_BUILT",
      series:[{ t:1789617600000, o:70, h:71, l:69, c:70.5, v:0 }, { t:1789632000000, o:70.5, h:72, l:70, c:71.2, v:0 }] };
    const { window, paths } = loadApi([["/candles?symbol=" + sym + "&tf=" + tf, bars]]);
    const rows = await window.SC_PROVIDER.marketCandles(sym, range, { limit:240 });
    assert.equal(rows.length, 2, sym + " " + range + " draws from the chart API");
    assert.equal(rows[0].provider, "FMP");
    assert.ok(paths.every((p) => !/live_quotes|ohlcv_history/.test(p)), "no price table is read for " + sym);
    assert.equal(window.SC_PROVIDER.absenceFor(sym, range), null, sym + " " + range + " is never painted as not served");
  }
});
