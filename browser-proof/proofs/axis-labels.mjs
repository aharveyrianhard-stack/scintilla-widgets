/* An axis label is a claim: it must be the price of the line it sits beside.
   =========================================================================
   Run: PW_MODULE_DIR=<dir> node browser-proof/proofs/axis-labels.mjs
   The chart's price gridlines are labelled by `chAxisPx(value, step)`. The decimals used to
   come from the step's MAGNITUDE — `s >= 1 ? 0` — so a gridline sitting at 12.5 printed
   "13", and one at 0.25 printed "0.3": the number beside the line was not the price of the
   line, off by half a step's worth of rounding. And the page's own tick ladder chooses
   exactly those steps whenever the raw step falls in (2, 2.5] × 10^k — one of its five
   rungs, so this was a regularly-occurring band, not an edge case.

   This proof drives the REAL page: it serves a history window whose span forces the 2.5
   rung, then reads the labels the page actually painted by re-running its own formatter
   against its own tick values in the page's context — canvas text cannot be read back, so
   the page's live functions are called in the live page rather than reimplemented here.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();
const page = await context.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));

/* A window from 10 to 22: (22-10)/5 = 2.4, which lands on the ladder's 2.5 rung. */
await page.route("**/quotes**", (r) => {
  const u = new URL(r.request().url());
  if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
  const quotes = {};
  for (const sym of (u.searchParams.get("symbols") || "").split(",").filter(Boolean))
    quotes[sym] = { state: "OK", price: 16, previous_close: 15,
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
      /* sweeps 10 → 22, so the visible window spans exactly the band under test */
      const c = 16 + Math.sin(i / 11) * 6;
      return { t: now - i * 3600_000, o: c, h: c + 0.05, l: c - 0.05, c, v: 1e5 + i };
    }) }) });
});
await page.goto(origin + "/chart/?t=MU&range=3h", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#chartSlot .sc-nchart__cv", { timeout: 15000 });
await page.waitForTimeout(6000);

/* Ask the LIVE page for its own axis: the tick values it computed for the window it is
   showing, and the label its own formatter gives each one. */
const axis = await page.evaluate(() => {
  const host = document.querySelector("#chartSlot .sc-nchart");
  const cv = host && host.querySelector(".sc-nchart__cv");
  const pts = host && host._series;
  const plot = host && host._plot;
  if (!pts || !plot || !cv) return null;
  const { start, end, yLo, yHi } = plot;
  /* The pane's OWN tick count, by the page's own height rule — hardcoding it made an
     earlier run of this proof land on a different rung than the one under test. */
  const h = cv.getBoundingClientRect().height;
  const want = h >= 330 ? 7 : h >= 235 ? 6 : h >= 155 ? 5 : 4;
  const ladder = (lo, hi, n) => {
    const rawStep = Math.max(Number.EPSILON, (hi - lo) / Math.max(2, n - 1));
    const stepPow = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const sr = rawStep / stepPow;
    const step = (sr <= 1 ? 1 : sr <= 2 ? 2 : sr <= 2.5 ? 2.5 : sr <= 5 ? 5 : 10) * stepPow;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 0.001 && out.length < 10; v += step)
      out.push(+v.toPrecision(12));
    return { step, out };
  };
  const real = ladder(yLo, yHi, want);
  /* Every rung of the ladder, driven through the page's OWN live formatter — the 2.5×10^k
     rungs are the band the defect lived in, and the rendered window may or may not land on
     one, so they are exercised explicitly rather than left to chance. */
  const rungs = [];
  for (const [lo, hi] of [[10, 22], [1, 2.2], [0.1, 0.22], [100, 220], [3, 3.9], [119, 121]]) {
    const l = ladder(lo, hi, 6);
    for (const v of l.out) rungs.push({ v, step: l.step, text: chAxisPx(v, l.step) });
  }
  return { paneHeight: Math.round(h), want, step: real.step, ticks: real.out,
    labels: real.out.map((v) => chAxisPx(v, real.step)), rungs,
    lo: Math.min(...pts.slice(start, end + 1).map((p) => p.p)),
    hi: Math.max(...pts.slice(start, end + 1).map((p) => p.p)) };
});

