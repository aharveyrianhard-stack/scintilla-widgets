/* ALAN'S TRADINGVIEW LAYOUTS ARE STATION PAGES, AND THE DOCK HOLDS STILL.
   ============================================================================
   Alan, 23 Sep morning: "the TV dynamic needs to come to Station, to free up the space
   of Chrome."  Evening: "it moves things based on the width of things; things need to be
   more standard" · "I'm trying to move through the pages with the arrows, and it's not
   particularly easy… I'm trying to get to the PCC and it's not particularly nice."
   These tests read the same files the browser loads. They check the pages carry his rows,
   that a saved layout is not quietly re-paged, that every page button is the same width
   whatever it is called, and that PCC is one move away.
   ============================================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8");
const context = { globalThis:{} };
vm.runInNewContext(source, context);
const scenes = context.globalThis.StationScenes;
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");

function functionFromDeck(name, bindings = {}) {
  const start = deck.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = deck.indexOf("{", start); i < deck.length; i += 1) {
    if (deck[i] === "{") depth += 1;
    if (deck[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${deck.slice(start, end)})`, bindings);
}

/* The twelve saved layouts, read off TradingView on 23 Sep. USOIL, GOLD and TSX:BOFA are
   TradingView spellings; the chart API serves CLUSD, GCUSD and BAC. */
const LAYOUTS = [
  ["tvMacro", "MACRO", 6, ["VIX","US10Y","CLUSD","BTCUSD","GCUSD","PCC"]],
  ["tvIndexes", "INDEXES", 6, ["MAGS","SMH","IWM","DRAM","IGV"]],
  ["tvSectors", "SECTORS", 8, ["XLV","XLY","XLF","XLP","XLE","XLI","XLC","XLB"]],
  ["tvHome6", "HOME 6", 6, ["SPY","QQQ","NVDA","BE","MU","NBIS"]],
  ["tvPage2", "PAGE 2", 6, ["TSM","SNDK","GOOGL","IREN","AVGO","CRWV"]],
  ["tvPage3", "PAGE 3", 6, ["AAPL","LRCX","AMZN","AMD","MSFT","META"]],
  ["tvOtherLC", "OTHER LC", 8, ["ASML","META","PLTR","ORCL","SPCX","HOOD","TSLA","SHOP"]],
  ["tvOtherSC", "OTHER SC", 8, ["ALAB","WULF","CRDO","SMR","SMCI","OKLO","ASTS","USAR"]],
  ["tvBlueChip", "BLUE CHIP", 6, ["WMT","JPM","COST","BAC","CAT","MRVL"]],
  ["tvExtras", "EXTRAS", 2, ["MRVL","NVTS"]]
];

test("every retired TradingView-copy page lands on the workflow page that carries its names (25 Sep)", () => {
  /* 25 Sep: the ten Station copies of the 23 Sep layouts are retired; Alan's new 22-layout
     workflow replaced them (K3). A browser that remembered one lands on a real page, and the
     workflow keeps the rows his layouts carry, in order. */
  for (const [id, label] of LAYOUTS) {
    assert.equal(scenes.PRESETS[id], undefined, `${label} is no longer its own page`);
    const landing = scenes.LEGACY[id];
    assert.ok(landing && scenes.screenForScene(landing), `${label} (${id}) lands on ${landing}`);
    assert.equal(scenes.normalizeScene(id), landing, `${label} normalizes to its landing page`);
    assert.doesNotMatch(deck, new RegExp(`<option value="${id}">`), `${label} is out of the scene menu`);
  }
  for (const [id, label, rows] of [
    ["mag7", "MAG 7", ["MAGS","MSFT","NVDA","AMZN","AAPL","META","GOOGL","TSLA"]],
    ["macro1D", "MACRO · DAY", ["VIX","DXUSD","US10Y","GCUSD","CLUSD","BTCUSD"]],
    ["blueChip3D", "BLUE CHIP", ["WMT","JPM","CAT","BAC","HD","MCD","COST","WM"]]
  ]) {
    assert.deepEqual(Array.from(scenes.WORKFLOW_PAGES[id].tickers), rows, `${label} keeps Alan's rows, in order`);
    assert.equal(scenes.screenForScene(id).label, label);
    assert.match(deck, new RegExp(`<option value="${id}">`), `${label} is in the scene menu`);
  }
  /* 25 Sep, later (P1): Alan's six stay on screen; only the other five rotate, two at a time. */
  assert.deepEqual(Array.from(scenes.WORKFLOW_PAGES.sectors3D.tickers), ["XLK","XLI","XLC","XLF","XLY","XLE"],
    "SECTORS keeps Alan's six in slots 1-6 on every visit");
  assert.deepEqual(Array.from(scenes.WORKFLOW_PAGES.sectors3D.rotate.list), ["XLP","XLV","XLU","XLRE","XLB"],
    "and rotates only the other five State Street sectors through slots 7-8");
  /* 34 since 25 Sep: three RSI pages follow their daily twins (P2); HISTORY retired (P1). */
  assert.equal(scenes.SCREENS.length, 34,
    "twenty-two workflow pages, SCINTILLAS, the workbench, eight old curated pages (menu only), TO-DO and SCRATCH");
});

