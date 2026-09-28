/* THE HUB'S GEIGER COMPOSITE BAR ON STATION CHARTS (G1-STATION-GEIGER-BAR, 27 Sep 2026).
   ============================================================================
   Alan: "what I do really like is the Geiger composite bar at the top left… adding the Geiger bars
   to the Station charts somewhere small. Very small, very executive."
   What this suite proves, without a browser:
     1. the reading: the Hub's fixed -1...+1 scale and fill rule (centre out, |v| clamped to half the
        track), green at or above zero and red below, the pane's own --bull / --bear;
     2. no reading is no bar: null, "", undefined and NaN never become a zero;
     3. the age rule: each owner's measured cadence plus the Station's pickup delay, and an unstamped
        reading is never called stale;
     4. the pane: the bar sits after the price, hides for a name without a reading, dims when stale,
        takes the deck's map, and reads its own single reading only when no deck is answering;
     5. the deck: ONE read for the whole visible set, repeated only on a set change or after a
        minute, one map posted to every chart frame;
     6. the wiring pins: both chart twins and the deck load the module, the twins stay identical,
        the single-symbol provider read keeps the Equalizer gate. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const context = { Date, Math, Number, JSON, Array, Object, String, RegExp };
vm.runInNewContext(read("../_indicators/station-geiger-bar.js"), context);
const G = context.SC_GEIGER_BAR;
const plain = (v) => JSON.parse(JSON.stringify(v));
const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html");
const deck = read("../deck/index.html"), provider = read("../_provider/provider.js");

function fnFrom(source, name, bindings = {}) {
  let start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  if (source.slice(start - 6, start) === "async ") start -= 6;
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}

const NOW = Date.parse("2026-09-27T15:40:00Z");
const provider1 = (composite, stamp = "2026-09-27T15:37:16.988Z") => ({ composite, stamp, source: "PROVIDER_EQUALIZER" });

test("the Hub's scale: centre out, right and green at or above zero, left and red below, clamped at half", () => {
  const up = G.model(provider1(0.761361), NOW);
  assert.equal(up.side, "up");
  assert.equal(up.text, "+0.76");
  assert.ok(Math.abs(up.fillPct - 38.068) < 0.001, "the Hub's Math.min(|c|,1)*50: " + up.fillPct);
  assert.equal(G.fillStyle(up), "left:50%;width:38.07%");
  const down = G.model(provider1(-0.3456), NOW);
  assert.equal(down.side, "down");
  assert.equal(down.text, "−0.35", "a real minus sign, as the Hub prints it");
  assert.equal(G.fillStyle(down), "right:50%;width:17.28%");
  assert.equal(G.model(provider1(1.7), NOW).fillPct, 50, "beyond the scale is the scale's end, never past the track");
  assert.equal(G.model(provider1(-4), NOW).fillPct, 50);
  const zero = G.model(provider1(0), NOW);
  assert.equal(zero.side, "up", "exactly zero is at-or-above: a direction, never a grey band");
  assert.equal(zero.text, "+0.00");
  assert.equal(zero.fillPct, 0);
  assert.equal(G.model(provider1("0.52"), NOW).value, 0.52, "a numeric string is a reading");
});

test("no reading is no bar - never a fake zero", () => {
  for (const composite of [null, undefined, "", NaN, "n/a", true, Infinity])
    assert.equal(G.model(provider1(composite), NOW), null, "composite " + String(composite) + " draws nothing");
  assert.equal(G.model(null, NOW), null);
  assert.equal(G.model(undefined, NOW), null);
  assert.equal(G.value(null), null, "Number(null) would be 0 - the parser refuses it");
  const map = G.readingsFrom([
    { ticker: "MU", composite: 0.76, computed_utc: "2026-09-27T15:37:16Z" },
    { ticker: "ESUSD", composite: null, updated_ts: 1790523120 },
    { ticker: "", composite: 0.5 },
  ], "PROVIDER_EQUALIZER");
  assert.deepEqual(Object.keys(map), ["MU"], "a row without a reading is simply absent from the map");
});

test("the same two colours the Hub uses, and nothing white or grey drawn as a line", () => {
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  assert.match(chart, /--bull:#00FFA3; --bear:#FF2D55;/, "the pane's direction inks are the Hub's --gs-bull / --gs-bear");
  const css = chart.match(/\.sc-nchart__live-geiger\{[\s\S]*?\.sc-gbar__v\{[^}]*\}/)[0];
  assert.match(css, /\[data-side="up"\]\{ color:var\(--bull\); \}/);
  assert.match(css, /\[data-side="down"\]\{ color:var\(--bear\); \}/);
  assert.match(css, /\.sc-gbar\{[^}]*width:48px; height:6px;/, "48 x 6, as asked");
  assert.match(css, /\.sc-gbar__v\{ font:700 \.86em var\(--mono\)/, "the number is the badge price's own size");
  assert.match(chart, /\.sc-nchart__live-change\{ font:700 \.86em var\(--mono\)/, "(which is this)");
  for (const hex of css.match(/#[0-9a-fA-F]{6}\b/g) || []) {
    const c = rgb(hex);
    assert.ok(Math.max(...c) <= 210, hex + " goes above 210 - no white");
  }
  assert.doesNotMatch(css, /#fff\b|white/i);
  assert.match(css, /\.sc-gbar::before\{[^}]*background:#05060c;/, "the zero mark is a dark notch cut in the track, not a grey line");
});

test("the age rule: each owner's measured cadence plus the Station's pickup, and unstamped is not stale", () => {
  assert.equal(G.SOURCES.PROVIDER_EQUALIZER.cadenceMs, 240000, "/geiger recomputed 15:29:10 -> 15:33:21 -> 15:37:17 on 27 Sep");
  assert.equal(G.SOURCES.RETAINED_NON_EQUITY.cadenceMs, 60000, "the non-equity row re-stamped every 60 s");
  assert.equal(G.PICKUP_MS, 90000, "one deck minute plus the provider client's 30 s hold");
  const at = (ms) => new Date(NOW - ms).toISOString();
  assert.equal(G.model(provider1(0.4, at(329000)), NOW).stale, false, "5 min 29 s old: inside one cadence plus pickup");
  assert.equal(G.model(provider1(0.4, at(331000)), NOW).stale, true, "5 min 31 s old: a recompute has been missed");
  const ne = (sec) => ({ composite: -0.85, stamp: Math.round((NOW - sec * 1000) / 1000), source: "RETAINED_NON_EQUITY" });
  assert.equal(G.model(ne(140), NOW).stale, false, "epoch SECONDS are read as seconds");
  assert.equal(G.model(ne(160), NOW).stale, true);
  const untimed = G.model(provider1(0.4, null), NOW);
  assert.equal(untimed.stale, false, "no stamp, no claim either way");
  assert.match(untimed.title, /no compute time on this reading/);
  const stale = G.model(provider1(0.4, at(3 * 3600e3)), NOW);
  assert.match(stale.title, /computed 2026-09-27T12:40:00Z · 3 h old\nolder than this source normally is/);
  assert.equal(G.stampMs(1790523120), 1790523120000);
  assert.equal(G.stampMs("1790523120"), 1790523120000);
  assert.equal(G.stampMs(1790523120000), 1790523120000);
  assert.equal(G.stampMs("garbage"), null);
});

/* ---- the pane, in a small DOM stand-in -------------------------------------------------------- */
class Node {
  constructor(cls) { this.className = cls || ""; this.children = []; this.parent = null; this.dataset = {}; this.attrs = {};
    this.hidden = false; this.textContent = ""; this.title = ""; }
  set innerHTML(html) {
    this.children = [];
    if (/sc-gbar/.test(html)) {
      const bar = new Node("sc-gbar"), fill = new Node(""), v = new Node("sc-gbar__v");
      fill.tag = "i"; bar.append(fill); this.append(bar, v);
    }
  }
  append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } }
  appendChild(n) { this.append(n); return n; }
  after(n) { const kids = this.parent.children; n.parent = this.parent; kids.splice(kids.indexOf(this) + 1, 0, n); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "style") this.style = String(v); }
  removeAttribute(k) { delete this.attrs[k]; if (k === "title") this.title = ""; }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
  querySelector(sel) {
    if (sel === "i") return this.all().find((n) => n.tag === "i") || null;
    const cls = sel.replace(/^\./, "");
    return this.all().find((n) => n.className.split(" ").includes(cls)) || null;
  }
}
function paneHarness({ provider: P = null, deckMode = false } = {}) {
  const badge = new Node("sc-nchart__live");
  badge.append(new Node("sc-nchart__live-ticker"), new Node("sc-nchart__live-change"),
    new Node("sc-nchart__live-prev"), new Node("sc-nchart__live-window"));
  const host = new Node("sc-nchart"), area = new Node("sc-nchart__area");
  host.dataset.t = "MU"; host.isConnected = true; host.append(area); area.append(badge);
  const b = { window: { SC_GEIGER_BAR: G, SC_PROVIDER: P }, document: { createElement: () => new Node("") },
    Date, CHART_HOSTS: new Set([host]), DECK_QUOTE_MODE: deckMode };
  b.GEIGER = vm.runInNewContext("({ readings:{}, fromDeck:false, pulling:false })", b);
  /* where the chip sits is emptiestSpot's job (tests/station-fixes-20260927.test.mjs); here it is a no-op */
  b.placeGeiger = () => {};
  /* L6: the chip's paint refits the rotation list first; a fixed slot (no mark) has none */
  b.ROTATION_MARK = null;
  b.paintRotationMark = fnFrom(chart, "paintRotationMark", b);
  b.paintGeigerBar = fnFrom(chart, "paintGeigerBar", b);
  b.paintGeigerBars = fnFrom(chart, "paintGeigerBars", b);
  b.applyDeckGeiger = fnFrom(chart, "applyDeckGeiger", b);
  b.pullGeigerOne = fnFrom(chart, "pullGeigerOne", b);
  const node = () => host.querySelector(".sc-nchart__live-geiger");
  return { b, host, area, badge, node };
}

