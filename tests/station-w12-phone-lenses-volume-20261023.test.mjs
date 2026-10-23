/* W12 (23 Oct 2026). Alan, Friday afternoon: "I need another one for the phone … the context lenses only … That I can change the time frame of the
   bars on … radar and macro are non-negotiable … the volume thing applies in all of them. And the YouTube in all of them … we should flash things
   when they are high … The graph is so small … everything else is icons, buttons … I want the timer to do a countdown flashing within a minute of
   the 5 minutes … be careful with all of the shit that's in the header thing." */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html"), lens = read("../station-shells/lens-v1/index.html"), vol = read("../station-shells/volume-v1/index.html"), phone = read("../phone/index.html");
const shells = Object.fromEntries(["personal-video-v1", "scintilla-video-v1"].map((n) => [n, read(`../station-shells/${n}/index.html`)]));
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fn = (src, name) => grab(src, new RegExp("\\n(?:export )?(?:async )?function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"), name);
/* the pure rules, run as written */
const pure = (src, name) => { const body = grab(src, new RegExp("export function " + name + "\\([\\s\\S]*?\\n(?=export |const |let |/\\*|function )"), name).replace(/^export /, ""); return new Function("TFS", "LISTS", body + "\nreturn " + name + ";")(["1m", "5m", "15m", "30m", "1h", "1D"], ["radar", "macro", "mine"]); };

