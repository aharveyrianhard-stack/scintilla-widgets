/* The realtime channel's absence is a said state — and its presence changes nothing else.
   ======================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/realtime-absence.mjs
   supabase-js arrives from a third-party CDN (floating @2 tag). The rig refuses that host,
   which IS the failure mode under test: scenario 1 is the deck with the SDK absent —
   "RT · absent" painted beside (never inside) #marketStatus, the reason in the title, the
   state queryable as SC_REALTIME. Scenario 2 stubs the CDN with a minimal createClient so
   the SDK "loads": the note hides, the state flips, and the wall looks otherwise identical.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();

/* ---- 1: the CDN does not answer (the rig's natural state) ---- */
const p1 = await context.newPage();
const errs1 = []; p1.on("pageerror", (e) => errs1.push(String(e)));
await p1.goto(origin + "/deck/", { waitUntil: "domcontentloaded" });
await p1.waitForTimeout(5000);
const s1 = await p1.evaluate(() => ({
  rt: window.SC_REALTIME,
  note: { hidden: document.getElementById("rtNote").hidden,
          text: document.getElementById("rtNote").textContent,
          title: document.getElementById("rtNote").title },
  market: document.getElementById("marketStatus").textContent,
}));
assert.equal(s1.rt.available, false, "the SDK did not load — the state says so");
assert.match(s1.rt.reason, /supabase-js did not load \(third-party CDN\)/);
assert.equal(s1.note.hidden, false, "the wall SAYS it");
assert.equal(s1.note.text, "RT · absent");
assert.match(s1.note.title, /non-equity ticks ride polling only/);
assert.ok(!s1.market.includes("RT"), "the freshness lane is not contaminated — cadence and freshness stay separate");
assert.match(s1.market, /LIVE|DATA · /, "#marketStatus still reaches its own healthy state beside the note");
const shot1 = await shoot(p1, "realtime-absent-said-on-the-wall");
assert.deepEqual(errs1, [], "the missing SDK breaks nothing");
await p1.close();

/* ---- 2: the CDN answers (stubbed createClient) — the note hides, nothing else changes ---- */
const p2 = await context.newPage();
const errs2 = []; p2.on("pageerror", (e) => errs2.push(String(e)));
await p2.route("**/cdn.jsdelivr.net/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/javascript",
    body: "window.supabase={createClient:()=>({channel:()=>({on(){return this},subscribe(){return this}})})};" }));
await p2.goto(origin + "/deck/", { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(5000);
const s2 = await p2.evaluate(() => ({
  rt: window.SC_REALTIME,
  hidden: document.getElementById("rtNote").hidden,
  market: document.getElementById("marketStatus").textContent,
}));
assert.equal(s2.rt.available, true, "with the SDK present the state flips");
assert.match(s2.rt.reason, /equities are refused at the channel/, "the wording carries the authority rule");
assert.equal(s2.hidden, true, "no note when there is nothing to say");
assert.match(s2.market, /LIVE|DATA · /, "the wall is otherwise identical");
const shot2 = await shoot(p2, "realtime-present-note-hidden");
assert.deepEqual(errs2, []);
await p2.close();

console.log("realtime-absence proof PASSED");

record(`## ${nowStamp()} — the realtime channel's absence is said on the wall, in its own lane

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/realtime-absence.mjs\` (the rig refuses the CDN naturally; scenario 2 stubs it; asserts inline)

- **SDK absent** (${shot1}): the deck paints "RT · absent" beside #marketStatus with the reason in the title ("supabase-js did not load (third-party CDN) — the realtime tick channel is absent; non-equity ticks ride polling only"), \`SC_REALTIME.available === false\` is queryable on deck and chart alike, the freshness lane is untouched (cadence is not freshness — rule 11), and nothing errors. Before this unit the lane vanished with no sign anywhere.
- **SDK present** (${shot2}): the note hides, the state flips, the wording carries the authority rule — equities never ride the channel; the shim's refusal guards (\`realtime_equity_refused\`, unknown-ownership-is-not-permission, the passthrough counter) are now PINNED in the equity-authority suite, where they had been unpinned.
- **Supply-chain fact, recorded for the owner**: the tag loads \`@supabase/supabase-js@2\` — a FLOATING major tag from a third-party CDN, in the price path's pages (/chart, its shell mirror, /deck). Version drift arrives unreviewed; pinning a version with an integrity hash, or vendoring the file same-origin, needs the exact bytes — unreachable from this container (proxy CONNECT 403) — so it is an OWNER RULING, named in the handoff, not a guess taken here. The audit that found it also measured seven other equity surfaces (/geiger /heat /cohort /compare /ticker /analytics /geigerwall) clean: zero page errors, zero non-owner host escapes at runtime.

Rollback: revert the single commit carrying this unit — a said state and pins only; the channel's behavior, the polling lanes and all authorities are untouched.
`);

await close();
