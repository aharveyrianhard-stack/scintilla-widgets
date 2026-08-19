/* The cohort scene shows the cohort — filed defects 1 and 2, model layer.
   ======================================================================
   Filed: "AI Software cohort must replace Favorites rows; Megacap must replace Favorites
   rows." Two mechanisms made both impossible:

   - normalizeScene collapsed "cohort" into themeFamilies, so a chosen cohort was silently
     discarded and the user landed on the first theme basket. The scene id resolves to
     itself now, and the legacy aliases that still mean something keep meaning it.
   - the navigation index intersected every cohort with hub_favorites, so choosing
     AI_SOFTWARE showed, at most, the favorites already on the wall — never the cohort.
     The index now carries every cohort's FULL membership, with FAV as the explicit
     default entry that a chosen cohort replaces.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = { globalThis: {} };
vm.runInNewContext(fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8"), context);
const scenes = context.globalThis.StationScenes;

const memberships = [
  { ticker:"ADBE", cohort:"AI_SOFTWARE" }, { ticker:"CRM", cohort:"AI_SOFTWARE" },
  { ticker:"MSFT", cohort:"AI_SOFTWARE" }, { ticker:"NOW", cohort:"AI_SOFTWARE" },
  { ticker:"ORCL", cohort:"AI_SOFTWARE" }, { ticker:"PLTR", cohort:"AI_SOFTWARE" },
  { ticker:"SNOW", cohort:"AI_SOFTWARE" },
  { ticker:"AAPL", cohort:"MEGACAP" }, { ticker:"AMZN", cohort:"MEGACAP" },
  { ticker:"GOOGL", cohort:"MEGACAP" }, { ticker:"META", cohort:"MEGACAP" },
  { ticker:"MSFT", cohort:"MEGACAP" }, { ticker:"NVDA", cohort:"MEGACAP" },
  { ticker:"TSLA", cohort:"MEGACAP" },
];
const favorites = [{ ticker:"MU" }, { ticker:"NBIS" }, { ticker:"SNDK" }];

test("cohort resolves to itself — a chosen cohort is never silently a theme basket", () => {
  assert.equal(scenes.normalizeScene("cohort"), "cohort");
  assert.ok(scenes.IDS.includes("cohort"));
  /* The aliases that still mean something keep meaning it. */
  assert.equal(scenes.normalizeScene("themes"), "themeFamilies");
  assert.equal(scenes.normalizeScene("sectors"), "sectorFamilies");
  assert.equal(scenes.normalizeScene("indexes"), "indexLeadership");
  /* And cohort stays a manual scene: rotation never lands on it. */
  assert.ok(!scenes.ROTATION_IDS.includes("cohort"));
});

test("a cohort's page is the COHORT'S members — favorites do not filter it", () => {
  const index = scenes.buildCohortIndex([memberships], favorites);

  const ai = scenes.cohortPage(index, "AI_SOFTWARE", 0, 6);
  assert.deepEqual(Array.from(ai.tickers), ["ADBE", "CRM", "MSFT", "NOW", "ORCL", "PLTR"]);
  assert.equal(ai.totalItems, 7);
  assert.equal(ai.totalPages, 2);
  /* Not one favorite appears unless it is a member; none of these are. */
  for (const fav of ["MU", "NBIS", "SNDK"]) assert.ok(!ai.tickers.includes(fav));

  const mega = scenes.cohortPage(index, "MEGACAP", 0, 6);
  assert.deepEqual(Array.from(mega.tickers), ["AAPL", "AMZN", "GOOGL", "MSFT", "META", "NVDA"].sort());
  assert.equal(mega.totalItems, 7);

  /* Page 2 pages honestly through the remainder. */
  const ai2 = scenes.cohortPage(index, "AI_SOFTWARE", 1, 6);
  assert.deepEqual(Array.from(ai2.tickers), ["SNOW"]);
  assert.equal(ai2.chartCount, 1);
});

test("FAV is the explicit default entry, first, in added order — the thing a cohort replaces", () => {
  const index = scenes.buildCohortIndex([memberships], favorites);
  assert.equal(Array.from(index.keys())[0], "FAV");
  assert.deepEqual(Array.from(index.get("FAV")), ["MU", "NBIS", "SNDK"]);
  const fav = scenes.cohortPage(index, "FAV", 0, 6);
  assert.deepEqual(Array.from(fav.tickers), ["MU", "NBIS", "SNDK"]);
  /* No favorites read at all still yields a working index: FAV is empty and says so
     through cohortPage's own emptiness, not by borrowing another cohort's rows. */
  const bare = scenes.buildCohortIndex([memberships], null);
  assert.deepEqual(Array.from(bare.get("FAV")), []);
  assert.equal(scenes.cohortPage(bare, "FAV", 0, 6).totalItems, 0);
});

test("the favorites-intersection builder is gone, not renamed around", () => {
  assert.equal(scenes.buildCohortFavorites, undefined);
  const source = fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8");
  assert.ok(!source.includes("favorites.has(ticker)"),
    "no membership row is admitted or dropped by favorite status");
});
