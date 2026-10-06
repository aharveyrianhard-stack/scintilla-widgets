/* S14 (5 Oct 2026): the two tapes on the chart area, pinned.
   Alan: "ONE TAPE FOR THE LIKED STOCKS, ANOTHER TAPE FOR THE FAVORITES, AND THE LIKED LIST DEDUPED FROM THE ONES ON
   FAVORITES." · "The ticker tape on the chart area — do not take over the YouTube and Twitter area, just the chart area."
   1. The tapes' width IS the chart area's: they start one seam right of the column and end at the screen's right edge.
   2. LIKED never carries a name that is on FAVORITES, and no tape carries a name twice.
   3. The charts give up 46 px of height (two 22 px rows + two 1 px seams) and no width; the switch gives it back.
   S15 (5 Oct, night) - Alan: "I like it. And I like the size of it … But no … at the bottom." The strip is at the BOTTOM of
   the chart area, FAVORITES nearest the charts and LIKED along the screen's edge; same size, same cells, same behaviour.
   The real page's measurement (deliverables/20261005/station-controls/harness/s15.mjs → s15.json) is pinned too. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const measured = JSON.parse(fs.readFileSync(new URL("../deliverables/20261005/station-controls/harness/s15.json", import.meta.url), "utf8"));
const grab = (re, what) => { const m = deck.match(re); assert.ok(m, what + " must exist in the deck"); return m[0]; };
const src = [
  grab(/const VIDEO_CHROME_FALLBACK_PX = \d+;/, "the video bar fallback"),
  grab(/const FLOOR_COLUMN_SHARE = [\d.]+;/, "the column share"),
  grab(/const FLOOR_SEAM_PX = \d+;/, "the seam"),
  grab(/const FLOOR_COUNTS = \[[^\]]*\];/, "the counts"),
  grab(/function floorGrid\(count, width, height\) \{[\s\S]*?\n\}/, "floorGrid"),
  grab(/function floorPlan\(wallWidth, wallHeight, chromePx\) \{[\s\S]*?\n\}/, "floorPlan"),
  grab(/const TAPE_ROW_PX = \d+;/, "the tape's height"),
  grab(/const TAPE_SPEED_PX_S = \d+;/, "the tape's speed"),
  grab(/function tapesHeight\(on\) \{[^\n]*\}/, "tapesHeight"),
  grab(/function tapeLists\(likedRows, favoriteRows\) \{[\s\S]*?\n\}/, "tapeLists"),
  grab(/function tapeSlotFor\(charts, count, ticker, lastOpened\) \{[\s\S]*?\n\}/, "tapeSlotFor"),
].join("\n");
const ctx = {}; vm.runInNewContext(src + "\nglobalThis.out = { floorPlan, floorGrid, tapesHeight, tapeLists, tapeSlotFor, TAPE_ROW_PX, TAPE_SPEED_PX_S, FLOOR_SEAM_PX };", ctx);
const { floorPlan, floorGrid, tapesHeight, tapeLists, tapeSlotFor, TAPE_ROW_PX, TAPE_SPEED_PX_S, FLOOR_SEAM_PX } = ctx.out;
const plain = (o) => JSON.parse(JSON.stringify(o));
const SCREENS = [[1680, 1050], [1920, 1080], [2560, 1440]];

test("S14 · the tapes are as wide as the chart area and never enter the X / YouTube column", () => {
  /* the rule, in the stylesheet: out of the grid's flow, from one seam right of the column to the right edge */
  assert.match(deck, /body\.tapes:not\(\.stack\) #tapes\{ display:flex; flex-direction:column; gap:1px; position:absolute; z-index:2;\s*bottom:0; right:0; left:calc\(var\(--fp-col, 24%\) \+ 1px\); background:var\(--line\); \}/);
  assert.match(deck, /#tapes\{ display:none; \}/, "no tapes unless the floor plan carries them (a phone keeps its column)");
  assert.match(deck, /body\.tapes\.charts-only:not\(\.stack\) #tapes\{ left:0; \}/, "CHARTS ONLY: the chart area is the whole wall, the tapes go with it");
  assert.match(deck, /grid\.style\.setProperty\("--fp-col", plan \? plan\.col \+ "px" : ""\)/, "the same column number S11 lays the column out with");
  /* the numbers: tape left = column + seam = the chart area's left; tape width = the chart area's width = 76% */
  for (const [w, h] of SCREENS) {
    const p = floorPlan(w, h, 28), left = p.col + FLOOR_SEAM_PX, width = w - left;
    assert.equal(width, p.charts.w, `${w}: the tape is exactly the chart area's width`);
    assert.ok(left > p.col, `${w}: it starts right of the column`);
    assert.ok(Math.abs(width / w - 0.76) < 0.001, `${w}: 76% of the screen`);
    for (const n of [9, 6, 4]) {
      const m = measured[`${w}x${h}-${n}`]; assert.ok(m, `${w}x${h} with ${n} charts was measured on the real page`);
      assert.equal(m.tapes.length, 2);
      for (const t of m.tapes) { assert.equal(t.x, left); assert.equal(t.w, p.charts.w); assert.equal(t.h, TAPE_ROW_PX); }
      assert.equal(m.tapesSpanChartArea, true); assert.equal(m.tapesOverColumnPx, 0, "0 px of tape over the column");
      assert.equal(m.column.w, p.col, "the column keeps its width"); assert.equal(m.chartArea.w, p.charts.w, "the charts keep theirs");
      assert.equal(m.chartArea.widthSharePct, 76);
      assert.equal(m.stripPx, 46); assert.equal(m.blackPx, 0, "0 px black"); assert.deepEqual(m.cut, [], "nothing cut"); assert.equal(m.cellsCut, 0);
      assert.equal(m.chartsDrawn, n, "every chart drew"); assert.deepEqual(m.errs, []);
      assert.ok(Math.abs(m.speedPxS - TAPE_SPEED_PX_S) <= 1 && Math.abs(m.speedFavoritesPxS - TAPE_SPEED_PX_S) <= 1, "45 px a second, both tapes");
      assert.equal(m.lists.onBoth, 0); assert.equal(m.lists.likedTwice, 0); assert.equal(m.lists.favTwice, 0);
    }
    const nine = measured[`${w}x${h}-9`];
    assert.equal(nine.switch.chartRowGaveUpPx, 46, "the charts' height shrinks by exactly the tapes");
    assert.equal(nine.switch.widthChangedPx, 0); assert.equal(nine.switch.columnChangedPx, 0);
    assert.equal(nine.switch.off.blackPx, 0); assert.equal(nine.hover.movedPx, 0, "the pointer holds the tape still");
  }
});

test("S14 · the height: two 22 px rows and two seams, taken from the chart row and from nothing else", () => {
  assert.equal(TAPE_ROW_PX, 22); assert.equal(tapesHeight(true), 46); assert.equal(tapesHeight(false), 0);
  assert.match(deck, /body\.tapes:not\(\.stack\) #grid > #rowTop\{ margin-bottom:var\(--tapes-px, 46px\); \}/);
  assert.match(deck, /\.tape\{ flex:none; height:22px;/);
  assert.match(deck, /const g = !plan \? null : tapePx \? floorGrid\(n, plan\.charts\.w, plan\.charts\.h - tapePx\) : plan\.grids\[n\];/,
    "each count's grid is chosen for the height that is left; off, it is S11's own");
  /* the three screens keep S11's grids with the tapes on: 9 → 3 × 3, 6 → 3 × 2, 4 → 2 × 2 */
  for (const [w, h] of SCREENS) { const p = floorPlan(w, h, 28);
    for (const [n, c, r] of [[9, 3, 3], [6, 3, 2], [4, 2, 2]]) assert.deepEqual(plain(floorGrid(n, p.charts.w, p.charts.h - 46)), { cols: c, rows: r }, `${w}: ${n} charts`); }
  /* the theatre still takes the whole chart area (S11b's line, unchanged); the strip goes plain under it */
  assert.match(deck, /const t = floorTheatre\(plan\.charts\.w, plan\.charts\.h, o\.chromePx\);/);
  assert.match(deck, /body\.tapes\.media-theatre:not\(\.stack\) #tapes > \.tape\{ visibility:hidden; \}/);
  assert.doesNotMatch(deck, /body\.tapes:not\(\.stack\) #tfNow\{/, "S15: the strip is at the bottom, so the timeframe tag is back at the charts' top edge");
  for (const k of Object.keys(measured)) assert.equal(measured[k].tfNow, 6, k + ": the timeframe tag 6 px from the top");
});

test("S14 · the lists: LIKED is the Hub's liked names without the ones on FAVORITES; no name twice", () => {
  const liked = [{ ticker: "NVDA" }, { ticker: "googl" }, { ticker: "PLTR" }, { ticker: "NVDA" }, { ticker: "MU" }, { ticker: "" }, null, { ticker: "BRK.B" }];
  const fav = [{ position: 3, ticker: "MU" }, { position: 1, ticker: "GOOGL" }, { position: 2, ticker: "AVGO" }, { position: 4, ticker: "avgo" }];
  const out = plain(tapeLists(liked, fav));
  assert.deepEqual(out.favorites, ["GOOGL", "AVGO", "MU"], "FAVORITES in the list's own order, each name once");
  assert.deepEqual(out.liked, ["NVDA", "PLTR", "BRK.B"], "LIKED in the order they were liked, without GOOGL and MU");
  assert.equal(out.likedTotal, 5);
  assert.equal(out.liked.filter((t) => out.favorites.includes(t)).length, 0);
  assert.deepEqual(plain(tapeLists(null, null)), { liked: [], favorites: [], likedTotal: 0 });
  assert.deepEqual(plain(tapeLists(liked, [])).liked, ["NVDA", "GOOGL", "PLTR", "MU", "BRK.B"], "no favorites: every liked name");
  /* where they come from: the Hub mirror the deck already reads, and the quote read the charts ride */
  assert.match(deck, /pg\("hub_favorites\?select=ticker&order=added_at\.asc"\),\n      pg\("station_lists\?select=position,ticker&list=eq\.favorites&order=position\.asc"\)/);
  assert.match(deck, /const rows = await SC_PROVIDER\.marketQuotes\(names, \{ signal \}\);/);
  assert.match(deck, /Object\.assign\(TAPES, tapeLists\(liked, favorites\)\)/);
  /* on the real page today */
  for (const k of Object.keys(measured)) { assert.equal(measured[k].lists.onBoth, 0); assert.ok(measured[k].lists.liked > 0 && measured[k].lists.favorites > 0);
    assert.equal(measured[k].priced.liked, measured[k].lists.liked, "every LIKED name priced"); assert.equal(measured[k].priced.favorites, measured[k].lists.favorites, "every FAVORITES name priced"); }
});

test("S14 · the Geiger mark, the tap and the switch", () => {
  /* S16 (6 Oct): the four rungs became the Station's Geiger bar - tests/station-s16-hover-tapes-20261006.test.mjs */
  assert.doesNotMatch(deck, /function tapeRungs\(/);
  /* the slot: a name on the wall is not loaded twice; else the first empty slot; else the slots in turn from the first */
  const wall = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT", "SPY"];
  assert.deepEqual(plain(tapeSlotFor(wall, 9, "SPY", -1)), { index: 8, already: true });
  assert.deepEqual(plain(tapeSlotFor(wall, 9, "PLTR", -1)), { index: 0, already: false });
  assert.deepEqual(plain(tapeSlotFor(wall, 9, "PLTR", 0)), { index: 1, already: false });
  assert.deepEqual(plain(tapeSlotFor(wall, 9, "PLTR", 8)), { index: 0, already: false }, "it comes round");
  assert.deepEqual(plain(tapeSlotFor(["GOOGL", "", "AVGO", ""], 4, "PLTR", 2)), { index: 1, already: false }, "an empty slot first");
  assert.deepEqual(plain(tapeSlotFor(wall, 4, "SPY", -1)), { index: 0, already: false }, "a slot that is not on the wall does not count");
  assert.match(deck, /if \(!commitTicker\(slot\.index, t, el\("t" \+ \(slot\.index \+ 1\)\)\)\) return false;/, "through the door a typed symbol goes through");
  /* the switch: in the ⋯, on unless switched off, remembered */
  const more = deck.indexOf('<div id="moreGroup"'), at = deck.indexOf('id="tapesToggle"');
  assert.ok(at > more && at < deck.indexOf('<span id="screenIndicator">'), "TAPES sits in the ⋯ panel");
  assert.match(deck, /id="tapesToggle"[^>]*aria-pressed="true">tapes · on<\/button>/);
  assert.match(deck, /function tapesOn\(\) \{ try \{ return localStorage\.getItem\(TAPES_KEY\) !== "0"; \} catch \(_\) \{ return true; \} \}/, "on by default");
  assert.match(deck, /\.tape:hover \.track\.run\{ animation-play-state:paused; \}/);
  for (const [w, h] of SCREENS) { const s = measured[`${w}x${h}-9`].switch;
    assert.deepEqual(s.button, { text: "tapes · on", pressed: "true", visible: true, inMore: true }); assert.equal(s.offText, "tapes · off");
    assert.equal(s.off.tapesOn, false); assert.equal(s.remembered, "0"); assert.equal(s.backOn, true);
    const tap = measured[`${w}x${h}-9`].tap;
    assert.equal(tap.taps[0].wall[0], tap.taps[0].tapped, "the first tap opens in slot 1"); assert.equal(tap.taps[1].wall[1], tap.taps[1].tapped, "the second in slot 2");
    assert.equal(tap.taps[1].wall[0], tap.taps[0].tapped, "and does not replace the first"); assert.equal(tap.nameAlreadyOnTheWall.same, true); }
});

test("S15 · the tapes are at the bottom of the chart area, FAVORITES nearest the charts, and the shares of the screen are the measured ones", () => {
  assert.match(deck, /box\.appendChild\(tapeRow\("FAVORITES", TAPES\.favorites, [^\n]*\n\s*box\.appendChild\(tapeRow\("LIKED", TAPES\.liked,/, "FAVORITES is the first row, LIKED the second");
  for (const [w, h] of SCREENS) {
    const p = floorPlan(w, h, 28), A = w * h, pct = (v) => +(v * 100).toFixed(1);
    for (const n of [9, 6, 4]) {
      const m = measured[`${w}x${h}-${n}`];
      assert.equal(m.tapesAtBottom, true); assert.deepEqual(m.order, ["FAVORITES", "LIKED"]);
      assert.equal(m.chartArea.y, 0, "the charts start at the top of the screen"); assert.equal(m.chartArea.h, h - 46, "and end 46 px above its bottom");
      assert.equal(m.tapes[0].y, h - 45, "FAVORITES: one seam under the charts"); assert.equal(m.tapes[1].y, h - 22, "LIKED: on the screen's bottom edge");
      assert.equal(m.column.h, h, "the X / YouTube column keeps the screen's whole height");
      /* the shares are plain rectangles: charts = their width × (height − 46); the tapes = that width × 46; the column = its width × the height */
      assert.equal(m.share.chartsAreaPct, pct(p.charts.w * (h - 46) / A)); assert.equal(m.share.tapesAreaPct, pct(p.charts.w * 46 / A));
      assert.equal(m.share.columnAreaPct, pct(p.col * h / A)); assert.equal(m.share.chartsWidthPct, pct(p.charts.w / w)); assert.equal(m.share.columnWidthPct, pct(p.col / w));
    }
    const nine = measured[`${w}x${h}-9`], off = nine.switch.off.share, full = nine.fullWidth;
    assert.equal(off.chartsAreaPct, pct(p.charts.w * h / A), "tapes off: the charts have the chart area's whole height"); assert.equal(off.tapesAreaPct, 0);
    assert.ok(nine.share.chartsAreaPct > 72 && nine.share.chartsAreaPct < 74 && off.chartsAreaPct > 75.5, `${w}: the charts are about 73% of the screen with the tapes, 76% without`);
    /* the picture-only variant (the harness injects it; the deck does not carry it): same charts, the column pays instead */
    assert.equal(full.isFull, true); assert.equal(full.tapes[0].x, 0); assert.equal(full.tapes[0].w, w); assert.equal(full.blackPx, 0); assert.deepEqual(full.cut, []); assert.equal(full.chartsDrawn, 9);
    assert.equal(full.share.chartsAreaPct, nine.share.chartsAreaPct, "the charts' share is the same either way"); assert.equal(full.column.h, h - 46);
    assert.doesNotMatch(deck, /#grid > #rowBot\{ margin-bottom/, "the full-width variant is a picture, not in the deck");
  }
});
