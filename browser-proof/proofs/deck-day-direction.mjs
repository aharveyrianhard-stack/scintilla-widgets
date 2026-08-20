/* The Station wall itself refuses the day's direction when the provider's previous close is
   absent — end to end, through the deck's own quote path into a mounted shell.
   =========================================================================================
   Run: PW_MODULE_DIR=<dir> node browser-proof/proofs/deck-day-direction.mjs
   day-direction.mjs proves the refusal on standalone /chart. This one proves it where it
   actually matters: on /deck, the Station wall, whose panes are `/station-shells/chart-v1`
   iframes fed by the DECK's own quote reader. That path is different in every step —
   deck fetches live_quotes, the provider shim rewrites the read to the provider's /quotes,
   deck maps the row, posts it across the frame boundary, and the shell's scChartLive puts
   the previous close into the map the pane colour is drawn from. A fix that held on the
   standalone page and broke anywhere along that chain would leave the wall still lying, so
   the wall is asserted on its own.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();

/* Count what a mounted pane actually painted, inside its iframe. */
async function paneColorIn(frame) {
  return frame.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const hex = (n, fb) => {
      const raw = (cs.getPropertyValue(n) || fb).trim().replace("#", "");
      return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16));
    };
    const targets = { bull: hex("--bull", "00FFA3"), bear: hex("--bear", "FF2D55"), neutral: hex("--ink2", "C6C8DE") };
    const cv = document.querySelector(".sc-nchart__cv");
    if (!cv) return { counts: { bull: 0, bear: 0, neutral: 0 }, winner: "no-canvas" };
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
    const counts = { bull: 0, bear: 0, neutral: 0 };
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      for (const [name, t] of Object.entries(targets)) {
        const d = Math.abs(data[i] - t[0]) + Math.abs(data[i + 1] - t[1]) + Math.abs(data[i + 2] - t[2]);
        if (d <= 24) counts[name] += 1;
      }
    }
    const w = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { counts, winner: w[1] > 0 ? w[0] : "none",
      badge: (document.querySelector(".sc-nchart__live-change") || {}).textContent || "" };
  });
}

async function wallWith(previousClose) {
  const page = await context.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
  /* The deck's live_quotes read is rewritten by the provider shim to the provider's own
     /quotes endpoint, so THAT is where the previous close must be varied — the same lesson
     day-direction.mjs learned on its first run. */
  await page.route("**/quotes**", (r) => {
    const u = new URL(r.request().url());
    if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
    const quotes = {};
    for (const sym of (u.searchParams.get("symbols") || "").split(",").filter(Boolean))
      quotes[sym] = { state: "OK", price: 120, previous_close: previousClose,
        price_observation_utc: new Date().toISOString() };
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ quotes }) });
  });
  await page.route("**/candles**", (r) => {
    const u = new URL(r.request().url());
    if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
    const lim = Math.min(400, Number(u.searchParams.get("limit") || 200));
    const now = Date.now();
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      series: Array.from({ length: lim }, (_, i) => {
        const c = 120 + Math.sin(i / 7) * 0.5;
        return { t: now - i * 3600_000, o: c - 0.1, h: c + 0.2, l: c - 0.2, c, v: 1e5 + i };
      }) }) });
  });
  await page.goto(origin + "/deck/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(11000);   /* the wall mounts its shells, then quotes arrive */
  const shellFrames = page.frames().filter((f) => f.url().includes("/station-shells/chart-v1"));
  assert.ok(shellFrames.length > 0, "the wall mounted at least one chart shell");
  const panes = [];
  for (const f of shellFrames) panes.push(await paneColorIn(f).catch(() => null));
  return { page, errs, panes: panes.filter(Boolean), frameCount: shellFrames.length };
}

/* ---- 1: the provider states a previous close BELOW the price — the wall claims UP ---- */
const known = await wallWith(100);
const knownPainted = known.panes.filter((p) => p.winner !== "no-canvas" && p.winner !== "none");
assert.ok(knownPainted.length > 0, "at least one mounted pane painted a series");
for (const p of knownPainted) {
  assert.equal(p.winner, "bull", "a stated previous close below the price paints bull on the WALL " + JSON.stringify(p.counts));
  assert.equal(p.counts.bear, 0);
}
const shotKnown = await shoot(known.page, "deck-wall-day-baseline-known-up");
assert.deepEqual(known.errs, [], "no page errors on the wall");
await known.page.close();

/* ---- 2: THE FIX ON THE WALL. The provider states no previous close — nothing is claimed ---- */
const unknown = await wallWith(null);
const unknownPainted = unknown.panes.filter((p) => p.winner !== "no-canvas" && p.winner !== "none");
assert.ok(unknownPainted.length > 0, "the panes still paint their series — neutral, not absent");
for (const p of unknownPainted) {
  assert.equal(p.counts.bull, 0, "no pane on the wall claims UP off an absent previous close " + JSON.stringify(p.counts));
  assert.equal(p.counts.bear, 0, "and none claims DOWN " + JSON.stringify(p.counts));
  assert.equal(p.winner, "neutral");
  if (p.badge) assert.equal(p.badge.trim(), "—", "the badge refuses too, on the wall");
}
const shotUnknown = await shoot(unknown.page, "deck-wall-day-baseline-unknown-neutral");
assert.deepEqual(unknown.errs, [], "no page errors on the wall");
await unknown.page.close();

console.log("deck-day-direction proof PASSED —", unknownPainted.length,
  "mounted panes refuse the direction when the provider states no previous close");

record(`## ${nowStamp()} — the Station WALL refuses the day's direction when the provider states no previous close

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/deck-day-direction.mjs\` (asserts inline; reads the canvas pixels INSIDE the mounted shell iframes)

\`day-direction.mjs\` proves the refusal on standalone \`/chart\`. This proves it where it matters: on \`/deck\`, whose panes are \`/station-shells/chart-v1\` iframes fed by the **deck's own** quote path — deck reads live_quotes, the provider shim rewrites that read to the provider's \`/quotes\`, deck maps the row and posts it across the frame boundary, and the shell's \`scChartLive\` puts the previous close into the map the pane colour is drawn from. A fix that held on the standalone page and broke anywhere along that chain would leave the wall still lying, so the wall is asserted on its own.

- **The provider states a previous close below the price** (${shotKnown}): every painted pane on the wall is **bull**, zero bear pixels — the claim still gets made when it is earned.
- **The provider states NO previous close — the fix** (${shotUnknown}): every painted pane is **neutral**, with **zero bull and zero bear pixels**, and each pane's badge reads \`—\`. The series is still drawn; only the directional claim is withdrawn. Before this fix the wall painted a confident green or red here, from the first bar of whatever window happened to be loaded.

Zero page errors on the wall in both states.

Rollback: this proof is evidence only — it changes nothing. The unit it covers reverts with \`chDayRef\`'s commit.
`);

await close();