/* O1 (27 Sep): the bar no longer sits inside the badge (it bunched up there on the 8-up walls). It is
   the chart area's own chip, placed in the emptiest dark patch; the badge keeps ticker and price. */
test("the pane: the bar is its own chip in the chart area, and a name without a reading has none", () => {
  const { b, host, area, badge, node } = paneHarness();
  b.paintGeigerBar(host);
  assert.equal(node(), null, "no reading: nothing is created at all");
  b.applyDeckGeiger({ MU: { composite: 0.761361, stamp: new Date().toISOString(), source: "PROVIDER_EQUALIZER" } });
  assert.equal(b.GEIGER.fromDeck, true);
  assert.deepEqual(badge.children.map((c) => c.className), ["sc-nchart__live-ticker", "sc-nchart__live-change",
    "sc-nchart__live-prev", "sc-nchart__live-window"], "the badge is ticker and price only");
  assert.equal(node().parent, area, "the chip is the chart area's own");
  assert.equal(node().className, "sc-nchart__live-geiger is-float");
  assert.equal(node().hidden, false);
  assert.equal(node().dataset.side, "up");
  assert.equal(node().dataset.stale, "0");
  assert.equal(node().querySelector(".sc-gbar__v").textContent, "+0.76");
  assert.equal(node().querySelector("i").style, "left:50%;width:38.07%");
  assert.match(node().title, /^Geiger composite \+0\.76 \(scale −1 to \+1\)\nchart API \/geiger/);
  /* the pane's ticker changes to a name the deck has no reading for */
  host.dataset.t = "PCC";
  b.paintGeigerBar(host);
  assert.equal(node().hidden, true, "the old name's bar goes; nothing stands in for it");
  assert.equal(node().title, "");
  /* a stale reading dims */
  host.dataset.t = "VIX";
  b.applyDeckGeiger({ VIX: { composite: -0.8465, stamp: Math.round(Date.now() / 1000) - 3600, source: "RETAINED_NON_EQUITY" } });
  assert.equal(node().hidden, false);
  assert.equal(node().dataset.side, "down");
  assert.equal(node().dataset.stale, "1");
  assert.equal(node().querySelector("i").style, "right:50%;width:42.33%");
  assert.equal(area.children.filter((c) => /sc-nchart__live-geiger/.test(c.className)).length, 1, "one bar, reused");
  b.applyDeckGeiger(null);
  assert.equal(node().hidden, true, "an empty map from the deck clears every bar");
});

