/* ADMISSION V2 (27 Sep) — the Station is not a gate.
   Alan: "why does a new ticker have to go through the Station page?" A new admission (420, 468, …) must be
   accepted with NO Station change, while a real disagreement still fails closed: a payload whose digest
   does not match its own symbols, or whose names differ from public.tickers' active equity rows. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createHash } from "node:crypto";

const source = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");
const RECEIPT = "f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1";
const INDICATOR_HASH = "7ad595cc4db5e1fd0bb63bb3780ac1450a938e6fa068df944aeec71445556063";
const ANCHORS = ["AAPL", "MSFT", "NVDA", "MU", "AMZN", "GOOGL", "META", "TSLA"];

function symbols(extra = []) {
  const out = {};
  for (const ticker of [...ANCHORS, ...extra]) out[ticker] = { composite:0.2, trend:0.3, momentum:0.1, daily_rsi14:53.1, daily_rsi_as_of:"2026-08-20T04:00:00.000Z", daily_rsi_state:"AVAILABLE" };
  for (let i = 0; Object.keys(out).length < 364; i += 1) out[`SYM${String(i).padStart(4, "0")}`] = { composite:0, trend:0, momentum:0, daily_rsi14:50, daily_rsi_as_of:"2026-08-20T04:00:00.000Z", daily_rsi_state:"AVAILABLE" };
  return out;
}

function canonicalRows(map) { return Object.keys(map).map((ticker) => ({ ticker })); }
function universePayload(map) {
  return { provider:"MASSIVE", symbols:Object.keys(map).sort(), count:Object.keys(map).length,
    universe_sha256:"ab8f7965258d939f0a97fbfeac9a271547c258df7a2616aff6ccff746bb5d9d3" };
}
function response(body, code = 200) {
  return Promise.resolve({ ok:code >= 200 && code < 300, status:code, json:async () => body });
}

function load(fetchImpl, readerImpl, clock = Date) {
  const native = fetchImpl;
  const window = { fetch:native };
  vm.runInNewContext(source, {
    window, fetch:native, Date:clock, Promise, String, Object, Number, parseInt, isFinite,
    encodeURIComponent, JSON, Error, Math, Array, RegExp, console,
    setTimeout, clearTimeout, AbortController,
    crypto:globalThis.crypto, TextEncoder, Uint8Array,   // the browser's SubtleCrypto, as a real page has it
  });
  if (readerImpl) window.scBindProviderClient(readerImpl);
  return window;
}

function fixtureFetch(map, quoteOverrides = {}) {
  return (url) => {
    const u = String(url);
    if (u.includes("/universe")) return response(universePayload(map));
    if (u.includes("/indicators")) return response(massiveIndicatorPayload());
    if (u.includes("/quotes")) {
      const requested = decodeURIComponent(new URL(u).searchParams.get("symbols") || "").split(",").filter(Boolean);
      const quotes = {};
      for (const ticker of requested) quotes[ticker] = quoteOverrides[ticker] || {
        state:"OK", price:101, previous_close:100,
        price_observation_utc:"2026-08-20T18:00:00.000Z",
      };
      return response({ quotes });
    }
    if (u.includes("/candles")) return response({ series:[
      { t:1724068800000, o:98, h:101, l:97, c:100, v:9 },
      { t:1724155200000, o:100, h:102, l:99, c:101, v:10 },
    ] });
    if (u.includes("/geiger")) return response({
      symbols:map, equalizer_receipt_sha256:RECEIPT,
      computed_utc:"2026-08-20T17:57:20.566Z",
    });
    throw new Error(`unexpected provider URL ${u}`);
  };
}


function indicatorRows(ticker = "AAPL") {
  const specs = [["ema",5,101],["ema",8,100],["ema",13,99],["ema",21,98],["ema",34,97],
    ["sma",50,96],["sma",100,95],["sma",150,94],["sma",200,93],["wma",20,97.5],
    ["dema",20,98.5],["tema",20,99.5],["rsi",14,53.1],["standarddeviation",20,4.2],
    ["williams",14,-21.0],["adx",14,19.0]];
  return specs.map(([indicator,period_length,value]) => ({
    ticker, provider:"FMP", timeframe:"1day", indicator, period_length, value,
    source_date:"2026-08-20 00:00:00", session_state:"FORMING",
    fetched_at:"2026-08-20T18:07:09.756Z", universe_hash:INDICATOR_HASH,
  }));
}

const digestOf = (syms) => createHash("sha256").update(JSON.stringify([...new Set(syms)].sort())).digest("hex");
function grown(n) {
  const map = symbols();
  for (let i = 0; Object.keys(map).length < n; i += 1) map[`NEW${String(i).padStart(4, "0")}`] = { composite:0, trend:0, momentum:0 };
  return map;
}
function honestFetch(map) {
  const base = fixtureFetch(map);
  return (url) => String(url).includes("/universe")
    ? response({ ...universePayload(map), universe_sha256:digestOf(Object.keys(map)) }) : base(url);
}

test("a bigger admitted set is accepted with no Station change (canonical reader bound)", async () => {
  const map = grown(468);
  const w = load(honestFetch(map), async () => canonicalRows(map));
  const [quote] = await w.SC_PROVIDER.equityQuotes(["AAPL"]);
  assert.equal(quote.price, 101);
  assert.equal(w.SC_PROVIDER.ownership.verified, true);
  assert.equal(w.SC_PROVIDER.ownership.count, 468);
});

test("a bigger admitted set is accepted with no canonical reader, by recomputing its digest", async () => {
  const map = grown(420);
  const w = load(honestFetch(map), null);
  await w.SC_PROVIDER.equityQuotes(["AAPL"]).catch(() => null);
  assert.equal(w.SC_PROVIDER.ownership.verified, true, JSON.stringify(w.SC_PROVIDER.ownership));
  assert.match(w.SC_PROVIDER.ownership.identity, /equals the digest the payload claims/);
});

test("a payload whose digest is not its own symbols' digest still fails closed", async () => {
  const map = grown(420);
  const lying = (url) => String(url).includes("/universe")
    ? response({ ...universePayload(map), universe_sha256:"0".repeat(64) }) : fixtureFetch(map)(url);
  const w = load(lying, null);
  await assert.rejects(() => w.SC_PROVIDER.equityQuotes(["AAPL"]), /not the digest the payload claims/);
  assert.equal(w.SC_PROVIDER.ownership.verified, false);
});

test("a split between the chart API and public.tickers still fails closed, with the names", async () => {
  const map = grown(468);
  const hubRows = canonicalRows(map).filter((r) => !r.ticker.startsWith("NEW"));   // Hub rows not yet written
  const w = load(honestFetch(map), async () => hubRows);
  await assert.rejects(() => w.SC_PROVIDER.equityQuotes(["AAPL"]), /universe identity: missing \[\] extra \[NEW0000/);
  assert.equal(w.SC_PROVIDER.ownership.verified, false);
});

test("FMP rows stamped with the identity the Station verified itself are read; unknown ones still are not", async () => {
  const map = grown(420);
  const served = digestOf(Object.keys(map));
  let asked = "";
  const rows = indicatorRows().map((r) => ({ ...r, universe_hash:served }));
  const reader = async (path) => { if (path.startsWith("provider_indicators_current")) asked = path;
    return path.startsWith("tickers?") ? canonicalRows(map) : rows; };
  const w = load(honestFetch(map), reader);
  await w.SC_PROVIDER.equityQuotes(["AAPL"]);
  const [row] = await w.SC_PROVIDER.fmpDailyIndicators(["AAPL"]);
  assert.ok(asked.includes(served), "the query asks for the verified identity");
  assert.equal(row.rsi14, 53.1);
  const foreign = indicatorRows().map((r) => ({ ...r, universe_hash:"1".repeat(64) }));
  const f = load(honestFetch(map), async (path) => path.startsWith("tickers?") ? canonicalRows(map) : foreign);
  await f.SC_PROVIDER.equityQuotes(["AAPL"]);
  await assert.rejects(() => f.SC_PROVIDER.fmpDailyIndicators(["AAPL"]), /violated the accepted FMP contract/);
});

test("no pinned universe size or digest gates ownership any more", () => {
  assert.match(source, /var EXPECTED_EQUITY_UNIVERSE = null;/);
  assert.doesNotMatch(source, /syms\.length !== EXPECTED_EQUITY_UNIVERSE/);
  assert.doesNotMatch(source, /j\.universe_sha256 !== ACCEPTED_UNIVERSE_SHA256/);
});
