/* The pane's direction color is claimed from the day's baseline, or not claimed at all.
   ====================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/day-direction.mjs
   This one reads PIXELS, not text. The defect it proves fixed was invisible to every source
   pin and to every text assertion: the badge honestly said "—" when the provider's previous
   close was unknown, while the pane behind it was painted bull or bear anyway, from
   `pts[0].p` — the first bar of the LOADED WINDOW. That baseline moves with the range
   control, so the same prices could paint green at one range and red at another with no
   market event between them, and on a wall the color is what gets read.

   Three scenarios, same page, same series, only the previous close changing:
     baseline KNOWN and below price  -> badge percentage UP,   pane BULL
     baseline KNOWN and above price  -> badge percentage DOWN, pane BEAR
     baseline UNKNOWN (null)         -> badge "—",             pane NEUTRAL, never bull/bear
   The third is the fix. Before it, that same scenario painted a confident direction.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();

/* Classify what the pane actually painted: sample the canvas and count pixels near each
   palette color the draw path can use. The line is a 2px stroke plus a filled end dot in
   the same color, so its core pixels land within a tight distance of the exact token. */
async function paneColor(page) {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const hex = (n, fb) => {
      const raw = (cs.getPropertyValue(n) || fb).trim().replace("#", "");
      return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16));
    };
    const targets = { bull: hex("--bull", "00FFA3"), bear: hex("--bear", "FF2D55"), neutral: hex("--ink2", "C6C8DE") };
    const cv = document.querySelector("#chartSlot .sc-nchart .sc-nchart__cv");
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const { data, width, height } = ctx.getImageData(0, 0, cv.width, cv.height);
    const counts = { bull: 0, bear: 0, neutral: 0 };
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;                 /* the gradient fill is translucent */
      for (const [name, t] of Object.entries(targets)) {
        const d = Math.abs(data[i] - t[0]) + Math.abs(data[i + 1] - t[1]) + Math.abs(data[i + 2] - t[2]);
        if (d <= 24) counts[name] += 1;                 /* tight: antialiasing is excluded */
      }
    }
    const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { counts, winner: winner[1] > 0 ? winner[0] : "none", width, height, targets };
  });
}

async function paneState(page, prevCloseValue) {
  const page1 = await context.newPage();
  const errs = []; page1.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
  /* Only the previous close changes between scenarios. Price and history are identical, so
     any difference in what the pane paints is caused by the baseline and nothing else.
     MU is a provider-owned equity, so its quote does NOT come from live_quotes: the shim
     rewrites that read to the provider's own /quotes endpoint, which is where the previous
     close actually lives. Routing live_quotes here would never fire — the first run of this
     proof proved exactly that, and the rewrite is the authority working as designed. */
  await page1.route("**/quotes**", (r) => {
    const u = new URL(r.request().url());
    if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
    const wanted = (u.searchParams.get("symbols") || "").split(",").filter(Boolean);
    const quotes = {};
    for (const sym of wanted)
      quotes[sym] = { state: "OK", price: 120, previous_close: prevCloseValue,
        price_observation_utc: new Date().toISOString() };
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ quotes }) });
  });
  /* Hold the HISTORY identical across all three scenarios too, and consistent with the
     injected quote. The pane's direction compares the series' last point to the baseline
     while the badge compares the live quote to it — they normally agree because a live tick
     patches the last point, but a proof must not depend on that: pinning both here means the
     ONLY thing differing between the three runs is the previous close. */
  await page1.route("**/candles**", (r) => {
    const u = new URL(r.request().url());
    if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
    const lim = Math.min(400, Number(u.searchParams.get("limit") || 200));
    const now = Date.now();
    const series = Array.from({ length: lim }, (_, i) => {
      const c = 120 + Math.sin(i / 7) * 0.5;   /* a real line, never near 100 or 150 */
      return { t: now - i * 3600_000, o: c - 0.1, h: c + 0.2, l: c - 0.2, c, v: 1e5 + i };
    });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ series }) });
  });
  await page1.goto(origin + "/chart/?t=MU&range=3h", { waitUntil: "domcontentloaded" });
  await page1.waitForSelector("#chartSlot .sc-nchart__cv", { timeout: 15000 });
  await page1.waitForTimeout(6000);
  const badge = await page1.$eval("#chartSlot .sc-nchart__live-change", (n) => n.textContent.trim())
    .catch(() => "");
  const color = await paneColor(page1);
  return { page: page1, errs, badge, color };
}

