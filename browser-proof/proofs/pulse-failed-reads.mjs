/* /pulse: a dead read is worded as a failure, never with an empty table's words.
   ==============================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/pulse-failed-reads.mjs
   The strip used to flatten every dead read to null, so "composite_staged died" and
   "composite_staged has no rows" rendered identically. Two scenarios:

   1. vix_term forced 500, everything else healthy — geiger and macro render normally,
      and the VIX section carries the live price BESIDE a named vix_term failure.
   2. The provider dead — the shim fails its owned reads closed (composite_staged,
      live_quotes), so those sections name their failures, while vix_term (never
      shim-owned) still answers with the term ratio beside the dead-quotes marker.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();
const FLY = "scintilla-massive-chart-api.fly.dev";

/* ---- 1: vix_term dead, all else healthy ---- */
const p1 = await context.newPage();
const errs1 = []; p1.on("pageerror", (e) => errs1.push(String(e)));
await p1.route("**/rest/v1/vix_term**", (route) =>
  route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"forced"}' }));
await p1.goto(origin + "/pulse/", { waitUntil: "domcontentloaded" });
await p1.waitForTimeout(3000);
const strip1 = await p1.$eval("#strip", (n) => n.textContent);
assert.match(strip1, /\d+↑/, "the geiger posture still counts");
assert.match(strip1, /SPY/, "macro still renders its symbols");
assert.match(strip1, /vix_term did not answer · retrying/, "the dead term read is named");
assert.ok(!strip1.includes("no vix source"), "a failure never wears the empty words");
const vixSec1 = await p1.$$eval("#strip .sec", (els) => els.map((e) => e.textContent).find((t) => t.includes("VIX")));
assert.match(vixSec1, /\d+\.\d/, "the live VIX price renders beside the named failure");
const shot1 = await shoot(p1, "pulse-vixterm-dead-beside-live-price");
assert.deepEqual(errs1, []);
await p1.close();

/* ---- 2: provider dead — shim-owned reads fail closed, vix_term still answers ---- */
const p2 = await context.newPage();
const errs2 = []; p2.on("pageerror", (e) => errs2.push(String(e)));
await p2.route("**/*", (route) =>
  new URL(route.request().url()).host === FLY ? route.abort("connectionrefused") : route.fallback());
await p2.goto(origin + "/pulse/", { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(6000);
const strip2 = await p2.$eval("#strip", (n) => n.textContent);
assert.match(strip2, /composite_staged did not answer — unavailable, not empty · retrying/);
assert.match(strip2, /live_quotes did not answer/);
assert.match(strip2, /\/3M \d+\.\d\d/, "vix_term is not shim-owned and still answers");
assert.ok(!strip2.includes("no composite_staged rows"), "no empty-table words over a failure");
assert.ok(!strip2.includes("no macro rows"), "no empty-table words over a failure");
const shot2 = await shoot(p2, "pulse-provider-dead-fails-closed");
assert.deepEqual(errs2, []);
await p2.close();

console.log("pulse-failed-reads proof PASSED");

record(`## ${nowStamp()} — /pulse: a dead read no longer wears an empty table's words

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/pulse-failed-reads.mjs\` (asserts inline; failures injected per page over the healthy rig)

- **vix_term dead, all else healthy** (${shot1}): geiger counts and macro render normally, and the VIX section shows the live price BESIDE "vix_term did not answer · retrying" — the failure is named, the healthy half still speaks, and "no vix source" (the honest empty wording) never appears over a failure.
- **provider dead** (${shot2}): the shim fails its owned reads closed, so GEIGER and MACRO say their sources "did not answer — unavailable, not empty · retrying" in the failure style, while vix_term — never shim-owned — still answers with the /3M term ratio beside the dead-quotes marker. Before this unit, every one of these states rendered as "no composite_staged" / "no live_quotes": a dead read and an empty table were the same strip.

Zero page errors in both scenarios.
`);

await close();