test("a saved layout is a picture, not a basket: five rows stay five rows in a six-up wall", () => {
  /* basketWindow exists for cohorts and short family baskets — it pages a four or five
     name list into twos. Alan's INDEXES layout is five names in a six-up wall, and it
     must stay that way, with the sixth slot simply empty. */
  const five = { tickers:["MAGS","SMH","IWM","DRAM","IGV"], chartCount:6 };
  const paged = scenes.basketWindow(five.tickers, 0, 6);
  assert.equal(paged.tickers.length, 2, "the basket rule really would have paged it into twos");
  const page = scenes.exactPage(five);
  assert.deepEqual(Array.from(page.tickers), ["MAGS","SMH","IWM","DRAM","IGV"]);
  assert.equal(page.chartCount, 6, "a six-up wall with one empty slot");
  assert.equal(page.hasNext, false);
  assert.equal(page.hasPrevious, false);
  /* 25 Sep: a workflow page is a picture too. INTRADAY · 1H is an honest four-up, which the
     2/6/8 ladder would have retired to a two-up. */
  assert.equal(scenes.chartCountForSize(4), 2, "the ladder really would retire a four-up");
  const state = scenes.workflowPageState("intraday1h", { visit:0, at:new Date("2026-09-25T15:00:00Z") });
  assert.equal(state.tickers.length, 4);
  assert.equal(state.chartCount, 4, "four rows stay a four-up wall");
  assert.equal(scenes.workflowPageState("otherIndexes1D", { visit:0 }).chartCount, 6, "six rows, a six-up wall");
});

test("TradingView spellings are translated once, in the page, and never leak", () => {
  for (const tvOnly of ["USOIL", "GOLD", "TSX:BOFA", "BOFA"])
    assert.doesNotMatch(source, new RegExp(`"${tvOnly}"`), `${tvOnly} is a TradingView name, not a served symbol`);
  /* 25 Sep: the workflow pages carry the same translations - DXY→DXUSD, GOLD→GCUSD, USOIL→CLUSD. */
  for (const id of ["wkMacro", "macro1D"]) {
    const rows = scenes.WORKFLOW_PAGES[id].tickers;
    assert.ok(rows.includes("CLUSD") && rows.includes("GCUSD") && rows.includes("DXUSD"), id + " carries served symbols");
  }
  assert.doesNotMatch(source, /"DXY"/, "DXY is a TradingView name, not a served symbol");
  assert.ok(scenes.WORKFLOW_PAGES.blueChip3D.tickers.includes("BAC"), "TSX:BOFA became BAC");
});

test("a workbench is a page TYPE: charts, named study stacks, and an optional own timeframe", () => {
  const state = scenes.workbenchState("oscWorkbench");
  assert.equal(state.label, "OSCILLATOR WORKBENCH");
  assert.deepEqual(Array.from(state.tickers), ["MU", "QQQ"]);
  assert.deepEqual(Array.from(state.stacks), ["OSCILLATOR", "OSCILLATOR"]);
  assert.deepEqual(Array.from(state.ranges), [null, null], "no per-chart timeframe means the wall's timeframe");
  assert.equal(state.chartCount, 2);
  assert.equal(scenes.workbenchState("tvMacro"), null, "an ordinary page is not a workbench");
  /* Every stack is spelled out in full, so a pane never inherits the wall's cloud switch
     and quietly becomes a different study than the page declares. */
  assert.equal(scenes.studyQuery("PRICE"), "&clouds=0");
  assert.equal(scenes.studyQuery("CLOUDS"), "&clouds=1");
  assert.equal(scenes.studyQuery("OSCILLATOR"), "&clouds=1&ema8=1&sma100=1");
  assert.equal(scenes.studyQuery("STEPPED"), "&clouds=1&steps=1");
  assert.equal(scenes.studyQuery("nonsense"), "", "an unknown stack adds nothing rather than guessing");
});

