/* W3 (22 Oct 2026). Alan, undecided between TradingView's embed (he draws there; 18-21 min behind, Cboe One volume) and the house live chart
   (W2's live-v1: the whole tape, bars 3 s after their close, VWAP to the cent, his clouds): one of each on the WIDGETS wall, a LIVE · TV switch
   on each chart's strip, remembered per chart per machine; the symbol and the interval carried across a switch. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html"), tv = read("../station-shells/tv-v1/index.html"), live = read("../station-shells/live-v1/index.html");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fn = (src, name) => grab(src, new RegExp("\\nfunction " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"), name);
function api() {
  const src = [grab(deck, /const WIDGETS_SRC_KEY = [^\n]*/, "the source constants"), fn(deck, "widgetsSrcOf"),
    "globalThis.out = { widgetsSrcOf, WIDGETS_SRC_KEY, WIDGETS_SRCS, WIDGETS_SRC_DEFAULT };"].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); return ctx.out;
}

test("W3 · the defaults: chart 1 LIVE, chart 2 TV; the stored choice wins; ?chart1= / ?chart2= win for one load and are not remembered", () => {
  const D = api();
  assert.equal(D.WIDGETS_SRC_KEY, "station.widgets.src."); assert.deepEqual([...D.WIDGETS_SRCS], ["live", "tv"]); assert.deepEqual([...D.WIDGETS_SRC_DEFAULT], ["live", "live"]);   /* W4 (22 Oct 19:10): both LIVE by default */
  assert.equal(D.widgetsSrcOf("", "", 0), "live", "chart 1 is the house live chart with nothing stored");
  assert.equal(D.widgetsSrcOf("", "", 1), "live", "chart 2 is the live chart too with nothing stored (W4: restated; TV one click away)");
  assert.equal(D.widgetsSrcOf(null, null, 5), "tv", "a slot past the two: TV");
  assert.equal(D.widgetsSrcOf("tv", "", 0), "tv", "the machine's choice stands"); assert.equal(D.widgetsSrcOf("live", "", 1), "live");
  assert.equal(D.widgetsSrcOf("tv", "live", 0), "live", "?chart1=live wins for that load"); assert.equal(D.widgetsSrcOf("live", "tv", 1), "tv");
  assert.equal(D.widgetsSrcOf("junk", "junk", 0), "live", "anything else is no choice");
  assert.match(fn(deck, "widgetsSrc"), /widgetsSrcOf\(remembered\(WIDGETS_SRC_KEY \+ \(index \+ 1\)\), QS\.get\("chart" \+ \(index \+ 1\)\), index\)/);
  assert.ok(!/remember\(WIDGETS_SRC_KEY \+ \(index \+ 1\), QS/.test(deck), "the URL's override is not remembered");
});

test("W3 · the slot mounts live-v1 or tv-v1 on the same address by its source; the Y9 door drives whichever is mounted", () => {
  assert.match(deck, /live: "\/station-shells\/live-v1",/, "the shell is registered");
  assert.match(fn(deck, "liveChartSrc"), /STATION_SHELL\.live \+ "\/\?shell=v1&bare=1&t=" \+ encodeURIComponent\(t\) \+ "&tf=" \+ encodeURIComponent\(widgetsTf\(index\)\) \+ "&n=" \+ \(index \+ 1\)/, "tv-v1's address on the live shell");
  assert.match(fn(deck, "widgetsChartSrc"), /widgetsSrc\(index\) === "live" \? liveChartSrc\(t, index\) : tvChartSrc\(t, index\)/);
  assert.match(fn(deck, "paneChartSrc"), /if \(widgetsOn\(\) && index < WIDGETS_CHARTS && t\) return widgetsChartSrc\(t, index\);/);
  /* commitTicker → retargetSlot → paneChartSrc: the typed symbol lands on whichever shell the slot carries (W1's door, untouched) */
  assert.match(fn(deck, "retargetSlot"), /o\.def\.src = paneChartSrc\(ticker, index\)/);
  assert.match(fn(deck, "commitTicker"), /if \(widgetsOn\(\) && index < WIDGETS_CHARTS\) remember\(WIDGETS_CHART_KEY \+ \(index \+ 1\), ticker\);/);
});

test("W3 · the switch: a shell asks (SCINTILLA_CHART_SRC), the deck remembers the source and the interval and re-points the slot with its symbol; the live shell's interval is remembered like TV's", () => {
  assert.match(deck, /if \(event\.data\?\.type === "SCINTILLA_CHART_SRC"\) \{[\s\S]{0,900}?remember\(WIDGETS_SRC_KEY \+ n, src\);\n\s+if \(CHARTS\[n - 1\]\) retargetSlot\(n - 1, CHARTS\[n - 1\]\);/, "the choice remembered, the slot re-pointed with the symbol it shows");
  assert.match(deck, /if \(event\.data\?\.type === "SCINTILLA_CHART_SRC"\) \{[\s\S]{0,600}?if \(WIDGETS_TFS\.includes\(tf\)\) remember\(WIDGETS_TF_KEY \+ n, tf\);/, "the interval carried across the switch");
  assert.match(deck, /o\.frame\.contentWindow === event\.source && widgetsOn\(\)\) \{\n\s+if \(WIDGETS_TFS/, "only the slot's own frame, only in WIDGETS");
  assert.match(deck, /if \(event\.data\?\.type === "SCINTILLA_TV_STATE" \|\| event\.data\?\.type === "SCINTILLA_LIVE_STATE"\) \{/, "live-v1's say joins tv-v1's");
  assert.match(deck, /const live = event\.data\.type === "SCINTILLA_LIVE_STATE";/);
  assert.match(deck, /heard !== CHARTS\[n - 1\] && own && widgetsOn\(\) && !live\) \{/, "the widget's own symbol search is TV's only");
  assert.match(deck, /o\.def\.src = live \? liveChartSrc\(CHARTS\[n - 1\], n - 1\) : tvChartSrc\(CHARTS\[n - 1\], n - 1\);/, "the slot's address kept in step on either shell");
  /* the strips */
  assert.match(tv, /<span class="src" id="src" role="group" aria-label="Chart source"><button type="button" id="srcLive"[^>]*>LIVE<\/button><button type="button" id="srcTv" class="on" aria-pressed="true"[^>]*>TV<\/button><\/span>/, "tv-v1: LIVE · TV, TV marked");
  assert.match(tv, /getElementById\("srcLive"\)\.addEventListener\("click", \(\) => \{ try \{ parent\.postMessage\(\{ type: "SCINTILLA_CHART_SRC", n: N, src: "live", ticker: SYMBOL, interval: INTERVAL \}, location\.origin\);/);
  assert.match(live, /<span class="src" id="src" role="group" aria-label="Chart source"><button type="button" id="srcLive" class="on" aria-pressed="true"[^>]*>LIVE<\/button><button type="button" id="srcTv"[^>]*>TV<\/button><\/span>/, "live-v1: LIVE · TV, LIVE marked");
  assert.match(live, /el\("srcTv"\)\.addEventListener\("click", \(\) => \{ if \(window\.parent === window\) return; try \{ parent\.postMessage\(\{ type:"SCINTILLA_CHART_SRC", n:N, src:"tv", ticker:SYMBOL, interval:TF\.tv \}, location\.origin\);/, "the interval in tv-v1's codes, so one memory serves both");
  assert.match(tv, /#strip \.src button\.on\{ color:var\(--bull\); border-color:var\(--bull\); cursor:default; \}/, "the live one marked green");
  assert.match(live, /#strip \.src button\.on\{ color:var\(--bull\); border-color:var\(--bull\); cursor:default; \}/);
  /* W2's shell otherwise as W2 left it: its own say, its address, its clouds */
  assert.match(live, /parent\.postMessage\(\{ type:"SCINTILLA_LIVE_STATE", n:N, ticker:SYMBOL, interval:TF\.tv, tf:TF\.key \}, location\.origin\)/);
  assert.match(live, /let SYMBOL = CLEAN\(QS\.get\("symbol"\) \|\| QS\.get\("t"\)\) \|\| "SPY";/);
});
