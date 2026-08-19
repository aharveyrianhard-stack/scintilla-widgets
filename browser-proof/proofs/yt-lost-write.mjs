/* /youtube: a lost shared write must not stay painted as saved.
   ============================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/yt-lost-write.mjs
   Route: /youtube/ (ALL filter). Data state: three fixture youtube_feed rows, an EMPTY
   yt_watch_later table, yt-act answered per scenario at the page level.

   1. yt-act forced 500 — the star flips on optimistically, then REVERTS when the write is
      known lost, and the page says why in its own flash surface. The shared set ends empty.
   2. yt-act answering 200 {ok:true} — the star stays on, the set carries the id, no
      failure flash. The distinction is the whole point: before this unit both cases
      painted identically as "saved".
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();
const STAR = ".sc-ytc__star";

/* ---- 1: the write is lost ---- */
const p1 = await context.newPage();
const errs1 = []; p1.on("pageerror", (e) => errs1.push(String(e)));
/* The failure answers after a realistic delay so the optimistic frame is observable —
   an instant 500 settles (and reverts) faster than the assertion can look. */
await p1.route("**/functions/v1/yt-act**", async (route) => {
  await new Promise((r) => setTimeout(r, 800));
  await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"forced"}' });
});
await p1.goto(origin + "/youtube/", { waitUntil: "domcontentloaded" });
await p1.waitForSelector(STAR, { timeout: 8000 });
assert.equal(await p1.$eval(STAR, (n) => n.classList.contains("is-on")), false, "starts unsaved");
await p1.click(STAR);
assert.equal(await p1.$eval(STAR, (n) => n.classList.contains("is-on")), true,
  "the optimistic flip paints immediately");
await p1.waitForTimeout(1400);
assert.equal(await p1.$eval(STAR, (n) => n.classList.contains("is-on")), false,
  "the lost write REVERTED the star — it no longer stays painted as saved");
assert.equal(await p1.evaluate(() => ytWLGet().size), 0, "the local shared set holds no lie either");
const flash1 = await p1.$eval("#ytFlash", (n) => ({ text: n.textContent, shown: n.classList.contains("show") }));
assert.equal(flash1.shown, true, "the page says why, visibly");
assert.match(flash1.text, /★ not saved — the shared watch-later write failed · try again/);
const shot1 = await shoot(p1, "yt-star-lost-write-reverted");
assert.deepEqual(errs1, []);
await p1.close();

/* ---- 2: the write lands ---- */
const p2 = await context.newPage();
const errs2 = []; p2.on("pageerror", (e) => errs2.push(String(e)));
await p2.route("**/functions/v1/yt-act**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));
await p2.goto(origin + "/youtube/", { waitUntil: "domcontentloaded" });
await p2.waitForSelector(STAR, { timeout: 8000 });
await p2.click(STAR);
await p2.waitForTimeout(700);
assert.equal(await p2.$eval(STAR, (n) => n.classList.contains("is-on")), true, "a landed write stays painted");
assert.equal(await p2.evaluate(() => ytWLGet().has("fixvid0")), true, "the local shared set carries it");
assert.equal(await p2.$eval("#ytFlash", (n) => n.classList.contains("show")), false, "no failure flash on success");
const shot2 = await shoot(p2, "yt-star-landed-write-stays");
assert.deepEqual(errs2, []);
await p2.close();

console.log("yt-lost-write proof PASSED");

record(`## ${nowStamp()} — /youtube: a lost shared write no longer stays painted as saved

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/yt-lost-write.mjs\` (route /youtube/; three fixture youtube_feed rows, empty yt_watch_later; yt-act answered per page; asserts inline)

- **Write lost** (${shot1}): the star flips on optimistically, then REVERTS within one settle (DOM: \`.sc-ytc__star\` loses \`is-on\`; \`ytWLGet().size === 0\`), and the page's flash surface says "★ not saved — the shared watch-later write failed · try again" for long enough to read. Before this unit the failure was swallowed (\`.then(r => r.json()).catch(() => null)\`, result ignored): the star stayed painted "saved", the shared table never changed, and the lie stood until the next reconcile read.
- **Write landed** (${shot2}): the star stays, \`ytWLGet()\` carries the id, no failure flash — success and failure are now different pictures.
- Success detection is a LANDED write only: non-2xx and error bodies resolve null (a 500 whose JSON parses is not a success).
- **Scope notes, measured in code**: the two mounted video shells already REVERT on this failure (state-honest) but stay reason-silent — recorded as a lesser gap, not repaired here, because their only failure surface today is the watch-list read lane and hijacking it would blank the list; their \`subscribeToChannel\` catch is the same state-honest/reason-silent shape. The 10s-cadence \`ytPosPush\` position write keeps its silent catch by design: positions re-push on cadence, so a lost write is retried by the next tick rather than lied about.

Zero page errors in both scenarios. Rollback: revert the single commit carrying this unit — the change is client-render behavior only (no schema, no endpoint, no authority change).
`);

await close();
