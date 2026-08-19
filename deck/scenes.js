(function (root) {
  "use strict";

  /* "cohort" is a first-class scene again, by filed ruling: choosing a cohort must show the
     COHORT'S rows, replacing the favorites rows — it may not be collapsed into a family
     preset, and it may not be filtered down to whichever members happen to be favorited. */
  const IDS = ["live","indexNow","indexLeadership","companyLeadership","focus2","macroCrossAsset","internalsFast","internalsSlow","sectorFamilies","themeFamilies","cohort","custom"];
  /* Every curated named scene is independently navigable.  LIVE and CUSTOM
     remain manual workspaces so arrowing/rotation never replaces a live or
     in-progress custom wall. */
  const SCREENS = Object.freeze([
    Object.freeze({ id:"indexNow", scene:"indexNow", label:"INDEX NOW" }),
    Object.freeze({ id:"indexLeadership", scene:"indexLeadership", label:"INDEX LEADERSHIP" }),
    Object.freeze({ id:"companyLeadership", scene:"companyLeadership", label:"COMPANY LEADERSHIP" }),
    Object.freeze({ id:"focus2", scene:"focus2", label:"FOCUS 2" }),
    Object.freeze({ id:"macroCrossAsset", scene:"macroCrossAsset", label:"MACRO CROSS-ASSET" }),
    Object.freeze({ id:"internalsFast", scene:"internalsFast", label:"INTERNALS FAST" }),
    Object.freeze({ id:"internalsSlow", scene:"internalsSlow", label:"INTERNALS SLOW" }),
    Object.freeze({ id:"sectorFamilies", scene:"sectorFamilies", label:"SECTOR FAMILIES" }),
    Object.freeze({ id:"themeFamilies", scene:"themeFamilies", label:"THEME FAMILIES" })
  ]);
  const ROTATION_IDS = Object.freeze(SCREENS.map((screen) => screen.scene));
  const NY = "America/New_York";
  const FAMILIES = Object.freeze({
    sectorFamilies: Object.freeze([
      Object.freeze({ id:"CYCLICAL", label:"CYCLICAL / LEADERSHIP", tickers:Object.freeze(["XLK","XLC","XLY","XLI","XLF","XLE"]), range:"1D" }),
      Object.freeze({ id:"DEFENSIVE", label:"DEFENSIVE / BALLAST", tickers:Object.freeze(["XLP","XLV","XLU","XLRE","XLB","SECTOR12"]), range:"1D" })
    ]),
    themeFamilies: Object.freeze([
      Object.freeze({ id:"AI_COMPUTE", label:"AI COMPUTE CORE", tickers:Object.freeze(["NVDA","TSM","AVGO","ASML","MU","SNDK"]), range:"3h" }),
      Object.freeze({ id:"AI_INFRA", label:"AI INFRASTRUCTURE", tickers:Object.freeze(["ANET","CRWV","NBIS","CRDO","APLD","ALAB"]), range:"3h" }),
      Object.freeze({ id:"AI_POWER", label:"AI POWER / SPECULATIVE", tickers:Object.freeze(["OKLO","IREN","CIFR","BE","WULF","USAR"]), range:"3h" })
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
      tickers: Object.freeze(["SPY", "QQQ", "DIA", "IWM", "MAGS", "SMH"]),
      chartCount: 6,
      range: "3h"
    }),
    companyLeadership: Object.freeze({ label:"COMPANY LEADERSHIP", tickers:Object.freeze(["AAPL","MSFT","AMZN","GOOGL","META","TSLA"]), chartCount:6, range:"3h" }),
    focus2: Object.freeze({ label:"FOCUS 2", tickers:Object.freeze(["MU","SNDK"]), chartCount:2, range:"3h" }),
    macroCrossAsset: Object.freeze({ label:"MACRO CROSS-ASSET", tickers:Object.freeze(["US10Y","DXUSD","GCUSD","SIUSD","CLUSD","BTCUSD"]), chartCount:6, range:"3D" }),
    internalsFast: Object.freeze({ label:"INTERNALS", tickers:Object.freeze(["VIX","ADD","PCC","CUMTICK","TICK","TRIN"]), chartCount:6, range:"3h" }),
    internalsSlow: Object.freeze({ label:"INTERNALS SLOW", tickers:Object.freeze(["TICK","TRIN"]), chartCount:2, range:"1D" })
  });

  /* The old cohort→themeFamilies collapse silently discarded a chosen cohort: a user asking
     for AI_SOFTWARE or MEGACAP landed on the first theme basket with no sign their choice was
     dropped. "cohort" resolves to itself now. */
  const LEGACY = Object.freeze({ overnight:"indexNow", indexes:"indexLeadership", company:"companyLeadership", sectors:"sectorFamilies", themes:"themeFamilies" });
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
    if (n <= 2) return 2;
    if (n === 3) return 3;
    if (n === 4) return 2;
    if (n <= 6) return 6;
    return 8;
  }

  function usesPairedColumnAxis(size) {
    return [6, 8].includes(chartCountForSize(size));
  }
  function hidesTopChartAxis(index, size) {
    const count = chartCountForSize(size);
    return usesPairedColumnAxis(count) && Number(index) >= 0 && Number(index) < count / 2;
  }
  function nextRotatingScene(scene) {
    const index = ROTATION_IDS.indexOf(normalizeScene(scene));
    return ROTATION_IDS[(index + 1 + ROTATION_IDS.length) % ROTATION_IDS.length];
  }
  function screenForScene(scene) {
    return SCREENS.find((screen) => screen.scene === normalizeScene(scene)) || null;
  }
  function nextScreen(scene) {
    const index = SCREENS.findIndex((screen) => screen.scene === normalizeScene(scene));
    return SCREENS[(index + 1 + SCREENS.length) % SCREENS.length];
  }
  function previousScreen(scene) {
    const index = SCREENS.findIndex((screen) => screen.scene === normalizeScene(scene));
    return SCREENS[(index < 0 ? SCREENS.length - 1 : index - 1 + SCREENS.length) % SCREENS.length];
  }
  function basketWindow(members, offset, requestedCount) {
    const all = (members || []).slice();
    const requested = chartCountForSize(requestedCount || 6);
    /* A short four/five-member basket must page honestly rather than create a
       retired four-up wall or render empty cards in a six-up wall. */
    const size = requested === 6 && all.length > 3 && all.length < 6 ? 2 : requested;
    if (!all.length) return { tickers:[], chartCount:1, offset:0, totalItems:0, hasPrevious:false, hasNext:false, empty:true };
    const max = Math.max(0, Math.floor((all.length - 1) / size) * size);
    const start = Math.max(0, Math.min(max, Number(offset) || 0));
    const tickers = all.slice(start, start + size);
    return { tickers, chartCount:chartCountForSize(tickers.length), offset:start, totalItems:all.length, hasPrevious:start>0, hasNext:start<max, empty:false };
  }
  function familyOptions(scene) { return (FAMILIES[normalizeScene(scene)] || []).slice(); }
  function familyBasket(scene, id) { return familyOptions(scene).find((x) => x.id === id) || familyOptions(scene)[0] || null; }

  /* A COHORT IS ITS MEMBERS, NOT ITS FAVOURITED MEMBERS.
     The previous builder intersected every cohort with hub_favorites, so choosing
     AI_SOFTWARE or MEGACAP showed at most the favorites you already had — usually a subset
     of the same favorites rows, sometimes nothing — and never the cohort. Filed defect,
     ruled: a chosen cohort's rows REPLACE the favorites rows. Favorites remain reachable as
     the explicit FAV entry (the default view), in their added order; every cohort carries
     its full membership, sorted. */
  function buildCohortIndex(membershipGroups, favoriteRows) {
    const byCohort = new Map();
    for (const rows of membershipGroups || []) {
      for (const row of rows || []) {
        const ticker = String(row?.ticker || "").toUpperCase();
        const cohort = String(row?.cohort || "").toUpperCase();
        if (!ticker || !cohort) continue;
        if (!byCohort.has(cohort)) byCohort.set(cohort, new Set());
        byCohort.get(cohort).add(ticker);
      }
    }
    const index = new Map();
    const favorites = (favoriteRows || []).map((row) => String(row?.ticker || "").toUpperCase()).filter(Boolean);
    index.set("FAV", Array.from(new Set(favorites)));
    for (const [cohort, tickers] of Array.from(byCohort).sort((a, b) => a[0].localeCompare(b[0])))
      index.set(cohort, Array.from(tickers).sort());
    return index;
  }

  function cohortPage(index, cohort, requestedPage, pageSize) {
    const key = String(cohort || "").toUpperCase();
    const all = (index?.get(key) || []).slice();
    const requested = Math.max(1, Math.min(6, Number(pageSize) || 6));
    const size = requested === 6 && all.length > 3 && all.length < 6 ? 2 : requested;
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
    SCREENS,
    ROTATION_IDS,
    PRESETS,
    normalizeScene,
    chartCountForSize,
    usesPairedColumnAxis,
    hidesTopChartAxis,
    nextRotatingScene,
    screenForScene,
    nextScreen,
    previousScreen,
    indexNowLeaders,
    indexNowTickersFor,
    FAMILIES,
    familyOptions,
    familyBasket,
    basketWindow,
    buildCohortIndex,
    cohortPage
  });
})(typeof globalThis === "object" ? globalThis : window);
