import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");

/* The two helpers are pulled out of the page and actually run, so this file tests behaviour
   rather than the presence of words. */
const grab = (name, src = chart) => {
  const i = src.indexOf(`function ${name}(`);
  assert.ok(i > 0, `${name} must exist in the page`);
  let depth = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") depth++;
    else if (src[k] === "}") { depth--; if (depth === 0) { j = k; break; } }
  }
  return src.slice(i, j + 1);
};

test("the deck's shell and the standalone chart are still byte-identical twins", () => {
  assert.equal(shell, chart);
});

test("Scintilla's own intraday put/call is a pane, paired with the Cboe print it sits beside", () => {
  const block = chart.match(/const PUTCALL_PANES = Object\.freeze\(\{[\s\S]*?\}\);/)[0];
  assert.match(block, /SCPCE: Object\.freeze\(\{ name:"Scintilla equity put\/call", source:"IBKR_INTRADAY", cboe:"PCCE" \}\)/);
  assert.match(block, /SCPCI: Object\.freeze\(\{ name:"Scintilla index put\/call", source:"IBKR_INTRADAY", cboe:"PCCI" \}\)/);
  assert.match(block, /PCCE:  Object\.freeze\(\{ name:"Cboe equity put\/call", source:"CBOE_DAILY", scintilla:"SCPCE" \}\)/);
  assert.match(block, /PCCI:  Object\.freeze\(\{ name:"Cboe index put\/call", source:"CBOE_DAILY", scintilla:"SCPCI" \}\)/);
});

