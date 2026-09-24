import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");

test("the deck's chart shell and the standalone chart stay byte-identical twins", () => {
  assert.equal(shell, chart, "both shells must change together");
});

test("the four Cboe series are drawn by the Station, not stood in for by TradingView", () => {
  const block = chart.match(/const TV_INTERNALS = Object\.freeze\(\{[\s\S]*?\}\);/)[0];
  for (const sym of ["PCC", "PCCE", "PCCI", "PCSPX"]) {
    assert.ok(!new RegExp(`^\\s*${sym}:`, "m").test(block), `${sym} must no longer fall back to TradingView`);
  }
  /* The internals the Station genuinely holds no series for are untouched. */
  for (const sym of ["TICK", "CUMTICK", "TRIN", "ADD"]) {
    assert.ok(new RegExp(`^\\s*${sym}:`, "m").test(block), `${sym} keeps its TradingView pane`);
  }
  assert.match(block, /USI:TICK/);
});

/* 24 Sep (M38): Scintilla's own intraday put/call, SCPCE and SCPCI, passes the same gate.
   The pin moves with it; the rule it protects -- one route, nothing else gets through -- does not. */
test("the provider client sends them to the chart API, like the macro series", () => {
  assert.match(provider, /var PUTCALL_SYMBOLS = \{ PCC: 1, PCCE: 1, PCCI: 1, PCSPX: 1 \};/);
  assert.match(provider, /if \(own\[sym\] \|\| MACRO_SYMBOLS\[sym\] \|\| PUTCALL_SYMBOLS\[sym\] \|\| SCINTILLA_PUTCALL_SYMBOLS\[sym\]\)/,
    "marketCandles must let them through the equity-ownership gate");
  /* and nothing here re-opens a second data path */
  assert.ok(!/put_call_history/.test(provider), "no Supabase side door for this series");
  /* The shell may still NAME the old table while explaining why it is no longer the reason
     for a TradingView pane, but it must not read it. */
  assert.ok(!/put_call_history\?|from\(["']put_call_history/.test(chart), "and no read of it in the shell");
  assert.ok(!/put_call_history and tick_flow are empty/.test(chart), "the stale claim is gone");
});

test("a published daily ratio is painted from its sessions, never from a live quote", () => {
  assert.match(chart, /if \(scPutCallPane\(host\?\.dataset\?\.t\)\) \{ paintPutCallStatus\(host\); return; \}/,
    "paintLiveStatus hands these panes over before it reads a quote");
  /* 24 Sep: an unchanged print is at-or-above, like every other pane - only an unknown change is unclaimed. */
  assert.match(chart, /badge\.dataset\.change = pct == null \? "flat" : pct >= 0 \? "up" : "down";/,
    "the readout takes the same up / down colour as every pane (Alan, 23 Sep), with no grey for zero");
  assert.match(chart, /putCallSessionLabel\(last\.d\)/, "the hover text names the session it is showing");
  assert.match(chart, /"  " \+ chartStartDate\(last\.d\);/, "and so does the one visible line");
  assert.doesNotMatch(chart, /scPutCallPane\(host\?\.dataset\?\.t\) \? null : chDayRef\(host\)/,
    "the line is no longer held to grey: same green / red rule as every pane");
  assert.match(chart, /There is no live put\/call ratio\./);
  /* the window label says the session and the publisher, not "last close" */
  assert.match(chart, /pcPane \? putCallSessionLabel\(pts\[pts\.length - 1\]\.d\) \+ " \\u00b7 Cboe"/);
});

test("the shared readout builder is not recursive", () => {
  /* It was, for one commit: the edit that introduced it also replaced its own body with a call to
     itself, and the pane died on boot with a stack overflow. A real browser caught it; this keeps
     it caught. */
  const fn = chart.match(/function ensureLiveParts\(badge, host\) \{[\s\S]*?\n\}/)[0];
  assert.ok(!/ensureLiveParts\(/.test(fn.slice("function ensureLiveParts".length)),
    "ensureLiveParts must not call itself");
  assert.match(fn, /badge\.querySelector\("\.sc-nchart__live-ticker"\)/);
  assert.match(fn, /return \{ ticker, change, previous, historyWindow \};/);
  assert.equal((chart.match(/function ensureLiveParts\(/g) || []).length, 1, "one definition");
  assert.equal((chart.match(/= ensureLiveParts\(badge, host\)/g) || []).length, 2,
    "two call sites: the live painter and the put/call painter");
});

test("house rule: the put/call block introduces no white and no near-white", () => {
  const block = chart.match(/THE CBOE PUT\/CALL SERIES[\s\S]*?\nfunction paintChartHistoryWindow/)[0];
  const bad = block.match(/#fff\b|#ffffff\b|(?<![-\w])white(?![-\w])|rgb\(\s*255\s*,\s*255\s*,\s*255/i);
  assert.equal(bad, null, "forbidden colour: " + (bad && bad[0]));
});
