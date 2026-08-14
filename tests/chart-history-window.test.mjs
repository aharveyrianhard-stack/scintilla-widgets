import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8")
  .replace('<script src="/testing-surface.js"></script>\n', "");

const rangeMatch = chart.match(/const CHART_DB_RANGE = (\{[^;]+\});/);
assert.ok(rangeMatch, "chart range contract must remain statically inspectable");
const ranges = JSON.parse(rangeMatch[1]);

test("initial chart history is 240 points except for the 156-point weekly window", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(ranges).map(([range, [, limit]]) => [range, limit])), {
    "15m":240, "30m":240, "1h":240, "2h":240, "3h":240, "4h":240,
    "6h":240, "12h":240, "1D":240, "3D":240, "1W":156,
  });
  assert.match(chart, /const chartInitialLimit = \(range\) => \(CHART_DB_RANGE\[range\]/);
  assert.match(chart, /chartTail\(chApplyLivePoint\(t, hit\.pts, liveQuote\[t\]\), limit\)/,
    "a larger memory cache must still paint only the requested initial tail");
  assert.match(chart, /chartTail\(chApplyLivePoint\(t, env\.pts, liveQuote\[t\]\), limit \|\| chartInitialLimit\(range\)\)/,
    "a larger durable cache must not silently restore the old 400-point initial display");
});

test("every chart range retains bounded older-history paging", () => {
  assert.equal(Object.keys(ranges).length, 11);
  assert.match(chart, /const CHART_HISTORY_PAGE = 800;/);
  assert.match(chart, /timestamp=lt\." \+ beforeTs/);
  assert.match(chart, /pages < 12/);
  assert.match(chart, /requestOlderAtBoundary\(span >= \(host\._series\?\.length \|\| 2\) - 2\)/,
    "touch pinch at the loaded boundary requests an older page");
  assert.match(chart, /requestOlderAtBoundary\(gesture\.view\.start \+ shift <= 1\)/,
    "pointer drag at the left boundary requests an older page");
  assert.match(chart, /requestOlderAtBoundary\(plot\.start \+ shift <= 1\)/,
    "horizontal trackpad pan at the left boundary requests an older page");
  assert.match(chart, /requestOlderAtBoundary\(e\.deltaY > 0 && newSpan >= pts\.length - 2\)/,
    "wheel zoom-out at the loaded boundary requests an older page");
  assert.match(chart, /requestOlderAtBoundary\(span >= pts\.length - 2\)/,
    "trackpad pinch at the loaded boundary requests an older page");
});

test("the visible chart badge reports the actual loaded point count", () => {
  assert.match(chart, /className = "sc-nchart__live-points"/);
  assert.match(chart, /points\.textContent = \(host\._series\?\.length \|\| 0\) \+ " pts"/);
  assert.match(chart, /points:host\._series\?\.length \|\| 0/);
});

test("the labeled testing shell exactly mirrors the reviewed chart implementation", () => {
  assert.equal(shell, chart);
});
