(function (root) {
  "use strict";

  /* "cohort" is a first-class scene again, by filed ruling: choosing a cohort must show the
     COHORT'S rows, replacing the favorites rows — it may not be collapsed into a family
     preset, and it may not be filtered down to whichever members happen to be favorited. */
  const TV_IDS = ["tvMacro","tvIndexes","tvSectors","tvHome6","tvPage2","tvPage3","tvOtherLC","tvOtherSC","tvBlueChip","tvExtras"];
  const WORKBENCH_IDS = ["oscWorkbench"];
  const IDS = ["live","indexNow","indexLeadership","companyLeadership","focus2","macroCrossAsset","internalsFast","internalsSlow","sectorFamilies","themeFamilies"]
    .concat(TV_IDS, WORKBENCH_IDS, ["cohort","custom"]);
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
    Object.freeze({ id:"themeFamilies", scene:"themeFamilies", label:"THEME FAMILIES" }),
    /* ── ALAN'S OWN TRADINGVIEW LAYOUTS, in his order, as Station pages ───────────
       23 Sep: "the TV dynamic needs to come to Station, to free up the space of
       Chrome." Same names, same order, same chart counts, same tickers. */
    Object.freeze({ id:"tvMacro", scene:"tvMacro", label:"MACRO" }),
    Object.freeze({ id:"tvIndexes", scene:"tvIndexes", label:"INDEXES" }),
    Object.freeze({ id:"tvSectors", scene:"tvSectors", label:"SECTORS" }),
    Object.freeze({ id:"tvHome6", scene:"tvHome6", label:"HOME 6" }),
    Object.freeze({ id:"tvPage2", scene:"tvPage2", label:"PAGE 2" }),
    Object.freeze({ id:"tvPage3", scene:"tvPage3", label:"PAGE 3" }),
    Object.freeze({ id:"tvOtherLC", scene:"tvOtherLC", label:"OTHER LC" }),
    Object.freeze({ id:"tvOtherSC", scene:"tvOtherSC", label:"OTHER SC" }),
    Object.freeze({ id:"tvBlueChip", scene:"tvBlueChip", label:"BLUE CHIP" }),
    Object.freeze({ id:"tvExtras", scene:"tvExtras", label:"EXTRAS" }),
    Object.freeze({ id:"oscWorkbench", scene:"oscWorkbench", label:"WORKBENCH" })
  ]);
  /* ROTATION IS NOT THE PAGE LIST. Auto-rotate keeps cycling the nine curated
     screens it always cycled; Alan's own layouts are pages you go to, not a
     slideshow he did not ask for. The arrows, the rail and the jump list walk
     every page in SCREENS. */
  const ROTATION_SCENES = Object.freeze(["indexNow","indexLeadership","companyLeadership","focus2","macroCrossAsset","internalsFast","internalsSlow","sectorFamilies","themeFamilies"]);
  const ROTATION_IDS = ROTATION_SCENES;
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
    internalsSlow: Object.freeze({ label:"INTERNALS SLOW", tickers:Object.freeze(["TICK","TRIN"]), chartCount:2, range:"1D" }),
    /* ── THE TWELVE SAVED TRADINGVIEW LAYOUTS ────────────────────────────────────
       TradingView spellings are translated to the symbols the chart API serves —
       USOIL → CLUSD, GOLD → GCUSD, TSX:BOFA → BAC — and nothing else is renamed.
       IGV (INDEXES) and NVTS (EXTRAS) are not in the provider's tracked universe
       today: their slots paint the provider's named absence instead of quietly
       disappearing, and they light up the day the universe carries them.
       `exact:true` means the page shows ITS OWN rows at ITS OWN size: a saved
       layout is a picture, and pictures are not paged into twos. */
    tvMacro: Object.freeze({ label:"MACRO", tickers:Object.freeze(["VIX","US10Y","CLUSD","BTCUSD","GCUSD","PCC"]), chartCount:6, range:"1D", exact:true }),
    tvIndexes: Object.freeze({ label:"INDEXES", tickers:Object.freeze(["MAGS","SMH","IWM","DRAM","IGV"]), chartCount:6, range:"1D", exact:true }),
    tvSectors: Object.freeze({ label:"SECTORS", tickers:Object.freeze(["XLV","XLY","XLF","XLP","XLE","XLI","XLC","XLB"]), chartCount:8, range:"1D", exact:true }),
    tvHome6: Object.freeze({ label:"HOME 6", tickers:Object.freeze(["SPY","QQQ","NVDA","BE","MU","NBIS"]), chartCount:6, range:"3h", exact:true }),
    tvPage2: Object.freeze({ label:"PAGE 2", tickers:Object.freeze(["TSM","SNDK","GOOGL","IREN","AVGO","CRWV"]), chartCount:6, range:"3h", exact:true }),
    tvPage3: Object.freeze({ label:"PAGE 3", tickers:Object.freeze(["AAPL","LRCX","AMZN","AMD","MSFT","META"]), chartCount:6, range:"3h", exact:true }),
    tvOtherLC: Object.freeze({ label:"OTHER LC", tickers:Object.freeze(["ASML","META","PLTR","ORCL","SPCX","HOOD","TSLA","SHOP"]), chartCount:8, range:"1D", exact:true }),
    tvOtherSC: Object.freeze({ label:"OTHER SC", tickers:Object.freeze(["ALAB","WULF","CRDO","SMR","SMCI","OKLO","ASTS","USAR"]), chartCount:8, range:"1D", exact:true }),
    tvBlueChip: Object.freeze({ label:"BLUE CHIP", tickers:Object.freeze(["WMT","JPM","COST","BAC","CAT","MRVL"]), chartCount:6, range:"1D", exact:true }),
    tvExtras: Object.freeze({ label:"EXTRAS", tickers:Object.freeze(["MRVL","NVTS"]), chartCount:2, range:"1D", exact:true })
  });

  /* ── A WORKBENCH IS A PAGE TYPE, NOT A ONE-OFF PAGE ──────────────────────────────
     Alan, 23 Sep: "The oscillator workbench… copies with different charts… new
     versions coming later tonight or tomorrow to pull into Station — so we should be
     ready for that type of layout situation."
     So a workbench is DATA: N charts, each one a symbol plus a NAMED study stack,
     and optionally its own timeframe, because the point of a workbench is the same
     name seen several ways. Tomorrow's layout is a new entry here, not new code.
     The stacks are the Station's own indicators — the cloud ribbon (13D/21D EMA,
     50D/200D SMA) and its two extra levels — never a TradingView drawing we cannot
     read back. */
  const STUDY_STACKS = Object.freeze({
    PRICE: Object.freeze({ label:"price only", clouds:false }),
    CLOUDS: Object.freeze({ label:"cloud ribbon", clouds:true }),
    OSCILLATOR: Object.freeze({ label:"ribbon + 8D EMA + 100D SMA", clouds:true, ema8:true, sma100:true }),
    STEPPED: Object.freeze({ label:"ribbon, stepped exactly", clouds:true, steps:true })
  });
  const WORKBENCHES = Object.freeze({
    oscWorkbench: Object.freeze({
      label: "OSCILLATOR WORKBENCH",
      range: "1D",
      charts: Object.freeze([
        Object.freeze({ ticker:"MU", stack:"OSCILLATOR" }),
        Object.freeze({ ticker:"QQQ", stack:"OSCILLATOR" })
      ])
    })
  });
  function workbenchFor(scene) { return WORKBENCHES[normalizeScene(scene)] || null; }
  function isWorkbenchScene(scene) { return !!workbenchFor(scene); }
  function studyStack(name) { return STUDY_STACKS[String(name || "").toUpperCase()] || null; }
  /* The chart pane already reads every one of these from its own URL. A stack is
     spelled out in full — clouds=0 as loudly as clouds=1 — so a pane never inherits
     the wall's switch and quietly becomes a different study than the page declares. */
  function studyQuery(name) {
    const stack = studyStack(name);
    if (!stack) return "";
    const parts = ["clouds=" + (stack.clouds ? "1" : "0")];
    if (stack.ema8) parts.push("ema8=1");
    if (stack.sma100) parts.push("sma100=1");
    if (stack.steps) parts.push("steps=1");
    return "&" + parts.join("&");
  }
  function workbenchState(scene) {
    const bench = workbenchFor(scene);
    if (!bench) return null;
    const charts = bench.charts.slice(0, 8);
    return {
      label: bench.label,
      workbench: normalizeScene(scene),
      tickers: charts.map((c) => c.ticker),
      stacks: charts.map((c) => studyStack(c.stack) ? String(c.stack).toUpperCase() : "CLOUDS"),
      /* A per-chart timeframe is an OPT-IN override: absent, the pane follows the one
         timeframe bar that drives the whole wall, exactly like every other page. */
      ranges: charts.map((c) => c.range || null),
      chartCount: chartCountForSize(charts.length),
      range: bench.range || "1D",
      offset: 0, totalItems: charts.length, hasPrevious: false, hasNext: false, empty: !charts.length
    };
  }
  /* A SAVED LAYOUT SHOWS ITS OWN ROWS. basketWindow pages a four/five-name basket
     into twos, which is right for a cohort and wrong for a picture Alan saved: his
     INDEXES layout is five names in a six-up wall, and it must stay five names in a
     six-up wall with one empty slot, not two names with a pager. */
  function exactPage(preset) {
    const tickers = (preset?.tickers || []).slice(0, 8);
    return { tickers, chartCount: chartCountForSize(preset?.chartCount || tickers.length),
      offset: 0, totalItems: tickers.length, hasPrevious: false, hasNext: false, empty: !tickers.length };
  }

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
  /* A top chart borrows the time axis of the chart below it. When the caller
     passes the slots and the one below is an empty "choose a symbol" slot,
     there is no axis to borrow, so the top chart keeps its own. */
  function hidesTopChartAxis(index, size, charts) {
    const count = chartCountForSize(size);
    const top = usesPairedColumnAxis(count) && Number(index) >= 0 && Number(index) < count / 2;
    if (!top || !Array.isArray(charts)) return top;
    return !!charts[Number(index) + count / 2];
  }
  function nextRotatingScene(scene) {
    const index = ROTATION_IDS.indexOf(normalizeScene(scene));
    return ROTATION_IDS[(index + 1 + ROTATION_IDS.length) % ROTATION_IDS.length];
  }
  function screenForScene(scene) {
    return SCREENS.find((screen) => screen.scene === normalizeScene(scene)) || null;
  }
  /* Auto-rotate walks the curated nine; the arrows and the rail walk every page. */
  function nextRotatingScreen(scene) {
    const current = normalizeScene(scene);
    const order = ROTATION_SCENES;
    const index = order.indexOf(current);
    const next = order[(index + 1 + order.length) % order.length];
    return screenForScene(next) || SCREENS[0];
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

  /* ── ONE MOVE TO ANYWHERE ────────────────────────────────────────────────────────
     Alan: "I'm trying to get to the PCC and it's not particularly nice."
     So the jump list matches a page by its NAME *and* by the tickers on it: typing
     PCC finds MACRO and INTERNALS FAST, typing MAC finds MACRO and MACRO CROSS-ASSET.
     Matching happens here, in the model, so it is testable without a browser. */
  function pageTickers(scene) {
    const id = normalizeScene(scene);
    const bench = workbenchFor(id);
    if (bench) return bench.charts.map((c) => c.ticker);
    if (id === "indexNow") return indexNowTickersFor(new Date()).slice();
    const families = FAMILIES[id];
    if (families) return families.reduce((all, f) => all.concat(f.tickers), []);
    return (PRESETS[id]?.tickers || []).slice();
  }
  function findPages(query) {
    const q = String(query || "").trim().toUpperCase();
    if (!q) return SCREENS.map((screen) => ({ screen, why:"" }));
    const out = [];
    for (const screen of SCREENS) {
      if (screen.label.toUpperCase().includes(q)) { out.push({ screen, why:"" }); continue; }
      const hit = pageTickers(screen.scene).find((t) => t.toUpperCase().startsWith(q));
      if (hit) out.push({ screen, why:hit });
    }
    return out;
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
    cohortPage,
    TV_IDS: Object.freeze(TV_IDS.slice()),
    WORKBENCH_IDS: Object.freeze(WORKBENCH_IDS.slice()),
    ROTATION_SCENES,
    nextRotatingScreen,
    STUDY_STACKS,
    WORKBENCHES,
    workbenchFor,
    isWorkbenchScene,
    studyStack,
    studyQuery,
    workbenchState,
    exactPage,
    pageTickers,
    findPages
  });
})(typeof globalThis === "object" ? globalThis : window);
