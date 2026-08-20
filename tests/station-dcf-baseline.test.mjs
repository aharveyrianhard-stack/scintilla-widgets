/* The DCF FY baseline comes from the history tables, and its ratios cannot lie.
   =============================================================================
   netDebt, D&A%, capex% and ΔNWC% were the last four Jul-24 static numbers the valuation
   leaned on. They now overlay from balance_history / cashflow_history / fundamentals_history
   (latest FY per ticker), under rules that keep a partial read from fabricating a ratio:

   - a ratio is only computed when numerator and denominator carry the SAME fiscal_date;
   - D&A is ebitda − operating_income, and a negative difference is rejected as an anomaly;
   - emptiness is decided on the raw value (Number(null) is 0, and 0 is not "absent");
   - an absent field keeps the flagged static value, counted visibly in the badge spine.

   Live field availability was measured read-only on 2026-08-19: all ten bar tickers carry
   complete latest-FY rows in all three tables (balance_history has net_debt directly).
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../templates/dcf.html", import.meta.url), "utf8");

function fnFromSource(source, name, bindings = {}) {
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

const fin = fnFromSource(page, "fin");
const derive = fnFromSource(page, "deriveFyBaseline", { fin });

const FY = "2026-01-25";
const bal = { fiscal_date: FY, net_debt: 807e6, current_assets: 80e9, current_liabilities: 30e9 };
const cf = { fiscal_date: FY, capex: -7e9 };
const fh = { fiscal_date: FY, revenue: 200e9, ebitda: 130e9, operating_income: 124e9 };

test("a complete matching FY yields all four fields with the exact arithmetic", () => {
  const bl = derive(bal, cf, fh);
  assert.equal(bl.netDebt, 0.807, "net_debt lands in billions");
  assert.equal(bl.daPct, (130e9 - 124e9) / 200e9);
  assert.equal(bl.capexPct, 7e9 / 200e9, "capex sign is normalized — cashflow stores it negative");
  assert.equal(bl.nwcPct, (80e9 - 30e9) / 200e9);
});

test("a ratio across two fiscal years is never computed", () => {
  const bl = derive({ ...bal, fiscal_date: "2025-01-26" }, { ...cf, fiscal_date: "2025-01-26" }, fh);
  assert.equal(bl.capexPct, undefined, "capex% needs cashflow and revenue from the same FY");
  assert.equal(bl.nwcPct, undefined, "ΔNWC% needs balance and revenue from the same FY");
  assert.equal(bl.daPct, (130e9 - 124e9) / 200e9, "D&A% lives inside one table and still lands");
  assert.equal(bl.netDebt, 0.807, "netDebt is not a ratio and stands on its own date");
});

test("emptiness is decided on the raw value — zero is a value, null is not", () => {
  assert.equal(derive({ ...bal, net_debt: 0 }, cf, fh).netDebt, 0, "zero net debt is real");
  assert.equal(derive({ ...bal, net_debt: null }, cf, fh).netDebt, undefined);
  assert.equal(derive({ ...bal, net_debt: "" }, cf, fh).netDebt, undefined);
  const negDebt = derive({ ...bal, net_debt: -52.66e9 }, cf, fh);
  assert.equal(negDebt.netDebt, -52.66, "net cash is a negative number, not an absence");
  /* vm objects carry the other realm's prototypes — normalize before deep comparison. */
  assert.deepEqual({ ...derive(bal, cf, { ...fh, revenue: null }) }, { netDebt: 0.807 },
    "no revenue, no ratios — and no substitute denominator");
  assert.deepEqual({ ...derive(bal, cf, { ...fh, revenue: 0 }) }, { netDebt: 0.807 },
    "a zero denominator is not a ratio either");
});

test("a negative D&A difference is an anomaly, not a D&A%", () => {
  const bl = derive(bal, cf, { ...fh, ebitda: 100e9, operating_income: 124e9 });
  assert.equal(bl.daPct, undefined);
  assert.equal(bl.capexPct, 7e9 / 200e9, "the other ratios are unaffected");
});

test("failed reads yield an empty overlay — the static values keep their flag", () => {
  assert.deepEqual({ ...derive(null, null, null) }, {});
  assert.deepEqual({ ...derive(undefined, cf, undefined) }, {}, "capex% has no denominator without fundamentals");
});

/* ---- the wiring around the derivation ---- */

