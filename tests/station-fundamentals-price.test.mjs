/* /templates/fundamentals: the current price has one source, and no price means no valuation.
   ==========================================================================================
   Three defects this suite exists to keep dead:

   THE DISABLE WAS A ONE-TIME WIPE. When the provider had no usable price, setTicker cleared
   the valuation cells and wrote a banner — then line-later code overwrote the banner with the
   flags line, and the very next render() (any slider drag) repainted every cell with values
   divided by a null price: Infinity upside, $NaN fair value, a bisection solving against
   null. The gate lives at the top of render() now, so the state survives interaction.

   THE CACHE HAD NO TTL. A symbol once recorded unpriced stayed unpriced for the page's whole
   life: a provider blip at load time disabled valuation permanently, and a held price never
   refreshed. Held prices re-ask after QUOTE_TTL_MS; absences re-ask sooner; a poller
   recovers the page when a price arrives.

   FAILURE KINDS WERE CONFLATED. A dead transport, a row with an unusable price, a symbol the
   answer did not carry, and a missing fundamentals row all rendered the same words — some of
   them blaming the wrong owner ("No fundamentals row" when the QUOTE was missing).
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../templates/fundamentals.html", import.meta.url), "utf8");

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

function quoteHarness(sbImpl) {
  const bindings = {
    QUOTE_CACHE: new Map(),
    QUOTE_TTL_MS: 60000,
    QUOTE_RETRY_MS: 15000,
    sb: sbImpl,
    encodeURIComponent,
  };
  bindings.usableNumber = fnFrom(page, "usableNumber", bindings);
  bindings.quoteEntryFresh = fnFrom(page, "quoteEntryFresh", bindings);
  bindings.providerQuotes = fnFrom(page, "providerQuotes", bindings);
  bindings.quoteFailureWord = fnFrom(page, "quoteFailureWord", bindings);
  return bindings;
}

test("emptiness is decided on the raw value — Number(null) is 0 and 0 is not a price", () => {
  const usable = fnFrom(page, "usableNumber");
  for (const bad of [null, undefined, "", true, false, 0, -3, "0", "abc", NaN])
    assert.equal(usable(bad), null, String(bad));
  assert.equal(usable("123.45"), 123.45);
  assert.equal(usable(772.49), 772.49);
});

test("a quote is current for a while, not forever — and absences expire sooner", () => {
  const { quoteEntryFresh } = quoteHarness(async () => []);
  const at = (kind, ageMs) => ({ kind, cachedAt: Date.now() - ageMs });
  assert.equal(quoteEntryFresh(undefined), false, "no entry is never fresh");
  assert.equal(quoteEntryFresh(at("quoted", 30000)), true);
  assert.equal(quoteEntryFresh(at("quoted", 61000)), false, "a held price re-asks after the TTL");
  for (const kind of ["failed", "unquoted", "invalid"]) {
    assert.equal(quoteEntryFresh(at(kind, 5000)), true, kind + " young");
    assert.equal(quoteEntryFresh(at(kind, 16000)), false, kind + " re-asks on the short window");
  }
});

test("the four ways to have no price stay four different things", async () => {
  const h = quoteHarness(async () => [
    { ticker:"NVDA", price:"183.16", prev_close:"181.4", updated_ts:"2026-08-19T14:00:00Z" },
    { ticker:"BROKEN", price:null, prev_close:"", updated_ts:null },
  ]);
  await h.providerQuotes(["NVDA", "BROKEN", "OMITTED"]);
  assert.equal(h.QUOTE_CACHE.get("NVDA").kind, "quoted");
  assert.equal(h.QUOTE_CACHE.get("NVDA").price, 183.16);
  assert.equal(h.QUOTE_CACHE.get("BROKEN").kind, "invalid", "a row without a usable price is a breach, not a gap");
  assert.equal(h.QUOTE_CACHE.get("BROKEN").price, null);
  assert.equal(h.QUOTE_CACHE.get("OMITTED").kind, "unquoted", "an unnamed omission stays retryable");
  /* Each kind renders under its own words. */
  const words = ["NVDA", "BROKEN", "OMITTED"].map((s) => h.quoteFailureWord(s));
  assert.match(words[1], /contract breach/);
  assert.match(words[2], /did not carry this symbol/);
  assert.notEqual(words[1], words[2]);
});

