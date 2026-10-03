/* S1-STATION-FOLLOWUPS (SCI-11), 25 Sep 2026. Three follow-ups to P1-STATION-MODES:
   1 · hidden chart frames stay alive on the desk, and a phone pauses from the bottom of the wall;
   2 · a bare pane for the Hub (?bare=hub): no ladder, no header strip, its own quote heartbeat;
   3 · SAVE AS RADAR also likes the names (hub_favorites), adding and never removing.
   The deck's functions run with stubbed neighbours; what needs a browser is proved headlessly in
   deliverables/20260925/station-followups. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const chartShell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const CLEAN = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);
const GLOBAL = "00000000-0000-0000-0000-000000000000";

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

/* ── 1 · HIDDEN CHARTS STAY ALIVE ON THE DESK; A PHONE PAUSES FROM THE BOTTOM ─────────── */
test("hidden chart frames are kept only on a desk at least 1280 px wide", () => {
  assert.match(deck, /const KEEP_HIDDEN_CHARTS_AT = 1280;/);
  for (const [stacked, width, keep] of [[false, 1680, true], [false, 1280, true], [false, 1279, false], [false, 1024, false], [true, 390, false], [true, 1680, false]]) {
    const keeps = arrowFromDeck("keepsHiddenCharts", { STACKED: stacked, innerWidth: width, KEEP_HIDDEN_CHARTS_AT: 1280 });
    assert.equal(keeps(), keep, `stacked=${stacked} width=${width}`);
  }
});

