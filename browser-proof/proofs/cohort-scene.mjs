/* Filed defects 1–2, AFTER: a chosen cohort's rows replace the favorites rows.
   ===========================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/cohort-scene.mjs
   Fixtures: favorites MU,NBIS,SNDK; AI_SOFTWARE and MEGACAP carry seven members each,
   none of them favorites (MSFT overlaps MEGACAP only through membership, not favorites).
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const slots = () => page.$$eval("input.tkin", (ns) =>
  ns.filter((n) => !n.closest(".chart-off")).map((n) => n.value).filter(Boolean));

/* 1 — entering the cohort scene lands on FAV: the favorites rows, in added order. */
await page.goto(origin + "/deck/?scene=cohort", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const favRows = await slots();
assert.deepEqual(favRows, ["MU", "NBIS", "SNDK"], "FAV shows the favorites rows");
const pickerVisible = await page.$eval("#cohortPicker", (n) => !n.hidden);
assert.equal(pickerVisible, true, "the cohort picker is visible in the cohort scene");
const shotFav = await shoot(page, "cohort-FAV-favorites-rows");

/* 2 — AI SOFTWARE replaces them with the cohort's members. */
await page.selectOption("#cohortPick", "AI_SOFTWARE");
await page.waitForTimeout(1500);
const aiRows = await slots();
assert.deepEqual(aiRows, ["ADBE", "CRM", "MSFT", "NOW", "ORCL", "PLTR"],
  "AI_SOFTWARE page 1 is the cohort's members");
for (const fav of ["MU", "NBIS", "SNDK"])
  assert.ok(!aiRows.includes(fav), fav + " (favorite, not a member) is gone");
const aiIndicator = await page.$eval("#cohortPageIndicator", (n) => n.textContent);
assert.match(aiIndicator, /page 1 \/ 2 · 7 members/);
const shotAI = await shoot(page, "cohort-AI_SOFTWARE-replaces-favorites");

/* 3 — its second page pages honestly to the remaining member. */
await page.click("#cohortPageNext");
await page.waitForTimeout(1200);
assert.deepEqual(await slots(), ["SNOW"], "page 2 is the one remaining member");
const shotAI2 = await shoot(page, "cohort-AI_SOFTWARE-page2");

/* 4 — MEGACAP replaces them too. */
await page.selectOption("#cohortPick", "MEGACAP");
await page.waitForTimeout(1500);
const megaRows = await slots();
assert.deepEqual(megaRows, ["AAPL", "AMZN", "GOOGL", "META", "MSFT", "NVDA"],
  "MEGACAP page 1 is the cohort's members, sorted");
const shotMega = await shoot(page, "cohort-MEGACAP-replaces-favorites");

/* 5 — and FAV returns the favorites, so the replacement runs both ways. */
await page.selectOption("#cohortPick", "FAV");
await page.waitForTimeout(1200);
assert.deepEqual(await slots(), ["MU", "NBIS", "SNDK"], "FAV restores the favorites rows");

assert.deepEqual(errors, [], "no page errors during the whole flow");
console.log("cohort-scene proof PASSED");

record(`## ${nowStamp()} — filed defects 1–2 FIXED and browser-verified: cohorts replace the favorites rows

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/cohort-scene.mjs\` (asserts inline; a failed assertion fails the run)

- \`/deck/?scene=cohort\` lands on **FAV — MU, NBIS, SNDK** (the favorites rows, added order): ${shotFav}
- Choosing **AI SOFTWARE** replaces them with **ADBE, CRM, MSFT, NOW, ORCL, PLTR** (page 1 / 2 · 7 members; no favorite present): ${shotAI}
- Its page 2 pages honestly to **SNOW** alone: ${shotAI2}
- Choosing **MEGACAP** replaces them with **AAPL, AMZN, GOOGL, META, MSFT, NVDA**: ${shotMega}
- Choosing FAV again restores the favorites rows; zero page errors across the flow.
`);

await close();