test("a failed read is never data — it is recorded distinctly and cannot erase a held price", async () => {
  let mode = "ok";
  const h = quoteHarness(async () => {
    if (mode === "throw") throw new Error("network");
    if (mode === "sberror") { const e = []; e._sbError = true; e._sbStatus = 503; return e; }
    return [{ ticker:"NVDA", price:183, prev_close:181, updated_ts:"2026-08-19T14:00:00Z" }];
  });
  await h.providerQuotes(["NVDA"]);
  assert.equal(h.QUOTE_CACHE.get("NVDA").kind, "quoted");

  /* Expire the held quote, then fail the refresh: the held price survives the bad read. */
  h.QUOTE_CACHE.get("NVDA").cachedAt = Date.now() - 61000;
  mode = "throw";
  await h.providerQuotes(["NVDA"]);
  assert.equal(h.QUOTE_CACHE.get("NVDA").kind, "quoted", "one bad read does not erase knowledge");
  assert.equal(h.QUOTE_CACHE.get("NVDA").price, 183);

  /* A cold symbol under the same failure records the failure, worded as transport. */
  mode = "sberror";
  await h.providerQuotes(["COLD"]);
  assert.equal(h.QUOTE_CACHE.get("COLD").kind, "failed");
  assert.match(h.quoteFailureWord("COLD"), /read failed \(transport, timeout or HTTP error\)/);
});

test("recovery is real: an expired failure re-asks and a price repaints the page", async () => {
  let healthy = false;
  const h = quoteHarness(async () =>
    healthy ? [{ ticker:"NVDA", price:200, prev_close:199, updated_ts:"2026-08-19T15:00:00Z" }]
            : (() => { throw new Error("down"); })());
  await h.providerQuotes(["NVDA"]);
  assert.equal(h.QUOTE_CACHE.get("NVDA").kind, "failed");
  /* Within the retry window nothing re-asks; after it, the read runs again and recovers. */
  await h.providerQuotes(["NVDA"]);
  assert.equal(h.QUOTE_CACHE.get("NVDA").kind, "failed", "fresh failure entry is not re-asked yet");
  h.QUOTE_CACHE.get("NVDA").cachedAt = Date.now() - 16000;
  healthy = true;
  await h.providerQuotes(["NVDA"]);
  assert.equal(h.QUOTE_CACHE.get("NVDA").kind, "quoted");
  assert.equal(h.QUOTE_CACHE.get("NVDA").price, 200);
  /* And the page-level poller exists: one bounded quote read per window while unavailable,
     a full repaint only when a price actually arrives. */
  assert.match(page, /if\(!\(BASE && BASE\.priceUnavailable\)\) return;/);
  assert.match(page, /if\(quotePriceOf\(CURTICK\) != null\) setTicker\(CURTICK\);/);
  assert.match(page, /\}, QUOTE_RETRY_MS\);/);
});

test("the disable is a render-time gate, not a one-time wipe, and the banner survives the flags line", () => {
  assert.match(page, /if\(BASE && BASE\.priceUnavailable\)\{ renderValuationUnavailable\(\); return; \}/,
    "every paint path passes through the gate");
  const gateAt = page.indexOf("renderValuationUnavailable(); return;");
  const modelAt = page.indexOf("const r=modelFull(", gateAt);
  assert.ok(modelAt > gateAt, "no fair-value arithmetic runs before the gate");
  /* The banner is prepended to the flags line rather than overwritten by it. */
  assert.match(page, /caveatHTML = gapBanner\('No provider price for '\+sym,\n\s*quoteFailureWord\(sym\)/);
  assert.match(page, /\) \+ caveatHTML;/);
  /* No stale copy of the old one-time wipe remains. */
  assert.ok(!page.includes("b.valuationDisabled"), "the dead flag is gone with the dead path");
});