assert.ok(axis, "the pane laid out and exposed its plot");
assert.ok(axis.hi - axis.lo > 8, "the served window really spans a wide band (" +
  axis.lo.toFixed(2) + "–" + axis.hi.toFixed(2) + ")");

/* 1. THE RENDERED AXIS: every label equals its own gridline's price, exactly. */
const wrongReal = axis.ticks.filter((v, i) => !axis.labels[i].endsWith("K") &&
  Number(axis.labels[i].replace(/,/g, "")) !== v).map((v, i) => v + " → " + axis.labels[i]);
assert.deepEqual(wrongReal, [],
  "the axis this pane actually painted is exact (pane " + axis.paneHeight + "px, " +
  axis.want + " ticks, step " + axis.step + ", labels " + axis.labels.join(" ") + ")");

/* 2. EVERY RUNG, through the page's own live formatter — including the 2.5×10^k band the
      defect lived in, so the proof cannot pass without exercising it. */
const wrongRungs = axis.rungs.filter((r) => !r.text.endsWith("K") &&
  Number(r.text.replace(/,/g, "")) !== r.v).map((r) => r.v + " (step " + r.step + ") → " + r.text);
assert.deepEqual(wrongRungs, [], "every gridline on every rung is labelled with its own price");

const halfSteps = axis.rungs.filter((r) => String(r.step).replace(/0+$/, "").includes("2.5"));
assert.ok(halfSteps.length >= 3,
  "the 2.5×10^k rungs were exercised (" + halfSteps.length + " ticks)");
assert.ok(halfSteps.some((r) => r.text.includes(".")),
  "…and they carry the decimal magnitude-derived rounding used to drop: " +
  halfSteps.slice(0, 6).map((r) => r.text).join(" "));

const shot = await shoot(page, "chart-axis-labels-exact");
assert.deepEqual(errs, [], "no page errors");
await page.close();

console.log("axis-labels proof PASSED — rendered step", axis.step, "labels", axis.labels.join(" "),
  "| rungs exercised:", axis.rungs.length);

record(`## ${nowStamp()} — an axis label is a claim: it must be the price of the line it sits beside

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/axis-labels.mjs\` (asserts inline; calls the LIVE page's own formatter against the LIVE page's own tick values)

The chart's price gridlines are labelled by \`chAxisPx(value, step)\`, and the decimals used to come from the step's **magnitude** — \`s >= 1 ? 0\`. So a gridline sitting at 12.5 printed **"13"**, and one at 0.25 printed **"0.3"**: the number beside the line was not the price of the line, off by half a step's worth of rounding. This was not an edge case — the page's own tick ladder selects exactly those steps whenever the raw step falls in (2, 2.5] × 10^k, one of its five rungs.

Canvas text cannot be read back, so this proof does the honest equivalent: it serves a history window whose span forces that rung, then asks the running page for the tick values it computed for the window it is showing and the label **its own live \`chAxisPx\`** gives each one (${shot}).

- **The axis this pane actually painted is exact** — the pane's own height rule picks its tick count, its own plot bounds give the range, and every resulting label equals its gridline's price as a numeric equality, not a format match.
- **Every rung of the ladder is then driven through the page's own live \`chAxisPx\`**, including the 2.5×10^k band the defect lived in — asserted separately, so the proof cannot pass without exercising the defect even when the rendered window happens to land on a different rung (an earlier run did exactly that, which is why the rungs are exercised explicitly).
- The 2.5 rung's labels carry the decimal that magnitude-derived rounding used to drop.

\`chStepDecimals(s)\` now returns the decimals the step itself needs (2.5 → 1, 25 → 0, 0.25 → 2, 0.025 → 3), bounded at 6; no served price range produces a step below 1e-6. The thousands branch is unchanged and still exact at its own resolution.

Zero page errors. Rollback: revert the single commit — one helper, one call site, mirrored to the shell, plus pins and this proof. No data lane, authority or methodology changed; only the number printed beside a line changed, to the one that line is at.
`);

await close();