test("the intraday series comes through the one provider route, with no second data path", () => {
  assert.match(provider, /var SCINTILLA_PUTCALL_SYMBOLS = \{ SCPCE: 1, SCPCI: 1 \};/);
  assert.match(provider, /if \(own\[sym\] \|\| MACRO_SYMBOLS\[sym\] \|\| PUTCALL_SYMBOLS\[sym\] \|\| SCINTILLA_PUTCALL_SYMBOLS\[sym\]\)/);
  /* Naming the source table in a comment is documentation; READING it would be a second data
     path. Only the read shapes are forbidden -- same rule as the Cboe series' own test. */
  const reads = /ibkr_putcall_minute\?|ibkr_option_volume\?|from\(["']ibkr_|select=.*ibkr_/;
  assert.ok(!reads.test(provider), "no direct table read for it in the provider");
  assert.ok(!reads.test(chart), "and none in the shell either");
  assert.match(provider, /public\.ibkr_putcall_minute/, "the comment still names where the chart API gets it");
  assert.match(chart, /fetchChartSeries\(other, range, 400\)/, "the companion uses the same fetch as the pane");
});

test("each silence is named in words a person can act on, never as a dash", () => {
  const waiting = chart.match(/const PUTCALL_WAITING = Object\.freeze\(\{[\s\S]*?\}\);/)[0];
  for (const reason of ["NOT_SERVED_BY_CHART_API", "IBKR_GATEWAY_DOWN", "IBKR_LINK_DOWN",
                        "IBKR_NOT_SUBSCRIBED", "NO_MINUTE_YET"]) {
    assert.ok(waiting.includes(reason + ":"), `${reason} needs its own sentence`);
  }
  assert.match(waiting, /IBKR's link to it is broken/, "tonight's actual failure is one of the sentences");
  const fn = new Function(waiting + grab("putCallWaitingText") + "return putCallWaitingText;")();
  assert.match(fn("IBKR_LINK_DOWN"), /^waiting for the Gateway/);
  assert.match(fn(""), /not being served yet/, "an unknown reason still says something true");
  assert.match(fn("SOMETHING_NEW"), /not being served yet/);
  assert.ok(!fn("IBKR_LINK_DOWN").includes("undefined"));
});

test("tracking against Cboe is measured on the sessions both printed, or declared not measurable", () => {
  const fn = new Function(grab("putCallTracking") + "return putCallTracking;")();
  const ours = [{ d: "2026-09-21", p: 1.05 }, { d: "2026-09-22", p: 0.88 }, { d: "2026-09-23", p: 1.11 }];
  const cboe = [{ d: "2026-09-21", p: 0.95 }, { d: "2026-09-22", p: 0.78 }, { d: "2026-09-23", p: 1.00 },
                { d: "2026-09-24", p: 0.99 }];
  const t = fn(ours, cboe);
  assert.equal(t.n, 3, "only the overlapping sessions count");
  assert.ok(Math.abs(t.mean_offset - 0.1033333333333333) < 1e-9);
  assert.equal(fn([ours[0]], cboe).enough, false, "one day is not a measurement");
  assert.equal(fn(ours, []).enough, false);
  assert.equal(fn(ours, [{ d: "2026-09-21", p: 0 }]).enough, false, "a zero divisor is not a pair");
  /* The browser proof caught this one: 120 minutes of one afternoon are ONE session, not 120. */
  const minutes = Array.from({ length: 120 }, (_, i) =>
    ({ d: new Date(Date.parse("2026-09-23T14:00:00Z") + i * 60000).toISOString(), p: 1.0 + i / 1000 }));
  const oneDay = fn(minutes, [{ d: "2026-09-23", p: 0.9 }]);
  assert.equal(oneDay.n, 1, "minutes collapse to their session");
  assert.equal(oneDay.enough, false, "and one session is still not a measurement");
  const two = fn([...minutes, { d: "2026-09-22T20:00:00Z", p: 1.2 }],
                 [{ d: "2026-09-23", p: 0.9 }, { d: "2026-09-22", p: 1.0 }]);
  assert.equal(two.n, 2);
  assert.ok(Math.abs(two.mean_offset - ((1.119 - 0.9) + (1.2 - 1.0)) / 2) < 1e-9,
    "each session contributes its last reading, once");
});

test("an intraday line goes stale in minutes, and Cboe's print still gets its days", () => {
  assert.match(chart, /const PUTCALL_INTRADAY_FRESH_MS = 15 \* 60 \* 1000;/);
  assert.match(chart, /const freshWindow = pane\.source === "IBKR_INTRADAY" \? PUTCALL_INTRADAY_FRESH_MS : PUTCALL_FRESH_MS;/);
  assert.match(chart, /const PUTCALL_FRESH_MS = 4 \* 86400000;/, "the daily rule is unchanged");
});

test("the companion reading follows the Station's colour and size rules", () => {
  assert.match(chart, /\.sc-nchart__live-companion\{[^}]*font:600 11px var\(--mono\)/, "11px floor for body text");
  assert.match(chart, /\.sc-nchart__live-companion\[data-change="up"\]\{ color:var\(--bull\); \}/);
  assert.match(chart, /\.sc-nchart__live-companion\[data-change="down"\]\{ color:var\(--bear\); \}/);
  assert.match(chart, /line\.dataset\.change = !prev \|\| last\.p === prev\.p \? "flat" : last\.p > prev\.p \? "up" : "down";/,
    "same up / down rule as every other pane");
  assert.match(chart, /companion\.measured \+ " of " \+ companion\.of \+ " names"/,
    "coverage is shown beside the number, because the reader rotates");
  /* At 390 the companion was painted over the Cboe number until it got a row of its own. */
  assert.match(chart, /\.sc-nchart__live--pc\{ flex-wrap:wrap; white-space:normal;/);
  assert.match(chart, /\.sc-nchart__live-companion\{ flex:1 0 100%;/);
  assert.match(chart, /badge\.classList\.add\("sc-nchart__live--pc"\);/);
});

test("an intraday pane is never described with Cboe's words", () => {
  assert.match(chart, /\? chartWindowLabel\(pts\) \+ " \\u00b7 IBKR, this session"/);
  assert.match(chart, /IBKR publishes each underlying's running call and put volume, not a ratio\./,
    "the tooltip states what IBKR actually gives");
});

/* M67: the serving side can now report two silences the pane did not know. A pane that maps them
   to "not being served yet" sends Alan to the wrong place — in both cases the series IS served,
   and what stopped is the aggregate behind it. */
test("the pane names the two silences the chart API can now report", () => {
  const html = chart;
  for (const key of ["SCINTILLA_PUTCALL_MINUTES_BEHIND", "SCINTILLA_PUTCALL_READ_FAILED"]) {
    assert.ok(html.includes(key + ":"), `the waiting map must name ${key}`);
    assert.ok(shell.includes(key + ":"), `the mounted shell must name ${key} too`);
  }
  const behind = html.match(/SCINTILLA_PUTCALL_MINUTES_BEHIND: "([^"]+)"/);
  assert.ok(behind && !/not being served/.test(behind[1]),
    "a line that is served but behind must not claim it is not served");
  assert.ok(/aggregator is behind/.test(behind[1]), "it says which half stopped");
});

/* M67: the one thing the wall does not do is draw a grey line. An intraday ratio on its first
   session has no previous close, so the trace used to fall to the dim tone. Its own opening
   reading is a real baseline and gives the line a direction. */
test("an intraday line on its first session takes its direction from the session's open", () => {
  const openRef = new Function(grab("chIntradaySessionOpenRef") + "return chIntradaySessionOpenRef;")();
  const day = (h, m) => new Date(Date.UTC(2026, 8, 24, h, m)).toISOString();
  const host = { dataset: { t: "SCPCE" }, _series: [
    { d: day(13, 30), p: 0.45 }, { d: day(13, 45), p: 0.47 }, { d: day(14, 0), p: 0.49 }] };
  assert.equal(openRef(host), 0.45, "the session's first reading, not the previous point");

  /* Once a second session exists the ordinary previous-close rule owns it again. */
  const twoDays = { dataset: { t: "SCPCE" }, _series: [
    { d: new Date(Date.UTC(2026, 8, 23, 19, 55)).toISOString(), p: 0.61 },
    { d: day(13, 30), p: 0.45 }, { d: day(13, 45), p: 0.47 }] };
  const prevClose = new Function(grab("chSeriesPrevClose") + "return chSeriesPrevClose;")();
  assert.equal(prevClose(twoDays), 0.61);
  assert.equal(openRef(twoDays), 0.45, "the open of the newest session only");

  assert.equal(openRef({ dataset: { t: "SCPCE" }, _series: [{ d: day(13, 30), p: 0.45 }] }), null,
    "one point is not a direction");

  /* The rule is scoped to the intraday pane: a Cboe daily series keeps the previous close. */
  const ref = new Function("prevClose", "scPutCallPane", "chSeriesPrevClose", "chIntradaySessionOpenRef",
    grab("chDayRef") + "return chDayRef;")({}, (t) => (t === "SCPCE" ? { source: "IBKR_INTRADAY" } : { source: "CBOE_DAILY" }),
      prevClose, openRef);
  const cboe = { dataset: { t: "PCCE" }, _series: [{ d: day(13, 30), p: 0.45 }, { d: day(13, 45), p: 0.47 }] };
  assert.equal(ref(cboe), null, "a Cboe pane with no previous session still has no baseline");
  assert.equal(ref(host), 0.45, "the intraday pane gets the session's open");
});
