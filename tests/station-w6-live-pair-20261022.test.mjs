/* W6 (22 Oct 2026). Alan, ~19:10 ET: "maybe a two chart version like that I just track, and that's like even more live than TradingView
   and how what I use to like confirm kind of things … Maybe if you establish the rotation that I have on TradingView."
   1. station-shells/pair-v1: two live-v1 charts rotating his TradingView FLASH WATCH lanes (claude_rotation.js): A = lane 0, SPY / QQQ
      as ESUSD / NQUSD outside 09:30-18:00 New York on weekdays (his resolve()); B = lane 1 = station_lists · radar; 20 s a name; names
      the chart API does not draw at 5 minutes skipped and listed; the pointer holds a chart; PAUSE / PLAY, NEXT, a symbol box.
   2. live-v1's Day Levels in his indicator's default look, style E (pine/SCINTILLA_Day_Levels.pine). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const pair = read("../station-shells/pair-v1/index.html");
const live = read("../station-shells/live-v1/index.html");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fnOf = (src, name) => grab(src, new RegExp("\\n(?:async )?function " + name + "\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}\\n|\\nfunction " + name + "\\([^)]*\\) \\{[^\\n]*\\}\\n"), name);
const plain = (v) => JSON.parse(JSON.stringify(v));
/* W8 restated (Alan 22 Oct ~20:10 ET): the pair follows only his top two charts - the gauges left with the futures always beside SPY and
   QQQ (no swap at any hour), the list he picks right (TARGETS = his top-right by default). The four W6 tests below keep their intent -
   his lanes, his session rule, the names the API cannot draw, two live-v1 frames rotated by message - on the new truth. */
function pairApi() {
  const src = [grab(pair, /const LEFT = Object\.freeze\(\[[^\]]*\]\);/, "the left lane"), grab(pair, /const LEFT_NOT_SERVED = Object\.freeze\(\[[^\]]*\]\);/, "not served"),
    grab(pair, /const NAMES = Object\.freeze\(\{[^}]*\}\);/, "names"), grab(pair, /const TARGETS = Object\.freeze\(\[[^\]]*\]\);/, "targets"),
    grab(pair, /const MACRO = Object\.freeze\(\[[^\]]*\]\);/, "macro"), grab(pair, /const LISTS = Object\.freeze\(\[[^\]]*\]\);/, "lists"),
    grab(pair, /const DWELL = Object\.freeze\(\{[^}]*\}\);/, "dwells"), fnOf(pair, "tracked"), fnOf(pair, "laneOf"), fnOf(pair, "label"),
    "globalThis.out = { LEFT, LEFT_NOT_SERVED, NAMES, TARGETS, MACRO, LISTS, DWELL, tracked, laneOf, label };"].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); return ctx.out;
}
const OWNED = Object.fromEntries("SPY QQQ NVDA MU SMH NBIS CRWV BE GOOGL AMZN".split(" ").map((s) => [s, 1]));
const MACRO_SET = new Set(["VIX", "DXY", "US10Y", "DXUSD", "CLUSD", "GCUSD", "SIUSD", "BTCUSD", "ESUSD", "NQUSD"]);
const isMacro = (s) => MACRO_SET.has(s), isPutCall = (s) => ["PCC", "PCCE", "PCCI", "PCSPX"].includes(s);

test("W6 · his lanes, copied exactly: FLASH WATCH lane 0 and lane 1, 20 s a name", () => {
  /* W8 restated: his top two charts (claude_focus_rotation.js panes 0 and 1), 25 s and 20 s */
  const A = pairApi();
  assert.deepEqual(plain(A.LEFT), ["SPY", "QQQ", "ESUSD", "NQUSD", "VIX", "PCC"], "his gauges with both futures");
  assert.deepEqual(plain(A.TARGETS), ["MU", "NBIS", "CRWV", "BE"], "his top-right, the right chart's default");
  assert.deepEqual(plain(A.DWELL), { A:25000, B:20000 });
  assert.match(pair, /station_lists\?select=list,position,ticker&list=in\.\(mine,radar\)&order=position\.asc/, "MINE and RADAR in one read");
});

