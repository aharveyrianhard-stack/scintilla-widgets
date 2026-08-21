import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");
const RECEIPT = "f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1";
const INDICATOR_HASH = "7ad595cc4db5e1fd0bb63bb3780ac1450a938e6fa068df944aeec71445556063";
const ANCHORS = ["AAPL", "MSFT", "NVDA", "MU", "AMZN", "GOOGL", "META", "TSLA"];

function symbols(extra = []) {
  const out = {};
  for (const ticker of [...ANCHORS, ...extra]) out[ticker] = { composite:0.2, trend:0.3, momentum:0.1 };
  for (let i = 0; Object.keys(out).length < 365; i += 1) out[`SYM${String(i).padStart(4, "0")}`] = { composite:0, trend:0, momentum:0 };
  return out;
}

function canonicalRows(map) { return Object.keys(map).map((ticker) => ({ ticker })); }
function response(body, code = 200) {
  return Promise.resolve({ ok:code >= 200 && code < 300, status:code, json:async () => body });
}

function load(fetchImpl, readerImpl) {
  const native = fetchImpl;
  const window = { fetch:native };
  vm.runInNewContext(source, {
    window, fetch:native, Date, Promise, String, Object, Number, parseInt, isFinite,
    encodeURIComponent, JSON, Error, Math, Array, RegExp, console,
    setTimeout, clearTimeout, AbortController,
  });
  if (readerImpl) window.scBindProviderClient(readerImpl);
  return window;
}

function fixtureFetch(map, quoteOverrides = {}) {
  return (url) => {
    const u = String(url);
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
      { t:1724155200000, o:100, h:102, l:99, c:101, v:10 },
      { t:1724068800000, o:98, h:101, l:97, c:100, v:9 },
    ] });
    if (u.includes("/geiger")) return response({
      symbols:map, equalizer_receipt_sha256:RECEIPT,
      computed_utc:"2026-08-20T17:57:20.566Z",
    });
    throw new Error(`unexpected provider URL ${u}`);
  };
}

function indicatorRows(ticker = "AAPL") {
  const specs = [["rsi",14,53.1],["williams",14,-21.0],["ema",5,101],["ema",8,100],
    ["ema",13,99],["ema",21,98],["ema",34,97],["sma",50,96],["sma",100,95],
    ["sma",150,94],["sma",200,93]];
  return specs.map(([indicator,period_length,value]) => ({
    ticker, provider:"FMP", timeframe:"1day", indicator, period_length, value,
    source_date:"2026-08-20 00:00:00", session_state:"FORMING",
    fetched_at:"2026-08-20T18:07:09.756Z", universe_hash:INDICATOR_HASH,
  }));
}

test("the client never intercepts fetch or rewrites pg", () => {
  const nativeFetch = async () => response({});
  const nativePg = async () => [];
  const w = load(nativeFetch);
  w.pg = nativePg;
  w.scBindProviderClient(nativePg);
  assert.equal(w.fetch, nativeFetch);
  assert.equal(w.pg, nativePg);
  assert.equal(typeof w.SC_PROVIDER.equityQuotes, "function");
  assert.equal(w.SC_PROVIDER_SHIM, undefined);
  assert.equal(w.scInstallProviderShim, undefined);
});

test("explicit equity quotes preserve provider previous close, percent and observation time", async () => {
  const map = symbols();
  const w = load(fixtureFetch(map), async () => canonicalRows(map));
  const [row] = await w.SC_PROVIDER.equityQuotes(["AAPL"]);
  assert.equal(row.price, 101);
  assert.equal(row.previous_close, 100);
  assert.equal(row.change_percent, 1);
  assert.equal(row.observed_at, "2026-08-20T18:00:00.000Z");
  assert.equal(row.authority, "MASSIVE_PROVIDER_D_BAR");
});

test("HTTP failure is transport, never named absence or a database fallback", async () => {
  const map = symbols();
  let reads = 0;
  const w = load((url) => String(url).includes("/geiger") ? response({
    symbols:map, equalizer_receipt_sha256:RECEIPT, computed_utc:"2026-08-20T18:00:00Z",
  }) : response(null, 503), async () => { reads += 1; return canonicalRows(map); });
  await assert.rejects(() => w.SC_PROVIDER.equityQuotes(["AAPL"]),
    (error) => error?.scTransport === true && error?.scStatus === 503 && !error?.scAbsence);
  assert.equal(reads, 1, "only the canonical ownership reader ran");
  assert.equal(w.SC_PROVIDER.absenceFor("AAPL"), null);
});

test("ownership is exact identity, not merely 365 names", async () => {
  const map = symbols();
  const wrong = canonicalRows(map).filter((r) => r.ticker !== "AAPL");
  wrong.push({ ticker:"TICK" });
  const w = load(fixtureFetch(map), async () => wrong);
  await assert.rejects(() => w.SC_PROVIDER.equityQuotes(["AAPL"]),
    (error) => error?.scTransport === true && /universe identity/.test(error.message));
  assert.equal(w.SC_PROVIDER.ownership.verified, false);
});

