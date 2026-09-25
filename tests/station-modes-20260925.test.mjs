/* P1-STATION-MODES (SCI-11), 25 Sep 2026. Alan: "pre-market view and during-market view and
   after-market view and an overnight" · "there is sectors that are more important in market cap…
   I don't know if I would rotate all of them" · "a throwaway tab with six charts… this is a good
   place to drop things and they're safe" · "when it changes from one view to another, there's a
   little glitch happening." The model is checked as pure functions; the deck's wiring is run
   through the deck's own functions with stubbed neighbours, and pinned by source where the
   behaviour needs a browser (that part is proved headlessly in the deliverable). */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../deck/scenes.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const scenes = context.globalThis.StationScenes;
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const chartShell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const arr = (x) => Array.from(x);

function functionFromDeck(name, bindings = {}) {
  const start = deck.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = deck.indexOf("{", start); i < deck.length; i++) {
    if (deck[i] === "{") depth++;
    if (deck[i] === "}" && --depth === 0) { end = i + 1; break; }
  }
  const prefix = deck.slice(Math.max(0, start - 6), start) === "async " ? "async " : "";
  return vm.runInNewContext(`(${prefix}${deck.slice(start, end)})`, bindings);
}
function arrowFromDeck(name, bindings = {}) {
  const match = deck.match(new RegExp("const " + name + " = (\\([^\\n]*);\\n"));
  assert.ok(match, `${name} must exist as a one-line arrow`);
  return vm.runInNewContext("(" + match[1] + ")", bindings);
}
const CLEAN = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);

/* ── 1 · FOUR SESSIONS ─────────────────────────────────────────────────────────────── */
/* 23 Sep 2026 is a Wednesday in EDT (UTC-4); 2 Dec 2026 is a Wednesday in EST (UTC-5). */
const EDT = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return new Date(Date.UTC(2026, 8, 23, h + 4, m)); };
const EST = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return new Date(Date.UTC(2026, 11, 2, h + 5, m)); };

test("stationSession changes at exactly 04:00, 09:30, 16:30 and 20:00 New York, both sides of each minute", () => {
  for (const at of [EDT, EST]) {
    const zone = at === EDT ? "EDT" : "EST";
    const expect = [
      ["00:00","overnight"],["03:59","overnight"],["04:00","premarket"],["09:29","premarket"],
      ["09:30","market"],["16:29","market"],["16:30","after"],["19:59","after"],["20:00","overnight"],["23:59","overnight"]];
    for (const [hhmm, session] of expect)
      assert.equal(scenes.stationSession(at(hhmm)), session, `${hhmm} ${zone} is ${session}`);
  }
});

test("Saturday and Sunday are overnight all day, and Monday's pre-market starts at 04:00", () => {
  for (const utc of ["2026-09-26T04:00:00Z","2026-09-26T14:00:00Z","2026-09-26T20:30:00Z","2026-09-27T13:30:00Z","2026-09-27T23:59:00Z"])
    assert.equal(scenes.stationSession(utc), "overnight", utc + " (a weekend) is overnight");
  assert.equal(scenes.stationSession("2026-09-26T00:30:00Z"), "overnight", "Friday 20:30 ET is overnight");
  assert.equal(scenes.stationSession("2026-09-28T07:59:00Z"), "overnight", "Monday 03:59 ET is still overnight");
  assert.equal(scenes.stationSession("2026-09-28T08:00:00Z"), "premarket", "Monday 04:00 ET opens the pre-market");
  assert.equal(scenes.stationSession("not a date"), "market", "an unreadable clock never empties the wall");
});

test("each session rotates exactly the pages the brief names, and every page stays in the menu", () => {
  const weekly = ["wkIndexes","wkMacro"];
  const intraday = ["macroIntraday","intraday4h","intraday1h","intraday30m"];
  const daily3d = scenes.WORKFLOW_IDS.filter((id) => !weekly.includes(id) && !intraday.includes(id));
  assert.equal(daily3d.length, 13, "the 3-day and daily pages");
  const overnight = arr(scenes.rotationScenesFor("overnight"));
  assert.deepEqual(overnight, weekly.concat(arr(daily3d)), "overnight: the two weekly pages + the 3-day + the daily pages");
  for (const s of ["premarket","market","after"])
    assert.deepEqual(arr(scenes.rotationScenesFor(s)), arr(daily3d).concat(intraday), s + ": the 3-day + daily pages + the four intraday pages");
  assert.deepEqual(arr(scenes.INTRADAY_PAGES), intraday);
  assert.deepEqual(arr(scenes.WEEKLY_PAGES), weekly);
  for (const id of scenes.WORKFLOW_IDS) assert.ok(scenes.screenForScene(id), `${id} is still a page in the menu`);
});

