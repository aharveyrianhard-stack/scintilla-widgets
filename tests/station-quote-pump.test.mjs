/* The 20s hard bound must be real: the heartbeat is cadence, not invalidation.
   ===========================================================================
   The deck's quote pump promises two thresholds — soft 4.5s reports, hard 20s settles —
   because five live /quotes probes measured 0.84s, 6.86s, 1.27s, 2.71s, 0.27s: reads
   between the thresholds are real and must be allowed to land.

   The 10s heartbeat used to enter through refreshDeckQuotes, whose first line bumps
   deckQuoteRequest to retire in-flight reads when the visible set changes. On an
   unchanged set, that bump meant any read slower than one heartbeat landed to a stale
   request number and was discarded — and its queued rerun met the next tick the same
   way. The effective hard bound was the heartbeat: a provider consistently slower than
   10s could never land an answer at all, while the page said it waited 20s.

   These tests run the extracted pump itself with a controllable fetch. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");

/* Like the other suites' fnFrom, but keeps an `async` keyword that precedes the match. */
function fnFrom(source, name, bindings = {}) {
  let start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const asyncPrefix = "async ";
  if (source.slice(start - asyncPrefix.length, start) === asyncPrefix) start -= asyncPrefix.length;
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function pumpHarness() {
  const fetches = [];
  const bindings = {
    deckQuoteRequest: 0,
    deckQuoteInFlight: false,
    deckQuoteRerun: false,
    DECK_QUOTES: new Map(),
    DECK_QUOTE_FAILED: new Set(),
    DECK_QUOTE_ABSENT: new Map(),
    CLEAN: (x) => String(x || "").trim().toUpperCase(),
    visibleChartTickers: () => ["SPY"],
    deckAbsenceName: () => null,
    fanoutDeckQuote: () => {},
    paintMarketStatus: () => {},
    /* Each call hands back a promise the test resolves by hand, so "slower than a
       heartbeat" is expressed literally: ticks happen while the promise is open. */
    fetchDeckQuotes: () => new Promise((resolve, reject) => { fetches.push({ resolve, reject }); }),
  };
  bindings.selectVisibleQuoteRows = fnFrom(deck, "selectVisibleQuoteRows", bindings);
  bindings.refreshDeckQuotes = fnFrom(deck, "refreshDeckQuotes", bindings);
  bindings.deckQuoteHeartbeat = fnFrom(deck, "deckQuoteHeartbeat", bindings);
  return { bindings, fetches };
}

const row = (price) => [{ ticker:"SPY", price, prev_close:99, updated_ts:"2026-08-19T12:00:00Z" }];

test("an answer slower than the heartbeat still lands — ticks do not retire it", async () => {
  const { bindings, fetches } = pumpHarness();
  bindings.refreshDeckQuotes();
  assert.equal(fetches.length, 1, "one read in flight");
  /* Two 10s ticks pass while the read is still running: 20s of patience, as promised. */
  bindings.deckQuoteHeartbeat();
  bindings.deckQuoteHeartbeat();
  assert.equal(bindings.deckQuoteRequest, 1,
    "a tick on an unchanged set must not bump the request number");
  fetches[0].resolve(row(101.5));
  await settle();
  assert.equal(bindings.DECK_QUOTES.get("SPY")?.price, 101.5,
    "the slow answer was applied, not discarded");
  assert.equal(bindings.DECK_QUOTE_FAILED.has("SPY"), false);
  /* The queued rerun then starts the next read immediately — cadence is kept. */
  assert.equal(fetches.length, 2, "the queued heartbeat rerun fetches after landing");
});

test("a visible-set change still retires the in-flight read — invalidation is kept", async () => {
  const { bindings, fetches } = pumpHarness();
  bindings.refreshDeckQuotes();
  /* The set changed mid-flight: this entry point exists exactly to retire the read. */
  bindings.refreshDeckQuotes();
  assert.equal(bindings.deckQuoteRequest, 2);
  fetches[0].resolve(row(100));
  await settle();
  assert.notEqual(bindings.DECK_QUOTES.get("SPY")?.price, 100,
    "the retired read's answer is not applied");
  assert.equal(fetches.length, 2, "the rerun refetches for the new set");
  fetches[1].resolve(row(200));
  await settle();
  assert.equal(bindings.DECK_QUOTES.get("SPY")?.price, 200, "the rerun's answer lands");
});

test("a read that fails after ticks still marks the panes delayed, and the rerun recovers them", async () => {
  const { bindings, fetches } = pumpHarness();
  bindings.refreshDeckQuotes();
  bindings.deckQuoteHeartbeat();
  fetches[0].reject(new Error("live_quotes 503"));
  await settle();
  assert.equal(bindings.DECK_QUOTE_FAILED.has("SPY"), true,
    "a failure on the current request number is still recorded");
  assert.equal(fetches.length, 2);
  fetches[1].resolve(row(300));
  await settle();
  assert.equal(bindings.DECK_QUOTES.get("SPY")?.price, 300);
  assert.equal(bindings.DECK_QUOTE_FAILED.has("SPY"), false);
});

test("the deck wires cadence callers to the heartbeat and set-changing callers to the refresh", () => {
  assert.match(deck, /setInterval\(deckQuoteHeartbeat, DECK_QUOTE_HEARTBEAT_MS\);/,
    "the interval goes through the non-invalidating door");
  assert.match(deck, /function deckQuoteHeartbeat\(\) \{\n  if \(deckQuoteInFlight\) \{ deckQuoteRerun = true; return; \}\n  refreshDeckQuotes\(\);\n\}/,
    "the heartbeat never touches deckQuoteRequest");
  assert.match(deck, /postDeckQuote\(pane\.frame, pane\.def\.ticker\); deckQuoteHeartbeat\(\);/,
    "a booting chart's quote-ready does not retire an in-flight read either");
  /* The set-changing callers keep the invalidating entry point. */
  for (const site of [/relayout\(\); paintChips\(\); refreshDeckQuotes\(\);/,
                      /refreshDeckQuotes\(\); rememberEditableState\(\); closeSymbolGuide\(\);/])
    assert.match(deck, site);
});
