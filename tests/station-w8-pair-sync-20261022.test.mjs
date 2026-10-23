/* W8 (22 Oct 2026). Alan, ~20:10 ET: "It's just what's on the top two charts … indexes, macro on the left, and then companies on the right …
   whatever I select on the lens … I don't want on the right chart the full radar names … I don't want [the futures swap] anymore. Both things,
   to watch them both … at the top I can change time frames … Charts synced in every way except ticker, and I don't see where I change the ticker."
   1. pair-v1: the gauges left (no swap), the list he picks right (TARGETS · MINE · RADAR · MACRO, remembered), one timeframe row and CLOUDS for
      both, each chart its own ticker box.
   2. live-v1 &sync=1: the contract a parent drives - intervals and CLOUDS step aside, a ticker box shows; { sc:"chart", tf, clouds } obeyed;
      Enter posts { type:"SCINTILLA_CHART_TICKER", n, ticker }. Without sync=1 nothing changes. */
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
  const src = [grab(pair, /const LISTS = Object\.freeze\(\[[^\]]*\]\);/, "lists"), grab(pair, /const TFS = Object\.freeze\(\[[^\]]*\]\);/, "timeframes"),
    grab(pair, /const MACRO = Object\.freeze\(\[[^\]]*\]\);/, "macro"), fnOf(pair, "listChoice"), fnOf(pair, "tfChoice"),
    "globalThis.out = { LISTS, TFS, MACRO, listChoice, tfChoice };"].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); return ctx.out;
}

test("W8 · the right chart's list: TARGETS by default, MINE · RADAR · MACRO on its chips, remembered on this machine", () => {
  const A = pairApi();
  assert.deepEqual(plain(A.LISTS), ["targets", "mine", "radar", "macro"]);
  assert.equal(A.listChoice(null, null), "targets"); assert.equal(A.listChoice("mine", null), "mine"); assert.equal(A.listChoice("mine", "radar"), "radar", "?list= wins for one load");
  assert.equal(A.listChoice("junk", "junk"), "targets");
  assert.deepEqual(plain(A.MACRO), ["ESUSD", "NQUSD", "CLUSD", "GCUSD", "BTCUSD", "DXUSD", "US10Y", "VIX"], "the lens set's MACRO, the same eight");
  assert.match(fnOf(pair, "setList"), /PAIR\.list = name; lsSet\(LIST_KEY, name\);/); assert.match(pair, /const LIST_KEY = "station\.pair\.list"/);
  assert.match(fnOf(pair, "setList"), /s\.manual = null; s\.playing = true;\n  show\(s, s\.show\[0\]\);/, "a list chosen starts at its first name");
  assert.match(fnOf(pair, "rightList"), /name === "targets" \? TARGETS : name === "macro" \? MACRO : name === "mine" \? DB\.mine : DB\.radar/);
});

test("W8 · synced in every way except the ticker: one timeframe row and CLOUDS for both charts, each its own ticker", () => {
  const A = pairApi();
  assert.deepEqual(plain(A.TFS), ["1m", "5m", "15m", "30m", "1h", "1D"]);
  assert.equal(A.tfChoice(null, null), "5m"); assert.equal(A.tfChoice("1h", null), "1h"); assert.equal(A.tfChoice("1h", "15m"), "15m");
  assert.match(fnOf(pair, "setTf"), /for \(const s of SIDES\) if \(!\(s\.item && s\.item\.daily && !s\.manual\)\) post\(s, \{ sc:"chart", tf \}\);/, "both charts (the put/call's daily turn keeps 1D)");
  assert.match(fnOf(pair, "setClouds"), /for \(const s of SIDES\) post\(s, \{ sc:"chart", clouds:PAIR\.clouds \}\);/);
  assert.match(pair, /<span class="tfs" id="tfs" role="group" aria-label="Timeframe, both charts"><\/span>/, "one row, at the top");
  assert.doesNotMatch(pair, /class="box"/, "no second ticker box on the pair's strip - the chart's own is the one");
  assert.match(pair, /const LIST_KEY = "station\.pair\.list", TF_KEY = "station\.pair\.tf", CLOUDS_KEY = "station\.pair\.clouds";/);
});

test("W8 · live-v1 &sync=1: its intervals and CLOUDS step aside, its ticker box always shows; without sync=1 nothing changes", () => {
  assert.match(live, /const SYNC = QS\.get\("sync"\) === "1";\nif \(SYNC\) document\.body\.classList\.add\("sync"\);/);
  assert.match(live, /body\.sync #tfs, body\.sync #cloudsBtn\{ display:none; \}\nbody\.sync #strip \.sym\{ display:inline-block; \}/);
  assert.match(fnOf(live, "paintStrip"), /if \(sym\.tagName !== "INPUT" && \(!BARE \|\| SYNC\)\) \{/, "the box is made in synced mode even when bare");
  /* the parent's word: the timeframe only in synced mode; a new timeframe and a new ticker together are one load */
  assert.match(live, /const tf = SYNC && d\.tf && TFS\.some\(\(x\) => x\.key === d\.tf \|\| x\.tv === d\.tf\) \? tfOf\(d\.tf\) : null;/);
  assert.match(live, /if \(tf && t && t !== SYMBOL && tf !== TF\) \{ TF = tf; S\.spacing = TF\.daily \? 6 : 7; setSymbol\(t\); return; \}/);
  assert.match(live, /if \(typeof d\.clouds === "boolean"\) setClouds\(d\.clouds\);/, "clouds from the parent, as before");
});

test("W8 · live-v1's ticker box tells its parent which chart and which ticker, and switches itself", () => {
  const typed = fnOf(live, "tickerTyped");
  assert.match(typed, /if \(SYNC && window\.parent !== window\) \{ try \{ parent\.postMessage\(\{ type:"SCINTILLA_CHART_TICKER", n:N, ticker:t \}, location\.origin\); \} catch \(_\) \{\} \}/);
  assert.match(typed, /setSymbol\(t\);/);
  assert.match(fnOf(live, "paintStrip"), /if \(e\.key === "Enter"\) \{ tickerTyped\(input\.value\); input\.blur\(\); \}/);
  /* the pair hears it: that chart's lane waits until PLAY */
  assert.match(pair, /if \(e\.data\.type === "SCINTILLA_CHART_TICKER" && e\.data\.ticker\) \{ s\.manual = CLEAN\(e\.data\.ticker\); s\.nowSym = s\.manual; paintBar\(s\); return; \}/);
});
