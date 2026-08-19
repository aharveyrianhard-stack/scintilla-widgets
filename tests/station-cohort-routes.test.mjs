/* STATION-002 — the cohort axis: what it is, and reading all of it.
   ===============================================================
   The first repair removed a filter on a column that no longer exists. That stopped the 400
   that took /cohorts, /cohort, /compare and /geigerwall down together, and it was not
   enough: it fixed the request and left the data contract wrong in two ways that a
   query-spelling test cannot see.

   FAULT 1 — THE READ WAS CAPPED AND LOOKED FINE.
   PostgREST returns at most 1000 rows per response. `ticker_cohorts` holds 1283. Every
   unpaginated reader silently dropped 283 memberships behind a 200 OK. A short read and a
   small table are indistinguishable unless you ask for the next page.

   FAULT 2 — `ticker_cohorts` IS NOT THE COHORT AXIS.
   The view flattens five kinds of membership into one column — cohort (23 groups), sector
   (14), industry (93), size (4), sector_ext (10) — so it reports 120 "cohorts" of which 97
   are not cohorts. That is also why a ticker appeared to hold up to 5 memberships: one
   cohort, one sector, one industry, one size bucket. "First row wins" over an unordered
   DISTINCT view was therefore not a tie-break but a coin toss between four questions.

   THE RULE: the cohort axis is ticker_membership.kind='cohort', restricted to active
   tickers — the same restriction the view itself applies. Measured 2026-08-19: 404
   memberships, 387 active tickers, 23 cohorts, 16 tickers in more than one cohort, at most 3.

   These tests drive the real module against a fake pg() whose page behaviour matches
   PostgREST's, so the cap is exercised rather than assumed.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const axisSource = read("../_cohorts/cohort-axis.js");

function loadAxis() {
  const sandbox = { globalThis:{}, Promise, Set, Map, Array, Object, String, Number, Math,
                    encodeURIComponent, console };
  vm.runInNewContext(axisSource, sandbox);
  return sandbox.globalThis.SC_COHORT_AXIS;
}

/* A pg() that behaves like PostgREST: honours limit/offset and never returns more than the
   server cap, whatever the caller asks for. */
function fakePg(tables, { cap = 1000 } = {}) {
  const calls = [];
  return {
    calls,
    pg: async (path) => {
      calls.push(path);
      const [table, query = ""] = path.split("?");
      const params = new URLSearchParams(query);
      const limit = Math.min(cap, Number(params.get("limit")) || cap);
      const offset = Number(params.get("offset")) || 0;
      let rows = (tables[table] || []).slice();
      for (const [key, value] of params) {
        if (["select", "limit", "offset", "order"].includes(key)) continue;
        const [op, ...rest] = value.split(".");
        const wanted = rest.join(".");
        if (op === "eq") rows = rows.filter((r) => String(r[key]) === wanted);
      }
      return rows.slice(offset, offset + limit);
    },
  };
}

/* A membership table shaped like the live one: five kinds, and more rows than one page. */
function liveShapedMembership() {
  const rows = [];
  const cohorts = Array.from({ length:23 }, (_, i) => "COHORT_" + String(i).padStart(2, "0"));
  for (let i = 0; i < 387; i += 1) {
    const ticker = "T" + String(i).padStart(3, "0");
    rows.push({ ticker, group_key:cohorts[i % cohorts.length], kind:"cohort" });
    rows.push({ ticker, group_key:"SECTOR_" + (i % 14), kind:"sector" });
    rows.push({ ticker, group_key:"INDUSTRY_" + (i % 93), kind:"industry" });
    rows.push({ ticker, group_key:"SIZE_" + (i % 4), kind:"size" });
  }
  /* 16 tickers in a second cohort, matching the live count. */
  for (let i = 0; i < 16; i += 1)
    rows.push({ ticker:"T" + String(i).padStart(3, "0"), group_key:"COHORT_EXTRA", kind:"cohort" });
  return rows;
}
const ACTIVE = Array.from({ length:387 }, (_, i) => ({ ticker:"T" + String(i).padStart(3, "0"), active:true }));