test("a workbench slot carries its stack in its own URL; every other page's URL is untouched", () => {
  const bindings = {
    RANGE: "1D", VIEW: "desk", CHART_COUNT: 2, CHARTS: ["MU", "QQQ"], encodeURIComponent,
    STATION_SHELL: { chart:"/station-shells/chart-v1" },
    SceneModel: scenes, SLOT_STACKS: ["OSCILLATOR", "OSCILLATOR", "", "", "", "", "", ""],
    SLOT_RANGES: ["", "1W", "", "", "", "", "", ""],
    /* 25 Sep: a slot may also ask for a number of bars. The HISTORY page that asked for 6,000 daily
       is retired (25 Sep, later); the mechanism stays, so it is still pinned here. */
    SLOT_BARS: [0, 0, 6000, 0, 0, 0, 0, 0]
  };
  bindings.chartSrc = functionFromDeck("chartSrc", bindings);
  const paneChartSrc = functionFromDeck("paneChartSrc", bindings);
  assert.match(paneChartSrc("MU", 0), /t=MU/);
  assert.match(paneChartSrc("MU", 0), /&clouds=1&ema8=1&sma100=1$/, "the declared stack is on the URL");
  assert.match(paneChartSrc("MU", 0), /range=1D/, "no per-chart timeframe: the wall's");
  assert.match(paneChartSrc("QQQ", 1), /range=1W/, "a per-chart timeframe wins for that slot only");
  assert.match(paneChartSrc("SPY", 2), /&bars=6000$/, "a bars request rides on the slot's own URL");
  assert.doesNotMatch(paneChartSrc("MU", 0), /bars=/, "and never on a slot that did not ask");
  const plain = { ...bindings, SLOT_STACKS: ["", "", "", "", "", "", "", ""], SLOT_RANGES: ["", "", "", "", "", "", "", ""], SLOT_BARS: [0, 0, 0, 0, 0, 0, 0, 0] };
  plain.chartSrc = functionFromDeck("chartSrc", plain);
  const plainPane = functionFromDeck("paneChartSrc", plain);
  assert.equal(plainPane("MU", 0), plain.chartSrc("MU", 0),
    "an ordinary page's frame URL is byte-identical to what it was before");
});

test("every page button is the same width, and the rail is a whole number of buttons", () => {
  assert.match(deck, /#pageRail \.page-chip\{ flex:none; width:81px;/,
    "a page button is a fixed width whatever its name");
  assert.match(deck, /text-overflow:ellipsis/, "a long name ellipses inside its own button");
  assert.equal(scenes.railChips(640, 20, 84, 3), 7, "640px of spare room is seven whole buttons");
  assert.equal(scenes.railChips(600, 20, 84, 3), 7);
  assert.equal(scenes.railChips(167, 20, 84, 3), 0, "under three buttons there is no rail, only the arrows");
  assert.equal(scenes.railChips(9000, 20, 84, 3), 20, "never more buttons than there are pages");
  /* The window slides by whole buttons and keeps the current page centred, so the dock
     geometry is the same on page 1 and on page 20. */
  assert.equal(scenes.railWindowStart(0, 7, 20), 0);
  assert.equal(scenes.railWindowStart(10, 7, 20), 7);
  assert.equal(scenes.railWindowStart(19, 7, 20), 13, "the last page never scrolls past the end");
  assert.equal(scenes.railWindowStart(-1, 7, 20), 0, "a manual workspace parks the rail at the start");
});

test("no two page buttons read the same, at 81px", () => {
  const labels = scenes.SCREENS.map((screen) => scenes.shortLabel(screen));
  assert.equal(new Set(labels).size, labels.length, "every page button reads differently");
  for (const label of labels)
    assert.ok(label.length <= 11, `${label} fits an 81px button without being cut`);
  assert.equal(scenes.shortLabel(scenes.screenForScene("internalsFast")), "INTERNALS");
  assert.equal(scenes.shortLabel(scenes.screenForScene("todo")), "TO-DO");
  assert.equal(scenes.shortLabel(scenes.screenForScene("scratch")), "SCRATCH");
  assert.equal(scenes.shortLabel(scenes.screenForScene("sectors3D")), "SECTORS", "a short name stands as it is (25 Sep: the tv* pages are retired)");
  assert.match(deck, /b\.textContent = SceneModel\.shortLabel\(screen\); b\.title = screen\.label;/,
    "the full name stays on the tooltip");
});

test("the page buttons never magnify, so the rail cannot clip a name in half", () => {
  assert.match(deck, /!node\.classList\.contains\("page-chip"\)/,
    "the dock's magnifying arc skips the fixed-width page buttons");
});

