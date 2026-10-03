/* S11 (3 Oct 2026): the Station floor plan, pinned. Alan: "if we get above 70 we're really gaining… YouTube a little
   bigger… this location works a lot better." The X column is 24% of the screen's width on every screen, the charts
   the other 76%; the YouTube picture is the column's width at 16:9 at the column's foot; the chart grid fills its
   area exactly (9 → 3×3, 4 → 2×2, 6 → the nearer-square of 3×2 / 2×3), so no pixel is black. The pure numbers are
   pinned here from the deck's own floorPlan(); the measurement of the real page is pinned from the S11 harness. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const grab = (re, what) => { const m = deck.match(re); assert.ok(m, what + " must exist in the deck"); return m[0]; };
const src = [
  grab(/const VIDEO_CHROME_FALLBACK_PX = \d+;/, "the video bar fallback"),
  grab(/const FLOOR_COLUMN_SHARE = [\d.]+;/, "the column share"),
  grab(/const FLOOR_SEAM_PX = \d+;/, "the seam"),
  grab(/const FLOOR_COUNTS = \[[^\]]*\];/, "the counts"),
  grab(/function floorGrid\(count, width, height\) \{[\s\S]*?\n\}/, "floorGrid"),
  grab(/function floorPlan\(wallWidth, wallHeight, chromePx\) \{[\s\S]*?\n\}/, "floorPlan"),
].join("\n");
const ctx = {}; vm.runInNewContext(src + "\nglobalThis.out = { floorPlan, floorGrid, FLOOR_COLUMN_SHARE, FLOOR_SEAM_PX };", ctx);
const { floorPlan, floorGrid, FLOOR_COLUMN_SHARE, FLOOR_SEAM_PX } = ctx.out;
const SCREENS = [[1680, 1050, 403], [1920, 1080, 461], [2560, 1440, 614]];

test("S11 · the X column is 24% of the screen's width and the charts the other 76%, on every screen", () => {
  assert.equal(FLOOR_COLUMN_SHARE, 0.24);
  for (const [w, h, col] of SCREENS) {
    const p = floorPlan(w, h, 28);
    assert.equal(p.col, col, `${w}: the column is ${col} px`);
    assert.equal(+(p.col / w * 100).toFixed(1), 24.0, `${w}: column 24.0% of the width`);
    assert.equal(+((w - p.col) / w * 100).toFixed(1), 76.0, `${w}: charts 76.0% of the width`);
    assert.equal(p.col + FLOOR_SEAM_PX + p.charts.w, w, `${w}: column + one hairline + charts = the whole width, nothing left over`);
    assert.equal(p.charts.h, h, "the charts run the full height");
  }
});

test("S11 · the YouTube picture is the column's width at 16:9, under the shell's own bar", () => {
  for (const [w, h, col] of SCREENS) {
    const p = floorPlan(w, h, 28);
    assert.equal(p.picture.w, col);
    assert.equal(p.picture.h, Math.round(col * 9 / 16));
    assert.ok(Math.abs(p.picture.w / p.picture.h - 16 / 9) < 0.01, `${w}: 16:9`);
    assert.equal(p.videoPane.w, col, "the pane is exactly the column's width");
    assert.equal(p.videoPane.h, p.picture.h + 28, "the pane is the picture plus the bar the shell reports");
  }
  assert.deepEqual(JSON.parse(JSON.stringify(floorPlan(1680, 1050, 28).picture)), { w: 403, h: 227 }, "MacBook 403 × 227");
});

test("S11 · the chart grids fill their area exactly: 9 three by three, 4 two by two, 6 the nearer square", () => {
  for (const [w, h] of SCREENS) {
    const p = floorPlan(w, h, 28);
    assert.deepEqual([p.grids[9].cols, p.grids[9].rows], [3, 3], `${w}: nine is three by three`);
    assert.deepEqual([p.grids[4].cols, p.grids[4].rows], [2, 2], `${w}: four is two by two`);
    for (const n of [1, 2, 3, 4, 6, 8, 9]) assert.equal(p.grids[n].cols * p.grids[n].rows, n, `${w}: ${n} charts fill every cell, none left empty`);
    /* six: whichever of 3×2 and 2×3 gives the squarer chart on this screen */
    const off = (c, r) => Math.abs(Math.log(((p.charts.w - (c - 1)) / c) / ((p.charts.h - (r - 1)) / r)));
    const want = off(3, 2) <= off(2, 3) ? [3, 2] : [2, 3];
    assert.deepEqual([p.grids[6].cols, p.grids[6].rows], want, `${w}: six is the nearer square`);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(floorGrid(6, 1276, 1050))), { cols: 3, rows: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(floorGrid(6, 600, 1400))), { cols: 2, rows: 3 }, "a tall chart area turns six the other way");
});

test("S11 · the deck lays the plan out: one column (X on top, YouTube at its foot), the grid from the plan, the phone untouched", () => {
  assert.match(deck, /body:not\(\.stack\) #grid\{ flex-direction:row; \}/);
  assert.match(deck, /body:not\(\.stack\) #grid > #rowBot\{ order:-1; flex:0 0 var\(--fp-col, 24%\); flex-direction:column; \}/);
  assert.match(deck, /body:not\(\.stack\) #grid > #rowBot > \.pane\[data-key="x"\]\{ order:-1; \}/);
  assert.match(deck, /grid-template-columns:repeat\(var\(--fp-c, 3\), minmax\(0,1fr\)\);\s*grid-template-rows:repeat\(var\(--fp-r, 3\), minmax\(0,1fr\)\);/);
  for (const n of [1, 2, 3, 4, 6, 8, 9]) assert.match(deck, new RegExp(`#rowTop\\.charts-${n}\\{ --fp-c:var\\(--fp-c${n}`), `charts-${n} reads its shape`);
  assert.match(deck, /grid\.style\.setProperty\("--fp-col", plan \? plan\.col \+ "px" : ""\)/);
  assert.match(deck, /o\.node\.style\.height = \(Math\.round\(plan\.col \* 9 \/ 16\) \+/);
  assert.match(deck, /body\.charts-only:not\(\.stack\) #grid > #rowBot\{ position:absolute;/, "charts only keeps the column's box behind the charts");
});

test("S11 · measured on the real page: 0 px black, 24% / 76%, a 16:9 picture, at every screen and grid", () => {
  const shots = JSON.parse(fs.readFileSync(new URL("../deliverables/20261003/station-floorplan-build/harness/shots.json", import.meta.url), "utf8"));
  const keys = ["1680x1050", "1920x1080", "2560x1440"].flatMap((s) => [9, 6, 4].map((g) => s + "|" + g));
  for (const k of keys) {
    const m = shots[k]; assert.ok(m, k + " was measured");
    assert.equal(m.px.black, 0, k + ": no black");
    assert.equal(m.share.chartsArea, 76.0, k + ": charts 76.0% of the screen");
    assert.equal(+m.widthShare.column.toFixed(1), 24.0, k + ": column 24.0% of the width");
    assert.equal(m.chartsN, +k.split("|")[1], k + ": the grid holds its count");
    assert.equal(m.chartsDrawn, m.chartsN, k + ": every chart drew before the picture");
    assert.ok(Math.abs(m.picture.w / m.picture.h - 16 / 9) < 0.01, k + ": the YouTube picture is 16:9");
    assert.ok(m.flush.videoWidthEqualsColumn && m.flush.videoAtFoot && m.flush.xAtTop, k + ": YouTube flush at the column's foot, X at its top");
  }
});
