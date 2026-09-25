/* K3 / SCI-K3-002 · ALAN'S 25 SEP CHARTING WORKFLOW — the new rotation.
   Nineteen pages in a fixed order, three of them with slots that rotate through a
   list on every visit, an after-hours mode (SPY/QQQ ↔ ES/NQ, and the intraday four
   leaving the rotation), and a shared eight-name TARGETS list. Everything checkable
   without a browser lives in deck/scenes.js; the deck's wiring is pinned by source. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const scenes = context.globalThis.StationScenes;
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
/* Values cross the vm realm boundary, so compare by contents, never by reference. */
const arr = (x) => Array.from(x);

const WORKFLOW_ORDER = [
  "wkIndexes","wkMacro","targets3D","sectors3D","mainIndexes3D","mag7","ai1","ai2","ai3",
  "other3D","blueChip3D","spyQqq1D","otherIndexes1D","macro1D","targets1D",
  "macroIntraday","intraday4h","intraday1h","intraday30m"
];
/* A Wednesday in New York (EDT, UTC-4): 09:30 ET = 13:30 UTC, 16:30 ET = 20:30 UTC. */
const WED = (utc) => "2026-09-23T" + utc + "Z";
const SATURDAY = "2026-09-26T14:00:00Z"; /* 10:00 ET on a Saturday */

test("the rotation is the nineteen workflow pages, in Alan's order", () => {
  assert.deepEqual(arr(scenes.ROTATION_SCENES), WORKFLOW_ORDER,
    "the fixed order read off the TradingView tab group on 25 Sep");
  assert.deepEqual(arr(scenes.SCREENS.slice(0, 19)).map((s) => s.scene), WORKFLOW_ORDER,
    "and they are the first nineteen entries of SCREENS");
  assert.deepEqual(arr(scenes.SCREENS.slice(19)).map((s) => s.scene),
    ["scintillas","oscWorkbench","indexNow","indexLeadership","companyLeadership","focus2",
     "macroCrossAsset","internalsFast","sectorFamilies","themeFamilies","todo","scratch"],
    "then SCINTILLAS, WORKBENCH, the eight old curated pages, TO-DO and SCRATCH last");
});

test("every workflow page carries its stated range and chart count", () => {
  const at = WED("14:00:00");
  const expect = {
    wkIndexes:["1W",8], wkMacro:["1W",6], targets3D:["3D",8], sectors3D:["3D",6],
    mainIndexes3D:["3D",2], mag7:["3D",8], ai1:["3D",8], ai2:["3D",8], ai3:["3D",8],
    other3D:["3D",8], blueChip3D:["3D",8], spyQqq1D:["1D",2], otherIndexes1D:["1D",6],
    macro1D:["1D",6], targets1D:["1D",8], macroIntraday:["4h",4], intraday4h:["4h",6],
    intraday1h:["1h",4], intraday30m:["30m",2]
  };
  for (const id of WORKFLOW_ORDER) {
    const state = scenes.workflowPageState(id, { visit: 0, at });
    assert.equal(state.range, expect[id][0], `${id} draws at its page's timeframe`);
    assert.equal(state.chartCount, expect[id][1], `${id} lays out its own wall size`);
    assert.deepEqual(arr(state.ranges), arr(state.tickers).map(() => state.range),
      `${id} carries its timeframe per slot, never over the wall's run-wide range`);
  }
});

test("rotatingWindow walks a list size-at-a-time, wrapping around the end", () => {
  assert.deepEqual(arr(scenes.rotatingWindow(["A","B","C","D","E","F"], 3, 0)), ["A","B","C"]);
  assert.deepEqual(arr(scenes.rotatingWindow(["A","B","C","D","E","F"], 3, 1)), ["D","E","F"]);
  assert.deepEqual(arr(scenes.rotatingWindow(["A","B","C","D","E","F"], 3, 2)), ["A","B","C"]);
  const t = ["1","2","3","4","5","6","7","8"];
  assert.deepEqual(arr(scenes.rotatingWindow(t, 3, 0)), ["1","2","3"]);
  assert.deepEqual(arr(scenes.rotatingWindow(t, 3, 1)), ["4","5","6"]);
  assert.deepEqual(arr(scenes.rotatingWindow(t, 3, 2)), ["7","8","1"], "the last window wraps");
  assert.deepEqual(arr(scenes.rotatingWindow(["SPY","QQQ"], 1, 0)), ["SPY"], "the alternating leader slot");
  assert.deepEqual(arr(scenes.rotatingWindow(["SPY","QQQ"], 1, 1)), ["QQQ"]);
  assert.deepEqual(arr(scenes.rotatingWindow(["SPY","QQQ"], 1, 2)), ["SPY"]);
});

