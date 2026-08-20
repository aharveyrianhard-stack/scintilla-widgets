/* A failed main read never claims the owner's absence — /youtube's feed, and the axis
   consumers' boot paints, photographed.
   ====================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/feed-truth.mjs
   Round-13's sweep re-read all ten SC_COHORT_AXIS consumers: every one answers a BOOT
   failure with a named state (the per-page fixes of earlier rounds held). This proof is
   the runtime half for the two consumers whose failure paint had never been photographed
   (/cohort, /geigerwall) — and the fix half for the one main read the page-name sweeps
   missed: /youtube's feed catch painted "the youtube_feed table is empty; cards fill per
   video when the ingester lands" for ANY failure — the owner's absence, plus a blamed
   ingester, off a read that never landed. Failure injection is page-level; the shared
   fixtures stay untouched.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();

/* ---- 1: /youtube with the feed read DEAD — a failure, said as one ---- */
const p1 = await context.newPage();
const e1 = []; p1.on("pageerror", (e) => e1.push(String(e).split("\n")[0]));
await p1.route("**/rest/v1/youtube_feed**", (r) => r.abort("connectionrefused"));
await p1.goto(origin + "/youtube/", { waitUntil: "domcontentloaded" });
await p1.waitForTimeout(7000); /* pg retries 3x with backoff */
const g1 = await p1.$eval("#ytGrid", (n) => n.textContent);
assert.match(g1, /read failed — the wire is unavailable, not empty · retrying at the next pass/,
  "the failed read is SAID as a failure");
assert.ok(!g1.includes("table is empty") && !g1.includes("ingester"),
  "the owner's absence — and the blamed ingester — are not painted off a dead read");
assert.deepEqual(e1, [], "no page errors with the feed dead");
const shot1 = await shoot(p1, "youtube-feed-read-failed-said");
await p1.close();

/* ---- 2: /youtube with the feed read LANDED EMPTY — the owner's absence, kept ---- */
const p2 = await context.newPage();
const e2 = []; p2.on("pageerror", (e) => e2.push(String(e).split("\n")[0]));
await p2.route("**/rest/v1/youtube_feed**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await p2.goto(origin + "/youtube/", { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(4000);
const g2 = await p2.$eval("#ytGrid", (n) => n.textContent);
assert.match(g2, /awaiting feed — the youtube_feed table is empty; cards fill per video when the ingester lands/,
  "a read that LANDED with zero rows keeps the owner's wording — that claim is now true");
assert.deepEqual(e2, [], "no page errors on the landed-empty read");
const shot2 = await shoot(p2, "youtube-feed-landed-empty-owner-absence");
await p2.close();

/* ---- 3+4: the two never-photographed axis consumers, membership read DEAD ---- */
const p3 = await context.newPage();
const e3 = []; p3.on("pageerror", (e) => e3.push(String(e).split("\n")[0]));
await p3.route("**/rest/v1/ticker_cohorts**", (r) => r.abort("connectionrefused"));
await p3.goto(origin + "/cohort/", { waitUntil: "domcontentloaded" });
await p3.waitForTimeout(6000);
const s3 = await p3.$eval("#stage", (n) => n.textContent);
assert.match(s3, /cohort data unavailable/, "/cohort's boot failure is a named paint");
assert.deepEqual(e3, [], "/cohort: the rejection is caught, not thrown to the console");
const shot3 = await shoot(p3, "cohort-axis-dead-named");
await p3.close();

const p4 = await context.newPage();
const e4 = []; p4.on("pageerror", (e) => e4.push(String(e).split("\n")[0]));
await p4.route("**/rest/v1/ticker_cohorts**", (r) => r.abort("connectionrefused"));
await p4.goto(origin + "/geigerwall/", { waitUntil: "domcontentloaded" });
await p4.waitForTimeout(6000);
const s4 = await p4.$eval("#stage", (n) => n.textContent);
assert.match(s4, /cohort data unavailable — wall cannot compose/, "/geigerwall refuses to compose off a dead axis");
assert.deepEqual(e4, [], "/geigerwall: caught, not thrown");
const shot4 = await shoot(p4, "geigerwall-axis-dead-named");
await p4.close();

console.log("feed-truth proof PASSED — youtube failed/landed-empty + cohort/geigerwall axis-dead");

record(`## ${nowStamp()} — a failed main read never claims the owner's absence: /youtube's feed fixed, the axis consumers photographed

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/feed-truth.mjs\` (page-level failure injection; asserts inline)

- **/youtube, feed read DEAD** (${shot1}): the grid paints "youtube feed · read failed — the wire is unavailable, not empty · retrying at the next pass" — and does NOT paint "the youtube_feed table is empty" or blame the ingester. Before this unit the catch painted exactly those words for any transport failure: the owner's absence claimed off a read that never landed (rule 1 + rule 2 in one sentence). Zero page errors.
- **/youtube, feed read LANDED empty** (${shot2}): the owner's wording survives — "awaiting feed — the youtube_feed table is empty; cards fill per video when the ingester lands" — because off a landed zero-row read that claim is now TRUE (rule 4: emptiness decided on the raw value).
- **The axis-consumer sweep's runtime half** (${shot3}, ${shot4}): with \`ticker_cohorts\` dead at the page, /cohort boots to "cohort data unavailable" and /geigerwall to "cohort data unavailable — wall cannot compose", both with zero page errors — the last two of the ten SC_COHORT_AXIS consumers whose failure paint had never been photographed. The other eight were re-read this round: all answer a boot failure with a named state (analytics counts the axis as a feed and stamps COHORT AXIS FAILED; events refuses with the message; heat paints the COHORT HOMES UNAVAILABLE group; compare's init catch names the database; allocation's spine goes FALLBACK by name; fundamentals converts the flag to a throw under its boot guard; deck and the cohorts strip were fixed in earlier rounds).

Rollback: revert the single commit carrying this unit — one flag, one two-sentence branch, pins and this proof; no data lane, authority or methodology changed.
`);

await close();
