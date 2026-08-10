import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const scenes = context.globalThis.StationScenes;

test("scene ids and immutable named presets are exact", () => {
  assert.deepEqual(Array.from(scenes.IDS), ["live", "overnight", "indexes", "cohort", "custom"]);
  assert.equal(scenes.normalizeScene("not-real"), "live");
  assert.deepEqual(Array.from(scenes.PRESETS.overnight.tickers), ["ESUSD", "NQUSD", "CLUSD"]);
  assert.deepEqual(Array.from(scenes.PRESETS.indexes.tickers), ["SPY", "QQQ", "IWM", "MAGS", "SMH", "DIA"]);
  assert.equal(scenes.PRESETS.indexes.chartCount, 6);
});

test("five favorites use the honest six-slot geometry without loss", () => {
  assert.equal(scenes.chartCountForSize(0), 1);
  assert.equal(scenes.chartCountForSize(4), 4);
  assert.equal(scenes.chartCountForSize(5), 6);
  assert.equal(scenes.chartCountForSize(6), 6);
});

test("cohort favorites intersect memberships, dedupe, and retain sparse cohorts", () => {
  const favorites = [{ ticker:"AAA" }, { ticker:"BBB" }, { ticker:"CCC" }];
  const primary = [
    { ticker:"AAA", cohort:"ONE" }, { ticker:"BBB", cohort:"ONE" },
    { ticker:"ZZZ", cohort:"EMPTY" }
  ];
  const legacy = [
    { ticker:"AAA", cohort:"ONE" }, { ticker:"CCC", cohort:"TWO" }
  ];
  const index = scenes.buildCohortFavorites(favorites, [primary, legacy]);
  assert.deepEqual(Array.from(index.get("ONE")), ["AAA", "BBB"]);
  assert.deepEqual(Array.from(index.get("TWO")), ["CCC"]);
  assert.deepEqual(Array.from(index.get("EMPTY")), []);
});

test("cohort pagination is lossless and clamps invalid pages", () => {
  const tickers = Array.from({ length:21 }, (_, i) => "T" + String(i + 1).padStart(2, "0"));
  const index = new Map([["AI_HARDWARE", tickers]]);
  const pages = [0,1,2,3].map((page) => scenes.cohortPage(index, "AI_HARDWARE", page, 6));
  assert.deepEqual(pages.map((page) => page.tickers.length), [6,6,6,3]);
  assert.deepEqual(pages.flatMap((page) => Array.from(page.tickers)), tickers);
  assert.equal(scenes.cohortPage(index, "AI_HARDWARE", 99, 6).page, 3);
  const sparse = scenes.cohortPage(new Map([["EMPTY", []]]), "EMPTY", 0, 6);
  assert.equal(sparse.totalItems, 0);
  assert.deepEqual(Array.from(sparse.tickers), []);
  assert.equal(sparse.chartCount, 1);
});

test("deck keeps one X pane, consumes explicit deep links, and never serializes runtime state", () => {
  const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
  assert.match(deck, /id="sceneMode"/);
  assert.match(deck, /const QS = new URLSearchParams\(location\.search\)/);
  assert.match(deck, /function consumeStationLaunchUrl\(\)/);
  assert.equal((deck.match(/history\.replaceState/g) || []).length, 1);
  assert.doesNotMatch(deck, /p\.set\("scene"/);
  assert.doesNotMatch(deck, /writeStationUrl/);
  assert.match(deck, /rel="manifest" href="\/station\/manifest\.json"/);
  assert.equal((deck.match(/key: "x"/g) || []).length, 1);
  assert.match(deck, /if \(!active && o\.frame\) \{\s*o\.frame\.remove\(\)/);
});

test("Vercel serves the canonical Station root through an internal rewrite", () => {
  const config = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(Array.isArray(config.redirects), false);
  const root = config.rewrites.find((rule) => rule.source === "/");
  assert.equal(root.destination, "/deck/");
  assert.deepEqual(root.has, [{ type:"host", value:"station.scintillahub.ai" }]);
});

test("manifest installs the live canonical route without an offline claim", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../station/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.some((icon) => icon.sizes === "any" && icon.type === "image/svg+xml"), true);
});
