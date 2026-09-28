/* L6 · 28 SEP · STATION FOLLOW-UPS: rotation that is cheap, clear and never duplicates.
   1. one candle cache for the deck (a rotating page settles to near-zero extra chart-API reads);
   2. rotating pages cost less CPU (an incoming frame composites its fade, and gets the shared zoom
      before its first draw);
   3. the Geiger reading is in the incoming frame before its fade starts;
   4. a held slot is skipped in the cycle, so no two panes show one name;
   5. the rotation mark lists the cycle's tickers, the one on screen bright;
   6. the deck's timeframe tag moves off a pane seam instead of covering a ticker. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const provider = read("_provider/provider.js");
const deck = read("deck/index.html");
const chart = read("chart/index.html");
const context = { globalThis: {} };
vm.runInNewContext(read("deck/scenes.js"), context);
const scenes = context.globalThis.StationScenes;
const arr = (x) => Array.from(x);
const plain = (x) => JSON.parse(JSON.stringify(x));

/* ---- 1. the deck-level candle cache ------------------------------------------------------ */
const ORIGIN = "https://station.scintillahub.ai";
function universe(n = 364) {
  const syms = ["AAPL", "MU", "BE"];
  for (let i = 0; syms.length < n; i++) syms.push("SYM" + String(i).padStart(4, "0"));
  return syms.sort();
}
function response(body, code = 200) { return Promise.resolve({ ok:code >= 200 && code < 300, status:code, json:async () => body }); }
/* a deck window, and frames under it that each run their own copy of provider.js */
function station(clock) {
  const calls = [];
  const syms = universe();
  const fetch = (url) => {
    const u = String(url); calls.push(u.replace(/^https:\/\/[^/]+/, ""));
    if (u.includes("/universe")) return response({ provider:"MASSIVE", symbols:syms, count:syms.length, universe_sha256:"a".repeat(64) });
    if (u.includes("/candles")) {
      if (u.includes("symbol=BE") && u.includes("tf=W")) return response({ series:[], absence:"FMP_INTERVAL_NOT_SERVED" }, 404);
      return response({ series:[{ t:1790607600000, o:1, h:2, l:1, c:2, v:9 }, { t:1790609400000, o:2, h:3, l:2, c:3, v:9 }] });
    }
    return response({});
  };
  const top = { Map, Object, location:{ origin:ORIGIN } };
  top.parent = top;
  const frame = (reader) => {
    const window = { fetch, parent:top, location:{ origin:ORIGIN } };
    vm.runInNewContext(provider, {
      window, fetch, location:window.location, Date:clock || Date, Promise, String, Object, Number, parseInt, isFinite,
      encodeURIComponent, JSON, Error, Math, Array, RegExp, Map, console, setTimeout, clearTimeout, AbortController,
    });
    if (reader) window.scBindProviderClient(reader);
    return window.SC_PROVIDER;
  };
  return { calls, top, frame, canonical: async () => syms.map((ticker) => ({ ticker })) };
}
const candleCalls = (calls) => calls.filter((u) => u.startsWith("/candles"));

test("a name read by one frame is not read again by the next frame the deck opens for it", async () => {
  const st = station();
  const a = st.frame(st.canonical);
  const rowsA = await a.marketCandles("MU", "30m", { limit:240 });
  const b = st.frame(st.canonical);
  const rowsB = await b.marketCandles("MU", "30m", { limit:240 });
  assert.deepEqual(plain(rowsB), plain(rowsA), "the same rows, from the one copy");
  assert.equal(candleCalls(st.calls).length, 1, "one chart-API read for two frames");
  assert.equal(st.calls.filter((u) => u.startsWith("/universe")).length, 1, "and one ownership proof: the second frame adopts it");
  /* the key is the exact request: another width or another length is another read */
  await b.marketCandles("MU", "30m", { limit:600 });
  await b.marketCandles("MU", "4h", { limit:240 });
  assert.equal(candleCalls(st.calls).length, 3);
  assert.equal(b.candleCacheStats().entries, 3);
});

