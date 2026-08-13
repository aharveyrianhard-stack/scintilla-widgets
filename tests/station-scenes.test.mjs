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
const videoPane = fs.readFileSync(new URL("../pane-video/index.html", import.meta.url), "utf8");
const ipadCompanion = fs.readFileSync(new URL("../station-ipad/index.html", import.meta.url), "utf8");
const stationManifest = JSON.parse(fs.readFileSync(new URL("../station/manifest.json", import.meta.url), "utf8"));
const stationIcon = fs.readFileSync(new URL("../station/icon.svg", import.meta.url), "utf8");

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
  assert.deepEqual(Array.from(scenes.PRESETS.indexLeadership.tickers), ["SPY","QQQ","DIA","IWM","MAGS","SMH"]);
  assert.equal(scenes.PRESETS.companyLeadership.range, "3h");
  assert.equal(scenes.PRESETS.macroCrossAsset.chartCount, 6);
  assert.equal(scenes.PRESETS.internalsFast.chartCount, 6);
  assert.equal(scenes.PRESETS.internalsSlow.range, "1D");
  assert.equal(scenes.PRESETS.macroCrossAsset.range, "3D");
});

test("Station install identity stays distinct from the Hub and carries the Scintilla mark", () => {
  assert.equal(stationManifest.name, "SCINTILLA Station");
  assert.equal(stationManifest.short_name, "STATION");
  assert.deepEqual(stationManifest.icons.map((icon) => icon.src), [
    "/station/icon.png", "/station/icon-512.png", "/station/icon.svg"
  ]);
  assert.match(stationIcon, /SCINTILLA Station/);
  assert.match(stationIcon, /unaltered Scintilla trefoil/,
    "the canonical Scintilla mark remains intact inside the Station object");
  assert.match(stationIcon, /rotate\(120 48 48\)/,
    "the canonical trefoil remains the primary Station mark");
  assert.match(stationIcon, /<rect x="68" y="80" width="376" height="286"/,
    "the surrounding shape is the Station object, analogous to the lock—not a replacement logo");
  assert.match(stationIcon, /stroke="#00D4FF" stroke-width="12"/,
    "the Station silhouette uses the same cyan visual language as the mark");
  assert.doesNotMatch(stationIcon, /matching-weight market trace|L142 432/,
    "no unrelated market trace competes with the brand mark");
  assert.match(deck, /apple-touch-icon" sizes="512x512" href="\/station\/icon-512\.png"/);
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

test("Macro and Internals are complete honest six-up screens", () => {
  const macro = Array.from(scenes.PRESETS.macroCrossAsset.tickers);
  const internals = Array.from(scenes.PRESETS.internalsFast.tickers);
  assert.deepEqual(macro, ["US10Y","DXUSD","GCUSD","SIUSD","CLUSD","BTCUSD"],
    "Macro Cross-Asset carries a verified continuously quoted risk asset; ES remains in INDEX NOW overnight");
  assert.deepEqual(internals, ["VIX","ADD","PCC","CUMTICK","TICK","TRIN"]);
  assert.equal(scenes.basketWindow(macro, 0, 6).chartCount, 6);
  assert.equal(scenes.basketWindow(internals, 0, 6).tickers.includes(""), false);
  assert.equal(scenes.chartCountForSize(4), 2, "retired four-up inputs normalize to two-up");
});

test("six and eight chart grids pair each top chart with its column's lower axis", () => {
  assert.equal(scenes.usesPairedColumnAxis(4), false);
  assert.equal(scenes.usesPairedColumnAxis(6), true);
  assert.equal(scenes.chartCountForSize(8), 8);
  assert.equal(scenes.usesPairedColumnAxis(8), true);
  assert.equal(scenes.usesPairedColumnAxis(3), false);
  assert.equal(scenes.hidesTopChartAxis(2, 6), true);
  assert.equal(scenes.hidesTopChartAxis(3, 6), false);
  assert.equal(scenes.hidesTopChartAxis(3, 8), true);
  assert.equal(scenes.hidesTopChartAxis(4, 8), false);
  assert.match(deck, /#rowTop\.charts-8/);
  assert.doesNotMatch(deck, /sharedTimeAxis/);
  assert.match(deck, /function chartSrc\(t, index, transitionGeneration\)/);
  assert.match(deck, /SceneModel\.hidesTopChartAxis\(index, CHART_COUNT\)/);
  assert.match(deck, /sharedAxis=1/);
  assert.match(chart, /const SHARED_TIME_AXIS = QS\.get\("sharedAxis"\) === "1"/);
  assert.match(chart, /if \(!SHARED_TIME_AXIS\) \{/);
  assert.match(chart, /padB = SHARED_TIME_AXIS \? 5 \* scale : axisBand/);
  assert.doesNotMatch(chart, /chart-axis/);
});

test("CUSTOM six and eight chart walls preserve their manual symbols", () => {
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
  assert.doesNotMatch(deck, /option value="4"/,
    "the retired four-up choice is not offered");
  assert.match(deck, /function paintChartCountChoices\(\)/);
  assert.match(deck, /\[2,6,8\]\.includes\(\+option\.value\)/,
    "Custom presents only the purposeful two, six, and eight chart choices");
});

test("normal wall chooser is two, six, or eight while INDEX NOW keeps its launch trio", () => {
  assert.doesNotMatch(deck, /option value="1"/,
    "one-chart detail is not offered as a normal wall choice");
  assert.match(deck, /option value="3" hidden data-preset-only="true"/,
    "three-chart INDEX NOW remains a hidden preset state, not a global manual choice");
  assert.match(deck, /const CHART_COUNTS = \[2,6,8\]/);
  assert.match(deck, /scene === "indexNow" && \+value === 3 \? 3 : chartCount\(value\)/,
    "only a preset-driven INDEX NOW launch retains its coherent three symbols");
  assert.match(deck, /sceneChartCount\(next, SCENE, !!fromScene\)/,
    "manual count changes still normalize through the regular 2\/6\/8 chooser");
  assert.match(deck, /const presetOnly = option\.dataset\.presetOnly === "true"/,
    "the INDEX NOW state remains representable without being shown in the menu");
});

test("global screen navigation and rotation share the same curated sequence", () => {
  assert.deepEqual(Array.from(scenes.ROTATION_IDS), ["indexNow","indexLeadership","companyLeadership","focus2","macroCrossAsset","internalsFast","internalsSlow","sectorFamilies","themeFamilies"]);
  assert.equal(scenes.nextScreen("live").scene, "indexNow");
  assert.equal(scenes.nextScreen("themeFamilies").scene, "indexNow");
  assert.equal(scenes.previousScreen("live").scene, "themeFamilies");
  assert.equal(scenes.nextScreen("internalsFast").scene, "internalsSlow",
    "Internals Fast and Slow remain separate global screens");
  assert.equal(scenes.previousScreen("internalsSlow").scene, "internalsFast",
    "the arrows can reach either Internals preset without a scene merge");
  assert.equal(scenes.screenForScene("internalsFast").label, "INTERNALS FAST");
  assert.equal(scenes.screenForScene("internalsSlow").label, "INTERNALS SLOW");
  assert.equal(scenes.screenForScene("custom"), null, "manual Custom is excluded from global navigation");
  assert.match(deck, /ROTATE_SECONDS = \[30,60,120\]/);
  assert.match(deck, /id="rotateToggle"/);
  assert.match(deck, /setRotationPaused\(!ROTATE_PAUSED\)/);
  assert.match(deck, /setTimeout\(/);
  assert.match(deck, /const next = SceneModel\.nextScreen\(SCENE\);\n    try \{ await applyScene\(next\.scene, \{ rotate:true, screen:true \}\); \}/,
    "Auto Rotate takes the exact same next-screen path as the header control");
  assert.match(deck, /el\("screenNext"\)\.addEventListener\("click", \(\) => applyScene\(SceneModel\.nextScreen\(SCENE\)\.scene, \{ screen:true \}\)\)/);
});

test("header exposes one global screen control instead of basket pagers", () => {
  assert.match(deck, /class="control-group scene-controls"/);
  assert.match(deck, /id="resetScene"[^>]*aria-label="Reset scene preset"/);
  assert.match(deck, /class="control-group rotate-controls"/);
  assert.match(deck, /<span class="control-label">auto rotate<\/span>/);
  assert.match(deck, /toggle\.textContent = running \? "pause" : "start"/);
  assert.match(deck, /id="screenControls" aria-label="Global Station screens"/);
  assert.match(deck, /aria-label="Previous screen"/);
  assert.match(deck, /aria-label="Next screen"/);
  assert.match(deck, /"screen " \+ \(SceneModel\.SCREENS\.indexOf\(screen\) \+ 1\)/);
  assert.match(deck, /grid-template-columns:26px 68px 26px/,
    "screen arrows occupy fixed cells regardless of the active scene name");
  assert.doesNotMatch(deck, /screen\.label\.toLowerCase\(\)/,
    "the scene picker names the screen so navigation never repeats a variable-width label");
  assert.match(deck, /el\("screenPrev"\)\.addEventListener\("click"/);
  assert.match(deck, /el\("screenNext"\)\.addEventListener\("click"/);
  assert.doesNotMatch(deck, /id="cohortControls"/);
});

test("display window action stays separate from the remembered layout chooser", () => {
  assert.match(deck, /<option value="display" hidden data-display-only="true">display<\/option>/,
    "display remains a valid route profile without appearing as a second layout choice");
  assert.match(deck, /id="displayBtn"[^>]*aria-label="Open dedicated Station display window"/);
  assert.match(deck, /u\.searchParams\.set\("view", "display"\)/,
    "the external display action retains its dedicated-window behavior");
  assert.match(deck, /const VIEW_MODES = \["auto","desk","ipad","display","compact"\]/);
});

test("Scenes V2 stays local-only and preserves the current iPad companion", () => {
  assert.doesNotMatch(deck, /passwordless|signInWithOtp|station_shared_state/i);
  assert.match(deck, /IPAD_COMPANION/);
  assert.match(deck, /\/pane-x\?remote=1/);
  assert.match(deck, /const sessionRemembered = \(key\) =>/);
});

test("iPad profile keeps the complete Station wall with proportional child typography", () => {
  const xPane = fs.readFileSync(new URL("../pane-x/index.html", import.meta.url), "utf8");
  assert.match(deck, /const VIEW_MODES = \["auto","desk","ipad","display","compact"\]/);
  assert.match(deck, /<option value="ipad">iPad<\/option>/);
  assert.match(deck, /const keepsCompleteWall = \(\) => VIEW === "desk" \|\| VIEW === "ipad"/);
  assert.match(deck, /text-size-adjust:100%/);
  assert.match(chart, /-webkit-text-size-adjust:100%; text-size-adjust:100%/);
  assert.match(chart, /html\[data-view="ipad"\] \.sc-nchart__live\{[^}]*font-size:var\(--ipad-live-size\)/);
  assert.match(chart, /const ipadProfile = VIEW_PROFILE === "ipad"/);
  assert.match(deck, /function paintIpadDensity\(\)/);
  assert.match(deck, /function boundedIpadScale\(width, height, referenceWidth, referenceHeight\)/);
  assert.match(deck, /type:"SCINTILLA_VIEW_PROFILE", view:VIEW, scale/);
  assert.match(chart, /function applyIpadPaneScale\(forced\)/);
  assert.match(videoPane, /function applyIpadPaneScale\(forced\)/);
  assert.match(xPane, /function applyIpadPaneScale\(forced\)/);
  assert.match(videoPane, /VIEW_PROFILES = \["auto","desk","ipad","display","compact"\]/);
  assert.match(xPane, /VIEW_PROFILES = \["auto","desk","ipad","display","compact"\]/);
});

test("generated paired iPad companion routes carry the iPad profile through the wall", () => {
  const pairedDeckUrl = functionFromSource(ipadCompanion, "pairedDeckUrl", { URLSearchParams, encodeURIComponent });
  const pair = "a".repeat(32);
  const src = pairedDeckUrl(`#pair=${pair}&code=123456`);
  assert.equal(src, `/deck/?ipadPair=${pair}&ipadCode=123456&view=ipad`);
  assert.doesNotMatch(src, /view=desk/);
  const companionChartSrc = functionFromDeck("chartSrc", {
    encodeURIComponent,
    RANGE: "3h",
    VIEW: "ipad",
    CHART_COUNT: 3,
    SceneModel: { hidesTopChartAxis: () => false }
  });
  assert.match(companionChartSrc("SPY", 0), /view=ipad/);
  assert.match(deck, /\/pane-video\?feed=personal[^\n]*&view=" \+ encodeURIComponent\(VIEW\)/);
  assert.match(deck, /\/pane-x\?remote=1[^\n]*&view=" \+ encodeURIComponent\(VIEW\)/);
});

test("CUSTOM preserves the screenshot-shaped sparse six-slot workspace", () => {
  const match = deck.match(/function preservedCustomState\(state\) \{[\s\S]*?\n\}/);
  assert.ok(match, "CUSTOM recovery helper is present in the rendered Station source");
  const customContext = {
    CLEAN: (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12),
    RANGES: ["15m","30m","1h","2h","3h","4h","6h","12h","1D","3D","1W"],
    RANGE: "3h",
    customChartCount: (value) => +value <= 2 ? 2 : +value <= 6 ? 6 : 8,
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
  const migratedFour = customContext.preserve({
    charts: ["TSM", "WULF", "SPY", "QQQ"], chartCount:4, range:"3h"
  });
  assert.equal(migratedFour.chartCount, 6, "a stored four-up Custom wall widens to six");
  assert.deepEqual(Array.from(migratedFour.charts), ["TSM", "WULF", "SPY", "QQQ", "", "", "", ""],
    "migration retains all four saved positions and creates only editable empty slots");
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

test("named scenes are editable device-session presets with an explicit reset", () => {
  assert.match(deck, /const sessionRemembered = \(key\) => \{ try \{ return sessionStorage\.getItem/);
  assert.match(deck, /const prefix = localWorkspace \? "station\." \+ SCENE : "station\.flex\." \+ SCENE/);
  assert.match(deck, /state = !options\?\.reset && !namedPage && hasStoredScene\(requested\)/,
    "navigation and rotation preserve working scene edits until Reset Preset");
  assert.match(deck, /installSceneState\(hasStoredScene\(SCENE\) \? editableState\(SCENE\) : fixedSceneState\(SCENE\)\)/);
  assert.match(deck, /id="resetScene"/);
  assert.match(deck, /el\("resetScene"\)\.addEventListener\("click"/);
  assert.doesNotMatch(deck, /edits are not enabled/);
  assert.doesNotMatch(deck, /n\.readOnly = SCENE/);
  assert.doesNotMatch(deck, /if \(SCENE !== "live" && SCENE !== "custom"\) \{/,
    "named scenes no longer reject slot edits");
});

test("Custom uses a complete desk budget and explicit empty versus paused cards", () => {
  assert.match(deck, /const LIVE_CAP = STACKED \? 2 : 11;/);
  assert.match(deck, /empty editable slot/);
  assert.match(deck, /resume chart/);
  assert.match(deck, /\^c\(\[1-8\]\)\$/);
  assert.match(deck, /syncChartPanes\(transitionGeneration\);\n  CHARTS\.forEach/,
    "count changes synchronize chart URLs before mounting active panes");
});

test("rotation stages only two cold chart frames and fences outgoing retries", () => {
  assert.match(deck, /const ROTATION_COLD_LOAD_LIMIT = 2;/);
  assert.match(deck, /while \(rotationColdLoads < ROTATION_COLD_LOAD_LIMIT && rotationLoadQueue\.length\)/);
  assert.match(deck, /job\.generation !== ROTATION_GENERATION/,
    "stale queued document loads are discarded before they mount");
  assert.match(deck, /function beginRotationChartTransition\(\)/);
  assert.match(deck, /cancelChartFrameTransition\(pane\.frame, ROTATION_GENERATION\)/,
    "existing frames are told to cancel their older retry lifecycle");
  assert.match(deck, /chartCachedInBrowser\(ticker, RANGE\)/,
    "cached panes are allowed through without consuming a cold-load slot");
  assert.match(chart, /host\._transitionGeneration !== generation/,
    "a response or retry from an older transition cannot repaint the current chart");
  assert.match(chart, /d\.sc === "chart-transition"/);
});

test("stalled chart reads retain a truthful ticker fallback and report coherent delayed state", () => {
  assert.match(chart, /ticker\.textContent = host\.dataset\.t/,
    "the editable ticker remains visible without inventing a price or daily percent");
  assert.doesNotMatch(chart, /price\.textContent = hasQuote/,
    "price is not duplicated in the readout while no quote has arrived");
  assert.match(chart, /reportChartDataState\(host, \{ history:"delayed" \}\)/);
  assert.match(chart, /reportChartDataState\(host, \{ quote:"delayed" \}\)/);
  assert.match(chart, /sc:"chart-data-state"/);
  const summarize = functionFromDeck("chartDataSummary");
  assert.deepEqual(JSON.parse(JSON.stringify(summarize([{ ticker:"SPY", history:"delayed", quote:"loading" }]))), { mode:"delayed", count:1 });
  assert.deepEqual(JSON.parse(JSON.stringify(summarize([{ ticker:"SPY", history:"ready", quote:"ready" }]))), { mode:"ready", count:0 });
  assert.match(deck, /DATA · delayed \(\" \+ summary\.count \+ "\)/);
});

test("Station admits at most two visible chart requests and discards stale generation retries", () => {
  assert.match(deck, /const CHART_DATA_LOAD_LIMIT = 2;/);
  assert.match(deck, /function selectChartDataLoadAdmissions\(state, limit = CHART_DATA_LOAD_LIMIT\)/);
  assert.match(deck, /chartDataLoadQueue = \[\];/);
  assert.match(chart, /function acquireChartLoadPermit\(host, req, generation\)/);
  assert.match(chart, /sc:"chart-load-request"/);
  assert.match(chart, /sc:"chart-load-release"/);
  assert.match(chart, /if \(host\._activeLoad && host\._activeLoad\.req === req && host\._activeLoad\.generation === generation\)/,
    "one chart cannot stack retries for one ticker/range/generation");
  assert.match(chart, /const initialChartHost[\s\S]{0,220}initialChartHost\._transitionGeneration = CHART_TRANSITION_GENERATION;[\s\S]{0,120}scChartWire/,
    "new chart frames join their transition generation before requesting data");
});

test("chart load coordinator grants two at once, releases FIFO work, and drops stale queued generations", () => {
  const select = functionFromDeck("selectChartDataLoadAdmissions", { CHART_DATA_LOAD_LIMIT:2 });
  const jobs = Array.from({ length:6 }, (_, index) => ({ token:"current-" + (index + 1), generation:7 }));
  const first = select({ generation:7, active:[], queue:jobs });
  assert.deepEqual(Array.from(first.grants, (job) => job.token), ["current-1", "current-2"]);
  assert.equal(first.active.length, 2, "never more than two requests are active");
  assert.deepEqual(Array.from(first.queue, (job) => job.token), ["current-3", "current-4", "current-5", "current-6"]);

  const afterRelease = select({ generation:7, active:first.active.slice(1), queue:first.queue });
  assert.deepEqual(Array.from(afterRelease.grants, (job) => job.token), ["current-3"],
    "the next queued token is admitted after a release");
  assert.equal(afterRelease.active.length, 2);

  const stale = select({ generation:8, active:[], queue:[{ token:"old", generation:7 }, { token:"new", generation:8 }] });
  assert.deepEqual(Array.from(stale.grants, (job) => job.token), ["new"]);
  assert.deepEqual(Array.from(stale.queue), [], "stale generation work is never granted or retained");
});

test("top cards suppress their own dates while each lower card paints its column axis", () => {
  const chartSrc = functionFromDeck("chartSrc", {
    RANGE: "3h",
    VIEW: "desk",
    CHART_COUNT: 6,
    encodeURIComponent,
    SceneModel: { hidesTopChartAxis: scenes.hidesTopChartAxis }
  });
  assert.match(chartSrc("TSM", 0), /t=TSM/);
  assert.match(chartSrc("TSM", 0), /sharedAxis=1/);
  assert.doesNotMatch(chartSrc("TSM", 3), /sharedAxis=1/);
  const localAxisChartSrc = functionFromDeck("chartSrc", {
    RANGE: "3h",
    VIEW: "desk",
    CHART_COUNT: 3,
    encodeURIComponent,
    SceneModel: { hidesTopChartAxis: scenes.hidesTopChartAxis }
  });
  assert.doesNotMatch(localAxisChartSrc("TSM", 0), /sharedAxis=1/);
});

test("fixed price overlay reports daily performance honestly", () => {
  const dayChange = functionFromSource(chart, "chDayChange", { Number, Math });
  assert.deepEqual(JSON.parse(JSON.stringify(dayChange(105, 100))), { text:"5.00%", tone:"up" });
  assert.deepEqual(JSON.parse(JSON.stringify(dayChange(95, 100))), { text:"(5.00%)", tone:"down" });
  assert.deepEqual(JSON.parse(JSON.stringify(dayChange(100, 100))), { text:"0.00%", tone:"flat" });
  assert.deepEqual(JSON.parse(JSON.stringify(dayChange(105, null))), { text:"—", tone:"flat" });
  assert.match(chart, /\.sc-nchart__live\{ position:absolute; top:7px; left:8px/);
  assert.match(chart, /display:flex; flex-direction:row; align-items:baseline; gap:8px/,
    "the readout is one compact horizontal line");
  assert.match(chart, /background:rgba\(5,6,12,\.76\)[\s\S]*?padding:5px 7px/,
    "a restrained translucent backing keeps chart lines out of the readout");
  assert.doesNotMatch(chart, /\.sc-nchart__live\{[^}]*flex-direction:column/,
    "the vertical ticker/price/change stack is removed");
  assert.match(chart, /sc-nchart__live-ticker/);
  assert.match(chart, /parent\.postMessage\(\{ sc:"chart-focus-ticker" \}/);
  assert.match(chart, /\.sc-nchart__live-change/);
  assert.match(chart, /badge\.dataset\.change = day\.tone/);
  assert.doesNotMatch(chart, /sc-nchart__live-meta/,
    "the overlay keeps price plus daily change, not last-time/OHLC clutter");
});

test("chart identity focuses the existing deck ticker editor and fullscreen lives in the chart corner", () => {
  assert.match(deck, /event\.data\?\.sc === "chart-focus-ticker"/);
  assert.match(deck, /focusTickerFor\(pane\.def\.key\)/);
  assert.match(deck, /bFull\.classList\.add\("chart-full"\)/);
  assert.match(deck, /\.chart-full\{ position:absolute; top:6px; right:7px/);
  assert.match(deck, /top:var\(--pane-full-top,6px\)/);
  assert.match(deck, /right:var\(--pane-full-right,7px\)/);
  assert.match(chart, /const timeFont = \(VIEW_PROFILE === "desk" \? 7\.5/);
  assert.match(deck, /\.chart-pane > \.ph\{ position:absolute/);
  assert.doesNotMatch(deck, /sharedTimeAxis/);
  assert.match(deck, /else n\.value = CHARTS\[index\] \|\| ""/);
});

test("paired column axes stay legible while using compact plot bands", () => {
  assert.match(chart, /const axisBand = ipadProfile \? \(h < 130 \? 15 : 18\) \* scale/);
  assert.match(chart, /padR = ipadProfile \? \(h < 130 \? 34 : 39\) \* scale/,
    "the compact right band reserves room for the actual live-price marker");
  assert.match(chart, /ctx\.lineWidth = \.5; ctx\.globalAlpha = \.09/,
    "horizontal separators remain visible but intentionally subtle");
  assert.match(chart, /ctx\.font = \(\(ipadProfile \? 6\.5 : 7\) \* scale\) \+ 'px "SF Mono"/,
    "right price labels use a compact distinct band");
  assert.match(chart, /ctx\.fillText\(parts\[0\], X\(ix\), h - padB \+ 8\)/,
    "the lower card retains its actual shared date/time labels");
});

test("hover uses a true two-axis crosshair, not the old fixed close reference", () => {
  const hoverTime = functionFromSource(chart, "chHoverTime", {
    EV_MON: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  });
  assert.equal(hoverTime("2026-08-13T14:30:00.000Z", "3h"), "Aug 13, 2026 · 14:30");
  assert.equal(hoverTime("2026-08-13T00:00:00.000Z", "1D"), "Aug 13, 2026");
  assert.match(chart, /function scChartDraw\(host, scrub\)/);
  assert.match(chart, /ctx\.moveTo\(sx, padT\); ctx\.lineTo\(sx, padT \+ ih\)/,
    "the vertical guide follows the pointer X coordinate");
  assert.match(chart, /ctx\.moveTo\(padL, sy\); ctx\.lineTo\(padL \+ iw, sy\)/,
    "the horizontal guide follows the pointer Y coordinate");
  assert.match(chart, /show\(e\.clientX, e\.clientY\)/,
    "both pointer coordinates reach the renderer");
  assert.match(chart, /const price = yLo \+ \(1 - \(sy - padT\) \/ ih\) \* \(yHi - yLo\)/,
    "right marker reports the hovered price, not the live or previous-close price");
  assert.doesNotMatch(chart, /sc-nchart__hud|chTimeFull|setLineDash\(\[3, 3\]\)/,
    "the centered raw timestamp and fixed dotted reference line are gone");
});

test("live price is a compact right-edge marker rather than top-readout clutter or a fixed line", () => {
  assert.match(chart, /const hasLiveQuote = quote && isFinite\(\+quote\.price\)/);
  assert.match(chart, /liveY = Y\(livePrice\)/,
    "the marker tracks the actual live price coordinate");
  assert.match(chart, /if \(hasLiveQuote && !scrub\)/,
    "hover's moving price marker takes precedence while the cursor is active");
  assert.match(chart, /liveTop = Math\.max\(padT, Math\.min\(padT \+ ih - 12, liveY - 6\)\)/);
  assert.doesNotMatch(chart, /sc-nchart__live-price/,
    "the top-left readout is no longer a second price label");
});

test("Station range is run-wide, starts at 3h after reload, and scenes cannot overwrite it", () => {
  assert.match(deck, /let RANGE = RANGES\.includes\(QS\.get\("range"\)\) \? QS\.get\("range"\) : "3h"/);
  assert.match(deck, /const range = RANGE;/,
    "saved named-scene range values are ignored");
  assert.doesNotMatch(deck, /save\(prefix \+ "\\.range", RANGE\)/,
    "range is not persisted with a scene workspace");
  assert.doesNotMatch(deck, /RANGE = RANGES\.includes\(state\.range\)/,
    "preset/reset/rotation state cannot replace the active range");
  assert.match(chart, /chartRange: \(function\(\)\{ const r = QS\.get\("range"\); return CHART_RANGES\.includes\(r\) \? r : "3h";/,
    "a fresh child chart also defaults to 3h");
});

test("the deck owns one deduplicated visible quote feed for embedded charts", () => {
  const selectVisibleQuoteRows = functionFromDeck("selectVisibleQuoteRows", {
    CLEAN: (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12),
    Map, Set, Date
  });
  const selected = selectVisibleQuoteRows([
    { ticker:"SPY", price:772.49, prev_close:770.56, updated_ts:"2026-08-13T17:00:00Z" },
    { ticker:"QQQ", price:621.20, prev_close:620.10, updated_ts:"2026-08-13T17:00:00Z" },
    { ticker:"OTHER", price:1, prev_close:1, updated_ts:"2026-08-13T17:00:00Z" }
  ], ["SPY", "SPY", "QQQ"]);
  assert.deepEqual(JSON.parse(JSON.stringify(Array.from(selected))), [
    ["SPY", { ticker:"SPY", price:772.49, prev_close:770.56, updated_ts:"2026-08-13T17:00:00Z" }],
    ["QQQ", { ticker:"QQQ", price:621.2, prev_close:620.1, updated_ts:"2026-08-13T17:00:00Z" }]
  ]);
  assert.match(deck, /const DECK_QUOTES = new Map\(\)/);
  assert.match(deck, /station-deck-lq/);
  assert.match(deck, /live_quotes\?ticker=in\.\(/,
    "one deck request fetches the deduplicated visible ticker set");
  assert.match(deck, /const DECK_QUOTE_TIMEOUT_MS = 4500/,
    "the wall quote request has the same bounded timeout as a chart request");
  assert.match(deck, /if \(deckQuoteInFlight\) \{ deckQuoteRerun = true; return; \}/,
    "a heartbeat cannot overlap a stalled active quote request");
  assert.match(chart, /const DECK_QUOTE_MODE = BARE && window\.parent !== window/);
  assert.match(chart, /if \(sb && !DECK_QUOTE_MODE\)/,
    "embedded charts do not open sibling realtime subscriptions");
  assert.match(chart, /if \(!DECK_QUOTE_MODE\) setInterval\(\(\) => pullPrevClose\(S\.chartT\), 10000\)/,
    "embedded charts do not run independent ten-second quote polls");
  assert.match(chart, /d\.sc === "deck-quote"/,
    "a cached parent quote reaches the matching child before it would poll");
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

test("media expansion is an explicit two-stage ladder that preserves X until asked", () => {
  assert.match(deck, /body\.media-stage-one #rowBot > \.pane\.media-hidden/);
  assert.match(deck, /body\.media-stage-one #rowBot > \.pane\.media-stage-target\{ flex:2 1 0/);
  assert.match(deck, /function toggleMediaStage\(key\)/);
  assert.match(deck, /function coverMediaX\(key\)/);
  assert.match(deck, /SCINTILLA_DECK_MEDIA_COVER_X/);
  assert.match(deck, /o\.def\.row === 1 && o\.def\.kind === "video" && !target/,
    "stage one hides only the other YouTube pane, never X");
  assert.match(deck, /MEDIA_STAGE === 2[\s\S]*?o\.def\.key !== MEDIA_TARGET/,
    "covering X is a separate explicit second stage");
});

test("video auto-next silently advances the next visible item and skips an unavailable embed", () => {
  const queue = functionFromSource(videoPane, "queueRows");
  const next = functionFromSource(videoPane, "nextQueuedVideo");
  const rows = [{ video_id:"a" }, { video_id:"b" }, { video_id:"c" }];
  assert.deepEqual(JSON.parse(JSON.stringify(queue(rows, "default", new Set()))), rows);
  assert.deepEqual(JSON.parse(JSON.stringify(queue(rows, "watch", new Set(["b"])))), [{ video_id:"b" }]);
  assert.equal(next(rows, "a", new Set()).video_id, "b");
  assert.equal(next(rows, "a", new Set(["b"])).video_id, "c");
  assert.equal(next(rows, "c", new Set()), null);
  assert.match(videoPane, /args:\s*\["onStateChange"\]/);
  assert.match(videoPane, /Number\(data\.info\) === 0/);
  assert.match(videoPane, /advanceQueue\(\);/,
    "a YouTube ENDED event advances without a user toggle");
  assert.match(videoPane, /skipping unavailable video/);
  assert.match(videoPane, /id="bCover"/);
  assert.doesNotMatch(videoPane, /bAuto|autoNext|AUTO_NEXT/,
    "auto-next is always on and adds no visible control or URL state");
});

test("video resume remains local, bounded, and clears completion before auto-next", () => {
  const store = new Map();
  const storage = { getItem:(key) => store.get(key) || null, setItem:(key, value) => store.set(key, value) };
  const resume = functionFromSource(videoPane, "resumePositionFor", { JSON, Number, Math, VIDEO_POSITION_KEY:"scintilla.station.video.positions.v1", videoPositionMap:function(storage) { try { const value = JSON.parse(storage.getItem("scintilla.station.video.positions.v1") || "{}"); return value && typeof value === "object" ? value : {}; } catch (_) { return {}; } }, VIDEO_POSITION_NEAR_END_SECONDS:12 });
  store.set("scintilla.station.video.positions.v1", JSON.stringify({ a:{ time:123.9, duration:400 }, b:{ time:395, duration:400 }, c:{ time:4, duration:400 } }));
  assert.equal(resume("a", storage), 123);
  assert.equal(resume("b", storage), 0, "a near-complete video restarts rather than resuming at its ending");
  assert.equal(resume("c", storage), 0, "very short progress is not treated as a continuation");
  assert.match(videoPane, /const VIDEO_POSITION_KEY = "scintilla\.station\.video\.positions\.v1"/);
  assert.match(videoPane, /infoDelivery[\s\S]*?saveActiveVideoPosition\(false\)/,
    "player progress is persisted only from real YouTube playback deliveries");
  assert.match(videoPane, /resumeAt \? "&start=" \+ encodeURIComponent\(resumeAt\)/,
    "reopening uses the saved local start point");
  assert.match(videoPane, /clearVideoPosition\(CUR\?\.video_id\);[\s\S]*?advanceQueue\(\);/,
    "completion clears continuation before the existing auto-next path");
  assert.match(videoPane, /visibilitychange[\s\S]*?saveActiveVideoPosition\(true\)/);
  assert.match(videoPane, /pagehide[\s\S]*?saveActiveVideoPosition\(true\)/);
  assert.match(videoPane, /func:"getCurrentTime"[\s\S]*?func:"getDuration"/,
    "the player is periodically asked for real playback progress");
  assert.match(videoPane, /startPlayerPositionPoll\(PLAYER_TOKEN, frame\)/,
    "the bounded progress probe starts only after the embedded player is ready");
  assert.match(videoPane, /clearPlayerPositionPoll\(\);[\s\S]*?CUR = null/,
    "leaving a video removes its one local progress probe");
});

test("Shorts are global discovery and a card can subscribe the active YouTube identity", () => {
  const subscribed = functionFromSource(videoPane, "channelSubscribed", { FEED:"personal", LOCAL_SUBSCRIBED_CHANNELS:new Set() });
  assert.equal(subscribed({ channel_id:"channel-a", subscription_accounts:[] }), false);
  assert.equal(subscribed({ channel_id:"channel-a", subscription_accounts:["personal"] }), true);
  assert.match(videoPane, /const ALL_SHORTS = \{ id: "shorts", n: "shorts", q: "&is_short=eq\.true" \}/,
    "Shorts never inherit a subscription or ticker filter");
  assert.match(videoPane, /SUBSCRIBED,\s*ALL_SHORTS,\s*\{ id: "watch"/,
    "the SCINTILLA pane retains Subscribed, global Shorts, and Watch Later");
  assert.match(videoPane, /\[SUBSCRIBED, ALL_SHORTS\]/,
    "the Personal pane also exposes global Shorts");
  assert.match(videoPane, /select=video_id,title,channel,channel_id,tickers/,
    "the pane reads the channel id necessary for a real subscribe action");
  assert.match(videoPane, /ytAct\("sub", \{ channelId, channelTitle: v\.channel \|\| "", account: FEED \}\)/,
    "Subscribe invokes the existing authenticated YouTube action for the active identity");
  assert.match(videoPane, /class="sub/);
});