test("LEADERS: SPY/QQQ only in the market session; ESUSD/NQUSD overnight, pre-market and after", () => {
  assert.deepEqual(arr(scenes.LEADERS(EDT("09:30"))), ["SPY","QQQ"]);
  assert.deepEqual(arr(scenes.LEADERS(EDT("16:29"))), ["SPY","QQQ"]);
  for (const hhmm of ["03:00","04:00","09:29","16:30","19:59","20:00"])
    assert.deepEqual(arr(scenes.LEADERS(EDT(hhmm))), ["ESUSD","NQUSD"], hhmm + " ET");
  assert.deepEqual(arr(scenes.workflowPageState("intraday4h", { visit:0, targets:["A","B","C","D"], at:EDT("08:00") }).tickers),
    ["ESUSD","NQUSD","A","B","C","D"], "the intraday pages rotate in the pre-market, led by the futures pair");
});

test("SESSION_WINDOWS (the deliverable's 24-hour strip) agrees with stationSession minute by minute", () => {
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  assert.deepEqual(arr(scenes.SESSION_WINDOWS).map((w) => w.id), ["overnight","premarket","market","after"]);
  for (let minute = 0; minute < 1440; minute++) {
    const hhmm = String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0");
    const win = scenes.SESSION_WINDOWS.find((w) => {
      const a = toMin(w.from), b = toMin(w.to);
      return a < b ? minute >= a && minute < b : minute >= a || minute < b;
    });
    assert.equal(scenes.stationSession(EDT(hhmm)), win.id, hhmm);
    assert.deepEqual(arr(scenes.LEADERS(EDT(hhmm))), arr(win.leaders), hhmm + " leaders");
  }
});

test("the deck asks for the lap on every advance, so it changes at 04:00 and 20:00 without a reload", () => {
  assert.match(deck, /const next = SceneModel\.nextRotatingScreenAt\(SCENE, new Date\(\)\);/);
  assert.equal(scenes.nextRotatingScreenAt("targets1D", EDT("19:59")).scene, "macroIntraday", "19:59: the intraday four still follow");
  assert.equal(scenes.nextRotatingScreenAt("targets1D", EDT("20:00")).scene, "wkIndexes", "20:00: the lap wraps to the weekly INDEXES");
  assert.equal(scenes.nextRotatingScreenAt("targets1D", EDT("04:00")).scene, "macroIntraday", "04:00: the intraday four are back");
});

/* ── 2 · SECTORS: ALAN'S SIX STAY, THE OTHER FIVE ROTATE TWO AT A TIME ─────────────── */
test("SECTORS is eight charts: slots 1–6 fixed on every visit, slots 7–8 rotating through the other five", () => {
  const six = ["XLK","XLI","XLC","XLF","XLY","XLE"];
  const five = ["XLP","XLV","XLU","XLRE","XLB"];
  const seen = new Map(five.map((t) => [t, 0]));
  for (let visit = 0; visit < 5; visit++) {
    const state = scenes.workflowPageState("sectors3D", { visit });
    assert.equal(state.chartCount, 8, "an eight-chart page");
    assert.deepEqual(arr(state.tickers).slice(0, 6), six, `visit ${visit}: Alan's six, in his order`);
    const moving = arr(state.tickers).slice(6);
    assert.equal(moving.length, 2);
    for (const t of moving) { assert.ok(five.includes(t), t + " is one of the five"); seen.set(t, seen.get(t) + 1); }
    assert.equal(new Set(state.tickers).size, 8, `visit ${visit}: no sector twice on the wall`);
  }
  for (const [t, n] of seen) assert.equal(n, 2, `${t} is on screen twice in every five visits - nobody is starved`);
  assert.deepEqual(arr(scenes.workflowPageState("sectors3D", { visit:0 }).tickers).slice(6), ["XLP","XLV"]);
  assert.deepEqual(arr(scenes.workflowPageState("sectors3D", { visit:1 }).tickers).slice(6), ["XLU","XLRE"]);
  assert.deepEqual(arr(scenes.workflowPageState("sectors3D", { visit:2 }).tickers).slice(6), ["XLB","XLP"], "the window wraps");
  assert.deepEqual(arr(scenes.workflowPageState("sectors3D", { visit:5 }).tickers), arr(scenes.workflowPageState("sectors3D", { visit:0 }).tickers),
    "five visits make a full cycle");
});

