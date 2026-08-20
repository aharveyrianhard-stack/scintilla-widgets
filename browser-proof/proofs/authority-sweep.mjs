/* The authority sweep: eight equity surfaces, zero errors, zero unreviewed hosts at runtime.
   =========================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/authority-sweep.mjs
   The round-5 lesson: a grep sweep is a claim about the spelling. This proof is the runtime
   half of the provider-only/no-fallback audit — it LOADS the equity surfaces no other proof
   exercises and asserts, from the network itself, that nothing escapes to an unreviewed
   host: no Yahoo, no FMP, no CORS proxy, no CDN, nothing but the two owners the rig
   serves — the price-path libraries are vendored same-origin now, so there is no allowed
   third-party request left at all; anything that ever appears fails this proof.
*/
import assert from "node:assert/strict";
import { launch, record, nowStamp } from "../rig.mjs";

const PAGES = ["/geiger/", "/heat/", "/cohort/", "/compare/", "/ticker/", "/wall/", "/analytics/", "/geigerwall/"];

const { context, origin, close, unmatched } = await launch();
const results = [];
for (const p of PAGES) {
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(p + ": " + String(e).split("\n")[0]));
  const before = unmatched.length;
  await page.goto(origin + p, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(3500);
  const body = await page.$eval("body", (n) => n.textContent.replace(/\s+/g, " ").trim());
  const escapes = unmatched.slice(before);
  results.push({ p, errs, escapes, painted: body.length > 40 });
  await page.close();
}

for (const r of results) {
  assert.deepEqual(r.errs, [], r.p + " loads with zero page errors");
  assert.deepEqual(r.escapes, [], r.p + " reaches no non-owner host at all — no Yahoo, no FMP, no proxy, no CDN");
  assert.ok(r.painted, r.p + " paints a real surface, not a blank");
}
/* The sweep must actually have watched the network: a deliberate canary request to a host
   nothing serves must land in the unmatched log, or the interception was not live and a
   "clean" sweep would be meaningless. */
const canary = await context.newPage();
await canary.goto(origin + "/geiger/", { waitUntil: "domcontentloaded" });
await canary.evaluate(() => fetch("https://sweep-canary.invalid/probe").catch(() => {}));
await canary.waitForTimeout(500);
await canary.close();
assert.ok(unmatched.some((u) => u.startsWith("https://sweep-canary.invalid/")),
  "the interception was live — the canary request was observed and refused");

console.log("authority-sweep proof PASSED —", PAGES.length, "surfaces, 0 errors, 0 unreviewed hosts");

record(`## ${nowStamp()} — the authority sweep: eight equity surfaces, zero unreviewed hosts at runtime

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/authority-sweep.mjs\` (asserts inline; no screenshots — the assertions ARE the evidence, regenerable)

${PAGES.join(" · ")} — each loads over the rig with **zero page errors**, paints a real surface, and makes **zero requests to any non-owner host at all**: no Yahoo, no FMP, no CORS proxy, and — since the vendoring — no CDN either. A deliberate canary request to an unserved host must land in the refusal log, so a silent interception failure cannot fake a clean sweep.

This is the runtime half of the round-9 authority audit; the source half measured: zero Yahoo/FMP fetch lanes in served HTML outside sector-rotation's reviewed-relays-only flagged fallback (its third-party proxy lane was retired in F1's own fix, verified still absent); /health the only direct provider fetch (the ruled exception — /analytics's grep hit is banner prose); 20/20 shim-tag coverage on pages that read shim-owned tables (the remaining grep hits — /, /components — are prose descriptions, classified by eye).
`);

await close();
