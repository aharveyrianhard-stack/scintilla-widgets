/* STATION-002 — two questions, two answers.
   ========================================
   The first repair removed a filter on a column that no longer exists, which stopped the 400
   that took /cohorts, /cohort, /compare and /geigerwall down together. The second attempt then
   over-corrected: it substituted a different relation for ticker_cohorts and invented a
   "primary" cohort by taking the lexicographically lowest name. Both are wrong, and this suite
   pins the split that is right.

     "WHICH COHORTS IS THIS TICKER IN?"  -> ticker_cohorts. 1283 memberships, PostgREST caps a
                                            response at 1000, so an unpaginated read silently
                                            drops 283 of them behind a 200 OK. NVDA is in five:
                                            AI_HARDWARE, MEGA_CAP, MEGACAP, SEMICONDUCTORS,
                                            TECH.
     "WHERE DOES THIS TICKER LIVE?"      -> tickers.cohort. One curated value per ticker,
                                            populated for all 387 active tickers over 16 home
                                            cohorts. NVDA's is AI_HARDWARE.

   Navigation surfaces need the first, complete. A surface drawing one tile per ticker needs the
   second, read. Neither is derivable from the other: an ordering rule over a membership set is
   a guess wearing a rule's clothes, and it would have placed NVDA in AI_HARDWARE only because
   the alphabet happened to agree.

   Live counts asserted below were taken from the database on 2026-08-19.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const axisSource = read("../_cohorts/cohort-axis.js");

function loadAxis() {
  const sandbox = { globalThis:{}, Promise, Set, Map, Array, Object, String, Number, Math, console };
  vm.runInNewContext(axisSource, sandbox);
  return sandbox.globalThis.SC_COHORT_AXIS;
}

/* A pg() that behaves like PostgREST: honours limit/offset, never returns more than the server
   cap whatever the caller asks for, and simply omits rows a filter excludes. */
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
        if (op === "eq") rows = rows.filter((r) => String(r[key]) === rest.join("."));
      }
      return rows.slice(offset, offset + limit);
    },
  };
}

/* THE LIVE CONTRACT, as measured on 2026-08-19. */
const LIVE = { activeTickers:387, memberships:1283, homeCohorts:16,
               nvdaHome:"AI_HARDWARE",
               nvdaMemberships:["AI_HARDWARE", "MEGACAP", "MEGA_CAP", "SEMICONDUCTORS", "TECH"] };

/* A fixture with the live shape: 1283 memberships over 387 tickers, NVDA in exactly its five. */
function liveShapedFixture() {
  const tickers = [];
  const memberships = [];
  /* NVDA's home is one of the 16, and is deliberately NOT the first or last of its own
     memberships in any natural order — that is what makes it a proof of reading. */
  const homes = [LIVE.nvdaHome].concat(
    Array.from({ length:LIVE.homeCohorts - 1 }, (_, i) => "HOME_" + String(i).padStart(2, "0")));
  for (let i = 0; i < LIVE.activeTickers - 1; i += 1) {
    const ticker = "T" + String(i).padStart(3, "0");
    tickers.push({ ticker, cohort:homes[i % homes.length], active:true });
    memberships.push({ ticker, cohort:homes[i % homes.length] });
  }
  tickers.push({ ticker:"NVDA", cohort:LIVE.nvdaHome, active:true });
  for (const cohort of LIVE.nvdaMemberships) memberships.push({ ticker:"NVDA", cohort });
  /* Pad to exactly 1283 distinct memberships, which forces a second page. */
  let extra = 0;
  while (memberships.length < LIVE.memberships) {
    const ticker = "T" + String(extra % (LIVE.activeTickers - 1)).padStart(3, "0");
    memberships.push({ ticker, cohort:"EXTRA_" + Math.floor(extra / 300) });
    extra += 1;
  }
  return { ticker_cohorts:memberships, tickers };
}

test("the membership set is read past the 1000-row page cap, all 1283 of it", async () => {
  const axis = loadAxis();
  const { pg, calls } = fakePg(liveShapedFixture());
  const result = await axis.loadMemberships(pg);

  assert.equal(result.source, "ticker_cohorts", "the membership set is ticker_cohorts, not a substitute");
  assert.ok(calls.some((c) => c.startsWith("ticker_cohorts?")), "it reads that relation");
  assert.ok(calls.some((c) => c.includes("offset=1000")), "a second page is actually requested");
  assert.equal(result.rows.length, LIVE.memberships, "all 1283 memberships arrive");
  assert.equal(result.truncated, false);
});

