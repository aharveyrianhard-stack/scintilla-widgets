import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8");
const context = { globalThis:{} };
vm.runInNewContext(source, context);
const scenes = context.globalThis.StationScenes;
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");

function functionFromDeck(name, bindings = {}) {
  const start = deck.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  let end = -1;
  for (let index = deck.indexOf("{", start); index < deck.length; index += 1) {
    if (deck[index] === "{") depth += 1;
    if (deck[index] === "}") depth -= 1;
    if (depth === 0) { end = index + 1; break; }
  }
  return vm.runInNewContext(`(${deck.slice(start, end)})`, bindings);
}

function functionFromSource(sourceText, name, bindings = {}) {
  const start = sourceText.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  let depth = 0, end = -1;
  for (let i = sourceText.indexOf("{", start); i < sourceText.length; i++) {
    if (sourceText[i] === "{") depth++;
    else if (sourceText[i] === "}" && --depth === 0) { end = i + 1; break; }
  }
  const context = { globalThis:{}, ...bindings };
  vm.runInNewContext(`${sourceText.slice(start, end)}; globalThis.fn = ${name};`, context);
  return context.globalThis.fn;
}

test("all eleven curated scenes are present with fixed baskets", () => {
  assert.deepEqual(Array.from(scenes.IDS), ["live","indexNow","indexLeadership","companyLeadership","focus2","macroCrossAsset","internalsFast","internalsSlow","sectorFamilies","themeFamilies","custom"]);
  assert.deepEqual(Array.from(scenes.PRESETS.indexLeadership.tickers), ["SPY","QQQ","IWM","MAGS","SMH","DIA"]);
  assert.equal(scenes.PRESETS.companyLeadership.range, "3h");
  assert.equal(scenes.PRESETS.internalsSlow.range, "1D");
  assert.equal(scenes.PRESETS.macroCrossAsset.range, "3D");
});

test("INDEX NOW changes only its first two slots at the New York boundary", () => {
  assert.deepEqual(Array.from(scenes.indexNowTickersFor("2026-08-11T11:59:00Z")), ["ESUSD","NQUSD","CLUSD"]);
  assert.deepEqual(Array.from(scenes.indexNowTickersFor("2026-08-11T12:00:00Z")), ["SPY","QQQ","CLUSD"]);
  assert.deepEqual(Array.from(scenes.indexNowTickersFor("2026-08-11T22:00:00Z")), ["ESUSD","NQUSD","CLUSD"]);
});

test("larger curated grids page real basket members without blank cards", () => {
  const basket = Array.from(scenes.PRESETS.indexLeadership.tickers);
  assert.deepEqual(Array.from(scenes.basketWindow(basket, 0, 2).tickers), ["SPY","QQQ"]);
  assert.deepEqual(Array.from(scenes.basketWindow(basket, 0, 6).tickers), basket);
  assert.equal(scenes.basketWindow(basket, 0, 6).tickers.includes(""), false);
  assert.equal(scenes.basketWindow([], 0, 6).empty, true);
});