test("a page may carry both fixed tickers and a rotating window; rotatingWindow stays pure", () => {
  const list = ["XLP","XLV","XLU","XLRE","XLB"];
  const copy = list.slice();
  const a = arr(scenes.rotatingWindow(list, 2, 3)), b = arr(scenes.rotatingWindow(list, 2, 3));
  assert.deepEqual(a, b, "same inputs, same window");
  assert.deepEqual(list, copy, "the list is not mutated");
  assert.deepEqual(arr(scenes.pageTickers("sectors3D")),
    ["XLK","XLI","XLC","XLF","XLY","XLE","XLP","XLV","XLU","XLRE","XLB"], "the jump list knows all eleven");
  assert.ok(scenes.findPages("XLRE").some((m) => m.screen.scene === "sectors3D"), "a rotating sector is findable");
  /* the other fixed-ticker pages are unchanged by the new composition */
  assert.deepEqual(arr(scenes.workflowPageState("mag7", { visit:3 }).tickers), arr(scenes.WORKFLOW_PAGES.mag7.tickers));
});

/* ── 3 · HISTORY IS GONE, ITS PLUMBING STAYS ──────────────────────────────────────── */
test("HISTORY is not a page, not a workbench and not in the menu; a remembered one lands on MACRO · DAY", () => {
  assert.ok(!scenes.IDS.includes("history"));
  assert.ok(!scenes.SCREENS.some((s) => s.scene === "history" || /HISTORY/.test(s.label)));
  assert.ok(!Object.keys(scenes.WORKBENCHES).includes("history"));
  assert.deepEqual(arr(scenes.WORKBENCH_IDS), ["oscWorkbench"]);
  assert.doesNotMatch(source, /HISTORY_BARS/, "the constant is gone");
  assert.doesNotMatch(deck, /<option value="history">/);
  assert.equal(scenes.normalizeScene("history"), "macro1D");
  assert.ok(!scenes.findPages("HISTORY").length, "the jump list does not offer it");
  /* the per-slot bars request stays: harmless, and still read by the pane and the deck */
  assert.match(deck, /const SLOT_BARS = Array\.from\(\{ length: 8 \}, \(\) => 0\);/);
  assert.match(source, /bars: charts\.map\(\(c\) => \(Number\(c\.bars\) > 0 \? Math\.min\(8000/);
  assert.match(chart, /const chartBarsOverride = \(\) => \{ const n = Math\.floor\(\+QS\.get\("bars"\)/, "the chart pane still honours ?bars=");
});

/* ── 4 · SCRATCH IS SHARED; SAVE AS RADAR ADDS ───────────────────────────────────── */
function scratchRig({ rows = [], failRead = false, failWrite = false } = {}) {
  const store = new Map();
  const calls = [];
  const bindings = {
    CHARTS: ["", "", "", "", "", "", "", ""], SCENE: "scratch", CLEAN, SCRATCH_SHARE_DEBOUNCE_MS: 800,
    SceneModel: scenes, SCRATCH_SHARED: null, SCRATCH_EDITS: 0,
    scratchShareTimer: 0, scratchShareInFlight: false, scratchShareAgain: false,
    remembered: (k) => store.get(k) || "", remember: (k, v) => store.set(k, v),
    el: () => ({ textContent: "" }), Promise, setTimeout, clearTimeout, JSON, Array, Number, Date,
    pg: async (path) => { calls.push({ op:"read", path }); if (failRead) throw new Error("pg 500"); return rows; },
    pgWrite: async (path, body) => { calls.push({ op:"write", path, body }); if (failWrite) throw new Error("pg write 500"); },
    pgDelete: async (path) => { calls.push({ op:"delete", path }); }
  };
  bindings.scratchSlots = arrowFromDeck("scratchSlots", bindings);
  bindings.slotsFromListRows = functionFromDeck("slotsFromListRows", bindings);
  bindings.loadSharedScratch = functionFromDeck("loadSharedScratch", bindings);
  bindings.shareScratch = functionFromDeck("shareScratch", bindings);
  bindings.shareScratchSoon = functionFromDeck("shareScratchSoon", bindings);
  return { bindings, store, calls };
}

test("SCRATCH reads the shared list at load and on entry; the table wins over the device when it has rows", async () => {
  const rig = scratchRig({ rows: [{ position:1, ticker:"CDNS" }, { position:3, ticker:"mu" }, { position:9, ticker:"XX" }] });
  rig.store.set("station.scratch.chart.1", "OLD");
  assert.equal(await rig.bindings.loadSharedScratch(), true);
  assert.equal(rig.calls[0].path, "station_lists?select=position,ticker&list=eq.scratch&order=position.asc");
  assert.equal(rig.store.get("station.scratch.chart.1"), "CDNS", "the table replaced the device's slot 1");
  assert.equal(rig.store.get("station.scratch.chart.2"), "", "an empty position is an empty slot");
  assert.equal(rig.store.get("station.scratch.chart.3"), "MU", "cleaned like every other symbol");
  assert.equal(rig.store.get("station.scratch.chartCount"), "8", "and the page counts as visited");
  assert.equal(rig.bindings.SCRATCH_SHARED, JSON.stringify(["CDNS","","MU","","","","",""]), "position 9 is not a slot");
  const empty = scratchRig({ rows: [] });
  empty.store.set("station.scratch.chart.1", "KEEP");
  assert.equal(await empty.bindings.loadSharedScratch(), false);
  assert.equal(empty.store.get("station.scratch.chart.1"), "KEEP", "an empty table leaves the device's wall alone");
  const down = scratchRig({ failRead: true });
  down.store.set("station.scratch.chart.1", "KEEP");
  assert.equal(await down.bindings.loadSharedScratch(), false);
  assert.equal(down.store.get("station.scratch.chart.1"), "KEEP", "a failed read leaves the device's wall alone");
  assert.match(deck, /await loadTargets\(\);\n  await loadSharedScratch\(2500\);\n  await primeSceneState\(\);/, "read before the first wall is built");
  assert.match(deck, /await loadSharedScratch\(1500\);\n    RANGE = scratchRange\(\);\n    state = hasStoredScene\("scratch"\)/, "and on the way into SCRATCH");
});

test("an edit made while the read is out is newer than the read: it is never overwritten", async () => {
  const rig = scratchRig({ rows: [{ position:1, ticker:"CDNS" }] });
  let release;
  rig.bindings.pg = () => new Promise((resolve) => { release = () => resolve([{ position:1, ticker:"CDNS" }]); });
  const reading = rig.bindings.loadSharedScratch();
  rig.bindings.SCRATCH_EDITS += 1;           /* Alan typed while the read was in flight */
  release();
  assert.equal(await reading, false);
  assert.equal(rig.store.get("station.scratch.chart.1"), undefined, "the device's memory was not touched");
});

test("typing on SCRATCH writes the eight slots 800 ms after the last edit: filled upserted, emptied deleted", async () => {
  assert.match(deck, /const SCRATCH_SHARE_DEBOUNCE_MS = 800;/);
  const rig = scratchRig();
  rig.bindings.CHARTS.splice(0, 8, "CDNS", "", "NVDA", "", "", "", "", "");
  await rig.bindings.shareScratch();
  const write = rig.calls.find((c) => c.op === "write");
  assert.equal(write.path, "station_lists?on_conflict=list,position");
  assert.deepEqual(write.body.map((r) => [r.list, r.position, r.ticker]), [["scratch",1,"CDNS"],["scratch",3,"NVDA"]]);
  assert.ok(write.body.every((r) => typeof r.updated_at === "string"));
  const del = rig.calls.find((c) => c.op === "delete");
  assert.equal(del.path, "station_lists?list=eq.scratch&position=in.(2,4,5,6,7,8)", "empty slots stay empty on every window");
  rig.calls.length = 0;
  await rig.bindings.shareScratch();
  assert.equal(rig.calls.length, 0, "an unchanged wall is not written again");
});

test("the shared write is armed by an EDIT only - never by visiting or leaving the page", () => {
  const body = (name) => { const s = deck.indexOf("function " + name + "("); return deck.slice(s, deck.indexOf("\n}\n", s)); };
  assert.match(body("commitTicker"), /shareScratchSoon\(\)/, "typing a symbol is an edit");
  assert.match(body("clearSlot"), /shareScratchSoon\(\)/, "clearing a slot is an edit");
  assert.doesNotMatch(body("rememberEditableState"), /shareScratch/, "remembering on a scene change is not");
  assert.doesNotMatch(body("applyScene"), /shareScratch/, "and neither is arriving on SCRATCH");
  const rig = scratchRig();
  const timers = [];
  rig.bindings.setTimeout = (fn, ms) => { timers.push(ms); return 1; };
  rig.bindings.shareScratchSoon = functionFromDeck("shareScratchSoon", rig.bindings);
  rig.bindings.SCENE = "mag7"; rig.bindings.shareScratchSoon();
  assert.equal(timers.length, 0, "an edit on another page never touches the shared scratch");
  rig.bindings.SCENE = "scratch"; rig.bindings.shareScratchSoon();
  assert.deepEqual(timers, [800]);
});

test("a failed shared write says so and keeps the wall as typed", async () => {
  const notes = [];
  const rig = scratchRig({ failWrite: true });
  rig.bindings.el = () => ({ set textContent(v) { notes.push(v); } });
  rig.bindings.shareScratch = functionFromDeck("shareScratch", rig.bindings);
  rig.bindings.CHARTS[0] = "CDNS";
  await rig.bindings.shareScratch();
  assert.deepEqual(notes, ["scratch kept on this device · the shared save failed"]);
  assert.equal(rig.bindings.CHARTS[0], "CDNS");
  assert.equal(rig.bindings.SCRATCH_SHARED, null, "and the next edit will try again");
});

test("SAVE AS RADAR sits beside SAVE AS TARGETS on SCRATCH alone, and ADDS to list radar", async () => {
  assert.match(deck, /id="saveTargets" hidden[\s\S]{0,260}id="saveRadar" hidden/, "beside SAVE AS TARGETS");
  assert.match(deck, /saveR\.hidden = SCENE !== "scratch";/);
  const calls = [];
  const button = { textContent: "save as radar" };
  const save = functionFromDeck("saveScratchRadar", {
    CHARTS: ["CDNS", "", "NVDA", "MU", "CDNS", "", "", ""], CLEAN, el: () => button,
    SAVE_RADAR_REVERT: null, setTimeout: () => 0, clearTimeout: () => {}, Array, Set, Math, Number, Date,
    pg: async (path) => { calls.push({ op:"read", path }); return [{ position:1, ticker:"MU" }, { position:2, ticker:"AAPL" }]; },
    pgWrite: async (path, body) => { calls.push({ op:"write", path, body }); }
  });
  await save();
  assert.equal(calls[0].path, "station_lists?select=position,ticker&list=eq.radar&order=position.asc");
  assert.equal(calls[1].path, "station_lists?on_conflict=list,position");
  assert.deepEqual(calls[1].body.map((r) => [r.list, r.position, r.ticker]), [["radar",3,"CDNS"],["radar",4,"NVDA"]],
    "new names follow the last position; MU was already on it; CDNS once");
  assert.ok(!calls.some((c) => c.op === "delete"), "nothing on RADAR is ever removed from here");
  assert.equal(button.textContent, "radar +2 · 4 names");
});

test("SAVE AS TARGETS and COPY LAYOUT still work as before", () => {
  assert.match(deck, /pgWrite\("station_targets\?on_conflict=position",/);
  assert.match(deck, /pgDelete\("station_targets\?position=gt\." \+ filled\.length\)/);
  assert.match(deck, /const line = SceneModel\.scratchLayout\(CHARTS, RANGE, CHART_COUNT\);/);
  assert.equal(scenes.scratchLayout(["CDNS"], "3h", 8), '{"scene":"scratch","tickers":["CDNS","","","","","","",""],"range":"3h"}');
});

/* ── 5 · THE GLITCH: A NEW PAGE SWAPS THE SYMBOL, NOT THE DOCUMENT ─────────────────── */
function retargetRig({ shown = "/station-shells/chart-v1?shell=v1&bare=1&t=MSFT&range=3D&view=auto&sharedAxis=1",
  next = "/station-shells/chart-v1?shell=v1&bare=1&t=TSM&range=3D&view=auto&sharedAxis=1&transition=4",
  reported = "MSFT", cached = true } = {}) {
  const posts = [], sets = [], timers = [];
  const frame = { dataset: {}, getAttribute: () => shown, setAttribute: (n, v) => sets.push([n, v]),
    contentWindow: { postMessage: (m) => posts.push(m) } };
  const pane = { frame, def: { src: next }, reportedTicker: reported };
  const bindings = { location: { origin: "https://station.test" }, URL, CLEAN, RANGE: "3D",
    chartCachedInBrowser: () => cached, postDeckQuote: (f, t) => posts.push({ sc:"deck-quote", ticker:t }),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; } };
  bindings.frameIdentity = arrowFromDeck("frameIdentity");
  bindings.frameShownSrc = arrowFromDeck("frameShownSrc");
  bindings.srcTicker = functionFromDeck("srcTicker", bindings);
  bindings.withoutTicker = arrowFromDeck("withoutTicker", bindings);
  bindings.pointChartFrame = functionFromDeck("pointChartFrame");
  bindings.RETARGET_ACK_MS = 1500;
  return { pane, frame, posts, sets, timers, retarget: functionFromDeck("retargetChartInPlace", bindings) };
}

test("a cached symbol on a settled frame is swapped in place: quote first, then the symbol, no new src", () => {
  const r = retargetRig();
  assert.equal(r.retarget(r.pane, "TSM"), true);
  assert.deepEqual(JSON.parse(JSON.stringify(r.posts)), [{ sc:"deck-quote", ticker:"TSM" }, { sc:"chart", ticker:"TSM", range:"3D" }],
    "the day's baseline arrives before the symbol, so the first paint has its direction");
  assert.deepEqual(r.sets, [], "the document is kept - nothing reloads, nothing goes blank");
  assert.equal(r.frame.dataset.shown, r.pane.def.src, "the frame records what it now shows");
  assert.equal(r.timers[0].ms, 1500);
  r.pane.reportedTicker = "TSM"; r.timers[0].fn();
  assert.deepEqual(r.sets, [], "the pane answered with the new symbol: no fallback");
});

test("a frame that does not answer within 1.5 s gets the URL after all", () => {
  const r = retargetRig();
  r.retarget(r.pane, "TSM");
  r.timers[0].fn();                                   /* reportedTicker is still MSFT */
  assert.deepEqual(r.sets, [["src", r.pane.def.src]], "the URL is still the durable identity");
  assert.equal(r.frame.dataset.shown, undefined, "and the frame is back to its attribute");
});

test("anything but a clean symbol swap takes the old path", () => {
  assert.equal(retargetRig({ cached:false }).retarget(retargetRig({ cached:false }).pane, "TSM"), false, "a cold symbol reloads (queued)");
  const axis = retargetRig({ next: "/station-shells/chart-v1?shell=v1&bare=1&t=TSM&range=3D&view=auto" });
  assert.equal(axis.retarget(axis.pane, "TSM"), false, "a different axis mode is a different document");
  const loading = retargetRig({ reported: "NVDA" });
  assert.equal(loading.retarget(loading.pane, "TSM"), false, "a frame whose document has not reported what it shows is not trusted");
  const same = retargetRig({ next: "/station-shells/chart-v1?shell=v1&bare=1&t=MSFT&range=1D&view=auto&sharedAxis=1" });
  assert.equal(same.retarget(same.pane, "MSFT"), false, "the same symbol keeps the ordinary range message");
  for (const r of [axis, loading, same]) assert.deepEqual(r.posts, [], "and nothing was posted");
});

test("the deck wires the swap into the page change and every identity check reads what a frame shows", () => {
  assert.match(deck, /else if \(!retargetChartInPlace\(o, ticker\)\)\n\s*syncChartFrame\(o\.frame, o\.def\.src, \{ sc:"chart", ticker, range:RANGE \}\);/);
  assert.match(deck, /frameIdentity\(frameShownSrc\(item\.frame\)\) === frameIdentity\(item\.def\.src\)/, "load admission");
  assert.match(deck, /frameShownSrc\(o\.frame\) !== o\.def\.src;/, "the cold-rotation check");
  assert.match(deck, /if \(reporter\) reporter\.reportedTicker = CLEAN\(event\.data\.ticker\);/, "the handshake");
  assert.equal((deck.match(/\.setAttribute\("src"/g) || []).length, 1, "one place sets a chart frame's src: pointChartFrame");
  assert.match(deck, /return typeof env\?\.ts === "number" && Array\.isArray\(env\?\.pts\) && env\.pts\.length >= 2;/,
    "the deck's 'cached' is the pane's own cache test");
});

test("the chart pane loads a new symbol straight at the new range - never the old symbol first", () => {
  for (const [label, src] of [["chart", chart], ["chart shell", chartShell]]) {
    assert.match(src, /const retarget = !!\(d\.ticker && host && String\(d\.ticker\)\.toUpperCase\(\)\.trim\(\) !== host\.dataset\.t\);/, label);
    assert.match(src, /if \(host && !retarget\) holdAndReload\(host, S\.chartRange\);/, label);
  }
  assert.equal(chart, chartShell, "the two chart copies stay byte-identical");
});
