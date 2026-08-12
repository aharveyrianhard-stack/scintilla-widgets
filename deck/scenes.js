(function (root) {
  "use strict";

  const IDS = ["live","indexNow","indexLeadership","companyLeadership","focus2","macroCrossAsset","internalsFast","internalsSlow","sectorFamilies","themeFamilies","custom"];
  const ROTATION_IDS = Object.freeze(["indexNow","indexLeadership","companyLeadership","focus2","macroCrossAsset","internalsFast","internalsSlow","sectorFamilies","themeFamilies"]);
  const NY = "America/New_York";
  const FAMILIES = Object.freeze({
    sectorFamilies: Object.freeze([
      Object.freeze({ id:"CYCLICAL", label:"CYCLICAL / LEADERSHIP", tickers:Object.freeze(["XLK","XLC","XLY","XLI","XLF","XLE"]), range:"1D" }),
      Object.freeze({ id:"DEFENSIVE", label:"DEFENSIVE / BALLAST", tickers:Object.freeze(["XLP","XLV","XLU","XLRE","XLB","SECTOR12"]), range:"1D" })
    ]),
    themeFamilies: Object.freeze([
      Object.freeze({ id:"AI_COMPUTE", label:"AI COMPUTE CORE", tickers:Object.freeze(["NVDA","TSM","AVGO","MU","SNDK","ASML"]), range:"3h" }),
      Object.freeze({ id:"AI_INFRA", label:"AI INFRASTRUCTURE", tickers:Object.freeze(["NBIS","CRDO","ANET","CRWV","APLD","ALAB"]), range:"3h" }),
      Object.freeze({ id:"AI_POWER", label:"AI POWER / SPECULATIVE", tickers:Object.freeze(["CIFR","IREN","WULF","BE","OKLO","USAR"]), range:"3h" })
    ])
  });
  const PRESETS = Object.freeze({
    indexNow: Object.freeze({
      label: "INDEX NOW",
      tickers: Object.freeze(["ESUSD", "NQUSD", "CLUSD"]),
      chartCount: 3,
      range: "3h"
    }),
    indexLeadership: Object.freeze({
      label: "INDEX LEADERSHIP",
      tickers: Object.freeze(["SPY", "QQQ", "IWM", "MAGS", "SMH", "DIA"]),
      chartCount: 6,
      range: "3h"
    }),
    companyLeadership: Object.freeze({ label:"COMPANY LEADERSHIP", tickers:Object.freeze(["AAPL","MSFT","META","AMZN","GOOGL","TSLA"]), chartCount:6, range:"3h" }),
    focus2: Object.freeze({ label:"FOCUS 2", tickers:Object.freeze(["MU","SNDK"]), chartCount:2, range:"3h" }),
    macroCrossAsset: Object.freeze({ label:"MACRO CROSS-ASSET", tickers:Object.freeze(["US10Y","DXUSD","GCUSD","SIUSD"]), chartCount:4, range:"3D" }),
    internalsFast: Object.freeze({ label:"INTERNALS FAST", tickers:Object.freeze(["VIX","ADD","PCC","CUMTICK"]), chartCount:4, range:"3h" }),
    internalsSlow: Object.freeze({ label:"INTERNALS SLOW", tickers:Object.freeze(["TICK","TRIN"]), chartCount:2, range:"1D" })
  });

  const LEGACY = Object.freeze({ overnight:"indexNow", indexes:"indexLeadership", company:"companyLeadership", cohort:"themeFamilies", sectors:"sectorFamilies", themes:"themeFamilies" });
  const normalizeScene = (value) => IDS.includes(LEGACY[value] || value) ? (LEGACY[value] || value) : "live";

  function indexNowLeaders(at) {
    const d = at instanceof Date ? at : new Date(at);
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone:NY, hour:"2-digit", hour12:false }).format(d));
    return hour >= 8 && hour < 18 ? ["SPY","QQQ"] : ["ESUSD","NQUSD"];
  }
  function indexNowTickersFor(at) {
    return Object.freeze([...indexNowLeaders(at), "CLUSD"]);
  }

  function chartCountForSize(size) {
    const n = Math.max(0, Math.min(8, Number(size) || 0));
    if (n <= 1) return 1;
    if (n <= 4) return n;
    if (n <= 6) return 6;
    return 8;
  }

  function usesSharedBottomAxis(size) {
    return [4, 6, 8].includes(chartCountForSize(size));
  }
  function nextRotatingScene(scene) {
    const index = ROTATION_IDS.indexOf(normalizeScene(scene));
    return ROTATION_IDS[(index + 1 + ROTATION_IDS.length) % ROTATION_IDS.length];
  }
  function basketWindow(members, offset, requestedCount) {
    const all = (members || []).slice(), size = chartCountForSize(requestedCount || 6);
    if (!all.length) return { tickers:[], chartCount:1, offset:0, totalItems:0, hasPrevious:false, hasNext:false, empty:true };
    const max = Math.max(0, Math.floor((all.length - 1) / size) * size);
    const start = Math.max(0, Math.min(max, Number(offset) || 0));
    const tickers = all.slice(start, start + size);
    return { tickers, chartCount:chartCountForSize(tickers.length), offset:start, totalItems:all.length, hasPrevious:start>0, hasNext:start<max, empty:false };
  }
  function familyOptions(scene) { return (FAMILIES[normalizeScene(scene)] || []).slice(); }
  function familyBasket(scene, id) { return familyOptions(scene).find((x) => x.id === id) || familyOptions(scene)[0] || null; }

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
    ROTATION_IDS,
    PRESETS,
    normalizeScene,
    chartCountForSize,
    usesSharedBottomAxis,
    nextRotatingScene,
    indexNowLeaders,
    indexNowTickersFor,
    FAMILIES,
    familyOptions,
    familyBasket,
    basketWindow,
    buildCohortFavorites,
    cohortPage
  });
})(typeof globalThis === "object" ? globalThis : window);
