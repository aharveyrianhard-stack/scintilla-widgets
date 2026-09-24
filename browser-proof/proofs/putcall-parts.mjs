/* PUTS AND CALLS AS TWO BARS — the pane at 1680 and at 390, in both of its states.
   ====================================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> PLAYWRIGHT_CHROMIUM=<chrome-headless-shell> \
        node browser-proof/proofs/putcall-parts.mjs

   Two scenarios on the PCCE pane, differing only in what the chart API answers:
     1. the series carries the two volumes  -> two bars, the amounts, and which side moved;
     2. the series carries the ratio only   -> the pane says, in words, that it is waiting for
                                               the reader, and still shows the published ratio.
   Scenario 2 is the true state of the world tonight: the stored Cboe document predates the
   two-part collector, so nothing has the volumes yet. Scenario 1 is what the same pane draws
   once that collector runs.

   Headless shell (it cannot open a window at all - never on Alan's screen). The Cboe numbers
   below are the real 2026-09-23 file (equity: calls 2,647,370, puts 1,205,941, ratio 0.46) and
   the session before it, served from this proof: this proves the PANE, not the owner's data.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const UNIVERSE = JSON.parse(fs.readFileSync(new URL("../universe-20260924.json", import.meta.url)));
const { context, origin, close } = await launch();
const DAYS = 40;

/* One number per session, with the two volumes behind it when `parts` is true. The last two
   sessions are the real ones: puts 1,000,000 -> 1,205,941 (up 21%) and calls 2,500,000 ->
   2,647,370 (up 6%), so the ratio rises from 0.40 to 0.46 and the sentence has both sides. */
const cboeSeries = (parts) => {
  const day = 86400000, now = Date.now();
  const out = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const c = 0.9 + Math.sin(i / 5) * 0.08;
    const bar = { t: now - i * day, o: c, h: c, l: c, c, v: 3_500_000 };
    if (parts) { bar.cv = 2_400_000 + i * 1000; bar.pv = Math.round(bar.cv * c); }
    out.push(bar);
  }
  if (parts) {
    Object.assign(out[out.length - 2], { o: 0.4, h: 0.4, l: 0.4, c: 0.4, pv: 1_000_000, cv: 2_500_000 });
    Object.assign(out[out.length - 1], { o: 0.46, h: 0.46, l: 0.46, c: 0.46, pv: 1_205_941, cv: 2_647_370, v: 3_853_311 });
  }
  return out;
};

async function pane({ parts, width, height, label }) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  const errs = []; page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
  await page.route("**/universe**", (r) => {
    const u = new URL(r.request().url());
    if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(UNIVERSE) });
  });
  await page.route("**/candles**", (r) => {
    const u = new URL(r.request().url());
    if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
    const sym = (u.searchParams.get("symbol") || "").toUpperCase();
    if (sym === "PCCE")
      return r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ series: cboeSeries(parts), provider: "CBOE", provider_symbol: "EQUITY PUT/CALL RATIO" }) });
    /* Scintilla's own intraday line is not served tonight, which is the truth. */
    return r.fulfill({ status: 404, contentType: "application/json",
      body: JSON.stringify({ absence: "NOT_SERVED_BY_CHART_API" }) });
  });
  await page.goto(origin + "/chart/?t=PCCE&range=3m", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#chartSlot .sc-nchart__cv", { timeout: 20000 });
  await page.waitForTimeout(7000);
  const read = await page.evaluate(() => {
    const host = document.querySelector("#chartSlot .sc-nchart");
    const box = host?.querySelector(".sc-nchart__live-parts");
    const fills = [...(box?.querySelectorAll(".sc-nchart__pcp-fill") || [])];
    const vals = [...(box?.querySelectorAll(".sc-nchart__pcp-val") || [])].map((e) => e.textContent.trim());
    const labels = [...(box?.querySelectorAll(".sc-nchart__pcp-label") || [])].map((e) => e.textContent.trim());
    const move = box?.querySelector(".sc-nchart__pcp-move");
    const r = box?.getBoundingClientRect();
    return {
      state: box?.dataset?.state || null,
      text: (box?.textContent || "").trim(),
      labels, vals,
      fillWidths: fills.map((f) => Math.round(f.getBoundingClientRect().width)),
      fillChange: fills.map((f) => f.dataset.change),
      fillColors: fills.map((f) => getComputedStyle(f).backgroundColor),
      trackColor: box?.querySelector(".sc-nchart__pcp-track") ? getComputedStyle(box.querySelector(".sc-nchart__pcp-track")).backgroundColor : null,
      move: (move?.textContent || "").trim(),
      moveTitle: move?.title || "",
      fontPx: box ? getComputedStyle(box.querySelector(".sc-nchart__pcp-val") || box).fontSize : null,
      right: r ? Math.round(r.right) : null, innerWidth: window.innerWidth,
      ratioLine: (host?.querySelector(".sc-nchart__live-change")?.textContent || "").trim(),
      companion: (host?.querySelector(".sc-nchart__live-companion")?.textContent || "").trim()
    };
  });
  const shot = await shoot(page, `putcall-parts-${label}-${width}`);
  await page.close();
  return { read, shot, errs };
}