test("four, six, and eight chart grids use one shared lower axis", () => {
  assert.equal(scenes.usesSharedBottomAxis(4), true);
  assert.equal(scenes.usesSharedBottomAxis(6), true);
  assert.equal(scenes.chartCountForSize(8), 8);
  assert.equal(scenes.usesSharedBottomAxis(8), true);
  assert.equal(scenes.usesSharedBottomAxis(3), false);
  assert.match(deck, /#rowTop\.charts-8/);
  assert.match(deck, /axis\.id = "sharedTimeAxis"/);
  assert.match(deck, /row\.classList\.toggle\("shared-axis"/);
  assert.match(deck, /sharedAxis=1/);
  assert.match(chart, /const SHARED_TIME_AXIS = QS\.get\("sharedAxis"\) === "1"/);
  assert.match(chart, /if \(!SHARED_TIME_AXIS\) \{/);
  assert.match(chart, /padB = SHARED_TIME_AXIS \? 8 : axisBand/);
});

test("CUSTOM six and eight chart walls begin with real editable symbols", () => {
  const fillCustomWall = functionFromDeck("fillCustomWall", {
    CLEAN: (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12),
    chartCount: scenes.chartCountForSize,
    CUSTOM_WALL_STARTERS: ["SPY","QQQ","IWM","MAGS","SMH","AAPL","MSFT","AMZN"]
  });
  const six = fillCustomWall([], 6);
  assert.deepEqual(Array.from(six.slice(0, 6)), ["SPY","QQQ","IWM","MAGS","SMH","AAPL"]);
  assert.equal(six.slice(0, 6).includes(""), false);
  const eight = fillCustomWall(["TSM", "WULF"], 8);
  assert.deepEqual(Array.from(eight.slice(0, 2)), ["TSM", "WULF"]);
  assert.equal(eight.slice(0, 8).includes(""), false);
  assert.equal(new Set(eight.slice(0, 8)).size, 8, "starter fill must not duplicate a manual symbol");
  assert.match(deck, /option value="8"/);
  assert.match(deck, /countOption\.disabled = SCENE !== "custom"/);
});

test("rotation is limited to curated scenes and wraps with an explicit pause control", () => {
  assert.deepEqual(Array.from(scenes.ROTATION_IDS), ["indexNow","indexLeadership","companyLeadership","focus2","macroCrossAsset","internalsFast","internalsSlow","sectorFamilies","themeFamilies"]);
  assert.equal(scenes.nextRotatingScene("live"), "indexNow");
  assert.equal(scenes.nextRotatingScene("themeFamilies"), "indexNow");
  assert.match(deck, /ROTATE_SECONDS = \[30,60,120\]/);
  assert.match(deck, /id="rotateToggle"/);
  assert.match(deck, /setRotationPaused\(!ROTATE_PAUSED\)/);
  assert.match(deck, /setTimeout\(/);
});

test("Scenes V2 stays local-only and preserves the current iPad companion", () => {
  assert.doesNotMatch(deck, /passwordless|signInWithOtp|station_shared_state/i);
  assert.match(deck, /IPAD_COMPANION/);
  assert.match(deck, /\/pane-x\?remote=1/);
  assert.match(deck, /SCENE !== "live" && SCENE !== "custom"/);
});

test("CUSTOM preserves the screenshot-shaped sparse six-slot workspace", () => {
  const match = deck.match(/function preservedCustomState\(state\) \{[\s\S]*?\n\}/);
  assert.ok(match, "CUSTOM recovery helper is present in the rendered Station source");
  const customContext = {
    CLEAN: (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12),
    RANGES: ["15m","30m","1h","2h","3h","4h","6h","12h","1D","3D","1W"],
    RANGE: "3h",
    chartCount: scenes.chartCountForSize,
    SceneModel: { chartCountForSize: scenes.chartCountForSize }
  };
  vm.runInNewContext(`${match[0]}; globalThis.preserve = preservedCustomState;`, customContext);
  const recovered = customContext.preserve({
    charts: ["TSM", "WULF", "", "", "", ""],
    chartCount: 6,
    range: "3h"
  });
  assert.equal(recovered.chartCount, 6);
  assert.deepEqual(Array.from(recovered.charts), ["TSM", "WULF", "", "", "", "", "", ""]);
  assert.equal(recovered.charts.slice(0, recovered.chartCount).filter(Boolean).length, 2);
  assert.match(deck, /const hasIncomingSlots = Array\.from\(\{ length:8 \}, \(_, i\) => QS\.has\("c" \+ \(i \+ 1\)\)\)\.some\(Boolean\)/);
  assert.match(deck, /if \(hasIncomingSlots\) return;/);
  assert.match(deck, /if \(SCENE === "custom" && requestedCount >= 6\)/);
  assert.match(deck, /CHART_COUNT = requestedCount;/,
    "growing Custom preserves intentionally empty slots instead of reseeding them");
});

test("a direct Custom URL is authoritative over saved and default symbols", () => {
  const initialChart = functionFromDeck("initialWorkspaceChart", {
    CLEAN: (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12)
  });
  const direct = ["TSM", "WULF", "", "", "", ""].map((incoming, index) =>
    initialChart(incoming, ["AAPL","NVDA","SPY","QQQ","IWM","MAGS"][index], index, true));
  assert.deepEqual(Array.from(direct), ["TSM", "WULF", "", "", "", ""],
    "direct c1/c2 URLs never inherit saved/default c3–c6 values");
  assert.equal(initialChart("", "SPY", 2, false), "SPY",
    "saved workspaces retain their existing behavior when no direct Custom URL is supplied");
  assert.match(deck, /const DIRECT_CUSTOM_WORKSPACE = SCENE === "custom"/);
});

test("Custom uses a complete desk budget and explicit empty versus paused cards", () => {
  assert.match(deck, /const LIVE_CAP = STACKED \? 2 : 11;/);
  assert.match(deck, /empty editable slot/);
  assert.match(deck, /resume chart/);
  assert.match(deck, /\^c\(\[1-8\]\)\$/);
  assert.match(deck, /syncChartPanes\(\);\n  CHARTS\.forEach/,
    "count changes synchronize chart URLs before mounting active panes");
});

test("shared-axis query follows only synchronized chart counts", () => {
  const chartSrc = functionFromDeck("chartSrc", {
    RANGE: "3h",
    VIEW: "desk",
    CHART_COUNT: 6,
    encodeURIComponent,
    SceneModel: { usesSharedBottomAxis: scenes.usesSharedBottomAxis }
  });
  assert.match(chartSrc("TSM"), /t=TSM/);
  assert.match(chartSrc("TSM"), /sharedAxis=1/);
  const localAxisChartSrc = functionFromDeck("chartSrc", {
    RANGE: "3h",
    VIEW: "desk",
    CHART_COUNT: 3,
    encodeURIComponent,
    SceneModel: { usesSharedBottomAxis: scenes.usesSharedBottomAxis }
  });
  assert.doesNotMatch(localAxisChartSrc("TSM"), /sharedAxis=1/);
});

test("fixed price overlay reports daily performance honestly", () => {
  const dayChange = functionFromSource(chart, "chDayChange", { Number, Math });
  assert.deepEqual(JSON.parse(JSON.stringify(dayChange(105, 100))), { text:"+5.00%", tone:"up" });
  assert.deepEqual(JSON.parse(JSON.stringify(dayChange(95, 100))), { text:"-5.00%", tone:"down" });
  assert.deepEqual(JSON.parse(JSON.stringify(dayChange(100, 100))), { text:"0.00%", tone:"flat" });
  assert.deepEqual(JSON.parse(JSON.stringify(dayChange(105, null))), { text:"—", tone:"flat" });
  assert.match(chart, /\.sc-nchart__live\{ position:absolute; top:7px; left:8px/);
  assert.match(chart, /\.sc-nchart__live-change/);
  assert.match(chart, /badge\.dataset\.change = day\.tone/);
  assert.doesNotMatch(chart, /sc-nchart__live-meta/,
    "the overlay keeps price plus daily change, not last-time/OHLC clutter");
});

test("a scene transition reloads a mounted frame whose URL has an old ticker", () => {
  const syncChartFrame = functionFromDeck("syncChartFrame", { location: { origin:"https://station.test" } });
  const priorSrc = "/chart?bare=1&t=SPY&range=3h";
  const macroSrc = "/chart?bare=1&t=US10Y&range=3D";
  const calls = [];
  const frame = {
    getAttribute: (name) => name === "src" ? priorSrc : null,
    setAttribute: (name, value) => calls.push({ name, value }),
    contentWindow: { postMessage: () => calls.push({ name:"postMessage" }) }
  };
  assert.equal(syncChartFrame(frame, macroSrc, { sc:"chart", ticker:"US10Y", range:"3D" }), true);
  assert.deepEqual(calls, [{ name:"src", value:macroSrc }]);
});

test("a frame whose URL already matches can use the fast chart message", () => {
  const syncChartFrame = functionFromDeck("syncChartFrame", { location: { origin:"https://station.test" } });
  const src = "/chart?bare=1&t=GCUSD&range=3D";
  const calls = [];
  const frame = {
    getAttribute: () => src,
    setAttribute: (name, value) => calls.push({ name, value }),
    contentWindow: { postMessage: (message, origin) => calls.push({ message, origin }) }
  };
  assert.equal(syncChartFrame(frame, src, { sc:"chart", ticker:"GCUSD", range:"3D" }), false);
  assert.deepEqual(calls, [{ message:{ sc:"chart", ticker:"GCUSD", range:"3D" }, origin:"https://station.test" }]);
  assert.match(deck, /syncChartFrame\(o\.frame, o\.def\.src, \{ sc:"chart", ticker, range:RANGE \}\)/);
});
