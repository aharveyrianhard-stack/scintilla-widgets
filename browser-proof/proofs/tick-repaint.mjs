/* Ticks move the display, repaints never blank, and the display equals the provider.
   =================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/tick-repaint.mjs

   Three claims from the defect packet, exercised in a real Chromium with a dynamic quote
   override registered over the rig's static fixtures (later routes win):

   - PROVIDER-VS-DISPLAY: the chart's day change must equal the arithmetic of the exact
     quote the provider served — both before and after a tick.
   - TICKS: a changed provider quote must reach the standalone chart within one 10s poll,
     and a deck pane within one 10s pump heartbeat (through the authority shim).
   - REPAINT: a cold range switch must never blank the canvas — the previous paint stands
     until the next one is ready.

   Also proven here, visually: the deck header's healthy state — LIVE — is reachable (the
   state that threw ReferenceError before commit 06e4a0a).
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();

/* Dynamic provider /quotes override; everything else falls through to the rig. */
let override = null; // { SYM: price }
await context.route("**/quotes**", async (route) => {
  const url = new URL(route.request().url());
  if (url.host !== "scintilla-massive-chart-api.fly.dev" || url.pathname !== "/quotes") return route.fallback();
  const wanted = (url.searchParams.get("symbols") || "").split(",").filter(Boolean);
  const quotes = {};
  for (const sym of wanted) {
    const base = 50 + (Array.from(sym).reduce((a, c) => a + c.charCodeAt(0), 0) % 400);
    quotes[sym] = { state: "OK", price: (override && override[sym]) || base, previous_close: base - 1,
      price_observation_utc: new Date().toISOString() };
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ quotes }) });
});

const errors = [];

/* ---- standalone chart ---- */
const page = await context.newPage();
page.on("pageerror", (e) => errors.push("chart: " + e));
await page.goto(origin + "/chart/?t=NVDA", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const change = () => page.$eval(".sc-nchart__live-change", (n) => n.textContent);

/* NVDA fixture quote: price 347, previous close 346 → (347−346)/346 = 0.29%. */
assert.equal(await change(), "0.29%", "the display equals the provider quote's own arithmetic");

override = { NVDA: 380 };            /* (380−346)/346 = 9.83% */
await page.waitForTimeout(11500);    /* one 10s poll, with margin */
assert.equal(await change(), "9.83%", "a changed provider quote reaches the chart within one poll");
const shotTick = await shoot(page, "tick-chart-updates-from-provider");

/* Cold range switch: sample canvas paintedness continuously through the transition. */
const painted = () => page.evaluate(() => {
  const c = document.querySelector("canvas");
  const ctx = c && c.getContext("2d");
  if (!ctx) return false;
  const d = ctx.getImageData(0, 0, Math.min(c.width, 800), Math.min(c.height, 600)).data;
  let nz = 0;
  for (let i = 3; i < d.length; i += 160) if (d[i] !== 0) { nz++; if (nz > 40) return true; }
  return false;
});
assert.equal(await painted(), true, "painted before the switch");
await page.click("text=1W");
let blankFrames = 0;
for (let i = 0; i < 20; i++) { if (!(await painted())) blankFrames++; await page.waitForTimeout(80); }
assert.equal(blankFrames, 0, "no sampled frame was blank during the cold range switch");
await page.waitForTimeout(1200);
assert.equal(await painted(), true, "painted after the switch");
const shotRepaint = await shoot(page, "repaint-1W-no-blank");
await page.close();

/* ---- deck pane through the pump and the shim ---- */
override = null;
const deck = await context.newPage();
deck.on("pageerror", (e) => errors.push("deck: " + e));
await deck.goto(origin + "/deck/", { waitUntil: "domcontentloaded" });
await deck.waitForTimeout(5500);
const paneChange = async () => {
  for (const f of deck.frames()) if (f.url().includes("t=SPY"))
    return f.$eval(".sc-nchart__live-change", (n) => n.textContent).catch(() => null);
  return null;
};
/* SPY fixture quote: 302 / 301 → 0.33%. */
assert.equal(await paneChange(), "0.33%", "the pane equals the provider quote's arithmetic");
const header1 = await deck.$eval("#marketStatus", (n) => n.textContent);
assert.match(header1, /^LIVE · /, "the deck header's healthy state is reachable and painted");
const shotLive = await shoot(deck, "deck-header-LIVE-healthy-state");

override = { SPY: 352 };             /* (352−301)/301 = 16.94% */
await deck.waitForTimeout(12500);    /* one 10s pump heartbeat, with margin */
assert.equal(await paneChange(), "16.94%", "a changed provider quote reaches the pane within one heartbeat");
const shotPane = await shoot(deck, "tick-deck-pane-updates-from-provider");

assert.deepEqual(errors, [], "no page errors during the whole flow");
console.log("tick-repaint proof PASSED");

record(`## ${nowStamp()} — ticks, repaint and provider-vs-display, browser-verified; CLOSED-label disposition

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/tick-repaint.mjs\` (asserts inline)

- **Provider-vs-display**: the chart's day change equals the exact quote the provider served — 0.29% for NVDA 347/346, then 9.83% after a tick to 380; the deck pane likewise (0.33% → 16.94%). No display number differs from the provider's arithmetic.
- **Ticks**: the standalone chart takes a changed provider quote within one 10s poll (${shotTick}); a deck pane takes it within one 10s pump heartbeat through the authority shim (${shotPane}).
- **Repaint**: through a cold 1W range switch, 20 continuous canvas samples — zero blank frames; the previous paint stands until the next is ready (${shotRepaint}).
- **Deck healthy state**: the header paints **LIVE** with all panes ready and stamped (${shotLive}) — the state that threw \`ReferenceError: delayed is not defined\` before \`06e4a0a\`, now proven in a real browser.
- **CLOSED labels — disposition**: no market-session CLOSED label exists anywhere in this repository (searched all served HTML/JS, case-insensitive, including "closed", "session", market-hours patterns; the only matches are WebRTC connection states and prose). The filed "CLOSED despite live feed" defect lives in the separate scintilla-hub deploy, which this branch's standing locks forbid editing. Kept visible as a cross-repo defect in the handoff; not representable, therefore not claimed, here.
`);

await close();