test("W12 · the lenses: a timeframe switch for the bars (1m 5m 15m 30m 1h 1D, remembered, 5m the default); RADAR and MACRO always, MINE a chip he opens and never the default", () => {
  assert.match(lens, /const MINE_ON_KEY = "station\.lenses\.mineOn", TF_KEY = "station\.lenses\.tf";/);
  assert.match(lens, /const TFS = Object\.freeze\(\["1m", "5m", "15m", "30m", "1h", "1D"\]\);/);
  const tfOf = pure(lens, "tfOf"), mineOnOf = pure(lens, "mineOnOf");
  assert.equal(tfOf("", ""), "5m", "5m by default"); assert.equal(tfOf("15m", ""), "15m", "remembered"); assert.equal(tfOf("15m", "1h"), "1h", "the address wins"); assert.equal(tfOf("1d", ""), "1D"); assert.equal(tfOf("7m", ""), "5m", "nonsense is 5m");
  assert.equal(mineOnOf("", ""), false, "MINE is never the default"); assert.equal(mineOnOf("1", ""), true, "remembered open"); assert.equal(mineOnOf("", "mine"), true, "?list=mine opens it");
  assert.match(lens, /function sets\(\) \{ return MINE_ON \? \["radar", "macro", "mine"\] : \["radar", "macro"\]; \}/, "both sets always; MINE a third");
  assert.match(lens, /const lensTf = \(t\) => DAILY_ONLY\[t\] \? "1d" : TF_API\[TF\];/, "the put/call ratio stays daily");
  assert.match(fn(lens, "setTf"), /remember\(TF_KEY, TF\); S\.bars\.clear\(\); paintTf\(\); drawAll\(\); readBars\(true\);/, "a new timeframe re-reads the bars at once");
  assert.match(fn(lens, "paintChips"), /const on = l !== "mine" \|\| MINE_ON;/); assert.match(fn(lens, "paintChips"), /if \(l === "mine"\) b\.addEventListener\("click", \(\) => setMineOn\(!MINE_ON\)\);/, "only MINE toggles");
  assert.match(lens, /if \(e\.data\.type === "SCINTILLA_LENS_TF" && TFS\.includes\(e\.data\.tf\)\) setTf\(e\.data\.tf\);/, "a parent can set it too");
  /* the tape's rows dealt to the sets */
  const rowsForSets = pure(lens, "rowsForSets");
  assert.deepEqual(rowsForSets(3, [24, 12]), [2, 1]); assert.deepEqual(rowsForSets(2, [24, 12]), [1, 1]); assert.equal(rowsForSets(1, [24, 12]), null, "one row holds both in sequence"); assert.deepEqual(rowsForSets(4, [24, 12, 7]), [2, 1, 1]);
  assert.match(fn(lens, "paintSet"), /const key = sets\(\)\.join\("\+"\) \+ "\|" \+ ROWS \+ "\|" \+ list\.join\(","\);/, "the W10 no-rebuild key covers the sets");
  assert.match(lens, /body\.tape \.trackwin::before\{ content:attr\(data-set\);/, "each row says its set");
  assert.match(lens, /\.sethead\{ grid-column:1 \/ -1;/); assert.match(lens, /\.setgrp\{ display:contents; \}/, "the grid: a head per set, its lenses under it");
});

test("W12 · the unusual flashes, the same rule everywhere: a day move at 2× the name's usual day and over, RVol at 2× and over; one bright pulse, a steady glow, in words", () => {
  const unusualOf = pure(lens, "unusualOf"), usualOf = pure(lens, "usualOf");
  assert.deepEqual(unusualOf(4.6, 2.0, 1.1), ["2.3× its usual day"]); assert.deepEqual(unusualOf(-4.6, 2.0, 2.7), ["2.3× its usual day", "rvol 2.7×"]); assert.deepEqual(unusualOf(3.9, 2.0, 1.9), [], "under twice: nothing"); assert.deepEqual(unusualOf(null, null, 2.0), ["rvol 2.0×"]);
  assert.equal(usualOf([100, 101, 100, 102, 101, 103, 102, 104, 103, 105, 104]).toFixed(2), "1.00", "the median absolute day change"); assert.equal(usualOf([100, 101, 102]), null, "too few closes: no usual");
  assert.match(lens, /the median absolute day change of its last 20 daily closes, read from the chart\n\s+API - the Hub's board_volume carries RVol only, no usual move/, "where the usual comes from, said");
  assert.match(fn(lens, "readUsual"), /P\.marketCandles\(t, "1d", \{ limit: 22 \}\)/);
  assert.match(fn(lens, "paintCells"), /if \(now && !was\) \{ d\.classList\.add\("glow"\); d\.classList\.remove\("pulse"\); void d\.offsetWidth; d\.classList\.add\("pulse"\);/, "the pulse once, the glow while it holds");
  assert.match(lens, /\.lens\.pulse\{ animation:scint 1\.1s ease-out 1; \}/); assert.match(lens, /\.lens\.glow\{ box-shadow:inset 0 0 0 1px var\(--crk\), 0 0 12px rgba\(0,212,255,\.45\); z-index:1; \}/);
  /* the deck's FAVORITES tape: the same rule, the usual by message from the lens frame */
  assert.match(fn(deck, "tapeUnusual"), /Math\.abs\(pct\) >= 2 \* usual/); assert.match(fn(deck, "tapeUnusual"), /rvol >= 2/);
  assert.match(deck, /for \(const \[t, v\] of Object\.entries\(event\.data\.usual \|\| \{\}\)\) \{ const c = CLEAN\(t\); if \(c && Number\.isFinite\(\+v\)\) TAPES\.usual\.set\(c, \+v\); \}/);
  assert.match(fn(lens, "postRvol"), /usual:Object\.fromEntries\(WANTED\.filter\(\(t\) => S\.usual\.has\(t\)\)/, "the lens frame hands the usual back with the RVol");
  assert.match(fn(deck, "paintTapeCells"), /const words = tapeUnusual\(q \? q\.pct : null, TAPES\.usual\.get\(t\), r\), on = words\.length > 0, was = cell\.classList\.contains\("glow"\);/);
  assert.match(deck, /body\.widgets #tapes \.tape\.tall \.cell\.pulse\{ animation:tape-unusual 1\.1s ease-out 1; \}/);
  /* the volume panel: the multiple at 2×, a lot size at 2× its usual, a block in the last ten minutes */
  assert.match(vol, /flash\(\$\("now"\), r != null && r >= 2,/); assert.match(vol, /flash\(\$\("iSize"\), !!\(S && S\.x >= 2/); assert.match(vol, /flash\(\$\("iBlock"\), !!\(blk && nowM != null && mins\(blk\.t\) != null && nowM - mins\(blk\.t\) >= 0 && nowM - mins\(blk\.t\) <= 10\)/);
  assert.match(grab(vol, /function flash\(e, on, words\) \{[^\n]*/, "flash"), /if \(on && !was\) \{ e\.classList\.add\("glow"\); e\.classList\.remove\("pulse"\); void e\.offsetWidth; e\.classList\.add\("pulse"\);/);
});

test("W12 · the volume panel is its graph; everything else small icon badges; no descriptions; the countdown flashes through the last 60 s", () => {
  assert.match(vol, /#chart\{ position:relative; flex:1 1 0; min-height:0;/, "the graph takes what is left - most of the panel (W12B: 70 % and over, measured)");
  assert.match(vol, /#num\{ font-size:22px; font-weight:800;/); assert.match(vol, /#tube\{ position:relative; width:8px; height:22px;/); assert.match(vol, /#count \.mmss\{ font-size:18px;/, "the top line compact");
  assert.doesNotMatch(vol, /id="nums"|class="cell"|id="badges"|class="badge"/, "the big cells and the big badges are gone");
  for (const id of ["iFlow", "iSize", "iBlock", "iDay", "bVol", "bDir", "bVwap", "bHour"]) assert.match(vol, new RegExp('<span class="ib" id="' + id + '"'), id + " is an icon badge");
  assert.match(vol, /\.ib\{ display:inline-flex; align-items:center; gap:4px; padding:3px 6px;[^}]*font-size:10\.5px;/);
  assert.doesNotMatch(vol, /who is in control|does it sustain|of a usual 5 minutes|needs 3 finished 5-minute bars<\/em>/, "no descriptions on the panel (the whys live in titles)");
  assert.match(vol, /\$\("count"\)\.classList\.toggle\("last", left <= 60\);/); assert.match(vol, /#count\.last \.mmss\{ animation:lastmin 1s steps\(2, end\) infinite; \}/, "the last minute flashes every second");
  assert.match(vol, /#count\.flash \.mmss\{ animation:closeflash 1\.2s ease-out 1; \}/, "W4's flash at the close stays");
  assert.match(vol, /let LAST_SIZE = null;/); assert.match(vol, /\$\("tsize"\)\.innerHTML = S \? S\.x\.toFixed\(2\) \+ "×" \+ side\(S\.dir\) : "—";/, "W10's lot size kept");
  assert.match(vol, /@media \(prefers-reduced-motion: reduce\)\{ #dot, \.beat-ring, \.beat-core\{ animation:none; \} #count\.flash \.mmss, #count\.last \.mmss, \.ib\.pulse, #now\.pulse #num\{ animation:none; \} \}/);
});

test("W12 · the phone Station: one column, no X - the lenses, the volume panel, YouTube stacked; fixed shares; Add to Home Screen ready", () => {
  assert.match(phone, /<meta name="apple-mobile-web-app-capable" content="yes">/); assert.match(phone, /<link rel="apple-touch-icon" href="\/phone\/icon\.png">/); assert.match(phone, /<link rel="manifest" href="\/phone\/manifest\.webmanifest">/); assert.match(phone, /viewport-fit=cover/);
  assert.match(phone, /<title>Station · phone<\/title>/);
  assert.match(phone, /<section id="lenses"[^>]*><iframe src="\/station-shells\/lens-v1\/\?shell=v1&mode=tape&rows=2&touch=1&view=phone"/, "W12B: the wall's tape - RADAR a row, MACRO a row");
  assert.match(phone, /<section id="volume"[^>]*><iframe src="\/station-shells\/volume-v1\/\?shell=v1&touch=1&view=phone"/);
  assert.match(phone, /<section id="video"[^>]*><iframe src="\/station-shells\/scintilla-video-v1\/\?shell=v1&feed=scintilla&cols=2&stack=1&view=phone"/);
  assert.doesNotMatch(phone, /pane-x|x-bridge|\/x\//, "no X on the phone");
  /* W12B: the first screen is the head, the lens tape and the volume panel; YouTube under it, the page scrolls */
  assert.match(phone, /#first\{ height:var\(--screen-h, 100vh\); display:grid; grid-template-rows:auto minmax\(0,1fr\) var\(--vol-h, 36vh\); \}/, "the first screen's three fixed rows");
  assert.match(phone, /#video\{ height:calc\(32px \+ 56\.25vw \+ 260px\);/, "the YouTube block's height is the bar, the 16:9 player and the feed - whatever plays");
  assert.match(phone, /document\.documentElement\.style\.setProperty\("--vol-h", Math\.max\(220, Math\.round\(h \* 0\.36\)\) \+ "px"\)/, "the volume block 36 % of the screen, at least 220 px");
  assert.ok(fs.existsSync(new URL("../phone/icon.png", import.meta.url)), "the icon"); assert.match(read("../phone/manifest.webmanifest"), /"display": "standalone"/);
  /* the video shells' one column */
  assert.equal(shells["personal-video-v1"], shells["scintilla-video-v1"], "byte-identical twins");
  const s = shells["scintilla-video-v1"];
  assert.match(s, /const STACK = QS\.get\("stack"\) === "1";/);
  assert.match(s, /body\.stack\{ display:grid; grid-template-columns:minmax\(0,1fr\); grid-template-rows:auto auto minmax\(0,1fr\); \}/);
  assert.match(s, /body\.stack > #stage\{ grid-row:2; display:flex; min-width:0; aspect-ratio:16 \/ 9; \}/, "the player's place is fixed, playing or not");
  assert.match(s, /body\.stack > #grid\{ grid-row:3; display:grid; overflow-y:auto;/, "the feed under it, scrolling");
  assert.match(fn(s, "paintBeside"), /classList\.toggle\("stack", STACK\)/);
  assert.match(s, /if \(STACK\) \{ const n = document\.getElementById\("idleNote"\); if \(n\) n\.textContent = "tap a title below to play it here"; \}/, "W12B: the feed is under the player there");
  /* W12B: the volume badges one row everywhere, the least important dropping on a narrow panel; the lens tape's chips on top for touch */
  assert.match(vol, /#icons\{ display:flex; flex-wrap:nowrap; gap:4px; flex:none; overflow-x:auto; overflow-y:hidden; scrollbar-width:none;/); assert.match(vol, /body\.narrow #iDay, body\.narrow #bHour\{ display:none; \}/);
  assert.match(vol, /document\.body\.classList\.toggle\("short", document\.documentElement\.clientHeight < 260\)/);
  assert.match(lens, /body\.tape\.touch\{ flex-direction:column; \}/); assert.match(lens, /body\.tape\.touch \.lens\{ width:var\(--lens-w, 200px\); \}/);
});

test("W12 · the dock on the WIDGETS wall: what does nothing there is hidden, not deleted; WALL · SIMPLE · WIDGETS, the feed choice and the scene stay", () => {
  assert.match(deck, /body\.widgets #dock #screenControls, body\.widgets #dock #pageRail, body\.widgets #dock \.rotate-controls, body\.widgets #dock #resetScene,\nbody\.widgets #dock \.lens-controls, body\.widgets #dock #screenIndicator\{ display:none !important; \}/);
  for (const id of ["screenPrev", "screenNext", "pageJumpBtn", "rotateToggle", "resetScene", "lensShape", "wallBtn", "simpleBtn", "widgetsBtn", "sceneMode", "chartsOnlyBtn", "tapesToggle", "stationFullBtn", "dockHideToggle"]) assert.match(deck, new RegExp('id="' + id + '"'), id + " is still in the dock's markup");
});
