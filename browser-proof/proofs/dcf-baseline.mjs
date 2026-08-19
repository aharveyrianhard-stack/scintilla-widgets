/* The DCF FY baseline rides the history tables — and what the DB lacks stays flagged static.
   =========================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/dcf-baseline.mjs
   The fixture universe carries 8 of the page's 10 bar tickers (TSM and IREN deliberately
   absent), so this photographs the PARTIAL state: the overlaid tickers carry the derived
   FY numbers exactly, the absent ones keep their flagged Jul-24 static values, and the
   fy-baseline badge counts 8/10 per field without rounding up.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";
import { supabaseRows } from "../fixtures.mjs";

const { context, origin, close } = await launch();
const page = await context.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(origin + "/templates/dcf.html", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);

/* The expected derived values, from the same fixture rows the page was served. */
const SB = "https://wadinxqplrggagkvrdag.supabase.co/rest/v1/";
const bal = supabaseRows(SB + "balance_history?ticker=eq.NVDA&period=eq.FY")[0];
const fh = supabaseRows(SB + "fundamentals_history?ticker=eq.NVDA&period=eq.FY")
  .sort((a, b) => b.fiscal_date.localeCompare(a.fiscal_date))[0];
const cf = supabaseRows(SB + "cashflow_history?ticker=eq.NVDA&period=eq.FY")[0];
assert.equal(bal.fiscal_date, fh.fiscal_date, "fixture FY dates line up, as the live tables do");

const got = await page.evaluate(() => ({
  nvda: { netDebt: TICKERS.NVDA.netDebt, daPct: TICKERS.NVDA.daPct,
          capexPct: TICKERS.NVDA.capexPct, nwcPct: TICKERS.NVDA.nwcPct },
  tsm: { netDebt: TICKERS.TSM.netDebt, daPct: TICKERS.TSM.daPct },
  spine: document.getElementById("dataspine").textContent,
  spineTitles: Array.from(document.querySelectorAll("#dataspine span")).map((n) => n.title).join("\n"),
  asof: document.getElementById("asofBar").textContent,
}));

assert.equal(got.nvda.netDebt, bal.net_debt / 1e9, "netDebt is the DB's, in billions");
assert.equal(got.nvda.daPct, (fh.ebitda - fh.operating_income) / fh.revenue, "D&A% derived exactly");
assert.equal(got.nvda.capexPct, Math.abs(cf.capex) / fh.revenue, "capex% derived exactly");
assert.equal(got.nvda.nwcPct, (bal.current_assets - bal.current_liabilities) / fh.revenue, "ΔNWC% derived exactly");
assert.equal(got.tsm.netDebt, -52.660, "a ticker the DB does not carry keeps its flagged static value");
assert.equal(got.tsm.daPct, 0.223, "…all of them");
assert.match(got.spine, /fy-baseline · STALE/, "8/10 is PARTIAL and says so — never LIVE");
assert.match(got.spineTitles, /netDebt 8\/10 · D&A% 8\/10 · capex% 8\/10 · ΔNWC% 8\/10/,
  "the badge counts per field, without rounding up");
assert.match(got.spineTitles, /anything short keeps the flagged static value/);
assert.match(got.spine, /static-baseline · STATIC/, "margin/tax/MRP stay visibly static");
assert.match(got.asof, /FY baseline \(netDebt · D&A% · capex% · ΔNWC%\) and the growth\/margin slider seeds from the history tables/);
const shot = await shoot(page, "dcf-fy-baseline-partial-overlay");
assert.deepEqual(errors, [], "no page errors");
await page.close();

console.log("dcf-baseline proof PASSED");

record(`## ${nowStamp()} — the DCF FY baseline rides the history tables; the shortfall stays flagged

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/dcf-baseline.mjs\` (fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly** (${shot}): NVDA's netDebt/D&A%/capex%/ΔNWC% in the running page equal the arithmetic over the fixture's own FY rows (net_debt in billions; D&A = ebitda − operating_income; capex sign normalized; ΔNWC over the same fiscal date).
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe, keep every Jul-24 static value, and the fy-baseline badge reads STALE with "netDebt 8/10 · D&A% 8/10 · capex% 8/10 · ΔNWC% 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: margin/tax defaults · MRP · debt weight, as-of the stated vintage.

Live field availability behind this unit was measured read-only the same day: all ten bar tickers carry complete latest-FY rows in balance_history/cashflow_history/fundamentals_history (balance_history carries net_debt directly), so on the real database the badge should read LIVE 10/10 — the rig's 8/10 is the fixture's own deliberate shape, not a claim about the owners' data.

Zero page errors.
`);

await close();