test("a provider-named quote absence stays named and returns no invented row", async () => {
  const map = symbols(["EQR"]);
  const w = load(fixtureFetch(map, { EQR:{ state:"NOT_OBSERVED_BY_STREAM", price:null } }),
    async () => canonicalRows(map));
  const rows = await w.SC_PROVIDER.equityQuotes(["EQR"]);
  assert.deepEqual(Array.from(rows), []);
  assert.equal(w.SC_PROVIDER.absenceFor("EQR"), "NOT_OBSERVED_BY_STREAM");
});

test("an unnamed or short quote payload is retryable transport failure", async () => {
  const map = symbols();
  const w = load((url) => String(url).includes("/geiger") ? response({
    symbols:map, equalizer_receipt_sha256:RECEIPT, computed_utc:"2026-08-20T18:00:00Z",
  }) : response({ quotes:{ AAPL:{ state:"OK", price:null, previous_close:100 } } }),
  async () => canonicalRows(map));
  await assert.rejects(() => w.SC_PROVIDER.equityQuotes(["AAPL"]),
    (error) => error?.scTransport === true && !error?.scAbsence);
  assert.equal(w.SC_PROVIDER.absenceFor("AAPL"), null);
});

test("explicit Geiger carries the endpoint compute time and accepted receipt", async () => {
  const map = symbols();
  const w = load(fixtureFetch(map), async () => canonicalRows(map));
  const [row] = await w.SC_PROVIDER.equityGeiger(["AAPL"]);
  assert.equal(row.updated_ts, "2026-08-20T17:57:20.566Z");
  assert.equal(row.composite, 0.2);
  assert.equal(row.authority, "PROVIDER_EQUALIZER");
  assert.equal(w.SC_PROVIDER.equalizer_accepted, true);
});

test("wrong Equalizer receipt fails ownership and Geiger closed", async () => {
  const map = symbols();
  const w = load(() => response({ symbols:map, equalizer_receipt_sha256:"bad", computed_utc:null }),
    async () => canonicalRows(map));
  await assert.rejects(() => w.SC_PROVIDER.equityGeiger(["AAPL"]),
    (error) => error?.scTransport === true && /equalizer/.test(error.message));
  assert.equal(w.SC_PROVIDER.ownership.verified, false);
});

test("explicit candles normalize provider bars and refuse unmapped timeframes", async () => {
  const map = symbols();
  const w = load(fixtureFetch(map), async () => canonicalRows(map));
  const rows = await w.SC_PROVIDER.equityCandles("AAPL", "5m", { limit:2 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].timestamp, 1724068800);
  assert.equal(rows[1].close, 101);
  assert.equal(rows[0].authority, "PROVIDER_BUILT");
  await assert.rejects(() => w.SC_PROVIDER.equityCandles("AAPL", "bogus"),
    (error) => error?.scAbsence === "TIMEFRAME_NOT_MAPPED");
});

test("raw FMP daily indicators retain FORMING provenance and never synthesize MACD", async () => {
  const map = symbols();
  const reader = async (path) => path.startsWith("tickers?") ? canonicalRows(map) : indicatorRows();
  const w = load(fixtureFetch(map), reader);
  const [row] = await w.SC_PROVIDER.dailyIndicators(["AAPL"]);
  assert.equal(row.rsi14, 53.1);
  assert.equal(row.williams14, -21);
  assert.equal(row.session_state, "FORMING");
  assert.equal(row.source_date, "2026-08-20 00:00:00");
  assert.equal(row.macd, null);
  assert.equal(row.authority, "FMP_PROVIDER_INDICATORS");
});

test("partial raw indicator payload fails rather than painting synthetic values", async () => {
  const map = symbols();
  const reader = async (path) => path.startsWith("tickers?") ? canonicalRows(map) : indicatorRows().slice(0, 2);
  const w = load(fixtureFetch(map), reader);
  await assert.rejects(() => w.SC_PROVIDER.dailyIndicators(["AAPL"]),
    (error) => error?.scTransport === true && /incomplete/.test(error.message));
});

test("the retained non-equity adapter rejects provider symbols", async () => {
  const map = symbols();
  const w = load(fixtureFetch(map), async (path) => path.startsWith("tickers?") ? canonicalRows(map) : []);
  await assert.rejects(() => w.SC_NON_EQUITY.quotes(["AAPL"]),
    (error) => error?.scTransport === true && /refused provider symbols/.test(error.message));
  await assert.rejects(() => w.SC_NON_EQUITY.candles("AAPL", "D"),
    (error) => error?.scTransport === true && /refused provider symbol/.test(error.message));
});

test("all sector spine timeframes are explicit provider tokens", () => {
  const sector = fs.readFileSync(new URL("../templates/sector-rotation.html", import.meta.url), "utf8");
  assert.match(sector, /\{view:'daily',tf:'D'/);
  assert.match(sector, /\{view:'weekly',tf:'W'/);
  assert.match(sector, /\{view:'intra',tf:'5m'/);
  assert.match(sector, /\{view:'intra1',tf:'1m'/);
  assert.doesNotMatch(sector, /rest\/v1\/(?:ohlcv_history|live_quotes|composite_staged|derived_series)/);
});
