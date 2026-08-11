import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8");
const context = { globalThis:{} };
vm.runInNewContext(source, context);
const scenes = context.globalThis.StationScenes;
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");

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

test("four and six chart grids use one shared lower axis", () => {
  assert.equal(scenes.usesSharedBottomAxis(4), true);
  assert.equal(scenes.usesSharedBottomAxis(6), true);
  assert.equal(scenes.usesSharedBottomAxis(3), false);
  assert.match(deck, /axis\.id = "sharedTimeAxis"/);
  assert.match(deck, /row\.classList\.toggle\("shared-axis"/);
});

test("Scenes V2 stays local-only and preserves the current iPad companion", () => {
  assert.doesNotMatch(deck, /passwordless|signInWithOtp|station_shared_state/i);
  assert.match(deck, /IPAD_COMPANION/);
  assert.match(deck, /\/pane-x\?remote=1/);
  assert.match(deck, /SCENE !== "live" && SCENE !== "custom"/);
});

test("CUSTOM recovery compacts the screenshot-shaped sparse six-card workspace", () => {
  const match = deck.match(/function compactCustomState\(state\) \{[\s\S]*?\n\}/);
  assert.ok(match, "CUSTOM recovery helper is present in the rendered Station source");
  const customContext = {
    CLEAN: (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12),
    RANGES: ["15m","30m","1h","2h","3h","4h","6h","12h","1D","3D","1W"],
    RANGE: "3h",
    chartCount: (value) => Math.max(1, Math.min(6, Number(value) || 2)),
    SceneModel: { chartCountForSize: scenes.chartCountForSize }
  };
  vm.runInNewContext(`${match[0]}; globalThis.compact = compactCustomState;`, customContext);
  const recovered = customContext.compact({
    charts: ["TSM", "WULF", "", "", "", ""],
    chartCount: 6,
    range: "3h"
  });
  assert.equal(recovered.chartCount, 2);
  assert.deepEqual(Array.from(recovered.charts), ["TSM", "WULF", "", "", "", ""]);
  assert.equal(recovered.charts.slice(0, recovered.chartCount).includes(""), false);
  assert.equal(customContext.compact({ charts:["", "", ""], chartCount:6, range:"3h" }), null);
  assert.match(deck, /const fallback = compactCustomState\(\{ charts:CHARTS, chartCount:CHART_COUNT, range:RANGE \}\)/);
  assert.match(deck, /if \(!recovered\) SCENE = "live"/);
  assert.match(deck, /state = compactCustomState\(\{ charts:CHARTS, chartCount:CHART_COUNT, range:RANGE \}\)/);
  assert.match(deck, /SCENE === "custom"\n    \? SceneModel\.chartCountForSize\(Math\.min\(requestedCount, CHARTS\.filter\(Boolean\)\.length\)\)/);
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
