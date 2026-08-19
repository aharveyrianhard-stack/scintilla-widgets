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
  /* A successful read with fewer than two observations is raised under the name SOMETHING GAVE
     it, and otherwise as an ordinary insufficient-history failure that keeps retrying. Short is
     not absent: one real bar proves the stream observes the symbol, so a terminal name invented
     from a short series would retire a live symbol from the wall for good. */
  assert.match(chart, /const named = chartNamedAbsenceFor\(t, e\[0\]\);\n\s*if \(named\) throw chartAbsenceError\(named, t, range\);/);
  assert.match(chart, /throw new Error\("insufficient history for "/);
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
  assert.match(chart, /reportChartDataState\(host, \{ quote:"absent", quoteAbsence:named \}\)/);
});

test("the provider shim names absences per symbol and timeframe and never invents a series", () => {
  const window = { fetch: () => Promise.reject(new Error("no network in this test")) };
  vm.runInNewContext(provider, { window, Date, Promise, String, Object, Number, parseInt, isFinite, encodeURIComponent, JSON });
  const S = window.SC_PROVIDER_SHIM;

  assert.equal(S.absenceFor("TICK", "D"), null, "nothing is named before anything is observed");
  S.noteAbsence("tick", "D", "NOT_OBSERVED_BY_STREAM");
  assert.equal(S.absenceFor("TICK", "D"), "NOT_OBSERVED_BY_STREAM", "lookup is case-insensitive");

  /* TWO LANES THAT DO NOT TOUCH. A history absence is about a symbol on one timeframe; a quote
     absence is about the symbol. Writing both keys made them one lane wearing two names — a
     candle answer contaminated the price state, and a later candle success erased a real quote
     absence that was still true. */
  assert.equal(S.absenceFor("TICK"), null, "a history absence says nothing about the quote lane");
  S.noteAbsence("TICK", null, "NOT_OBSERVED_BY_STREAM");
  assert.equal(S.absenceFor("TICK"), "NOT_OBSERVED_BY_STREAM", "the quote lane is set on its own");
  S.clearAbsence("TICK", "D");
  assert.equal(S.absenceFor("TICK"), "NOT_OBSERVED_BY_STREAM",
    "clearing the history lane must not erase a live quote absence");
  assert.equal(S.absenceFor("TICK", "D"), null);

  /* A second, unrelated absence must not evict the first — the rolling `unsatisfied` log does,
     which is why it could not be the thing a pane reads. */
  S.noteAbsence("TRIN", "180", "TIMEFRAME_NOT_MAPPED");
  assert.equal(S.absenceFor("TRIN", "180"), "TIMEFRAME_NOT_MAPPED");
  assert.equal(S.absenceFor("TRIN"), null, "and it stays out of TRIN's quote lane");

  const err = S.absenceError("NOT_OBSERVED_BY_STREAM", "US10Y", "D");
  assert.equal(err.scAbsence, "NOT_OBSERVED_BY_STREAM");
  assert.equal(err.scTicker, "US10Y");
  assert.equal(S.absenceFor("US10Y", "D"), "NOT_OBSERVED_BY_STREAM", "raising also records");
  assert.equal(S.absenceFor("US10Y"), null, "in its own lane only");

  /* Over fetch(), a named absence is an empty successful read — not a rejected request, which
     is what would send every caller back into a retry loop. */
  assert.match(provider, /if \(err && err\.scAbsence\) return fakeResponse\(\[\]\);/);
  /* And nothing is ever substituted for the missing bars. */
  assert.doesNotMatch(provider, /legacy_fallback|fallbackSeries|synthesi[sz]e/i);
});

test("the versioned chart shell carries the same absence contract", () => {
  assert.equal(chartShell, chart);
});

test("a pane still retrying is never counted as settled, whichever sublane named it", () => {
  /* History and quote settle separately. Panes used to be moved into the absent bucket the
     moment EITHER sublane was named, and only the remainder was searched for delays — so a
     pane whose history is named absent while its quote is still failing vanished from the
     delayed count and the header went quiet on a pane that was still retrying. */
  const summarize = fnFrom(deck, "chartDataSummary");

  const historyAbsentQuoteDelayed = summarize([
    { ticker:"TICK", history:"absent", quote:"delayed", absence:"NOT_OBSERVED_BY_STREAM" },
  ]);
  assert.equal(historyAbsentQuoteDelayed.mode, "delayed", "the pane is still in flight");
  assert.equal(historyAbsentQuoteDelayed.count, 1);

  const quoteAbsentHistoryDelayed = summarize([
    { ticker:"TICK", history:"delayed", quote:"absent", absence:"NOT_OBSERVED_BY_STREAM" },
  ]);
  assert.equal(quoteAbsentHistoryDelayed.mode, "delayed", "and the inverse is the same pane");
  assert.equal(quoteAbsentHistoryDelayed.count, 1);

  /* Loading counts too — a pane mid-request is not settled either. */
  const halfLoading = summarize([
    { ticker:"TICK", history:"absent", quote:"loading", absence:"NOT_OBSERVED_BY_STREAM" },
  ]);
  assert.equal(halfLoading.mode, "loading");
  assert.equal(halfLoading.count, 1);

  /* Only when nothing about the pane is in flight is it absent. */
  const settled = summarize([
    { ticker:"TICK", history:"absent", quote:"absent", absence:"NOT_OBSERVED_BY_STREAM" },
  ]);
  assert.equal(settled.mode, "absent");
  assert.equal(settled.count, 1);
});

