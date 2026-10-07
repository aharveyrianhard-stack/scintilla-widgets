/* HM2 (7 Oct 2026) — the PUT / CALL row on the Station's tape strip.
   Alan: "how do I start tracking this? … it's like a two-factor thing — it can move because one or the other moved."
   What is pinned here:
   1. With the row OFF (the default until Alan says go) the strip is the 46 px it was: tapesHeight is untouched.
   2. ON, it adds one row and one seam — 23 px — and nothing else.
   3. The order: SPY and QQQ first, then the list names, furthest above their own usual ratio first, thin names last.
   4. A name flashes at 1.5× its usual ratio, never when thinly traded.
   5. It is its own row (.ptape), so the two tapes' painter and fitter never touch it; it reads one view. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const grab = (re, what) => { const m = deck.match(re); assert.ok(m, what + " must exist in the deck"); return m[0]; };
const src = [
  grab(/const FLOOR_SEAM_PX = \d+;/, "the seam"),
  grab(/const TAPE_ROW_PX = \d+;/, "the tape's height"),
  grab(/function tapesHeight\(on\) \{[^\n]*\}/, "tapesHeight"),
  grab(/const PC_TAPE_DEFAULT_ON = (true|false);/, "the default"),
  grab(/const PC_TAPE_MS = \d+, PC_FLASH_X = [\d.]+, PC_FLASH_MS = \d+;/, "the clock and the threshold"),
  grab(/function pcTapeHeight\(on\) \{[^\n]*\}/, "pcTapeHeight"),
  grab(/function pcTapeOrder\(rows, names\) \{[\s\S]*?\n\}/, "pcTapeOrder"),
  grab(/const pcX = [^\n]*;/, "pcX"),
  grab(/function pcHot\(r\) \{[^\n]*\}/, "pcHot"),
].join("\n");
const ctx = {}; vm.runInNewContext(src + "\nglobalThis.out = { tapesHeight, pcTapeHeight, pcTapeOrder, pcX, pcHot, PC_TAPE_DEFAULT_ON, PC_FLASH_X, PC_TAPE_MS, TAPE_ROW_PX };", ctx);
const { tapesHeight, pcTapeHeight, pcTapeOrder, pcX, pcHot, PC_TAPE_DEFAULT_ON, PC_FLASH_X, PC_TAPE_MS } = ctx.out;
const row = (ticker, ratio_x, thin = false) => ({ ticker, ratio_x, thin, calls_x: 1, puts_x: ratio_x });

test("off by default, and off means the strip is the 46 px it was", () => {
  assert.equal(PC_TAPE_DEFAULT_ON, false, "nothing changes on the Station until Alan says go");
  assert.equal(tapesHeight(true), 46); assert.equal(pcTapeHeight(false), 0);
  assert.match(deck, /const tapePx = plan \? tapesHeight\(tapesOn\(\)\) \+ pcTapeHeight\(tapesOn\(\) && pcTapeOn\(\)\) : 0;/, "the row's height is added only when both switches are on");
  assert.match(deck, /id="pcTapeToggle"[^>]*aria-pressed="false">put\/call · off<\/button>/, "the switch is in the controls, off");
});
test("on, it adds one row and one seam: 23 px", () => { assert.equal(pcTapeHeight(true), 23); assert.equal(tapesHeight(true) + pcTapeHeight(true), 69); });
test("SPY and QQQ lead; then the list names, furthest above their own usual first; thin names last", () => {
  const rows = [row("MU", 0.8), row("QQQ", 1.2), row("SOFI", 2.7), row("AGIX", 56, true), row("SPY", 1.1), row("XOM", 9)];
  const names = new Set(["SPY", "QQQ", "MU", "SOFI", "AGIX"]);
  assert.deepEqual(Array.from(pcTapeOrder(rows, names), (r) => r.ticker), ["SPY", "QQQ", "SOFI", "MU", "AGIX"], "XOM is on no list; AGIX is thin, so its 56× goes last");
  assert.deepEqual(Array.from(pcTapeOrder([], names)), []);
});
test("a name flashes at 1.5× its usual ratio — never below it, never when thinly traded", () => {
  assert.equal(PC_FLASH_X, 1.5);
  assert.equal(pcHot(row("A", 1.5)), true); assert.equal(pcHot(row("A", 1.49)), false);
  assert.equal(pcHot(row("A", 56, true)), false); assert.equal(pcHot({ ticker: "A", ratio_x: null }), false); assert.equal(pcHot(null), false);
});
test("the multiples read short: one decimal, none from ten up, a dash when unknown", () => {
  assert.equal(pcX(0.83), "0.8×"); assert.equal(pcX(2.05), "2.0×"); assert.equal(pcX(26.67), "27×"); assert.equal(pcX(null), "—"); assert.equal(pcX("x"), "—");
});
test("it is its own row and its own read: the two tapes' painter never sees it, and it asks once a minute", () => {
  assert.match(deck, /row\.className = "ptape";/); assert.match(deck, /b\.className = "pcell"/);
  assert.doesNotMatch(deck, /class="tape[^"]*ptape|className = "tape ptape"/, "never a .tape: paintTapeCells and fitTapes walk .tape rows and .cell cells");
  assert.match(deck, /pg\("putcall_names_now\?select=\*&limit=1000"\)/, "one view, through the mirror the deck already reads");
  assert.equal(PC_TAPE_MS, 60000);
  assert.match(deck, /box\.insertBefore\(row, box\.firstChild\);/, "above FAVORITES: the two tapes keep their place on the screen");
  assert.match(deck, /if \(!list\.length\) \{ if \(row\) row\.remove\(\); PCT\.sig = ""; return; \}/, "no rows, no row: never an empty band");
});
