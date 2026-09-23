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

test("every saved TradingView layout is a Station page with the same name, size and rows", () => {
  for (const [id, label, count, tickers] of LAYOUTS) {
    const preset = scenes.PRESETS[id];
    assert.ok(preset, `${label} is a page`);
    assert.equal(preset.label, label);
    assert.equal(preset.chartCount, count, `${label} keeps its chart count`);
    assert.deepEqual(Array.from(preset.tickers), tickers, `${label} keeps its rows, in order`);
    const screen = scenes.screenForScene(id);
    assert.ok(screen, `${label} is reachable by the arrows and the rail`);
    assert.equal(screen.label, label);
    assert.match(deck, new RegExp(`<option value="${id}">`), `${label} is in the scene menu too`);
  }
  assert.equal(scenes.SCREENS.length, 20, "nine curated screens, ten saved layouts, one workbench");
});

test("a saved layout is a picture, not a basket: five rows stay five rows in a six-up wall", () => {
  /* basketWindow exists for cohorts and short family baskets — it pages a four or five
     name list into twos. Alan's INDEXES layout is five names in a six-up wall, and it
     must stay that way, with the sixth slot simply empty. */
  const paged = scenes.basketWindow(scenes.PRESETS.tvIndexes.tickers, 0, 6);
  assert.equal(paged.tickers.length, 2, "the basket rule really would have paged it into twos");
  const page = scenes.exactPage(scenes.PRESETS.tvIndexes);
  assert.deepEqual(Array.from(page.tickers), ["MAGS","SMH","IWM","DRAM","IGV"]);
  assert.equal(page.chartCount, 6, "a six-up wall with one empty slot");
  assert.equal(page.hasNext, false);
  assert.equal(page.hasPrevious, false);
  const fixedSceneState = functionFromDeck("fixedSceneState", {
    SceneModel: scenes, BASKET_OFFSET: 0, familyFor: () => null, Object, Date
  });
  const state = fixedSceneState("tvIndexes");
  assert.deepEqual(Array.from(state.tickers), ["MAGS","SMH","IWM","DRAM","IGV"]);
  assert.equal(state.chartCount, 6);
});

test("TradingView spellings are translated once, in the page, and never leak", () => {
  for (const tvOnly of ["USOIL", "GOLD", "TSX:BOFA", "BOFA"])
    assert.doesNotMatch(source, new RegExp(`"${tvOnly}"`), `${tvOnly} is a TradingView name, not a served symbol`);
  assert.ok(scenes.PRESETS.tvMacro.tickers.includes("CLUSD"), "USOIL became CLUSD");
  assert.ok(scenes.PRESETS.tvMacro.tickers.includes("GCUSD"), "GOLD became GCUSD");
  assert.ok(scenes.PRESETS.tvBlueChip.tickers.includes("BAC"), "TSX:BOFA became BAC");
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
    SLOT_RANGES: ["", "1W", "", "", "", "", "", ""]
  };
  bindings.chartSrc = functionFromDeck("chartSrc", bindings);
  const paneChartSrc = functionFromDeck("paneChartSrc", bindings);
  assert.match(paneChartSrc("MU", 0), /t=MU/);
  assert.match(paneChartSrc("MU", 0), /&clouds=1&ema8=1&sma100=1$/, "the declared stack is on the URL");
  assert.match(paneChartSrc("MU", 0), /range=1D/, "no per-chart timeframe: the wall's");
  assert.match(paneChartSrc("QQQ", 1), /range=1W/, "a per-chart timeframe wins for that slot only");
  const plain = { ...bindings, SLOT_STACKS: ["", "", "", "", "", "", "", ""], SLOT_RANGES: ["", "", "", "", "", "", "", ""] };
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

test("the jump list finds a page by its name or by a ticker on it — PCC in one move", () => {
  const byTicker = scenes.findPages("PCC");
  assert.deepEqual(Array.from(byTicker, (m) => m.screen.label), ["INTERNALS FAST", "MACRO"]);
  assert.equal(byTicker[0].why, "PCC", "the list says WHY a page matched a ticker");
  assert.deepEqual(Array.from(scenes.findPages("blue"), (m) => m.screen.label), ["BLUE CHIP"]);
  assert.deepEqual(Array.from(scenes.findPages("MAC"), (m) => m.screen.label), ["MACRO CROSS-ASSET", "MACRO"]);
  assert.deepEqual(Array.from(scenes.findPages("XLB"), (m) => m.screen.label), ["SECTOR FAMILIES", "SECTORS"],
    "a ticker on two pages offers both, rather than silently picking one");
  assert.equal(scenes.findPages("").length, 20, "an empty box offers every page");
  assert.equal(scenes.findPages("ZZZZ").length, 0);
  assert.ok(scenes.pageTickers("oscWorkbench").includes("MU"), "a workbench page is searchable by its symbols");
});

test("the two symbols the provider does not carry are named, not dropped", () => {
  /* IGV (INDEXES) and NVTS (EXTRAS) are not in the chart API's tracked universe on
     23 Sep. They stay in their layouts so the page is Alan's page; the pane paints the
     provider's named absence until the universe carries them. */
  assert.ok(scenes.PRESETS.tvIndexes.tickers.includes("IGV"));
  assert.ok(scenes.PRESETS.tvExtras.tickers.includes("NVTS"));
});