test("the axis reads past the 1000-row page cap instead of stopping at it", async () => {
  const axis = loadAxis();
  /* 1548 cohort-kind rows: three pages. A capped reader would see 1000 and call it a table. */
  const membership = Array.from({ length:1548 }, (_, i) => ({
    ticker:"T" + String(i % 387).padStart(3, "0"), group_key:"C" + (i % 23), kind:"cohort" }));
  const { pg, calls } = fakePg({ ticker_membership:membership, tickers:ACTIVE });

  const result = await axis.loadMemberships(pg);
  assert.equal(result.truncated, false);
  assert.ok(calls.some((c) => c.includes("offset=1000")), "a second page was actually requested");
  /* Every distinct pair survives the walk. */
  const distinct = new Set(membership.map((r) => r.ticker + "|" + r.group_key));
  assert.equal(result.rows.length, distinct.size);
  assert.ok(result.rows.length > 1000, "more than one page of memberships came back");
});

test("a page exactly the size of the cap is not mistaken for the end of the table", async () => {
  const axis = loadAxis();
  /* The nastiest case: a full page followed by one more row. */
  const membership = Array.from({ length:1001 }, (_, i) => ({
    ticker:"T" + String(i).padStart(4, "0"), group_key:"C" + (i % 5), kind:"cohort" }));
  const active = membership.map((r) => ({ ticker:r.ticker, active:true }));
  const { pg } = fakePg({ ticker_membership:membership, tickers:active });
  const result = await axis.loadMemberships(pg);
  assert.equal(result.rows.length, 1001, "the 1001st membership is not lost");
});

test("a bounded walk that hits its page ceiling says so rather than looking complete", async () => {
  const axis = loadAxis();
  const huge = Array.from({ length:axis.MAX_PAGES * axis.PAGE + 5 }, (_, i) => ({
    ticker:"T" + i, group_key:"C" + (i % 3), kind:"cohort" }));
  const { pg } = fakePg({ ticker_membership:huge, tickers:huge.map((r) => ({ ticker:r.ticker, active:true })) });
  const result = await axis.loadMemberships(pg);
  assert.equal(result.truncated, true, "a truncated read must never claim to be whole");
});

test("only cohort-kind membership is the cohort axis", async () => {
  const axis = loadAxis();
  const { pg, calls } = fakePg({ ticker_membership:liveShapedMembership(), tickers:ACTIVE });
  const result = await axis.loadMemberships(pg);

  assert.ok(calls.some((c) => c.includes("kind=eq.cohort")), "the read is kind-filtered");
  const cohorts = new Set(result.rows.map((r) => r.cohort));
  assert.equal(cohorts.size, 24, "23 cohorts plus the extra one — sectors/industries/sizes excluded");
  for (const name of cohorts)
    assert.ok(!/^SECTOR_|^INDUSTRY_|^SIZE_/.test(name), `${name} is not a cohort`);
  assert.equal(result.rows.length, 387 + 16, "404-shaped: one cohort per ticker plus 16 second memberships");
});

test("an inactive ticker cannot re-enter the axis by bypassing the view", async () => {
  const axis = loadAxis();
  const membership = [
    { ticker:"LIVE1", group_key:"AI", kind:"cohort" },
    { ticker:"DELISTED", group_key:"AI", kind:"cohort" },
  ];
  const { pg, calls } = fakePg({ ticker_membership:membership, tickers:[{ ticker:"LIVE1", active:true }, { ticker:"DELISTED", active:false }] });
  const result = await axis.loadMemberships(pg);
  assert.ok(calls.some((c) => c.includes("active=eq.true")), "active tickers are asked for");
  assert.deepEqual(Array.from(result.rows, (r) => r.ticker), ["LIVE1"]);
});

