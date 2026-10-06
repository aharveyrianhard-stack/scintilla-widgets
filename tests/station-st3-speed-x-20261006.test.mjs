/* ST3 · 6 OCT · the Station stops rebuilding its charts, and the X feed's picture stops hopping.
   Alan, 6 Oct ~14:05 ET: "with the reorganization of the station, I think we can make the Twitter
   scrolling on station be faster."
   1. A chart slot keeps its parked frames through pages that hide it or carry another study (wide wall
      only; a narrow wall keeps the old rules), and a parked chart stops its own 60 s history re-read.
   2. The X source paints its scroll position into the captured picture and the pane reads it from the
      frame it draws, so what is shown can only move forward; the pace is a choice behind the ⋯.
   Measurements and pictures: deliverables/20261006/st3. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const deck = read("deck/index.html");
const chart = read("station-shells/chart-v1/index.html");
const pane = read("station-shells/x-v2/index.html");
const bridge = read("station-x-bridge-draft/content.js");

function fnSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  for (let i = source.indexOf("{", source.indexOf(")", start)); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name + " did not close");
}
const constLine = (source, name) => {
  const m = source.match(new RegExp("^(?:const|let) " + name + "\\b[^\\n]*$", "m"));
  assert.ok(m, name + " must exist"); return m[0];
};

/* ── 1. the parked frames ─────────────────────────────────────────────────────────────── */
function deckWorld({ wide }) {
  const posted = [];
  const frame = (src) => {
    const f = { dataset:{}, className:"", attrs:{ src }, removed:false, parentNode:null, _spareTicker:null,
      getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; },
      remove() { this.removed = true; this.parentNode = null; },
      contentWindow:{ postMessage(m) { posted.push([src, m]); } } };
    return f;
  };
  const world = { posted, frame, Date, Number, String, Array, Math, location:{ origin:"https://station" },
    wide, SCENE:"ai1", CHART_COUNT:8, SLOT_MAX:9, PANES:[],
    SceneModel:{ WORKFLOW_IDS:["ai1", "ai2", "mainIndexes3D"] } };
  vm.createContext(world);
  vm.runInContext([
    "const keepsHiddenCharts = () => wide;",
    constLine(deck, "frameIdentity"), constLine(deck, "frameShownSrc"), constLine(deck, "withoutTicker"),
    constLine(deck, "SPARE_MAX"), "var SPARE_LAP_SEEN = Date.now();", constLine(deck, "spareRoom"), constLine(deck, "spareKind"),
    fnSource(deck, "dropSpare"), fnSource(deck, "parkSpare"), fnSource(deck, "takeSpare"), fnSource(deck, "sweepSpares"),
  ].join("\n"), world);
  world.pane = (key, withFrame = true) => {
    const p = { def:{ key }, body:{}, frame:withFrame ? frame("live") : null, spares:null };
    world.PANES.push(p); return p;
  };
  world.park = (p, src, ticker) => { const f = frame(src); f.parentNode = p.body; world.parkSpare(p, f, ticker); return f; };
  return world;
}
const PLAIN = (t) => "/station-shells/chart-v1?shell=v1&bare=1&t=" + t + "&range=3D&view=auto&bubble=4h%3A12";
const RSI = (t) => "/station-shells/chart-v1?shell=v1&bare=1&t=" + t + "&range=1D&view=auto&rsi=auto&bubble=1D%3A12";
const STEPPED = (t) => "/station-shells/chart-v1?shell=v1&bare=1&t=" + t + "&range=3D&view=auto&clouds=1&steps=1";

test("ST3 · a wide wall keeps a parked plain frame through an RSI page, and re-uses the right one", () => {
  const w = deckWorld({ wide:true });
  const p = w.pane("c1");
  const plain = w.park(p, PLAIN("NVDA"), "NVDA");
  assert.equal(w.takeSpare(p, RSI("SPY")), null, "an RSI page cannot use the plain frame…");
  assert.equal(plain.removed, false, "…and no longer throws it away");
  assert.equal(p.spares.length, 1);
  const rsi = w.park(p, RSI("SPY"), "SPY");
  assert.equal(p.spares.length, 2, "plain and RSI are both kept");
  assert.equal(w.takeSpare(p, PLAIN("AMD") + "&sharedAxis=1"), plain, "the next plain page re-points the parked plain frame (symbol, axis, range and lens are not its identity)");
  assert.deepEqual(Array.from(p.spares), [rsi]);
  assert.equal(w.takeSpare(p, RSI("QQQ")), rsi);
  assert.equal(p.spares.length, 0);
});

