/* /news and /cohorts main reads: never-loaded names the failure; loaded wears STALE.
   ==================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/main-read-failure.mjs
   The primary reads used to reject out to a boot-only catch (unworded) and a SILENT
   interval catch — a page that died after a healthy load kept stale content with a frozen
   freshness stamp. Four scenarios; the mid-life failures are injected by re-routing after
   a healthy load and invoking the page's own tick().
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();
const dead = (route) =>
  route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"forced"}' });

/* ---- 1: /news never loads ---- */
const n1 = await context.newPage();
const errs1 = []; n1.on("pageerror", (e) => errs1.push(String(e)));
await n1.route("**/rest/v1/news?**", dead);
await n1.goto(origin + "/news/?t=AAPL", { waitUntil: "domcontentloaded" });
await n1.waitForTimeout(2500);
assert.match(await n1.$eval("#list", (n) => n.textContent),
  /the news read failed — the wire is unavailable, not empty · retrying at the next refresh/);
const shot1 = await shoot(n1, "news-main-read-never-loaded");
assert.deepEqual(errs1, []);
await n1.close();

/* ---- 2: /news loads, then the wire dies — held rows stay, stamped stale ---- */
const n2 = await context.newPage();
const errs2 = []; n2.on("pageerror", (e) => errs2.push(String(e)));
await n2.goto(origin + "/news/?t=AAPL", { waitUntil: "domcontentloaded" });
await n2.waitForTimeout(2500);
assert.match(await n2.$eval("#list", (n) => n.textContent), /AAPL fixture headline/, "healthy load first");
await n2.route("**/rest/v1/news?**", dead);
await n2.evaluate(() => tick());
await n2.waitForTimeout(1200);
const fresh2 = await n2.$eval("#fresh", (n) => n.textContent);
assert.match(fresh2, /REFRESH FAILED/, "the failure is stamped where freshness lives");
assert.match(fresh2, /showing the read from .* ago — the news read is failing, the list below is stale · retrying/);
assert.match(await n2.$eval("#list", (n) => n.textContent), /AAPL fixture headline/,
  "a failed read never erases the held rows");
const shot2 = await shoot(n2, "news-refresh-failed-stale-stamp");
assert.deepEqual(errs2, []);
await n2.close();

/* ---- 3: /cohorts never loads ---- */
const c1 = await context.newPage();
const errs3 = []; c1.on("pageerror", (e) => errs3.push(String(e)));
await c1.route("**/rest/v1/ticker_cohorts**", dead);
await c1.goto(origin + "/cohorts/", { waitUntil: "domcontentloaded" });
await c1.waitForTimeout(2500);
assert.match(await c1.$eval("#strip", (n) => n.textContent),
  /the ticker_cohorts read failed — the strip is unavailable, not empty · retrying at the next refresh/);
const shot3 = await shoot(c1, "cohorts-main-read-never-loaded");
assert.deepEqual(errs3, []);
await c1.close();

/* ---- 4: /cohorts loads, then dies — chips stay, marker appears ---- */
const c2 = await context.newPage();
const errs4 = []; c2.on("pageerror", (e) => errs4.push(String(e)));
await c2.goto(origin + "/cohorts/", { waitUntil: "domcontentloaded" });
await c2.waitForTimeout(2500);
const chipsBefore = await c2.$$eval("#strip .chip", (els) => els.length);
assert.ok(chipsBefore > 0, "healthy chips first");
await c2.route("**/rest/v1/ticker_cohorts**", dead);
await c2.evaluate(() => tick());
await c2.waitForTimeout(1200);
assert.equal(await c2.$$eval("#strip .chip", (els) => els.length), chipsBefore,
  "the chips are kept — a failed read never erases knowledge");
assert.match(await c2.$eval("#cohStale", (n) => n.textContent),
  /refresh failed \(ticker_cohorts\) — these chips are stale · retrying/);
const shot4 = await shoot(c2, "cohorts-refresh-failed-stale-marker");
assert.deepEqual(errs4, []);
await c2.close();

console.log("main-read-failure proof PASSED");

record(`## ${nowStamp()} — /news and /cohorts main reads: named when never loaded, STALE-stamped when they die mid-life

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/main-read-failure.mjs\` (forced 500s; mid-life failures injected by re-routing after a healthy load and invoking the page's own tick(); asserts inline)

- **/news never loads** (${shot1}): "the news read failed — the wire is unavailable, not empty · retrying at the next refresh" — named and distinct from the empty-filter wording; the old boot catch said only "news unavailable".
- **/news dies after a healthy load** (${shot2}): the held headlines STAY (a failed read never erases knowledge) and the freshness line says "REFRESH FAILED — showing the read from Xs ago — the news read is failing, the list below is stale · retrying". Before, the interval catch was silent: the list froze with a "newest Xm ago" stamp that became false as time passed.
- **/cohorts never loads** (${shot3}): the strip names the failed source ("the ticker_cohorts read failed — …"), not "cohort data unavailable".
- **/cohorts dies after a healthy load** (${shot4}): every chip is kept and a visible marker appends — "refresh failed (ticker_cohorts) — these chips are stale · retrying" — cleared naturally by the next successful rebuild.

Zero page errors across all four scenarios. Rollback: revert the single commit carrying this unit — render wording and failure-state plumbing only; queries, authorities and refresh cadences untouched.
`);

await close();