test("multi-membership is preserved, not collapsed", async () => {
  const axis = loadAxis();
  const rows = [
    { ticker:"NVDA", cohort:"AI_COMPUTE" },
    { ticker:"NVDA", cohort:"AI_POWER" },
    { ticker:"NVDA", cohort:"SEMIS" },
    { ticker:"MU", cohort:"SEMIS" },
  ];
  const byTicker = axis.byTicker(rows);
  assert.deepEqual(Array.from(byTicker.get("NVDA")), ["AI_COMPUTE", "AI_POWER", "SEMIS"],
    "every cohort a ticker belongs to survives");
  assert.deepEqual(Array.from(byTicker.get("MU")), ["SEMIS"]);

  const byCohort = axis.byCohort(rows);
  assert.deepEqual(Array.from(byCohort.get("SEMIS")), ["MU", "NVDA"]);
  assert.deepEqual(Array.from(byCohort.get("AI_POWER")), ["NVDA"]);
});

test("a surface with one tile per ticker picks the same cohort every load", async () => {
  const axis = loadAxis();
  const rows = [
    { ticker:"NVDA", cohort:"SEMIS" },
    { ticker:"NVDA", cohort:"AI_COMPUTE" },
    { ticker:"NVDA", cohort:"AI_POWER" },
  ];
  /* The defect: row order decided the answer. The same three memberships in any order must
     now produce the same placement. */
  const shuffles = [
    rows,
    [rows[2], rows[0], rows[1]],
    [rows[1], rows[2], rows[0]],
    rows.slice().reverse(),
  ];
  const picks = shuffles.map((r) => axis.primaryByTicker(r).get("NVDA"));
  assert.deepEqual(picks, ["AI_COMPUTE", "AI_COMPUTE", "AI_COMPUTE", "AI_COMPUTE"],
    "the named tie-break, not arrival order, decides");
  assert.equal(axis.primaryOf([]), null);
  assert.equal(axis.primaryOf(null), null);
  assert.equal(axis.primaryOf(["ONLY"]), "ONLY");
});

test("every cohort surface reads the axis rather than the mixed, capped view", () => {
  const SURFACES = {
    "/cohorts":    read("../cohorts/index.html"),
    "/cohort":     read("../cohort/index.html"),
    "/compare":    read("../compare/index.html"),
    "/geigerwall": read("../geigerwall/index.html"),
    "/heat":       read("../heat/index.html"),
    "/events":     read("../events/index.html"),
    "/analytics":  read("../analytics/index.html"),
  };
  for (const [route, source] of Object.entries(SURFACES)) {
    assert.match(source, /<script src="\/_cohorts\/cohort-axis\.js"><\/script>/,
      `${route} loads the shared axis`);
    assert.match(source, /SC_COHORT_AXIS\.(loadMemberships|primaryByTicker|byCohort)/,
      `${route} uses the shared axis`);
    /* No surface may go back to querying the mixed view directly. */
    assert.doesNotMatch(source, /pg(All)?\(["']ticker_cohorts\?/,
      `${route} still queries ticker_cohorts directly`);
    assert.doesNotMatch(source, /['"]ticker_cohorts\?select/,
      `${route} still queries ticker_cohorts directly`);
    assert.doesNotMatch(source, /is_primary/, `${route} still references the retired column`);
  }
});

test("no reader asks for the axis with a bare limit and calls that the whole table", () => {
  for (const path of ["../cohorts/index.html", "../cohort/index.html", "../compare/index.html",
                      "../geigerwall/index.html", "../heat/index.html", "../events/index.html",
                      "../analytics/index.html"]) {
    const source = read(path);
    assert.doesNotMatch(source, /ticker_membership\?[^"']*limit=1000(?![0-9])[^"']*['"]/,
      `${path} pins a single page instead of paging`);
  }
  /* The module is the only place that pages, and it bounds itself. */
  assert.match(axisSource, /const PAGE = 1000;/);
  assert.match(axisSource, /const MAX_PAGES = 40;/);
  assert.match(axisSource, /if \(batch\.length < size\) return \{ rows: out, pages, truncated: false \};/);
});
