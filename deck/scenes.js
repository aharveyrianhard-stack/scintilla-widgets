(function (root) {
  "use strict";

  const IDS = ["live", "overnight", "indexes", "cohort", "custom"];
  const PRESETS = Object.freeze({
    overnight: Object.freeze({
      label: "OVERNIGHT",
      tickers: Object.freeze(["ESUSD", "NQUSD", "CLUSD"]),
      chartCount: 3,
      range: "15m"
    }),
    indexes: Object.freeze({
      label: "INDEX LEADERSHIP",
      tickers: Object.freeze(["SPY", "QQQ", "IWM", "MAGS"]),
      chartCount: 4,
      range: "1D"
    })
  });

  const normalizeScene = (value) => IDS.includes(value) ? value : "live";

  function chartCountForSize(size) {
    const n = Math.max(0, Math.min(6, Number(size) || 0));
    if (n <= 1) return 1;
    if (n <= 4) return n;
    return 6;
  }

  function buildCohortFavorites(favoriteRows, membershipGroups) {
    const favorites = new Set((favoriteRows || []).map((row) => String(row?.ticker || "").toUpperCase()).filter(Boolean));
    const byCohort = new Map();
    for (const rows of membershipGroups || []) {
      for (const row of rows || []) {
        const ticker = String(row?.ticker || "").toUpperCase();
        const cohort = String(row?.cohort || "").toUpperCase();
        if (!ticker || !cohort) continue;
        if (!byCohort.has(cohort)) byCohort.set(cohort, new Set());
        if (favorites.has(ticker)) byCohort.get(cohort).add(ticker);
      }
    }
    return new Map(Array.from(byCohort, ([cohort, tickers]) => [cohort, Array.from(tickers).sort()]));
  }

  function cohortPage(index, cohort, requestedPage, pageSize) {
    const size = Math.max(1, Math.min(6, Number(pageSize) || 6));
    const key = String(cohort || "").toUpperCase();
    const all = (index?.get(key) || []).slice();
    const totalPages = Math.max(1, Math.ceil(all.length / size));
    const page = Math.max(0, Math.min(totalPages - 1, Number(requestedPage) || 0));
    const tickers = all.slice(page * size, page * size + size);
    return {
      cohort: key,
      page,
      totalPages,
      totalItems: all.length,
      tickers,
      chartCount: chartCountForSize(tickers.length)
    };
  }

  root.StationScenes = Object.freeze({
    IDS: Object.freeze(IDS.slice()),
    PRESETS,
    normalizeScene,
    chartCountForSize,
    buildCohortFavorites,
    cohortPage
  });
})(typeof globalThis === "object" ? globalThis : window);