test("stationSession is the New York 09:30–16:30 weekday window", () => {
  assert.equal(scenes.stationSession(WED("13:29:00")), "after",  "09:29 ET is not yet regular");
  assert.equal(scenes.stationSession(WED("13:30:00")), "regular", "09:30 ET opens it");
  assert.equal(scenes.stationSession(WED("20:29:00")), "regular", "16:29 ET is still regular");
  assert.equal(scenes.stationSession(WED("20:30:00")), "after",  "16:30 ET closes it");
  assert.equal(scenes.stationSession(SATURDAY), "after", "a Saturday is never regular");
});

test("LEADERS are SPY/QQQ in the regular session and ES/NQ after hours", () => {
  assert.deepEqual(arr(scenes.LEADERS(WED("14:00:00"))), ["SPY","QQQ"]);
  assert.deepEqual(arr(scenes.LEADERS(WED("21:00:00"))), ["ESUSD","NQUSD"]);
  assert.deepEqual(arr(scenes.LEADERS(SATURDAY)), ["ESUSD","NQUSD"]);
});

test("the rotation loses the four intraday pages after hours, and gains them back", () => {
  assert.equal(scenes.rotationScenesAt(WED("14:00:00")).length, 19);
  const after = arr(scenes.rotationScenesAt(WED("21:00:00")));
  assert.equal(after.length, 15, "after hours: the same order without pages 16–19");
  assert.deepEqual(after, WORKFLOW_ORDER.slice(0, 15));
  assert.deepEqual(arr(scenes.rotationScenesAt(SATURDAY)), after, "a weekend is after hours");
});

test("MACRO · 4H keeps PCC in slot 4 on every visit while slots 1–3 rotate", () => {
  assert.deepEqual(arr(scenes.workflowPageState("macroIntraday", { visit: 0 }).tickers),
    ["VIX","CLUSD","US10Y","PCC"]);
  assert.deepEqual(arr(scenes.workflowPageState("macroIntraday", { visit: 1 }).tickers),
    ["DXUSD","GCUSD","BTCUSD","PCC"]);
  assert.deepEqual(arr(scenes.workflowPageState("macroIntraday", { visit: 2 }).tickers),
    ["VIX","CLUSD","US10Y","PCC"]);
});

test("the intraday pages compose LEADERS with rotating TARGETS windows", () => {
  const targets = ["A","B","C","D","E","F","G","H"];
  assert.deepEqual(arr(scenes.workflowPageState("intraday4h", { visit: 0, targets, at: WED("14:00:00") }).tickers),
    ["SPY","QQQ","A","B","C","D"]);
  assert.deepEqual(arr(scenes.workflowPageState("intraday4h", { visit: 1, targets, at: WED("21:00:00") }).tickers),
    ["ESUSD","NQUSD","E","F","G","H"], "after hours the leaders are the futures pair");
  assert.deepEqual(arr(scenes.workflowPageState("intraday1h", { visit: 0, targets, at: WED("14:00:00") }).tickers),
    ["SPY","A","B","C"]);
  assert.deepEqual(arr(scenes.workflowPageState("intraday1h", { visit: 1, targets, at: WED("14:00:00") }).tickers),
    ["QQQ","D","E","F"], "slot 1 alternates between the two LEADERS");
  assert.deepEqual(arr(scenes.workflowPageState("intraday30m", { visit: 0, targets, at: WED("14:00:00") }).tickers),
    ["SPY","A"]);
  assert.deepEqual(arr(scenes.workflowPageState("intraday30m", { visit: 2, targets, at: WED("14:00:00") }).tickers),
    ["SPY","C"], "one target at a time, one step per visit");
});

