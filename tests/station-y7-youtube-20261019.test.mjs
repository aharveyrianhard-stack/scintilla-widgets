/* Y7 (19 Oct 2026), Alan: "I need the YouTube to be bigger, bro. It's too small … I want to remove the search queries
   of the YouTube thing. At least on the station … on the station, basically, I just want the subscribers feed. For
   the scintilla portion."
   1. The Station's SCINTILLA feed carries no search rows and no market chip: its list is the SCINTILLA subscriptions
      (and the shared Watch Later), every row that lands is re-checked for the account, the deck never mounts the
      market profile, and the pane never offers it. The market profile still answers its own URL for the Hub.
   2. The slot: the YouTube pane is a block of the chart grid - its numbers at 2560 × 1440, 1680 × 1050 and the
      1062 × 685 window the Station runs in on the iMac, against the S11 picture it replaces. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html");
const SHELLS = ["personal-video-v1", "scintilla-video-v1"];
const shells = Object.fromEntries(SHELLS.map((n) => [n, read(`../station-shells/${n}/index.html`)]));
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };

/* the pane's lists and its row guard, run as the pane runs them for a given feed and list */
function paneApi(src, feed, list) {
  const profiles = src.slice(src.indexOf("const FEED_PROFILES = ["), src.indexOf("const FEED_PROFILE_KEYS"));
  const lists = grab(src, /const SUBSCRIBED = \{[\s\S]*?\] : \[SUBSCRIBED\];/, "the lists");
  const filter = grab(src, /function filterFeedRows\(rows\) \{[\s\S]*?\n\}/, "filterFeedRows");
  const ctx = { encodeURIComponent, FEED: feed, LIST: list || "default" };
  vm.runInNewContext(profiles + "\n" + lists + "\n" + filter + "\nglobalThis.out = { LISTS, filterFeedRows, FEED_PROFILES };", ctx);
  return ctx.out;
}
/* arrays made inside the vm carry that realm's prototype: strict deepEqual wants plain copies */
const plainArr = (a) => JSON.parse(JSON.stringify(a));
const row = (accounts, tickers) => ({ video_id: Math.random().toString(36).slice(2, 13), subscription_accounts: accounts, tickers: tickers || null });
/* the shape measured on the live feed on 19 Oct 2026 at 23:20 ET: of the 200 newest rows, 85 carry scintilla, 81 carry no
   account at all (every one ticker-tagged - the search collector's), 34 carry another account only; 4 of the subscribed
   rows are shared with personal */
const tonight = [
  ...Array.from({ length: 81 }, () => row([], "NVDA,SMCI")),
  ...Array.from({ length: 34 }, () => row(["personal"])),
  ...Array.from({ length: 81 }, () => row(["scintilla"])),
  ...Array.from({ length: 4 }, () => row(["personal", "scintilla"])),
];

test("Y7 · the Station's scintilla feed carries no search rows and no market chip", () => {
  assert.equal(shells["personal-video-v1"], shells["scintilla-video-v1"], "the twin shells stay byte-identical");
  for (const name of SHELLS) {
    const src = shells[name];
    const sc = paneApi(src, "scintilla");
    assert.deepEqual(plainArr(sc.LISTS.map((l) => l.id)), ["default", "watch"], name + ": SCINTILLA has its subscriptions and Watch Later, nothing else");
    assert.deepEqual(plainArr(sc.LISTS.map((l) => l.n)), ["subscribed", "watch later"], name + ": the chips say so");
    assert.ok(!sc.LISTS.some((l) => /market|all/i.test(l.n) || /market|all/i.test(l.id)), name + ": no MARKET SEARCH chip, no ALL list");
    assert.match(sc.LISTS[0].q, /subscription_accounts=cs\.%7Bscintilla%7D/, name + ": the default list asks the database for rows the SCINTILLA account carries");
    const kept = sc.filterFeedRows(tonight);
    assert.equal(kept.length, 85, name + ": of tonight's 200 rows only the 85 SCINTILLA rows become tiles");
    assert.equal(kept.filter((v) => !v.subscription_accounts.length).length, 0, name + ": not one search clip (a row with no account)");
    assert.equal(kept.filter((v) => !v.subscription_accounts.includes("scintilla")).length, 0, name + ": not one row of another account only");
    assert.equal(sc.filterFeedRows([]).length, 0);
    assert.equal(paneApi(src, "scintilla", "watch").filterFeedRows(tonight).length, 200, name + ": Watch Later is Alan's own set and is not filtered");
    /* the other feeds are untouched */
    assert.deepEqual(plainArr(paneApi(src, "personal").LISTS.map((l) => l.id)), ["default"], name + ": PERSONAL keeps its one subscribed list");
    assert.equal(paneApi(src, "personal").filterFeedRows(tonight).length, 200, name + ": the guard is SCINTILLA's alone");
    const mk = paneApi(src, "market");
    assert.deepEqual(plainArr(mk.LISTS.map((l) => l.n)), ["market"], name + ": the market profile still answers its own URL for the Hub");
    assert.match(mk.LISTS[0].q, /tickers=not\.is\.null/, name + ": with the ticker clips");
    assert.ok(mk.FEED_PROFILES.some((p) => p.key === "market" && p.account === null), name + ": MARKET SEARCH is still declared");
    assert.match(src, /FEED_PROFILES\.filter\(\(profile\) => profile\.key !== "market"\)/, name + ": the channel switch never offers MARKET SEARCH");
    assert.match(src, /const MODE_DEFAULT = FEED === "scintilla" \|\| FEED === "market" \? "grid" : "videos";/, name + ": GRID · VIDEOS · SHORTS are as they were");
    assert.match(src, /id="bFull" title="expand this pane">⛶</, name + ": the pane's ⛶ is untouched");
  }
  /* the deck: every mounted feed is a channel; the market profile is never on a Station page */
  const feeds = grab(deck, /const VIDEO_FEEDS = \[[\s\S]*?\n\];/, "VIDEO_FEEDS");
  const accounts = vm.runInNewContext(feeds + "\nVIDEO_FEEDS.map((f) => f[2])", {});
  assert.deepEqual(plainArr(accounts), ["personal", "scintilla", "soundscapes", "golf", "ai_research", "fitness"]);
  assert.doesNotMatch(deck, /feed=market/, "the deck never mounts ?feed=market");
  assert.match(deck, /feed=scintilla&cols=2" \+ \(widgetsOn\(\) \? "&beside=1" : ""\) \+ "&view=/, "the SCINTILLA pane is mounted on its subscriptions, two tiles across (W1: restated, the WIDGETS wall adds beside=1)");
});

