/* EXPAND IN PLACE, THE ROTATION QUEUE, AND THE TWO NEW SHELLS.
   ============================================================================
   What is proved here, without a browser: the detail view mounts over the wall and is
   REMOVED when it closes (the load contract), the "+ rotation" button writes a per-device
   list and not a page change, the zoomed screens and FUNDAMENTALS are menu entries that
   auto-rotate never picks up, and neither new shell writes anything anywhere. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
/* detail.js runs in its own realm, so its arrays are compared as plain data — the same
   rule the clouds suite already follows. */
const plain = (value) => JSON.parse(JSON.stringify(value));
const detailSource = read("../deck/detail.js");
const scenesSource = read("../deck/scenes.js");
const deck = read("../deck/index.html");
const detailShell = read("../station-shells/detail-v1/index.html");
const fundShell = read("../station-shells/fundamentals-v1/index.html");
const math = read("../station-shells/detail-v1/indicators.js");

/* ---- the smallest document that can be told apart from a real one ---- */
function fakeDom() {
  const make = (tag) => {
    const node = {
      tagName:String(tag).toUpperCase(), children:[], parentNode:null, style:{}, dataset:{},
      attrs:{}, listeners:{}, id:"", className:"", textContent:"", src:"", type:"", title:"",
      appendChild(child) { child.parentNode = node; node.children.push(child); return child; },
      removeChild(child) { node.children = node.children.filter((c) => c !== child); child.parentNode = null; return child; },
      setAttribute(k, v) { node.attrs[k] = v; },
      addEventListener(name, fn) { (node.listeners[name] || (node.listeners[name] = [])).push(fn); },
      querySelector(sel) { return find(node, sel); },
      focus() {},
      click() { for (const fn of node.listeners.click || []) fn({ preventDefault() {}, stopPropagation() {}, target:node }); },
      get childElementCount() { return node.children.length; }
    };
    return node;
  };
  const find = (node, sel) => {
    const want = String(sel).split(",")[0].trim().replace(/^\./, "");
    for (const c of node.children) {
      if (String(c.className || "").split(/\s+/).includes(want)) return c;
      const deep = find(c, sel);
      if (deep) return deep;
    }
    return null;
  };
  const body = make("body"), head = make("head");
  const document = {
    body, head, documentElement:head,
    createElement:make,
    getElementById(id) {
      const walk = (n) => { if (n.id === id) return n; for (const c of n.children) { const hit = walk(c); if (hit) return hit; } return null; };
      return walk(head) || walk(body);
    }
  };
  return { document, body, head };
}
function fakeStorage() {
  const map = new Map();
  return { getItem:(k) => (map.has(k) ? map.get(k) : null), setItem:(k, v) => map.set(k, String(v)),
    removeItem:(k) => map.delete(k), _map:map };
}
function load(extra) {
  const dom = fakeDom();
  const ctx = Object.assign({
    document:dom.document, localStorage:fakeStorage(), location:{ search:"" },
    URLSearchParams, JSON, String, Array, Object, Date, Math, Number, console,
    listeners:{},
    addEventListener(name, fn) { (ctx.listeners[name] || (ctx.listeners[name] = [])).push(fn); },
    dispatchEvent() { return true; }, CustomEvent: class { constructor(n, o) { this.type = n; Object.assign(this, o); } }
  }, extra || {});
  ctx.window = ctx;
  vm.runInNewContext(scenesSource, ctx);
  vm.runInNewContext(detailSource, ctx);
  return { ctx, dom, D:ctx.StationDetail, fire:(name, data) => { for (const fn of ctx.listeners[name] || []) fn(data); } };
}

test("the rotation queue holds a ticker once, newest last, and survives a second press", () => {
  const { D, ctx } = load();
  D.addToQueue("mu", "3h", ctx.localStorage, "2026-09-24T18:00:00Z");
  D.addToQueue("SPY", "1D", ctx.localStorage, "2026-09-24T18:01:00Z");
  D.addToQueue("MU", "1D", ctx.localStorage, "2026-09-24T18:02:00Z");   /* pressed again */
  const q = D.readQueue(ctx.localStorage);
  assert.deepEqual(plain(q.map((e) => e.ticker)), ["SPY", "MU"], "one entry per ticker, re-added last");
  assert.equal(q[1].range, "1D", "the second press updated the timeframe rather than duplicating");
  D.removeFromQueue("SPY", ctx.localStorage);
  assert.deepEqual(plain(D.readQueue(ctx.localStorage).map((e) => e.ticker)), ["MU"]);
});