test("the cache lives on the deck and holds only strings and numbers, so a removed frame is never kept alive", async () => {
  const st = station();
  await st.frame(st.canonical).marketCandles("MU", "30m", { limit:240 });
  const store = st.top.__SC_PROVIDER_CANDLES_V1;
  assert.ok(store, "kept on the highest same-origin window");
  assert.ok(store.text instanceof Map && store.expires instanceof Map, "made with the deck's own constructors");
  for (const v of store.text.values()) assert.equal(typeof v, "string");
  for (const v of store.expires.values()) assert.equal(typeof v, "number");
  assert.equal(typeof store.ownedSyms, "string", "the ownership proof is shared as one string");
  assert.match(provider, /A string belongs to no frame, so a frame that is removed is never kept\s+alive by what it cached/);
});

test("failures and named absences are never cached", async () => {
  const st = station();
  const f = st.frame(st.canonical);
  await assert.rejects(() => f.marketCandles("BE", "1W", { limit:400 }), (e) => e.scAbsence === "FMP_INTERVAL_NOT_SERVED");
  await assert.rejects(() => f.marketCandles("BE", "1W", { limit:400 }), (e) => e.scAbsence === "FMP_INTERVAL_NOT_SERVED");
  assert.equal(candleCalls(st.calls).length, 2, "asked again: an absence is not an answer to keep");
});

test("an entry lasts until the next bar can close: the next :00/:30, 45 s just after one, never past the frame's own refresh", () => {
  const P = station().frame(null);
  const at = (hhmmss) => Date.parse("2026-09-28T" + hhmmss + "Z");
  assert.equal(P.candleTtlMs("30", at("16:12:00")), 18 * 60000, "12 past: until the half hour");
  assert.equal(P.candleTtlMs("30", at("16:01:00")), 45000, "1 min after a close: the bar may still be publishing");
  assert.equal(P.candleTtlMs("30", at("16:03:00")), 27 * 60000);
  assert.equal(P.candleTtlMs("240", at("16:04:00")), 10 * 60000, "intraday: never longer than the frame's 10 min");
  assert.equal(P.candleTtlMs("D", at("16:04:00")), 26 * 60000, "daily: still ends at the half hour");
  assert.equal(P.candleTtlMs("W", at("16:31:00")), 45000);
  assert.match(provider, /"COMPLETED_PROVIDER_BARS_ONLY"/, "why a bar-close expiry is exact: the API serves completed bars only");
});

test("an expired entry is read again", async () => {
  let now = Date.parse("2026-09-28T16:12:00Z");
  class Clock extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } }
  const st = station(Clock);
  const f = st.frame(st.canonical);
  await f.marketCandles("MU", "30m", { limit:240 });
  now += 17 * 60000;
  await f.marketCandles("MU", "30m", { limit:240 });
  assert.equal(candleCalls(st.calls).length, 1, "16:29: still inside the bar");
  now += 2 * 60000;
  await f.marketCandles("MU", "30m", { limit:240 });
  assert.equal(candleCalls(st.calls).length, 2, "16:31: a new bar can exist");
});

