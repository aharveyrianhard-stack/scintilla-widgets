/* P3, 28 Sep 2026. Alan: "the behaviour I like is not waiting for candle closes, like the TradingView
   setting." Every pane draws its FORMING bar: a flagged live point for the bucket after the last
   completed bar, drawn dashed with a hollow ring, never counted by the RSI fan, the STALE rule or the
   day baseline's completed-bar readers, and replaced by the completed provider bar at the close. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");

test("every symbol may draw a forming point - the equity-only refusal is gone", () => {
  assert.doesNotMatch(chart, /provider\.isProviderOwned\(t\)\) return pts;/);
  assert.doesNotMatch(chart, /if \(!futureSet\.has\(t\) && !cryptoSet\.has\(t\)\) return pts;/);
});

test("the forming point is drawn as forming: dashed from the last completed bar, hollow ring, recorded on the host", () => {
  assert.match(chart, /const formingIx = end === pts\.length - 1 && end > start && pts\[end\]\.live \? end : -1;/);
  assert.match(chart, /const solidEnd = formingIx >= 0 \? end - 1 : end;/);
  assert.match(chart, /ctx\.setLineDash\(\[4, 3\]\)/);
  assert.match(chart, /host\._forming = formingIx >= 0 \? \{ d: pts\[formingIx\]\.d, p: pts\[formingIx\]\.p \} : null;/);
});

test("completed-bars-only readers still skip it", () => {
  assert.match(chart, /for \(let i = pts\.length - 1; i >= 0; i--\) if \(!pts\[i\]\.live\) return pts\[i\];/);
  assert.match(chart, /const lastIx = pts\[pts\.length - 1\]\.live \? pts\.length - 2 : pts\.length - 1;/);
  assert.match(chart, /CACHE THE PURE PROVIDER SERIES FIRST/);
});

test("the pinned shell carries the same chart", () => { assert.equal(shell, chart); });