test("ST3 · two parked frames a slot at most, of either kind; the one parked longest goes first", () => {
  const w = deckWorld({ wide:true });
  const p = w.pane("c2");
  const first = w.park(p, PLAIN("NVDA"), "NVDA");
  const second = w.park(p, PLAIN("AMD"), "AMD");
  assert.equal(first.removed, false, "two plain frames may both wait: an RSI page coming by must not cost one (it did in the first try: 48 documents in 17 minutes)");
  assert.deepEqual(Array.from(p.spares), [first, second]);
  assert.equal(w.takeSpare(p, PLAIN("MU")), first, "the one parked longest is used first");
  const rsi = w.park(p, RSI("SPY"), "SPY");
  const stepped = w.park(p, STEPPED("MU"), "MU");
  assert.equal(second.removed, true, "a third pushes out the one parked longest");
  assert.deepEqual(Array.from(p.spares), [rsi, stepped]);
  const unsettled = w.frame(PLAIN("X")); unsettled.parentNode = p.body;
  w.parkSpare(p, unsettled, "");
  assert.equal(unsettled.removed, true, "a frame that never settled on a name is not kept");
  assert.equal(p.spares.length, 2);
});

test("ST3 · a lap of plain pages with an RSI page in it settles at three documents a slot and builds no more", () => {
  const w = deckWorld({ wide:true });
  const p = w.pane("c3");
  let shown = w.frame(PLAIN("A0")); shown.parentNode = p.body; shown._kind = "plain";
  let built = 0;
  const go = (src, ticker) => {                      /* what crossFadeSlot and preparePageSlot do with the parked frames */
    let next = w.takeSpare(p, src);
    if (!next) { next = w.frame(src); next.parentNode = p.body; built++; }
    else { next.dataset.shown = src; next._spareTicker = null; }
    w.parkSpare(p, shown, "T"); shown = next;
  };
  const lap = [PLAIN("A"), PLAIN("B"), RSI("C"), PLAIN("D"), PLAIN("E"), RSI("F"), PLAIN("G")];
  for (const src of lap) go(src, "T");
  const afterFirstLap = built;
  for (let i = 0; i < 5; i++) for (const src of lap) go(src, "T");
  assert.equal(afterFirstLap, 2, "the first lap builds one more plain and one RSI document for the slot");
  assert.equal(built, afterFirstLap, "five more laps build none");
  assert.equal(p.spares.length, 2);
});

