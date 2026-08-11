import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const scenes = context.globalThis.StationScenes;

const mkTime = (nyHour) => new Date(Date.UTC(2026, 7, 11, nyHour + 4, 0, 0)); // NYC summer offset is currently -4

test("curated scene ids and immutable named presets are exact", () => {
  assert.deepEqual(Array.from(scenes.IDS), [
    "live", "indexNow", "indexLeadership", "companyLeadership", "focus2",
    "macroCrossAsset", "internalsFast", "internalsSlow", "sectorFamilies",
    "themeFamilies", "custom"
  ]);
  assert.equal(scenes.normalizeScene("cohort"), "themeFamilies");
  assert.equal(scenes.normalizeScene("not-real"), "live");
  assert.deepEqual(Array.from(scenes.PRESETS.indexNow.tickers), ["ESUSD", "NQUSD", "FLEX3"]);
  assert.deepEqual(Array.from(scenes.PRESETS.indexLeadership.tickers), ["SPY", "QQQ", "IWM", "MAGS", "SMH", "DIA"]);
  assert.equal(scenes.PRESETS.indexLeadership.chartCount, 6);
  assert.equal(scenes.PRESETS.indexLeadership.tickers.includes("DOW"), false);
  assert.equal(scenes.SCENES.macroCrossAsset.horizon, "fast-short");
  assert.equal(scenes.SCENES.internalsSlow.horizon, "slow-long");
  assert.equal(scenes.SCENES.indexNow.session, "regular");
  assert.deepEqual(Array.from(scenes.indexNowTickersFor(mkTime(12), "  flex 3 ")), ["SPY", "QQQ", "FLEX3"]);
});

test("INDEX NOW leaders follow America/New_York session boundaries", () => {
  assert.deepEqual(Array.from(scenes.indexNowLeaders(mkTime(12))), ["SPY", "QQQ"]);
  assert.deepEqual(Array.from(scenes.indexNowLeaders(mkTime(17))), ["SPY", "QQQ"]);
  assert.deepEqual(Array.from(scenes.indexNowLeaders(mkTime(18))), ["ESUSD", "NQUSD"]);
  assert.deepEqual(Array.from(scenes.indexNowLeaders(mkTime(7))), ["ESUSD", "NQUSD"]);
});

test("INDEX NOW ticker list is dynamic and sanitizes slot-3 flex edits", () => {
  const pre = scenes.indexNowTickersFor(new Date(Date.UTC(2026, 7, 11, 12 + 4, 0, 0)), "flex3");
  assert.deepEqual(Array.from(pre), ["SPY", "QQQ", "FLEX3"]);

  const preCl = scenes.indexNowTickersFor(new Date(Date.UTC(2026, 7, 11, 20 + 4, 0, 0)), "cl usd");
  assert.deepEqual(Array.from(preCl), ["ESUSD", "NQUSD", "CLUSD"]);
});

test("legacy scene keys normalize through governing mapping", () => {
  assert.equal(scenes.normalizeScene("overnight"), "indexNow");
  assert.equal(scenes.normalizeScene("indexes"), "indexLeadership");
  assert.equal(scenes.normalizeScene("company"), "companyLeadership");
  assert.equal(scenes.normalizeScene("macro_short"), "macroCrossAsset");
  assert.equal(scenes.normalizeScene("macro_long"), "macroCrossAsset");
  assert.equal(scenes.normalizeScene("sectors"), "sectorFamilies");
  assert.equal(scenes.normalizeScene("themes"), "themeFamilies");
});

test("chart geometry remains bounded to 1, 2, 3, 4, or 6", () => {
  assert.equal(scenes.chartCountForSize(0), 1);
  assert.equal(scenes.chartCountForSize(2), 2);
  assert.equal(scenes.chartCountForSize(4), 4);
  assert.equal(scenes.chartCountForSize(5), 6);
  assert.equal(scenes.chartCountForSize(6), 6);
  assert.equal(scenes.chartCountForSize(8), 6);
});

test("favorite-backed families intersect memberships, dedupe, and retain source honesty", () => {
  const favorites = [{ ticker:"AAA" }, { ticker:"BBB" }, { ticker:"CCC" }];
  const primary = [
    { ticker:"AAA", cohort:"AI_HARDWARE" }, { ticker:"BBB", cohort:"AI_HARDWARE" },
    { ticker:"ZZZ", cohort:"TECH" }
  ];
  const legacy = [
    { ticker:"AAA", cohort:"AI_HARDWARE" }, { ticker:"CCC", cohort:"TECH" }
  ];
  const index = scenes.buildCohortFavorites(favorites, [primary, legacy]);
  assert.deepEqual(Array.from(index.get("AI_HARDWARE")), ["AAA", "BBB"]);
  assert.deepEqual(Array.from(index.get("TECH")), ["CCC"]);
});

test("normal navigation exposes only reviewed non-empty sector/theme families", () => {
  const index = new Map([
    ["AI_HARDWARE", ["AAA"]],
    ["TECH", ["BBB"]],
    ["TRAVEL_AND_LODGING", ["CCC"]],
    ["AI_SOFTWARE", []]
  ]);
  assert.deepEqual(Array.from(scenes.curatedFamilies(index, "themeFamilies")), ["AI_HARDWARE"]);
  assert.deepEqual(Array.from(scenes.curatedFamilies(index, "sectorFamilies")), ["TECH"]);
  assert.equal(scenes.curatedFamilies(index, "themeFamilies").includes("TRAVEL_AND_LODGING"), false);
});

