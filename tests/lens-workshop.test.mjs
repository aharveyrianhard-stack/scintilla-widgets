/* M65 — the Context Lens workshop.
 *
 * Alan, 24 Sep: "I never approved this to go to station. This was supposed to be a workshop that
 * I would view on more multi-charts that were going in different directions."
 *
 * So this suite pins three things:
 *   1. the workshop uses the REVIEWED rules, byte for byte — the approved look's placement rule
 *      (M47/23 Sep) and M51's opposite-zoom rule. A copy that drifts is a third lens;
 *   2. the wall really is charts going different ways, and the reasons are recorded;
 *   3. the lens is NOT on the live Station, and the workshop is not linked from the deck.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const sha = (rel) => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");

const PAGE = "workshop/context-lens/index.html";
const PICKS = JSON.parse(read("workshop/context-lens/picks.json"));

test("the workshop carries the reviewed rules byte for byte, not a second copy that can drift", () => {
  assert.equal(sha("workshop/context-lens/lens-placement.mjs"),
               sha("deliverables/20260923/context-lens-2/lens-placement.mjs"),
               "WHERE the lens sits must be the reviewed 23 Sep rule");
  assert.equal(sha("workshop/context-lens/lens-view.mjs"),
               sha("deliverables/20260924/station-calm/lens/lens-view.mjs"),
               "WHAT the lens shows must be M51's reviewed opposite-zoom rule");
});

test("six to nine charts, all different symbols, each with a recorded reason", () => {
  const picks = PICKS.picks;
  assert.ok(picks.length >= 6 && picks.length <= 9, `6 to 9 charts, got ${picks.length}`);
  assert.equal(new Set(picks.map((p) => p.symbol)).size, picks.length, "no symbol twice");
  for (const p of picks) {
    for (const field of ["symbol", "kind", "title", "plain", "day_pct", "trend20_pct", "last_session"]) {
      assert.ok(p[field] !== undefined && p[field] !== null && p[field] !== "", `${p.symbol} needs ${field}`);
    }
  }
  assert.ok(PICKS.source.includes("/candles"), "the picks must say where their numbers came from");
});

test("the wall genuinely goes in different directions, including an index and a put/call series", () => {
  const kinds = new Set(PICKS.picks.map((p) => p.kind));
  for (const want of ["up", "down", "flat", "gap", "index", "putcall"]) {
    assert.ok([...kinds].some((k) => k.startsWith(want)), `the wall is missing a ${want} chart`);
  }
  const rising = PICKS.picks.filter((p) => p.trend20_pct > 5).length;
  const falling = PICKS.picks.filter((p) => p.trend20_pct < -5).length;
  const flat = PICKS.picks.filter((p) => Math.abs(p.trend20_pct) <= 5).length;
  assert.ok(rising >= 2, `at least two rising, got ${rising}`);
  assert.ok(falling >= 2, `at least two falling, got ${falling}`);
  assert.ok(flat >= 1, `at least one going nowhere, got ${flat}`);
});

test("no second data path: the page draws the Station's own chart pane and fetches nothing off-machine", () => {
  const html = read(PAGE);
  assert.ok(html.includes("../../chart/index.html?bare=1"), "panes must be the Station's own chart page");
  assert.ok(/[?&]t=\$\{encodeURIComponent\(p\.symbol\)\}/.test(html), "the pane's own ?t= boot path carries the symbol");
  const offMachine = html.match(/fetch\(\s*["'`]https?:\/\//g) || [];
  assert.deepEqual(offMachine, [], "the workshop itself must not call any remote endpoint");
  assert.ok(!/scintilla-massive-chart-api/.test(html), "the API is reached through the pane, never by this page");
});

test("the workshop answers the Station's load admission instead of waiting out the escape hatch", () => {
  const html = read(PAGE);
  assert.ok(html.includes('d.sc === "chart-load-request"'), "it must hear the pane's request");
  assert.ok(html.includes('sc:"chart-load-grant"') || html.includes('sc: "chart-load-grant"'), "and grant it");
  assert.ok(html.includes('d.sc === "chart-load-release"'), "and free the slot again");
  assert.ok(/e\.origin !== location\.origin/.test(html), "messages from another origin are ignored");
});

test("the lens is nowhere on the live Station, and the workshop is not linked from the deck", () => {
  for (const surface of ["deck/index.html", "chart/index.html"]) {
    const src = read(surface);
    assert.ok(!/station-lens\.js|lens-placement\.mjs|lens-view\.mjs/.test(src),
      `${surface} must not mount the lens until Alan approves it on the workshop`);
    assert.ok(!/workshop\/context-lens/.test(src), `${surface} must not link the workshop`);
  }
  assert.ok(!fs.existsSync(path.join(ROOT, "_indicators/station-lens.js")),
    "the band that went to the Station on 24 Sep stays off it");
});

test("every lens style the workshop offers is one a reader can actually pick", () => {
  const html = read(PAGE);
  for (const v of ["A", "B", "C", "D"]) {
    assert.ok(html.includes(`value="${v}"`), `style ${v} must be in the switch`);
    assert.ok(html.includes(`STATE.variant === "${v}"`) || v === "A", `style ${v} must change what is drawn`);
  }
  assert.ok(/band under the chart \(what went to Station\)/.test(html),
    "the rejected band stays on the page, named for what it is, so the comparison is honest");
});
