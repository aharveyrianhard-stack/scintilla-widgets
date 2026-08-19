/* STATION-002 — /cohorts, /cohort, /compare and /geigerwall failed as one route family.
   ===================================================================================
   One dead column took all four down at once. `ticker_cohorts` is no longer the base
   table it was; it is a view:

     SELECT DISTINCT m.ticker, m.group_key AS cohort
       FROM ticker_membership m
       JOIN tickers t ON t.ticker = m.ticker AND t.active;

   The old base table survives as `ticker_cohorts_legacy` and still carries `is_primary`;
   the view does not. PostgREST answers `is_primary=eq.true` against it with a 400, and a
   400 is the branch each page's pg() rethrows immediately rather than retrying — so all
   four routes went straight to their "unavailable" state on first paint.

   Membership in the view IS the cohort axis now. The filter is not replaced by another
   filter, because there is no longer a distinction to express.

   Two more surfaces carried the same dead filter behind a .catch() and were degrading
   silently to an empty cohort axis instead of failing loudly: /events and /heat. They are
   covered here too, since the cause is identical.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

/* Every surface that asks the cohort axis anything. */
const COHORT_READERS = {
  "/cohorts":    read("../cohorts/index.html"),
  "/cohort":     read("../cohort/index.html"),
  "/compare":    read("../compare/index.html"),
  "/geigerwall": read("../geigerwall/index.html"),
  "/heat":       read("../heat/index.html"),
  "/events":     read("../events/index.html"),
  "/analytics":  read("../analytics/index.html"),
  "templates/fundamentals.html": read("../templates/fundamentals.html"),
};

test("no Station surface asks ticker_cohorts for a column the view does not have", () => {
  for (const [route, source] of Object.entries(COHORT_READERS)) {
    assert.doesNotMatch(source, /is_primary/,
      `${route} still references is_primary; the ticker_cohorts view has only (ticker, cohort)`);
  }
});

test("the four routes reported as one family each still read the cohort axis", () => {
  /* The repair must not be "stop asking" — each of these pages is the cohort axis. */
  for (const route of ["/cohorts", "/cohort", "/compare", "/geigerwall"]) {
    const source = COHORT_READERS[route];
    assert.match(source, /ticker_cohorts\?select=ticker,cohort/,
      `${route} reads membership from the view`);
  }
});

test("every ticker_cohorts query selects only columns the view exposes", () => {
  const VIEW_COLUMNS = new Set(["ticker", "cohort"]);
  let queries = 0;
  for (const [route, source] of Object.entries(COHORT_READERS)) {
    for (const [, query] of source.matchAll(/ticker_cohorts\?([^"']+)/g)) {
      queries += 1;
      const params = new URLSearchParams(query.replace(/"\s*\+.*$/, ""));
      for (const column of (params.get("select") || "").split(",").filter(Boolean))
        assert.ok(VIEW_COLUMNS.has(column.trim()),
          `${route} selects ${column} from ticker_cohorts, which the view does not expose`);
      /* Any filter is a filter on a column, so the same rule applies to every other key. */
      for (const key of params.keys()) {
        if (["select", "limit", "offset", "order"].includes(key)) continue;
        assert.ok(VIEW_COLUMNS.has(key),
          `${route} filters ticker_cohorts on ${key}, which the view does not expose`);
      }
    }
  }
  assert.ok(queries >= 8, `expected every cohort reader to be covered, saw ${queries} queries`);
});

test("heat picks one cohort per ticker without consulting a column that no longer exists", () => {
  /* The old guard read `r.is_primary !== false`, which was already always true once the
     column stopped being selected. First-membership-wins is what it actually did, and is
     what it now says. */
  assert.match(COHORT_READERS["/heat"],
    /for \(const r of d\.coh\) if \(!\(r\.ticker in primary\)\) primary\[r\.ticker\] = r\.cohort;/);
});

test("the pages still describe the axis they actually read", () => {
  /* A page that names a filter it no longer applies is the same defect in prose. */
  for (const [route, source] of Object.entries(COHORT_READERS))
    assert.doesNotMatch(source, /is_primary=true|primary cohorts from ticker_cohorts/i,
      `${route} still claims a primary-membership filter`);
});