test("ST3 · a parked chart is told, and the chart stops its own 60 s re-read until it is given a name", () => {
  const w = deckWorld({ wide:true });
  const p = w.pane("c1");
  w.park(p, PLAIN("NVDA"), "NVDA");
  assert.deepEqual(JSON.parse(JSON.stringify(w.posted)), [[PLAIN("NVDA"), { sc:"deck-parked" }]]);
  assert.match(chart, /if \(d\.sc === "deck-parked"\) \{ DECK_PARKED = true; return; \}/);
  assert.match(chart, /if \(d\.ticker && DECK_PARKED\) \{ DECK_PARKED = false; parkedStale = DECK_PARKED_MISSED; DECK_PARKED_MISSED = false; \}/,
    "the deck's next chart message with a name un-parks it");
  assert.match(chart, /setInterval\(\(\) => \{\n  if \(DECK_PARKED\) \{ DECK_PARKED_MISSED = true; return; \}\n[^\n]*scChartLoad\(host\);\n\}, 60000\);/,
    "parked: no history read; the miss is remembered");
  assert.match(chart, /if \(parkedStale && host && !host\.dataset\.holding\) scChartLoad\(host\);/,
    "a name it kept while parked is re-read once when it comes back");
  assert.equal(read("chart/index.html"), chart, "chart/ and station-shells/chart-v1/ stay identical copies");
  /* both re-use paths give the frame a name, which is what un-parks it */
  assert.match(fnSource(deck, "crossFadeSlot"), /postMessage\(\{ sc:"chart", ticker, range:RANGE, sharedAxis/);
  assert.match(fnSource(deck, "preparePageSlot"), /postMessage\(\{ sc:"chart", ticker, range:srcRange\(src\) \|\| RANGE/);
});

test("ST3 · a hidden slot keeps its parked frames on a wide wall; five minutes off the lap lets them go", () => {
  const w = deckWorld({ wide:true });
  const shown = w.pane("c1"), hidden = w.pane("c7");
  const a = w.park(shown, PLAIN("NVDA"), "NVDA"), b = w.park(hidden, PLAIN("MU"), "MU");
  w.CHART_COUNT = 2;                      /* a two-chart page: slot 7 is not on it */
  w.sweepSpares();
  assert.equal(b.removed, false, "the slot the page hides keeps its parked frame");
  w.SCENE = "scratch";                    /* off the lap */
  w.sweepSpares();
  assert.equal(a.removed || b.removed, false, "a short visit elsewhere costs nothing");
  vm.runInContext("SPARE_LAP_SEEN = Date.now() - SPARE_IDLE_MS - 1000;", w);
  assert.match(constLine(deck, "SPARE_MAX"), /SPARE_MAX = 2, SPARE_IDLE_MS = 5 \* 60 \* 1000;/);
  w.sweepSpares();
  assert.equal(a.removed && b.removed, true, "after five minutes away the memory is given back");
});

test("ST3 · a narrow wall (iPad, phone) keeps the old rules to the letter", () => {
  const w = deckWorld({ wide:false });
  const p = w.pane("c1"), hidden = w.pane("c7");
  const plain = w.park(p, PLAIN("NVDA"), "NVDA");
  const other = w.park(p, RSI("SPY"), "SPY");
  assert.equal(plain.removed, true, "one parked frame, not two");
  assert.equal(w.takeSpare(p, PLAIN("AMD")), null);
  assert.equal(other.removed, true, "a parked frame of another kind is dropped, as before");
  const h = w.park(hidden, PLAIN("MU"), "MU");
  w.CHART_COUNT = 2; w.sweepSpares();
  assert.equal(h.removed, true, "a slot the page does not show keeps none");
  const again = w.park(p, PLAIN("NVDA"), "NVDA");
  w.SCENE = "scratch"; w.sweepSpares();
  assert.equal(again.removed, true, "leaving the lap drops every parked frame at once");
  assert.match(deck, /if \(!PAGE_FADE && spareRoom\(\) < 2\) dropSpare\(pane\);/);
});

/* ── 2. the X picture's scroll code ───────────────────────────────────────────────────── */
const run = (source, names) => { const ctx = vm.createContext({ Math, Number, Array, Boolean }); vm.runInContext(names.map((n) => fnSource(source, n)).join("\n"), ctx); return ctx; };
const B = run(bridge, ["stationScrollCodeValue", "stationScrollCodeCells", "stationScrollCodeFits"]);
const P = (() => { const ctx = vm.createContext({ Math, Number, Array });
  vm.runInContext([constLine(pane, "STATION_SCROLL_OFFSET_MAX_PX"), constLine(pane, "STATION_CODE_MAX_STEPS"),
    fnSource(pane, "decodeStationScrollCode"), fnSource(pane, "stationCodedOffset")].join("\n"), ctx); return ctx; })();

test("ST3 · the source writes its scroll into fifteen squares and the pane reads the same number back", () => {
  for (const [top, dpr] of [[0, 1], [12.8, 1.25], [13.6, 1.25], [204.5, 2], [100000.75, 1.25], [255, 1], [256, 1]]) {
    const value = B.stationScrollCodeValue(top, dpr);
    assert.equal(value, Math.round(top * dpr) % 256);
    const cells = Array.from(B.stationScrollCodeCells(value));
    assert.equal(cells.length, 15);
    /* as a capture would return them: white a little grey, black a little lit */
    assert.equal(P.decodeStationScrollCode(cells.map((on) => (on ? 232 : 24))), value, `${top} at ${dpr}`);
  }
  const cells = Array.from(B.stationScrollCodeCells(77)).map((on) => (on ? 240 : 10));
  const flipped = cells.slice(); flipped[6] = flipped[6] > 128 ? 10 : 240;
  assert.equal(P.decodeStationScrollCode(flipped), null, "one wrong square fails the parity: not read at all");
  const smeared = cells.slice(); smeared[9] = 128;
  assert.equal(P.decodeStationScrollCode(smeared), null, "a grey square is not guessed");
  assert.equal(P.decodeStationScrollCode(new Array(15).fill(20)), null, "X's own dark corner is not a code");
  assert.equal(P.decodeStationScrollCode(new Array(15).fill(250)), null);
});

test("ST3 · the code only goes where the picture has it and the viewers do not show it", () => {
  assert.equal(B.stationScrollCodeFits({ left:299, top:53 }, 15, 8, false), true);
  assert.equal(B.stationScrollCodeFits({ left:0, top:0 }, 15, 8, false), false, "a column in the corner: no code, the old rule");
  assert.equal(B.stationScrollCodeFits({ left:0, top:53 }, 15, 8, false), true, "above the column is outside it");
  assert.equal(B.stationScrollCodeFits({ left:299, top:53 }, 15, 8, true), false, "a source that cropped its own track has no corner in the picture");
  assert.match(bridge, /root\.scrollTop = before\.scrollTop \+ requestedPixels;\n\s+if \(typeof paintStationScrollCode === "function"\) paintStationScrollCode\(\);/,
    "repainted in the same task as the scroll, so the same frame carries both");
  assert.match(bridge, /window\.addEventListener\("scroll", session\.stationScrollCodeListener, \{ passive: true, capture: true \}\)/);
  assert.match(bridge, /removeStationHoverShield\(\);\n\s+removeStationScrollCode\(\);/, "it leaves X's page when the Station lets go of it");
  assert.match(bridge, /payload\.scrollCode = stationScrollCodePayload\(payload\.rect, payload\.sourceScroll\.scrollTop\);/);
});

test("ST3 · what the pane shows can only move forward, whichever of the crop and the frame arrives first", () => {
  /* one device-pixel step of 0.8 px (zoom 0.8 → dpr 1.25), the slow scroll's phase running through it */
  const dpr = 1.25, step = 1 / dpr;
  const shown = (cropTop, fraction, frameTop) => {
    const offset = P.stationCodedOffset(fraction, B.stationScrollCodeValue(cropTop, dpr), B.stationScrollCodeValue(frameTop, dpr), dpr);
    assert.notEqual(offset, null); return frameTop + offset;
  };
  /* the crop still speaks of the old scroll (12.0 + phase) while the new frame (12.8) is already here */
  const frameFirst = [shown(12, 0.6, 12), shown(12, 0.9, 12.8), shown(12, 1.2, 12.8), shown(12.8, 0.7, 12.8)];
  /* the crop has moved on to 12.8 while the old frame (12.0) is still the one decoded */
  const cropFirst = [shown(12, 0.6, 12), shown(12.8, 0.1, 12), shown(12.8, 0.4, 12), shown(12.8, 0.7, 12.8)];
  for (const track of [frameFirst, cropFirst]) {
    for (let i = 1; i < track.length; i++) assert.ok(track[i] >= track[i - 1] - 1e-9, "never back: " + track.join(" → "));
    assert.ok(Math.abs(track[track.length - 1] - 13.5) < 1e-9);
  }
  assert.ok(Math.abs(cropFirst[1] - 12.9) < 1e-9, "the old frame is drawn where the feed should be, not a step behind");
  assert.ok(Math.abs(frameFirst[1] - 12.9) < 1e-9, "and the new frame is not drawn a step ahead");
  /* the old rule, for comparison: the bare fraction on whatever frame is there */
  assert.ok(12 + 0.1 < 12 + 0.6, "crop first used to hop back by the step");
  assert.equal(P.stationCodedOffset(0.5, 10, 10 + 100, dpr), null, "a page up or a rewind is a jump: the old rule decides");
  assert.equal(P.stationCodedOffset(0.2, 255, 0, 1), 0, "the count wraps at 256 without a jump (frame one ahead: held, not pulled back)");
  assert.ok(Math.abs(P.stationCodedOffset(1.3, 255, 0, 1) - 0.3) < 1e-9);
  assert.equal(step, 0.8);
  /* the pane takes one frame in hand, reads its code, paints that same frame - and falls back when it cannot */
  assert.match(fnSource(pane, "stationScrollOffset"), /if \(!code \|\| stationFrameCode === null \|\| !\(offset >= 0\)\) return plain;/);
  assert.match(fnSource(pane, "drawXFloat"), /if \(!paintCodedFrame\(video, xfloatCrop\)\) \{ stationFrameCode = null; paintXPicture\(video, video\); \}/);
  const coded = fnSource(pane, "paintCodedFrame");
  assert.match(coded, /if \(!crop\?\.scrollCode \|\| crop\.sourceCropped \|\| typeof VideoFrame !== "function" \|\| now < stationCodeRestUntil\) return false;/,
    "no code, no VideoFrame, or resting: the video is painted straight, by the old rule");
  assert.match(coded, /frame = new VideoFrame\(video\)/);
  assert.match(coded, /stationFrameCode = value;[\s\S]*paintXPicture\(frame, size\); \} finally \{ frame\.close\(\); stationCodeBusy = false; \}/,
    "the frame whose code was read is the frame that is painted, and it is always given back");
  assert.doesNotMatch(pane, /stationCodeScratch/, "no second canvas: that read converted the whole frame again on every paint (measured)");
});

test("ST3 · the pane finds the squares in a frame of any capture size and reads them from two rows of brightness", () => {
  const ctx = vm.createContext({ Math, Number, Array, String });
  vm.runInContext([fnSource(pane, "stationCaptureFit"), fnSource(pane, "stationCodeRect"), fnSource(pane, "stationCodeLums"), fnSource(pane, "decodeStationScrollCode")].join("\n"), ctx);
  const code = { x:0, y:0, cell:8, cells:15, dpr:1.25, value:0 };
  /* [frame w, frame h, viewport w, viewport h]: the harness, a letterboxed Brave window, a 2x screen scaled down */
  for (const [fw, fh, vw, vh] of [[1500, 1016, 1200, 812], [1792, 1080, 1062, 640], [1920, 1080, 2560, 1300], [1616, 1080, 970, 648]]) {
    const plan = ctx.stationCodeRect(fw, fh, { scrollCode:code, viewport:{ width:vw, height:vh } });
    assert.ok(plan, `${fw}x${fh}`);
    const { rect } = plan;
    assert.ok(rect.x % 2 === 0 && rect.y % 2 === 0 && rect.width % 2 === 0 && rect.height === 2, "whole even pixels: a 4:2:0 frame is copied in pairs");
    const scale = Math.min(fw / vw, fh / vh), offX = Math.max(0, (fw - vw * scale) / 2), offY = Math.max(0, (fh - vh * scale) / 2);
    assert.ok(rect.y >= offY && rect.y + rect.height <= offY + 8 * scale + 0.01, "inside the squares' height");
    for (const value of [0, 1, 77, 170, 255]) {
      const cells = Array.from(B.stationScrollCodeCells(value));
      /* paint the row the way the capture would hold it: one byte of brightness a pixel, soft at the edges */
      const stride = rect.width + 6, bytes = new Uint8Array(stride * 2);
      for (let row = 0; row < 2; row++) for (let px = 0; px < rect.width; px++) {
        const at = (rect.x + px + .5 - offX) / scale / 8, i = Math.floor(at);
        const on = i >= 0 && i < 15 ? cells[i] : 0, edge = Math.min(at - i, 1 - (at - i)) * 8 * scale < 0.6;
        bytes[row * stride + px] = edge ? 120 : on ? 235 : 16;
      }
      assert.equal(ctx.decodeStationScrollCode(ctx.stationCodeLums(bytes, stride, 1, plan)), value, `${value} at ${fw}x${fh}`);
    }
  }
  assert.equal(ctx.stationCodeRect(1500, 1016, { scrollCode:code, sourceCropped:true, viewport:{ width:1200, height:812 } }), null);
  assert.equal(ctx.stationCodeRect(480, 270, { scrollCode:code, viewport:{ width:2560, height:1440 } }), null, "squares under 2.5 px in the capture are not trusted");
  assert.match(fnSource(pane, "readStationFrameCode"), /const layout = await frame\.copyTo\(stationCodeBuffer, \{ rect: plan\.rect \}\);/, "only the code's rows are copied out of the frame");
});

test("ST3 · the pane times how long a read keeps a paint waiting and goes back to the old rule for a minute when it is too long", () => {
  const ctx = vm.createContext({ Math });
  vm.runInContext(constLine(pane, "STATION_CODE_BUDGET_MS") + "\n" + fnSource(pane, "stationCodeBudget"), ctx);
  let avg = 0, rested = false;
  for (let reads = 1; reads <= 200; reads++) { const b = ctx.stationCodeBudget(avg, reads, 2.4); avg = b.avg; rested = rested || b.rest; }
  assert.equal(rested, false, "the wait measured on the headless MacBook (2.4 ms) never rests");
  avg = 0; let at = 0;
  for (let reads = 1; reads <= 200 && !at; reads++) { const b = ctx.stationCodeBudget(avg, reads, 20); avg = b.avg; if (b.rest) at = reads; }
  assert.equal(at, 30, "a slow one is stopped after thirty reads - about three seconds");
  avg = 2; at = 0;
  for (let reads = 100; reads <= 400 && !at; reads++) { const b = ctx.stationCodeBudget(avg, reads, 20); avg = b.avg; if (b.rest) at = reads; }
  assert.ok(at > 100 && at < 125, "and one that turns slow later is caught within a couple of seconds");
  assert.match(constLine(pane, "STATION_CODE_BUDGET_MS"), /STATION_CODE_BUDGET_MS = 8, STATION_CODE_REST_MS = 60000;/);
});

test("ST3 · the feed's pace is a choice behind the ⋯: 1× 2× 4×, shown only when the source reports its pace", () => {
  const ctx = vm.createContext({ Number });
  vm.runInContext(constLine(pane, "X_SPEED_CHOICES") + "\n" + fnSource(pane, "xSpeedChoice"), ctx);
  assert.deepEqual([3, 6, 12, "6", 5, 0, 300, "fast"].map((v) => ctx.xSpeedChoice(v)), [3, 6, 12, 6, null, null, null, null]);
  for (const v of [3, 6, 12]) assert.match(pane, new RegExp('<button class="btn xs xs-row" type="button" data-v="' + v + '"[^>]* hidden>'));
  assert.match(pane, /#xMore \[hidden\]\{ display:none !important; \}/);
  assert.match(fnSource(pane, "setXSpeed"), /if \(speed === null \|\| REMOTE_MODE\) return;\n\s+postXFloat\("speed", speed\);/, "the iPad mirror never asks");
  assert.match(pane, /paintXSpeed\(xfloatCrop\?\.speedPxPerSecond\);/);
  assert.match(bridge, /\} else if \(action === "speed"\) \{[\s\S]{0,400}saveSettings\(\{ speedPxPerSecond: Math\.max\(0\.5, Math\.min\(30, speed\)\) \}\);/,
    "the same bounds as the float's own slider");
  assert.match(bridge, /speedPxPerSecond: session\.settings\.speedPxPerSecond,/);
  assert.match(bridge, /speedPxPerSecond: 3,/, "the default pace is unchanged: Alan picks the faster one");
  /* the bridge that carries both is 0.7.24, and the health page expects it */
  assert.match(read("station-x-bridge-draft/manifest.json"), /"version": "0\.7\.24"/);
  assert.match(read("x-health/index.html"), /const TARGET = "0\.7\.24";/);
});

/* ── 3. the shared price-history store lets go of what has expired ────────────────────── */
test("ST3 · an expired series is dropped within a minute, a live one is kept, and no read changes", () => {
  const provider = read("_provider/provider.js");
  const world = { Date:{ now:() => world.now }, now:1_000_000, JSON, Map, Number, String, Math, store:{ text:new Map(), expires:new Map(), chars:0, hits:0, misses:0 }, S:{} };
  vm.createContext(world);
  vm.runInContext(["var CANDLE_SHARED_MAX_CHARS = 48e6, CANDLE_SWEEP_MS = 60000;", "function candleShared () { return store; }",
    "S.candleTtlMs = function (tf) { return tf === 'short' ? 45000 : 1800000; };",
    fnSource(provider, "candleForget "), fnSource(provider, "candleCacheGet "), fnSource(provider, "candleCachePut ")].join("\n"), world);
  assert.match(provider, /var CANDLE_SWEEP_MS = 60000;/);
  const series = (n) => ({ series:Array.from({ length:n }, (_, i) => ({ t:i, c:i })) });
  world.candleCachePut("u/short", "short", series(50));
  world.candleCachePut("u/long", "D", series(50));
  assert.equal(world.store.text.size, 2);
  world.now += 50_000;                                   /* the short one is past its 45 s; no sweep is due yet */
  world.candleCachePut("u/other", "D", series(10));
  assert.equal(world.store.text.has("u/short"), true, "at most one sweep a minute");
  world.now += 15_000;
  world.candleCachePut("u/new", "D", series(10));
  assert.equal(world.store.text.has("u/short"), false, "the expired series is gone, though nobody asked for it again");
  assert.equal(world.store.expires.has("u/short"), false);
  assert.equal(world.store.text.has("u/long"), true, "a series still inside its time stays");
  assert.equal(world.store.chars, ["u/long", "u/other", "u/new"].reduce((n, k) => n + world.store.text.get(k).length, 0), "the count of what is held stays exact");
  assert.equal(world.candleCacheGet("u/short"), null, "a read of it answers as it always did: not cached");
  assert.equal(world.candleCacheGet("u/long").series.length, 50);
});