test("the missing thing is named correctly — a missing quote no longer blames the fundamentals table", () => {
  assert.match(page, /const hasFund = !!\(B\[sym\] && B\[sym\]\.hasData\);/);
  assert.match(page, /gapBanner\('No provider price for '\+sym, quoteFailureWord\(sym\)\+' — the football field/);
  assert.match(page, /fundamentals\.price is a snapshot with its own vintage and\n\s*is never used as a current price/);
});

test("a dead universe read cannot stop the page from booting silently", () => {
  /* With no catch on the boot's Promise.all, a cold provider outage (ownership
     unverifiable, so the shim fails composite reads closed) left every section at its
     initial HTML with no banner anywhere — a page-sized silence. Browser receipt:
     browser-proof/proofs/degraded-states.mjs scenario 4. */
  assert.match(page, /try \{ await Promise\.all\(\[loadUniverse\(\), loadRiskFree\(\)\]\); \}/);
  assert.match(page, /universe unavailable — /);
  assert.match(page, /sections that need the universe say so below; reload to retry/);
  const guardAt = page.indexOf("try { await Promise.all([loadUniverse(), loadRiskFree()]); }");
  const tickerAt = page.indexOf("await setTicker('NVDA');");
  assert.ok(guardAt !== -1 && tickerAt > guardAt, "the ticker sections still load after a universe failure");
});

/* ---- FY/TTM window consistency and raw-value balance discipline in buildBase ---- */

function baseHarness(overrides = {}) {
  const Q = (i, extra) => Object.assign({ period: "Q" + (4 - i), fiscal_date: "2026-0" + (6 - i) + "-30",
    revenue: 48e9, ebitda: 20e9, operating_income: 18e9, shares_dil: 2.4e9 }, extra);
  const tables = Object.assign({
    fundamentals: [{ revenue_ttm: 200e9, market_cap: 3e12, price: 120, updated_ts: "2026-08-19T00:00:00Z" }],
    balance_history: [{ fiscal_date: "2026-06-30", period: "Q2", total_debt: 12e9, cash_and_equiv: 30e9,
      current_assets: 90e9, current_liabilities: 40e9, updated_ts: "2026-08-19T00:00:00Z" }],
    fundamentals_history: [0, 1, 2, 3].map((i) => Q(i)).concat([
      { period: "FY", fiscal_date: "2026-01-31", revenue: 180e9, ebitda: 74e9, operating_income: 66e9, shares_dil: 2.4e9 },
      { period: "FY", fiscal_date: "2025-01-31", revenue: 150e9, ebitda: 60e9, operating_income: 54e9, shares_dil: 2.4e9 }]),
    cashflow_history: [0, 1, 2, 3].map((i) => ({ period: "Q" + (4 - i), fiscal_date: "2026-0" + (6 - i) + "-30", capex: -3e9 }))
      .concat([{ period: "FY", fiscal_date: "2026-01-31", capex: -11e9 }]),
    company_profile: [{ beta: 1.2, updated_ts: "2026-08-19T00:00:00Z" }],
    analyst_estimates: [],
  }, overrides);
  const bindings = {
    sb: async (path) => tables[path.split("?")[0]] || [],
    providerQuotes: async () => {},
    quotePriceOf: () => 100,
    RF10Y: 4.5,
  };
  return fnFrom(page, "buildBase", bindings);
}

test("ratio denominators come from the same rows as their numerators, never a foreign TTM", async () => {
  const base = await baseHarness()("NVDA");
  /* 4Q window: (80e9 − 72e9) / 192e9 — NOT / revenue_ttm's 200e9. */
  assert.equal(base.daPct, (80e9 - 72e9) / 192e9);
  assert.equal(base.capexPct, 12e9 / 192e9);
  /* The projection base stays the canonical TTM — currency there, consistency in ratios. */
  assert.equal(base.rev, 200);
  assert.ok(!base.flags.some((f) => /window is offset/.test(f)), "aligned windows carry no offset flag");
});

test("a cashflow window that lags the income window is said out loud", async () => {
  const base = await baseHarness({
    cashflow_history: [0, 1, 2, 3].map((i) => ({ period: "Q" + (3 - i), fiscal_date: "2026-0" + (5 - i) + "-30", capex: -3e9 })),
  })("NVDA");
  assert.ok(base.flags.some((f) => /Capex% window is offset from the income window/.test(f)), base.flags.join(" | "));
});

test("the FY fallback matches FY-to-FY, and refuses a ratio across two fiscal years", async () => {
  const threeQ = [0, 1, 2].map((i) => ({ period: "Q" + (4 - i), fiscal_date: "2026-0" + (6 - i) + "-30",
    revenue: 48e9, ebitda: 20e9, operating_income: 18e9, shares_dil: 2.4e9 }));
  const fys = [
    { period: "FY", fiscal_date: "2026-01-31", revenue: 180e9, ebitda: 74e9, operating_income: 66e9, shares_dil: 2.4e9 },
    { period: "FY", fiscal_date: "2025-01-31", revenue: 150e9, ebitda: 60e9, operating_income: 54e9, shares_dil: 2.4e9 }];
  const matched = await baseHarness({
    fundamentals_history: threeQ.concat(fys),
    cashflow_history: [{ period: "FY", fiscal_date: "2026-01-31", capex: -11e9 }],
  })("NVDA");
  assert.equal(matched.daPct, (74e9 - 66e9) / 180e9, "FY numerator over the SAME FY's revenue");
  assert.equal(matched.capexPct, 11e9 / 180e9, "FY capex over the same FY's revenue");
  const crossed = await baseHarness({
    fundamentals_history: threeQ.concat(fys),
    cashflow_history: [{ period: "FY", fiscal_date: "2025-01-31", capex: -11e9 }],
  })("NVDA");
  assert.equal(crossed.capexPct, 0.05, "a mismatched FY pair keeps the flagged default, not a cross-year ratio");
  assert.ok(crossed.flags.some((f) => /no revenue window matches the cashflow window/.test(f)));
});

test("absent balance fields cannot mint a net debt — each absence is flagged by name", async () => {
  const none = await baseHarness({ balance_history: [] })("NVDA");
  assert.equal(none.netDebt, 0);
  assert.ok(none.flags.some((f) => /No balance_history row .* net debt treated as 0/.test(f)));
  const noDebt = await baseHarness({ balance_history: [{ fiscal_date: "2026-06-30", period: "Q2",
    total_debt: null, cash_and_equiv: 30e9, current_assets: 90e9, current_liabilities: 40e9 }] })("NVDA");
  assert.equal(noDebt.netDebt, -30, "the present side still counts; the absent side is flagged, not invented");
  assert.ok(noDebt.flags.some((f) => /total_debt is null/.test(f)));
  assert.equal(noDebt.debtW, 0, "WACC weight carries no invented debt");
  const noCash = await baseHarness({ balance_history: [{ fiscal_date: "2026-06-30", period: "Q2",
    total_debt: 12e9, cash_and_equiv: null, current_assets: 90e9, current_liabilities: 40e9 }] })("NVDA");
  assert.equal(noCash.netDebt, 12);
  assert.ok(noCash.flags.some((f) => /cash_and_equiv is null/.test(f)));
  /* A real zero is a value, not an absence: no flag for a debt-free balance sheet. */
  const zeroDebt = await baseHarness({ balance_history: [{ fiscal_date: "2026-06-30", period: "Q2",
    total_debt: 0, cash_and_equiv: 30e9, current_assets: 90e9, current_liabilities: 40e9 }] })("NVDA");
  assert.equal(zeroDebt.netDebt, -30);
  assert.ok(!zeroDebt.flags.some((f) => /total_debt is null/.test(f)));
});

test("an underivable share count is flagged as NOT meaningful, never silently 1B", async () => {
  const base = await baseHarness({
    fundamentals: [{ revenue_ttm: 200e9, market_cap: null, price: null, updated_ts: "2026-08-19T00:00:00Z" }],
    fundamentals_history: [0, 1, 2, 3].map((i) => ({ period: "Q" + (4 - i), fiscal_date: "2026-0" + (6 - i) + "-30",
      revenue: 48e9, ebitda: 20e9, operating_income: 18e9, shares_dil: null })),
  })("NVDA");
  assert.ok(base.flags.some((f) => /SHARE COUNT UNAVAILABLE .* NOT meaningful/.test(f)), base.flags.join(" | "));
});
