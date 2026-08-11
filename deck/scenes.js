(function (root) {
  "use strict";

  const NIGHT_OPEN_HOUR_NY = 8;
  const NIGHT_CLOSE_HOUR_NY = 18;
  const SESSION_ZONE = "America/New_York";
  const INDEX_NOW_FLEX_DEFAULT = "FLEX3";

  const IDS = [
    "live", "indexNow", "indexLeadership", "companyLeadership", "focus2",
    "macroCrossAsset", "internalsFast", "internalsSlow", "sectorFamilies",
    "themeFamilies", "custom"
  ];

  const SCENES = Object.freeze({
    live: Object.freeze({ label:"LIVE", kind:"working", horizon:"working", session:"any" }),
    indexNow: Object.freeze({ label:"INDEX NOW", kind:"basket", horizon:"fast-short", session:"regular" }),
    indexLeadership: Object.freeze({ label:"INDEX LEADERSHIP", kind:"basket", horizon:"fast-short", session:"regular" }),
    companyLeadership: Object.freeze({ label:"COMPANY LEADERSHIP", kind:"placeholder", horizon:"fast-short", session:"regular" }),
    focus2: Object.freeze({ label:"FOCUS 2", kind:"working", horizon:"fast-short", session:"regular" }),
    macroCrossAsset: Object.freeze({ label:"MACRO CROSS-ASSET", kind:"placeholder", horizon:"fast-short", session:"any" }),
    internalsFast: Object.freeze({ label:"INTERNALS FAST", kind:"placeholder", horizon:"fast-short", session:"any" }),
    internalsSlow: Object.freeze({ label:"INTERNALS SLOW", kind:"placeholder", horizon:"slow-long", session:"any" }),
    sectorFamilies: Object.freeze({ label:"SECTOR FAMILIES", kind:"family", horizon:"medium", session:"regular" }),
    themeFamilies: Object.freeze({ label:"THEME FAMILIES", kind:"family", horizon:"medium", session:"regular" }),
    custom: Object.freeze({ label:"CUSTOM", kind:"working", horizon:"working", session:"any" })
  });

  const PRESETS = Object.freeze({
    indexNow: Object.freeze({
      label: "INDEX NOW",
      tickers: Object.freeze(["ESUSD", "NQUSD", INDEX_NOW_FLEX_DEFAULT]),
      chartCount: 3,
      range: "15m"
    }),
    indexLeadership: Object.freeze({
      label: "INDEX LEADERSHIP",
      tickers: Object.freeze(["SPY", "QQQ", "IWM", "MAGS", "SMH", "DIA"]),
      chartCount: 6,
      range: "1D"
    }),
    focus2: Object.freeze({
      label: "FOCUS 2",
      tickers: Object.freeze(["SPY", "QQQ"]),
      chartCount: 2,
      range: "1D"
    })
  });

  /* Reviewed family order only. Raw backend cohort keys never become primary
     navigation automatically; a family appears only when it is both listed
     here and has real favorite-backed coverage. */
  const FAMILY_GROUPS = Object.freeze({
    sectorFamilies: Object.freeze([
      "TECH", "COMMS", "DISCRET", "ENERGY", "FINANCIALS", "HEALTH",
      "INDUSTRIAL", "MATERIALS", "REAL_ESTATE", "STAPLES", "UTILITIES"
    ]),
    themeFamilies: Object.freeze([
      "AI_HARDWARE", "AI_SOFTWARE", "MEGACAP", "BLUE_CHIP", "GROWTH",
      "CRYPTO", "INTL", "THEMATIC", "METALS"
    ])
  });

  const LEGACY_SCENES = Object.freeze({
    overnight: "indexNow",
    indexes: "indexLeadership",
    company: "companyLeadership",
    macro_short: "macroCrossAsset",
    macro_long: "macroCrossAsset",
    sectors: "sectorFamilies",
    themes: "themeFamilies",
    cohort: "themeFamilies"
  });

  function nyHourNow(at, zone = SESSION_ZONE) {
    const d = at instanceof Date ? at : new Date(at);
    if (Number.isNaN(d.getTime())) return new Date().getHours();
    try {
      const s = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "2-digit", hour12: false }).format(d);
      return Number(s);
    } catch (_) {
      return d.getHours();
    }
  }

  function indexNowLeaders(at) {
    const hour = nyHourNow(at);
    return hour >= NIGHT_OPEN_HOUR_NY && hour < NIGHT_CLOSE_HOUR_NY ?
      Object.freeze(["SPY", "QQQ"]) :
      Object.freeze(["ESUSD", "NQUSD"]);
  }

  function sanitizeTickerSymbol(value) {
    return String(value || INDEX_NOW_FLEX_DEFAULT).toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12) || INDEX_NOW_FLEX_DEFAULT;
  }

  function indexNowTickersFor(at, flexSymbol) {
    const flex = sanitizeTickerSymbol(flexSymbol);
    const leaders = indexNowLeaders(at);
    return Object.freeze([leaders[0], leaders[1], flex]);
  }

  // Backward-compatible names kept for legacy callers.
  const overnightLeaders = indexNowLeaders;
  const overnightTickersFor = indexNowTickersFor;

  const normalizeScene = (value) => {
    const candidate = LEGACY_SCENES[value] || value;
    return IDS.includes(candidate) ? candidate : "live";
  };

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

  function curatedFamilies(index, scene) {
    const allowed = FAMILY_GROUPS[normalizeScene(scene)] || [];
    return allowed.filter((family) => (index?.get(family) || []).length > 0);
  }

  function basketWindow(members, requestedOffset, requestedCount) {
    const all = (members || []).slice();
    const requested = Math.max(1, chartCountForSize(requestedCount || 6));
    if (!all.length) {
      return {
        offset: 0,
        requestedCount: requested,
        chartCount: 1,
        totalItems: 0,
        start: 0,
        end: 0,
        hasPrevious: false,
        hasNext: false,
        tickers: [],
        empty: true
      };
    }

    const maxOffset = Math.max(0, Math.floor((all.length - 1) / requested) * requested);
    const offset = Math.max(0, Math.min(maxOffset, Number(requestedOffset) || 0));
    const tickers = all.slice(offset, offset + requested);
    return {
      offset,
      requestedCount: requested,
      chartCount: chartCountForSize(tickers.length),
      totalItems: all.length,
      start: tickers.length ? offset + 1 : 0,
      end: tickers.length ? offset + tickers.length : 0,
      hasPrevious: offset > 0,
      hasNext: offset < maxOffset,
      tickers,
      empty: false
    };
  }

  function cohortPage(index, cohort, requestedPage, pageSize) {
    const size = chartCountForSize(pageSize || 6);
    const key = String(cohort || "").toUpperCase();
    const all = (index?.get(key) || []).slice();
    const totalPages = Math.max(1, Math.ceil(all.length / size));
    const page = Math.max(0, Math.min(totalPages - 1, Number(requestedPage) || 0));
    const visible = basketWindow(all, page * size, size);
    return Object.assign({ cohort:key, page, totalPages }, visible);
  }

  root.StationScenes = Object.freeze({
    IDS: Object.freeze(IDS.slice()),
    SCENES,
    PRESETS,
    FAMILY_GROUPS,
    normalizeScene,
    chartCountForSize,
    indexNowTickersFor,
    indexNowLeaders,
    overnightTickersFor,
    overnightLeaders,
    buildCohortFavorites,
    curatedFamilies,
    basketWindow,
    cohortPage
  });
})(typeof globalThis === "object" ? globalThis : window);