test("the pane alone reads ONE symbol; a refused read is no bar; the deck's map stops the pane reading", async () => {
  const calls = [];
  let answer = () => Promise.resolve([{ ticker: "MU", composite: 0.42, computed_utc: new Date().toISOString() }]);
  const P = { equityGeigerOne: (t) => { calls.push(t); return answer(); } };
  const { b, host, node } = paneHarness({ provider: P });
  await b.pullGeigerOne("MU");
  assert.deepEqual(calls, ["MU"], "one symbol, not the universe");
  assert.equal(node().querySelector(".sc-gbar__v").textContent, "+0.42");
  answer = () => Promise.reject(new Error("provider geiger equalizer receipt not accepted"));
  await b.pullGeigerOne("MU");
  assert.equal(node().hidden, true, "an unaccepted read is never kept on screen");
  b.applyDeckGeiger({ MU: { composite: 0.1, stamp: null, source: "PROVIDER_EQUALIZER" } });
  await b.pullGeigerOne("MU");
  assert.equal(calls.length, 2, "once the deck answers, the pane never reads for itself");
  assert.equal(node().querySelector(".sc-gbar__v").textContent, "+0.10");
});

test("the pane's wiring: deck map on the existing channel, own read only when alone or unanswered", () => {
  assert.match(chart, /if \(d\.sc === "deck-geiger"\) \{ applyDeckGeiger\(d\.readings\); return; \}/);
  /* L2 CHART-SPEED: alone, the pane's own read waits for its chart reads (afterChartWave) */
  assert.match(chart, /if \(!DECK_QUOTE_MODE\) afterChartWave\(\(\) => pullGeigerOne\(S\.chartT\)\);\nelse setTimeout\(\(\) => \{ if \(!GEIGER\.fromDeck\) pullGeigerOne\(S\.chartT\); \}, 4000\);/);
  assert.match(chart, /setInterval\(\(\) => \{ if \(!GEIGER\.fromDeck\) pullGeigerOne\(S\.chartT\); else paintGeigerBars\(\); \}, GEIGER_REFRESH_MS\);/,
    "once a minute: alone it re-reads, in the deck it only re-judges the age");
  assert.match(chart, /const GEIGER_REFRESH_MS = 60000;/);
  assert.match(chart, /scChartLoad\(host\);\n  if \(!GEIGER\.fromDeck && !DECK_QUOTE_MODE\) afterChartWave\(\(\) => pullGeigerOne\(S\.chartT\)\);/, "a new symbol alone reads its own, after its chart reads");
  assert.match(chart, /const parts = ensureLiveParts\(badge, host\);\n  paintGeigerBar\(host\);/, "every readout paint repaints the bar");
  assert.doesNotMatch(chart, /\/geiger/, "the pane never names the route itself - the provider client owns it");
});

