/* A position is a claim: a row with no value has not earned a rank, and must not hold one.
   ========================================================================================
   Run: PW_MODULE_DIR=<dir> node browser-proof/proofs/unranked-position.mjs
   /compare is a ranked wall: each cohort row is placed by `place()` at `translateY(pos*44)`,
   where `pos` is its index in the order `computeOrder()` returns. That order used to contain
   only the cohorts that HAD a value — and `place()` moves exactly what the order contains,
   so a cohort whose value stopped landing was never moved again. It kept the coordinate it
   last earned, wore the rank numeral it last earned, and — because the ranked list is now
   SHORTER than the wall — a ranked row could be assigned the same index and land on top of
   it. Two rows at one coordinate, one of them lying about its place.

   Served here: five cohorts, one of them carrying members no composite covers, so it has no
   value at all. Measured from the rendered transforms — the actual coordinates.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";
import { COHORTS as FIXTURE_COHORTS } from "../fixtures.mjs";

/* The starved cohort is named so it sorts FIRST alphabetically, which is where the wall
   places it before any ranking exists. That is what makes the old behaviour visible: it
   stayed at coordinate 0 while the top-ranked cohort was also assigned coordinate 0. */
const STARVED = "AGRI";
const STARVED_MEMBERS = ["ZZZA", "ZZZB"];   /* carried by no composite anywhere */

const { context, origin, close } = await launch();
const page = await context.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));

/* A cohort is starved through its MEMBERSHIP, not by withholding provider symbols: the
   shim enforces ownership as identity and fails the whole read closed when a requested
   symbol comes back missing (measured — the first run of this proof tripped exactly that
   guard, which is rule 6 working). So the wall gets one more cohort whose members carry no
   composite anywhere, which is the real shape of "this cohort has no reading". */
await page.route("**/rest/v1/ticker_cohorts**", (r) => {
  const rows = [];
  for (const [cohort, members] of Object.entries(FIXTURE_COHORTS))
    for (const ticker of members) rows.push({ ticker, cohort });
  for (const ticker of STARVED_MEMBERS) rows.push({ ticker, cohort: STARVED });
  rows.sort((a, b) => a.ticker.localeCompare(b.ticker) || a.cohort.localeCompare(b.cohort));
  return r.fulfill({ status: 200, contentType: "application/json",
    headers: { "content-range": "0-" + (rows.length - 1) + "/" + rows.length },
    body: JSON.stringify(rows) });
});
await page.goto(origin + "/compare/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#wall .row", { timeout: 15000 });
await page.waitForTimeout(5000);

const rows = await page.evaluate(() => {
  const out = [];
  for (const row of document.querySelectorAll("#wall .row")) {
    const t = getComputedStyle(row).transform;
    /* matrix(a,b,c,d,tx,ty) — ty is the placed coordinate. */
    const ty = t && t.startsWith("matrix") ? Math.round(+t.slice(7, -1).split(",")[5]) : null;
    out.push({
      name: (row.querySelector(".nm") || {}).firstChild?.textContent?.trim() || "",
      rk: (row.querySelector(".rk") || {}).textContent.trim(),
      val: (row.querySelector(".val") || {}).textContent.trim(),
      opacity: getComputedStyle(row).opacity,
      stale: row.classList.contains("stale"),
      ty,
    });
  }
  return out;
});

assert.equal(rows.length, 5, "all five cohorts are on the wall — the wall never shrinks");
const byName = {}; for (const r of rows) byName[r.name.replace(/\s+/g, "_")] = r;
const starved = byName[STARVED];
assert.ok(starved, STARVED + " is present: " + rows.map((r) => r.name).join(", "));

/* THE COLLISION, ruled out by measurement: no two rows share a coordinate. */
const coords = rows.map((r) => r.ty);
assert.equal(new Set(coords).size, coords.length,
  "no two rows occupy the same coordinate — pre-fix the unranked row was landed on (" +
  rows.map((r) => r.name + "@" + r.ty).join(", ") + ")");

/* The valued rows hold the ranked coordinates, in order, numbered from 1. */
const valued = rows.filter((r) => r.name !== starved.name).sort((a, b) => a.ty - b.ty);
valued.forEach((r, i) => {
  assert.equal(r.ty, i * 44, r.name + " holds ranked coordinate " + (i * 44));
  assert.equal(r.rk, String(i + 1), r.name + " is numbered " + (i + 1));
  assert.notEqual(r.val, "—", r.name + " has a value to be ranked by");
});

/* THE FIX: the row with no value sits AFTER every ranked row, claims no numeral, and says
   it has no reading. */
assert.equal(starved.ty, valued.length * 44,
  "the unranked cohort sits after every ranked row (at " + starved.ty + ")");
assert.equal(starved.rk, "—", "it claims no rank numeral — it used to keep the one it last earned");
assert.equal(starved.val, "—", "and it says it has no reading");
assert.ok(+starved.opacity < 0.5, "it is visibly dimmed (" + starved.opacity + ")");
assert.equal(starved.stale, false,
  "and it carries no stale marking — a claim about a window has no business on a row with no reading");

/* The header counts what it RANKED, not how many rows it holds — extending the order to
   carry the unranked rows would otherwise have made this sentence claim a ranking over a
   row with no reading. */
const status = await page.$eval("#status", (n) => n.textContent.replace(/\s+/g, " ").trim());
assert.match(status, /^4 cohorts ranked by/, "the count is of RANKED cohorts, not of rows: " + status);
assert.match(status, /1 with no reading, held below the ranking/,
  "…and what it could not rank is counted and named: " + status);

const shot = await shoot(page, "compare-unranked-row-placed-last");
assert.deepEqual(errs, [], "no page errors");
await page.close();

console.log("unranked-position proof PASSED — unranked row placed last, unnumbered, no collision");

record(`## ${nowStamp()} — a position is a claim: a row with no value has not earned a rank

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/unranked-position.mjs\` (asserts inline; reads the rendered \`translateY\` coordinates, not the source)

\`/compare\` is a ranked wall: \`place()\` positions each cohort row at \`translateY(pos * 44)\`, where \`pos\` is its index in the order \`computeOrder()\` returns. That order used to contain **only the cohorts that had a value** — and \`place()\` moves exactly what the order contains. So a cohort whose value stopped landing was never moved again: it kept the coordinate it last earned, wore the rank numeral it last earned, and — because the ranked list is now shorter than the wall — a ranked row could be assigned the same index and **land on top of it**. Two rows at one coordinate, one of them lying about its place.

Five cohorts served, one of them carrying members no composite covers (${shot}):

- **All five rows stay on the wall.** The wall does not shrink to hide what it cannot rank.
- **No two rows share a coordinate** — asserted as a set-size equality over the measured transforms, so a collision cannot pass.
- **The four valued rows** hold coordinates 0 / 44 / 88 / 132 in rank order and are numbered 1 to 4.
- **The header counts what it ranked**: "4 cohorts ranked by COMPOSITE · 1 with no reading, held below the ranking". Extending the order to carry unranked rows would otherwise have turned \`order.length\` into a claim that all five were ranked — the fix's own side effect, caught and corrected in the same unit.
- **The starved row sits at 176 — after every ranked row** — with the numeral \`—\` instead of a stale number, the value \`—\`, a dimmed opacity, and **no stale marking** (that marking is a claim about the read window, and it used to survive on a row that had lost its reading entirely, because the early return for a null value ran before the toggle).

Zero page errors. Rollback: revert the single commit — one \`concat\` in the order, one numeral guard, one full reset in the null branch, pins and this proof. No data lane, authority or methodology changed; the cohort values are read exactly as before.
`);

await close();
