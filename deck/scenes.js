(function (root) {
  "use strict";

  const NIGHT_OPEN_HOUR_NY = 8;
  const NIGHT_CLOSE_HOUR_NY = 18;
  const SESSION_ZONE = "America/New_York";
  const OVERNIGHT_FLEX_DEFAULT = "FLEX3";

  const IDS = [
    "live", "overnight", "indexes", "company", "macro_short",
    "macro_long", "sectors", "themes", "custom"
  ];

  const SCENES = Object.freeze({
    live: Object.freeze({ label:"LIVE", kind:"working", horizon:"working", session:"any" }),
    overnight: Object.freeze({ label:"OVERNIGHT", kind:"basket", horizon:"fast-short", session:"overnight" }),
    indexes: Object.freeze({ label:"INDEX LEADERSHIP", kind:"basket", horizon:"fast-short", session:"regular" }),
    company: Object.freeze({ label:"COMPANY LEADERSHIP", kind:"placeholder", horizon:"fast-short", session:"regular" }),
    macro_short: Object.freeze({ label:"MACRO SHORT", kind:"placeholder", horizon:"fast-short", session:"any" }),
    macro_long: Object.freeze({ label:"MACRO LONG", kind:"placeholder", horizon:"slow-long", session:"any" }),
    sectors: Object.freeze({ label:"SECTORS", kind:"family", horizon:"medium", session:"regular" }),
    themes: Object.freeze({ label:"THEMES", kind:"family", horizon:"medium", session:"regular" }),
    custom: Object.freeze({ label:"CUSTOM", kind:"working", horizon:"working", session:"any" })
  });

  const PRESETS = Object.freeze({
    overnight: Object.freeze({
      label: "OVERNIGHT",
      tickers: Object.freeze(["ESUSD", "NQUSD", OVERNIGHT_FLEX_DEFAULT]),
      chartCount: 3,
      range: "15m"
    }),
    indexes: Object.freeze({
      label: "INDEX LEADERSHIP",
      tickers: Object.freeze(["SPY", "QQQ", "IWM", "MAGS", "SMH", "DIA"]),
      chartCount: 6,
      range: "1D"
    })
  });

  /* Reviewed family order only. Raw backend cohort keys never become primary
     navigation automatically; a family appears only when it is both listed
     here and has real favorite-backed coverage. */
  const FAMILY_GROUPS = Object.freeze({
    sectors: Object.freeze([
      "TECH", "COMMS", "DISCRET", "ENERGY", "FINANCIALS", "HEALTH",
      "INDUSTRIAL", "MATERIALS", "REAL_ESTATE", "STAPLES", "UTILITIES"
    ]),
    themes: Object.freeze([
      "AI_HARDWARE", "AI_SOFTWARE", "MEGACAP", "BLUE_CHIP", "GROWTH",
      "CRYPTO", "INTL", "THEMATIC", "METALS"
    ])
  });

  const LEGACY_SCENES = Object.freeze({ cohort:"themes" });

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

  function overnightLeaders(at) {
    const hour = nyHourNow(at);
    return hour >= NIGHT_OPEN_HOUR_NY && hour < NIGHT_CLOSE_HOUR_NY ?
      Object.freeze(["SPY", "QQQ"]) :
      Object.freeze(["ESUSD", "NQUSD"]);
  }

  function overnightTickersFor(at, flexSymbol) {
    const flex = String(flexSymbol || OVERNIGHT_FLEX_DEFAULT).toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12) || OVERNIGHT_FLEX_DEFAULT;
    const leaders = overnightLeaders(at);
    return Object.freeze([leaders[0], leaders[1], flex]);
  }
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
    const requested = chartCountForSize(requestedCount || 6);
    const maxOffset = Math.max(0, all.length - 1);
    const offset = Math.max(0, Math.min(maxOffset, Number(requestedOffset) || 0));
    const tickers = all.slice(offset, offset + requested);
    const end = tickers.length ? offset + tickers.length : 0;
    return {
      offset,
      requestedCount: requested,
      chartCount: chartCountForSize(tickers.length),
      totalItems: all.length,
      start: tickers.length ? offset + 1 : 0,
      end,
      hasPrevious: offset > 0,
      hasNext: end < all.length,
      tickers,
      empty: all.length === 0
    };
  }

  /* Kept as a compatibility helper for old tests/deep links. New UI state is
     offset-based so changing display count never abandons or skips a basket. */
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
    overnightTickersFor,
    overnightLeaders,
    buildCohortFavorites,
    curatedFamilies,
    basketWindow,
    cohortPage
  });
})(typeof globalThis === "object" ? globalThis : window);
