/* W13 (23 Oct 2026). Alan: "each ticker that I put on the actual charts should have a[n RVol] bar meter thermometer … at the bottom, you can put
   the Geiger bar for each company … the ticker and the percentage could be bigger … I don't like all of the data above. I'm more visual than
   numerical … we should flash things when they are high." And the hitch W10 measured: 130-213 ms long tasks in each live-v1 frame every ~6 s.
   Pinned here: the header (big ticker and day %, the price beside, the bar numbers only with the crosshair); the RVol tube (the lenses' tube,
   the Hub's board_volume.rvol_at_time); the Geiger bar at the foot (SC_GEIGER_BAR model + fillStyle; the deck's map, else equityGeigerOne);
   the flashes (2x the usual day, RVol 2x; a pulse, then a glow, in words); the hitch (the clouds kept per view, painted off the main thread,
   moved onto a new view exactly). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const live = read("../station-shells/live-v1/index.html");
const lens = read("../station-shells/lens-v1/index.html");
const pair = read("../station-shells/pair-v1/index.html");
const clouds = read("../_indicators/station-clouds.js");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fnOf = (src, name) => grab(src, new RegExp("\\n(?:async )?function " + name + "\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}\\n|\\nfunction " + name + "\\([^)]*\\) \\{[^\\n]*\\}\\n"), name);
const line = (src, re, what) => grab(src, re, what);
const plain = (v) => JSON.parse(JSON.stringify(v));
function api() {
  const ctx = {};
  vm.runInNewContext(clouds, ctx);
  vm.runInNewContext(["var window = globalThis;", "const CLOUD_EXTRAS = Object.freeze({ ema8:false, sma100:false });", "const cloudSpecOptions = () => CLOUD_EXTRAS;",
    line(live, /const FLASH_X = 2;/, "FLASH_X"), line(live, /const HUB_MS = Object\.freeze\(\{[^\n]*\}\);/, "HUB_MS"),
    fnOf(live, "cloudPercentText"), fnOf(live, "ribbonKey"), fnOf(live, "ribbonWarp"), fnOf(live, "cloudDrift"), fnOf(live, "unusualNow"),
    fnOf(live, "usualStale"), fnOf(live, "rvolFresh"),
    "globalThis.out = { ribbonKey, ribbonWarp, cloudDrift, unusualNow, usualStale, rvolFresh, FLASH_X, HUB_MS };"].join("\n"), ctx);
  return ctx.out;
}

test("W13 · the hitch: the clouds are kept per view, painted off the main thread from this page's own text, and moved exactly onto a new view", () => {
  const A = api();
  /* the key holds everything that shapes the ribbon's pixels */
  const g = { sym:"SPY", tf:"5m", bar0:1, mapId:3, start:444, end:599, right:612, spacing:7, plotW:1215, priceBottom:1170, padT:8, priceH:1162, yLo:755, yHi:765, smooth:true, scale:1, w:1277, h:1401, dpr:1 };
  const k = A.ribbonKey(g);
  for (const [field, v] of Object.entries({ mapId:4, start:445, end:600, right:613, spacing:8, plotW:1200, yLo:754, yHi:766, smooth:false, w:1000, dpr:2, sym:"QQQ", tf:"15m" }))
    assert.notEqual(A.ribbonKey(Object.assign({}, g, { [field]:v })), k, field + " is in the key");
  assert.equal(A.ribbonKey(Object.assign({}, g)), k, "the same view, the same key - the kept bitmap");
  /* an earlier ribbon onto a new view: X(i) and Y(v) are linear, so the move is exact (a new bar, a wider bar, a rescale) */
  const g1 = Object.assign({}, g, { right:613.5, spacing:9.25, plotW:1190, yLo:753.5, yHi:766.2, priceH:1140, padT:12 });
  const X = (G, i) => G.plotW - (G.right - i) * G.spacing - G.spacing / 2, Y = (G, v) => G.padT + (1 - (v - G.yLo) / (G.yHi - G.yLo)) * G.priceH;
  const w = A.ribbonWarp(g, g1);
  for (const i of [444, 500, 599, 612]) assert.ok(Math.abs(w.a * X(g, i) + w.b - X(g1, i)) < 1e-9, "bar " + i);
  for (const v of [753, 760.25, 766]) assert.ok(Math.abs(w.c * Y(g, v) + w.d - Y(g1, v)) < 1e-9, "price " + v);
  assert.equal(A.ribbonWarp(g, Object.assign({}, g1, { sym:"QQQ" })), null, "another symbol: nothing to move");
  assert.equal(A.ribbonWarp(g, Object.assign({}, g1, { bar0:2 })), null, "the series shifted: nothing to move");
  /* the code: the base lays the kept bitmap down; a new key goes to the worker (one at a time, the newest waiting); no worker - painted here */
  const pc = fnOf(live, "paintClouds");
  assert.match(pc, /if \(RIBBON\.bmp && RIBBON\.geo && RIBBON\.geo\.key === g\.key\) \{ blitRibbon\(ctx, RIBBON\.bmp, null, g\); S\.ribbonShown = "kept"; return; \}/);
  assert.match(pc, /if \(RIBBON\.inflight\) RIBBON\.want = job; else ribbonSend\(job\);/);
  assert.match(pc, /if \(!ribbonWorker\(\)\) \{\n    if \(RIBBON\.hereKey !== g\.key\) \{/, "no worker canvas: once per key, here");
  const wk = fnOf(live, "ribbonWorker");
  assert.match(wk, /importScripts\(" \+ JSON\.stringify\(new URL\("\/_indicators\/station-clouds\.js", location\.href\)\.href\) \+ "\);/, "station-clouds.js itself in the worker");
  assert.match(wk, /new OffscreenCanvas\(W, H\)/); assert.match(wk, /canvas\.transferToImageBitmap\(\)/);
  /* the quote no longer redraws the clouds: the row is re-taken only when the drawing would show it */
  assert.match(live, /applyQuoteToFormingDay\(\);\n      quoteMovesClouds\(\);\n      draw\(\);/);
  assert.doesNotMatch(fnOf(live, "readQuote"), /cloudToday\(\); S\.cloudMap = null;/);
});