/* ---- the deck -------------------------------------------------------------------------------- */
function deckHarness(tickers) {
  const reads = { own: 0, eq: [], ne: [] }, posts = [];
  const frames = tickers.map((t) => ({ def: { kind: "chart", ticker: t },
    frame: { contentWindow: { postMessage: (m) => posts.push(m) } } }));
  frames.push({ def: { kind: "video" }, frame: { contentWindow: { postMessage: (m) => posts.push(m) } } });
  const own = { MU: 1, SPY: 1, QQQ: 1, NVDA: 1, AAPL: 1, AMD: 1 };
  const b = {
    Date, Promise, location: { origin: "https://station.test" }, PANES: frames,
    visibleChartTickers: () => tickers.slice(),
    window: {
      SC_GEIGER_BAR: G,
      SC_PROVIDER: {
        verifyOwnership: () => { reads.own += 1; return Promise.resolve(own); },
        equityGeiger: (syms) => { reads.eq.push(syms.slice()); return Promise.resolve(syms.map((t) => ({ ticker: t,
          composite: t === "AMD" ? null : 0.5, computed_utc: "2026-09-27T15:37:16.988Z" }))); },
      },
      SC_NON_EQUITY: { geiger: (syms) => { reads.ne.push(syms.slice()); return Promise.resolve([{ ticker: "VIX", composite: -0.8465, updated_ts: 1790523120 }]); } },
    },
  };
  b.DECK_GEIGER = vm.runInNewContext('({ key:"", at:0, inFlight:false, rerun:false, readings:{}, setKey:"", setAt:0, holdTimer:0 })', b);
  b.DECK_GEIGER_MS = 60000;
  /* L2 CHART-SPEED: the hold's inputs - every pane has drawn its price and nothing is queued, unless a test says otherwise */
  b.DECK_GEIGER_HOLD_MS = 4000;
  b.chartDataLoadQueue = [];
  b.chartDataLoadActive = new Map();
  b.CHART_STATUS = new Map(["MU", "SPY", "QQQ", "NVDA", "AAPL", "AMD", "VIX", "PCC"].map((t) => [t, { history: "ready" }]));
  b.holdTimers = [];
  b.setTimeout = (fn, ms) => { b.holdTimers.push({ fn, ms }); return b.holdTimers.length; };
  b.deckPricesAndRibbonsSettled = fnFrom(deck, "deckPricesAndRibbonsSettled", b);
  b.postDeckGeiger = fnFrom(deck, "postDeckGeiger", b);
  b.fanoutDeckGeiger = fnFrom(deck, "fanoutDeckGeiger", b);
  /* L6: the read set is the visible names plus every rotating slot's cycle; a fixed page has no cycles */
  b.SceneModel = { WORKFLOW_IDS: [] };
  b.SLOT_ROT = { marks: [] };
  b.SCENE = "fixed"; b.CHART_COUNT = 8; b.CLEAN = (x) => String(x || "").trim().toUpperCase();
  b.geigerChartTickers = fnFrom(deck, "geigerChartTickers", b);
  b.refreshDeckGeiger = fnFrom(deck, "refreshDeckGeiger", b);
  return { b, reads, posts, tickers };
}

