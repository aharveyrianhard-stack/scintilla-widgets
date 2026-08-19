/* A failed read renders as a failure — never as "no data" or a clear calendar.
   ===========================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/failed-reads.mjs
   board_rsi and earnings_events are forced to answer 500; live_quotes stays healthy. The
   pages must say the READ failed — not describe fifty tickers as having no RSI, and not
   declare the earnings calendar clear.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();
await context.route("**/rest/v1/board_rsi**", (route) =>
  route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"forced"}' }));
await context.route("**/rest/v1/earnings_events**", (route) =>
  route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"forced"}' }));

const errors = [];

/* /ranks: the RSI column names its failed source; CHG still ranks. */
const ranks = await context.newPage();
ranks.on("pageerror", (e) => errors.push("ranks: " + e));
await ranks.goto(origin + "/ranks/", { waitUntil: "domcontentloaded" });
await ranks.waitForTimeout(3000);
const rsiCol = await ranks.$eval('.col[data-label="RSI"]', (n) => n.textContent);
assert.match(rsiCol, /board_rsi did not answer — this ranking is unavailable, not empty/);
assert.ok(!rsiCol.includes("no data"), "no per-ticker 'no data' claims from a failed read");
const chgCol = await ranks.$eval('.col[data-label="CHG %"]', (n) => n.textContent);
assert.match(chgCol, /have data/, "the healthy CHG column still ranks");
const shotRanks = await shoot(ranks, "failed-read-ranks-rsi-column");
await ranks.close();

/* /events: a dead read is not a clear calendar. */
const events = await context.newPage();
events.on("pageerror", (e) => errors.push("events: " + e));
await events.goto(origin + "/events/", { waitUntil: "domcontentloaded" });
await events.waitForTimeout(3000);
const body = await events.$eval("#cols", (n) => n.textContent);
assert.match(body, /the earnings read failed — the calendar is unavailable, not clear/);
assert.match(body, /results are unavailable, not absent/);
assert.ok(!body.includes("nothing scheduled"), "no clear-calendar claim from a failed read");
const shotEvents = await shoot(events, "failed-read-events-calendar");
await events.close();

/* /reflow: the field refuses to draw grey non-answers over a failure. */
const reflow = await context.newPage();
reflow.on("pageerror", (e) => errors.push("reflow: " + e));
await reflow.goto(origin + "/reflow/?rank=rsi", { waitUntil: "domcontentloaded" });
await reflow.waitForTimeout(3000);
const stage = await reflow.$eval("#stage", (n) => n.textContent);
assert.match(stage, /board_rsi did not answer — this ranking is unavailable, not empty/);
const shotReflow = await shoot(reflow, "failed-read-reflow-rsi");
await reflow.close();

assert.deepEqual(errors, [], "no page errors during the whole flow");
console.log("failed-reads proof PASSED");

record(`## ${nowStamp()} — the catch-null sweep, browser-verified: failures render as failures

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/failed-reads.mjs\` (board_rsi and earnings_events forced to 500; asserts inline)

- **/ranks**: the RSI column says "board_rsi did not answer — this ranking is unavailable, not empty · retrying", with zero per-ticker "no data" claims; the healthy CHG column still ranks beside it: ${shotRanks}
- **/events**: the calendar says the read failed — "unavailable, not clear" / "unavailable, not absent" — instead of "nothing scheduled in the next 14 days": ${shotEvents}
- **/reflow**: the field refuses to draw grey non-answers over a failure and names the failed source: ${shotReflow}
- /cohorts' FAV chip now carries the failure in its tooltip when hub_favorites dies (source-pinned in tests; the chip still navigates).
`);

await close();
