/* 22 Nov 2026 (coordinator). Alan, relayed by the markets session (dispatch STATION-20261122-01): a "Walls · volume at resistance"
   widget on the live Station - "a couple of these ... that he can switch between target names, with a button that opens the full screen
   of all names" - and the Station's tapes in the look of his favourite tape, the Hub's economic one (the flashing dots). These tests hold
   what was built. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page = readFileSync(new URL("../broadcast/index.html", import.meta.url), "utf8");
const css = page.slice(page.indexOf("<style>"), page.indexOf("</style>"));

test("WALLS sits under the relative volume: two rows, a name picker, an ALL button, inside the 636 x 640 column", () => {
  assert.match(page, /<div id="walls">/);
  assert.equal((page.match(/class="wrow" data-slot="\d"/g) || []).length, 2, "two rows");
  assert.match(page, /id="wallsAllBtn"/); assert.match(page, /<div id="wallsAll" hidden>/); assert.match(page, /<div id="wpick" hidden><\/div>/);
  assert.match(css, /\.wrows\{[^}]*grid-template-rows:88px 88px/);
  assert.match(page, /<svg id="chart" width="592" height="168" viewBox="0 0 592 168"/, "the chart gives up height, not width");
  assert.match(page, /const W = 592, H = 168,/);
  assert.match(css, /#wallsAll\[hidden\], #wpick\[hidden\]\{ display:none; \}/, "the overlays really hide (their display:flex would beat [hidden])");
});

test("the walls come from the markets session's feed, read-only; its states and thresholds are theirs", () => {
  assert.match(page, /getJSON\(VP \+ "\/api\/walls"\)/);
  for (const s of ["PUSHING", "BROKE", "REJECTED", "LOSING", "DRIFTING", "AT WALL", "RETEST", "BROKE-LIGHT", "CLEAR"]) assert.ok(page.includes('"' + s + '"') || page.includes(s + ":"), s);
  assert.doesNotMatch(page, /volX\s*>=\s*1\.3\s*&&|upShare\s*>=\s*0\.6\s*&&/, "no state is decided here");
});

test("the rows he picks are kept in this browser; SPY and QQQ until he picks; picking a name the other row shows swaps them", () => {
  assert.match(page, /SLOTS_KEY = "station\.walls\.slots"/); assert.match(page, /WALL_DEFAULT = \["SPY", "QQQ"\]/);
  assert.match(page, /if \(s\[j\] === v\) s\[j\] = s\[PICK\]; s\[PICK\] = v; remember\(SLOTS_KEY/);
});

test("a loud state flashes the row, takes the spotlight (three or more = one line) and lands in the SCINTILLAS tape - never the backlog, never twice in 20 minutes", () => {
  assert.match(page, /const WALL_LOUD = \{ PUSHING: "up", BROKE: "up", REJECTED: "dn", LOSING: "dn" \}/);
  assert.match(page, /announce\("walls"/);
  assert.match(page, /if \(was === undefined \|\| was === r\.state\) continue;/, "the first read is the backlog");
  assert.match(page, /Date\.now\(\) - WSEEN\[k\] < 1200000/, "a name and a state at most once in 20 minutes");
  assert.match(page, /fresh\.length >= 3/);
  assert.match(page, /D\.wallEv\.map\(wallMoveItem\)/);
  assert.match(page, /row\.classList\.add\("flash"\)/);
  assert.doesNotMatch(page, /AudioContext|new Audio\(/, "no sound on the living-room TV");
});

test("the full screen goes back to the Station by itself after two minutes untouched (the TV has no hands); Escape closes it", () => {
  assert.match(page, /!el\("wallsAll"\)\.hidden && Date\.now\(\) - LAST_INPUT > 120000\) closeWallsAll\(\)/);
  assert.match(page, /e\.key === "Escape"\) \{ closeWallsAll\(\); closePick\(\); \}/);
});

test("the feed is read every 30 s while it has bars (04:00-20:00 New York, weekdays), every 5 minutes otherwise", () => {
  assert.match(page, /m >= 235 && m <= 1210/); assert.match(page, /wallsHours\(\) \? 30000 : 300000/);
});

test("the tapes wear the Hub's economic-tape look: a glowing dot per item whose state is set on the drawn item, never in the text", () => {
  assert.match(css, /\.dot\{[^}]*border-radius:50%;[^}]*box-shadow:0 0 14px 3px currentColor;/);
  assert.match(css, /\.s-soon \.dot, \.dot\.s-soon\{ animation:breathe 2\.4s/);
  assert.match(css, /\.s-near \.dot, \.dot\.s-near\{ animation:breathe 1\.1s/);
  assert.match(css, /\.s-due \.dot, \.dot\.s-due\{ animation:hard \.38s/);
  assert.match(page, /function refreshDots\(\)/); assert.match(page, /function paint\(t, html\) \{ lay\(t, html\); refreshDots\(\); \}/);
  assert.match(page, /if \(s === "s-due"\) \{ if \(hard\) s = "s-near"; else hard = true; \}/, "one hard pulse per tape");
  assert.doesNotMatch(page, /item\([^)]*s-(soon|near|due)/, "no clock-dependent class is written into a tape's text");
  assert.match(page, /const NOW_MARK = /);
  assert.match(page, /"CENTRAL BANK": "#FF3DBE", INFLATION: "#FF8A00", LABOR: "#2D9CFF", GROWTH: "#00D4FF"/, "the calendar's own legend");
});

test("dot timing matches the Hub (EC_NUDGE_*): an hour out breathes, ten minutes out tightens, the minute pulses while a number is due", () => {
  const src = page.slice(page.indexOf("function dotState"), page.indexOf("function refreshDots"));
  const dotState = new Function(src + "; return dotState;")();
  const now = Date.UTC(2026, 10, 23, 13, 50), m = 60000;
  assert.equal(dotState("econ", now + 61 * m, false, true, now), "s-up");
  assert.equal(dotState("econ", now + 30 * m, false, true, now), "s-soon");
  assert.equal(dotState("econ", now + 5 * m, false, true, now), "s-near");
  assert.equal(dotState("econ", now - 20 * m, false, true, now), "s-due");
  assert.equal(dotState("econ", now - 20 * m, false, false, now), "s-past", "a speech has no number to wait for");
  assert.equal(dotState("econ", now - 2 * m, true, true, now), "s-past", "landed");
  assert.equal(dotState("move", now - 3 * m, false, false, now), "s-due");
  assert.equal(dotState("move", now - 30 * m, false, false, now), "s-near");
  assert.equal(dotState("move", now - 90 * m, false, false, now), "s-past");
  assert.equal(dotState("macro", 0, false, false, now), "s-still");
});

test("the three ratio pairs moved into the ECONOMIC + EARNINGS tape, still read from the same feed", () => {
  assert.doesNotMatch(page, /id="pairs"/);
  assert.match(page, /D\.pairs = \(d\.pairs \|\| \[\]\)\.slice\(0, 3\)/);
  assert.match(page, /'<span class="t">RATIOS<\/span>'/);
});
