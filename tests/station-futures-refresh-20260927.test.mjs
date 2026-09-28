/* P2 (27 Sep 2026, evening): WILL AN OPEN STATION PAGE DRAW NEW FUTURES BARS ON SUNDAY EVENING?
   A server fix is being built so the chart API returns ES/NQ/GC/BTC bars from Sunday 18:00 ET. The
   question for the client: does an already-open pane ask again, and does anything tie that to the NYSE
   session? Read-only analysis found nothing does; these pins keep it that way:
     1. every chart pane re-pulls its series once a minute, unconditionally (no market-hours gate);
     2. the in-memory copy is trusted for five minutes, so new bars land within about six minutes;
     3. a futures pane's deck quote becomes a transient point after the last completed bar on a
        Sunday evening, and a provider-owned equity never gets one.
   A headless run of the real deck (deliverables/20260927/station-fixes/harness/futures-refresh.mjs)
   showed the same thing end to end: ESUSD 30m on INTRADAY · 30M, clock Sunday 21:30 ET, drew four
   held-back bars six minutes later with no reload. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runInNewContext } from "node:vm";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const twin = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");

const liftFrom = (src, name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `declares ${name}`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
};
const line = (re) => { const m = chart.match(re); assert.ok(m, String(re)); return m[0]; };

test("every pane re-pulls its series once a minute, with no session or market-hours condition", () => {
  assert.equal(chart, twin, "chart/ and station-shells/chart-v1/ stay byte-identical");
  const repull = line(/setInterval\(\(\) => \{ const host = document\.querySelector\("#chartSlot \.sc-nchart"\); if \(host\) scChartLoad\(host\); \}, 60000\);/);
  assert.doesNotMatch(repull, /Session|marketOpen|futureSet|chInSession|weekend/i);
  const load = liftFrom(chart, "scChartLoad");
  assert.doesNotMatch(load, /chInSession|marketOpen|futureSet|chTradingDay|weekend/, "loading a series never asks what time it is");
  const fetchSeries = liftFrom(chart, "fetchChartSeries");
  assert.match(fetchSeries, /Date\.now\(\) - hit\.ts < 300000/, "the in-memory copy is trusted for five minutes, then re-read");
  assert.doesNotMatch(fetchSeries, /chInSession|marketOpen|futureSet|chTradingDay/);
});

test("a futures quote on Sunday evening becomes a transient point after Friday's last bar; an equity never does", () => {
  const code = [
    line(/const cryptoSet = new Set\(Object\.values\(CB\)\);/).replace("Object.values(CB)", "[]"),
    line(/const futureSet = new Set\(\[[^\]]*\]\);/),
    line(/const CH_RANGE_MS = \{[\s\S]*?\};/),
    liftFrom(chart, "quotePrice"), liftFrom(chart, "quoteInstant"), liftFrom(chart, "chApplyLivePoint"),
    "({ chApplyLivePoint })"
  ].join("\n");
  const owned = new Set(["SPY", "QQQ"]);
  const sandbox = { Date, Number, isFinite, Set, window: { SC_PROVIDER: { isProviderOwned: (t) => owned.has(t) } } };
  const { chApplyLivePoint } = runInNewContext(code, sandbox);
  const now = Date.parse("2026-09-28T01:40:00Z");                         // Sunday 21:40 ET
  const RealNow = Date.now;
  Date.now = () => now;
  try {
    const friday = [{ d: "2026-09-25T20:00:00.000Z", p: 7800 }, { d: "2026-09-25T20:30:00.000Z", p: 7805 }];
    const quote = { price: 7787.5, updated_ts: "2026-09-28T01:30:49Z" };
    for (const range of ["30m", "1D", "3D"]) {
      const out = chApplyLivePoint("ESUSD", friday, quote, range);
      assert.equal(out.length, 3, `ESUSD ${range}: one transient point is added`);
      assert.deepEqual(JSON.parse(JSON.stringify(out[2])), { d: "2026-09-28T01:30:49.000Z", p: 7787.5, live: true });
      assert.equal(friday.length, 2, "the completed bars are never touched");
    }
    assert.equal(chApplyLivePoint("SPY", friday, quote, "1D"), friday, "a provider-owned equity gets no transient point");
  } finally { Date.now = RealNow; }
});