test("a page exactly the size of the cap is not mistaken for the end of the table", async () => {
  const axis = loadAxis();
  const memberships = Array.from({ length:1001 }, (_, i) => ({ ticker:"T" + i, cohort:"C" + (i % 5) }));
  const { pg } = fakePg({ ticker_cohorts:memberships, tickers:[] });
  const result = await axis.loadMemberships(pg);
  assert.equal(result.rows.length, 1001, "the 1001st membership is not lost");
});

test("a bounded walk that hits its page ceiling says so rather than looking complete", async () => {
  const axis = loadAxis();
  const huge = Array.from({ length:axis.MAX_PAGES * axis.PAGE + 5 }, (_, i) => ({ ticker:"T" + i, cohort:"C" + (i % 3) }));
  const { pg } = fakePg({ ticker_cohorts:huge, tickers:[] });
  const result = await axis.loadMemberships(pg);
  assert.equal(result.truncated, true, "a truncated read must never claim to be whole");
});

test("multi-membership survives intact — NVDA keeps all five", async () => {
  const axis = loadAxis();
  const { pg } = fakePg(liveShapedFixture());
  const result = await axis.loadMemberships(pg);
  const byTicker = axis.byTicker(result.rows);
  assert.deepEqual(Array.from(byTicker.get("NVDA")), LIVE.nvdaMemberships.slice().sort(),
    "every cohort NVDA belongs to is preserved, none collapsed away");
  const byCohort = axis.byCohort(result.rows);
  assert.ok(Array.from(byCohort.get("SEMICONDUCTORS")).includes("NVDA"));
  assert.ok(Array.from(byCohort.get("TECH")).includes("NVDA"));
});

test("the home cohort is READ from tickers.cohort, never derived from memberships", async () => {
  const axis = loadAxis();
  const { pg, calls } = fakePg(liveShapedFixture());
  const homes = await axis.loadHomeCohorts(pg);

  assert.equal(homes.source, "tickers.cohort");
  assert.ok(calls.some((c) => c.startsWith("tickers?") && c.includes("active=eq.true")),
    "only active tickers, matching what the membership view itself restricts to");
  assert.equal(homes.activeTickers, LIVE.activeTickers, "387 active tickers");
  assert.equal(homes.unassigned, 0, "every active ticker has a home recorded");
  assert.equal(new Set(homes.home.values()).size, LIVE.homeCohorts, "16 home cohorts");

  /* The case that proves it is read and not derived: NVDA's home is AI_HARDWARE, which is
     neither the first nor the last of its memberships in any natural order. */
  assert.equal(axis.homeOf(homes.home, "NVDA"), LIVE.nvdaHome);
  assert.equal(axis.homeOf(homes.home, "nvda"), LIVE.nvdaHome, "lookup is case-insensitive");

  /* Nothing in the module may pick a cohort out of a membership list. */
  assert.equal(typeof axis.primaryOf, "undefined", "no ordering-based primary rule exists");
  assert.equal(typeof axis.primaryByTicker, "undefined");
  assert.doesNotMatch(axisSource, /sort\(\)\[0\]/, "no lexicographic tie-break survives");
});

test("a ticker with no recorded home is named unassigned, not given one", async () => {
  const axis = loadAxis();
  const { pg } = fakePg({
    tickers:[{ ticker:"HOMELESS", cohort:null, active:true }, { ticker:"HOUSED", cohort:"AI", active:true }],
    ticker_cohorts:[{ ticker:"HOMELESS", cohort:"TECH" }, { ticker:"HOMELESS", cohort:"SEMIS" }],
  });
  const homes = await axis.loadHomeCohorts(pg);
  assert.equal(homes.unassigned, 1);
  assert.equal(axis.homeOf(homes.home, "HOMELESS"), null,
    "its memberships are NOT substituted for a home it does not have");

  const groups = axis.groupByHome(homes.home, ["HOMELESS", "HOUSED"]);
  assert.deepEqual(Array.from(groups.get("UNASSIGNED")), ["HOMELESS"]);
  assert.deepEqual(Array.from(groups.get("AI")), ["HOUSED"]);
});

test("home placement is identical whatever order the memberships arrive in", async () => {
  const axis = loadAxis();
  const fixture = liveShapedFixture();
  const shuffled = { ...fixture, ticker_cohorts:fixture.ticker_cohorts.slice().reverse() };
  const a = await axis.loadHomeCohorts(fakePg(fixture).pg);
  const b = await axis.loadHomeCohorts(fakePg(shuffled).pg);
  assert.equal(axis.homeOf(a.home, "NVDA"), LIVE.nvdaHome);
  assert.equal(axis.homeOf(b.home, "NVDA"), LIVE.nvdaHome,
    "membership order cannot move a ticker's home, because it never decided it");
});

