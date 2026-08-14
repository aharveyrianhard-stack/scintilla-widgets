import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");

test("Station charts keep a cache-first, bounded, deduplicated recovery path", () => {
  assert.match(chart, /const PG_TIMEOUT_MS = 4500;/);
  assert.match(chart, /controller\.abort\(\)/);
  assert.match(chart, /signal: controller\?\.signal/);
  assert.match(chart, /const tries = _tries == null \? 1 : _tries;/);

  const cacheSet = chart.match(/function cacheSet\(k, payload\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(cacheSet, /localStorage\.setItem/);
  assert.doesNotMatch(cacheSet, /lsSet\(/);

  assert.match(chart, /const chartInflight = new Map\(\);/);
  assert.match(chart, /if \(chartInflight\.has\(inflightKey\)\) return chartInflight\.get\(inflightKey\);/);
  assert.match(chart, /chartInflight\.delete\(inflightKey\)/);
  assert.match(chart, /msg\.textContent = "data delayed · retrying"/);
  assert.match(chart, /retryChartLoad\(host, req\)/);
  assert.match(chart, /A stale but usable chart is better than a black pane/);
});

test("Station chart history reads one canonical bar per ticker, timeframe, and minute", () => {
  assert.match(chart, /pg\("ohlcv_dedup\?ticker=eq\./,
    "initial series fetch must use the canonical source-selected view");
  assert.match(chart, /async function fetchOlderChartSeries[\s\S]*?pg\("ohlcv_dedup\?ticker=eq\./,
    "history paging must use the same canonical source-selected view");
  assert.doesNotMatch(chart, /pg\("ohlcv_history\?ticker=eq\./,
    "no Station chart request may mix raw FMP and FMP-STREAM duplicates");
});

test("multiple uncached panes retain an explicit delayed state throughout retry", () => {
  const match = chart.match(/function showChartDelayed\(host, ticker\) \{[\s\S]*?\n\}/);
  assert.ok(match, "delayed-state renderer is present");
  const showChartDelayed = vm.runInNewContext(`(${match[0]})`);
  const makeHost = () => {
    const message = { hidden:true, textContent:"" };
    return { host:{ dataset:{}, _series:null, querySelector:() => message }, message };
  };
  const spy = makeHost(), sndk = makeHost();
  showChartDelayed(spy.host, "SPY");
  showChartDelayed(sndk.host, "SNDK");
  for (const pane of [spy, sndk]) {
    assert.equal(pane.host.dataset.dataState, "delayed");
    assert.equal(pane.message.hidden, false);
    assert.equal(pane.message.textContent, "data delayed · retrying");
  }
  assert.match(chart, /showChartDelayed\(host, host\.dataset\.t\);\n      scChartLoad\(host\);/);
  assert.match(chart, /else if \(host\.dataset\.dataState === "delayed"\) \{/);
});
