/* The internals panes are the last TradingView widgets on the wall. This pins the one change
   that lets them become Station charts: TICK, TRIN, advance/decline and CUMTICK are ASKED FOR
   through the chart API like every other series, and a refusal that names itself is treated as
   an answer rather than a hiccup. Until the IBKR lane lands, the answer is SYMBOL_NOT_TRACKED
   and the pane keeps the TradingView chart it shows today. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");
const UNIVERSE_SHA = "ab8f7965258d939f0a97fbfeac9a271547c258df7a2616aff6ccff746bb5d9d3";

const tickers = () => {
  const out = [];
  for (let i = 0; i < 364; i++) out.push(i === 0 ? "AAPL" : `SYM${String(i).padStart(4, "0")}`);
  return out;
};
const ok = (body, code = 200) => Promise.resolve({ ok: code >= 200 && code < 300, status: code, json: async () => body });

function load(candlesAnswer) {
  const asked = [];
  const fetchImpl = (url) => {
    const u = String(url);
    if (u.includes("/universe")) return ok({ provider: "MASSIVE", symbols: tickers().sort(), count: 364, universe_sha256: UNIVERSE_SHA });
    if (u.includes("/candles")) { asked.push(u); return candlesAnswer(u); }
    throw new Error(`unexpected URL ${u}`);
  };
  const window = { fetch: fetchImpl };
  vm.runInNewContext(source, {
    window, fetch: fetchImpl, Date, Promise, String, Object, Number, parseInt, isFinite,
    encodeURIComponent, JSON, Error, Math, Array, RegExp, console, setTimeout, clearTimeout, AbortController, URL, crypto: globalThis.crypto, TextEncoder,
  });
  /* The deck binds a canonical-list reader, so ownership is proved by set comparison rather
     than by recomputing the live universe digest inside a test. */
  window.scBindProviderClient(async () => tickers().map((ticker) => ({ ticker })));
  return { S: window.SC_PROVIDER, asked };
}

const series = () => ok({ provider: "IBKR", provider_symbol: "TICK", bar_authority: "BUILT_FROM_IBKR_MINUTES",
  series: [{ t: 1790170200000, o: 0, h: 120, l: -80, c: 55, v: null }, { t: 1790170260000, o: 55, h: 210, l: 20, c: 180, v: null }] });

test("the internals are asked for through the chart API, not written off in advance", async () => {
  for (const sym of ["TICK", "TRIN", "ADD", "CUMTICK"]) {
    const { S, asked } = load(series);
    assert.equal(S.isInternalSymbol(sym), true, `${sym} must be known as an internal`);
    const rows = await S.marketCandles(sym, "1m", { limit: 10 });
    assert.equal(asked.length, 1, `${sym} must reach /candles`);
    assert.match(asked[0], new RegExp(`symbol=${sym}`));
    assert.equal(rows.length, 2);
    assert.equal(rows[0].provider, "IBKR");
  }
});

test("a chart API that has not started this lane yet is a named answer, not a retry", async () => {
  const { S, asked } = load(() => ok({ error: "no series", symbol: "TICK", state: "SYMBOL_NOT_TRACKED" }, 404));
  await assert.rejects(() => S.marketCandles("TICK", "1m", { limit: 10 }), (err) => {
    assert.equal(err.scAbsence, "SYMBOL_NOT_TRACKED");
    return true;
  });
  assert.equal(asked.length, 1, "asked once and accepted the answer");
  assert.equal(S.absenceFor("TICK", "1m"), "SYMBOL_NOT_TRACKED", "the pane can read the name and say it");
});

test("a refusal that names itself in `absence` still works exactly as before", async () => {
  const { S } = load(() => ok({ error: "no series", absence: "FMP_INTERVAL_NOT_SERVED", state: "FMP_INTERVAL_NOT_SERVED" }, 404));
  await assert.rejects(() => S.marketCandles("VIX", "1D", { limit: 10 }), (err) => err.scAbsence === "FMP_INTERVAL_NOT_SERVED");
});

test("VIX is untouched: it is already a Station series from FMP and must not be bought twice", async () => {
  const { S, asked } = load(series);
  assert.equal(S.isMacroSymbol("VIX"), true);
  assert.equal(S.isInternalSymbol("VIX"), false);
  await S.marketCandles("VIX", "D", { limit: 5 });
  assert.match(asked[0], /symbol=VIX/);
});

test("anything else is still refused without asking", async () => {
  const { S, asked } = load(series);
  await assert.rejects(() => S.marketCandles("PCC", "1m", { limit: 5 }), (err) => err.scAbsence === "NOT_SERVED_BY_CHART_API");
  await assert.rejects(() => S.marketCandles("NOTATHING", "1m", { limit: 5 }), (err) => err.scAbsence === "NOT_SERVED_BY_CHART_API");
  assert.equal(asked.length, 0, "no wasted request for a symbol no lane serves");
});
