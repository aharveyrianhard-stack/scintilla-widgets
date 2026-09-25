(function (root) {
  "use strict";

  /* "cohort" is a first-class scene again, by filed ruling: choosing a cohort must show the
     COHORT'S rows, replacing the favorites rows — it may not be collapsed into a family
     preset, and it may not be filtered down to whichever members happen to be favorited. */
  const TV_IDS = ["tvMacro","tvIndexes","tvSectors","tvHome6","tvPage2","tvPage3","tvOtherLC","tvOtherSC","tvBlueChip","tvExtras"];
  /* 25 Sep, later: the HISTORY page is gone - Alan did not mean a page. The chart pane's ?bars=
     request and the deck's SLOT_BARS plumbing stay (harmless, tested); nothing asks for them now. */
  const WORKBENCH_IDS = ["oscWorkbench"];
  /* ── ALAN'S CHARTING WORKFLOW, read 25 Sep 2026 (K3 / SCI-K3-002) ────────────────
     Nineteen pages in a fixed order (twenty-two since 25 Sep: an RSI page after each of
     SPY + QQQ · DAY, OTHER INDEXES · DAY and TARGETS · DAY), replacing both the old curated auto-rotation and
     the twelve saved TradingView layouts (whose ids remain in LEGACY so a browser that
     remembered one lands on the page that now carries its names). Three slot kinds:
       · a fixed ticker list (TradingView spellings translated: DXY→DXUSD, GOLD→GCUSD,
         USOIL→CLUSD; HUT, IGV and NVTS are not in the provider's universe today and
         their slots paint the provider's named absence, exactly as IGV/NVTS already
         did on the old INDEXES/EXTRAS pages);
       · TARGETS — Alan's eight names, shared by every Station window. The deck reads
         public.station_targets at load and every five minutes; when the read fails or
         is empty the model's TARGETS_DEFAULT stands in;
       · LEADERS — SPY/QQQ in the market session, ESUSD/NQUSD in the other three.
     Pages whose slots say "rotate" show a different window of their list on every
     visit; the visit counter lives in the deck. Which pages rotate depends on the
     session (two since 25 Sep, DAY and NIGHT — see stationSession and rotationScenesAt). */
  const TARGETS_DEFAULT = Object.freeze(["GOOGL","NBIS","AVGO","BE","AMZN","VST","MU","WMT"]);
  const MACRO_4H = Object.freeze(["VIX","CLUSD","US10Y","DXUSD","GCUSD","BTCUSD"]);
  const WORKFLOW_PAGES = Object.freeze({
    wkIndexes:       Object.freeze({ label:"INDEXES · WEEK",      short:"INDEXES WK",  range:"1W", tickers:Object.freeze(["SPY","DIA","QQQ","MAGS","SMH","IWM","DRAM","IGV"]) }),
    wkMacro:         Object.freeze({ label:"MACRO · WEEK",        short:"MACRO WK",    range:"1W", tickers:Object.freeze(["VIX","DXUSD","US10Y","GCUSD","CLUSD","BTCUSD"]) }),
    targets3D:       Object.freeze({ label:"TARGETS",             range:"3D", targets:true }),
    /* 25 Sep, Alan, later: "there is sectors that are more important in market cap, way more
       important. I don't know if I would rotate all of them." So his six stay on screen in slots
       1–6 on every visit, and only the other five State Street sectors rotate, two at a time,
       through slots 7–8: an eight-chart page. */
    sectors3D:       Object.freeze({ label:"SECTORS",             range:"3D", tickers:Object.freeze(["XLK","XLI","XLC","XLF","XLY","XLE"]), rotate:Object.freeze({ list:Object.freeze(["XLP","XLV","XLU","XLRE","XLB"]), size:2 }) }),
    mainIndexes3D:   Object.freeze({ label:"SPY + QQQ",           range:"3D", leaders:true }),
    mag7:            Object.freeze({ label:"MAG 7",               range:"3D", tickers:Object.freeze(["MAGS","MSFT","NVDA","AMZN","AAPL","META","GOOGL","TSLA"]) }),
    /* 25 Sep, Alan on the AI pages: "don't go by the names of the layouts, I made a mega mess…
       WULF and CRDO don't need to be twice; NBIS and IREN need to be somewhere permanent…
       OK I like your split" - so three branches of the tree, no name twice, LRCX and WDC in:
       chips & equipment · memory, racks & optics · power & neoclouds. SOXX (a fund) and
       CDNS (design software) fell out; NBIS and IREN are permanent on AI 3. */
    ai1:             Object.freeze({ label:"AI 1 · CHIPS",        short:"AI 1 CHIPS", range:"3D", tickers:Object.freeze(["TSM","ASML","AVGO","AMD","MU","AMAT","LRCX","ARM"]) }),
    ai2:             Object.freeze({ label:"AI 2 · MEMORY, RACKS", short:"AI 2 RACKS", range:"3D", tickers:Object.freeze(["SNDK","WDC","MRVL","ALAB","CRDO","SMCI","SIMO","NVTS"]) }),
    ai3:             Object.freeze({ label:"AI 3 · POWER, CLOUDS", short:"AI 3 POWER", range:"3D", tickers:Object.freeze(["NBIS","CRWV","IREN","CIFR","WULF","HUT","OKLO","BE"]) }),
    other3D:         Object.freeze({ label:"OTHER",               range:"3D", tickers:Object.freeze(["ORCL","SPCX","PLTR","OKLO","SHOP","USAR","HOOD","MSTR"]) }),
    blueChip3D:      Object.freeze({ label:"BLUE CHIP",           range:"3D", tickers:Object.freeze(["WMT","JPM","CAT","BAC","HD","MCD","COST","WM"]) }),
    spyQqq1D:        Object.freeze({ label:"SPY + QQQ · DAY",     short:"SPY+QQQ DAY", range:"1D", leaders:true }),
    /* 25 Sep, Alan: "you do have the RSI." Each oscillator page follows its price twin: the same
       names on the same daily bars, with the Lab's locked-timeframe RSI fan under every price.
       SPY and QQQ stay SPY and QQQ after hours - the fan reads their own sessions' bars. */
    spyQqqOsc:       Object.freeze({ label:"SPY + QQQ · RSI",     short:"SPY+QQQ RSI", range:"1D", study:"RSI", tickers:Object.freeze(["SPY","QQQ"]) }),
    otherIndexes1D:  Object.freeze({ label:"OTHER INDEXES · DAY", short:"INDEXES DAY", range:"1D", tickers:Object.freeze(["SMH","DIA","DRAM","MAGS","IWM","IGV"]) }),
    otherIndexesOsc: Object.freeze({ label:"OTHER INDEXES · RSI", short:"INDEXES RSI", range:"1D", study:"RSI", tickers:Object.freeze(["SMH","DIA","DRAM","MAGS","IWM","IGV"]) }),
    macro1D:         Object.freeze({ label:"MACRO · DAY",         short:"MACRO DAY",   range:"1D", tickers:Object.freeze(["VIX","DXUSD","US10Y","GCUSD","CLUSD","BTCUSD"]) }),
    targets1D:       Object.freeze({ label:"TARGETS · DAY",       short:"TARGETS DAY", range:"1D", targets:true }),
    targetsOsc:      Object.freeze({ label:"TARGETS · RSI",       short:"TARGETS RSI", range:"1D", study:"RSI", targets:true }),
    macroIntraday:   Object.freeze({ label:"MACRO · 4H",          range:"4h", rotate:Object.freeze({ list:MACRO_4H, size:3 }), tail:Object.freeze(["PCC"]) }),
    intraday4h:      Object.freeze({ label:"INTRADAY · 4H",       short:"INTRA · 4H",  range:"4h", leaders:true, rotateTargets:Object.freeze({ size:4 }) }),
    intraday1h:      Object.freeze({ label:"INTRADAY · 1H",       short:"INTRA · 1H",  range:"1h", leaders:true, leaderWindow:true, rotateTargets:Object.freeze({ size:3 }) }),
    intraday30m:     Object.freeze({ label:"INTRADAY · 30M",      short:"INTRA · 30M", range:"30m", leaders:true, leaderWindow:true, rotateTargets:Object.freeze({ size:1 }) })
  });
  const WORKFLOW_IDS = Object.freeze(Object.keys(WORKFLOW_PAGES));
  /* The intraday four (workflow pages 16–19) rotate in the three sessions when something trades
     on an intraday clock - pre-market, market and after-market - and leave it overnight. */
  const INTRADAY_PAGES = Object.freeze(["macroIntraday","intraday4h","intraday1h","intraday30m"]);
  /* The two weekly pages are the overnight lap's own ("shifting the weekly views to the
     post-market view completely", 25 Sep; overnight is where that lap now lives). Every page
     stays in the menu whatever the session. */
  const WEEKLY_PAGES = Object.freeze(["wkIndexes","wkMacro"]);
  const OLD_CURATED_IDS = ["indexNow","indexLeadership","companyLeadership","focus2","macroCrossAsset","internalsFast","sectorFamilies","themeFamilies"];
  const IDS = ["live"].concat(WORKFLOW_IDS, ["scintillas"], WORKBENCH_IDS, OLD_CURATED_IDS, ["todo","scratch","cohort","custom"]);
  /* Every curated named scene is independently navigable.  LIVE and CUSTOM
     remain manual workspaces so arrowing/rotation never replaces a live or
     in-progress custom wall. */
  const SCREENS = Object.freeze(
    WORKFLOW_IDS.map((id) => {
      const page = WORKFLOW_PAGES[id];
      /* A RAIL BUTTON IS 81 px, ABOUT ELEVEN CHARACTERS: pages whose full label is longer
         carry a short name for the rail; the full label stays on the tooltip and menu. */
      return Object.freeze(page.short ? { id, scene:id, label:page.label, short:page.short }
        : { id, scene:id, label:page.label });
    })
    .concat([
      Object.freeze({ id:"scintillas", scene:"scintillas", label:"SCINTILLAS" }),
      Object.freeze({ id:"oscWorkbench", scene:"oscWorkbench", label:"WORKBENCH" }),
      Object.freeze({ id:"indexNow", scene:"indexNow", label:"INDEX NOW" , short:"INDEX NOW"}),
      Object.freeze({ id:"indexLeadership", scene:"indexLeadership", label:"INDEX LEADERSHIP" , short:"INDEX LEAD"}),
      Object.freeze({ id:"companyLeadership", scene:"companyLeadership", label:"COMPANY LEADERSHIP" , short:"COMPANY LD"}),
      Object.freeze({ id:"focus2", scene:"focus2", label:"FOCUS 2" , short:"FOCUS 2"}),
      Object.freeze({ id:"macroCrossAsset", scene:"macroCrossAsset", label:"MACRO CROSS-ASSET" , short:"MACRO X-A"}),
      Object.freeze({ id:"internalsFast", scene:"internalsFast", label:"INTERNALS" , short:"INTERNALS"}),
      Object.freeze({ id:"sectorFamilies", scene:"sectorFamilies", label:"SECTOR FAMILIES" , short:"SECTOR FAM"}),
      Object.freeze({ id:"themeFamilies", scene:"themeFamilies", label:"THEME FAMILIES" , short:"THEME FAM"}),
      Object.freeze({ id:"todo", scene:"todo", label:"TO-DO" , short:"TO-DO"}),
      Object.freeze({ id:"scratch", scene:"scratch", label:"SCRATCH" , short:"SCRATCH"})
    ])
  );
  /* ROTATION IS ALAN'S WORKFLOW (25 Sep): the nineteen workflow pages in his order.
     The eight old curated pages stay in SCREENS — menu, rail and arrows still reach
     them — but they are no longer rotated. TO-DO and SCRATCH were never rotated. */
const ROTATION_SCENES = Object.freeze(WORKFLOW_IDS.slice());
  const ROTATION_IDS = ROTATION_SCENES;
  /* A RAIL BUTTON IS 81 px WIDE, WHICH IS ABOUT ELEVEN CHARACTERS. Two pages that both
     truncate to "INTERNALS …" are two buttons nobody can tell apart, so every page carries
     a short name for the rail; the full name stays on the button's tooltip, in the scene
     menu and in the jump list. */
  function shortLabel(screen) { return (screen && (screen.short || screen.label)) || ""; }
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
    /* VIX and PCC are Scintilla's own series, drawn from the chart API with the cloud
       ribbon like any other chart. They keep this page; the four TradingView pictures
       moved to TO-DO on 24 Sep. */
    internalsFast: Object.freeze({ label:"INTERNALS", tickers:Object.freeze(["VIX","PCC"]), chartCount:2, range:"3h" }),
    /* SCINTILLAS carries no tickers of its own: the store decides them, session by session. */
    scintillas: Object.freeze({ label:"SCINTILLAS", tickers:Object.freeze([]), chartCount:6, range:"1D", filled:"scintillas" }),
    /* TO-DO's rows come from TODO_CHARTS below, because each one carries a reason and,
       for the two that were INTERNALS SLOW, its own timeframe. */
    todo: Object.freeze({ label:"TO-DO", tickers:Object.freeze(["ADD","CUMTICK","TICK","TRIN","TICK","TRIN"]), chartCount:6, range:"3h", filled:"todo" })
    /* SCRATCH HAS NO PRESET, DELIBERATELY. It is a device workspace like LIVE and CUSTOM:
       its six slots come from scratchState() and the device, never from a table here. An
       entry in PRESETS would make the deck treat it as a fixed page, and an empty fixed
       page collapses to a two-up wall - which is exactly the bug this comment replaces. */
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
    STEPPED: Object.freeze({ label:"ribbon, stepped exactly", clouds:true, steps:true }),
    /* The RSI fan asks for the fan and nothing else: clouds:null leaves the ribbon to the wall's
       switch, so an oscillator page never overrules what Alan set on the dock. rsi:"auto" keeps a
       phone-narrow pane clean; a typed ?rsi= on the chart always shows. */
    RSI: Object.freeze({ label:"RSI fan, locked timeframes", clouds:null, rsi:"auto" })
  });
  /* `bars` on a chart asks the pane for that many bars instead of the range's usual window. No
     page asks for it since HISTORY left (25 Sep); the mechanism stays so a future workbench can. */
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
    const parts = stack.clouds == null ? [] : ["clouds=" + (stack.clouds ? "1" : "0")];
    if (stack.rsi) parts.push("rsi=" + encodeURIComponent(stack.rsi));
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
      bars: charts.map((c) => (Number(c.bars) > 0 ? Math.min(8000, Math.floor(Number(c.bars))) : null)),
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
  /* A REMEMBERED PAGE MUST STILL LAND SOMEWHERE. Every browser that last sat on INTERNALS
   SLOW opens on TO-DO, which is exactly where its TICK and TRIN panes went. */
