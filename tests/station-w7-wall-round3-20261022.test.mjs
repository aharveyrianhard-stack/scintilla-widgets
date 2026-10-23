/* W7 (22 Oct 2026). Alan, ~20:10 ET: "if we give more size to the charts, to the two charts, and secondly to the YouTube, that's perfect … YouTube goes
   to the bottom left corner … At the top of that is the Twitter … slimmer … Charts synced in every way except ticker … it needs to be bars … relative
   volume per ticker … the SPY and QQQ … I don't want to [swap them for futures] anymore … the volume thing … the UX of it is like total shit … why are
   2 points flashing right now at 2.2?" */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html"), lens = read("../station-shells/lens-v1/index.html"), vol = read("../station-shells/volume-v1/index.html"), tv = read("../station-shells/tv-v1/index.html");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fn = (src, name) => grab(src, new RegExp("\\nfunction " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"), name);

test("W7 · one timeframe and one clouds switch for both charts, remembered; a chart's own ticker box heard; the live frames get sync=1 and a message, the TV frames their address", () => {
  assert.match(deck, /const WIDGETS_TF_ONE_KEY = "station\.widgets\.tf", WIDGETS_CLOUDS_KEY = "station\.widgets\.clouds";/);
  assert.match(fn(deck, "widgetsTfOne"), /const one = remembered\(WIDGETS_TF_ONE_KEY\); if \(WIDGETS_TFS\.includes\(one\)\) return one; const first = remembered\(WIDGETS_TF_KEY \+ "1"\);/, "the one key, then W1's chart-1 key, then 5m");
  assert.match(fn(deck, "widgetsTf"), /return widgetsTfOne\(\);/, "no independent timeframes");
  assert.match(fn(deck, "widgetsClouds"), /remembered\(WIDGETS_CLOUDS_KEY\) !== "0"/, "clouds on unless switched off");
  assert.match(fn(deck, "setWidgetsTf"), /remember\(WIDGETS_TF_ONE_KEY, String\(tf\)\); remember\(WIDGETS_TF_KEY \+ "1", String\(tf\)\); remember\(WIDGETS_TF_KEY \+ "2", String\(tf\)\);/);
  const tell = fn(deck, "tellWidgetsCharts");
  assert.match(tell, /postMessage\(\{ sc:"chart", tf:WIDGETS_TF_LABEL\[tf\], clouds \}, location\.origin\)/, "the live frames by message (the contract with live-v1)");
  assert.match(tell, /\} else retargetSlot\(i, CHARTS\[i\]\);/, "the TV frames by their address");
  assert.match(deck, /c\.id = "wgCtl";/); assert.match(deck, /body\.widgets\.video-slot:not\(\.stack\):not\(\.media-theatre\) #grid > #rowTop\{ margin-top:25px; \}/, "the row sits over the charts");
  assert.match(deck, /if \(event\.data\?\.type === "SCINTILLA_CHART_TICKER"\) \{[\s\S]{0,900}?remember\(WIDGETS_CHART_KEY \+ n, t\);/, "a frame's ticker box: the slot takes the name, remembers it");
  assert.doesNotMatch(grab(deck, /if \(event\.data\?\.type === "SCINTILLA_CHART_TICKER"\) \{[\s\S]*?\n    return;\n  \}/, "the ticker branch"), /retargetSlot/, "and does not re-point the frame that already shows it");
  assert.match(deck, /if \(\(n === 1 \|\| n === 2\) && WIDGETS_TFS\.includes\(tf\) && tf !== widgetsTfOne\(\) && own\) \{ setWidgetsTf\(tf\); return; \}/, "an interval chosen on a strip is both charts'");
  assert.match(tv, /body\.sync #strip \.tfs\{ display:none; \}/, "tv-v1 hides its intervals under sync"); assert.match(tv, /<input class="tbox" id="tbox"/, "and shows a ticker box");
  assert.match(tv, /parent\.postMessage\(\{ type: "SCINTILLA_CHART_TICKER", n: N, ticker: SYMBOL \}, location\.origin\)/);
});

test("W7 · the lens tape: bars by default with a LINE · BARS switch remembered, bigger type, rows as the band holds, each name's RVol, the overnight MACRO without the futures swap", () => {
  assert.match(lens, /const STYLE_KEY = "station\.lenses\.style";/); assert.match(lens, /export const styleOf = \(stored\) => stored === "line" \? "line" : "bars";/, "bars unless he chose the line");
  assert.match(lens, /STYLE = styleOf\(remembered\(STYLE_KEY\)\);/);
  const bars = grab(lens, /export function drawBars\([\s\S]*?\n\}/, "drawBars");
  assert.match(bars, /const b = bars\[i\], col = b\.c >= b\.o \? PALETTE\.bull : PALETTE\.bear/, "green up, red down, never grey");
  assert.match(lens, /body\.tape \.lens \.tk, body\.tape \.lens \.px\{ font-size:12px; \}/, "the ticker and the price at 12 px");
  assert.match(lens, /g\.names\.forEach\(\(t, i\) => cells\.push\(\[t, g\.s, hosts\[i % hosts\.length\]\]\)\)/   /* W12: each set's names dealt round its own rows */, "the names dealt round the rows"); assert.match(lens, /if \(e\.data\.type === "SCINTILLA_LENS_ROWS"\)/, "the deck says how many rows"); assert.match(deck, /mode=tape&rows=" \+ rows \+ "&view=/, "and on the address at mount");
  assert.match(lens, /board_volume\?select=ticker,rvol_at_time&ticker=in\.\(/, "the Hub's RVol per name"); assert.match(lens, /const RVOL_MS = 60000;/);
  assert.match(lens, /const DAILY_ONLY = Object\.freeze\(\{ PCC: true \}\);/, "the put/call ratio is daily at the API"); assert.match(lens, /const NUMBER_LENS = Object\.freeze\(\{ ADVDEC: true \}\);/, "advance/decline is a number lens from the volume feed's breadth");
  assert.doesNotMatch(lens, /indexNowLeaders|ESUSD" : "SPY/, "SPY and QQQ are never swapped for their futures");
  /* the deck: the tape's RVol */
  assert.match(fn(deck, "refreshTapeRvol"), /postMessage\(\{ type:"SCINTILLA_RVOL_WANT", names \}, location\.origin\)/, "the deck asks the lens frame (it keeps only non-price reads)"); assert.match(deck, /const TAPE_RVOL_MS = 60000;/);
  assert.match(deck, /if \(event\.data\?\.type === "SCINTILLA_RVOL"\) \{/, "and takes the numbers back"); assert.doesNotMatch(deck, /pg\("board_volume/, "the deck never reads board_volume itself");
  assert.match(lens, /if \(e\.data\.type === "SCINTILLA_RVOL_WANT"\)/); assert.match(lens, /parent\.postMessage\(\{ type:"SCINTILLA_RVOL", rvol:/);
  assert.match(deck, /if \(widgetsOn\(\)\) b\.querySelector\("\.mk"\)\.insertAdjacentHTML\("afterbegin", '<span class="rv"/, "the RVol tube on the tall cell only, above the line (W10)");
});

test("W7 · the layout: X slimmer, YouTube in the bottom-left corner, the charts above, the lens grid and the volume panel right of YouTube; the volume panel as the meter would read on a TV, one pulsing dot", () => {
  const src = [grab(deck, /const FLOOR_COLUMN_SHARE = [\s\S]*?const FLOOR_COUNTS = \[[^\]]*\];/, "floor"), grab(deck, /const VIDEO_CHROME_FALLBACK_PX = [^;]*;/, "chrome"), fn(deck, "floorGrid"), fn(deck, "floorPlan"),
    grab(deck, /const WIDGETS_KEY = [\s\S]*?const WIDGETS_TAPE_PX = \d+;/, "WIDGETS constants"), grab(deck, /const WIDGETS_X_SHARE = [^\n]*/, "shares"), grab(deck, /const widgetsLensRows = [^\n]*/, "rows"), fn(deck, "floorWidgets"),
    "globalThis.out = { floorPlan, floorWidgets, WIDGETS_X_SHARE };"].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); const D = ctx.out;
  for (const [W, H, minCharts, rows] of [[2560, 1440, 880, 3], [1920, 1080, 650, 2], [1280, 800, 500, 1]]) {
    const plan = D.floorPlan(W, H, 26, D.WIDGETS_X_SHARE), s = D.floorWidgets(plan.charts.w, plan.charts.h, 68, plan.col, 9, 26);
    assert.ok(s.chartsH >= minCharts, W + "×" + H + ": the charts " + s.chartsH + " px tall (at least " + minCharts + ")");
    assert.equal(s.lensTape.rows, rows, W + "×" + H + ": " + rows + " row(s) of lenses in the band");
    assert.equal(s.box.left, -(plan.col + 1)); assert.equal(s.box.w, plan.col + 1 + Math.round(W * 0.35), "W10: the feed column and the player"); assert.equal(s.volume.w, Math.round(W * 0.17));
  }
  assert.match(vol, /#dot\{ width:10px; height:10px; border-radius:50%;[^}]*animation:vmpulse/   /* W12: the top line compact */, "the meter's pulsing dot (W10: the graph's own dot at NOW beside it, as the research page draws it)");
  assert.match(vol, /#tube\{ position:relative; width:8px; height:22px;/, "the thermometer tube (W12: small, beside the 22 px number)"); assert.match(vol, /\$\("fill"\)\.style\.height = \(r == null \? 0 : Math\.round\(Math\.min\(1, r \/ 3\) \* 100\)\) \+ "%";/, "3× is the top of the tube");
  assert.match(vol, /<span class="ib" id="iFlow"[^>]*><i>⇅<\/i><b class="up" id="buy">—<\/b><b class="dn" id="sell">—<\/b><\/span>/   /* W12: an icon badge */); assert.match(vol, /id="bar5"/, "the two halves, labelled (W10: no descriptions - Alan: 'I don't like descriptions')"); assert.doesNotMatch(vol, /who is in control|does it sustain|of a usual/);
  assert.match(vol, /const done = slots\.map\(\(s, i\) => \(\{ \.\.\.s, i \}\)\);/, "the 5-minute multiple from the bars (W10: restated)");
  /* W10: the graph is back as the research page draws it (Alan: "you removed the graph now?"); its beating dot at NOW is the one in the graph, the meter's dot the other */
  assert.match(vol, /beat-core/); assert.match(vol, /id="chart"/);
  assert.match(vol, /\.ib\{[^}]*font-size:10\.5px; font-weight:700;/   /* W12 (Alan: "everything is oversized and the volume oscillator is undersized"): the badges small icons, the graph big */, "badges a TV can read");
});
