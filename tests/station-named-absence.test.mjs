/* STATION-001 — a named absence must stay named.
   =============================================
   Four Station scenes (INDEX NOW, MACRO CROSS-ASSET, INTERNALS FAST, INTERNALS SLOW) are
   built almost entirely from symbols the equity stream does not observe. Before this suite,
   every one of those panes flattened the stream's own settled answer into
   "data delayed · retrying" and then retried it forever.

   The distinction under test is one line wide and is the whole defect:
     a read that FAILED   -> delayed, retry.
     a read that SUCCEEDED and carried nothing -> named absence, paint the name, STOP.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const chartShell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");
const scenes = (() => { const c = { globalThis:{} };
  vm.runInNewContext(fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8"), c);
  return c.globalThis.StationScenes; })();

function fnFrom(source, name, bindings = {}) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}

/* The scenes that reproduce the defect, named so a future edit that moves a symbol between
   them cannot quietly change what this suite covers. */
const NON_EQUITY_SCENES = ["indexNow", "macroCrossAsset", "internalsFast", "internalsSlow"];

test("the four non-equity scenes are still the scenes this defect was reported against", () => {
  for (const id of NON_EQUITY_SCENES) {
    assert.ok(scenes.PRESETS[id], `${id} is a curated scene`);
    assert.ok(scenes.PRESETS[id].tickers.length >= 2, `${id} carries symbols`);
  }
  /* Not one of these symbols is an ordinary listed equity; that is why the equity stream
     has a settled answer for them rather than a slow one. */
  const symbols = NON_EQUITY_SCENES.flatMap((id) => scenes.PRESETS[id].tickers);
  for (const sym of ["ESUSD", "NQUSD", "CLUSD", "US10Y", "VIX", "TICK", "TRIN"])
    assert.ok(symbols.includes(sym), `${sym} is still on one of the four scenes`);
});

test("the chart carries the canonical name and never rewords it", () => {
  assert.match(chart, /const CHART_ABSENCE_NOT_OBSERVED = "NOT_OBSERVED_BY_STREAM";/);
  const label = fnFrom(chart, "chartAbsenceLabel", { CHART_ABSENCE_NOT_OBSERVED:"NOT_OBSERVED_BY_STREAM" });
  assert.equal(label("NOT_OBSERVED_BY_STREAM"), "not observed by stream");
  assert.equal(label("TIMEFRAME_NOT_MAPPED"), "timeframe not mapped");
  /* An unnamed absence still falls back to the canonical name, never to an invented one. */
  assert.equal(label(null), "not observed by stream");
  assert.equal(label(""), "not observed by stream");
  /* The name is rendered, not replaced: no substitute wording is introduced anywhere. */
  assert.doesNotMatch(chart, /"no data available"|"unavailable · retrying"|"chart unavailable"/i);
});

test("a named absence is a distinct error kind that a delay can never impersonate", () => {
  const make = fnFrom(chart, "chartAbsenceError", { CHART_ABSENCE_NOT_OBSERVED:"NOT_OBSERVED_BY_STREAM" });
  const isNamed = fnFrom(chart, "isNamedAbsence");

  const named = make("NOT_OBSERVED_BY_STREAM", "TICK", "1D");
  assert.equal(isNamed(named), true);
  assert.equal(named.scAbsence, "NOT_OBSERVED_BY_STREAM");
  assert.equal(named.scTicker, "TICK");
  assert.equal(named.scRange, "1D");

  /* Every ordinary failure mode stays a failure: these are the ones that must still retry. */
  for (const transient of [new Error("empty"), new Error("pg ohlcv_history → 503"),
                           new Error("The user aborted a request."), null, undefined])
    assert.equal(isNamed(transient), false);
});