test("the queue is capped, and a storage that refuses to answer costs nothing", () => {
  const { D, ctx } = load();
  for (let i = 0; i < D.QUEUE_MAX + 6; i++) D.addToQueue("T" + i, "3h", ctx.localStorage, "2026-09-24T18:00:00Z");
  assert.equal(D.readQueue(ctx.localStorage).length, D.QUEUE_MAX);
  const hostile = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(plain(D.readQueue(hostile)), [], "a private window reads an empty queue instead of throwing");
  assert.doesNotThrow(() => D.addToQueue("MU", "3h", hostile, "now"));
});

test("opening the detail view mounts ONE frame over the wall, at the right URL", () => {
  const { D, dom } = load();
  const opened = D.open("mu", { range:"1D" });
  assert.ok(opened, "the overlay opened");
  const overlay = dom.document.getElementById("detailOverlay");
  assert.ok(overlay, "the overlay is in the document");
  const frame = overlay.children[0].children[0];
  assert.equal(frame.tagName, "IFRAME");
  assert.match(frame.src, /^\/station-shells\/detail-v1\/\?shell=v1&t=MU&range=1D/);
  D.open("MU", { range:"1D" });
  assert.equal(dom.body.children.filter((c) => c.id === "detailOverlay").length, 1,
    "asking again for the same ticker does not stack a second frame");
});

test("closing REMOVES the frame — the detail view costs nothing while it is not shown", () => {
  const { D, dom } = load();
  D.open("SPY", {});
  assert.equal(D.isOpen(), true);
  assert.equal(D.close(), true);
  assert.equal(D.isOpen(), false);
  assert.equal(dom.document.getElementById("detailOverlay"), null,
    "the overlay node is gone, not merely hidden");
  assert.equal(dom.body.children.length, 0, "and nothing of it is left behind in the deck");
});

test("the shells' messages close the view and fill the queue", () => {
  const { D, ctx, fire } = load();
  D.open("AVGO", {});
  fire("message", { data:{ sc:"detail-rotation-add", ticker:"AVGO", range:"3h" } });
  assert.deepEqual(plain(D.readQueue(ctx.localStorage).map((e) => e.ticker)), ["AVGO"]);
  fire("message", { data:{ sc:"detail-close" } });
  assert.equal(D.isOpen(), false);
  /* a message this lane does not own must not move anything */
  fire("message", { data:{ sc:"chart-status", ticker:"MU" } });
  assert.equal(D.isOpen(), false);
});

test("a chart pane gets one expand badge, and it opens that pane's ticker", () => {
  const { D, dom } = load();
  const node = dom.document.createElement("div");
  const pane = { node, def:{ kind:"chart", ticker:"GOOGL", title:"GOOGL" } };
  assert.equal(D.attach(pane), true);
  assert.equal(D.attach(pane), false, "attaching twice does not add a second badge");
  const badge = node.children.find((c) => c.className === "detail-open");
  assert.ok(badge, "the badge is on the pane");
  badge.click();
  assert.equal(D.current().ticker, "GOOGL");
  /* a video or X pane is not a chart and gets nothing */
  assert.equal(D.attach({ node:dom.document.createElement("div"), def:{ kind:"video" } }), false);
});

test("an empty chart slot asks for a symbol instead of opening a view for one that isn't there", () => {
  let asked = null;
  const { D, dom } = load({ focusTickerFor:(key) => { asked = key; } });
  const node = dom.document.createElement("div");
  /* this is exactly what the deck builds for an unfilled slot: no ticker, a prompt as title */
  D.attach({ node, def:{ kind:"chart", ticker:"", title:"Choose a symbol", key:"c3" } });
  node.children.find((c) => c.className === "detail-open").click();
  assert.equal(D.isOpen(), false, "no overlay for a slot with no ticker");
  assert.equal(asked, "c3", "the slot's own ticker field is what gets the focus");
});

test("the five zoomed screens and FUNDAMENTALS are MENU entries that auto-rotate never takes", () => {
  const { D, ctx, dom } = load();
  assert.deepEqual(plain(D.DETAIL_SCREENS.map((s) => s.label)),
    ["DETAIL · SPY", "DETAIL · QQQ", "DETAIL · MU", "DETAIL · GOOGL", "DETAIL · AVGO", "FUNDAMENTALS"]);
  const rotation = ctx.StationScenes.ROTATION_SCENES;
  for (const s of D.DETAIL_SCREENS)
    assert.ok(!rotation.includes(s.id), s.id + " must not be in the rotation until Alan says so");
  /* 25 Sep: the rotation is Alan's nineteen-page workflow (K3); the detail pages are still not in it. */
  /* 22 since 25 Sep P2 (three daily RSI pages); still no detail page in it. */
  assert.equal(ctx.StationScenes.ROTATION_SCENES.length, 22, "the rotation is the workflow, which has no detail page");
  /* and they answer the jump list's filter by name and by ticker */
  assert.deepEqual(plain(D.matchScreens("AVG").map((s) => s.id)), ["detailAVGO"]);
  assert.deepEqual(plain(D.matchScreens("FUND").map((s) => s.id)), ["fundamentals"]);
  const list = dom.document.createElement("div");
  let picked = 0;
  assert.equal(D.appendJumpEntries(list, "", () => picked++), 6);
  list.children[5].click();
  assert.equal(picked, 1);
  assert.equal(D.current().kind, "fundamentals", "FUNDAMENTALS opens the fundamentals shell");
});