test("W6 · his session rule: SPY / QQQ on weekdays 09:30-18:00 New York, ESUSD / NQUSD otherwise; ?session= pins it", () => {
  /* W8 restated: "I don't want to do that anymore. Both things, to watch them both" - no swap at any hour, nothing pins a session */
  const code = pair.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(code, /cashSession|session=|\bresolve\(/, "no session rule left");
  const A = pairApi();
  const left = A.laneOf(A.LEFT, OWNED, isMacro, isPutCall, true);
  assert.deepEqual(plain(left.show.map((x) => x.sym)), ["SPY", "QQQ", "ESUSD", "NQUSD", "VIX", "PCC"], "SPY, QQQ and both futures, always");
});

test("W6 · a name the chart API does not draw at 5 minutes is skipped and named, never shown as an error", () => {
  /* W8 restated: ADD is named as not served; the put/call is drawn on daily bars and labelled when the API answers it */
  const A = pairApi();
  assert.deepEqual(plain(A.LEFT_NOT_SERVED), ["USI:ADD"]);
  assert.deepEqual(plain(A.tracked("PCC", OWNED, isMacro, isPutCall, true)), { ok:true, daily:true, why:"daily only" });
  assert.deepEqual(plain(A.tracked("PCC", OWNED, isMacro, isPutCall, false)), { ok:false, daily:true, why:"not answered" });
  assert.deepEqual(plain(A.tracked("ZZZZ", OWNED, isMacro, isPutCall, true)), { ok:false, daily:false, why:"not tracked" });
  assert.equal(A.label({ sym:"PCC", daily:true }), "PCC · PUT/CALL · daily bars");
  assert.equal(A.label({ sym:"ESUSD", daily:false }), "ESUSD · S&P FUT");
  assert.match(pair, /<b>not served<\/b>: " \+ LEFT_NOT_SERVED\.join\(", "\)/, "named in the small print");
});

test("W6 · the pair: two live-v1 frames, rotated by message; the pointer holds a chart; PAUSE / PLAY, NEXT and a symbol box", () => {
  /* W8 restated: the frames are live-v1 in synced mode; the symbol box is each chart's own (live-v1's), whose word pauses the lane */
  assert.equal((pair.match(/<iframe class="chart"/g) || []).length, 2);
  assert.match(fnOf(pair, "frameSrc"), /&n=" \+ s\.n \+ "&bare=1&sync=1&clouds=" \+ \(PAIR\.clouds \? "1" : "0"\)/);
  assert.match(fnOf(pair, "show"), /post\(s, \{ sc:"chart", ticker:item\.sym, tf:item\.daily \? "1D" : PAIR\.tf \}\)/, "the name and its timeframe in one message");
  assert.match(pair, /const held = \(s\) => s\.hover \|\| Date\.now\(\) - s\.activityAt < 4000;/);
  assert.match(pair, /s\.frame\.addEventListener\("mouseenter", \(\) => \{ s\.hover = true; \}\);/);
  assert.match(fnOf(pair, "tick"), /if \(held\(s\)\) \{ s\.next \+= 500; paintBar\(s\); continue; \}/);
  assert.match(pair, /if \(e\.data\.type === "SCINTILLA_CHART_TICKER" && e\.data\.ticker\) \{ s\.manual = CLEAN\(e\.data\.ticker\);/, "a typed ticker pauses that chart until PLAY");
  assert.doesNotMatch(pair.replace(/<!--[\s\S]*?-->/g, ""), /method:\s*"(POST|PATCH|PUT|DELETE)"/, "it writes nothing to the database");
});

test("W6 · style E: short lines just right of the newest bar, the names at bar + 7, his amber family, his grouping, nothing on the axis", () => {
  const draw = fnOf(live, "drawLevelsE");
  assert.match(draw, /const x0 = X\(base \+ 1\), x1 = X\(base \+ 6\), xl = X\(base \+ 7\);/, "line.new(bar_index + 1 .. + 6), the label at + 7");
  assert.match(draw, /ctx\.textAlign = "left";/, "label.style_label_left: the name to the right of the line");
  assert.match(live, /const LEVEL_E = Object\.freeze\(\{ PDH:\["rgba\(245,185,66,1\)", 2\], PDL:\["rgba\(245,185,66,1\)", 2\], PDO:\["rgba\(201,154,58,\.75\)", 1\], PDC:\["rgba\(201,154,58,\.75\)", 1\],\n  PMH:\["rgba\(232,163,74,\.85\)", 1\], PML:\["rgba\(232,163,74,\.85\)", 1\], OPEN:\["rgba\(184,134,46,\.65\)", 1\] \}\);/,
    "#F5B942 · #C99A3A at 25 % · #E8A34A at 15 % · #B8862E at 35 %, his transparencies");
  const src = fnOf(live, "levelGroups");
  const ctx = {}; vm.runInNewContext(src + "\nglobalThis.levelGroups = levelGroups;", ctx);
  /* IWM, 22 Oct: PDL 275.30 and PMH 275.20 are 0.036 % apart - one label; PDC 276.45 and PDO 276.86 are 0.15 % apart - two */
  const g = ctx.levelGroups([{ key:"PDH", value:277.7 }, { key:"PDL", value:275.3 }, { key:"PDO", value:276.86 }, { key:"PDC", value:276.45 },
    { key:"PMH", value:275.2 }, { key:"PML", value:273.72 }, { key:"OPEN", value:274.81 }]);
  assert.deepEqual(plain(g.map((x) => x.text)), ["PDH", "PDO", "PDC", "PDL · PMH", "OPEN", "PML"]);
  assert.equal(g[3].key, "PDL", "the label takes its highest level's colour");
  assert.doesNotMatch(fnOf(live, "wantedTags"), /level/i, "no price tags on the axis for the levels");
  assert.match(fnOf(live, "draw"), /drawLevelsE\(ctx, groupsE, S\.levels, right >= n - 1 \? \(forming \? n : n - 1\) : null,/, "drawn only while the newest bar is on screen");
});