test("a page with fewer charts hides the unused frames on the desk instead of removing them", () => {
  const body = deck.slice(deck.indexOf("function applyChartCount("), deck.indexOf("/* COPY LAYOUT."));
  assert.match(body, /if \(!active && o\.frame\) \{\n\s+if \(keepsHiddenCharts\(\)\) return;\s+\/\* hidden by \.chart-off, still mounted \*\/\n\s+o\.frame\.remove\(\); o\.frame = null;/,
    "on the desk the frame stays; elsewhere it is removed exactly as before");
  assert.match(deck, /#rowTop > \.pane\.chart-off\{ display:none; \}/, "an unused slot is hidden, not shown empty");
  const sync = deck.slice(deck.indexOf("function syncChartPanes("), deck.indexOf("async function applyScene("));
  assert.match(sync, /if \(i >= CHART_COUNT && o\.frame && keepsHiddenCharts\(\)\) return;\n\s+if \(!ticker && o\.frame\) \{/,
    "an unused slot's frame is left untouched (not emptied, not reloaded while nobody can see it)");
});

function wallRig({ cap = 2, live = [], keys = ["c1","c2","c3","c4","c5","c6","c7","c8","vidA","x"] } = {}) {
  const PANES = keys.map((key) => ({ def:{ key, kind: key.startsWith("c") ? "chart" : "video", src:"/chart/?t=" + key, ticker:key },
    frame:null, isDock:false, cards:[],
    body:{ kids:[], querySelector(){ return null; }, appendChild(n){ this.kids.push(n); } } }));
  for (const p of PANES) p.showCard = (note) => p.cards.push(note);
  const frame = () => ({ setAttribute(){}, addEventListener(){}, remove(){ this.removed = true; } });
  const LIVE = [];
  for (const key of live) { const p = PANES.find((x) => x.def.key === key); p.frame = frame(); LIVE.push(p); }
  const b = { PANES, LIVE, LIVE_CAP: cap, SCENE:"ai1", FRAME_ALLOW:"", PAUSED_NOTE:"paused to keep the page light — tap to bring it back",
    document:{ createElement: frame }, paintChips(){}, postViewProfile(){}, postDeckQuote(){}, deckQuoteHeartbeat(){},
    DECK_QUOTES: new Map(), CLEAN };
  b.wallOrder = arrowFromDeck("wallOrder", b);
  b.lowestOnWall = functionFromDeck("lowestOnWall", b);
  b.mount = functionFromDeck("mount", b);
  const pane = (key) => PANES.find((x) => x.def.key === key);
  return { b, pane, live: () => LIVE.map((p) => p.def.key) };
}

test("on a phone the budget pauses the pane lowest on the wall, so chart 1 stays live", () => {
  const { b, pane, live } = wallRig({ live: ["c1", "c2"] });
  b.mount(pane("c3"));
  assert.deepEqual(live(), ["c1", "c2"], "the top two stay live");
  assert.equal(pane("c3").frame, null, "the lower chart is never mounted just to be thrown away");
  assert.deepEqual(pane("c3").cards, [b.PAUSED_NOTE]);
  assert.equal(pane("c1").cards.length, 0, "chart 1 is not paused (it was, on every page, before)");
});

test("a pane higher on the wall takes the budget from the lowest one", () => {
  const { b, pane, live } = wallRig({ live: ["c2", "c3"] });
  b.mount(pane("c1"));
  assert.deepEqual(live().sort(), ["c1", "c2"]);
  assert.equal(pane("c3").frame, null);
  assert.deepEqual(pane("c3").cards, [b.PAUSED_NOTE]);
});

test("a tap always brings the tapped pane back, pausing the lowest other one", () => {
  const { b, pane, live } = wallRig({ live: ["c1", "c2"] });
  b.mount(pane("c5"), { explicit:true });
  assert.deepEqual(live().sort(), ["c1", "c5"], "c5 was tapped, so c2 (the lowest other) pauses");
  assert.deepEqual(pane("c2").cards, [b.PAUSED_NOTE]);
  for (const call of ['else mount(obj, { explicit:true });', 'if (o && !o.frame && !o.isDock) mount(o, { explicit:true });',
    'if (!o.frame && !o.isDock) { mount(o, { explicit:true }); return; }', '} else if (index < CHART_COUNT) mount(o, { explicit:true });'])
    assert.ok(deck.includes(call), "a user action mounts explicitly: " + call);
});

test("the desk's budget is unchanged and fits the kept frames", () => {
  assert.match(deck, /const LIVE_CAP = STACKED \? 2 : 12;/);   /* S11 (3 Oct): nine charts, two video panes and X */
  const { b, pane, live } = wallRig({ cap: 11, live: ["c1","c2","c3","c4","c5","c6","c7","c8","vidA"] });
  b.mount(pane("x"));
  assert.equal(live().length, 10, "eight charts (shown or hidden), the video on the wall and X: nothing paused");
});

/* ── 2 · A BARE PANE FOR THE HUB ─────────────────────────────────────────────────────────── */
function chartModes(search, framed) {
  const start = chart.indexOf("const BARE_PARAM = ");
  const end = chart.indexOf("\n", chart.indexOf("const DECK_QUOTE_MODE = ", start));
  const ctx = { BARE:false, QS: new URLSearchParams(search), window:{} };
  ctx.window.parent = framed ? {} : ctx.window;
  return vm.runInNewContext(chart.slice(start, end) + "\n({ BARE, HUB_PANE, DECK_QUOTE_MODE })", ctx);
}

test("?bare=hub hides what bare=1 hides but keeps its own quote heartbeat, even inside another site's frame", () => {
  assert.deepEqual({ ...chartModes("?bare=hub&t=NVDA", true) }, { BARE:true, HUB_PANE:true, DECK_QUOTE_MODE:false });
  assert.deepEqual({ ...chartModes("?bare=1&t=NVDA", true) }, { BARE:true, HUB_PANE:false, DECK_QUOTE_MODE:true }, "the deck's panes are unchanged");
  assert.deepEqual({ ...chartModes("?bare=1&t=NVDA", false) }, { BARE:true, HUB_PANE:false, DECK_QUOTE_MODE:false });
  assert.deepEqual({ ...chartModes("?t=NVDA", true) }, { BARE:false, HUB_PANE:false, DECK_QUOTE_MODE:false }, "the Hub's current URL");
  assert.match(chart, /html\.bare \.sc-nchart__bar\{ display:none; \}/, "the ladder and the header strip hide under html.bare");
  assert.match(chart, /if \(!DECK_QUOTE_MODE\) setInterval\(\(\) => pullPrevClose\(S\.chartT\), 10000\);/, "the ten-second heartbeat runs when not in deck-quote mode");
});

test("a Hub pane never waits for a deck's load grant and never talks to its parent", () => {
  assert.match(chart, /if \(window\.parent === window \|\| HUB_PANE\) return Promise\.resolve\(\(\) => \{\}\);/,
    "no 5.5 s wait for a grant a cross-site parent would never send");
  assert.match(chart, /if \(!BARE \|\| HUB_PANE \|\| window\.parent === window \|\| host\._broadcastQueued\) return;/);
  assert.match(chart, /ticker\.title = HUB_PANE \? "" : "Edit ticker";\n\s+if \(!HUB_PANE\) ticker\.addEventListener\("click"/);
  assert.match(chart, /· \?bare=hub \(the Hub's company view/, "the header documents the new mode");
});

test("clouds, RSI and the timeframe still come from the URL in the Hub pane", () => {
  assert.match(chart, /let CLOUDS_ON = QS\.has\("clouds"\) \? QS\.get\("clouds"\) !== "0"/);
  assert.match(chart, /const RSI_REQUEST = window\.SC_RSI_FAN \? window\.SC_RSI_FAN\.parseRsiParam\(QS\.get\("rsi"\)\)/);
  assert.match(chart, /chartRange: \(function\(\)\{ const r = QS\.get\("range"\); return CHART_RANGES\.includes\(r\) \? r : "3h"; \}\)\(\),/);
});

test("the two chart pages are still byte-identical", () => {
  assert.equal(chart, chartShell);
});

/* ── 3 · SAVE AS RADAR LIKES THE NAME ────────────────────────────────────────────────────── */
function likeRig({ liked = ["MU"], failRead = false, failTable = false, failDoor = false } = {}) {
  const calls = [];
  const b = { CLEAN, Array, HUB_LIKED_OWNER: GLOBAL,
    pg: async (path) => { calls.push({ op:"read", path }); if (failRead) throw new Error("pg 500"); return liked.map((ticker) => ({ ticker })); },
    pgWrite: async (path, body, headers) => { calls.push({ op:"write", path, body, headers }); if (failTable) throw new Error("pg write 401"); },
    hubLikeDoor: async (ticker) => { calls.push({ op:"door", ticker }); if (failDoor) throw new Error("hub like 500"); } };
  return { calls, like: functionFromDeck("likeNamesOnHub", b), receipt: functionFromDeck("likeReceipt", {}) };
}

test("liking writes only the names not yet liked, under the Hub's global owner, ignoring duplicates", async () => {
  const { calls, like, receipt } = likeRig({ liked: ["MU", "AAPL"] });
  const got = await like(["CDNS", "MU", "NVDA"]);
  assert.equal(calls[0].path, "hub_favorites?select=ticker", "read what is liked first (every owner, as the Hub reads it)");
  assert.equal(calls[1].path, "hub_favorites?on_conflict=ticker,owner_id");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].body)), [{ ticker:"CDNS", owner_id:GLOBAL }, { ticker:"NVDA", owner_id:GLOBAL }]);
  assert.deepEqual({ ...calls[1].headers }, { Prefer:"resolution=ignore-duplicates,return=minimal" },
    "a name already liked keeps its row and its place (never merged over, never re-dated)");
  assert.equal(calls.length, 2, "one read, one write, nothing else");
  assert.equal(receipt(got), " · liked +2");
});

test("names that are all liked already cost no write", async () => {
  const { calls, like, receipt } = likeRig({ liked: ["CDNS", "NVDA"] });
  const got = await like(["CDNS", "NVDA"]);
  assert.deepEqual(calls.map((c) => c.op), ["read"]);
  assert.equal(receipt(got), " · all liked");
});

test("if the table refuses a direct write, the Hub's own ♥ door adds the same names, one by one", async () => {
  const { calls, like, receipt } = likeRig({ failTable: true });
  const got = await like(["CDNS", "NVDA"]);
  assert.deepEqual(calls.filter((c) => c.op === "door").map((c) => c.ticker), ["CDNS", "NVDA"]);
  assert.equal(got.via, "hub");
  assert.equal(receipt(got), " · liked +2");
  const door = deck.slice(deck.indexOf("async function hubLikeDoor("), deck.indexOf("async function likeNamesOnHub("));
  assert.match(door, /JSON\.stringify\(\{ action:"fav_add", ticker \}\)/, "the door is asked to ADD");
  assert.match(deck, /const HUB_LIKE_DOOR = SB \+ "\/functions\/v1\/operator-write";/);
});

test("a failed like says so and never pretends", async () => {
  const { like, receipt } = likeRig({ failTable: true, failDoor: true });
  assert.equal(receipt(await like(["CDNS"])), " · like failed");
});

test("an unreadable liked list still likes every name (duplicates are ignored) and does not claim a count", async () => {
  const { calls, like, receipt } = likeRig({ failRead: true });
  const got = await like(["CDNS", "MU"]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].body)).map((r) => r.ticker), ["CDNS", "MU"]);
  assert.equal(receipt(got), " · liked");
});