test("expanding a 20-member basket from two to six fills real members without blanks", () => {
  const members = Array.from({ length:20 }, (_, i) => "T" + String(i + 1).padStart(2, "0"));
  const two = scenes.basketWindow(members, 0, 2);
  const six = scenes.basketWindow(members, two.offset, 6);
  assert.deepEqual(Array.from(two.tickers), ["T01", "T02"]);
  assert.deepEqual(Array.from(six.tickers), ["T01", "T02", "T03", "T04", "T05", "T06"]);
  assert.equal(six.tickers.includes(""), false);
  assert.equal(six.chartCount, 6);
  assert.equal(six.start, 1);
  assert.equal(six.end, 6);
});

test("mid-basket resize preserves the first visible member and pagination is lossless", () => {
  const members = Array.from({ length:20 }, (_, i) => "T" + String(i + 1).padStart(2, "0"));
  const six = scenes.basketWindow(members, 6, 6);
  const three = scenes.basketWindow(members, six.offset, 3);
  const sixAgain = scenes.basketWindow(members, three.offset, 6);
  assert.equal(six.tickers[0], "T07");
  assert.equal(three.tickers[0], "T07");
  assert.deepEqual(Array.from(sixAgain.tickers), ["T07", "T08", "T09", "T10", "T11", "T12"]);

  const windows = [0,6,12,18].map((offset) => scenes.basketWindow(members, offset, 6));
  assert.deepEqual(windows.flatMap((window) => Array.from(window.tickers)), members);
});

test("sparse and empty baskets use honest effective layouts", () => {
  const sparse = scenes.basketWindow(["AAA", "BBB"], 0, 6);
  assert.equal(sparse.requestedCount, 6);
  assert.equal(sparse.chartCount, 2);
  assert.equal(sparse.totalItems, 2);
  assert.deepEqual(Array.from(sparse.tickers), ["AAA", "BBB"]);

  const empty = scenes.basketWindow([], 0, 6);
  assert.equal(empty.empty, true);
  assert.equal(empty.totalItems, 0);
  assert.equal(empty.chartCount, 1);
  assert.equal(empty.end, 0);
  assert.deepEqual(Array.from(empty.tickers), []);
});

test("deck keeps curated navigation, presentation state, and one X pane", () => {
  const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
  const sceneOptions = Array.from(deck.matchAll(/<option value="(live|indexNow|indexLeadership|companyLeadership|focus2|macroCrossAsset|internalsFast|internalsSlow|sectorFamilies|themeFamilies|custom)">/g), (match) => match[1]);
  assert.deepEqual(sceneOptions, [
    "live", "indexNow", "indexLeadership", "companyLeadership", "focus2",
    "macroCrossAsset", "internalsFast", "internalsSlow", "sectorFamilies",
    "themeFamilies", "custom"
  ]);
  assert.doesNotMatch(deck, /<option value="cohort">/);
  assert.doesNotMatch(deck, /const COHORT_ORDER/);
  assert.match(deck, /function rememberPresentationState\(\)/);
  assert.match(deck, /function familyState\(requestedCount\)/);
  assert.match(deck, /PRESENTATION_COUNT = chartCount\(next\)/);
  assert.match(deck, /state\.tickers\.slice\(0, 6\)/);
  assert.doesNotMatch(deck, /moveNamedSceneToCustom\(\);\n\s*const original = aliasKey\(raw\);/);
  assert.match(deck, /moveNamedSceneToCustom\(\);/);
  assert.match(deck, /const original = aliasKey\(raw\);/);
  assert.doesNotMatch(deck.match(/function setRange[\s\S]*?\n}/)?.[0] || "", /moveNamedSceneToCustom/);
  assert.doesNotMatch(deck.match(/function applyChartCount[\s\S]*?\nel\("chartCount"\)/)?.[0] || "", /moveNamedSceneToCustom/);
  assert.match(deck, /const QS = new URLSearchParams\(location\.search\)/);
  assert.match(deck, /function consumeStationLaunchUrl\(\)/);
  assert.equal((deck.match(/history\.replaceState/g) || []).length, 1);
  assert.doesNotMatch(deck, /p\.set\("scene"/);
  assert.doesNotMatch(deck, /writeStationUrl/);
  assert.match(deck, /rel="manifest" href="\/station\/manifest\.json"/);
  assert.equal((deck.match(/key: "x"/g) || []).length, 1);
  assert.match(deck, /if \(!active && o\.frame\) \{\s*o\.frame\.remove\(\);/);
});

test("Vercel routing remains byte-for-byte outside Scenes V2 scope", () => {
  const config = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(Array.isArray(config.redirects), false);
  const root = config.rewrites.find((rule) => rule.source === "/");
  assert.equal(root.destination, "/deck/");
  assert.deepEqual(root.has, [{
    type:"header",
    key:"host",
    value:"^station\\.scintillahub\\.ai(?::\\d+)?$"
  }]);
});

test("manifest installs the live canonical route without an offline claim", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../station/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.some((icon) => icon.sizes === "any" && icon.type === "image/svg+xml"), true);
});
