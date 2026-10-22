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
    grab(deck, /const WIDGETS_METER_PX = [^\n]*/, "the arrangement shares"), fn(deck, "floorWidgets"),
    grab(deck, /const TAPE_ROW_PX = \d+;/, "the tape's height"), fn(deck, "tapesHeight"), fn(deck, "widgetsTapesHeight"),
    "globalThis.out = { floorPlan, floorSimple, floorWidgets, widgetsChoice, widgetsArrangementOf, widgetsTfOf, tapesHeight, widgetsTapesHeight, WIDGETS_KEY, WIDGETS_CHART_KEY, WIDGETS_TF_KEY, WIDGETS_ARR_KEY, WIDGETS_CHARTS, WIDGETS_TFS, WIDGETS_TF_DEFAULT, WIDGETS_TAPE_PX, WIDGETS_A_BAND, WIDGETS_A_VIDEO_W, WIDGETS_B_BAND, WIDGETS_B_VIDEO, FLOOR_SEAM_PX };"
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
  assert.match(deck, /<button type="button" class="btn" id="widgetsArrBtn"/, "A · B on the dock");
  const station = grab(deck, /<span class="dsec" data-sec="station"[\s\S]*?<\/span>\n  <span class="dsec" data-sec="scenes"/, "the station section");
  assert.ok(station.includes('id="wallBtn"') && station.includes('id="simpleBtn"') && station.includes('id="widgetsBtn"'), "WALL · SIMPLE · WIDGETS, in the one section the dock always shows");
  const wire = fn(deck, "wireSimple");
  assert.match(wire, /widgetsBtn[\s\S]*setWidgets\(true\)/); assert.match(wire, /widgetsArrBtn[\s\S]*setWidgetsArrangement\(/);
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
  assert.match(src, /if \(widgetsOn\(\) && index < WIDGETS_CHARTS && t\) return tvChartSrc\(t, index\);/, "slots 1 and 2 mount the TradingView shell in WIDGETS; the other slots keep chart-v1");
  assert.match(fn(deck, "tvChartSrc"), /STATION_SHELL\.tv \+ "\/\?shell=v1&bare=1&t=" \+ encodeURIComponent\(t\) \+ "&tf=" \+ encodeURIComponent\(widgetsTf\(index\)\) \+ "&n=" \+ \(index \+ 1\)/);
  /* the symbol: the deck's own box (the badge → the box → Enter) remembers it; the default is SIMPLE's last symbol */
  assert.match(fn(deck, "commitTicker"), /if \(widgetsOn\(\) && index < WIDGETS_CHARTS\) remember\(WIDGETS_CHART_KEY \+ \(index \+ 1\), ticker\);/);
  assert.match(deck, /const widgetsSymbols = \(\) => Array\.from\(\{ length:WIDGETS_CHARTS \}, \(_, i\) => CLEAN\(remembered\(WIDGETS_CHART_KEY \+ \(i \+ 1\)\)\) \|\| CLEAN\(remembered\(SIMPLE_CHART_KEY \+ \(i \+ 1\)\)\)\);/, "its own memory first, then the last SIMPLE symbol for that chart");
  assert.match(deck, /if \(widgetsOn\(\)\) widgetsSymbols\(\)\.forEach\(\(t, i\) => \{ if \(t && !\(URL_STATEFUL && QS\.has\("c" \+ \(i \+ 1\)\)\)\) CHARTS\[i\] = t; \}\);/, "put back at boot; a URL naming the slot wins");
  const place = fn(deck, "placeWidgetsSymbols");
  assert.match(place, /if \(CHARTS\[i\]\) retargetSlot\(i, CHARTS\[i\]\);/, "the shell changes with the mode, so every slot is re-pointed");
  /* the interval: the shell says, the deck remembers, and the slot's address is kept in step */
  assert.match(deck, /if \(event\.data\?\.type === "SCINTILLA_TV_STATE"\) \{[\s\S]{0,900}?remember\(WIDGETS_TF_KEY \+ n, tf\);[\s\S]{0,1200}?o\.frame\.dataset\.shown = o\.def\.src;/);
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
  assert.match(deck, /if \(\(n === 1 \|\| n === 2\) && heard && heard !== CHARTS\[n - 1\] && own && widgetsOn\(\)\)/, "the deck takes the widget's symbol into the slot and remembers it");
  assert.match(tv, /VIX: "TVC:VIX", US10Y: "TVC:US10Y", DXUSD: "TVC:DXY"/, "the Station's macro names on TradingView's symbology");
});

