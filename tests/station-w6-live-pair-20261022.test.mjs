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
function pairApi() {
  const src = [grab(pair, /const LANE_A = Object\.freeze\(\{[\s\S]*?\]\) \}\);/, "lane 0"), grab(pair, /const LANE_B_TV = Object\.freeze\(\[[\s\S]*?\]\);/, "lane 1"),
    grab(pair, /const DWELL_MS = \d+;/, "the dwell"), grab(pair, /const ET_FMT = [^\n]*/, "the clock"), fnOf(pair, "etNow"), fnOf(pair, "cashSession"),
    grab(pair, /const OURS = Object\.freeze\(\{[^}]*\}\);/, "the name map"), fnOf(pair, "ourSymbol"), fnOf(pair, "tracked"), fnOf(pair, "laneFor"),
    "globalThis.out = { LANE_A, LANE_B_TV, DWELL_MS, cashSession, ourSymbol, tracked, laneFor };"].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); return ctx.out;
}
const at = (iso) => Date.parse(iso);
const OWNED = Object.fromEntries("SPY QQQ NVDA MU SMH NBIS GOOGL AMZN".split(" ").map((s) => [s, 1]));
const MACRO = new Set(["VIX", "DXY", "US10Y", "DXUSD", "CLUSD", "GCUSD", "SIUSD", "BTCUSD", "ESUSD", "NQUSD"]);
const isMacro = (s) => MACRO.has(s), isPutCall = (s) => ["PCC", "PCCE", "PCCI", "PCSPX"].includes(s);

test("W6 · his lanes, copied exactly: FLASH WATCH lane 0 and lane 1, 20 s a name", () => {
  const A = pairApi();
  assert.deepEqual(plain(A.LANE_A.list), ["SPY*", "QQQ*", "TVC:USOIL", "TVC:US10Y", "BATS:NVDA", "TVC:VIX", "BATS:MU", "SPY*", "QQQ*", "USI:PCC", "USI:ADD", "BATS:SMH", "BATS:NBIS", "TVC:US03MY"]);
  assert.equal(A.LANE_B_TV.length, 23); assert.equal(A.LANE_B_TV[0], "BATS:MU"); assert.equal(A.LANE_B_TV[22], "NASDAQ:QCOM");
  assert.equal(A.DWELL_MS, 20000);
  assert.match(pair, /station_lists\?select=position,ticker&list=eq\.radar&order=position\.asc/, "lane 1 is the Hub's radar list, read once");
});

test("W6 · his session rule: SPY / QQQ on weekdays 09:30-18:00 New York, ESUSD / NQUSD otherwise; ?session= pins it", () => {
  const A = pairApi();
  assert.equal(A.cashSession(at("2026-10-22T10:00:00-04:00")), true);
  assert.equal(A.cashSession(at("2026-10-22T17:59:00-04:00")), true, "his rule runs to 18:00, not 16:00");
  assert.equal(A.cashSession(at("2026-10-22T18:00:00-04:00")), false);
  assert.equal(A.cashSession(at("2026-10-22T09:29:00-04:00")), false);
  assert.equal(A.cashSession(at("2026-10-24T12:00:00-04:00")), false, "Saturday");
  assert.equal(A.cashSession(at("2026-10-22T20:00:00-04:00"), "day"), true); assert.equal(A.cashSession(at("2026-10-22T11:00:00-04:00"), "night"), false);
  for (const [tv, day, night] of [["SPY*", "SPY", "ESUSD"], ["QQQ*", "QQQ", "NQUSD"], ["TVC:USOIL", "CLUSD", "CLUSD"], ["BATS:NVDA", "NVDA", "NVDA"],
    ["CME_MINI:ES1!", "ESUSD", "ESUSD"], ["CRYPTO:BTCUSD", "BTCUSD", "BTCUSD"], ["TVC:VIX", "VIX", "VIX"]]) {
    assert.equal(A.ourSymbol(tv, true), day, tv + " by day"); assert.equal(A.ourSymbol(tv, false), night, tv + " by night");
  }
});

