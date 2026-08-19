/* SCINTILLA STATION — THE COHORT AXIS
   ===================================
   One definition of what a cohort IS, and one paginated way to read it, shared by every
   surface that navigates the cohort axis. Before this file each page carried its own query,
   and two separate faults hid behind the same line.

   FAULT 1 — THE READ WAS CAPPED AND NOBODY NOTICED.
   PostgREST returns at most 1000 rows per response. `ticker_cohorts` holds 1283. Every
   unpaginated reader was therefore dropping 283 memberships on every load, silently, with a
   200 OK and a plausible-looking wall. A short read is indistinguishable from a small table
   unless you go and ask for the next page, so this file always does, and it says how many
   pages it took.

   FAULT 2 — `ticker_cohorts` IS NOT THE COHORT AXIS.
   The view flattens FIVE different kinds of membership into one `cohort` column:

     kind='cohort'      408 rows   23 groups   <- the cohort axis
     kind='sector'      334 rows   14 groups
     kind='industry'    317 rows   93 groups
     kind='size'        317 rows    4 groups
     kind='sector_ext'   71 rows   10 groups

   Reading the view gives 120 "cohorts", of which 97 are sectors, industries and size buckets
   wearing a cohort's name. That is why a ticker looked like it had up to 5 cohorts: it has
   one cohort, one sector, one industry, one size bucket. Picking "the first one returned"
   from that set is not a tie-break, it is a coin toss between four different questions - and
   an unordered DISTINCT view gives no stable order to break the tie with.

   THE RULE, STATED: the cohort axis is `ticker_membership.kind = 'cohort'`, restricted to
   active tickers - the same restriction `ticker_cohorts` itself applies. Measured on
   2026-08-19 that is 404 memberships over 387 active tickers in 23 cohorts, with 16 tickers
   in more than one cohort (at most 3).

   Evidence that this is the SUCCESSOR of the retired `is_primary` flag rather than a new
   invention: of the 233 rows the legacy base table still marks primary, 195 appear verbatim
   in kind='cohort'; the legacy table carries 38 pairs membership has dropped and is missing
   213 it has since gained. Same axis, refreshed - not a different one.

   MULTI-MEMBERSHIP IS REAL AND IS PRESERVED. 16 tickers genuinely belong to more than one
   cohort. `byTicker` returns every one of them. Only `primaryCohort` reduces to a single
   value, for the surfaces that can paint a ticker in exactly one place, and it does so by a
   NAMED, DETERMINISTIC rule rather than by arrival order.
*/
(function (root) {
  "use strict";

  /* Editable defaults. Change KIND here and every cohort surface follows. */
  const KIND = "cohort";
  const PAGE = 1000;              /* PostgREST's own ceiling; asking for more does not raise it */
  const MAX_PAGES = 40;           /* a bounded walk: 40k rows is far past any real axis */

  /* THE TIE-BREAK, NAMED. A ticker in more than one cohort must land in exactly one place on
     a surface that has one tile per ticker. Lowest cohort name wins - arbitrary, but stated,
     stable across reloads, and identical on every surface. Arrival order is none of those. */
  function primaryOf(cohorts) {
    const list = (cohorts || []).map((c) => String(c || "").toUpperCase()).filter(Boolean);
    if (!list.length) return null;
    return list.slice().sort()[0];
  }

  /* Walk every page. `pg` is the page's own reader; it is never replaced, only driven. */
  async function readAll(pg, path, page) {
    const size = Math.max(1, Math.min(PAGE, Number(page) || PAGE));
    const out = [];
    let pages = 0;
    for (let offset = 0; pages < MAX_PAGES; offset += size) {
      const rows = await pg(path + (path.indexOf("?") < 0 ? "?" : "&") + "limit=" + size + "&offset=" + offset);
      const batch = Array.isArray(rows) ? rows : [];
      pages += 1;
      out.push(...batch);
      /* A short page is the only honest end-of-table signal PostgREST gives. */
      if (batch.length < size) return { rows: out, pages, truncated: false };
    }
    /* Never pretend a bounded walk saw everything. */
    return { rows: out, pages, truncated: true };
  }

  /* The cohort axis, fully paged, active tickers only. */
  async function loadMemberships(pg, options) {
    const kind = (options && options.kind) || KIND;
    const size = (options && options.page) || PAGE;

    const [membership, active] = await Promise.all([
      readAll(pg, "ticker_membership?select=ticker,group_key&kind=eq." + encodeURIComponent(kind), size),
      readAll(pg, "tickers?select=ticker&active=eq.true", size),
    ]);

    /* `ticker_cohorts` joins active tickers, so the axis must too, or a delisted name
       reappears the moment the view is bypassed. */
    const live = new Set(active.rows.map((r) => String(r && r.ticker || "").toUpperCase()).filter(Boolean));
    const seen = new Set();
    const rows = [];
    for (const row of membership.rows) {
      const ticker = String(row && row.ticker || "").toUpperCase();
      const cohort = String(row && row.group_key || "").toUpperCase();
      if (!ticker || !cohort || !live.has(ticker)) continue;
      const key = ticker + "|" + cohort;
      if (seen.has(key)) continue;      /* the view is DISTINCT; so is this */
      seen.add(key);
      rows.push({ ticker, cohort });
    }
    return {
      rows,
      kind,
      pages: membership.pages + active.pages,
      truncated: membership.truncated || active.truncated,
      activeTickers: live.size,
    };
  }

  /* Every cohort a ticker belongs to. Multi-membership is data, not noise. */
  function byTicker(rows) {
    const map = new Map();
    for (const row of rows || []) {
      const ticker = String(row && row.ticker || "").toUpperCase();
      const cohort = String(row && row.cohort || "").toUpperCase();
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
      const ticker = String(row && row.ticker || "").toUpperCase();
      const cohort = String(row && row.cohort || "").toUpperCase();
      if (!ticker || !cohort) continue;
      if (!map.has(cohort)) map.set(cohort, []);
      const list = map.get(cohort);
      if (!list.includes(ticker)) list.push(ticker);
    }
    for (const list of map.values()) list.sort();
    return map;
  }

  /* One cohort per ticker, for surfaces with one tile per ticker. */
  function primaryByTicker(rows) {
    const map = new Map();
    for (const [ticker, cohorts] of byTicker(rows)) map.set(ticker, primaryOf(cohorts));
    return map;
  }

  root.SC_COHORT_AXIS = Object.freeze({
    KIND, PAGE, MAX_PAGES,
    readAll, loadMemberships, byTicker, byCohort, primaryByTicker, primaryOf,
  });
})(typeof globalThis === "object" ? globalThis : window);