/* ---- 3. the Geiger reading is there before the fade ---------------------------------------- */
test("the deck reads Geiger for every name its rotating slots cycle through, and posts it before the fade", () => {
  assert.match(deck, /function geigerChartTickers\(\) \{/);
  assert.match(deck, /SLOT_ROT\.marks\.slice\(0, CHART_COUNT\)\.forEach\(\(m\) => \{ if \(m && m\.names\) cycles\.push\(\.\.\.m\.names\); \}\);/);
  assert.match(deck, /const tickers = geigerChartTickers\(\);\n  const key = tickers\.slice\(\)\.sort\(\)\.join\(","\);/,
    "a sorted key: stepping inside a cycle is not a new set and costs no read");
  const fade = deck.slice(deck.indexOf("const fadeIn = () => {"), deck.indexOf("function stepRotatingSlots"));
  assert.ok(fade.indexOf("postDeckGeiger(f);") < fade.indexOf('f.classList.add("in")'), "the reading goes first");
  assert.match(fade, /!DECK_GEIGER\.readings\[ticker\] && DECK_GEIGER\.inFlight/, "a read still out is waited for");
  assert.match(deck, /const SLOT_GEIGER_WAIT_MS = 2000;/, "for at most 2 s");
});

/* ---- 4. a held slot is skipped ------------------------------------------------------------- */
const mark = (names, at) => ({ at, of:names.length, names });
test("a held slot keeps its name and the others move past it", () => {
  /* two slots cycling one list in step (size 2): slot 0 is held on QQQ, slot 1's next would be QQQ */
  const list = ["SPY", "QQQ", "BE", "AMZN"];
  const plan = arr(scenes.slotStepPlan(["BE", "QQQ"], [mark(list, 3), mark(list, 2)], ["QQQ", "AMZN"], [true, false]));
  assert.equal(plan[0], null, "the held slot does not move");
  assert.equal(plan[1].ticker, "BE", "the neighbour skips the held name and takes the next free one");
  assert.equal(plan[1].mark.at, 3, "and its mark points at the name it actually shows");
});

test("no step plan ever puts one name in two slots, whatever is held", () => {
  for (const id of scenes.WORKFLOW_IDS) for (let visit = 1; visit < 10; visit++) {
    const opts = { visit, at:new Date("2026-09-23T15:00:00Z") };
    const before = arr(scenes.workflowPageState(id, Object.assign({}, opts, { visit:visit - 1 })).tickers);
    const next = arr(scenes.workflowPageState(id, opts).tickers);
    const marks = arr(scenes.workflowSlotRotation(id, opts));
    for (let h = 0; h < 1 << Math.min(before.length, 6); h++) {
      const held = before.map((_, i) => !!(h & (1 << i)));
      const plan = arr(scenes.slotStepPlan(next, marks, before, held));
      const after = before.map((t, i) => plan[i] ? plan[i].ticker : t);
      assert.equal(new Set(after).size, after.length, `${id} visit ${visit} held ${held.map(Number).join("")}: ${after.join(",")}`);
      held.forEach((isHeld, i) => { if (isHeld) assert.equal(plan[i], null, "a held slot never moves"); });
    }
  }
});

test("with nothing held, the plan is exactly the page's own next window", () => {
  for (const id of scenes.WORKFLOW_IDS) for (let visit = 1; visit < 8; visit++) {
    const opts = { visit, at:new Date("2026-09-23T15:00:00Z") };
    const before = arr(scenes.workflowPageState(id, Object.assign({}, opts, { visit:visit - 1 })).tickers);
    const next = arr(scenes.workflowPageState(id, opts).tickers);
    const plan = arr(scenes.slotStepPlan(next, arr(scenes.workflowSlotRotation(id, opts)), before, before.map(() => false)));
    assert.deepEqual(before.map((t, i) => plan[i] ? plan[i].ticker : t), next, id);
  }
});

test("deck: one plan per step, and a fade never lands on a name another slot still shows", () => {
  assert.match(deck, /const plan = SceneModel\.slotStepPlan\(next\.slice\(0, count\)\.map\(CLEAN\), marks\.slice\(0, count\), current, held\);/);
  assert.match(deck, /!shownElsewhere\(i, ticker\);/);
  assert.match(deck, /function shownElsewhere\(i, ticker\) \{/);
});

/* ---- 5. the rotation mark lists the tickers ----------------------------------------------- */
test("the rotation mark is the cycle's names, the one on screen bright, fitted to the room left of the Geiger chip", () => {
  assert.match(chart, /function rotationMarkRuns\(mark, keep\) \{/);
  assert.match(chart, /name\.className = r\.now \? "sc-nchart__rot-name is-now" : "sc-nchart__rot-name";/);
  assert.match(chart, /for \(let keep = all\.length; keep >= 1; keep--\) \{/, "widest first, narrowing until the row fits");
  assert.match(chart, /return right - chipW - badge\.offsetLeft;/, "the room ends where the chip begins");
  assert.match(chart, /paintRotationMark\(badge\);  \/\* the rotation list leaves the chip its room \(L6\) \*\//);
  for (const sel of [".sc-nchart__live-rot", ".sc-nchart__rot-name.is-now", ".sc-nchart__rot-sep, .sc-nchart__rot-more"]) {
    const rule = chart.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}"));
    assert.ok(rule, sel);
    for (const hex of rule[1].match(/#[0-9a-f]{6}/gi) || []) {
      const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
      assert.ok(Math.max(...c) <= 210 && Math.max(...c) - Math.min(...c) <= 24, `${sel} ${hex} is a grey, never white`);
    }
  }
  assert.match(chart.match(/\.sc-nchart__live-rot\{([^}]*)\}/)[1], /font:700 11px/, "11 px: readable at 8-up");
  assert.equal(read("station-shells/chart-v1/index.html"), chart);
});

test("the mark's runs: the whole cycle, or the name on screen and what follows it, and '+n'", () => {
  const src = chart.slice(chart.indexOf("function rotationMarkRuns"), chart.indexOf("function paintRotationRuns"));
  const runs = new Function(src + "; return rotationMarkRuns;")();
  const m = { at:2, of:5, names:["XLP", "XLV", "XLU", "XLRE", "XLB"] };
  assert.deepEqual(runs(m).map((r) => (r.now ? "*" : "") + r.t), ["XLP", "*XLV", "XLU", "XLRE", "XLB"]);
  assert.deepEqual(runs(m, 2).map((r) => r.more ? "+" + r.more : (r.now ? "*" : "") + r.t), ["*XLV", "XLU", "+3"]);
  assert.deepEqual(runs({ at:5, of:5, names:m.names }, 2).map((r) => r.more ? "+" + r.more : r.t), ["XLB", "XLP", "+3"], "wraps");
});

/* ---- 6. the timeframe tag stays off the tickers ------------------------------------------- */
test("the timeframe tag moves to end just left of a pane seam at the wall's centre", () => {
  assert.match(deck, /function placeTfNow\(\) \{/);
  assert.match(deck, /fitDock\(\);\n  placeTfNow\(\);\n  measure\(\);/, "placed on every layout");
  assert.match(deck, /#tfNow\.at-seam\{ transform:translateX\(-100%\); \}/);
  assert.match(deck, /tag\.style\.left = left;/);
  assert.match(deck, /if \(typeof fanoutDeckGeiger === "function"\) fanoutDeckGeiger\(\);/, "the charts re-place their chips around it");
});

test("the Geiger read set is the names on screen plus every rotating slot's whole cycle", () => {
  const start = deck.indexOf("function geigerChartTickers() {");
  let depth = 0, end = start;
  for (let i = deck.indexOf("{", start); i < deck.length; i++) { if (deck[i] === "{") depth++; else if (deck[i] === "}" && --depth === 0) { end = i + 1; break; } }
  const b = { SceneModel: { WORKFLOW_IDS: ["sectors3D"] }, SCENE: "sectors3D", CHART_COUNT: 8,
    CLEAN: (x) => String(x || "").trim().toUpperCase(),
    visibleChartTickers: () => ["XLK", "XLI", "XLC", "XLF", "XLY", "XLE", "XLP", "XLV"],
    SLOT_ROT: { marks: [null, null, null, null, null, null, mark(["XLP", "XLU", "XLB", "XLV", "XLRE"], 1), mark(["XLV", "XLRE", "XLP", "XLU", "XLB"], 1)] } };
  vm.createContext(b);
  const fn = vm.runInContext("(" + deck.slice(start, end) + ")", b);
  assert.deepEqual(arr(fn()).sort(), ["XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY"]);
  b.SCENE = "manual";
  assert.equal(arr(fn()).length, 8, "a page that does not rotate reads only what is on screen");
});

test("two reads of the same series at the same moment in one frame go out once", async () => {
  const st = station();
  const f = st.frame(st.canonical);
  await f.marketCandles("AAPL", "30m", { limit:5 });           /* ownership proven first, as in the pane */
  const before = candleCalls(st.calls).length;
  const [a, b] = await Promise.all([f.marketCandles("MU", "1D", { limit:400 }), f.marketCandles("MU", "1D", { limit:400 })]);
  assert.deepEqual(plain(a), plain(b));
  assert.equal(candleCalls(st.calls).length - before, 1);
});
