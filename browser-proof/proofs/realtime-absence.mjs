/* The realtime lane tells the truth at every stage: script absent, channel failed, subscribed.
   ===========================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/realtime-absence.mjs
   supabase-js is VENDORED same-origin (npm-verified bytes), so in the rig the REAL library
   loads and executes. Scenario 1 blocks the vendored script — "RT · absent" with the reason.
   Scenario 2 lets it load (available, channel "connecting"), then drives the WIRED status
   callback through CHANNEL_ERROR → "RT · not connected", and SUBSCRIBED → note hidden —
   deterministic, and honest because the source pin proves the channel calls this exact
   function.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();

/* ---- 1: the vendored script does not load ---- */
const p1 = await context.newPage();
const errs1 = []; p1.on("pageerror", (e) => errs1.push(String(e)));
await p1.route("**/_vendor/supabase-js*", (route) => route.abort("connectionrefused"));
await p1.goto(origin + "/deck/", { waitUntil: "domcontentloaded" });
await p1.waitForTimeout(4000);
const s1 = await p1.evaluate(() => ({
  rt: window.SC_REALTIME,
  note: { hidden: document.getElementById("rtNote").hidden,
          text: document.getElementById("rtNote").textContent,
          title: document.getElementById("rtNote").title },
  market: document.getElementById("marketStatus").textContent,
}));
assert.equal(s1.rt.available, false, "the script did not load — the state says so");
assert.match(s1.rt.reason, /supabase-js \(vendored same-origin\) did not load/);
assert.equal(s1.note.hidden, false, "the wall SAYS it");
assert.equal(s1.note.text, "RT · absent");
assert.match(s1.note.title, /non-equity ticks ride polling only/);
assert.ok(!s1.market.includes("RT"), "the freshness lane is not contaminated");
assert.match(s1.market, /LIVE|DATA · /, "#marketStatus still reaches its own state beside the note");
const shot1 = await shoot(p1, "realtime-absent-said-on-the-wall");
assert.deepEqual(errs1, [], "the missing script breaks nothing");
await p1.close();

/* ---- 2: the vendored script loads (the rig's natural state now) — channel truth follows ---- */
const p2 = await context.newPage();
const errs2 = []; p2.on("pageerror", (e) => errs2.push(String(e)));
await p2.goto(origin + "/deck/", { waitUntil: "domcontentloaded" });
await p2.waitForTimeout(4000);
const s2 = await p2.evaluate(() => ({
  realLib: typeof supabase === "object" && typeof supabase.createClient === "function",
  rt: window.SC_REALTIME,
  hidden: document.getElementById("rtNote").hidden,
}));
assert.equal(s2.realLib, true, "the VENDORED library executes — this is the real SDK, not a stub");
assert.equal(s2.rt.available, true);
assert.ok(["connecting", "CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(s2.rt.channel),
  "the channel state is honest about the rig being offline: " + s2.rt.channel);
/* Drive the WIRED callback through its states (the source pin proves the channel calls it). */
const afterErr = await p2.evaluate(() => { rtChannelStatus("CHANNEL_ERROR");
  const n = document.getElementById("rtNote");
  return { hidden: n.hidden, text: n.textContent, title: n.title, ch: window.SC_REALTIME.channel }; });
assert.equal(afterErr.hidden, false, "a failed channel is SAID");
assert.equal(afterErr.text, "RT · not connected");
assert.match(afterErr.title, /did not connect \(CHANNEL_ERROR\) — non-equity ticks ride polling only/);
const shot2 = await shoot(p2, "realtime-channel-error-said");
const afterSub = await p2.evaluate(() => { rtChannelStatus("SUBSCRIBED");
  return { hidden: document.getElementById("rtNote").hidden, ch: window.SC_REALTIME.channel }; });
assert.equal(afterSub.hidden, true, "a SUBSCRIBED channel has nothing to say");
assert.equal(afterSub.ch, "SUBSCRIBED");
assert.deepEqual(errs2, []);
await p2.close();

console.log("realtime-absence proof PASSED");

record(`## ${nowStamp()} — the realtime lane tells the truth at every stage, on the vendored library

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/realtime-absence.mjs\` (asserts inline)

- **Script absent** (${shot1}): with the vendored /_vendor/supabase-js blocked, the deck paints "RT · absent" beside #marketStatus with the reason, SC_REALTIME.available === false, the freshness lane untouched, nothing errors.
- **Script present — the REAL library** (${shot2}): the vendored npm-verified bytes execute in the rig (typeof supabase.createClient === "function" — no stub), availability flips, and the channel state is honest about the offline rig ("connecting" or a terminal failure). The WIRED status callback — pinned in the equity-authority suite as the exact function the channel calls — is driven through CHANNEL_ERROR ("RT · not connected", reason in the title) and SUBSCRIBED (note hidden). "Available" no longer means merely "script present": the channel lifecycle is the lane's truth.

Rollback: revert the vendoring commit — the CDN tags return; behavior is otherwise unchanged.
`);

await close();
