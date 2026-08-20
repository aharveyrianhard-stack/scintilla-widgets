/* /fundamentals: an absent balance field cannot silently mint a net debt.
   ======================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/fy-consistency.mjs
   Route: /templates/fundamentals.html (NVDA boot). Two data states over the same rig:

   1. balance_history answers a row with total_debt NULL — the page must FLAG it by name
      ("net debt treats debt as 0 … OVERSTATED if this name carries debt") instead of the
      old silent (null||0) arithmetic that valued every such ticker debt-free.
   2. The fixture's complete balance row — no absence flag; the valuation renders normally.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();

/* ---- 1: total_debt null ---- */
const p1 = await context.newPage();
const errs1 = []; p1.on("pageerror", (e) => errs1.push(String(e)));
await p1.route("**/rest/v1/balance_history**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "0-0/1" },
    body: JSON.stringify([{ ticker: "NVDA", fiscal_date: "2026-01-31", period: "FY",
      total_debt: null, cash_and_equiv: 30e9, current_assets: 90e9, current_liabilities: 40e9,
      total_equity: 300e9, updated_ts: new Date().toISOString() }]) }));
await p1.goto(origin + "/templates/fundamentals.html", { waitUntil: "domcontentloaded" });
await p1.waitForTimeout(6000);
const caveat1 = await p1.$eval("#tickerCaveat", (n) => n.textContent);
assert.match(caveat1, /balance_history\.total_debt is null — net debt treats debt as 0 and WACC as all-equity; fair value is OVERSTATED if this name carries debt/,
  "the absence is flagged by field name where the flags live");
const shot1 = await shoot(p1, "fundamentals-null-debt-flagged");
assert.deepEqual(errs1, []);
await p1.close();

/* ---- 2: complete balance row — no absence flag ---- */
const p2 = await context.newPage();
const errs2 = []; p2.on("pageerror", (e) => errs2.push(String(e)));
await p2.goto(origin + "/templates/fundamentals.html", { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(6000);
const caveat2 = await p2.$eval("#tickerCaveat", (n) => n.textContent);
assert.ok(!/total_debt is null|No balance_history row/.test(caveat2),
  "a complete balance sheet carries no absence flag");
const fv = await p2.$eval("#oFV", (n) => n.textContent);
assert.notEqual(fv, "—", "the valuation renders normally around real data");
const shot2 = await shoot(p2, "fundamentals-complete-balance-no-flag");
assert.deepEqual(errs2, []);
await p2.close();

console.log("fy-consistency proof PASSED");

record(`## ${nowStamp()} — /fundamentals: absent balance fields are flagged by name, not minted into net debt

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/fy-consistency.mjs\` (route /templates/fundamentals.html, NVDA; balance_history answered per page; asserts inline)

- **total_debt NULL** (${shot1}): the flags line says "balance_history.total_debt is null — net debt treats debt as 0 and WACC as all-equity; fair value is OVERSTATED if this name carries debt". Before this unit, \`(b.total_debt||0)-(b.cash_and_equiv||0)\` silently valued every such ticker debt-free — a missing balance row produced zero net debt, an all-equity WACC, and no sign anywhere.
- **Complete balance row** (${shot2}): no absence flag, valuation renders normally — the flag appears exactly when the absence does.
- The same unit aligned buildBase's ratio windows with the rule the DCF FY baseline enforces: D&A% and capex% denominators now come from the SAME rows as their numerators (the same 4 quarters, or the same single FY — a mismatched FY pair keeps the flagged default rather than a cross-year ratio; an offset cashflow-vs-income quarter window is flagged out loud). fundamentals.revenue_ttm stays the projection BASE — currency there, consistency in ratios. A terminally underivable share count is flagged "NOT meaningful" instead of silently dividing by a 1B placeholder. Functional pins drive every case in tests/station-fundamentals-price.test.mjs.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — derivation and flag wording only; no schema, no authority, no methodology change (the DCF formulas are untouched; only the window selection and absence visibility moved).
`);

await close();