/* the floor plan's numbers, lifted as S11 lifts them, plus the slot */
const lift = [
  grab(deck, /const VIDEO_CHROME_FALLBACK_PX = \d+;/, "the video bar fallback"),
  grab(deck, /const FLOOR_COLUMN_SHARE = [\d.]+;/, "the column share"),
  grab(deck, /const FLOOR_SEAM_PX = \d+;/, "the seam"),
  grab(deck, /const FLOOR_COUNTS = \[[^\]]*\];/, "the counts"),
  grab(deck, /function floorGrid\(count, width, height\) \{[\s\S]*?\n\}/, "floorGrid"),
  grab(deck, /function floorPlan\(wallWidth, wallHeight, chromePx\) \{[\s\S]*?\n\}/, "floorPlan"),
  grab(deck, /const SLOT_SPAN = \d+;/, "the slot span"),
  grab(deck, /function floorSlot\(grid, areaWidth, areaHeight, chromePx, count\) \{[\s\S]*?\n\}/, "floorSlot"),
].join("\n");
const ctx = {}; vm.runInNewContext(lift + "\nglobalThis.out = { floorPlan, floorGrid, floorSlot, SLOT_SPAN };", ctx);
const { floorPlan, floorGrid, floorSlot } = ctx.out;
const plain = (o) => JSON.parse(JSON.stringify(o));
const TAPES = 46, BAR = 28;
const slotFor = (w, h, count) => { const p = floorPlan(w, h, BAR); const area = { w: p.charts.w, h: p.charts.h - TAPES }; return { plan: p, slot: floorSlot(floorGrid(count, area.w, area.h), area.w, area.h, BAR, count) }; };