test("TARGETS_DEFAULT is the eight names a failed or empty read falls back to", () => {
  assert.deepEqual(arr(scenes.TARGETS_DEFAULT), ["GOOGL","NBIS","AVGO","BE","AMZN","VST","MU","WMT"]);
  assert.equal(scenes.TARGETS_DEFAULT.length, 8);
  const state = scenes.workflowPageState("targets3D", { visit: 0, targets: [] });
  assert.deepEqual(arr(state.tickers), arr(scenes.TARGETS_DEFAULT),
    "an empty TARGETS list means the defaults, not a blank page");
});

test("every retired tv page lands on an existing workflow page through LEGACY", () => {
  const map = { tvMacro:"macro1D", tvIndexes:"otherIndexes1D", tvSectors:"sectors3D", tvHome6:"intraday4h",
    tvPage2:"ai1", tvPage3:"mag7", tvOtherLC:"other3D", tvOtherSC:"ai2", tvBlueChip:"blueChip3D", tvExtras:"ai2" };
  for (const id of Object.keys(map)) {
    assert.ok(!scenes.IDS.includes(id), `${id} is gone as a page`);
    assert.equal(scenes.LEGACY[id], map[id], `${id} maps to the page that carries its names`);
    assert.ok(scenes.IDS.includes(map[id]), `${map[id]} exists`);
    assert.equal(scenes.normalizeScene(id), map[id], `a browser that remembered ${id} lands somewhere sensible`);
  }
});

test("pageTickers knows every workflow page, reporting a rotating page's full list", () => {
  const intraday1h = arr(scenes.pageTickers("intraday1h"));
  for (const leader of ["SPY","QQQ","ESUSD","NQUSD"])
    assert.ok(intraday1h.includes(leader), `intraday1h can lead with ${leader}`);
  for (const target of arr(scenes.TARGETS_DEFAULT))
    assert.ok(intraday1h.includes(target), `intraday1h rotates through ${target}`);
  assert.deepEqual(arr(scenes.pageTickers("targets3D")), arr(scenes.TARGETS_DEFAULT));
  assert.deepEqual(arr(scenes.pageTickers("macroIntraday")), ["VIX","CLUSD","US10Y","DXUSD","GCUSD","BTCUSD","PCC"]);
  assert.ok(arr(scenes.pageTickers("wkIndexes")).includes("IGV"), "IGV stays on the page as a named absence");
  assert.ok(arr(scenes.pageTickers("ai2")).includes("NVTS"), "NVTS stays on the page as a named absence");
  assert.ok(arr(scenes.pageTickers("ai3")).includes("HUT"), "HUT stays on the page as a named absence");
  assert.ok(scenes.findPages("PCC").some((m) => m.screen.scene === "macroIntraday"),
    "the jump list finds PCC on MACRO · 4H");
});

test("the deck keeps the visit counter in one localStorage key and counts per show", () => {
  assert.match(deck, /const PAGE_VISITS_KEY = "station\.visits\.v1";/);
  assert.match(deck, /function pageVisit\(id\) \{/);
  assert.match(deck, /remember\(PAGE_VISITS_KEY, JSON\.stringify\(PAGE_VISITS\)\);/,
    "the counter is mirrored so a reload does not reset the windows");
  assert.match(deck, /const next = SceneModel\.nextRotatingScreenAt\(SCENE, new Date\(\)\);/,
    "auto-rotate re-asks the session every advance");
  assert.match(deck, /station_targets\?select=position,ticker&order=position\.asc/,
    "TARGETS is the shared table, read in position order");
});

test("SCRATCH's SAVE AS TARGETS upserts by position and says what it did", () => {
  assert.match(deck, /id="saveTargets" hidden/);
  assert.match(deck, /saveT\.hidden = SCENE !== "scratch";/, "the button belongs to SCRATCH alone");
  assert.match(deck, /pgWrite\("station_targets\?on_conflict=position",/);
  assert.match(deck, /Prefer: "resolution=merge-duplicates"/, "the upsert merges on position");
  assert.match(deck, /pgDelete\("station_targets\?position=gt\." \+ filled\.length\)/,
    "positions above the count are deleted");
  assert.match(deck, /"targets saved · " \+ filled\.length \+ " names"/);
  assert.match(deck, /say\("type the targets first"\)/, "an empty scratch wall saves nothing");
  assert.equal(scenes.SCRATCH_SLOTS, 8, "SCRATCH grew from six to eight slots");
  assert.equal(scenes.chartCountForSize(8), 8);
});
