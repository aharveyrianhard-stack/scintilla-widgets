/* SCINTILLA STATION — THE COHORT AXIS
   ===================================
   Two different questions were being answered by one query, and getting one answer.

     "WHICH COHORTS IS THIS TICKER IN?"  -> ticker_cohorts. 1283 memberships. NVDA is in five
                                            of them: AI_HARDWARE, MEGA_CAP, MEGACAP,
                                            SEMICONDUCTORS, TECH.
     "WHERE DOES THIS TICKER LIVE?"      -> tickers.cohort. One value per ticker, populated for
                                            all 387 active tickers across 16 home cohorts.
                                            NVDA's is AI_HARDWARE.

   The navigation surfaces need the first. A surface that draws one tile per ticker needs the
   second. Neither can be derived from the other, and the second must never be invented from
   the first - an ordering rule over a membership set is a guess wearing a rule's clothes, and
   it would have placed NVDA in AI_HARDWARE by coincidence while placing others wherever the
   alphabet fell. tickers.cohort is a curated statement of where a ticker lives; it is read,
   not computed.

   WHAT WENT WRONG BEFORE, and is fixed here:

     THE READ WAS CAPPED. PostgREST returns at most 1000 rows per response and ticker_cohorts
     holds 1283, so every unpaginated reader silently dropped 283 memberships behind a 200 OK.
     A short read and a small table are indistinguishable unless you ask for the next page.
     This module always asks, bounds the walk, and reports when it stopped early.

     THE TIE-BREAK WAS ARRIVAL ORDER. /heat placed a ticker in whichever membership row came
     back first from an unordered DISTINCT view - a different wall on different loads.

   Nothing here replaces ticker_cohorts with a different relation. It is the membership set,
   read completely.
*/
(function (root) {
  "use strict";

  const PAGE = 1000;              /* PostgREST's own ceiling; asking for more does not raise it */
  const MAX_PAGES = 40;           /* a bounded walk: 40k rows is far past any real axis */

  /* OFFSET PAGING NEEDS A TOTAL ORDER, OR IT IS NOT PAGING.
     PostgREST applies LIMIT/OFFSET to whatever order the planner happened to produce. Without
     an explicit ORDER BY that is unique per row, two requests for adjacent windows are two
     independent unordered scans: a row can appear in both, or in neither, and the walk still
     terminates looking complete. The membership set is a DISTINCT view over a join - exactly
     the shape whose row order is least stable. Every paged read below therefore carries an
     ordering that is unique across the whole relation, and readAll refuses to walk without
     one. */
  function requireTotalOrder (path) {
    if (path.indexOf("order=") < 0) throw new Error("cohort-axis: refusing to page " + path + " without an explicit total order");
    return path;
  }

  /* Walk every page. `pg` is the page's own reader; it is never replaced, only driven. */
  async function readAll(pg, path, page) {
    requireTotalOrder(path);
    const size = Math.max(1, Math.min(PAGE, Number(page) || PAGE));
    const out = [];
    let pages = 0;
    for (let offset = 0; pages < MAX_PAGES; offset += size) {
      const rows = await pg(path + (path.indexOf("?") < 0 ? "?" : "&") + "limit=" + size + "&offset=" + offset);
      /* AN ERROR-SHAPED EMPTY IS NOT A SHORT PAGE.
         Some page adapters answer a non-OK response with an empty array carrying an error flag
         rather than by throwing - templates/fundamentals.html does exactly that. To this walk
         those were indistinguishable from the end of the table: a first-page failure produced
         zero memberships and reported `truncated: false`, so every ticker painted UNCOHORTED
         while the reader claimed a complete read. A later-page failure was worse, publishing
         the earlier pages as if they were the whole relation. The flag is honoured, and an
         adapter that neither throws nor flags is still covered by the length check below. */
      if (rows && rows._sbError)
        throw new Error("cohort-axis: page read failed" +
          (rows._sbStatus ? " (HTTP " + rows._sbStatus + ")" : "") + " at offset " + offset);
      if (!Array.isArray(rows))
        throw new Error("cohort-axis: page read returned no array at offset " + offset);
      const batch = rows;
      pages += 1;
      out.push(...batch);
      /* A short page is the only honest end-of-table signal PostgREST gives. */
      if (batch.length < size) return { rows: out, pages, truncated: false };
    }
    /* Never pretend a bounded walk saw everything. */
    return { rows: out, pages, truncated: true };
  }

  const upper = (v) => String(v == null ? "" : v).toUpperCase().trim();

  /* ---- MEMBERSHIP: every cohort a ticker is in. The navigation axis. -------------------------
     ticker_cohorts, read completely. A ticker appears once per cohort it belongs to. */
  async function loadMemberships(pg, options) {
    const size = (options && options.page) || PAGE;
    /* (ticker, cohort) is the view's own DISTINCT key, so ordering on both is a total order. */
    const read = await readAll(pg, "ticker_cohorts?select=ticker,cohort&order=ticker.asc,cohort.asc", size);
    const seen = new Set();
    const rows = [];
    for (const row of read.rows) {
      const ticker = upper(row && row.ticker);
      const cohort = upper(row && row.cohort);
      if (!ticker || !cohort) continue;
      const key = ticker + "|" + cohort;
      if (seen.has(key)) continue;          /* the view is DISTINCT; so is this */
      seen.add(key);
      rows.push({ ticker, cohort });
    }
    return { rows, pages: read.pages, truncated: read.truncated, source: "ticker_cohorts" };
  }

  /* ---- HOME: the one cohort a ticker lives in. Read, never derived. --------------------------
     tickers.cohort, for active tickers. This is what a one-tile-per-ticker surface needs. */
  async function loadHomeCohorts(pg, options) {
    const size = (options && options.page) || PAGE;
    /* ticker is the primary key of `tickers`, so ordering on it is a total order. */
    const read = await readAll(pg, "tickers?select=ticker,cohort&active=eq.true&order=ticker.asc", size);
    const home = new Map();
    let unassigned = 0;
    for (const row of read.rows) {
      const ticker = upper(row && row.ticker);
      if (!ticker) continue;
      const cohort = upper(row && row.cohort);
      if (!cohort) { unassigned += 1; continue; }   /* stated as unassigned, never guessed */
      home.set(ticker, cohort);
    }
    return { home, activeTickers: read.rows.length, unassigned,
             pages: read.pages, truncated: read.truncated, source: "tickers.cohort" };
  }

  /* Both sets at once, for a surface that shows a home AND the rest of the memberships. */
  async function loadAxis(pg, options) {
    const [memberships, homes] = await Promise.all([
      loadMemberships(pg, options),
      loadHomeCohorts(pg, options),
    ]);
    return {
      rows: memberships.rows,
      home: homes.home,
      activeTickers: homes.activeTickers,
      unassigned: homes.unassigned,
      truncated: memberships.truncated || homes.truncated,
      pages: memberships.pages + homes.pages,
    };
  }

  /* Every cohort a ticker belongs to. Multi-membership is data, not noise. */
  function byTicker(rows) {
    const map = new Map();
    for (const row of rows || []) {
      const ticker = upper(row && row.ticker);
      const cohort = upper(row && row.cohort);
      if (!ticker || !cohort) continue;
      if (!map.has(ticker)) map.set(ticker, []);
      const list = map.get(ticker);
      if (!list.includes(cohort)) list.push(cohort);
    }
    for (const list of map.values()) list.sort();
    return map;
  }

  /* Every ticker in a cohort. */
  function byCohort(rows) {
    const map = new Map();
    for (const row of rows || []) {
      const ticker = upper(row && row.ticker);
      const cohort = upper(row && row.cohort);
      if (!ticker || !cohort) continue;
      if (!map.has(cohort)) map.set(cohort, []);
      const list = map.get(cohort);
      if (!list.includes(ticker)) list.push(ticker);
    }
    for (const list of map.values()) list.sort();
    return map;
  }

  /* The home cohort of one ticker. Null means the ticker has no home recorded - which is a
     fact about the data, not a prompt to pick one from its memberships. */
  function homeOf(home, ticker) {
    if (!home || typeof home.get !== "function") return null;
    return home.get(upper(ticker)) || null;
  }

  /* Group tickers by their home cohort. Anything without a home is named, not hidden. */
  function groupByHome(home, tickers, unassignedLabel) {
    const label = unassignedLabel || "UNASSIGNED";
    const groups = new Map();
    for (const ticker of tickers || []) {
      const key = homeOf(home, ticker) || label;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ticker);
    }
    return groups;
  }

  root.SC_COHORT_AXIS = Object.freeze({
    PAGE, MAX_PAGES,
    readAll, loadMemberships, loadHomeCohorts, loadAxis,
    byTicker, byCohort, homeOf, groupByHome,
  });
})(typeof globalThis === "object" ? globalThis : window);
