/* W1 (22 Oct 2026). Alan, 22 Oct: "On the station, on the new station, just two trading view, like, widget charts. With
   VWAP … I'm not going to be using this chart rotation anymore on station … I need the bars, I need everything … a few
   context lenses, YouTube, the grid, tickers of the general hub in the bottom … ticker and price and the line to the right,
   and the percentage below … Taller and narrower."
   1. WIDGETS: the third wall mode, the default on both Macs, remembered per machine; WALL · SIMPLE · WIDGETS on the dock.
   2. Slots 1 and 2 are TradingView charts (tv-v1, VWAP on); the symbol typed into the pane's box is remembered per chart
      (station.widgets.chart.N), the interval chosen on the shell's strip too (station.widgets.tf.N); defaults 5 and 30.
   3. floorWidgets, pure: two arrangements, every piece a share of the area; the meter and the lens set placed by it.
   4. One taller FAVORITES tape (48 px): ticker and price, the percent under them, the line on the right, no Geiger.
   5. The video shells: with beside=1 a playing video keeps the grid in a column beside it; BACK gives it the pane.
   6. The lens shell: RADAR · MACRO · MINE, MINE remembered; the oval in the day's colour, never grey. No rotation. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html");
const tv = read("../station-shells/tv-v1/index.html");
const lens = read("../station-shells/lens-v1/index.html");
const SHELLS = ["personal-video-v1", "scintilla-video-v1"];
const shells = Object.fromEntries(SHELLS.map((n) => [n, read(`../station-shells/${n}/index.html`)]));
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fn = (src, name) => grab(src, new RegExp("\\nfunction " + name.replace(/[$]/g, "\\$") + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"), name);
const plain = (v) => JSON.parse(JSON.stringify(v));

function deckApi() {
  const src = [
    grab(deck, /const FLOOR_COLUMN_SHARE = [\s\S]*?const FLOOR_COUNTS = \[[^\]]*\];/, "the floor plan constants"),
    grab(deck, /const VIDEO_CHROME_FALLBACK_PX = [^;]*;/, "the shell's bar fallback"),
    fn(deck, "floorGrid"), fn(deck, "floorPlan"),
    grab(deck, /const SIMPLE_KEY = [\s\S]*?const SIMPLE_SPLIT_DEFAULT = [^;]*;/, "the SIMPLE constants"),
    fn(deck, "simpleDefault"), fn(deck, "simpleChoice"), fn(deck, "simpleSplitOf"), fn(deck, "floorSimple"),
    grab(deck, /const WIDGETS_KEY = [\s\S]*?const WIDGETS_TAPE_PX = \d+;/, "the WIDGETS constants"),
    fn(deck, "widgetsChoice"), grab(deck, /const widgetsArrangementOf = [^\n]*/, "widgetsArrangementOf"), fn(deck, "widgetsTfOf"),
    grab(deck, /const WIDGETS_X_SHARE = [^\n]*/, "the wall's shares (W7)"), grab(deck, /const WIDGETS_X_SLIM_SHARE = [^\n]*/, "W1B"), grab(deck, /const widgetsLensRows = [^\n]*/, "widgetsLensRows"), fn(deck, "floorWidgets"),
    grab(deck, /const TAPE_ROW_PX = \d+;/, "the tape's height"), fn(deck, "tapesHeight"), fn(deck, "widgetsTapesHeight"),
    "globalThis.out = { floorPlan, floorSimple, floorWidgets, widgetsLensRows, widgetsChoice, widgetsArrangementOf, widgetsTfOf, tapesHeight, widgetsTapesHeight, WIDGETS_KEY, WIDGETS_CHART_KEY, WIDGETS_TF_KEY, WIDGETS_ARR_KEY, WIDGETS_CHARTS, WIDGETS_TFS, WIDGETS_TF_DEFAULT, WIDGETS_TAPE_PX, WIDGETS_X_SHARE, WIDGETS_YT_W, WIDGETS_VOL_W, WIDGETS_LENS_ROW_PX, FLOOR_SEAM_PX };"
  ].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); return ctx.out;
}
/* his screens (station_x_health, 22 Oct): the MacBook on a 2560 × 1440 external display; the built-in and the iMac at 1280 × 800 */
const SCREENS = [["2560x1440", 2560, 1440], ["1280x800", 1280, 800]];
const CHROME = 26;

