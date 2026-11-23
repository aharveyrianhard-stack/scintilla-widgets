/* 22 Nov 2026 (coordinator). Alan, relayed by the markets session (dispatch STATION-20261122-01), then his reaction to the first version
   (23:30): "Walls, like that tiny?", no "pick a name" - one button to a screen with ALL names; the tapes "super basic", "I read so much",
   "This does not look at all like the tape of the economic section in Scintilla Hub. That's the best one."; on the Station "it's widgets
   and headlights and signals". These tests hold what was built for that. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page = readFileSync(new URL("../broadcast/index.html", import.meta.url), "utf8");
const css = page.slice(page.indexOf("<style>"), page.indexOf("</style>"));

test("VOLUME AT RESISTANCE: a name that says what it is, fourteen lights, one button to every name - no 'Walls', no picking", () => {
  assert.match(page, /<span class="lab">Volume at resistance<\/span><button class="wbtn lab" id="wallsAllBtn">All names →<\/button>/);
  assert.doesNotMatch(page, />\s*Walls\b/, "the word that told him nothing is gone from what he sees");
  const code = page.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");   /* the notes may quote him; the page may not do it */
  assert.doesNotMatch(code, /pick a name|openPick|wpick|SLOTS_KEY/, "no picking");
  assert.match(css, /\.lights\{[^}]*grid-template-columns:repeat\(4,1fr\); grid-template-rows:repeat\(4,42px\)/);
  assert.match(page, /\.slice\(0, 14\)/, "fourteen places, fixed - nothing moves");
  assert.match(page, /const WALL_NAMES0 = \["SPY", "QQQ", "SMH", "SOXX", "NVDA", "MU", "SNDK", "NBIS", "CRWV", "IREN", "AVGO", "GOOGL", "AMZN", "META"\]/);
  assert.match(page, /if \(t\.classList\.contains\("go"\)\) openTargets\(\); else openWallsAll\(\);/, "any light opens every name");
});

test("BOUNCE TARGETS: the markets session's page over the whole stage, loaded on open and dropped on close", () => {
  assert.match(page, /TARGETS_URL = VP \+ "\/targets\.html"/);
  assert.match(page, /go\.textContent = "Bounce targets →"/);
  assert.match(page, /function closeTargets\(\) \{ const o = el\("targetsAll"\); o\.hidden = true; const f = o\.querySelector\("iframe"\); if \(f\) f\.remove\(\); \}/);
  assert.match(css, /#wallsAll\[hidden\], #targetsAll\[hidden\]\{ display:none; \}/, "the overlays really hide (their display:flex would beat [hidden])");
});

test("the feed is the markets session's, read-only; its states and thresholds are theirs", () => {
  assert.match(page, /getJSON\(VP \+ "\/api\/walls"\)/);
  assert.doesNotMatch(page, /volX\s*>=\s*1\.3\s*&&|upShare\s*>=\s*0\.6\s*&&/, "no state is decided here");
  assert.match(page, /m >= 235 && m <= 1210/); assert.match(page, /wallsHours\(\) \? 30000 : 300000/);
});

test("a loud state flashes its light, takes the spotlight (three or more = one line) and lands in the SCINTILLAS tape - never the backlog, never twice in 20 minutes, no sound", () => {
  assert.match(page, /const WALL_LOUD = \{ PUSHING: "up", BROKE: "up", REJECTED: "dn", LOSING: "dn" \}/);
  assert.match(page, /announce\("walls"/); assert.match(page, /kind: "At resistance"/);
  assert.match(page, /if \(was === undefined \|\| was === r\.state\) continue;/);
  assert.match(page, /Date\.now\(\) - WSEEN\[k\] < 1200000/);
  assert.match(page, /fresh\.length >= 3/);
  assert.match(page, /D\.wallEv\.map\(wallMoveItem\)/);
  assert.match(page, /const d = LIGHTS\[r\.s\]; if \(d\) \{ d\.classList\.remove\("flash"\); void d\.offsetWidth; d\.classList\.add\("flash"\); \}/);
  assert.doesNotMatch(page, /AudioContext|new Audio\(/);
});

test("the full screens go back to the Station by themselves (the TV has no hands); Escape closes them", () => {
  assert.match(page, /!el\("wallsAll"\)\.hidden && Date\.now\(\) - LAST_INPUT > 120000\) closeWallsAll\(\)/);
  assert.match(page, /Date\.now\(\) - LAST_INPUT > 600000 && document\.activeElement !== tf\) closeTargets\(\)/);
  assert.match(page, /e\.key === "Escape"\) \{ closeWallsAll\(\); closeTargets\(\); \}/);
});