test("the deck keeps its three hook lines, and nothing else of the deck changed for this", () => {
  const hooks = deck.match(/M74 HOOK/g) || [];
  assert.equal(hooks.length, 3, "three marked hooks, so the coordinator can merge M69 beside them");
  assert.ok(deck.includes('<script src="/deck/detail.js?rev=001"></script>'));
  assert.ok(deck.includes("if (window.StationDetail) StationDetail.attach(o)"));
  assert.ok(deck.includes("StationDetail.appendJumpEntries(list, query"));
  /* the wall's own machinery is untouched by this lane */
  assert.ok(deck.includes("function paneChartSrc(t, index, transitionGeneration)"));
  assert.ok(!/StationDetail\.(open|close)\(/.test(deck.replace(/M74 HOOK[\s\S]{0,200}/g, "")),
    "the deck never opens the overlay itself; the badge and the menu do");
});

test("neither new shell writes anything, and neither carries its own copy of the arithmetic", () => {
  for (const [name, src] of [["detail", detailShell], ["fundamentals", fundShell]]) {
    assert.ok(!/method\s*:\s*["'](POST|PUT|PATCH|DELETE)/i.test(src), name + " shell must not write");
    assert.ok(!/\.insert\(|\.upsert\(|\.delete\(/.test(src), name + " shell must not write through a client");
  }
  assert.ok(detailShell.includes('<script src="./indicators.js"></script>'), "the detail shell loads the tested module");
  assert.ok(detailShell.includes('<script src="/_indicators/station-clouds.js"></script>'),
    "and the ribbon is the Station's own module, not a second implementation");
  assert.ok(!/function\s+rsiSeries|function\s+macdSeries/.test(detailShell),
    "the shell must not re-implement what indicators.js already proves");
  assert.ok(/SC_DETAIL_MATH\.readings\(/.test(detailShell), "it asks the module for its readings");
  /* the module itself never reaches the network or the DOM */
  assert.ok(!/fetch\(|document\./.test(math), "indicators.js stays pure arithmetic");
});

test("the detail shell reads wide enough for twenty sessions but still draws a zoomed window", () => {
  /* A 15-minute timeframe carries about 64 extended-hours bars a session, so twenty sessions
     is ~1,300 bars — read them all, draw the newest few hundred. */
  const m = detailShell.match(/"15m":\["15",(\d+)\]/);
  assert.ok(m && Number(m[1]) >= 1280, "the 15m read must cover twenty sessions, got " + (m && m[1]));
  const draw = detailShell.match(/const DRAW_BARS = (\d+);/);
  assert.ok(draw && Number(draw[1]) <= 400, "and the view must stay zoomed");
  assert.ok(/const drawn = \(list\) =>/.test(detailShell) && /drawn\(BARS\)/.test(detailShell),
    "the panes draw the sliced window, not the whole read");
  assert.ok(/bars read, " \+ drawn\(BARS\).length \+ " drawn"/.test(detailShell),
    "and the provenance line says both numbers");
});

test("a net margin above the gross margin is explained, not printed bare", () => {
  assert.ok(/net income exceeds gross profit this period/.test(fundShell),
    "Alphabet's June 2026 quarter shows 93.7% net on 61.6% gross; the card must say why that can happen");
  assert.ok(/the stored ratio disagrees with revenue ÷ net income/.test(fundShell),
    "and a stored ratio contradicting its own statement rows must show both");
  assert.ok(/epoch SECONDS/.test(fundShell), "the read stamps are dates on screen, not raw epoch numbers");
});

test("the fundamentals shell reads only the stored tables it names, and dates every number", () => {
  const tables = Array.from(fundShell.matchAll(/pg\("([a-z_]+)\?/g)).map((m) => m[1]);
  assert.deepEqual(plain(Array.from(new Set(tables)).sort()),
    ["balance_history", "company_profile", "fundamentals", "fundamentals_history", "ratios_history"]);
  assert.ok(fundShell.includes("not stored"), "a missing quarter says so instead of showing a zero");
  assert.ok(/computed: gross profit ÷ revenue/.test(fundShell) && /computed: balance_history total debt/.test(fundShell),
    "the two computed numbers say they are computed, and from what");
});