test("W1 · WIDGETS is the default on both Macs; the stored choice and the URL win; WIDGETS on means SIMPLE off", () => {
  const D = deckApi();
  assert.equal(D.WIDGETS_KEY, "station.widgets");
  assert.equal(D.widgetsChoice("", ""), true, "nothing stored, nothing on the URL: WIDGETS (both Macs)");
  assert.equal(D.widgetsChoice(null, null), true);
  assert.equal(D.widgetsChoice("0", ""), false, "the machine's stored WALL/SIMPLE stands"); assert.equal(D.widgetsChoice("1", ""), true);
  assert.equal(D.widgetsChoice("1", "0"), false, "?widgets=0 wins for that load"); assert.equal(D.widgetsChoice("0", "1"), true, "?widgets=1 wins for that load");
  assert.equal(D.widgetsChoice("junk", "junk"), true, "anything else is no choice at all");
  assert.match(fn(deck, "simpleOn"), /if \(widgetsOn\(\)\) return false;/, "one wall mode at a time: WIDGETS is decided first");
  assert.ok(!/remember\(WIDGETS_KEY, QS/.test(deck), "the URL's override is not remembered");
  /* the switch */
  const set = fn(deck, "setWidgets");
  assert.match(set, /localStorage\.setItem\(WIDGETS_KEY, on \? "1" : "0"\)/, "the choice is this machine's, like SIMPLE");
  assert.match(set, /if \(on\) \{ placeWidgetsSymbols\(\); tellVideoBeside\(true\); \}/, "WIDGETS on: the two TradingView symbols, and the pane's grid beside the player");
  assert.match(set, /else \{ leaveWidgets\(\);/, "WIDGETS off: the slots go back to chart-v1");
  assert.match(set, /scheduleRotation\(\)/); assert.match(set, /relayout\(\)/);
  assert.match(fn(deck, "setSimple"), /localStorage\.setItem\(WIDGETS_KEY, "0"\)/, "WALL or SIMPLE chosen = WIDGETS off");
  assert.match(fn(deck, "setSimple"), /if \(wasWidgets\) leaveWidgets\(\)/);
  /* the dock */
  assert.match(deck, /<button type="button" class="btn" id="widgetsBtn"[\s\S]{0,600}>widgets<\/button>/, "WIDGETS on the dock");
  const station = grab(deck, /<span class="dsec" data-sec="station"[\s\S]*?<\/span>\n  <span class="dsec" data-sec="scenes"/, "the station section");
  assert.ok(station.includes('id="wallBtn"') && station.includes('id="simpleBtn"') && station.includes('id="widgetsBtn"'), "WALL · SIMPLE · WIDGETS, in the one section the dock always shows");
  const wire = fn(deck, "wireSimple");
  assert.match(wire, /widgetsBtn[\s\S]*setWidgets\(true\)/); assert.doesNotMatch(wire, /widgetsArrBtn/, "W1C: the A · B choice is gone - Alan placed the pieces");
  const paint = fn(deck, "paintSimple");
  assert.match(paint, /classList\.toggle\("widgets", wg\)/); assert.match(paint, /g\.classList\.toggle\("on", wg\)/);
  assert.match(paint, /w\.classList\.toggle\("on", !on && !wg\)/, "WALL lights only when neither SIMPLE nor WIDGETS is on");
});

test("W1 · no rotation on the WIDGETS wall, and a tape tap lands in one of its two charts", () => {
  assert.match(fn(deck, "scheduleRotation"), /if \(ROTATE_PAUSED \|\| simpleOn\(\) \|\| widgetsOn\(\)\) return;/);
  const paint = fn(deck, "paintRotateControls");
  assert.match(paint, /const still = simpleOn\(\) \|\| widgetsOn\(\);/); assert.match(paint, /toggle\.disabled = still;/);
  assert.match(paint, /no rotation in WIDGETS - switch to WALL for the rotation/);
  assert.match(fn(deck, "openTapeTicker"), /widgetsOn\(\) \? Math\.min\(CHART_COUNT, WIDGETS_CHARTS\)/, "a tapped name opens in chart 1 or 2, never a hidden slot");
  assert.match(deck, /if \(event\.data\?\.type === "SCINTILLA_LENS_OPEN"\) \{ openTapeTicker\(event\.data\.ticker\); return; \}/, "a tap on a lens goes through the same door");
});

test("W1 · the two charts are TradingView (tv-v1) in WIDGETS; the symbol and the interval are remembered per chart on this machine", () => {
  const D = deckApi();
  assert.equal(D.WIDGETS_CHARTS, 2); assert.deepEqual(plain(D.WIDGETS_TF_DEFAULT), ["5", "30"], "chart 1 five-minute, chart 2 thirty-minute to begin with");
  assert.equal(D.widgetsTfOf("", 0), "5"); assert.equal(D.widgetsTfOf("", 1), "30"); assert.equal(D.widgetsTfOf("60", 0), "60"); assert.equal(D.widgetsTfOf("7", 1), "30", "an interval the strip does not offer is not kept");
  assert.match(deck, /tv: "\/station-shells\/tv-v1"/, "the shell is registered");
  const src = fn(deck, "paneChartSrc");
  assert.match(src, /if \(widgetsOn\(\) && index < WIDGETS_CHARTS && t\) return widgetsChartSrc\(t, index\);/, "slots 1 and 2 mount the TradingView shell or the live shell in WIDGETS (W3: restated); the other slots keep chart-v1");
  assert.match(fn(deck, "tvChartSrc"), /STATION_SHELL\.tv \+ "\/\?shell=v1&bare=1&sync=1&t=" \+ encodeURIComponent\(t\) \+ "&tf=" \+ encodeURIComponent\(widgetsTf\(index\)\) \+ "&n=" \+ \(index \+ 1\)/);   /* W7: sync=1 - the deck's row owns the timeframe */
  /* the symbol: the deck's own box (the badge → the box → Enter) remembers it; the default is SIMPLE's last symbol */
  assert.match(fn(deck, "commitTicker"), /if \(widgetsOn\(\) && index < WIDGETS_CHARTS\) remember\(WIDGETS_CHART_KEY \+ \(index \+ 1\), ticker\);/);
  assert.match(deck, /const widgetsSymbols = \(\) => Array\.from\(\{ length:WIDGETS_CHARTS \}, \(_, i\) => CLEAN\(remembered\(WIDGETS_CHART_KEY \+ \(i \+ 1\)\)\) \|\| CLEAN\(remembered\(SIMPLE_CHART_KEY \+ \(i \+ 1\)\)\)\);/, "its own memory first, then the last SIMPLE symbol for that chart");
  assert.match(deck, /if \(widgetsOn\(\)\) widgetsSymbols\(\)\.forEach\(\(t, i\) => \{ if \(t && !\(URL_STATEFUL && QS\.has\("c" \+ \(i \+ 1\)\)\)\) CHARTS\[i\] = t; \}\);/, "put back at boot; a URL naming the slot wins");
  const place = fn(deck, "placeWidgetsSymbols");
  assert.match(place, /if \(CHARTS\[i\]\) retargetSlot\(i, CHARTS\[i\]\);/, "the shell changes with the mode, so every slot is re-pointed");
  /* the interval: the shell says, the deck remembers, and the slot's address is kept in step */
  assert.match(deck, /if \(event\.data\?\.type === "SCINTILLA_TV_STATE" \|\| event\.data\?\.type === "SCINTILLA_LIVE_STATE"\) \{[\s\S]{0,900}?setWidgetsTf\(tf\); return; \}[\s\S]{0,1200}?o\.frame\.dataset\.shown = o\.def\.src;/);
  /* the shell itself */
  assert.match(tv, /embed-widget-advanced-chart\.js/, "the free Advanced Chart embed, the research board's");
  assert.match(tv, /studies: \["STD;VWAP"\]/, "VWAP preloaded"); assert.match(tv, /style: "1"/, "candles"); assert.match(tv, /timezone: "America\/New_York"/); assert.match(tv, /theme: "dark"/);
  assert.match(tv, /hide_side_toolbar: false/, "the drawing toolbar on"); assert.match(tv, /extended_hours: true/, "extended hours asked for (a key the embed lists)");
  assert.match(tv, /allow_symbol_change: true/, "the widget's own symbol search stays");
  assert.match(tv, /const INTERVALS = \["1", "5", "15", "30", "60", "D"\];/);
  assert.match(tv, /parent\.postMessage\(\{ type: "SCINTILLA_TV_STATE", n: N, ticker: SYMBOL, interval: INTERVAL \}, location\.origin\)/, "the strip's choice is told to the deck");
  assert.match(tv, /if \(e\.data\.sc === "chart" && e\.data\.ticker\)/, "a re-point by message is a new widget");
  /* measured 22 Oct: the embed posts quoteUpdate messages to its parent with short_name - so a symbol chosen with the
     widget's OWN search IS heard, and remembered through the deck; the interval chosen inside the widget is not posted */
  assert.match(tv, /const WIDGET_ORIGIN = "https:\/\/www\.tradingview-widget\.com";/);
  assert.match(fn(tv, "heardFromWidget"), /m\.name !== "quoteUpdate"/); assert.match(fn(tv, "heardFromWidget"), /short_name/);
  assert.match(deck, /if \(\(n === 1 \|\| n === 2\) && heard && heard !== CHARTS\[n - 1\] && own && widgetsOn\(\) && !live\)/, "the deck takes the widget's symbol into the slot and remembers it");
  assert.match(tv, /VIX: "TVC:VIX", US10Y: "TVC:US10Y", DXUSD: "TVC:DXY"/, "the Station's macro names on TradingView's symbology");
});

test("W1 · floorWidgets, pure (restated for W7): X slimmer, YouTube in the bottom-left corner, the charts the whole area above the band, the lens grid and the volume right of YouTube over the FAVORITES tape", () => {
  const D = deckApi();
  assert.equal(D.WIDGETS_TAPE_PX, 66); assert.equal(D.widgetsTapesHeight(true), 68); assert.equal(D.widgetsTapesHeight(false), 0);
  assert.equal(D.WIDGETS_X_SHARE, 0.18); assert.equal(D.WIDGETS_YT_W, 0.34); assert.equal(D.WIDGETS_VOL_W, 0.17); assert.equal(D.WIDGETS_LENS_ROW_PX, 150);
  for (const [key, W, H] of SCREENS.concat([["1920x1080", 1920, 1080]])) {
    const plan = D.floorPlan(W, H, CHROME, D.WIDGETS_X_SHARE);
    assert.equal(plan.col, Math.round(W * 0.18), key + ": X's column is 18 % of the wall on the WIDGETS wall");
    const s = D.floorWidgets(plan.charts.w, plan.charts.h, 68, plan.col, 9, CHROME);
    assert.equal(s.widgets, true); assert.equal(s.cols, 2); assert.equal(s.rows, 1); assert.equal(s.charts, 2); assert.equal(s.hidden, 7);
    assert.equal(s.wall, W, "the wall is the column, the seam and the chart area");
    assert.equal(s.box.w, Math.round(W * 0.34), key + ": YouTube is 34 % of the wall wide"); assert.equal(s.box.left, -(plan.col + 1), "from the screen's left edge");
    assert.equal(s.bandH, Math.round(s.box.w * 9 / 16) + CHROME, "the band is YouTube's 16:9 picture plus the bar"); assert.equal(s.box.top + s.box.h, plan.charts.h, "at the bottom");
    assert.equal(s.chartsH + 1 + s.bandH, plan.charts.h, "the charts have everything above the band");
    assert.equal(s.volume.w, Math.round(W * 0.17)); assert.equal(s.volume.left + s.volume.w, plan.charts.w, "the volume panel at the right"); assert.equal(s.volume.h, s.bandH - 68, "over the tape");
    assert.equal(s.lensTape.left, s.box.w - plan.col - 1 + 1, "the lens grid starts at YouTube's right edge"); assert.equal(s.lensTape.left + s.lensTape.w + 1, s.volume.left, "and ends at the volume panel");
    assert.equal(s.lensTape.h, s.bandH - 68); assert.equal(s.lensTape.rows, D.widgetsLensRows(s.bandH - 68)); assert.ok(s.lensTape.rows >= 1);
    assert.equal(s.tapeLeft, s.box.w + 1, "the FAVORITES tape starts at YouTube's right edge"); assert.equal(s.rowBelow, s.bandH - 68);
    assert.ok(s.chartsH >= 500, key + ": the charts keep at least 500 px (" + s.chartsH + ")");
    assert.equal(s.picture.h, Math.round(s.picture.w * 9 / 16));
  }
  assert.equal(D.widgetsLensRows(450), 3, "three rows of 150 px lenses in 450 px (the 2560 band)"); assert.equal(D.widgetsLensRows(325), 2, "two on the 1920 band"); assert.equal(D.widgetsLensRows(206), 1); assert.equal(D.widgetsLensRows(10), 1, "never none");
  /* the slot is planned before SIMPLE's, and fitVideoPane treats both as the band */
  assert.match(fn(deck, "slotFor"), /if \(widgetsOn\(\)\) return floorWidgets\(plan\.charts\.w, plan\.charts\.h, tapePx, plan\.col, count, chromePx\);\n[\s\S]{0,200}?if \(simpleOn\(\)\) return floorSimple/);
  const fit = fn(deck, "fitVideoPane");
  assert.match(fit, /const simple = !!slot && \(!!slot\.simple \|\| !!slot\.widgets\);/);
  assert.match(fit, /slot\.widgets \? slot\.rowBelow : slot\.box\.h/, "the chart row gives up the band (W7: the band less the tape under the grid)");
  assert.match(fit, /placeWidgets\(slot && slot\.widgets \? slot : null, plan\);/);
  assert.match(fit, /widgetsOn\(\) \? widgetsTapesHeight\(tapesOn\(\)\) : tapesHeight\(tapesOn\(\)\)/, "the taller tape's height is the band's");
  assert.match(deck, /body\.widgets\.video-slot:not\(\.stack\) #grid > #rowTop\{ margin-bottom:calc\(var\(--simple-video-px, 0px\) \+ 1px \+ var\(--tapes-px, 0px\)\); \}/);
  assert.match(deck, /body\.widgets\.video-slot\.tapes:not\(\.stack\) #tapes\{ bottom:0; left:var\(--widgets-tape-left, [^\n]*\}/, "W1C: the FAVORITES tape at the very bottom; W7: from YouTube's right edge");
  /* W1C: the volume graph (volume-v1) in the column, the lens tape (lens-v1 in tape mode) over the band; the pill meter left the wall */
  assert.match(deck, /const WIDGETS_VOLUME_SHELL = "\/station-shells\/volume-v1", WIDGETS_VOLUME_OPEN = "https:\/\/volume-pulse-pied\.vercel\.app\/";/);
  assert.match(fn(deck, "mountWidgets"), /WIDGETS_VOLUME_SHELL \+ "\/\?shell=v1/); assert.match(fn(deck, "mountWidgets"), /WIDGETS_LENS_SHELL \+ "\/\?shell=v1&mode=tape/);
  assert.match(fn(deck, "wireWidgets"), /make\("wgVolume", "Volume"/); assert.match(fn(deck, "wireWidgets"), /make\("wgLensTape", ""/);
  assert.doesNotMatch(deck, /meter\.html/, "the pill meter is not on the wall");
  assert.match(deck, /wireWidgets\(grid\);/, "made with the tapes");
});

test("W1 · the tape: one FAVORITES row in WIDGETS, each cell two lines - ticker and price, the percent under, the line right, no Geiger", () => {
  const paint = fn(deck, "paintTapes");
  assert.match(paint, /const tall = widgetsOn\(\);/);
  assert.match(paint, /if \(tall\) box\.firstChild\.classList\.add\("tall"\);\n\s+else box\.appendChild\(tapeRow\("LIKED"/, "FAVORITES alone on the WIDGETS wall; both tapes elsewhere");
  assert.match(paint, /const key = \(tall \? "tall\|" : ""\) \+ TAPES\.liked/, "a mode change rebuilds the rows");
  /* W1C: the stacked cell - ticker over percent over price, the line on the right across the three, every cell 156 px wide, tabular numbers */
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell\{ height:var\(--tape-row-px, 66px\); width:196px; display:grid; grid-template-columns:minmax\(0,1fr\) 64px 34px; grid-template-rows:1fr 1fr 1fr;[\s\S]{0,200}?font-size:12px; font-variant-numeric:tabular-nums; \}/, "three rows, one width, tabular numbers (W7: a third column for the RVol)");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell \.tk\{ grid-column:1; grid-row:1;/, "the ticker on top");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell \.pc\{ grid-column:1; grid-row:2;/, "the percent under it");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell \.px\{ grid-column:1; grid-row:3;/, "the price under that");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell \.mk\{ grid-column:2; grid-row:1 \/ span 3; width:64px; \}/, "the line on the right, across the three");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell \.gb\{ display:none; \}/, "no Geiger in the tape");
  assert.match(deck, /grid\.style\.setProperty\("--tape-row-px", \(widgetsOn\(\) \? WIDGETS_TAPE_PX : TAPE_ROW_PX\) \+ "px"\);/);
  /* the flash, the line's colour and its side are the S16b ones, untouched */
  assert.match(deck, /\.tape \.cell\.flash \.px\{ animation:tape-scin \.6s ease-out; \}/);
  assert.match(deck, /\.tape \.spark\.up path\{ stroke:var\(--bull\); \} \.tape \.spark\.dn path\{ stroke:var\(--bear\); \}/);
  assert.match(fn(deck, "tapeLineSide"), /q\.pct >= 0 \? " up" : " dn"/);
});

test("W1 · the video shells: beside=1 keeps the grid in a column beside the player; a thumbnail switches; BACK gives the pane back; the twins are byte-identical", () => {
  assert.equal(shells["personal-video-v1"], shells["scintilla-video-v1"], "byte-identical twins");
  const s = shells["scintilla-video-v1"];
  assert.match(s, /let BESIDE = QS\.get\("beside"\) === "1", BESIDE_COL = /);   /* W1B: restated - the column's width came with it */
  assert.match(s, /if \(event\.data\?\.type === "SCINTILLA_VIDEO_BESIDE"\) \{ BESIDE = !!event\.data\.on; BESIDE_COL = [^\n]*paintBeside\(\); relayout\(\); tellPlaying\(\); \}/, "the deck can say so by message (W1B: restated, the column's width and the reply)");
  assert.match(s, /body\.beside\.playing\{ display:grid; grid-template-columns:minmax\(0,1fr\) var\(--beside-col, 300px\);/, "W1B: restated - the grid a fixed column, the player the rest (Alan: don't shrink my YouTube)");
  assert.match(s, /body\.beside\.playing > #grid\{ grid-column:2; grid-row:2; display:grid;/, "the grid stays shown while a video plays");
  assert.match(s, /body\.playing #grid\{ display:none; \}/, "without beside, the pane is as it was (Y7)");
  assert.match(fn(s, "besideCols"), /w < 400 \? 1 : w < 800 \? 2 : 3/);
  assert.match(fn(s, "relayout"), /const beside = besideNow\(\);\n\s+const w = beside \? \(el\("grid"\)\.clientWidth/, "the column counts its own width");
  assert.match(fn(s, "back"), /document\.body\.classList\.remove\("playing"\);\n\s+if \(BESIDE\) relayout\(\);/, "BACK gives the grid the pane");
  assert.match(s, /document\.body\.classList\.add\("playing"\);\n\s+if \(BESIDE\) relayout\(\);/, "a playing video re-counts the column");
  assert.match(s, /if \(card && BYID\[card\.dataset\.v\]\) playFromUserGesture\(BYID\[card\.dataset\.v\]\);/, "a tap on another thumbnail switches the video (unchanged)");
  /* Y7, Y8, Y10 untouched */
  assert.match(s, /function soundOnFirstTap/); assert.match(s, /SCINTILLA_VIDEO_PIP_TOGGLE/); assert.match(s, /body\.playing\.can-float #bPipBar\{ display:inline-flex; \}/);
  /* the deck asks for it on the WIDGETS wall */
  assert.match(deck, /"\?shell=v1&feed=scintilla&cols=2" \+ \(widgetsOn\(\) \? "&beside=1" : ""\)/);
  assert.match(deck, /"\?shell=v1&feed=personal&cols=2" \+ \(widgetsOn\(\) \? "&beside=1" : ""\)/);
  assert.match(fn(deck, "tellVideoBeside"), /postMessage\(\{ type:"SCINTILLA_VIDEO_BESIDE", on:!!on, col:[^\n]*\}, location\.origin\)/);
});

test("W1 · the lens set: RADAR · MACRO · MINE, remembered; MINE adds and removes; the oval in the day's colour, never grey", () => {
  /* the pure list rules, run as the shell runs them */
  const src = [grab(lens, /const LISTS = \[[^\]]*\];/, "LISTS"), grab(lens, /const MACRO = Object\.freeze\(\[[^\]]*\]\);/, "MACRO"), "const MAX_LENSES = 24;",
    'const CLEAN = (t) => String(t || "").toUpperCase().replace(/[^A-Z0-9.\\-]/g, "").slice(0, 12);',
    grab(lens, /export function listChoice[^\n]*/, "listChoice").replace("export ", ""), grab(lens, /export function mineOf[^\n]*/, "mineOf").replace("export ", ""),
    grab(lens, /export function mineAdd[^\n]*/, "mineAdd").replace("export ", ""), grab(lens, /export function mineRemove[^\n]*/, "mineRemove").replace("export ", ""),
    "globalThis.out = { LISTS, MACRO, listChoice, mineOf, mineAdd, mineRemove };"].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); const L = ctx.out;
  assert.deepEqual(plain(L.LISTS), ["radar", "macro", "mine"]);
  assert.deepEqual(plain(L.MACRO), ["SPY", "QQQ", "ESUSD", "NQUSD", "VIX", "PCC", "ADVDEC", "CLUSD", "US10Y", "BTCUSD", "GCUSD", "DXUSD"], "W7: SPY and QQQ, the futures beside them, VIX, put/call, advance/decline, oil, the 10-year, bitcoin, gold, the dollar");
  assert.equal(L.listChoice("", ""), "radar", "opens on RADAR"); assert.equal(L.listChoice("macro", ""), "macro", "the remembered list"); assert.equal(L.listChoice("macro", "mine"), "mine", "the URL wins for that load"); assert.equal(L.listChoice("junk", "junk"), "radar");
  assert.deepEqual(plain(L.mineOf('["nvda","AMD","nvda"," x!y "]')), ["NVDA", "AMD", "XY"], "cleaned, deduped"); assert.deepEqual(plain(L.mineOf("junk")), []); assert.deepEqual(plain(L.mineOf("")), []);
  assert.deepEqual(plain(L.mineAdd(["NVDA"], "amd")), ["NVDA", "AMD"]); assert.deepEqual(plain(L.mineAdd(["NVDA"], "nvda")), ["NVDA"], "never twice"); assert.deepEqual(plain(L.mineAdd(["NVDA"], "!!")), ["NVDA"]);
  assert.deepEqual(plain(L.mineRemove(["NVDA", "AMD"], "nvda")), ["AMD"]);
  assert.match(lens, /const LIST_KEY = "station\.lenses\.list", MINE_KEY = "station\.lenses\.mine";/, "remembered on this machine");
  assert.match(lens, /remember\(MINE_KEY, JSON\.stringify\(MINE\)\)/); assert.match(lens, /remember\(LIST_KEY, l\)/);
  assert.match(lens, /station_lists\?select=position,ticker&list=eq\.radar&order=position\.asc/, "RADAR is the Hub's list, one GET");
  /* the drawing: chart-v1's oval (station-lens.mjs ovalGeometry, lens-bars drawCandles), the 1d:60 lens, the day's colour on the edge */
  assert.match(lens, /import \{ ovalGeometry, insideOval, INK \} from "\/_indicators\/station-lens\.mjs";/);
  assert.match(lens, /const LENS_TF = TAPE \? "5m" : "1d", LENS_BARS = TAPE \? 30 : 60;/, "sixty daily candles in the column - the zoomed-out view the intraday ranges carry; W4: the latest 30 five-minute bars on the tape");
  assert.match(lens, /ctx\.strokeStyle = day === "up" \? PALETTE\.bull : day === "down" \? PALETTE\.bear : INK\.frame;/, "the oval's edge in the day's colour");
  assert.match(lens, /drawCandles\(ctx, bars, geo\.candles, \{ colour: "bar", day, pal: PALETTE \}\)/, "the candles as the lens draws them");
  assert.match(lens, /\.lens \.pc\.up, \.lens \.tk\.up\{ color:var\(--bull\); \} \.lens \.pc\.dn, \.lens \.tk\.dn\{ color:var\(--bear\); \}/, "the head in the day's colour");
  assert.match(lens, /\.lens \.tk\{ font-size:15px;/, "readable from the chair (the tape's type was 11 px)");
  assert.match(lens, /parent\.postMessage\(\{ type: "SCINTILLA_LENS_OPEN", ticker: t \}, location\.origin\)/, "a tap opens the name on the wall");
  assert.match(lens, /P\.marketQuotes\(list, \{\}\)/); assert.match(lens, /P\.marketCandles\(t, tf, TAPE \? \{ limit: LENS_BARS, forming: true \} : \{ limit: LENS_BARS \}\)/);   /* W4: restated - a fresh read on the tape; W7: the timeframe per name (the put/call ratio is daily) */
  /* W4 (22 Oct): restated - the tape's "+ ticker" box writes MINE to station_lists through the deck's door, and × deletes there; nothing else is written */
  assert.equal((lens.match(/method: "POST"/g) || []).length, 1, "one write: the MINE upsert"); assert.equal((lens.match(/method: "DELETE"/g) || []).length, 1, "one delete: a MINE row");
  assert.match(lens, /station_lists\?on_conflict=list,position", \{ method: "POST"/); assert.doesNotMatch(lens, /hub_favorites[^\n]*method/, "the Hub's lists are never written");
});
