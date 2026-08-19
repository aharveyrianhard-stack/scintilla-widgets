/* The DCF growth/margin slider seeds ride the FY history; the shortfall stays flagged static.
   ==========================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/dcf-seeds.mjs
   Route: /templates/dcf.html (NVDA boot) over the healthy rig, whose fixture universe
   deliberately carries 8 of the page's 10 bar tickers. Asserts: NVDA's seeds equal the
   arithmetic over the fixture's own FY rows and reach the visible sliders; TSM (absent from
   the fixture) keeps its Jul-24 static seeds; the fy-seeds badge counts 8/10 per field and
   reads STALE, never LIVE while short.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";
import { supabaseRows } from "../fixtures.mjs";

const { context, origin, close } = await launch();
const page = await context.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(origin + "/templates/dcf.html", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);

/* Expected seeds from the same fixture rows the page was served, same formula. */
const SB = "https://wadinxqplrggagkvrdag.supabase.co/rest/v1/";
const fyRows = supabaseRows(SB + "fundamentals_history?ticker=eq.NVDA&period=eq.FY")
  .sort((a, b) => b.fiscal_date.localeCompare(a.fiscal_date));
const first = fyRows[fyRows.length - 1], last = fyRows[0];
const yrs = (Date.parse(last.fiscal_date) - Date.parse(first.fiscal_date)) / (365.25 * 86400000);
const expG = Math.max(0, Math.min(80, (Math.pow(last.revenue / first.revenue, 1 / yrs) - 1) * 100));
const expM = Math.max(5, Math.min(90, last.ebitda / last.revenue * 100));

const got = await page.evaluate(() => ({
  nvda: { g: TICKERS.NVDA.gDefault, m: TICKERS.NVDA.mDefault },
  tsm: { g: TICKERS.TSM.gDefault, m: TICKERS.TSM.mDefault },
  sliderG: Number(document.getElementById("g").value),
  sliderM: Number(document.getElementById("m").value),
  spine: document.getElementById("dataspine").textContent,
  spineTitles: Array.from(document.querySelectorAll("#dataspine span")).map((n) => n.title).join("\n"),
}));

assert.equal(got.nvda.g, expG, "the growth seed is the FY-to-FY CAGR, exact");
assert.equal(got.nvda.m, expM, "the margin seed is the latest FY's own margin, exact");
/* The seeds reach the VISIBLE sliders (the range input snaps to its 0.5 step). */
assert.ok(Math.abs(got.sliderG - expG) <= 0.5, "the growth slider carries the seed");
assert.ok(Math.abs(got.sliderM - Math.max(20, expM)) <= 0.5, "the margin slider carries the seed");
assert.equal(got.tsm.g, 26.2, "a ticker the DB does not carry keeps its flagged static growth seed");
assert.equal(got.tsm.m, 69.9, "…and its static margin seed");
assert.match(got.spine, /fy-seeds · STALE/, "8/10 is PARTIAL and says so — never LIVE");
assert.match(got.spineTitles, /growth default 8\/10 from FY-to-FY revenue CAGR · EBITDA-margin default 8\/10 from the latest FY's own margin/);
assert.match(got.spineTitles, /tax default · terminal growth · MRP · debt weight · as-of/,
  "what has no DB source stays STATIC by name");
const shot = await shoot(page, "dcf-seeds-partial-overlay");
assert.deepEqual(errors, [], "no page errors");
await page.close();

console.log("dcf-seeds proof PASSED");

record(`## ${nowStamp()} — the DCF growth/margin slider seeds ride the FY history; the shortfall stays flagged

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/dcf-seeds.mjs\` (route /templates/dcf.html, NVDA boot; fixture universe carries 8 of the 10 bar tickers; asserts inline)

- **Derived exactly and VISIBLE** (${shot}): NVDA's growth default equals the FY-to-FY revenue CAGR over the fixture's own rows and its margin default equals the latest FY's own margin — both land in TICKERS and on the sliders the user then owns (range inputs snap to their 0.5 step; asserted within one step). Clamps and window rules mirror the fundamentals cockpit: g 0..80, m 5..90, a CAGR needs two FY rows more than half a year apart.
- **The shortfall is worn, not hidden**: TSM and IREN are absent from the fixture universe and keep their Jul-24 static seeds; the fy-seeds badge reads STALE with "growth default 8/10 · EBITDA-margin default 8/10" — a partial overlay never claims LIVE.
- **What has no DB source stays STATIC by name**: tax default · terminal growth · MRP · debt weight (fundamentals_history carries no tax line — measured schema, round 5) — the static-baseline badge and the as-of bar both say so.

Zero page errors. Rollback: revert the single commit carrying this unit — seed derivation and badge wording only; the DCF formulas, price authority and Geiger methodology are untouched, and no provider history was written or deleted.
`);

await close();