test("W13 · the clouds' current-session row from a quote: re-taken at half a pixel, a colour change or a new percentage - else the drawn row stays", () => {
  const A = api();
  const P = { Y:(v) => 8 + (1 - (v - 700) / 100) * 1000 };           /* 10 px a dollar */
  const row = { e13:740, e21:735, s50:720, s200:690, f:true, m:true, o:true }, bar = { c:741.2 };
  assert.equal(A.cloudDrift(row, Object.assign({}, row, { e13:740.04 }), P, bar), false, "0.4 px: the same drawing");
  assert.equal(A.cloudDrift(row, Object.assign({}, row, { e13:740.06 }), P, bar), true, "0.6 px: redrawn");
  assert.equal(A.cloudDrift(row, Object.assign({}, row, { f:false }), P, bar), true, "a line changes colour");
  assert.equal(A.cloudDrift({ e13:741.2 * 0.9995, e21:735, s50:720, s200:690, f:true, m:true, o:true }, { e13:741.2 * 0.9994, e21:735, s50:720, s200:690, f:true, m:true, o:true }, { Y:() => 0 }, bar), true,
    "a name's percentage beside the newest bar changes (−0.0% -> −0.1%): redrawn even under half a pixel");
  assert.match(fnOf(live, "quoteMovesClouds"), /if \(before && S\.cloudToday && before !== S\.cloudToday && S\.plot && !cloudDrift\(before, S\.cloudToday, S\.plot, S\.bars\[S\.plot\.last\]\)\) S\.cloudToday = before;\n  else S\.cloudMap = null;/);
});

