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
  assert.match(chart, /const rows = await fetchProviderCandles\(t, e\[0\], limit, 2\);/,
    "the first transient history failure is retried inside the same chart load");
  assert.match(chart, /if \(error && error\.scAbsence\) throw error;/,
    "a provider-named absence is terminal and is not retried as transport");
  assert.match(chart, /msg\.textContent = "data delayed · retrying"/);
  assert.match(chart, /retryChartLoad\(host, req, generation\)/);
  assert.match(chart, /A stale but usable chart is better than a black pane/);
});

test("multiple uncached panes retain an explicit delayed state throughout retry", () => {
  const match = chart.match(/function showChartDelayed\(host, ticker\) \{[\s\S]*?\n\}/);
  assert.ok(match, "delayed-state renderer is present");
  const delayedContext = { reportChartDataState:() => {} };
  vm.runInNewContext(`${match[0]}; globalThis.showChartDelayed = showChartDelayed;`, delayedContext);
  const showChartDelayed = delayedContext.showChartDelayed;
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