const out = {};
for (const [label, parts] of [["served", true], ["waiting", false]])
  for (const [w, h] of [[1680, 1050], [390, 844]])
    out[`${label}-${w}`] = await pane({ parts, width: w, height: h, label });

for (const [k, v] of Object.entries(out)) {
  assert.equal(v.errs.length, 0, `${k}: page errors ${v.errs.join(" | ")}`);
  assert.ok(Number(parseFloat(v.read.fontPx)) >= 11, `${k}: body text must be at least 11px, got ${v.read.fontPx}`);
  assert.ok(v.read.right <= v.read.innerWidth, `${k}: the parts row must not run off the pane (${v.read.right} > ${v.read.innerWidth})`);
}
for (const k of ["served-1680", "served-390"]) {
  const r = out[k].read;
  assert.equal(r.state, "ready", `${k}: the two bars must be drawn`);
  assert.deepEqual(r.labels, ["PUTS", "CALLS"], `${k}: both sides are named`);
  assert.deepEqual(r.vals, ["1.21M", "2.65M"], `${k}: the two amounts, as published`);
  assert.ok(r.fillWidths[1] > r.fillWidths[0], `${k}: calls traded more, so its bar is longer (${r.fillWidths})`);
  assert.deepEqual(r.fillChange, ["up", "up"], `${k}: both sides rose against the session before`);
  assert.equal(r.move, "puts up 21%, calls up 6% → the ratio rose", `${k}: the movement sentence`);
  assert.match(r.moveTitle, /lower number means fewer puts per call/, `${k}: the fraction is explained on hover`);
  assert.match(r.moveTitle, /1,205,941 ÷ calls 2,647,370 = 0\.4555; the publisher printed 0\.46/, `${k}: the check is shown, not hidden`);
  assert.match(r.ratioLine, /^0\.46/, `${k}: the published ratio still leads the pane`);
}
for (const k of ["waiting-1680", "waiting-390"]) {
  const r = out[k].read;
  assert.equal(r.state, "waiting", `${k}: with no volumes the pane waits, in words`);
  assert.match(r.text, /waiting for the reader/, `${k}: and says what it waits for`);
  assert.equal(r.labels.length, 0, `${k}: no empty bars are drawn`);
  assert.match(r.ratioLine, /^0\./, `${k}: the published ratio is still shown`);
}
/* The track is grey (channels within 24 of each other, nothing above 210) and the fills are the
   Station's own direction colours, so the look rule holds. */
const track = out["served-1680"].read.trackColor.match(/\d+/g).map(Number).slice(0, 3);
assert.ok(Math.max(...track) - Math.min(...track) <= 24 && Math.max(...track) <= 210,
  `the bar track must be grey, got ${track}`);

record([`## put/call: puts and calls as two bars (${nowStamp()})`, "",
    `Command: \`PW_MODULE_DIR=… PLAYWRIGHT_CHROMIUM=<headless shell> node browser-proof/proofs/putcall-parts.mjs\``,
    "",
    "Real Chromium headless shell over the served repository; the chart API answered from this",
    "proof with the real 2026-09-23 Cboe equity numbers. Asserts inline.",
    "",
    ...Object.entries(out).map(([k, v]) =>
      `- **${k}** — state \`${v.read.state}\`, ${v.read.labels.join("/") || "no bars"} ` +
      `${v.read.vals.join(" ")} ${v.read.fillWidths.join("px/")}px; “${v.read.move || v.read.text}” → \`${v.shot}\``)
  ].join("\n"));

console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { ...v.read, shot: v.shot }])), null, 1));
await close();