test("Y7 · the slot: the YouTube pane is a block of the chart grid, measured at 2560 × 1440, 1680 × 1050 and the iMac's 1062 × 685 window", () => {
  /* the nine-chart wall: the bottom-left 2 × 2 of the 3 × 3, five charts in the cells the block leaves, in reading order */
  const nine = {
    "2560x1440": { box: { left: 0, top: 465, w: 1296, h: 929 }, picture: { w: 1296, h: 729 }, before: { w: 614, h: 345 } },
    "1680x1050": { box: { left: 0, top: 335, w: 850, h: 669 }, picture: { w: 850, h: 478 }, before: { w: 403, h: 227 } },
    "1062x685":  { box: { left: 0, top: 213, w: 537, h: 426 }, picture: { w: 537, h: 302 }, before: { w: 255, h: 143 } },
  };
  for (const [key, want] of Object.entries(nine)) {
    const [w, h] = key.split("x").map(Number);
    const { plan, slot } = slotFor(w, h, 9);
    assert.deepEqual(plain(plan.picture), want.before, key + ": the S11 picture this replaces (the column's width at 16:9)");
    assert.deepEqual(plain(slot.block), { cols: 2, rows: 2 }, key + ": a 2 × 2 block of the 3 × 3");
    assert.deepEqual(plain(slot.box), want.box, key + ": the block's box, on the grid's seams");
    assert.deepEqual(plain(slot.picture), want.picture, key + ": the largest 16:9 under the bar the box holds");
    assert.ok(slot.picture.w * slot.picture.h >= 3.5 * want.before.w * want.before.h, key + ": at least 3.5× the picture's area");
    assert.ok(Math.abs(slot.picture.w / slot.picture.h - 16 / 9) < 0.01, key + ": 16:9");
    assert.ok(slot.box.top + slot.box.h === plan.charts.h - TAPES, key + ": the block ends where the chart area ends, above the tapes");
    assert.equal(slot.charts, 5); assert.equal(slot.hidden, 4);
    assert.deepEqual(plain(slot.cells), [{ col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 3, row: 2 }, { col: 3, row: 3 }], key + ": the five charts' cells");
  }
  /* the other walls: never more than half the cells, never a cell taken for black */
  const at2560 = (n) => slotFor(2560, 1440, n).slot;
  assert.deepEqual([plain(at2560(8).block), at2560(8).charts, plain(at2560(8).picture)], [{ cols: 2, rows: 1 }, 6, { w: 972, h: 547 }], "8 charts (4 × 2): a 2 × 1 block - a 2 × 2 there is only taller, not a bigger picture - six charts stay");
  assert.deepEqual([plain(at2560(6).block), at2560(6).charts, plain(at2560(6).picture)], [{ cols: 2, rows: 1 }, 4, { w: 1189, h: 669 }], "6 charts (3 × 2): a 2 × 1 block, four charts stay");
  assert.deepEqual([plain(at2560(2).block), at2560(2).charts, plain(at2560(2).picture)], [{ cols: 1, rows: 1 }, 1, { w: 972, h: 547 }], "2 charts: one cell each");
  assert.deepEqual([at2560(1).charts, at2560(1).hidden], [0, 1], "1 chart: no room for a block - the deck reads no cells as no slot");
  for (const n of [2, 6, 8, 9]) { const s = at2560(n); assert.ok(s.block.cols * s.block.rows <= (s.cols * s.rows) / 2, n + ": at most half the cells"); assert.equal(s.cells.length + s.hidden, n, n + ": every chart is placed or named hidden"); }
  /* the deck wires it: the class, the rules, the stand-downs */
  assert.match(deck, /body\.video-slot:not\(\.stack\) #grid > #rowBot > \.pane\.in-slot\{ position:absolute; z-index:3; flex:none; width:auto; \}/, "the pane on the wall is drawn over the chart area, in the document where it was (no reload)");
  assert.match(deck, /body\.video-slot:not\(\.stack\) #grid > #rowTop > \.pane\.slot-off\{ display:none; \}/, "the charts the block takes are off the wall, still mounted");
  /* Y9 (21 Oct): restated - SIMPLE answers first (its own slot, kept through a chart solo); the WALL's rule follows unchanged */
  assert.match(deck, /function slotFor\(count, plan, tapePx, chromePx\) \{\n\s+if \(!plan \|\| document\.body\.classList\.contains\("charts-only"\)\) return null;\n[\s\S]{0,400}?if \(simpleOn\(\)\) return floorSimple\([^;]*\);\n\s+if \(SOLO\) return null;\n\s+const area = \{ w:plan\.charts\.w, h:plan\.charts\.h - \(Number\(tapePx\) \|\| 0\) \};/, "the slot is planned for the page's count in the area the tapes leave; a phone, a chart solo and CHARTS ONLY stand it down");
  /* Y9 (21 Oct): restated - the slot is planned before the grids (SIMPLE's grid is the slot's), so the lines sit a few apart */
  assert.match(deck, /const slot = slotFor\(CHART_COUNT, plan, tapePx, onWall\?\.chromePx\);\n[\s\S]{0,900}?SLOT_NOW = \{ slot, plan, tapePx, chromePx:onWall\?\.chromePx \};\n[\s\S]{0,500}?document\.body\.classList\.toggle\("video-slot", !!slot\);\n[\s\S]{0,300}?placeChartsAroundSlot\(slot\);/, "fitVideoPane plans it on every layout pass");
  assert.match(deck, /if \(SLOT_NOW\) placeChartsAroundSlot\(slotFor\(count, SLOT_NOW\.plan, SLOT_NOW\.tapePx, SLOT_NOW\.chromePx\), count\);/, "a page change measures the next page's boxes around the next page's slot");
  assert.match(deck, /const inSlot = !!slot && o\.def\.key === VIDEO_FEED && MEDIA_STAGE === 0;/, "the theatre (⛶) still takes the pane out of the slot and BACK puts it home");
  /* Y9 (21 Oct): restated - in SIMPLE the solo chart takes the row ("1 / -1"); every other cell is still the grid's own line */
  assert.match(deck, /function placeChartsAroundSlot\(slot, count\) \{[\s\S]*?o\.node\.style\.gridColumn = solo \? "1 \/ -1" : cell \? String\(cell\.col\) : "";/, "the charts are placed in the free cells by the grid's own lines");
  assert.match(deck, /const FLOOR_COLUMN_SHARE = 0\.24;/, "X keeps its 24 % column");
});