test("the deck reads the whole page ONCE and posts one map to every chart frame", async () => {
  const eight = ["MU", "SPY", "QQQ", "NVDA", "AAPL", "AMD", "VIX", "PCC"];
  const { b, reads, posts } = deckHarness(eight);
  await b.refreshDeckGeiger();
  assert.deepEqual(plain(reads.eq), [["MU", "SPY", "QQQ", "NVDA", "AAPL", "AMD"]], "one equity read for all six, funds included");
  assert.deepEqual(plain(reads.ne), [["VIX", "PCC"]], "one non-equity read for the rest");
  assert.equal(posts.length, 8, "one post per chart frame, none to the video pane");
  assert.ok(posts.every((m) => m.sc === "deck-geiger"));
  const map = plain(posts[0].readings);
  assert.deepEqual(Object.keys(map).sort(), ["AAPL", "MU", "NVDA", "QQQ", "SPY", "VIX"], "AMD (no reading) and PCC (none exists) are absent");
  assert.equal(map.MU.source, "PROVIDER_EQUALIZER");
  assert.equal(map.VIX.source, "RETAINED_NON_EQUITY");
  assert.equal(map.VIX.stamp, 1790523120);
  await b.refreshDeckGeiger();
  await b.refreshDeckGeiger();
  assert.equal(reads.eq.length, 1, "the same page inside a minute reads nothing");
  b.DECK_GEIGER.at -= 61000;
  await b.refreshDeckGeiger();
  assert.equal(reads.eq.length, 2, "a minute later it reads again");
});

