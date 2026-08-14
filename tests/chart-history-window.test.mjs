import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8")
  .replace('<script src="/testing-surface.js"></script>\n', "");

const rangeMatch = chart.match(/const CHART_DB_RANGE = (\{[^;]+\});/);
assert.ok(rangeMatch, "chart range contract must remain statically inspectable");
const ranges = JSON.parse(rangeMatch[1]);

test("initial chart history is 240 candles except for the 156-candle weekly window", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(ranges).map(([range, [, limit]]) => [range, limit])), {
    "15m":240, "30m":240, "1h":240, "2h":240, "3h":240, "4h":240,
    "6h":240, "12h":240, "1D":240, "3D":240, "1W":156,
  });
  assert.match(chart, /const chartInitialLimit = \(range\) => \(CHART_DB_RANGE\[range\]/);
  assert.match(chart, /chartDisplayTail\(chApplyLivePoint\(t, hit\.pts, liveQuote\[t\]\), range, limit\)/,
    "a larger memory cache must still paint only the requested initial tail");
  assert.match(chart, /chartDisplayTail\(chApplyLivePoint\(t, env\.pts, liveQuote\[t\]\), range, limit \|\| chartInitialLimit\(range\)\)/,
    "a larger durable cache must not silently restore the old 400-point initial display");
  assert.match(chart, /range === "1W" \? "&timestamp=lt\." \+ chartWeekStartUnix\(\) : ""/,
    "the weekly initial read excludes the current unfinished week");
  assert.match(chart, /range === "1W"[\s\S]*?< chartWeekStartUnix\(\)/,
    "cached weekly rows also exclude the current unfinished week");
});

test("chart gestures stay local and can never request older history", () => {
  assert.equal(Object.keys(ranges).length, 11);
  assert.doesNotMatch(chart, /CHART_HISTORY_PAGE|fetchOlderChartSeries|expandChartHistory|requestOlderAtBoundary/);
  assert.doesNotMatch(chart, /limit=800|beforeTs|timestamp=lt\." \+ before/,
    "the chart client must not contain an on-demand older-history query contract");
  const scrub = chart.match(/function scChartScrub\(host\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(scrub, /setChartView\(host, gesture\.view\.start \+ shift, gesture\.view\.end \+ shift, false\)/,
    "pointer drag remains a local view change");
  assert.match(scrub, /setChartView\(host, plot\.start \+ shift, plot\.end \+ shift, false\)/,
    "horizontal trackpad pan remains a local view change");
  assert.match(scrub, /applyLatestSpan\(newSpan\)/,
    "wheel zoom remains a local view change");
  assert.doesNotMatch(scrub, /\bfetch\b|\bpg\(/,
    "no touch, pointer, wheel, or trackpad gesture can reach the network");
});

test("the visible chart badge reports an approximate span and actual start date", () => {
  assert.match(chart, /className = "sc-nchart__live-window"/);
  assert.match(chart, /chartApproximateSpan\(pts, host\._range \|\| S\.chartRange\) \+ " · since " \+ chartStartDate\(pts\[0\]\.d\)/);
  assert.match(chart, /"≈" \+ days \+ " trading days"/);
  assert.match(chart, /"≈" \+ \(years < 2 \? years\.toFixed\(1\) : Math\.round\(years\)\) \+ " years"/);
  assert.doesNotMatch(chart, /\+ " pts"|live-points/,
    "user-facing history descriptions must not expose point counts");
});

test("the labeled testing shell exactly mirrors the reviewed chart implementation", () => {
  assert.equal(shell, chart);
});
