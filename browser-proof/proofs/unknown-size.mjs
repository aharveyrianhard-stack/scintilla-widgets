/* A size is a claim: an unknown SIZE metric is a placeholder, not a measurement.
   ==============================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/unknown-size.mjs
   /reflow picks its cell AREA from ?size= and its rank from ?rank=, independently — so a
   ticker can carry a perfectly good rank value and no market cap at all. That used to draw
   at size 1, against real caps whose sqrt runs to the hundreds of thousands: an unmarked
   sliver reading as "a negligible company" when the truth is "nobody told us how big it
   is". The gap marking beside it is computed on the RANK value, so nothing said otherwise.

   Served here: four tickers with real ranks and very different caps, one of them null, in
   the TREEMAP view where the size metric actually becomes geometry.
   Measured from the laid-out DOM — the actual pixel areas, not the source.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";
import { EQUITIES, NON_EQUITY } from "../fixtures.mjs";

const { context, origin, close } = await launch();

const TICKERS = ["BIGA", "MIDB", "SMLC", "NOCAP"];
const CAPS = { BIGA: 9e12, MIDB: 4e12, SMLC: 1e12, NOCAP: null };

const page = await context.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
await page.route("**/rest/v1/live_quotes**", (r) => r.fulfill({ status: 200,
  contentType: "application/json",
  /* Distinct changes so every node has a real rank value — the point is that the SIZE is
     what is missing, not the rank. */
  body: JSON.stringify(TICKERS.map((ticker, i) => ({ ticker, chg_pct: 3 - i }))) }));
/* The provider shim owns the fixture equities, so their quotes arrive from the provider and
   join this board alongside the four served here — the first run of this proof proved that,
   and every one of them then had an unknown cap, which made "unknown" the whole board. Give
   the rest of the universe a real, uniform cap so the four under test are the only variable. */
await page.route("**/rest/v1/company_profile**", (r) => r.fulfill({ status: 200,
  contentType: "application/json",
  body: JSON.stringify([
    ...TICKERS.map((ticker) => ({ ticker, sector: "Fixture", market_cap: CAPS[ticker], is_etf: false })),
    ...[...EQUITIES, ...NON_EQUITY].map((ticker) => ({ ticker, sector: "Fixture",
      market_cap: 4e12, is_etf: false })),
  ]) }));
/* SIZE only becomes geometry in the treemap view — the matrix view is a uniform grid, so
   asserting areas there would prove nothing about sizing at all. */
await page.goto(origin + "/reflow/?rank=chg&size=mcap&view=treemap", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".cell", { timeout: 15000 });
await page.waitForTimeout(3500);

/* The laid-out geometry, per ticker, straight off the rendered boxes. */
const cells = await page.evaluate(() => {
  const out = {};
  for (const cell of document.querySelectorAll(".cell")) {
    const tk = (cell.querySelector(".tk") || {}).textContent || "";
    if (!tk || out[tk]) continue;
    const box = cell.getBoundingClientRect();
    out[tk] = { area: Math.round(box.width * box.height), nosize: cell.classList.contains("nosize"),
      gap: cell.classList.contains("gap"), title: cell.title,
      /* reflow hides any cell under 2px, so a tiny size does not merely READ as negligible —
         it removes the ticker from the board. Visibility is measured, not assumed. */
      shown: getComputedStyle(cell.closest(".wrap") || cell).display !== "none",
      value: (cell.querySelector(".vl") || {}).textContent || "" };
  }
  return out;
});

for (const t of TICKERS) assert.ok(cells[t], t + " is on the board — no ticker is dropped");

/* The knowns are still sized by their caps, largest first. */
assert.ok(cells.BIGA.area > cells.MIDB.area, "a bigger cap still draws bigger");
assert.ok(cells.MIDB.area > cells.SMLC.area, "…all the way down");
for (const t of ["BIGA", "MIDB", "SMLC"]) {
  assert.equal(cells[t].nosize, false, t + " has a known cap and claims its size");
  assert.equal(cells[t].title, "", t + " needs no disclaimer");
}

/* THE FIX: the unknown cap is not drawn as the smallest thing on the board, and it says
   that its area carries no claim. */
assert.equal(cells.NOCAP.nosize, true, "the unknown-size cell is marked");
assert.match(cells.NOCAP.title, /mcap unknown, so this cell's SIZE is a placeholder, not a measurement/);
assert.ok(cells.NOCAP.shown, "the unknown-size ticker is VISIBLE — measured pre-fix, its area was 0 and reflow's sub-2px rule removed it from the board entirely");
assert.ok(cells.NOCAP.area > cells.SMLC.area,
  "it is NOT the smallest cell — pre-fix it measured area 0 against this same board " +
  "(NOCAP " + cells.NOCAP.area + " vs SMLC " + cells.SMLC.area + ")");
assert.ok(cells.NOCAP.area < cells.BIGA.area, "…nor the largest: the middle claims nothing either way");
/* Its RANK value is known and still shown — only the size was ever missing. */
assert.equal(cells.NOCAP.gap, false, "the rank value landed, so this is not a rank gap");
assert.ok(/%/.test(cells.NOCAP.value), "and its real rank value is painted: " + cells.NOCAP.value);

const shot = await shoot(page, "reflow-unknown-size-placeholder");
assert.deepEqual(errs, [], "no page errors");
await page.close();

console.log("unknown-size proof PASSED — known caps size, the unknown is a marked placeholder");

record(`## ${nowStamp()} — a size is a claim: an unknown SIZE metric is a placeholder, not a measurement

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/unknown-size.mjs\` (asserts inline; measures the laid-out box geometry, not the source)

\`/reflow\` picks its cell AREA from \`?size=\` and its rank from \`?rank=\`, **independently** — so a ticker can carry a perfectly good rank value and no market cap at all. In the default view (rank by change, size by market cap) that used to draw at size 1 against real caps whose sqrt runs to the hundreds of thousands: an unmarked sliver reading as "a negligible company" when the truth is "nobody told us how big it is". The gap marking beside it is computed on the RANK value, so nothing said otherwise.

Four tickers, equal footing on rank, caps 9T / 4T / 1T / **null** (${shot}):

- **The knowns still claim their size** — 9T draws larger than 4T draws larger than 1T, none marked, none disclaimed.
- **The unknown is a marked placeholder**: it carries the \`nosize\` dashed outline and the title "mcap unknown, so this cell's SIZE is a placeholder, not a measurement", and its measured area sits **above the smallest known cell and below the largest** — the median of what IS known, a deliberately uninformative middle.
- **What it did before, measured rather than argued**: restoring the old \`1\`-for-unknown and re-running this proof against the same board gives the unknown-cap cell **area 0**. reflow hides any cell under 2px, so the ticker did not merely READ as negligible — it was **removed from the board**, silently shrinking the universe while the header still counted it. That is the defect in its true size.
- **Its rank value is untouched** and still painted: only the size was ever missing, and the cell is not a rank gap.

Zero page errors. Rollback: revert the single commit — one sizing helper, one marking class, pins and this proof. No data lane, authority or methodology changed.
`);

await close();