test("a page change reads at once; a failed owner leaves its names with no bar", async () => {
  const { b, reads, posts } = deckHarness(["MU", "SPY"]);
  await b.refreshDeckGeiger();
  b.visibleChartTickers = () => ["QQQ", "NVDA"];
  b.refreshDeckGeiger = fnFrom(deck, "refreshDeckGeiger", b);
  await b.refreshDeckGeiger();
  assert.deepEqual(plain(reads.eq), [["MU", "SPY"], ["QQQ", "NVDA"]], "the new page is read without waiting out the minute");
  b.window.SC_PROVIDER.equityGeiger = () => Promise.reject(new Error("provider geiger equalizer receipt not accepted"));
  b.DECK_GEIGER.at = 0;
  await b.refreshDeckGeiger();
  assert.deepEqual(plain(posts[posts.length - 1].readings), {}, "refused: the old numbers are not kept");
});

test("the deck's wiring leaves the quote pump alone", () => {
  assert.match(deck, /<script src="\/_indicators\/station-geiger-bar\.js"><\/script>/);
  assert.match(deck, /setInterval\(refreshDeckGeiger, 2000\);/, "its own clock: a page change is picked up within 2 s");
  assert.match(deck, /const DECK_GEIGER_MS = 60000;/);
  assert.match(deck, /postDeckQuote\(pane\.frame, pane\.def\.ticker\); deckQuoteHeartbeat\(\); postDeckGeiger\(pane\.frame\); refreshDeckGeiger\(\);/,
    "a booting chart is handed the map the deck already holds");
  const pump = deck.slice(deck.indexOf("async function refreshDeckQuotes"), deck.indexOf("function deckQuoteHeartbeat"));
  assert.doesNotMatch(pump, /Geiger/i, "the quote pump does not know the bar exists");
});

test("wiring pins: both chart twins load the module and stay identical; the provider's one-symbol read keeps the Equalizer gate", () => {
  assert.equal(chart, twin, "station-shells/chart-v1 is the chart, byte for byte");
  assert.match(chart, /<script src="\/_indicators\/station-rsi-fan\.js"><\/script>\n<!--[^\n]*-->\n<script src="\/_indicators\/station-geiger-bar\.js"><\/script>/);
  const one = provider.slice(provider.indexOf("S.equityGeigerOne = function"), provider.indexOf("S.equityGeiger = function"));
  assert.match(one, /API \+ '\/geiger\?symbols=' \+ encodeURIComponent\(sym\);/, "the light projection: no &detail=1");
  assert.doesNotMatch(one, /detail=1/);
  assert.match(one, /j\.requested !== 1 \|\| j\.returned !== 1 \|\| !j\.symbols\[sym\]/);
  assert.match(one, /if \(!equalizerAccepted\(j\.equalizer_receipt_sha256\)\)/, "the same accepted receipt as the full read");
  assert.match(one, /if \(!own\[sym\]\) return \[\];/, "a non-equity is 'no reading', not a named absence in the price book");
  assert.doesNotMatch(one, /gCache/, "a one-symbol payload never answers for the universe");
});