test("the internals symbols nobody names must KEEP retrying", () => {
  /* THE CLAIM THIS CORRECTS. STATION-001 was described as making the four non-equity scenes
     settle on a name and stop. Measured on 2026-08-19, that is only half true, and the half it
     gets wrong matters more:

       ESUSD NQUSD CLUSD US10Y VIX   thousands of bars at scene timeframes, a live_quotes row,
                                     registered in `tickers` — these work.
       ADD PCC CUMTICK TICK TRIN     zero rows in ohlcv_history, live_quotes and
                                     composite_staged, and not registered in `tickers` at all.

     Nothing owns the second group, so nothing NAMES a terminal absence for them. Under the
     corrected rule, "data delayed · retrying" is the truthful state for those panes and must
     continue — stopping would fabricate a certainty no owner has expressed. What STATION-001
     actually fixed is the CONVERSION: an owner's named answer is no longer flattened into an
     endless retry. */
  const UNOWNED = ["ADD", "PCC", "CUMTICK", "TICK", "TRIN"];
  const OWNED_WITH_DATA = ["ESUSD", "NQUSD", "CLUSD", "US10Y", "VIX"];

  /* Both groups are still on the scenes — this test is about behaviour, not about removing
     symbols from a wall to make a suite green. */
  const scened = ["indexNow", "macroCrossAsset", "internalsFast", "internalsSlow"]
    .flatMap((id) => scenes.PRESETS[id].tickers);
  for (const sym of [...UNOWNED, ...OWNED_WITH_DATA].filter((s) => scened.includes(s)))
    assert.ok(scened.includes(sym), `${sym} is still mounted`);

  /* The code rule: an absence exists only where something recorded a name. */
  const named = fnFrom(chart, "chartNamedAbsenceFor", { window:{} });
  for (const sym of UNOWNED)
    assert.equal(named(sym, "180"), null, `${sym} has no name, so nothing may settle it`);

  /* And an unnamed empty read raises an ordinary failure, which retries — not an absence. */
  assert.match(chart, /throw new Error\("insufficient history for "/);
  assert.match(chart, /const named = chartNamedAbsenceFor\(t, e\[0\]\);\n\s*if \(named\) throw chartAbsenceError\(named, t, range\);/);
  /* Nothing anywhere may hand these symbols a default name. */
  assert.doesNotMatch(chart, /\|\| CHART_ABSENCE_NOT_OBSERVED;\s*\n\}\s*\nfunction chartNamedAbsenceFor/);
});

test("history and quote keep their own absence reason", () => {
  /* One shared field meant the lanes wrote over each other: a history success cleared the
     reason belonging to a still-true quote absence, and a quote going ready left a history
     reason standing with nothing to explain. */
  assert.match(chart, /historyAbsence:null, quoteAbsence:null/);
  assert.match(chart, /if \(host\._dataState\.history !== "absent"\) host\._dataState\.historyAbsence = null;/);
  assert.match(chart, /if \(host\._dataState\.quote !== "absent"\) host\._dataState\.quoteAbsence = null;/);
  assert.match(chart, /const aggregate = host\._dataState\.historyAbsence \|\| host\._dataState\.quoteAbsence \|\| null;/,
    "the aggregate is derived, so it cannot drift from the two facts it is made of");

  const report = fnFrom(chart, "reportChartDataState", { Object, parent:{ postMessage:() => {} },
    location:{ origin:"x" }, Boolean });

  /* quote absent, then history goes ready: the quote's reason must survive. */
  const a = { dataset:{ t:"EQR" } };
  report(a, { quote:"absent", quoteAbsence:"NOT_OBSERVED_BY_STREAM" });
  report(a, { history:"ready", historyAbsence:null });
  assert.equal(a._dataState.quoteAbsence, "NOT_OBSERVED_BY_STREAM",
    "a history success cannot clear a still-true quote absence");
  assert.equal(a._dataState.historyAbsence, null);

  /* history absent, then quote goes ready: the history's reason must survive. */
  const b = { dataset:{ t:"MU" } };
  report(b, { history:"absent", historyAbsence:"TIMEFRAME_NOT_MAPPED" });
  report(b, { quote:"ready", quoteAbsence:null });
  assert.equal(b._dataState.historyAbsence, "TIMEFRAME_NOT_MAPPED");
  assert.equal(b._dataState.quoteAbsence, null);

  /* A lane that stops being absent drops its reason, whatever a caller passes. */
  report(b, { history:"ready", historyAbsence:"STALE_NAME_THAT_SHOULD_NOT_STICK" });
  assert.equal(b._dataState.historyAbsence, null);
});

test("the deck tooltip cannot date an untimed row", () => {
  /* The header stopped folding untimed rows into an age, but the tooltip still ran every row
     through `new Date(x.updatedTs)` — and for a row with no observation time that is
     `new Date(null)`, the epoch, printed as a real clock time. */
  assert.doesNotMatch(deck, /new Date\(x\.updatedTs\)\.toLocaleTimeString\(\)/,
    "the unguarded conversion is gone");
  assert.match(deck, /const ms = x\.updatedTs == null \|\| x\.updatedTs === "" \? NaN : new Date\(x\.updatedTs\)\.getTime\(\);/);
  assert.match(deck, /Number\.isFinite\(ms\) \? new Date\(ms\)\.toLocaleTimeString\(\) : "no observation time"/);
});
