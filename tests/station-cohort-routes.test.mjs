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

test("the module pages, bounds itself, and never substitutes a relation", () => {
  assert.match(axisSource, /const PAGE = 1000;/);
  assert.match(axisSource, /const MAX_PAGES = 40;/);
  assert.match(axisSource, /if \(batch\.length < size\) return \{ rows: out, pages, truncated: false \};/);
  assert.match(axisSource, /"ticker_cohorts\?select=ticker,cohort"/, "memberships come from ticker_cohorts");
  assert.match(axisSource, /"tickers\?select=ticker,cohort&active=eq\.true"/, "homes come from tickers.cohort");
  assert.doesNotMatch(axisSource, /ticker_membership/,
    "no equivalent-looking relation is swapped in for either question");
});