test("navigation surfaces read the complete membership set", () => {
  const NAVIGATION = {
    "/cohorts":    read("../cohorts/index.html"),
    "/cohort":     read("../cohort/index.html"),
    "/compare":    read("../compare/index.html"),
    "/geigerwall": read("../geigerwall/index.html"),
    "/events":     read("../events/index.html"),
    "/analytics":  read("../analytics/index.html"),
  };
  for (const [route, source] of Object.entries(NAVIGATION)) {
    assert.match(source, /<script src="\/_cohorts\/cohort-axis\.js"><\/script>/, `${route} loads the shared reader`);
    assert.match(source, /SC_COHORT_AXIS\.(loadMemberships|byCohort)/, `${route} reads the membership set`);
    assert.doesNotMatch(source, /SC_COHORT_AXIS\.loadHomeCohorts/,
      `${route} is navigation — it must not reduce a ticker to one cohort`);
    assert.doesNotMatch(source, /is_primary/, `${route} still references the retired column`);
    /* No surface may go back to a single capped page of the membership set. */
    assert.doesNotMatch(source, /pg(All)?\(["']ticker_cohorts\?/, `${route} queries ticker_cohorts un-paged`);
    assert.doesNotMatch(source, /['"]ticker_cohorts\?select[^'"]*limit=1000/, `${route} pins one page`);
  }
});

test("/heat and the fundamentals peer set use the read home cohort", () => {
  const heat = read("../heat/index.html");
  assert.match(heat, /SC_COHORT_AXIS\.loadHomeCohorts\(pg\)/, "/heat asks for homes");
  assert.match(heat, /SC_COHORT_AXIS\.homeOf\(home, r\.t\)/, "and places each tile by the home it read");
  assert.match(heat, /tickers\.cohort/, "and says so on the page");
  assert.doesNotMatch(heat, /for \(const r of d\.coh\) if \(!\(r\.ticker in primary\)\)/,
    "the arrival-order rule is gone");

  const fundamentals = read("../templates/fundamentals.html");
  assert.match(fundamentals, /SC_COHORT_AXIS\.loadAxis\(/, "it needs both sets");
  assert.match(fundamentals, /for\(const \[ticker, homeCohort\] of axis\.home\) COHORT_MAP\[ticker\]=homeCohort;/,
    "the peer set is keyed on the read home cohort");
  assert.match(fundamentals, /tickers\.cohort/);
  assert.doesNotMatch(fundamentals, /primaryByTicker/, "no derived primary survives");
  assert.doesNotMatch(fundamentals, /is_primary/);
});

test("a paged read without a total order is refused outright", async () => {
  const axis = loadAxis();
  await assert.rejects(() => axis.readAll(async () => [], "ticker_cohorts?select=ticker,cohort", 1000),
    /refusing to page/, "no ordering, no paging");
});

test("the module pages, bounds itself, and never substitutes a relation", () => {
  assert.match(axisSource, /const PAGE = 1000;/);
  assert.match(axisSource, /const MAX_PAGES = 40;/);
  assert.match(axisSource, /if \(batch\.length < size\) return \{ rows: out, pages, truncated: false \};/);
  assert.match(axisSource, /"ticker_cohorts\?select=ticker,cohort&order=ticker\.asc,cohort\.asc"/,
    "memberships come from ticker_cohorts, under a total order");
  assert.match(axisSource, /"tickers\?select=ticker,cohort&active=eq\.true&order=ticker\.asc"/,
    "homes come from tickers.cohort, under a total order");
  /* OFFSET paging without a total order is not paging: PostgREST applies LIMIT/OFFSET to
     whatever order the planner produced, so adjacent windows are independent unordered scans
     and a row can land in both or in neither while the walk still looks complete. */
  assert.match(axisSource, /function requireTotalOrder \(path\)/);
  assert.match(axisSource, /refusing to page/);
  assert.doesNotMatch(axisSource, /ticker_membership/,
    "no equivalent-looking relation is swapped in for either question");
});

test("a paged read's row count is no longer treated as evidence of truncation", () => {
  /* The guard that outlived its query. `rows.length>=1000` was the only defence a single
     limit=1000 request had against a silent truncation. Once the shared reader paged the whole
     relation, a COMPLETE read returned 1283 rows and that same guard threw on every load — so
     the allocation module fell back to hardcoded TICKER_STYLES every single time, and did it
     precisely because the read had succeeded. A paged read reports its own completeness. */
  const allocation = read("../templates/allocation-module.html");
  const universeRead = allocation.slice(allocation.indexOf("SC_COHORT_AXIS.loadMemberships(sbGet)"),
                                        allocation.indexOf("hub_favorites?select=ticker,added_at"));
  assert.doesNotMatch(universeRead, /rows\.length>=1000/,
    "the row count cannot decide completeness for a paged read");
  assert.match(universeRead, /if\(axis\.truncated\) throw new Error/,
    "only the reader's own truncation flag can");
  assert.match(universeRead, /if\(!rows\.length\) throw new Error/,
    "and an empty read is still a failure");

  /* The guard is correct on the reads that ARE single-page, and must stay there. */
  for (const table of ["composite_staged", "live_quotes", "company_profile"]) {
    const at = allocation.indexOf("sbGet('" + table);
    assert.ok(at > -1, `${table} is still read`);
    assert.match(allocation.slice(at, at + 400), /rows\.length>=1000/,
      `${table} is a single capped page and keeps its truncation guard`);
  }
});

test("COHORT FAVORITES navigates on the membership relation alone", () => {
  /* `cohorts` is not a second membership source: pg_get_viewdef gives
     `SELECT ticker, cohort FROM tickers` — one HOME cohort per ticker, unfiltered by `active`.
     Folding it into the navigation index put home answers and membership answers in one map,
     and smuggled in 25 pairs that are not memberships plus tickers that are not active. */
  const deckSource = read("../deck/index.html");
  const loader = deckSource.slice(deckSource.indexOf("async function loadCohortIndex()"),
                                  deckSource.indexOf("function cohortState()"));
  assert.match(loader, /SC_COHORT_AXIS\.loadMemberships\(pg\)/);
  assert.doesNotMatch(loader, /pg\("cohorts\?select=ticker,cohort"\)/,
    "the home relation is not a membership source");
  assert.match(loader, /buildCohortIndex\(\[axis\.rows\], favorites\)/,
    "one source, and it is the membership relation — full members per cohort, with FAV as the explicit entry the cohorts replace");
  assert.match(loader, /if \(axis\.truncated\) throw new Error/,
    "a truncated read cannot be presented as the cohort axis");
});

test("an error-shaped empty page is never mistaken for the end of the table", async () => {
  /* templates/fundamentals.html's sb() answers a non-OK response with an error-TAGGED empty
     array rather than throwing — deliberately, so a 400 does not read as "the table is empty".
     To the paged walk those were indistinguishable from a short final page: a FIRST-page failure
     produced zero memberships and reported truncated:false, so every ticker painted UNCOHORTED
     while the reader claimed a complete read, and a LATER-page failure published the earlier
     pages as if they were the whole relation. */
  const axis = loadAxis();
  const errorPage = () => { const e = []; e._sbError = true; e._sbStatus = 400; return e; };

  /* First page fails. */
  await assert.rejects(
    () => axis.readAll(async () => errorPage(), "ticker_cohorts?select=ticker,cohort&order=ticker.asc", 1000),
    /page read failed \(HTTP 400\) at offset 0/,
    "a failed first page is a failure, not an empty table");

  /* A later page fails, after a full first page. */
  let call = 0;
  await assert.rejects(
    () => axis.readAll(async () => {
      call += 1;
      if (call === 1) return Array.from({ length:1000 }, (_, i) => ({ ticker:"T" + i, cohort:"C" }));
      return errorPage();
    }, "ticker_cohorts?select=ticker,cohort&order=ticker.asc", 1000),
    /at offset 1000/,
    "the pages already read are not published as the whole relation");

  /* A genuinely short page is still the end of the table. */
  const fine = await axis.readAll(async () => [{ ticker:"AAPL", cohort:"TECH" }],
    "ticker_cohorts?select=ticker,cohort&order=ticker.asc", 1000);
  assert.equal(fine.truncated, false);
  assert.equal(fine.rows.length, 1);

  /* And an adapter that returns something that is not an array at all is a failure too. */
  await assert.rejects(
    () => axis.readAll(async () => null, "ticker_cohorts?select=ticker,cohort&order=ticker.asc", 1000),
    /returned no array/);

  /* The fundamentals call site converts the flag to a throw at the one place that pages. */
  const fundamentals = read("../templates/fundamentals.html");
  assert.match(fundamentals, /if \(rows && rows\._sbError\)\n\s*throw new Error\('cohort read failed'/);
});