test("W1 · floorWidgets, pure: two arrangements at both screens - every piece a share, the charts side by side, the tape taller", () => {
  const D = deckApi();
  assert.equal(D.WIDGETS_TAPE_PX, 48); assert.equal(D.widgetsTapesHeight(true), 50); assert.equal(D.widgetsTapesHeight(false), 0);
  assert.ok(D.WIDGETS_TAPE_PX > 2 * 22 - 1, "a cell is taller than today's 22 px row - twice it");
  for (const [key, W, H] of SCREENS) {
    const plan = D.floorPlan(W, H, CHROME);
    assert.equal(plan.col, Math.round(W * 0.24), key + ": X's column is 24 % of the wall, as S11 set it");
    for (const arr of ["a", "b"]) {
      const s = D.floorWidgets(plan.charts.w, plan.charts.h, 50, arr, 9, CHROME);
      assert.equal(s.widgets, true); assert.equal(s.arrangement, arr);
      assert.equal(s.cols, 2); assert.equal(s.rows, 1); assert.equal(s.charts, 2); assert.equal(s.hidden, 7, "nine on the page: two shown, seven mounted and hidden");
      assert.deepEqual(plain(s.cells), [{ col: 1, row: 1 }, { col: 2, row: 1 }]);
      /* the pieces tile the area: charts over tapes over the band, no gap, no overlap */
      assert.equal(s.chartsH + 50 + D.FLOOR_SEAM_PX + s.bandH, plan.charts.h, key + " " + arr + ": charts + tapes + seam + band = the height");
      for (const b of [s.box, s.meter, s.lenses]) { assert.ok(b.w > 0 && b.h > 0, "every piece has room"); assert.ok(b.left >= 0 && b.left + b.w <= plan.charts.w + 1); assert.ok(b.top >= s.chartsH + 50 && b.top + b.h <= plan.charts.h + 1, "inside the band"); }
      const ov = (p, q) => !(p.left + p.w <= q.left || q.left + q.w <= p.left || p.top + p.h <= q.top || q.top + q.h <= p.top);
      assert.ok(!ov(s.box, s.meter) && !ov(s.box, s.lenses) && !ov(s.meter, s.lenses), "no two pieces overlap");
      assert.equal(s.picture.h, Math.round(s.picture.w * 9 / 16), "the pane's picture is 16:9 under the bar");
      if (arr === "a") {
        assert.equal(s.bandH, Math.round((plan.charts.h - 1) * D.WIDGETS_A_BAND), "A: the band is 44 % of the height");
        assert.equal(s.box.w, Math.round(plan.charts.w * D.WIDGETS_A_VIDEO_W), "A: YouTube takes 62 % of the band's width");
        assert.equal(s.meter.h, 76); assert.equal(s.lenses.top, s.meter.top + 77, "A: the lenses under the meter");
      } else {
        assert.equal(s.box.w, plan.charts.w, "B: YouTube across the whole width");
        assert.equal(s.box.h, Math.round((plan.charts.h - 2) * D.WIDGETS_B_VIDEO), "B: 28 % of the height");
        assert.equal(s.meter.h, s.lenses.h, "B: the meter and the lenses share one band"); assert.equal(s.meter.top, s.lenses.top);
      }
    }
  }
  /* the slot is planned before SIMPLE's, and fitVideoPane treats both as the band */
  assert.match(fn(deck, "slotFor"), /if \(widgetsOn\(\)\) return floorWidgets\(plan\.charts\.w, plan\.charts\.h, tapePx, widgetsArrangement\(\), count, chromePx\);\n[\s\S]{0,200}?if \(simpleOn\(\)\) return floorSimple/);
  const fit = fn(deck, "fitVideoPane");
  assert.match(fit, /const simple = !!slot && \(!!slot\.simple \|\| !!slot\.widgets\);/);
  assert.match(fit, /slot\.widgets \? slot\.bandH : slot\.box\.h/, "the chart row gives up the whole band");
  assert.match(fit, /placeWidgets\(slot && slot\.widgets \? slot : null, plan\);/);
  assert.match(fit, /widgetsOn\(\) \? widgetsTapesHeight\(tapesOn\(\)\) : tapesHeight\(tapesOn\(\)\)/, "the taller tape's height is the band's");
  assert.match(deck, /body\.widgets\.video-slot:not\(\.stack\) #grid > #rowTop\{ margin-bottom:calc\(var\(--simple-video-px, 0px\) \+ 1px \+ var\(--tapes-px, 0px\)\); \}/);
  assert.match(deck, /body\.widgets\.video-slot\.tapes:not\(\.stack\) #tapes\{ bottom:calc\(var\(--simple-video-px, 0px\) \+ 1px\); \}/);
  /* the meter: the live meter framed (it frames: no X-Frame-Options, no frame-ancestors - checked 22 Oct), a click opens the full page itself */
  assert.match(deck, /const WIDGETS_METER_URL = "https:\/\/volume-pulse-pied\.vercel\.app\/meter\.html", WIDGETS_METER_OPEN = "https:\/\/volume-pulse-pied\.vercel\.app\/";/);
  assert.match(fn(deck, "mountWidgets"), /f\.src = WIDGETS_METER_URL/); assert.match(fn(deck, "mountWidgets"), /WIDGETS_LENS_SHELL \+ "\/\?shell=v1/);
  assert.match(fn(deck, "wireWidgets"), /make\("wgMeter", "Volume"/); assert.match(fn(deck, "wireWidgets"), /make\("wgLenses", "Lenses"/);
  assert.match(deck, /wireWidgets\(grid\);/, "made with the tapes");
});

test("W1 · the tape: one FAVORITES row in WIDGETS, each cell two lines - ticker and price, the percent under, the line right, no Geiger", () => {
  const paint = fn(deck, "paintTapes");
  assert.match(paint, /const tall = widgetsOn\(\);/);
  assert.match(paint, /if \(tall\) box\.firstChild\.classList\.add\("tall"\);\n\s+else box\.appendChild\(tapeRow\("LIKED"/, "FAVORITES alone on the WIDGETS wall; both tapes elsewhere");
  assert.match(paint, /const key = \(tall \? "tall\|" : ""\) \+ TAPES\.liked/, "a mode change rebuilds the rows");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell\{ height:var\(--tape-row-px, 48px\); display:grid; grid-template-columns:auto auto; grid-template-rows:1fr 1fr;[\s\S]{0,200}?font-size:12\.5px; \}/, "two rows, bigger type");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell \.tk\{ grid-column:1; grid-row:1;/, "the ticker on the first line");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell \.px\{ grid-column:1; grid-row:1;/, "the price beside it");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell \.pc\{ grid-column:1; grid-row:2;/, "the percent under them");
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell \.mk\{ grid-column:2; grid-row:1 \/ span 2; width:64px; \}/, "the line on the right, across both lines, wider");
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
  assert.match(s, /let BESIDE = QS\.get\("beside"\) === "1";/);
  assert.match(s, /if \(event\.data\?\.type === "SCINTILLA_VIDEO_BESIDE"\) \{ BESIDE = !!event\.data\.on; paintBeside\(\); relayout\(\); \}/, "the deck can say so by message");
  assert.match(s, /body\.beside\.playing\{ display:grid; grid-template-columns:minmax\(0,2fr\) minmax\(200px,1fr\);/, "the player about two thirds, the grid the rest");
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
  assert.match(fn(deck, "tellVideoBeside"), /postMessage\(\{ type:"SCINTILLA_VIDEO_BESIDE", on:!!on \}, location\.origin\)/);
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
  assert.deepEqual(plain(L.MACRO), ["VIX", "DXUSD", "US10Y", "GCUSD", "CLUSD", "BTCUSD"], "MACRO · DAY's six (deck/scenes.js)");
  assert.equal(L.listChoice("", ""), "radar", "opens on RADAR"); assert.equal(L.listChoice("macro", ""), "macro", "the remembered list"); assert.equal(L.listChoice("macro", "mine"), "mine", "the URL wins for that load"); assert.equal(L.listChoice("junk", "junk"), "radar");
  assert.deepEqual(plain(L.mineOf('["nvda","AMD","nvda"," x!y "]')), ["NVDA", "AMD", "XY"], "cleaned, deduped"); assert.deepEqual(plain(L.mineOf("junk")), []); assert.deepEqual(plain(L.mineOf("")), []);
  assert.deepEqual(plain(L.mineAdd(["NVDA"], "amd")), ["NVDA", "AMD"]); assert.deepEqual(plain(L.mineAdd(["NVDA"], "nvda")), ["NVDA"], "never twice"); assert.deepEqual(plain(L.mineAdd(["NVDA"], "!!")), ["NVDA"]);
  assert.deepEqual(plain(L.mineRemove(["NVDA", "AMD"], "nvda")), ["AMD"]);
  assert.match(lens, /const LIST_KEY = "station\.lenses\.list", MINE_KEY = "station\.lenses\.mine";/, "remembered on this machine");
  assert.match(lens, /remember\(MINE_KEY, JSON\.stringify\(MINE\)\)/); assert.match(lens, /remember\(LIST_KEY, l\)/);
  assert.match(lens, /station_lists\?select=position,ticker&list=eq\.radar&order=position\.asc/, "RADAR is the Hub's list, one GET");
  /* the drawing: chart-v1's oval (station-lens.mjs ovalGeometry, lens-bars drawCandles), the 1d:60 lens, the day's colour on the edge */
  assert.match(lens, /import \{ ovalGeometry, insideOval, INK \} from "\/_indicators\/station-lens\.mjs";/);
  assert.match(lens, /const LENS_TF = "1d", LENS_BARS = 60;/, "sixty daily candles - the zoomed-out view the intraday ranges carry");
  assert.match(lens, /ctx\.strokeStyle = day === "up" \? PALETTE\.bull : day === "down" \? PALETTE\.bear : INK\.frame;/, "the oval's edge in the day's colour");
  assert.match(lens, /drawCandles\(ctx, bars, geo\.candles, \{ colour: "bar", day, pal: PALETTE \}\)/, "the candles as the lens draws them");
  assert.match(lens, /\.lens \.pc\.up, \.lens \.tk\.up\{ color:var\(--bull\); \} \.lens \.pc\.dn, \.lens \.tk\.dn\{ color:var\(--bear\); \}/, "the head in the day's colour");
  assert.match(lens, /\.lens \.tk\{ font-size:15px;/, "readable from the chair (the tape's type was 11 px)");
  assert.match(lens, /parent\.postMessage\(\{ type: "SCINTILLA_LENS_OPEN", ticker: t \}, location\.origin\)/, "a tap opens the name on the wall");
  assert.match(lens, /P\.marketQuotes\(list, \{\}\)/); assert.match(lens, /P\.marketCandles\(t, LENS_TF, \{ limit: LENS_BARS \}\)/);
  assert.ok(!/pgWrite|method:\s*"POST"/.test(lens), "nothing here writes anywhere");
});