/* ---- 1: the baseline is KNOWN and below the price — an UP day, claimed by both ---- */
const up = await paneState(null, 100);
assert.match(up.badge, /^20\.00%$/, "the badge computes the day from the provider's previous close");
assert.equal(up.color.winner, "bull", "…and the pane agrees: bull (" + JSON.stringify(up.color.counts) + ")");
assert.equal(up.color.counts.bear, 0, "an up day paints no bear pixels");
const shotUp = await shoot(up.page, "chart-day-baseline-known-up");
assert.deepEqual(up.errs, []);
await up.page.close();

/* ---- 2: the baseline is KNOWN and above the price — a DOWN day, claimed by both ---- */
const down = await paneState(null, 150);
assert.match(down.badge, /^\(20\.00%\)$/, "the badge says down");
assert.equal(down.color.winner, "bear", "…and the pane agrees: bear (" + JSON.stringify(down.color.counts) + ")");
assert.equal(down.color.counts.bull, 0, "a down day paints no bull pixels");
const shotDown = await shoot(down.page, "chart-day-baseline-known-down");
assert.deepEqual(down.errs, []);
await down.page.close();

/* ---- 3: THE FIX. The baseline is UNKNOWN — no direction is claimed, in text OR in paint ---- */
const unknown = await paneState(null, null);
assert.equal(unknown.badge, "—", "the badge refuses the day without a previous close");
assert.equal(unknown.color.winner, "neutral",
  "the PANE refuses too — this is the defect: it used to paint bull/bear from the window's " +
  "first bar (" + JSON.stringify(unknown.color.counts) + ")");
assert.equal(unknown.color.counts.bull, 0, "not one bull pixel is painted off an unknown baseline");
assert.equal(unknown.color.counts.bear, 0, "not one bear pixel either");
assert.ok(unknown.color.counts.neutral > 20, "the series is still drawn — neutral, not absent");
const shotUnknown = await shoot(unknown.page, "chart-day-baseline-unknown-neutral");
assert.deepEqual(unknown.errs, []);
await unknown.page.close();

/* ---- 4: the series itself is identical across all three — the baseline is the only cause ---- */
assert.equal(up.color.width, unknown.color.width, "same canvas");
assert.equal(up.color.height, unknown.color.height, "same canvas");

console.log("day-direction proof PASSED — up/down claimed, unknown refused in text AND paint");

record(`## ${nowStamp()} — the pane's direction color is claimed from the day's baseline, or not claimed at all

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/day-direction.mjs\` (asserts inline; reads CANVAS PIXELS, not text)

The defect this proves fixed was invisible to source pins and to every text assertion: \`chDayChange\` already refused to state a day change without the provider's previous close (the badge said "—"), but the pane behind it was painted bull or bear regardless, because the draw path's baseline fell back to \`pts[0].p\` — the first bar of the LOADED WINDOW. That baseline moves with the range control, so the same prices could paint green at one range and red at another with no market event between them. On a wall, the color is what gets read.

Three scenarios on the same page with the same history, only the previous close changing — the pane's painted pixels counted against the \`--bull\`/\`--bear\`/\`--ink2\` tokens at a tight distance so antialiasing cannot vote:

- **Baseline known, below price** (${shotUp}): badge \`20.00%\`, pane **bull**, zero bear pixels.
- **Baseline known, above price** (${shotDown}): badge \`(20.00%)\`, pane **bear**, zero bull pixels.
- **Baseline UNKNOWN — the fix** (${shotUnknown}): badge \`—\`, pane **neutral**, **zero bull pixels and zero bear pixels**, with the series still drawn (neutral, not absent). Before this unit that same scenario painted a confident direction from a number nobody sent.

Zero page errors in all three. The mounted \`/station-shells/chart-v1\` is the byte-exact mirror of this file (gate-enforced), so the Station wall's panes carry the same refusal.

Rollback: revert the single commit — \`chDayRef()\`, the neutral branch, the removal of the three \`_ref\` substitution writes, pins and this proof. No data lane, authority or methodology changed; the previous close itself is read exactly as before.
`);

await close();