test("each tape row IS the Hub header tape: hairline frame, label cell, letter-spaced 30 px type, dots, and the day-in-dots box", () => {
  assert.match(css, /\.row\{[^}]*border:1px solid rgba\(0,212,255,\.34\)/);
  assert.match(css, /\.row\.tape\{ grid-template-columns:340px 1fr 640px; \}/);
  assert.match(css, /\.track\{[^}]*font-size:var\(--s2\); font-weight:400; letter-spacing:\.04em/);
  assert.match(css, /\.box\{[^}]*text-transform:uppercase/);
  assert.match(page, /<div class="box"><\/div>/);
  assert.match(page, /'<span class="blab">Next<\/span>'/); assert.match(page, /'<span class="blab">Earnings<\/span>'/);
  assert.match(page, /<\/b> DUE · " \+ inTxt\(first\.at - now\)/, "MON · 3 DUE · IN 9H");
  assert.match(page, /setInterval\(paintBoxes, 1000\)/);
});

test("releases are the Hub's own tape list: its noise filter, its composite grouping, its short names", () => {
  assert.match(page, /const EC_NOISE = \/\(\^eia /);
  for (const tag of ["CPI", "PPI", "PCE", "JOBS", "CLAIMS", "PMI"]) assert.ok(page.includes('tag: "' + tag + '"'), tag);
  assert.match(page, /\[\/\\bS&P Global\\b\/i, "S&P"\]/);
  const src = page.slice(page.indexOf("const EC_SHORT"), page.indexOf("const ecFam"));
  const ecShort = new Function(src + "; return ecShort;")();
  assert.equal(ecShort("S&P Global Composite PMI (Nov)"), "S&P Composite PMI");
  assert.equal(ecShort("Fed Williams Speech"), "Williams speaks");
  assert.equal(ecShort("Initial Jobless Claims"), "Jobless Claims");
});

test("the standing numbers left the tape for the spotlight's rotation (Fed odds, inflation and breakevens, the ratio pairs)", () => {
  assert.doesNotMatch(page, /function macroItems|RATIOS<\/span>/);
  assert.match(page, /kind: "Fed odds", when: "Polymarket"/); assert.match(page, /kind: "Inflation"/); assert.match(page, /kind: "Ratios"/);
});

test("the dots: the Hub's timing, the state set on the drawn items (never in the text), one hard pulse per tape, a swarm not a metronome", () => {
  assert.match(css, /\.s-soon \.dot, \.dot\.s-soon\{ animation:breathe 2\.4s/);
  assert.match(css, /\.s-near \.dot, \.dot\.s-near\{ animation:breathe 1\.1s/);
  assert.match(css, /\.s-due \.dot, \.dot\.s-due\{ animation:hard \.38s/);
  assert.match(css, /\.sw \.dot:nth-child\(2n\)\{ animation-duration:1\.7s; \}/);
  assert.match(page, /if \(s === "s-due"\) \{ if \(hard\) s = "s-near"; else hard = true; \}/);
  const src = page.slice(page.indexOf("function dotState"), page.indexOf("function refreshDots"));
  const dotState = new Function(src + "; return dotState;")();
  const now = Date.UTC(2026, 10, 23, 13, 50), m = 60000;
  assert.equal(dotState("econ", now + 61 * m, false, true, now), "s-up");
  assert.equal(dotState("econ", now + 30 * m, false, true, now), "s-soon");
  assert.equal(dotState("econ", now + 5 * m, false, true, now), "s-near");
  assert.equal(dotState("econ", now - 20 * m, false, true, now), "s-due");
  assert.equal(dotState("econ", now - 20 * m, false, false, now), "s-past");
  assert.equal(dotState("move", now - 3 * m, false, false, now), "s-due");
  assert.equal(dotState("move", now - 90 * m, false, false, now), "s-past");
});
