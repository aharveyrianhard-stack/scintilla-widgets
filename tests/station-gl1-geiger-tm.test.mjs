// GL1 (7 Oct 2026) — the Station chip shows trend and momentum apart and says which reading it is.
// Alan: "I would like to see [trend and momentum] separately." Off unless switched on: no look change before he has seen it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("../_indicators/station-geiger-bar.js");
const B = globalThis.SC_GEIGER_BAR;
const read = (rel) => fs.readFileSync(new URL("../" + rel, import.meta.url), "utf8");
const NOW = Date.parse("2026-10-07T18:08:00Z");
const row = { ticker: "MU", composite: 0.57, trend: 0.63, momentum: 0.51, reading: "live", price_utc: "2026-10-07T18:07:00Z", computed_utc: "2026-10-07T18:06:00Z" };

test("off unless switched on", () => {
  assert.equal(B.tmOn(), false);
  globalThis.SC_GL1_TM = true; assert.equal(B.tmOn(), true); delete globalThis.SC_GL1_TM;
  globalThis.location = { href: "https://station.scintillahub.ai/chart/?t=MU&gl1=1" }; assert.equal(B.tmOn(), true);
  globalThis.location = { href: "https://station.scintillahub.ai/chart/?t=MU&gl1=10" }; assert.equal(B.tmOn(), false);
  delete globalThis.location;
});

test("the reading carries trend, momentum, which reading it is and its newest price — only when the row has them", () => {
  const r = B.readingsFrom([row], "PROVIDER_EQUALIZER").MU;
  assert.deepEqual(r, { composite: 0.57, stamp: "2026-10-07T18:06:00Z", source: "PROVIDER_EQUALIZER", trend: 0.63, momentum: 0.51, reading: "live", price_utc: "2026-10-07T18:07:00Z" });
  const old = B.readingsFrom([{ ticker: "ES", composite: 0.2, updated_ts: 1791396360 }], "RETAINED_NON_EQUITY").ES;
  assert.deepEqual(old, { composite: 0.2, stamp: 1791396360, source: "RETAINED_NON_EQUITY" }, "a row without them is exactly the reading it was");
});

test("the model: +0.57 · T +0.63 · M +0.51, two thin bars on the Geiger's own scale, and the reading with its age in the hover", () => {
  const m = B.model(B.readingsFrom([row], "PROVIDER_EQUALIZER").MU, NOW);
  assert.equal(m.text, "+0.57", "the chip's own number is what it was");
  assert.equal(m.tm.text, "+0.57 · T +0.63 · M +0.51");
  assert.deepEqual([m.tm.trend.fillPct, m.tm.trend.side, m.tm.momentum.fillPct, m.tm.momentum.side], [31.5, "up", 25.5, "up"]);
  assert.equal(m.reading, "live"); assert.equal(m.priceAgeMs, 60000);
  assert.match(m.title, /\ntrend \+0\.63 · momentum \+0\.51\nLIVE: every rung counts the bar it is still building · newest price 1 min old$/);
  assert.equal(B.tmBarsHTML(m), '<span class="sc-gbar sc-gbar--thin" data-k="T" data-side="up"><i style="left:50%;width:31.50%"></i></span><span class="sc-gbar sc-gbar--thin" data-k="M" data-side="up"><i style="left:50%;width:25.50%"></i></span>');
  // trend up, momentum down: each bar its own way and its own colour (Caterpillar at 14:07 on 7 Oct)
  const cat = B.model({ composite: -0.15, trend: 0.2, momentum: -0.51, reading: "live", stamp: "2026-10-07T18:06:00Z", source: "PROVIDER_EQUALIZER" }, NOW);
  assert.deepEqual([cat.side, cat.tm.trend.side, cat.tm.momentum.side, cat.tm.text], ["down", "up", "down", "−0.15 · T +0.20 · M −0.51"]);
  // a settled reading says so; a reading that names neither says nothing about it
  assert.match(B.model({ composite: 0.4, trend: 0.5, momentum: 0.3, reading: "settled", price_utc: "2026-10-07T16:00:00Z", stamp: "2026-10-07T18:06:00Z", source: "PROVIDER_EQUALIZER" }, NOW).title, /SETTLED: finished bars only · newest price 2 h old$/);
  const plain = B.model({ composite: 0.4, stamp: "2026-10-07T18:06:00Z", source: "PROVIDER_EQUALIZER" }, NOW);
  assert.equal(plain.tm, null); assert.equal(plain.reading, null); assert.equal(B.tmBarsHTML(plain), "");
  assert.doesNotMatch(plain.title, /LIVE|SETTLED|trend/);
});

test("both chart shells draw it only behind the switch, and are still one file in two places", () => {
  const a = read("chart/index.html"), b = read("station-shells/chart-v1/index.html");
  assert.equal(a, b, "chart/index.html and station-shells/chart-v1/index.html are identical copies");
  assert.match(a, /const gl1 = !!\(B\.tmOn && B\.tmOn\(\) && m\.tm\);/);
  assert.match(a, /node\.querySelector\("\.sc-gbar__v"\)\.textContent = m\.text;/, "off, or on a narrow pane, the chip's number is the Geiger's own");
  assert.match(a, /if \(gl1 && String\(node\.dataset\.size \|\| ""\)\.charAt\(0\) !== "s"\) node\.querySelector\("\.sc-gbar__v"\)\.textContent = m\.tm\.text;/);
  assert.match(a, /\.sc-nchart__live-geiger\[data-gl1\] \.sc-gbar--thin\{[^}]*height:2px;/);
});

test("the provider client passes the reading and its price time through, and invents neither", () => {
  const p = read("_provider/provider.js");
  assert.match(p, /reading: value\.reading === 'live' \|\| value\.reading === 'settled' \? value\.reading : null,\s*\n\s*price_utc: value\.price_utc \|\| null,/);
  // the Equalizer receipt pin is untouched: GL1 changes no weight, so the accepted receipts stay as they are
  assert.match(p, /var ACCEPTED_EQUALIZER_SHA256S = \[ACCEPTED_EQUALIZER_SHA256,/);
});
