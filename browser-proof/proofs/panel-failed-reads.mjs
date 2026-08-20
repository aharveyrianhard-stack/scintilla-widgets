/* /econ, /alerts, /news: a dead read is named; an empty table keeps its own words.
   ================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/panel-failed-reads.mjs
   The fixture serves econ/alerts tables EMPTY (their honest state here), so the same rig
   photographs both sides of the distinction the old catch(() => null) erased:
   an empty table says "no … rows"; a forced-500 read says the READ failed and retries.
   /news gets fixture headlines so the page renders around a dead sentiment read.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();
const errors = [];

/* ---- /econ healthy: empty tables wear empty words ---- */
const e0 = await context.newPage();
e0.on("pageerror", (e) => errors.push("econ-empty: " + e));
await e0.goto(origin + "/econ/", { waitUntil: "domcontentloaded" });
await e0.waitForTimeout(2500);
/* Rendered elements only — body.textContent would also match the page's own script source. */
const top0 = await e0.$eval("#top", (n) => n.textContent);
const list0 = await e0.$eval("#list", (n) => n.textContent);
assert.match(top0, /econ_dashboard has no rows/);
assert.match(list0, /no calendar rows for this filter/);
assert.ok(!top0.includes("read failed") && !list0.includes("read failed"),
  "a successful empty read never wears failure words");
const shotEmpty = await shoot(e0, "econ-empty-tables-empty-words");
await e0.close();

/* ---- /econ with both reads dead ---- */
const e1 = await context.newPage();
e1.on("pageerror", (e) => errors.push("econ-dead: " + e));
for (const t of ["econ_dashboard", "econ_calendar"])
  await e1.route("**/rest/v1/" + t + "**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"forced"}' }));
await e1.goto(origin + "/econ/", { waitUntil: "domcontentloaded" });
await e1.waitForTimeout(2500);
const top1 = await e1.$eval("#top", (n) => n.textContent);
const list1 = await e1.$eval("#list", (n) => n.textContent);
assert.match(top1, /the econ_dashboard read failed — the tiles are unavailable, not empty · retrying at the next refresh/);
assert.match(list1, /the econ_calendar read failed — the calendar is unavailable, not clear · retrying at the next refresh/);
assert.ok(!list1.includes("no calendar rows for this filter"), "no empty-table claim over a failure");
const shotEcon = await shoot(e1, "econ-dead-reads-named");
await e1.close();

/* ---- /alerts with both reads dead ---- */
const a1 = await context.newPage();
a1.on("pageerror", (e) => errors.push("alerts-dead: " + e));
for (const t of ["feed_alerts", "alert_log"])
  await a1.route("**/rest/v1/" + t + "**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"forced"}' }));
await a1.goto(origin + "/alerts/", { waitUntil: "domcontentloaded" });
await a1.waitForTimeout(2500);
const wrap2 = await a1.$eval("#wrap", (n) => n.textContent);
assert.match(wrap2, /the feed_alerts read failed — feed health is unavailable, not quiet · retrying at the next refresh/);
assert.match(wrap2, /the alert_log read failed — ticker alerts are unavailable, not quiet · retrying at the next refresh/);
assert.ok(!wrap2.includes("no feed_alerts rows"), "no quiet-feed claim over a failure");
const shotAlerts = await shoot(a1, "alerts-dead-reads-named");
await a1.close();

/* ---- /news: the wire renders, the dead sentiment chip says so ---- */
const n1 = await context.newPage();
n1.on("pageerror", (e) => errors.push("news: " + e));
await n1.route("**/rest/v1/news_sentiment**", (route) =>
  route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"forced"}' }));
await n1.goto(origin + "/news/?t=AAPL", { waitUntil: "domcontentloaded" });
await n1.waitForTimeout(2500);
const sentText = await n1.$eval("#sentwrap", (n) => n.textContent);
assert.match(sentText, /sentiment read failed — unavailable, not neutral · retrying/);
const listText = await n1.$eval("#list", (n) => n.textContent);
assert.match(listText, /AAPL fixture headline/, "the healthy wire still renders beside the named failure");
const shotNews = await shoot(n1, "news-dead-sentiment-named");
await n1.close();

assert.deepEqual(errors, [], "no page errors across all four pages");
console.log("panel-failed-reads proof PASSED");

record(`## ${nowStamp()} — /econ, /alerts, /news: dead reads named; empty tables keep their own words

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/panel-failed-reads.mjs\` (forced 500s per page over the healthy rig; asserts inline)

These three pages still carried the catch(() => null) flattening the round-4 sweep removed elsewhere — found by re-measuring the repo instead of trusting the earlier "swept" claim (the unit pins only banned the spaced spelling, so the unspaced form survived the audit).

- **/econ, empty tables** (${shotEmpty}): the fixture's honest empty state — "econ_dashboard has no rows" and "no calendar rows for this filter", no failure words anywhere.
- **/econ, both reads dead** (${shotEcon}): the tiles and the calendar each name their failed source and the retry; the empty-filter claim never appears over a failure. Before: a dead dashboard read was a BLANK strip and a dead calendar read claimed "no calendar rows for this filter".
- **/alerts, both reads dead** (${shotAlerts}): feed health and ticker alerts say "unavailable, not quiet · retrying" — a dead read no longer impersonates a quiet feed.
- **/news, sentiment dead** (${shotNews}): the chip says "sentiment read failed — unavailable, not neutral · retrying" while the wire renders normally beside it; before, the chip silently vanished, identical to a ticker with no sentiment row.

Remaining catch-null sites, dispositioned rather than swept: /youtube's ytAct is a WRITE lane (star/unstar) whose failure silently loses a shared write — its own audit finding, and any fix must respect the shell mirrors; /templates/sector-rotation.html's spark catches feed the E1 coverage gate (PARTIAL / NOT PROVIDER AUTHORITY — visibly gated); /templates/dcf.html's three FY-baseline catches keep the flagged static value and are counted per field in the badge; /cohorts' hub_favorites catch is the kept marker behind its named tooltip; sector-rotation-older is the retained rollback copy, left as-is.

Zero page errors.
`);

await close();
