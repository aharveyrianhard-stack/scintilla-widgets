/* Zero favorites is a said state, not one blank slot.
   ===================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/cohort-empty-fav.mjs
   hub_favorites answers an EMPTY table (a successful read of zero rows — not a failure).
   The wall must say why it is empty, count "0 favorites" honestly, and still navigate to a
   full cohort from there.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();
const page = await context.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.route("**/rest/v1/hub_favorites**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json",
    headers: { "content-range": "*/0" }, body: "[]" }));

await page.goto(origin + "/deck/?scene=cohort&cohort=FAV", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);

const note = await page.$eval("#symbolNote", (n) => n.textContent);
assert.match(note, /no favorites yet — the wall is empty, not broken · choose a cohort or edit the slot/,
  "the wall names its own emptiness");
const indicator = await page.$eval("#cohortPageIndicator", (n) => n.textContent);
assert.match(indicator, /page 1 \/ 1 · 0 favorites/, "the count is the raw truth, not hidden");
const shot1 = await shoot(page, "cohort-empty-fav-named");

/* The way out works: choosing a cohort replaces the empty wall with its full membership. */
await page.selectOption("#cohortPick", "AI_SOFTWARE");
await page.waitForTimeout(1500);
const note2 = await page.$eval("#symbolNote", (n) => n.textContent);
assert.match(note2, /AI SOFTWARE · cohort members — these rows replaced the favorites/);
const indicator2 = await page.$eval("#cohortPageIndicator", (n) => n.textContent);
assert.match(indicator2, /7 members/, "the declared cohort membership fills the wall");
const shot2 = await shoot(page, "cohort-empty-fav-to-cohort");

assert.deepEqual(errors, [], "no page errors");
console.log("cohort-empty-fav proof PASSED");

record(`## ${nowStamp()} — an empty FAV names itself, and the way out works

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/cohort-empty-fav.mjs\` (hub_favorites answers zero rows — a successful empty read, not a failure)

- **The wall says why it is empty** (${shot1}): "no favorites yet — the wall is empty, not broken · choose a cohort or edit the slot", with the indicator counting "page 1 / 1 · 0 favorites". Before this unit the state rendered as one blank editable slot with no wording anywhere on the wall. The wording is gated on the read having landed: before COHORT_READY the count is not yet a fact, and the note does not claim it.
- **Choosing a cohort still replaces the (empty) favorites** (${shot2}): AI SOFTWARE fills the wall with its full declared membership (7 members) from the empty state.

Zero page errors.
`);

await close();