test("W6 · a name the chart API does not draw at 5 minutes is skipped and named, never shown as an error", () => {
  const A = pairApi();
  assert.deepEqual(plain(A.tracked("PCC", OWNED, isMacro, isPutCall)), { ok:false, why:"daily only" });
  assert.deepEqual(plain(A.tracked("ADD", OWNED, isMacro, isPutCall)), { ok:false, why:"not tracked" });
  assert.equal(A.tracked("VIX", OWNED, isMacro, isPutCall).ok, true); assert.equal(A.tracked("NVDA", OWNED, isMacro, isPutCall).ok, true);
  const night = A.laneFor(A.LANE_A.list, false, OWNED, isMacro, isPutCall);
  assert.deepEqual(plain(night.show), ["ESUSD", "NQUSD", "CLUSD", "US10Y", "NVDA", "VIX", "MU", "ESUSD", "NQUSD", "SMH", "NBIS"]);
  assert.deepEqual(plain(night.skipped.map((k) => k.tv + " " + k.why)), ["USI:PCC daily only", "USI:ADD not tracked", "TVC:US03MY not tracked"]);
  assert.deepEqual(plain(night.mapped.map((m) => m.tv + ">" + m.sym)), ["SPY*>ESUSD", "QQQ*>NQUSD", "TVC:USOIL>CLUSD"]);
  const day = A.laneFor(A.LANE_A.list, true, OWNED, isMacro, isPutCall);
  assert.deepEqual(plain(day.show.slice(0, 2)), ["SPY", "QQQ"]);
  assert.match(pair, /<b>skipped<\/b> \(the chart API does not draw them at 5 minutes\): /, "named in the small print");
});

test("W6 · the pair: two live-v1 frames, rotated by message; the pointer holds a chart; PAUSE / PLAY, NEXT and a symbol box", () => {
  assert.equal((pair.match(/<iframe class="chart"/g) || []).length, 2);
  assert.match(fnOf(pair, "frameSrc"), /"\/station-shells\/live-v1\/\?t=" \+ encodeURIComponent\(sym\) \+ "&tf=5&n=" \+ s\.n \+ "&bare=1"/);
  assert.match(fnOf(pair, "show"), /s\.frame\.contentWindow\.postMessage\(\{ sc:"chart", ticker:sym \}, location\.origin\)/, "live-v1's own door (W2): no reload");
  assert.match(pair, /const held = \(s\) => s\.hover \|\| Date\.now\(\) - s\.activityAt < 4000;/);
  assert.match(pair, /s\.frame\.addEventListener\("mouseenter", \(\) => \{ s\.hover = true; \}\);/);
  assert.match(pair, /if \(e\.data\.sc === "station-activity"\) \{ s\.activityAt = Date\.now\(\); return; \}/, "the chart saying it is in use (live-v1's message)");
  assert.match(fnOf(pair, "tick"), /if \(held\(s\)\) \{ s\.next \+= 500; paintBar\(s\); continue; \}/, "held = the countdown waits");
  assert.match(pair, /s\.manual = sym; show\(s, sym\);/, "a typed symbol pauses that chart's lane until PLAY");
  assert.match(pair, /SIDES\.forEach\(\(s, i\) => \{ show\(s, s\.show\[0\]\); s\.next = Date\.now\(\) \+ DWELL_MS \+ i \* 10000; \}\);/, "B ten seconds after A");
  assert.doesNotMatch(pair.replace(/<!--[\s\S]*?-->/g, ""), /method:\s*"(POST|PATCH|PUT|DELETE)"|localStorage\.setItem/, "it writes nothing");
  for (const bad of [/#fff\b/i, /#ffffff/i, /\bwhite\b(?!-space)/i]) assert.doesNotMatch(pair.replace(/<!--[\s\S]*?-->/g, ""), bad);
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