/* ---- L2 CHART-SPEED (28 Sep): the Geiger read waits for the chart reads -------------------------- */
test("L2: a new page's Geiger read holds while its prices or ribbons load, then goes; never past 4 s", async () => {
  const { b, reads } = deckHarness(["QQQ", "NVDA"]);
  b.CHART_STATUS.set("NVDA", { history: "loading" });
  await b.refreshDeckGeiger();
  assert.equal(reads.eq.length, 0, "a price still loading: the Geiger read waits");
  assert.equal(b.holdTimers.length, 1, "and a timer guarantees it goes by the hold's end");
  assert.ok(b.holdTimers[0].ms <= 4000);
  b.CHART_STATUS.set("NVDA", { history: "ready" });
  b.chartDataLoadQueue.push({ priority: 1 });
  await b.refreshDeckGeiger();
  assert.equal(reads.eq.length, 0, "a ribbon read still queued: it waits");
  b.chartDataLoadQueue.length = 0;
  b.chartDataLoadActive.set("t1", { priority: 3 });
  await b.refreshDeckGeiger();
  assert.deepEqual(plain(reads.eq), [["QQQ", "NVDA"]], "prices drawn and ribbons read: it goes, even with the fan's reads running");
});
test("L2: the hold ends at 4 s whatever is still loading", async () => {
  const { b, reads } = deckHarness(["MU"]);
  b.CHART_STATUS.set("MU", { history: "loading" });
  await b.refreshDeckGeiger();
  assert.equal(reads.eq.length, 0);
  b.DECK_GEIGER.setAt -= 4001;
  await b.refreshDeckGeiger();
  assert.deepEqual(plain(reads.eq), [["MU"]], "past the hold it reads");
  b.CHART_STATUS.set("MU", { history: "loading" });
  await b.refreshDeckGeiger();
  assert.equal(reads.eq.length, 1, "a page already read inside the minute is not held or re-read");
});
test("L2: the pane's own read waits for its chart reads; the wait starts at the price, and a failed price releases it", () => {
  const b = { setTimeout: (fn, ms) => { b.timers.push({ fn, ms }); }, timers: [], GEIGER_WAIT_MAX_MS: 4000 };
  const wave = vm.runInNewContext("({ req:null, done:true, waiters:[] })", b);
  b.CHART_WAVE = wave;
  for (const n of ["chartWaveBegin", "chartWaveEnd", "chartWavePriced", "afterChartWave"]) b[n] = fnFrom(chart, n, b);
  let reads = 0;
  b.chartWaveBegin("MU|1D");
  b.afterChartWave(() => reads++);
  assert.equal(reads, 0, "while the chart reads run, no Geiger read");
  assert.equal(b.timers.length, 0, "no clock runs before the price is on screen");
  b.chartWavePriced("MU|1D");
  assert.equal(b.timers[0].ms, 4000, "from the price, at most 4 s");
  b.chartWaveEnd("MU|1D");
  assert.equal(reads, 1, "settled: it reads, once");
  b.timers[0].fn();
  assert.equal(reads, 1, "the cap firing later does not read again");
  b.afterChartWave(() => reads++);
  assert.equal(reads, 2, "with nothing loading it reads at once");
  b.chartWaveBegin("NVDA|1D");
  b.afterChartWave(() => reads++);
  b.chartWaveEnd("MU|1D");
  assert.equal(reads, 2, "an old symbol's wave cannot release the new one");
  b.chartWaveEnd("NVDA|1D");
  assert.equal(reads, 3);
  assert.match(chart, /if \(host\._req !== req \|\| !host\.isConnected \|\| host\._transitionGeneration !== generation\) return;\n    chartWaveEnd\(req\);/,
    "a failed price load ends the wave (nothing else will be read for it)");
  assert.match(chart, /chartWavePriced\(req\);\n    Promise\.allSettled\(wave\)\.then\(\(\) => chartWaveEnd\(req\)\);/);
});
test("L2: a rotating slot's later names (not on screen, no price yet) do not hold the read", async () => {
  const { b, reads } = deckHarness(["MU", "SPY"]);
  b.SceneModel = { WORKFLOW_IDS: ["targets3D"] }; b.SCENE = "targets3D";
  b.SLOT_ROT = { marks: [{ names: ["MU", "SMCI", "NVDA"] }, null] };
  b.geigerChartTickers = fnFrom(deck, "geigerChartTickers", b);
  b.refreshDeckGeiger = fnFrom(deck, "refreshDeckGeiger", b);
  assert.ok(!b.CHART_STATUS.has("SMCI"), "SMCI has never loaded: it is a later name in the cycle");
  await b.refreshDeckGeiger();
  assert.equal(reads.eq.length, 1, "the two names on screen have their prices: the read goes at once");
  assert.ok(plain(reads.eq[0]).includes("NVDA"), "and it covers the cycle's later names, as L6 made it");
});