test("the load path stops on a named answer and retries only on a failure", () => {
  /* A successful read with fewer than two observations is raised under its name rather than
     cached as an empty series. This is the exact line the endless spinner came from. */
  assert.match(chart, /if \(pts\.length < 2\) throw chartAbsenceError\(chartAbsenceReason\(t, e\[0\]\), t, range\);/);
  /* The catch splits before it reaches showChartDelayed, and returns without arming a timer. */
  assert.match(chart, /if \(isNamedAbsence\(err\)\) \{ showChartAbsent\(host, err\.scAbsence\); return; \}[\s\S]{0,80}showChartDelayed\(host, t\)/);
  /* showChartAbsent must clear any timer already armed by a previous delayed attempt. */
  assert.match(chart, /function showChartAbsent\(host, reason\) \{[\s\S]{0,220}clearChartRetry\(host\);/);
  assert.doesNotMatch(chart, /function showChartAbsent\(host, reason\) \{[\s\S]{0,400}retryChartLoad/);
  /* Recovery is real: a later successful load drops both the state and the name. */
  assert.match(chart, /delete host\.dataset\.dataState;\n\s*delete host\.dataset\.absence;/);
});

test("the deck header reports absence as absence, not as a delay", () => {
  const summarize = fnFrom(deck, "chartDataSummary");

  const allAbsent = summarize([
    { ticker:"TICK", history:"absent", quote:"absent", absence:"NOT_OBSERVED_BY_STREAM" },
    { ticker:"TRIN", history:"absent", quote:"absent", absence:"NOT_OBSERVED_BY_STREAM" },
  ]);
  assert.equal(allAbsent.mode, "absent");
  assert.equal(allAbsent.count, 2);
  assert.deepEqual(Array.from(allAbsent.names), ["NOT_OBSERVED_BY_STREAM"]);

  /* A genuinely delayed pane still outranks absence — someone is waiting on that one. */
  const mixed = summarize([
    { ticker:"TICK", history:"absent", quote:"absent", absence:"NOT_OBSERVED_BY_STREAM" },
    { ticker:"SPY", history:"delayed", quote:"ready" },
  ]);
  assert.equal(mixed.mode, "delayed");
  assert.equal(mixed.count, 1, "the absent pane is not counted as delayed");
  assert.equal(mixed.absent, 1);

  /* An absent pane must not be counted as loading either, or the header spins forever. */
  const withLoading = summarize([
    { ticker:"TICK", history:"absent", quote:"absent", absence:"NOT_OBSERVED_BY_STREAM" },
    { ticker:"SPY", history:"loading", quote:"loading" },
  ]);
  assert.equal(withLoading.mode, "loading");
  assert.equal(withLoading.count, 1);

  const headline = fnFrom(deck, "chartAbsenceHeadline");
  assert.equal(headline(["NOT_OBSERVED_BY_STREAM"], 6), "DATA · not observed by stream (6)");
  assert.equal(headline(["NOT_OBSERVED_BY_STREAM", "TIMEFRAME_NOT_MAPPED"], 2), "DATA · not observed (2)");
});

test("only a NAMED omission is an absence; an unnamed one stays retryable", () => {
  /* deck keeps three states apart, not two: a good read that carried the row, a good read
     whose omission something NAMED, and everything else - which is still in flight as far as
     anyone here can honestly say. A PostgREST result cannot say "this symbol does not exist";
     it just omits it, so an omission on its own settles nothing. */
  assert.match(deck, /const DECK_QUOTE_ABSENT = new Map\(\);/);
  assert.match(deck, /if \(named\) \{ DECK_QUOTE_FAILED\.delete\(ticker\); DECK_QUOTE_ABSENT\.set\(ticker, named\); \}/);
  assert.match(deck, /else \{ DECK_QUOTE_ABSENT\.delete\(ticker\); DECK_QUOTE_FAILED\.add\(ticker\); \}/);
  assert.match(deck, /catch \(_\) \{[\s\S]{0,240}DECK_QUOTE_ABSENT\.delete\(ticker\); DECK_QUOTE_FAILED\.add\(ticker\);/);
  assert.match(deck, /DECK_QUOTE_ABSENT\.has\(clean\) \? "absent"/);
  /* The old default - assume NOT_OBSERVED_BY_STREAM for anything missing - is gone. */
  assert.doesNotMatch(deck, /return "NOT_OBSERVED_BY_STREAM";/);
  /* chart: the absent state survives the trip across the frame boundary. */
  assert.match(chart, /function applyDeckQuote\(ticker, quote, state, absence\)/);
  assert.match(chart, /state === "absent" \? "absent" : state === "delayed" \? "delayed" : "loading"/);
  assert.match(chart, /applyDeckQuote\(d\.ticker, d\.quote, d\.state, d\.absence\)/);
  assert.match(chart, /reportChartDataState\(host, \{ quote:"absent", absence:named \}\)/);
});

test("the provider shim names absences per symbol and timeframe and never invents a series", () => {
  const window = { fetch: () => Promise.reject(new Error("no network in this test")) };
  vm.runInNewContext(provider, { window, Date, Promise, String, Object, Number, parseInt, isFinite, encodeURIComponent, JSON });
  const S = window.SC_PROVIDER_SHIM;

  assert.equal(S.absenceFor("TICK", "D"), null, "nothing is named before anything is observed");
  S.noteAbsence("tick", "D", "NOT_OBSERVED_BY_STREAM");
  assert.equal(S.absenceFor("TICK", "D"), "NOT_OBSERVED_BY_STREAM", "lookup is case-insensitive");
  assert.equal(S.absenceFor("TICK"), "NOT_OBSERVED_BY_STREAM", "the symbol-level name answers too");

  /* A second, unrelated absence must not evict the first — the rolling `unsatisfied` log does,
     which is why it could not be the thing a pane reads. */
  S.noteAbsence("TRIN", "180", "TIMEFRAME_NOT_MAPPED");
  assert.equal(S.absenceFor("TICK", "D"), "NOT_OBSERVED_BY_STREAM");
  assert.equal(S.absenceFor("TRIN", "180"), "TIMEFRAME_NOT_MAPPED");

  /* Absence is not permanent: a later real series clears it. */
  S.clearAbsence("TICK", "D");
  assert.equal(S.absenceFor("TICK", "D"), null);

  const err = S.absenceError("NOT_OBSERVED_BY_STREAM", "US10Y", "D");
  assert.equal(err.scAbsence, "NOT_OBSERVED_BY_STREAM");
  assert.equal(err.scTicker, "US10Y");
  assert.equal(S.absenceFor("US10Y", "D"), "NOT_OBSERVED_BY_STREAM", "raising also records");

  /* Over fetch(), a named absence is an empty successful read — not a rejected request, which
     is what would send every caller back into a retry loop. */
  assert.match(provider, /if \(err && err\.scAbsence\) return fakeResponse\(\[\]\);/);
  /* And nothing is ever substituted for the missing bars. */
  assert.doesNotMatch(provider, /legacy_fallback|fallbackSeries|synthesi[sz]e/i);
});

test("the versioned chart shell carries the same absence contract", () => {
  assert.equal(chartShell, chart);
});