test("the readouts own fixed cells, so nothing shifts when a page name or a status is long", () => {
  assert.match(deck, /#dock #screenIndicator\{ display:inline-block; width:74px;[^}]*tabular-nums/);
  assert.match(deck, /#dock #marketStatus\{ display:inline-block; width:132px;[^}]*tabular-nums/);
  assert.doesNotMatch(deck, /#dock #marketStatus, #dock #screenIndicator\{ display:inline-block; width:auto; \}/,
    "the auto-width readout that moved everything beside it is gone");
});

test("one move to anywhere: the arrows, the edges, the keys and the jump list", () => {
  assert.match(deck, /id="edgePrev"/); assert.match(deck, /id="edgeNext"/);
  assert.match(deck, /#edgePrev, #edgeNext\{ position:fixed; top:50%;/,
    "the edge arrows are in the same two places on every page");
  assert.match(deck, /if \(event\.key === "ArrowLeft"\) \{ event\.preventDefault\(\); stepScreen\(-1\); \}/);
  assert.match(deck, /else if \(event\.key === "ArrowRight"\) \{ event\.preventDefault\(\); stepScreen\(1\); \}/);
  const typingTarget = functionFromDeck("typingTarget", { String });
  assert.equal(typingTarget({ tagName:"INPUT" }), true, "typing a ticker never changes the page");
  assert.equal(typingTarget({ tagName:"SELECT" }), true);
  assert.equal(typingTarget({ tagName:"DIV", isContentEditable:true }), true);
  assert.equal(typingTarget({ tagName:"BUTTON" }), false);
  assert.equal(typingTarget(null), false);
});

test("every button in the jump list is the same width too", () => {
  assert.match(deck, /#pageJumpList \.btn\{ width:168px;/);
  assert.match(deck, /grid-template-columns:repeat\(auto-fill, 168px\)/);
});

test("the jump list finds a page by its name or by a ticker on it — PCC in one move", () => {
  /* 25 Sep: PCC lives on MACRO · 4H (fixed fourth slot) and on INTERNALS; SCREENS order. */
  const byTicker = scenes.findPages("PCC");
  assert.deepEqual(Array.from(byTicker, (m) => m.screen.label), ["MACRO · 4H", "INTERNALS"]);
  assert.equal(byTicker[0].why, "PCC", "the list says WHY a page matched a ticker");
  assert.deepEqual(Array.from(scenes.findPages("blue"), (m) => m.screen.label), ["BLUE CHIP"]);
  assert.deepEqual(Array.from(scenes.findPages("MAC"), (m) => m.screen.label),
    ["MACRO · WEEK", "MACRO · DAY", "MACRO · 4H", "MACRO CROSS-ASSET"], "every macro page, workflow first");
  assert.deepEqual(Array.from(scenes.findPages("XLK"), (m) => m.screen.label), ["SECTORS", "SECTOR FAMILIES"],
    "a ticker on two pages offers both, rather than silently picking one");
  assert.equal(scenes.findPages("").length, 34, "an empty box offers every page (three RSI pages with P2; HISTORY retired)");
  /* TO-DO is findable by the four symbols parked on it; SCRATCH is findable by name only,
     because its symbols live on the device and the list must never guess at them. */
  assert.deepEqual(Array.from(scenes.findPages("TRIN"), (m) => m.screen.label), ["TO-DO"]);
  assert.deepEqual(Array.from(scenes.findPages("SCRATCH"), (m) => m.screen.label), ["SCRATCH"]);
  assert.deepEqual(Array.from(scenes.pageTickers("scratch")), []);
  assert.equal(scenes.findPages("ZZZZ").length, 0);
  assert.ok(scenes.pageTickers("oscWorkbench").includes("MU"), "a workbench page is searchable by its symbols");
});

test("the two symbols the provider does not carry are named, not dropped", () => {
  /* IGV (INDEXES) and NVTS (EXTRAS) are not in the chart API's tracked universe on
     23 Sep. They stay in their layouts so the page is Alan's page; the pane paints the
     provider's named absence until the universe carries them. */
  /* 25 Sep: the same rule on the workflow pages - IGV, NVTS and HUT stay in Alan's lists. */
  assert.ok(scenes.WORKFLOW_PAGES.wkIndexes.tickers.includes("IGV"));
  assert.ok(scenes.WORKFLOW_PAGES.otherIndexes1D.tickers.includes("IGV"));
  assert.ok(scenes.WORKFLOW_PAGES.ai2.tickers.includes("NVTS"));
  assert.ok(scenes.WORKFLOW_PAGES.ai3.tickers.includes("HUT"));
});
