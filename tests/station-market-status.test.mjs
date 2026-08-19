/* The Station header's healthy state must be reachable.
   ====================================================
   paintMarketStatus's ready path read `delayed.length` from a variable that only ever
   existed inside chartDataSummary's own scope. Every fully healthy paint — all panes
   ready, real observation stamps — therefore threw ReferenceError and the header froze
   on whatever it last said while degraded. The one state the header could never show
   was the one where everything works.

   This suite runs the painter itself, not a re-implementation of it, against the same
   row shapes the chart frames post (`chart-data-state` merged with `chart-status`).
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");

function fnFrom(source, name, bindings = {}) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}

/* One shared context so paintMarketStatus resolves the real chartDataSummary and
   chartAbsenceHeadline, exactly as it does in the page. */
function paintHarness(rows) {
  const node = { textContent:"", dataset:{}, title:"" };
  const bindings = {
    CHARTS: rows.map((row) => row.ticker),
    CHART_COUNT: rows.length,
    CHART_STATUS: new Map(rows.map((row) => [row.ticker, row])),
    el: (id) => (id === "marketStatus" ? node : null),
  };
  bindings.chartDataSummary = fnFrom(deck, "chartDataSummary", bindings);
  bindings.chartAbsenceHeadline = fnFrom(deck, "chartAbsenceHeadline", bindings);
  const paint = fnFrom(deck, "paintMarketStatus", bindings);
  return { node, paint, bindings };
}

const secondsAgo = (s) => new Date(Date.now() - s * 1000).toISOString();

test("a fully healthy deck paints LIVE instead of throwing", () => {
  const { node, paint } = paintHarness([
    { ticker:"SPY", history:"ready", quote:"ready", updatedTs:secondsAgo(20) },
    { ticker:"QQQ", history:"ready", quote:"ready", updatedTs:secondsAgo(35) },
  ]);
  /* Before the fix this call was the defect: ReferenceError, delayed is not defined. */
  paint();
  assert.match(node.textContent, /^LIVE · /);
  assert.equal(node.dataset.fresh, "1");
  assert.equal(node.dataset.delayed, "0");
  assert.equal(node.dataset.absent, "0");
  /* The tooltip accounts for both rows as provider quotes with real times. */
  assert.match(node.title, /SPY · provider quote · /);
  assert.match(node.title, /QQQ · provider quote · /);
  assert.doesNotMatch(node.title, /no observation time/);
});

test("ready but old is DATA, not LIVE — age is reported, freshness is not claimed", () => {
  const { node, paint } = paintHarness([
    { ticker:"SPY", history:"ready", quote:"ready", updatedTs:secondsAgo(600) },
  ]);
  paint();
  assert.match(node.textContent, /^DATA · 10m · /);
  assert.equal(node.dataset.fresh, "0");
  assert.equal(node.dataset.delayed, "0");
});

test("an unstamped ready row is counted as untimed, never folded into the age", () => {
  const { node, paint } = paintHarness([
    { ticker:"SPY", history:"ready", quote:"ready", updatedTs:secondsAgo(30) },
    { ticker:"BRKB", history:"ready", quote:"ready", updatedTs:null },
  ]);
  paint();
  assert.match(node.textContent, / · 1 untimed$/);
  /* The age came from the one stamped row, so the header may still be LIVE on it. */
  assert.match(node.textContent, /^LIVE · 30s · /);
  assert.match(node.title, /BRKB · provider quote · no observation time/);
});

test("a row flagged as a delayed provider feed keeps the header out of LIVE entirely", () => {
  const { node, paint } = paintHarness([
    { ticker:"SPY", history:"ready", quote:"ready", updatedTs:secondsAgo(10) },
    { ticker:"ESUSD", history:"ready", quote:"ready", updatedTs:secondsAgo(10), delayed:true },
  ]);
  paint();
  assert.equal(node.textContent, "DATA · delayed (1)");
  assert.equal(node.dataset.delayed, "1");
  assert.equal(node.dataset.fresh, "0");
});

test("recovery clears the absent flag a previous paint set", () => {
  const { node, paint, bindings } = paintHarness([
    { ticker:"TICK", history:"absent", quote:"absent", absence:"NOT_OBSERVED_BY_STREAM" },
  ]);
  paint();
  assert.equal(node.dataset.absent, "1");
  bindings.CHART_STATUS.set("TICK",
    { ticker:"TICK", history:"ready", quote:"ready", updatedTs:secondsAgo(5) });
  paint();
  assert.equal(node.dataset.absent, "0", "the absent styling does not outlive the absence");
  assert.match(node.textContent, /^LIVE · /);
});

test("every ready row without any stamp is reported as unknown, not aged from the epoch", () => {
  const { node, paint } = paintHarness([
    { ticker:"SPY", history:"ready", quote:"ready", updatedTs:null },
    { ticker:"QQQ", history:"ready", quote:"ready", updatedTs:"" },
  ]);
  paint();
  assert.equal(node.textContent, "DATA · ready · no observation time");
  assert.equal(node.dataset.fresh, "0");
  assert.equal(node.dataset.delayed, "0");
});
