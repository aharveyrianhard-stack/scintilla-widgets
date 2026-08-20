import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");

const rangeMatch = chart.match(/const CHART_DB_RANGE = (\{[^;]+\});/);
assert.ok(rangeMatch, "chart range contract must remain statically inspectable");
const ranges = JSON.parse(rangeMatch[1]);

test("initial chart history is 240 candles plus an honest current-inclusive weekly window", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(ranges).map(([range, [, limit]]) => [range, limit])), {
    "15m":240, "30m":240, "1h":240, "2h":240, "3h":240, "4h":240,
    "6h":240, "12h":240, "1D":240, "3D":240, "1W":157,
  });
  assert.match(chart, /Weekly asks for 157 total rows: up to 156 completed weeks plus the current/,
    "the extra weekly row is explicitly reserved for a provider-supplied provisional week");
  assert.match(chart, /const chartInitialLimit = \(range\) => \(CHART_DB_RANGE\[range\]/);
  /* The live point now takes the range too: whether a transient point belongs is a question
     about the timeframe's bucket, not about the calendar date. */
  assert.match(chart, /chartTail\(chApplyLivePoint\(t, hit\.pts, liveQuote\[t\], range\), limit \|\| chartInitialLimit\(range\)\)/,
    "a larger memory cache paints only the initial window");
  assert.match(chart, /chartTail\(chApplyLivePoint\(t, env\.pts, liveQuote\[t\], range\), limit \|\| chartInitialLimit\(range\)\)/,
    "a larger durable cache cannot silently restore the old 400-row display");
  assert.doesNotMatch(chart, /chartWeekStartUnix|completedBefore|timestamp=lt\.[^"\n]*week/i,
    "the client must not exclude the current unfinished weekly candle");
});

test("chart gestures stay local and can never request older history", () => {
  assert.equal(Object.keys(ranges).length, 11);
  assert.doesNotMatch(chart, /CHART_HISTORY_PAGE|fetchOlderChartSeries|expandChartHistory|requestOlderAtBoundary/);
  assert.doesNotMatch(chart, /limit=800|beforeTs|timestamp=lt\." \+ before/,
    "the chart client contains no on-demand older-history query contract");
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
    "user-facing history descriptions never expose point counts");
});

test("the independently versioned chart shell exactly mirrors the chart implementation", () => {
  assert.equal(shell, chart);
});