test("W13 · the header: the ticker and the day % big, the price beside them, the RVol tube by the ticker; the bar numbers only with the crosshair", () => {
  assert.match(live, /:root\{ --hd:clamp\(17px, 2\.5vw, 38px\); \}/, "big from the frame's own width");
  assert.match(live, /#strip \.sym, #strip input\.sym\{ font:700 var\(--hd\) var\(--mono\);/);
  assert.match(live, /#strip \.day\{ display:inline-block; font:700 var\(--hd\) var\(--mono\);/);
  assert.match(live, /#strip \.px\{ font-size:calc\(var\(--hd\) \* \.58\); color:var\(--ink2\); \}/);
  const strip = grab(live, /<div id="strip">[\s\S]*?<\/div>/, "the strip");
  assert.deepEqual([...strip.matchAll(/id="([a-z]+)"/g)].map((m) => m[1]).slice(1, 6), ["sym", "rv", "day", "px", "why"], "ticker, tube, day %, price, words");
  const ph = fnOf(live, "paintHeader");
  assert.match(ph, /dayText = pct == null \? "" : \(pct >= 0 \? "\+" : "−"\) \+ Math\.abs\(pct\)\.toFixed\(2\) \+ "%"/);
  assert.match(ph, /day\.dataset\.day = pct == null \? "" : pct >= 0 \? "up" : "down";/);
  assert.match(fnOf(live, "paintStrip"), /paintHeader\(\);/, "every second and after every quote");
  /* the numbers above the chart: only with the pointer on it */
  const ro = fnOf(live, "paintReadout");
  assert.match(ro, /const ix = hovering \? S\.crosshair\.ix : -1;\n  const b = hovering \? S\.bars\[ix\] : null;/);
  assert.match(ro, /const html = b \? readoutHtml\(b, ix, hovering\) : "";/);
  /* nothing else in his VWAP, band, levels or clouds changed: the painting functions keep their pins (W2, W5, W6) */
  assert.match(live, /drawLevelsE\(ctx, groupsE, S\.levels, right >= n - 1 \? \(forming \? n : n - 1\) : null, X, Y, plotW, padT, priceBottom\);/);
});

test("W13 · the RVol tube is the lenses' tube, the Hub's own number read the lenses' way - no price read", () => {
  /* the same tube: the dark tube, the 1x and 2x ticks (33 % / 66 % of 3x), the meter's gradient */
  for (const part of ["background:#1d1d1b;", "border:1px solid #33332f;", "linear-gradient(#8c8b83,#8c8b83) 33% 0 / 1px 100% no-repeat, linear-gradient(#8c8b83,#8c8b83) 66% 0 / 1px 100% no-repeat",
    "width:var(--rv, 0%); background:linear-gradient(90deg, #3987e5, #fab219 55%, #ec835a); transition:width .8s;"]) {
    assert.ok(lens.includes(part), "lens-v1's tube: " + part); assert.ok(live.includes(part), "the chart's tube: " + part);
  }
  const ph = fnOf(live, "paintHeader");
  assert.match(ph, /rv\.firstChild\.style\.setProperty\("--rv", Math\.round\(Math\.min\(1, \(r \|\| 0\) \/ 3\) \* 100\) \+ "%"\);/, "3x the end, as the lenses");
  assert.match(lens, /setProperty\("--rv", Math\.round\(Math\.min\(1, \(r \|\| 0\) \/ 3\) \* 100\) \+ "%"\)/);
  assert.match(fnOf(live, "readRvol"), /hubRead\("board_volume\?select=ticker,rvol_at_time,updated_ts&ticker=eq\." \+ encodeURIComponent\(sym\)\)/);
  assert.match(live, /setInterval\(\(\) => \{ if \(!document\.hidden\) readRvol\(\); \}, HUB_MS\.rvol\);/);
  const A = api();
  assert.equal(A.HUB_MS.rvol, 60000, "once a minute");
  const now = Date.parse("2026-10-23T21:40:00Z");
  assert.equal(A.rvolFresh("2026-10-23T21:38:05+00:00", now), true);
  assert.equal(A.rvolFresh("2026-10-21T00:00:06+00:00", now), false, "a row the store stopped rewriting (IYK's, 21 Oct) flashes nothing");
});

test("W13 · flashes, W12's rules: the day % 2x the name's usual day (the Hub's usual_day_60), RVol 2x - a pulse, a glow, the words", () => {
  const A = api();
  assert.equal(A.FLASH_X, 2, "the Hub's own bar (SC_HB_X_UNUSUAL)");
  /* 23 Oct, real: CCI +9.78 % on a ±2.576 % usual day with RVol 4.09; FIX −9.02 % on ±3.466 %; BE −11.41 % on ±6.111 % with RVol 2.65 */
  assert.deepEqual(plain(A.unusualNow(9.78, 2.576, false, 4.09).map((u) => u.words)), ["3.8× its usual day", "4.1× its usual volume"]);
  assert.deepEqual(plain(A.unusualNow(-9.02, 3.466, false, 3.72).map((u) => [u.key, u.side])), [["day", "down"], ["rvol", "vol"]]);
  assert.deepEqual(plain(A.unusualNow(-11.41, 6.111, false, 2.65).map((u) => u.key)), ["rvol"], "1.9x its usual day is not 2x");
  assert.deepEqual(plain(A.unusualNow(9.78, 2.576, true, 1.2)), [], "a usual day older than a week flashes nothing");
  assert.deepEqual(plain(A.unusualNow(null, 2.576, false, null)), [], "no price, no RVol: nothing");
  const now = Date.parse("2026-10-23T21:40:00Z");
  assert.equal(A.usualStale("2026-10-22", now), false); assert.equal(A.usualStale("2026-10-14", now), true); assert.equal(A.usualStale(null, now), true);
  assert.match(fnOf(live, "readUsual"), /hubRead\("ticker_heartbeat_daily\?select=ticker,date,usual_day_60&ticker=eq\." \+ encodeURIComponent\(sym\) \+ "&date=gte\." \+ since \+ "&order=date\.desc&limit=1"\)/);
  /* one bright pulse when it starts, a steady glow while it holds */
  const fl = fnOf(live, "flash");
  assert.match(fl, /node\.classList\.toggle\("glow", on\);/);
  assert.match(fl, /if \(on && !was\) \{ FLASHING\.since\[key\] = Date\.now\(\); FLASHING\.pulses\+\+; node\.classList\.remove\("pulse"\); void node\.offsetWidth; node\.classList\.add\("pulse"\); \}/);
  assert.match(live, /#strip \.day\.pulse, #rv\.pulse, #why\.pulse\{ animation:scFlash 1\.2s ease-out 1; \}/, "once");
  assert.match(live, /#strip \.day\.glow\{ text-shadow:0 0 \.3em currentColor, 0 0 \.8em currentColor; \}/, "in its own colour - no white");
  /* LOT SIZE / BLOCK: no per-name reading in the store - said in the code, not invented */
  assert.match(live, /LOT SIZE and BLOCK: the store keeps no per-name reading/);
});

test("W13 · the Geiger bar at the foot: the Station's own model and fill; the deck's map inside the deck, else the provider client's light read", () => {
  assert.match(live, /<div id="geiger" role="img"><span class="k">GEIGER<\/span><span class="gbar"><i><\/i><\/span><span class="gv">—<\/span><\/div>/);
  const pg = fnOf(live, "paintGeiger");
  assert.match(pg, /const m = B \? B\.model\(GEIGER\.readings\[SYMBOL\], Date\.now\(\)\) : null;/);
  assert.match(pg, /const fill = m \? B\.fillStyle\(m\) : ""/);
  assert.match(pg, /text = m \? m\.text : "—"/, "no reading: an empty track and a dash, never a zero");
  assert.match(live, /#geiger\[data-side="up"\] \.gbar, #geiger\[data-side="up"\] \.gv\{ color:var\(--bull\); \}/);
  assert.match(live, /#geiger\[data-side="down"\] \.gbar, #geiger\[data-side="down"\] \.gv\{ color:var\(--bear\); \}/);
  assert.match(live, /if \(d\.sc === "deck-geiger"\) \{ GEIGER\.fromDeck = true;/, "the deck's map, chart-v1's message");
  assert.match(fnOf(live, "pullGeiger"), /const rows = await P\.equityGeigerOne\(sym\); if \(!GEIGER\.fromDeck && sym === SYMBOL\) GEIGER\.readings = B\.readingsFrom\(rows, "PROVIDER_EQUALIZER"\);/);
  assert.match(live, /setInterval\(\(\) => \{ if \(!GEIGER\.fromDeck && !document\.hidden\) pullGeiger\(\); else paintGeiger\(\); \}, 60000\);/);
});

test("W13 · pair-v1 gets the same header: its two charts are live-v1 frames", () => {
  assert.match(pair, /return "\/station-shells\/live-v1\/\?t=" \+ encodeURIComponent\(item\.sym\) \+ "&tf=" \+ \(item\.daily \? "1D" : PAIR\.tf\) \+ "&n=" \+ s\.n \+ "&bare=1&sync=1&clouds=" \+ \(PAIR\.clouds \? "1" : "0"\);/);
  /* bare frames show the ticker too now (W13): the header is the ticker's */
  assert.doesNotMatch(live, /body\.bare #strip \.sym\{ display:none; \}/);
});