test("the page fetches latest-FY rows per ticker and counts who is live, per field", () => {
  for (const q of [
    "balance_history?select=fiscal_date,net_debt,current_assets,current_liabilities&ticker=eq.${s}&period=eq.FY&order=fiscal_date.desc&limit=1",
    "cashflow_history?select=fiscal_date,capex&ticker=eq.${s}&period=eq.FY&order=fiscal_date.desc&limit=1",
    "fundamentals_history?select=fiscal_date,revenue,ebitda,operating_income&ticker=eq.${s}&period=eq.FY&order=fiscal_date.desc&limit=4",
  ]) assert.ok(page.includes(q), q);
  assert.match(page, /const okBase=\{netDebt:0,daPct:0,capexPct:0,nwcPct:0\};/);
  assert.match(page, /spineSet\('fy-baseline',null,baseMin===syms\.length\?'LIVE':baseMax\?'STALE':'FALLBACK'/);
  assert.match(page, /anything short keeps the flagged static value/);
  /* What stays static says so, and the old blanket claim is gone. */
  assert.match(page, /spineSet\('static-baseline',null,'STATIC','tax default · terminal growth · MRP · debt weight · as-of '\+DATA_ASOF/);
  assert.ok(!page.includes("no DB source yet"), "the four fields are no longer claimed unsourceable");
});

/* ---- the slider seeds with a real FY source: growth CAGR and EBITDA margin ---- */

const seeds = fnFromSource(page, "deriveFySeeds", { fin });
const fy = (date, revenue, ebitda) => ({ fiscal_date: date, revenue, ebitda });

test("the growth seed is an FY-to-FY revenue CAGR with the cockpit's clamps and window rules", () => {
  const rows = [fy("2026-01-31", 200e9, 84e9), fy("2025-01-31", 160e9, 66e9),
                fy("2024-01-31", 128e9, 52e9), fy("2023-01-31", 100e9, 40e9)];
  const yrs = (Date.parse("2026-01-31") - Date.parse("2023-01-31")) / (365.25 * 86400000);
  const s = seeds(rows);
  assert.equal(s.gPct, (Math.pow(2, 1 / yrs) - 1) * 100, "the CAGR is exact, endpoints FY-to-FY");
  assert.equal(s.mPct, 42, "the margin is the latest FY's OWN margin — one row, one window");
  /* Clamps mirror the fundamentals cockpit: g 0..80, m 5..90. */
  assert.equal(seeds([fy("2026-01-31", 100e9, 98e9), fy("2020-01-31", 1e9, 1e9)]).gPct, 80);
  assert.equal(seeds([fy("2026-01-31", 100e9, 98e9)]).mPct, 90);
  assert.equal(seeds([fy("2026-01-31", 100e9, 1e9)]).mPct, 5);
});

test("a seed the window rules refuse stays absent — the flagged static seed keeps the slider", () => {
  /* One FY row: a margin, never a CAGR. */
  const one = seeds([fy("2026-01-31", 200e9, 84e9)]);
  assert.equal(one.gPct, undefined);
  assert.equal(one.mPct, 42);
  /* Two rows less than half a year apart are not a growth history. */
  assert.equal(seeds([fy("2026-01-31", 200e9, 84e9), fy("2025-11-30", 190e9, 80e9)]).gPct, undefined);
  /* Number(null) is 0 and 0 is not a revenue: absent fields cannot seed. */
  assert.deepEqual({ ...seeds([fy("2026-01-31", null, 84e9)]) }, {});
  assert.equal(seeds([fy("2026-01-31", 200e9, null)]).mPct, undefined);
  assert.deepEqual({ ...seeds(null) }, {}, "a failed read seeds nothing");
});

test("the seeds ride the page with per-field counts and never claim LIVE while short", () => {
  assert.match(page, /const okSeed=\{g:0,m:0\};/);
  assert.match(page, /if\(seeds\.gPct!=null\)\{TICKERS\[s\]\.gDefault=seeds\.gPct; okSeed\.g\+\+;\}/);
  assert.match(page, /if\(seeds\.mPct!=null\)\{TICKERS\[s\]\.mDefault=seeds\.mPct; okSeed\.m\+\+;\}/);
  assert.match(page, /spineSet\('fy-seeds',null,seedMin===syms\.length\?'LIVE':seedMax\?'STALE':'FALLBACK'/);
  assert.match(page, /slider SEEDS the user then owns; anything short keeps the flagged static seed/);
});
