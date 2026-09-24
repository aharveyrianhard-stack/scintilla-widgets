/* PUTS AND CALLS AS TWO PARTS (M56, 24 Sep). Alan: "puts traded and calls traded side by side
   would be pretty, pretty great. Which moved would be pretty great." These pin the rules the
   browser proof then shows on screen: one route, absent-is-not-zero, named silences, and the
   same up / down colour every other reading uses. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");

test("the deck's chart shell and the standalone chart stay byte-identical twins", () => {
  assert.equal(shell, chart);
});

test("the two volumes arrive on the SAME provider route as the ratio, not a second path", () => {
  assert.match(provider, /put_volume: Number\.isFinite\(bar\.pv\) \? Number\(bar\.pv\) : null/);
  assert.match(provider, /call_volume: Number\.isFinite\(bar\.cv\) \? Number\(bar\.cv\) : null/);
  /* no new fetch, no new host, no database read was opened for them */
  const before = (provider.match(/API \+ '\/candles\?/g) || []).length;
  assert.equal(before, 1, "the client still has exactly one candles URL");
  assert.ok(!/ibkr_putcall_minute\?|from\(["']putcall_/.test(provider), "no direct table read");
});

test("absent stays absent: a session with no volumes is null, never zero", () => {
  assert.match(chart, /pv: isFinite\(r\.put_volume\) && r\.put_volume !== null \? \+r\.put_volume : null/);
  assert.match(chart, /cv: isFinite\(r\.call_volume\) && r\.call_volume !== null \? \+r\.call_volume : null/);
  assert.match(chart, /never 0, so a session\s+that published no volumes cannot read as "nothing traded"/,
    "and the reason is written down where the mapping happens");
  assert.match(provider, /a 0 would read as "nothing traded"/, "and again where it enters the client");
});

test("the pane draws both amounts and says which side moved", () => {
  assert.match(chart, /function paintPutCallParts\(host\)/);
  assert.match(chart, /const rows = \[\["PUTS", last\.pv, dPut\], \["CALLS", last\.cv, dCall\]\];/);
  /* 24 Sep: a compact table in the corner, not bars across the chart (Alan: "the PCC is taking over
     so much of the chart… think how TradingView does tables"). */
  assert.match(chart, /cell\("sc-pct__k", "VOL"\);/, "a VOL row of the two amounts");
  assert.match(chart, /cell\("sc-pct__k", "DAY"\);/, "a DAY row of how each side moved");
  assert.match(chart, /\.sc-nchart__pctable\{ position:absolute; top:7px; right:58px;/, "pinned top-right, clear of the price scale");
  assert.match(chart, /\.sc-pct__v\[data-change="up"\]\{ color:var\(--bull\); \}/, "up is green");
  assert.match(chart, /\.sc-pct__v\[data-change="down"\]\{ color:var\(--bear\); \}/, "down is red");
  assert.match(chart, /"puts " \+ pcSide\(dPut\) \+ ", calls " \+ pcSide\(dCall\)/);
  assert.match(chart, /the ratio " \+ ratioMoved/);
  assert.match(chart, /paintPutCallParts\(host\);\n  paintChartHistoryWindow\(host\);/,
    "and the painter runs whenever the pane repaints");
});

test("each bar takes the same up / down colour as every other reading, on a grey track", () => {
  assert.match(chart, /\.sc-nchart__pcp-fill\[data-change="up"\]\{ background:var\(--bull\); \}/);
  assert.match(chart, /\.sc-nchart__pcp-fill\[data-change="down"\]\{ background:var\(--bear\); \}/);
  const track = chart.match(/\.sc-nchart__pcp-track\{[^}]*background:rgba\((\d+),(\d+),(\d+)/);
  const ch = [Number(track[1]), Number(track[2]), Number(track[3])];
  assert.ok(Math.max(...ch) - Math.min(...ch) <= 24 && Math.max(...ch) <= 210,
    `the track must be grey, got ${ch}`);
});

test("a side that barely moved is called flat, with the reader's own threshold", () => {
  assert.match(chart, /const PUTCALL_FLAT_PCT = 5;/);
  assert.match(chart, /if \(Math\.abs\(pct\) < PUTCALL_FLAT_PCT\) return "flat";/);
});

test("no volumes is named, never blank, and the three silences are different", () => {
  assert.match(chart, /puts and calls \\u00b7 " \+ putCallWaitingText\(host\?\.dataset\?\.absence\)/,
    "the Scintilla line says which Gateway silence this is");
  assert.match(chart, /waiting for the published session/);
  assert.match(chart, /waiting for the reader \\u00b7 this session's two volumes are not in the series yet/);
  assert.match(chart, /box\.dataset\.state = "waiting";/);
});

test("the fraction is explained in plain words where the fraction is", () => {
  assert.match(chart, /A lower number means fewer puts per call\. 0\.5 = one put for every two calls\./);
  assert.match(chart, /1\.2 = twelve puts for every ten calls\./);
  assert.match(chart, /the publisher printed " \+ last\.p\.toFixed\(2\)/,
    "and the publisher's own ratio is shown beside the division, not replaced by it");
});
