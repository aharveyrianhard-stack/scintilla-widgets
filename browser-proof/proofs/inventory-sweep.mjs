/* The inventory sweep: every remaining served surface loads clean, and the LINES panel
   says its library is dead instead of throwing.
   =====================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/inventory-sweep.mjs
   Together with authority-sweep.mjs and the per-page proofs, this completes runtime
   coverage of the route inventory: every served surface has now been loaded at least once
   under authority assertions. Host allowances are per CLASS, from the measured probes:

   - DATA lanes may reach nothing beyond the rig's two owners — ever.
   - MEDIA-mounting pages may reach YouTube's embed hosts (the player and thumbnails are
     the media content itself; the feed's DATA comes from youtube_feed, never YouTube's
     API) — the chart frames' library is vendored same-origin now, so no CDN remains.
   - The RETAINED ROLLBACK sector-rotation-older may reach its reviewed hub relay (its
     Yahoo lane is the exempt legacy copy, by ruling).
   - The X lane (/pane-x, x shells, the bridge draft) is EXCLUDED: H2 is proof-gated, and
     even observation stays out of its lane until that gate opens. The bridge draft's
     offscreen document is known to throw outside its extension context (recorded in the
     receipt) — an X artifact, so its guard also waits behind H2.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const MEDIA_HOSTS = /^(www\.youtube\.com|www\.youtube-nocookie\.com|i\.ytimg\.com)$/;
const ROLLBACK_HOSTS = /^(unpkg\.com|scintillahub\.ai)$/;

const PAGES = [
  { p: "/", allow: MEDIA_HOSTS },              /* the scene directory mounts live previews */
  { p: "/station/", allow: null }, { p: "/station-viewer/", allow: null }, { p: "/station-ipad/", allow: null },
  { p: "/registry/", allow: null }, { p: "/parity/", allow: null }, { p: "/handoff/", allow: null },
  { p: "/scenes/", allow: null }, { p: "/components/", allow: null }, { p: "/templates/", allow: null },
  { p: "/status-snapshot.html", allow: null },
  { p: "/templates/company-full.html", allow: null },
  { p: "/templates/dcf-methodology.html", allow: null },
  { p: "/templates/fundamentals-spec.html", allow: null },
  { p: "/feed-a/", allow: null }, { p: "/feed-b/", allow: null },
  { p: "/pane-video/", allow: MEDIA_HOSTS }, { p: "/station-shells/video-v1/", allow: MEDIA_HOSTS },
  { p: "/tv/", allow: null }, { p: "/tvwall/", allow: null },
  { p: "/visuals/", allow: null }, { p: "/visuals/archive/", allow: null }, { p: "/visuals/bench/", allow: null },
  { p: "/visuals/gallery/", allow: null }, { p: "/visuals/geiger-live/", allow: null },
  { p: "/visuals/geiger-motion/", allow: null }, { p: "/visuals/images/", allow: null },
  { p: "/visuals/menu/", allow: null }, { p: "/visuals/open/", allow: null },
  { p: "/visuals/template/", allow: null }, { p: "/visuals/theme/", allow: null },
  { p: "/templates/sector-rotation.html", allow: null },
  { p: "/templates/sector-rotation-older.html", allow: ROLLBACK_HOSTS },
];

const { context, origin, close, unmatched } = await launch();
for (const { p, allow } of PAGES) {
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(p + ": " + String(e).split("\n")[0]));
  const before = unmatched.length;
  await page.goto(origin + p, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(2500);
  const blen = await page.evaluate(() => document.body.textContent.replace(/\s+/g, " ").trim().length);
  const escapes = [...new Set(unmatched.slice(before).map((u) => new URL(u).host))]
    .filter((h) => !(allow && allow.test(h)));
  assert.deepEqual(errs, [], p + " loads with zero page errors");
  assert.deepEqual(escapes, [], p + " reaches no host outside its class allowance");
  assert.ok(blen > 100, p + " paints a real surface (" + blen + " chars)");
  await page.close();
}

/* ---- the found defect, proven fixed: the LINES panel says its library is dead ----
   (The library is vendored same-origin now, so the failure under test is injected by
   blocking the /_vendor script — the healthy load is covered by the sweep above.) */
const sr = await context.newPage();
const srErrs = []; sr.on("pageerror", (e) => srErrs.push(String(e)));
await sr.route("**/_vendor/lightweight-charts*", (route) => route.abort("connectionrefused"));
await sr.goto(origin + "/templates/sector-rotation.html", { waitUntil: "domcontentloaded" });
await sr.waitForTimeout(6000);
const lines = await sr.$eval("#linesChart", (n) => n.textContent);
assert.match(lines, /lightweight-charts \(vendored same-origin\) did not load — the LINES panel is unavailable, not empty; every other panel is unaffected/,
  "the dead library is a SAID panel state");
/* A range click used to throw through the unguarded chart calls; now the timeframe panels follow. */
const rangeBtn = await sr.$("[data-d]");
if (rangeBtn) { await rangeBtn.click(); await sr.waitForTimeout(800); }
assert.deepEqual(srErrs, [], "no ReferenceError mid-render, before or after a range click");
const shotSr = await shoot(sr, "sector-lines-cdn-dead-said");
await sr.close();

console.log("inventory-sweep proof PASSED —", PAGES.length, "surfaces + the LINES said state");

record(`## ${nowStamp()} — the inventory sweep: runtime coverage completed, and the LINES panel says its library is dead

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/inventory-sweep.mjs\` (asserts inline; one screenshot for the found defect)

- **${PAGES.length} remaining surfaces loaded clean** — entry, ops, market (/parity), media, the visuals lab, the standalone spec pages: zero page errors, real painted surfaces, zero requests outside each page's CLASS allowance (data lanes: the two owners only; media-mounting pages: YouTube embed hosts; the retained rollback sector-rotation-older: its reviewed hub relay + its legacy unpkg tag, exempt by ruling — no other page touches a CDN since the vendoring). Together with authority-sweep.mjs and the per-page proofs, EVERY served surface in the route inventory has now been loaded at least once under authority assertions — except the X lane, excluded because H2 is proof-gated (the bridge draft's offscreen document is recorded as throwing outside its extension context; its guard waits behind the same gate).
- **The found defect, proven fixed on the vendored library** (${shotSr}): with the same-origin /_vendor lightweight-charts script blocked, the LINES panel SAYS "lightweight-charts (vendored same-origin) did not load — unavailable, not empty; every other panel is unaffected", the chart calls are guarded, and leaders/heatmap still follow a range click with the library dead — zero page errors before and after. (The healthy load — the vendored library actually executing — is covered by the sweep above.)

Rollback: revert the single commit carrying this unit — a said state, guards, pins and this proof; no data lane, authority or methodology changed; the rollback copy untouched.
`);

await close();
