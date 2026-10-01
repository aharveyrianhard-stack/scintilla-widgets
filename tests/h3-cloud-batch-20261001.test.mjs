/* 1 Oct (H3) — one read for a page's clouds: the deck asks /candles-multi for every pane's daily bars, at the limit each pane
   will itself ask for, and files each answer under the url the pane's own read uses. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");
const grab = (src, re) => { const m = src.match(re); assert.ok(m, String(re)); return m[0]; };

test("the deck asks for exactly the daily limit each pane's cloud read uses, on every range and with a slot's own bars", () => {
  const d = new Function(grab(deck, /const DECK_CLOUD_DAYS_PER_BAR = [^\n]*\n/) + grab(deck, /function deckCloudDailyNeed\(range, slotBars\) \{[\s\S]*?\n\}\n/) + "return deckCloudDailyNeed;")();
  const c = new Function(grab(chart, /const CHART_DB_RANGE = [^\n]*\n/) + grab(chart, /const chartInitialLimit = [^\n]*\n/) +
    grab(chart, /const CLOUD_DAILY_LIMIT = [^\n]*\n/) + grab(chart, /const CLOUD_DAILY_MAX = [^\n]*\n/) + grab(chart, /const CLOUD_DAYS_PER_BAR = [^\n]*\n/) +
    grab(chart, /function cloudDailyNeed\(range, limit\) \{[\s\S]*?\n\}\n/) + "return cloudDailyNeed;")();
  for (const r of ["15m", "30m", "1h", "2h", "3h", "4h", "6h", "12h", "1D", "3D", "1W"]) {
    assert.equal(d(r, 0), c(r), r);
    assert.equal(d(r, 1200), c(r, 1200), r + " with ?bars=1200");
  }
  assert.equal(d("1W", 0), 995, "MACRO · WEEK: the 995 daily bars its panes read");
});

test("the batch is filed under each pane's own url, waited on while it is out, and anything it does not bring is read alone", () => {
  assert.match(provider, /S\.candlesMany = function \(symbols, rawTf, limit\)/);
  assert.match(provider, /'\/candles-multi\?symbols=' \+ want\.map\(encodeURIComponent\)\.join\(','\)/);
  assert.match(provider, /candleCachePut\(candleUrl\(sym, tf, bounded\), tf, c\)/, "filed under the single read's url");
  assert.match(provider, /var url = candleUrl\(symbol, tf, bounded\);/, "the single read builds the same url");
  assert.match(provider, /pend \? Promise\.resolve\(pend\)\.then\(function \(\) \{ return candleCacheGet\(url\) \|\| ownRead\(\); \}, ownRead\)/);
  assert.match(provider, /if \(!tf \|\| want\.length < 2\) return Promise\.resolve\(0\);/, "one name: nothing is batched");
  assert.match(deck, /deckCloudPrefetch\(\);   \/\* H3 — the page's clouds in one read/);
  assert.match(deck, /if \(!CLOUDS \|\| !window\.SC_PROVIDER/, "clouds off: nothing is read");
});

test("candlesMany in a sandbox: one request for the names not already held, each filed, a refused one left to its pane", async () => {
  const calls = [];
  const payload = (sym) => ({ symbol: sym, series: [{ t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 }], state: "OK" });
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, AbortController, location: { origin: "https://station.scintillahub.ai", hostname: "station.scintillahub.ai", search: "" },
    fetch: async (url) => { calls.push(String(url)); const u = new URL(url);
      const syms = (u.searchParams.get("symbols") || "").split(",");
      const body = { candles: Object.fromEntries(syms.filter((s) => s !== "NOPE").map((s) => [s, payload(s)])), refused: [{ symbol: "NOPE", status: 404 }] };
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), headers: { get: () => null } }; },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
  ctx.window = ctx; ctx.self = ctx;
  vm.runInContext(provider, ctx);
  const P = ctx.SC_PROVIDER;
  assert.equal(typeof P.candlesMany, "function");
  assert.equal(await P.candlesMany(["VIX"], "D", 995), 0, "one name: nothing sent");
  assert.equal(calls.length, 0);
  const n = await P.candlesMany(["VIX", "US10Y", "NOPE"], "D", 995);
  assert.equal(calls.length, 1); assert.match(calls[0], /\/candles-multi\?symbols=VIX,US10Y,NOPE&tf=D&authority=provider&limit=995$/);
  assert.equal(n, 2, "VIX and US10Y filed; NOPE refused and left to its pane");
  assert.equal(await P.candlesMany(["VIX", "US10Y"], "D", 995), 0, "already held: nothing sent again");
  assert.equal(calls.length, 1);
});
