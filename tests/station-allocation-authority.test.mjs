/* The allocation module votes, ranks, briefs and traces on the accepted geiger only.
   ================================================================================
   The client geiger — computed from cohort-feed/Yahoo primitives — had been retired from
   the score, but four paths still consumed it or its feed: the tranche cadence's breadth
   factor, THE BRIEF's prose, the audit trace (which printed 0 for an absent geiger and
   could explain the LC split with numbers the split never saw), and a dead internals
   breakdown. The brief and trace also quoted Yahoo VIX/10Y levels with no flag — prose is
   where an unmarked substitute reads most like authority.

   All of it is on the provider composite now; the cohort-feed lane is removed from the
   page entirely, and an absent composite is said out loud, excluded from every ranking,
   and never replaced by a number nobody produced. The one Yahoo lane left is macro-feed's
   VIX/US10Y LEVELS, used only when their tables are stale and flagged FALLBACK on the
   gauge whenever they vote.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const allocation = fs.readFileSync(new URL("../templates/allocation-module.html", import.meta.url), "utf8");

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

test("the client geiger and its cohort-feed lane are removed, not dormant", () => {
  for (const fn of ["function geiger(", "function rowGeiger(", "function internalsScore("])
    assert.ok(!allocation.includes(fn), `${fn} must not exist`);
  assert.ok(!allocation.includes("COHORT["), "nothing reads the cohort-feed store");
  assert.ok(!allocation.includes("'/cohort-feed'"), "the cohort-feed is not fetched");
  /* The cache key moved so a stored {mr, cr} pair cannot revive the retired feed's data. */
  assert.ok(!allocation.includes("alloc-data-v1"));
  assert.match(allocation, /alloc-data-v2/);
  assert.match(allocation, /fetch\(SB \+ '\/macro-feed\?v=5'\)/, "the level fallback lane remains");
});

test("an absent composite is visible, and no second feed decides whether to mention it", () => {
  const tickerG = fnFrom(allocation, "tickerG", { COMPOSITE: { NVDA:{ composite:0.42 } } });
  assert.deepEqual({ ...tickerG("NVDA") }, { g:0.42, src:"db" });
  /* Any symbol without an accepted composite answers unavailable — there is no third state
     that depended on whether the retired cohort-feed happened to know the name. */
  for (const sym of ["AAPL", "TICK", "NOT_A_SYMBOL"])
    assert.deepEqual({ ...tickerG(sym) }, { g:null, src:"unavailable" }, sym);
});

test("no universe read means no candidates — a Yahoo set is not a fallback universe", () => {
  const candidateSyms = fnFrom(allocation, "candidateSyms", {
    UNIVERSE: { cohorts:{}, favs:new Set() },
    COMPOSITE: {},
    CMDTY_SYMS: new Set(["GCUSD", "SIUSD", "CLUSD", "USO", "SLV"]),
  });
  assert.deepEqual(Array.from(candidateSyms()), [], "an unreadable universe ranks nobody");
  assert.ok(!allocation.includes("FALLBACK universe"), "the fallback universe path is gone");
  /* And a commodity joins only when the accepted composite carries it. */
  const withComposite = fnFrom(allocation, "candidateSyms", {
    UNIVERSE: { cohorts:{}, favs:new Set() },
    COMPOSITE: { GCUSD:{ composite:0.1 } },
    CMDTY_SYMS: new Set(["GCUSD", "SIUSD"]),
  });
  assert.deepEqual(Array.from(withComposite()), ["GCUSD"]);
});

test("the tranche cadence's breadth factor votes on the provider composite or not at all", () => {
  assert.match(allocation, /const gI2b = gv\('IWM'\), gR2b = gv\('RSP'\);/);
  assert.match(allocation, /factors\.push\('breadth unavailable — not voting'\)/,
    "an absent breadth is named, not silently dropped");
  assert.ok(!allocation.includes("geiger(COHORT"), "no path computes a geiger from the feed");
});

test("the brief and the trace speak from the numbers the model actually used", () => {
  assert.match(allocation, /const gS = gv\('SPY'\), gQ = gv\('QQQ'\), gI = gv\('IWM'\), gR = gv\('RSP'\);/,
    "the brief's geigers are the accessor's");
  assert.match(allocation, /const gS2 = gv\('SPY'\), gI2 = gv\('IWM'\);/,
    "the trace explains the LC split with the split's own inputs");
  /* An absent geiger prints as absent in the trace, never as 0. */
  assert.ok(!allocation.includes("? geiger(COHORT['SPY']) : 0"));
  /* Neither surface quotes an unflagged Yahoo level: db value or nothing. */
  assert.equal((allocation.match(/MACRO\['VIX'\]\?\.value/g) || []).length, 0);
  assert.equal((allocation.match(/MACRO\['US10Y'\]\?\.value/g) || []).length, 0);
  /* The flagged level fallback survives exactly where it is flagged: the voter gauges. */
  assert.equal((allocation.match(/FALLBACK yahoo/g) || []).length, 2);
});

test("a failed quote read claims nothing — there are no cohort-feed prices to be 'in use'", () => {
  assert.match(allocation,
    /'read failed — prices and day changes render unavailable; nothing is substituted'/);
  assert.ok(!allocation.includes("cohort-feed prices in use"));
});

test("the geiger dials are gone with the geiger they dialled", () => {
  /* A dial that moves nothing teaches a false model of where the number comes from. */
  assert.ok(!allocation.includes('id="dTrend"'));
  assert.ok(!allocation.includes('id="dRsi"'));
  assert.ok(!allocation.includes("set('dTrend'"));
  /* The level-voter endpoints stay: those dials still do real work. */
  assert.match(allocation, /id="vixCold"/);
  assert.match(allocation, /id="tenCold"/);
});
