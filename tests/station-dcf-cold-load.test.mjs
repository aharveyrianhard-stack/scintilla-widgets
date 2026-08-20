/* /templates/dcf: the Jul-24 snapshot is history, and history cannot be a cold-load price.
   ========================================================================================
   setTicker('NVDA') runs before the first refreshDB() answer can land. With the static
   TICKERS carrying Jul-24 prices, the cold load rendered the full valuation — price
   readout, fair values, buy/trim bands, a football field with "today's $206.84" — against
   a four-week-old snapshot, corrected only when (and if) the overlay arrived. And a FAILED
   quote read (.catch(()=>{})) left the static price standing while the spine claimed those
   valuations were disabled.

   Prices now start absent: the provider overlay is the only thing that can set one, a
   failed read can hold only a previous PROVIDER price (never resurrect the snapshot), and
   the no-price render clears every valuation section rather than leaving the previous
   ticker's numbers standing under the new ticker's name.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../templates/dcf.html", import.meta.url), "utf8");

test("every static price is stripped before the first paint can read it", () => {
  const start = page.indexOf("const TICKERS={");
  const end = page.indexOf("let CURTICK='NVDA'");
  assert.ok(start !== -1 && end > start, "TICKERS literal and init loop exist in order");
  const context = {};
  vm.runInNewContext(page.slice(start, end) + "; globalThis.T = TICKERS;", context);
  const T = context.T;
  const syms = Object.keys(T);
  assert.ok(syms.length >= 10, "the ticker bar is intact");
  for (const s of syms) {
    assert.equal(T[s].price, null, s + " has no price before the provider answers");
    assert.equal(T[s].priceUnavailable, true, s + " starts explicitly unpriced");
    assert.ok(Number.isFinite(T[s].priceStatic) && T[s].priceStatic > 0,
      s + " keeps the Jul-24 figure as a labelled reference");
  }
  /* The specific number the defect shipped with: NVDA's Jul-24 price is a reference now. */
  assert.equal(T.NVDA.priceStatic, 206.84);
  /* And the cold-load order is unchanged — which is exactly why the init strip matters. */
  const paintAt = page.indexOf("setTicker('NVDA');\nrefreshDB();");
  assert.notEqual(paintAt, -1, "the first paint still precedes the first overlay answer");
});

test("only the provider overlay can set a price, and a failed read cannot resurrect the snapshot", () => {
  /* Success path sets the price and clears the flag; the resolved-empty path clears both. */
  assert.match(page, /if\(px != null\)\{ TICKERS\[s\]\.price=px; TICKERS\[s\]\.priceUnavailable=false;/);
  assert.match(page, /else \{ TICKERS\[s\]\.price=null; TICKERS\[s\]\.priceUnavailable=true; \}/);
  /* The old reshuffle that copied whatever price stood into priceStatic on every cycle —
     the line that let a static price masquerade as the previous value — is gone. */
  assert.ok(!page.includes("TICKERS[s].priceStatic=TICKERS[s].price"));
  assert.match(page, /it can never resurrect the static snapshot/);
  /* The spine's claim is now true on every no-price path, including transport failure. */
  assert.match(page, /the rest have no current price and their valuations are disabled/);
  /* Recovery cadence exists. */
  assert.match(page, /setInterval\(refreshDB, 5\*60\*1000\);/);
});

test("a no-price render clears every valuation section instead of leaving the previous ticker's up", () => {
  const gate = page.slice(page.indexOf("if(BASE.price==null){"), page.indexOf("document.getElementById('oPrice').textContent"));
  for (const id of ["oFV1", "oFV3", "oBuy", "oTrim", "moatScore", "uncScore",
                    "projTable", "stage2Table", "stageTable", "moatTier", "uncTier"])
    assert.ok(gate.includes("'" + id + "'"), id + " is cleared by the gate");
  assert.match(gate, /valuation disabled — no provider price for '\+CURTICK/);
  assert.match(gate, /a labelled historical figure, not a valuation input/);
  assert.match(gate, /re-asks the provider every 5 minutes/);
});

test("a model with no answer contributes no bar — the market price is not a fair value", () => {
  assert.match(page, /fv1==null\?null:\{lbl:'1-Stage \(Gordon growth\)', v: fv1, color/);
  assert.ok(!page.includes("v: fv1==null?price:fv1"),
    "the price no longer stands in for a broken Gordon-growth answer");
  assert.match(page, /1-Stage bar omitted — WACC ≤ terminal g/);
  assert.match(page, /\]\.filter\(Boolean\);/);
});

test("the page's own description matches the rule: the price is provider-or-disabled", () => {
  assert.match(page, /the price is provider-or-disabled, never the snapshot/);
  assert.match(page, /price unavailable — valuation disabled/);
});
