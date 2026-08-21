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
    /'provider read failed — prices and day changes render unavailable; nothing is substituted'/);
  assert.match(allocation, /SC_PROVIDER\.marketQuotes\(\)/,
    "the mixed equity/non-equity quote lane is explicit");
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

/* ---- the missing-composite runtime: no score is null, and null is said out loud ---- */

function heatHarness(voterVals, weights) {
  const bindings = {
    S: { wts: weights },
    voters: () => voterVals.map((val, i) => ({ key: Object.keys(weights)[i], val })),
  };
  bindings.heat = fnFrom(allocation, "heat", bindings);
  bindings.heatWith = fnFrom(allocation, "heatWith", bindings);
  return bindings;
}

test("zero voters is not a neutral market — heat is null, never a fabricated 0", () => {
  /* Every voter absent: the exact state a dead provider produces. */
  const dead = heatHarness([null, null], { SPY:1, QQQ:1 });
  assert.equal(dead.heat(), null, "no voter answered → no score");
  /* Every voter muted: values exist, nobody is weighted. */
  const muted = heatHarness([0.4, -0.2], { SPY:0, QQQ:0 });
  assert.equal(muted.heat(), null, "all weights 0 → no score");
  /* One live weighted voter is a real score again. */
  const live = heatHarness([0.4, null], { SPY:1, QQQ:1 });
  assert.equal(live.heat(), 0.4);
  /* And the counterfactual that mutes the last voter reports null, not 0. */
  const one = heatHarness([0.4, null], { SPY:1, QQQ:1 });
  assert.equal(one.heatWith(one.voters(), "SPY", 0), null);
});

test("a scoreless render says unavailable everywhere a number would have been invented", () => {
  /* The header names the absence instead of painting +0.00 NEUTRAL. */
  assert.match(allocation, /'UNAVAILABLE — NO VOTER ANSWERED'/);
  /* Targets and moves refuse to price the book off a score that does not exist. */
  assert.match(allocation, /no heat score, no invested target and no sleeve sizing\. Nothing defaults to neutral\./);
  assert.match(allocation, /moves are the gap between your book and a target that cannot be computed right now\./);
  /* The donut is cleared, not left showing the previous run's allocation. */
  assert.match(allocation, /dctx\.clearRect\(0,0,dn\.width,dn\.height\)/);
  /* The curve keeps its policy lines but drops the TODAY marker. */
  assert.match(allocation, /'no live marker — heat unavailable \(no voter answered\)'/);
  /* Brief and trace decline rather than narrate numbers nobody produced. */
  assert.match(allocation, /no heat score and no desk read/);
  assert.match(allocation, /no heat score — no arithmetic chain to trace/);
  /* Muting the last voter is explained as removal, not as zero. */
  assert.match(allocation, /the score reads unavailable, not 0\./);
});

test("what cannot be scored is listed by name under the ranking, not silently dropped", () => {
  assert.match(allocation, /id="cohortUnavail"/);
  assert.match(allocation, /excluded from this ranking — accepted composite unavailable:/);
  assert.match(allocation, /nothing is scored for them and nothing is substituted/);
  assert.match(allocation, /no candidate carries an accepted composite — nothing can be ranked/);
  /* The message must actually be reachable: `html` always carries the header row, so
     `html || fallback` could never fire — zero ranked rows painted a bare header. The raw
     row count decides emptiness (browser receipt: proofs/degraded-states.mjs scenario 3). */
  assert.match(allocation, /t\.innerHTML = rows\.length \? html/);
  assert.ok(!/t\.innerHTML = html \|\|/.test(allocation), "the dead truthiness gate is gone");
});

test("the LENS and the sleeves state their own absence instead of wearing the rail", () => {
  /* lcShareAuto's 0.5 with SPY/IWM absent is the clamp midpoint, not a reading. */
  const lcShareAuto = fnFrom(allocation, "lcShareAuto", { gv: () => null, S: { lcTilt:0 } });
  assert.equal(lcShareAuto(0.1), 0.5, "the rail itself is unchanged");
  assert.match(allocation, /const lensAvailable = gv\('SPY'\) != null && gv\('IWM'\) != null;/);
  assert.match(allocation, /the 20–80 rail midpoint is a clamp, not a reading/);
  assert.match(allocation, /no sleeve proxy carries an accepted composite — sizing is not computed/);
});
