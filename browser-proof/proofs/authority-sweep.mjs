/* The authority sweep: eight equity surfaces, zero errors, zero unreviewed hosts at runtime.
   =========================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/authority-sweep.mjs
   The round-5 lesson: a grep sweep is a claim about the spelling. This proof is the runtime
   half of the provider-only/no-fallback audit — it LOADS the equity surfaces no other proof
   exercises and asserts, from the network itself, that nothing escapes to an unreviewed
   host: no Yahoo, no FMP, no CORS proxy, nothing but the two owners the rig serves. The one
   allowed third-party request is the pinned jsdelivr supabase-js tag (the recorded
   supply-chain item, an owner ruling) — anything else that ever appears fails this proof.
*/
import assert from "node:assert/strict";
import { launch, record, nowStamp } from "../rig.mjs";

const PAGES = ["/geiger/", "/heat/", "/cohort/", "/compare/", "/ticker/", "/wall/", "/analytics/", "/geigerwall/"];
const ALLOWED_UNMATCHED = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2$/;

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
  const escapes = unmatched.slice(before).filter((u) => !ALLOWED_UNMATCHED.test(u));
  results.push({ p, errs, escapes, painted: body.length > 40 });
  await page.close();
}

for (const r of results) {
  assert.deepEqual(r.errs, [], r.p + " loads with zero page errors");
  assert.deepEqual(r.escapes, [], r.p + " reaches no unreviewed host — no Yahoo, no FMP, no proxy, nothing");
  assert.ok(r.painted, r.p + " paints a real surface, not a blank");
}
/* The sweep must actually have watched the network: the wall's chart frames request the one
   allowed CDN tag, so a run that recorded NOTHING unmatched was not intercepting. */
assert.ok(unmatched.some((u) => ALLOWED_UNMATCHED.test(u)),
  "the interception was live — the known CDN request was observed and is the only exception");

console.log("authority-sweep proof PASSED —", PAGES.length, "surfaces, 0 errors, 0 unreviewed hosts");

record(`## ${nowStamp()} — the authority sweep: eight equity surfaces, zero unreviewed hosts at runtime

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/authority-sweep.mjs\` (asserts inline; no screenshots — the assertions ARE the evidence, regenerable)

${PAGES.join(" · ")} — each loads over the rig with **zero page errors**, paints a real surface, and makes **zero requests to any unreviewed host**: no Yahoo, no FMP, no CORS proxy. The single allowed third-party request is the pinned \`cdn.jsdelivr.net/npm/@supabase/supabase-js@2\` tag (the recorded supply-chain item awaiting an owner's pin-or-vendor ruling), observed via /wall's mounted chart frames — and the proof requires observing it, so a silent interception failure cannot fake a clean sweep.

This is the runtime half of the round-9 authority audit; the source half measured: zero Yahoo/FMP fetch lanes in served HTML outside sector-rotation's reviewed-relays-only flagged fallback (its third-party proxy lane was retired in F1's own fix, verified still absent); /health the only direct provider fetch (the ruled exception — /analytics's grep hit is banner prose); 20/20 shim-tag coverage on pages that read shim-owned tables (the remaining grep hits — /, /components — are prose descriptions, classified by eye).
`);

await close();