test("SAVE AS RADAR likes every saved name, even one already on RADAR, and the button carries both receipts", async () => {
  const calls = [];
  const button = { textContent: "save as radar" };
  const radarRows = [{ position:1, ticker:"MU" }, { position:2, ticker:"CDNS" }, { position:3, ticker:"NVDA" }];
  const read = async (path) => { calls.push({ op:"read", path }); return path.startsWith("hub_favorites") ? [{ ticker:"MU" }] : radarRows; };
  const write = async (path, body, headers) => { calls.push({ op:"write", path, body, headers }); };
  const likeNamesOnHub = functionFromDeck("likeNamesOnHub", { CLEAN, Array, pg: read, pgWrite: write, HUB_LIKED_OWNER: GLOBAL, hubLikeDoor: async () => {} });
  const save = functionFromDeck("saveScratchRadar", {
    CHARTS: ["CDNS", "NVDA", "", "", "", "", "", ""], CLEAN, el: () => button,
    SAVE_RADAR_REVERT: null, setTimeout: () => 0, clearTimeout: () => {}, Array, Set, Math, Number, Date,
    pg: read, pgWrite: write, likeNamesOnHub, likeReceipt: functionFromDeck("likeReceipt", {}) });
  await save();
  assert.ok(!calls.some((c) => c.op === "write" && c.path.startsWith("station_lists")), "both names were on RADAR already: no list write");
  const likeWrite = calls.find((c) => c.op === "write" && c.path.startsWith("hub_favorites"));
  assert.deepEqual(JSON.parse(JSON.stringify(likeWrite.body)).map((r) => r.ticker), ["CDNS", "NVDA"],
    "on RADAR but never liked: the Hub's RADAR tab could not show them; now it can");
  assert.equal(button.textContent, "already on radar · 3 names · liked +2");
});

test("nothing on the Station ever unlikes or deletes a liked name", () => {
  assert.doesNotMatch(deck, /fav_remove/);
  assert.doesNotMatch(deck, /pgDelete\("hub_favorites/);
  assert.doesNotMatch(deck, /hub_favorites[^"\n]*resolution=merge-duplicates/);
});