const LEGACY = Object.freeze({ overnight:"indexNow", indexes:"indexLeadership", company:"companyLeadership", sectors:"sectorFamilies", themes:"themeFamilies", internalsSlow:"todo",
  /* 25 Sep (K3): the twelve saved TradingView layouts are retired as pages. A browser that
     remembered one lands on the workflow page that now carries its names. */
  tvMacro:"macro1D", tvIndexes:"otherIndexes1D", tvSectors:"sectors3D", tvHome6:"intraday4h",
  tvPage2:"ai1", tvPage3:"mag7", tvOtherLC:"other3D", tvOtherSC:"ai2", tvBlueChip:"blueChip3D", tvExtras:"ai2",
  /* 25 Sep, later: HISTORY is retired. A browser that remembered it lands on MACRO · DAY, the
     daily page that carries three of its six names (gold, the 10-year, crude). */
  history:"macro1D" });
  const normalizeScene = (value) => IDS.includes(LEGACY[value] || value) ? (LEGACY[value] || value) : "live";

  function indexNowLeaders(at) {
    const d = at instanceof Date ? at : new Date(at);
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone:NY, hour:"2-digit", hour12:false }).format(d));
    return hour >= 8 && hour < 18 ? ["SPY","QQQ"] : ["ESUSD","NQUSD"];
  }
  function indexNowTickersFor(at) {
    return Object.freeze([...indexNowLeaders(at), "CLUSD"]);
  }

  /* ── THE WORKFLOW'S MOVING PARTS (K3) ────────────────────────────────────────────
     rotatingWindow is the one rule behind every "rotate" and "alternates" slot: the
     window starts at (visit × size), wrapping around the end of the list. The deck owns
     the visit counter; this function is pure so the windows are checkable in a test. */
  function rotatingWindow(list, size, visit) {
    const all = (list || []).filter((x) => x != null && x !== "");
    if (!all.length) return [];
    const n = Math.max(1, Math.min(all.length, Number(size) || 1));
    const start = (Math.max(0, Math.floor(Number(visit) || 0)) * n) % all.length;
    return Array.from({ length: n }, (_, i) => all[(start + i) % all.length]);
  }
  /* SESSIONS — two, since 25 Sep (Alan, ~3:40 PM ET: "I do need to see intraday in the morning —
     early bird gets the worm. After hours it's just a slow-down… give more frequent screen time
     to the intraday views, and then not put them after hours — somewhere 5–6 PM").
       DAY    04:00–18:00 ET, weekdays    every workflow page; the intraday four come round TWICE
                                          per lap (after the 3-day block and again at the end)
       NIGHT  18:00–04:00 ET + weekends   the same lap without the intraday four (weeklies stay in)
     LEADERS ride the market clock, not the session: SPY/QQQ 09:30–16:30 ET on a weekday, ES/NQ
     otherwise. 16:30, not 16:00, closes the market: measured on SPY's 30-minute bars, volume
     falls from 5.9M in the 16:00 bar to 195k at 16:30. No holiday calendar: a weekday exchange
     holiday runs the weekday clock. SESSION_WINDOWS is the 24-hour strip the deliverable draws. */
  const SESSION_WINDOWS = Object.freeze([
    Object.freeze({ id:"night",  session:"night", from:"18:00", to:"04:00", leaders:Object.freeze(["ESUSD","NQUSD"]) }),
    Object.freeze({ id:"early",  session:"day",   from:"04:00", to:"09:30", leaders:Object.freeze(["ESUSD","NQUSD"]) }),
    Object.freeze({ id:"market", session:"day",   from:"09:30", to:"16:30", leaders:Object.freeze(["SPY","QQQ"]) }),
    Object.freeze({ id:"late",   session:"day",   from:"16:30", to:"18:00", leaders:Object.freeze(["ESUSD","NQUSD"]) })
  ]);
  function nyClock(at) {
    const d = at instanceof Date ? at : new Date(at);
    if (!Number.isFinite(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US",
      { timeZone:NY, weekday:"short", hour:"2-digit", minute:"2-digit", hour12:false }).formatToParts(d);
    const part = (type) => (parts.find((p) => p.type === type) || {}).value || "";
    const day = part("weekday");
    return { weekend: day === "Sat" || day === "Sun", minutes: (Number(part("hour")) % 24) * 60 + Number(part("minute")) };
  }
  function stationSession(at) {
    const clock = nyClock(at);
    if (!clock) return "day";                                              // an unreadable clock never empties the wall
    if (clock.weekend) return "night";
    return clock.minutes >= 240 && clock.minutes < 1080 ? "day" : "night";  // 04:00–17:59
  }
  function marketOpenAt(at) {
    const clock = nyClock(at);
    return !!clock && !clock.weekend && clock.minutes >= 570 && clock.minutes < 990;   // 09:30–16:29
  }
  function LEADERS(at) {
    return marketOpenAt(at) ? ["SPY","QQQ"] : ["ESUSD","NQUSD"];
  }
  /* WHICH PAGES ROTATE NOW. The deck re-asks this on every advance, so the lap changes at
     04:00 and 18:00 (and the leaders at 09:30 and 16:30) without a reload. By day the lap is
     weekly + 3-day + intraday + daily + intraday, so an intraday page is never more than half
     a lap away; by night the intraday four are out and everything else keeps its order. */
  function rotationScenesFor(session) {
    const rest = WORKFLOW_IDS.filter((id) => !INTRADAY_PAGES.includes(id));
    if (session === "night") return rest;
    const lastThreeDay = rest.reduce((last, id, k) => (WORKFLOW_PAGES[id].range === "3D" ? k : last), -1);
    return rest.slice(0, lastThreeDay + 1).concat(INTRADAY_PAGES, rest.slice(lastThreeDay + 1), INTRADAY_PAGES);
  }
  function rotationScenesAt(at) {
    return rotationScenesFor(stationSession(at));
  }
  /* A WORKFLOW PAGE'S CHARTS AT ONE MOMENT. opts: { visit, targets, at }. TARGETS slots
     take the deck's current list (public.station_targets) or TARGETS_DEFAULT; LEADERS
     slots take SPY/QQQ or ES/NQ by the clock. Every slot rides the page's timeframe as
     a per-slot range — the workbench mechanism — so the wall's run-wide RANGE rule is
     never overwritten by a page. */
  function workflowTickersFor(id, opts) {
    const page = WORKFLOW_PAGES[id];
    if (!page) return null;
    const options = opts || {};
    const targets = (Array.isArray(options.targets) && options.targets.length ? options.targets : TARGETS_DEFAULT).slice(0, 8);
    const leaders = LEADERS(options.at || new Date());
    const visit = Math.max(0, Math.floor(Number(options.visit) || 0));
    if (page.targets) return targets;
    /* A page may carry fixed tickers AND rotating slots (SECTORS, 25 Sep): the fixed names
       come first, in their slots on every visit, and the rotating window is appended. */
    let slots = page.tickers ? page.tickers.slice() : [];
    if (page.leaders) slots = slots.concat(page.leaderWindow ? rotatingWindow(leaders, 1, visit) : leaders);
    if (page.rotate) slots = slots.concat(rotatingWindow(page.rotate.list, page.rotate.size, visit));
    if (page.rotateTargets) slots = slots.concat(rotatingWindow(targets, page.rotateTargets.size, visit));
    if (page.tail) slots = slots.concat(page.tail);
    return slots.slice(0, 8);
  }
  function workflowPageState(id, opts) {
    const page = WORKFLOW_PAGES[id];
    if (!page) return null;
    const tickers = workflowTickersFor(id, opts) || [];
    /* Four-slot walls (MACRO · 4H, INTRADAY · 1H) are an honest four-up; chartCountForSize
       would retire them to two. Everything else follows the usual ladder. */
    const count = tickers.length === 4 ? 4 : chartCountForSize(tickers.length);
    /* A page's `study` rides every slot the workbench way (SLOT_STACKS → studyQuery). */
    const study = page.study && studyStack(page.study) ? String(page.study).toUpperCase() : "";
    return { label:page.label, tickers, chartCount:count, range:page.range,
      ranges:tickers.map(() => page.range),
      stacks:tickers.map(() => study),
      offset:0, totalItems:tickers.length, hasPrevious:false, hasNext:false, empty:!tickers.length };
  }
  /* The jump list's answer for a workflow page is its FULL list: a rotating page reports
     every name it can land on, a TARGETS page the default eight, a LEADERS page both pairs. */
  function workflowPageTickers(id) {
    const page = WORKFLOW_PAGES[id];
    if (!page) return [];
    const out = [];
    if (page.tickers) out.push(...page.tickers);
    if (page.targets) out.push(...TARGETS_DEFAULT);
    if (page.leaders) out.push("SPY","QQQ","ESUSD","NQUSD");
    if (page.rotate) out.push(...page.rotate.list);
    if (page.rotateTargets) out.push(...TARGETS_DEFAULT);
    if (page.tail) out.push(...page.tail);
    return out;
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
  /* ── THE SCINTILLAS PAGE ──────────────────────────────────────────────────────────
     Rows arrive NEWEST FIRST from public.scintillas. Two rules, both Alan's words:
       · "newest replacing oldest" — the wall holds the most recent names, so a fresh
         scintilla pushes the oldest chart off the page;
       · "biggest first" — what is left is ORDERED by how unusual it is, so the loudest
         name is chart one.
     One chart per name: a ticker that scintillated twice today keeps its freshest row.
     Nothing is invented — a row with no move and no multiple still gets its chart, and
     its label simply says less. */
  function scintillasPage(rows, requestedCount) {
    const want = chartCountForSize(requestedCount || 6);
    const newest = new Map();
    for (const r of rows || []) {
      if (!r || (r.subject_kind && r.subject_kind !== "ticker")) continue;
      const ticker = String(r.subject || "").trim().toUpperCase();
      if (!ticker || newest.has(ticker)) continue;          // rows are newest first: keep the freshest
      const d = (r && r.detail) || {};
      newest.set(ticker, { ticker, ts:r.ts, kind:r.kind,
        magnitude:r.magnitude == null ? null : Math.abs(Number(r.magnitude)),
        movePct:d.move_pct == null ? null : Number(d.move_pct),
        assetClass:d.asset_class || null, fired:Array.isArray(d.fired) ? d.fired.slice() : null });
      if (newest.size >= want) break;                        // the oldest never make it on
    }
    const cards = Array.from(newest.values()).sort((a, b) =>
      (b.magnitude == null ? -1 : b.magnitude) - (a.magnitude == null ? -1 : a.magnitude) ||
      String(b.ts || "").localeCompare(String(a.ts || "")) ||
      a.ticker.localeCompare(b.ticker));
    for (const c of cards) c.label = scintillaLabel(c);
    /* `cards` carries the reasons; `tickers` is what the wall installs. They are deliberately
       separate: the deck reads a scene's charts as symbols, and a reason is not a symbol. */
    return { tickers:cards.map((c) => c.ticker), cards,
      chartCount:chartCountForSize(cards.length || 1), offset:0, totalItems:cards.length,
      hasPrevious:false, hasNext:false, empty:!cards.length };
  }
  /* WHY THIS CHART IS HERE, in the Hub's own words — never the Greek letter (M48). */
  function scintillaLabel(c) {
    if (!c) return "";
    const move = c.movePct == null || !isFinite(c.movePct) ? ""
      : (c.movePct > 0 ? "+" : "\u2212") + Math.abs(c.movePct).toFixed(1) + "%";
    const usual = c.magnitude == null || !isFinite(c.magnitude) ? ""
      : c.magnitude.toFixed(1) + "\u00d7 its usual " + (c.kind === "earnings_surprise" ? "surprise" : "day");
    let when = "";
    try { when = c.ts ? new Intl.DateTimeFormat("en-US", { timeZone:NY, hour:"numeric", minute:"2-digit" }).format(new Date(c.ts)) : ""; }
    catch (e) { when = ""; }
    const what = c.kind === "earnings_surprise" ? "earnings" : c.kind === "econ_surprise" ? "release" : "";
    return [what, move, usual, when].filter(Boolean).join(" \u00b7 ");
  }

  /* ── TO-DO · WHAT IS NOT OURS YET, AND WHY (M69) ───────────────────────────────────
     Alan, 24 Sep: "I still see ADD gray, tick gray, cumulative tick gray, trend gray.
     And if they're gonna be gray, I would send them to an empty layout at the end, as
     kind of like to do reminders."
     So this page is a reminder list made of the charts themselves. Each slot says, in
     plain words, why it is here — never a label that implies the number is ours. The
     last two are the old INTERNALS SLOW page: the same two TradingView series at their
     own 1D window, carried over instead of deleted, so nothing Alan was watching is
     silently gone. A per-slot range is the workbench mechanism, already in the deck. */
  const TODO_CHARTS = Object.freeze([
    Object.freeze({ ticker:"ADD", note:"advance / decline \u00b7 drawn by TradingView, not served natively yet" }),
    Object.freeze({ ticker:"CUMTICK", note:"cumulative tick \u00b7 TradingView draws plain TICK here \u2014 no cumulative series of our own" }),
    Object.freeze({ ticker:"TICK", note:"NYSE tick \u00b7 drawn by TradingView, not served natively yet" }),
    Object.freeze({ ticker:"TRIN", note:"TRIN / arms index \u00b7 drawn by TradingView, not served natively yet" }),
    Object.freeze({ ticker:"TICK", range:"1D", note:"was INTERNALS SLOW \u00b7 the same TradingView tick at 1D" }),
    Object.freeze({ ticker:"TRIN", range:"1D", note:"was INTERNALS SLOW \u00b7 the same TradingView TRIN at 1D" })
  ]);
  function todoState() {
    const charts = TODO_CHARTS.slice(0, 8);
    return {
      label:"TO-DO",
      tickers:charts.map((c) => c.ticker),
      notes:charts.map((c) => c.note),
      ranges:charts.map((c) => c.range || null),
      stacks:charts.map(() => ""),
      chartCount:chartCountForSize(charts.length),
      range:"3h", offset:0, totalItems:charts.length, hasPrevious:false, hasNext:false, empty:!charts.length
    };
  }
  function todoNote(ticker, index) {
    const at = TODO_CHARTS[Number(index)];
    if (at && at.ticker === String(ticker || "").toUpperCase()) return at.note;
    const first = TODO_CHARTS.find((c) => c.ticker === String(ticker || "").toUpperCase());
    return first ? first.note : "";
  }

  /* ── SCRATCH · THE EMPTY SIX AT THE END (M69) ───────────────────────────────────────
     Alan, 24 Sep: "one empty six chart screen layout kind of as the ending screen so
     that I can search tickers in and that it'll work and that they will change... think
     of it like if I was creating the layouts in new pages, and then in that new page we
     will rearrange, and I'll tell you, okay, this one we save."
     The page holds nothing of its own: eight slots (grown from six on 25 Sep so a
     finished scratch wall can be saved straight into TARGETS), whatever the device
     remembers, and one line of text that can be pasted back to the coordinator to be
     promoted into a named page above. An empty slot stays empty — SCRATCH never seeds
     SPY/SNDK like LIVE. */
  const SCRATCH_SLOTS = 8;
  function scratchState(charts, range, count) {
    const size = Math.max(1, Math.min(8, Number(count) || SCRATCH_SLOTS));
    const slots = Array.from({ length:size }, (_, i) =>
      String((charts || [])[i] || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12));
    return { label:"SCRATCH", tickers:slots, charts:slots, chartCount:size,
      range:range || "3h", offset:0, totalItems:slots.filter(Boolean).length,
      hasPrevious:false, hasNext:false, empty:!slots.some(Boolean) };
  }
  /* ONE LINE, SO IT SURVIVES A TEXT MESSAGE. Empty slots are kept as "" on purpose: the
     shape of the wall is part of what Alan is saving, so slot 4 being empty is a fact. */
  function scratchLayout(charts, range, count) {
    const state = scratchState(charts, range, count);
    return JSON.stringify({ scene:"scratch", tickers:state.tickers, range:state.range });
  }

  function nextRotatingScene(scene) {
    const index = ROTATION_IDS.indexOf(normalizeScene(scene));
    return ROTATION_IDS[(index + 1 + ROTATION_IDS.length) % ROTATION_IDS.length];
  }
  function screenForScene(scene) {
    return SCREENS.find((screen) => screen.scene === normalizeScene(scene)) || null;
  }
  /* Auto-rotate walks Alan's workflow; the arrows and the rail walk every page. The
     intraday four drop out after hours — the deck asks with the current time on every
     advance, so the rotation shrinks at 16:30 and grows back at 09:30 unaided. */
  /* ONE STEP OF THE LAP. `position` is where the deck last stood in the lap (an intraday page
     appears twice by day, so the page name alone cannot say which visit this is). A position
     that no longer matches — the lap changed at 04:00/18:00, or Alan jumped pages by hand —
     falls back to the page's first place in the lap; a page outside the lap starts it over. */
  function rotationStepAt(scene, at, position) {
    const current = normalizeScene(scene);
    const order = rotationScenesAt(at || new Date());
    const from = Number.isInteger(position) && order[position] === current ? position : order.indexOf(current);
    const index = (from + 1) % order.length;                                // from = -1 → the first page
    return { scene: order[index], position: index, lap: order.length, screen: screenForScene(order[index]) || SCREENS[0] };
  }
  function nextRotatingScreenAt(scene, at, position) {
    return rotationStepAt(scene, at, position).screen;
  }
  function nextRotatingScreen(scene) {
    return nextRotatingScreenAt(scene, new Date());
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
    if (WORKFLOW_PAGES[id]) return workflowPageTickers(id);
    if (id === "indexNow") return indexNowTickersFor(new Date()).slice();
    if (id === "todo") return TODO_CHARTS.map((c) => c.ticker);
    /* SCRATCH's symbols live on the device, not in the model, so the jump list finds it
       by name only. It is never wrong about what is on it. */
    if (id === "scratch") return [];
    const families = FAMILIES[id];
    if (families) return families.reduce((all, f) => all.concat(f.tickers), []);
    return (PRESETS[id]?.tickers || []).slice();
  }
  /* THE RAIL'S GEOMETRY IS ARITHMETIC, NOT LAYOUT. Both of these are pure so the
     "every button the same width, nothing shifts" rule can be checked without a
     browser: how many whole buttons fit, and which button the window starts at. */
  function railChips(spare, total, step, gap) {
    const fit = Math.floor((Number(spare) + Number(gap)) / Number(step));
    const chips = Math.max(0, Math.min(Number(total) || 0, Number.isFinite(fit) ? fit : 0));
    return chips >= 3 ? chips : 0;
  }
  function railWindowStart(index, chips, total) {
    if (!chips || index < 0) return 0;
    return Math.max(0, Math.min(Math.max(0, total - chips), index - Math.floor((chips - 1) / 2)));
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
    LEGACY,
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
    nextRotatingScreenAt,
    rotationScenesAt,
    rotationScenesFor,
    rotationStepAt,
    marketOpenAt,
    rotatingWindow,
    stationSession,
    SESSION_WINDOWS,
    INTRADAY_PAGES,
    WEEKLY_PAGES,
    LEADERS,
    TARGETS_DEFAULT,
    WORKFLOW_IDS,
    WORKFLOW_PAGES,
    workflowPageState,
    workflowPageTickers,
    STUDY_STACKS,
    WORKBENCHES,
    workbenchFor,
    isWorkbenchScene,
    studyStack,
    studyQuery,
    workbenchState,
    exactPage,
    scintillasPage,
    scintillaLabel,
    TODO_CHARTS,
    todoState,
    todoNote,
    SCRATCH_SLOTS,
    scratchState,
    scratchLayout,
    pageTickers,
    findPages,
    railChips,
    railWindowStart,
    shortLabel
  });
})(typeof globalThis === "object" ? globalThis : window);
