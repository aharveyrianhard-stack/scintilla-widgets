/* The old version of this file exercised the table-shaped compatibility interceptor. That
   product contract is intentionally gone. Transport-vs-absence behavior now lives on the
   explicit provider-native methods and is exercised in station-provider-native-client.test.mjs.
   These tests guard the removal boundary itself. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const provider = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");
const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const runtime = [
  "../analytics/index.html", "../chart/index.html", "../cohort/index.html",
  "../cohorts/index.html", "../compare/index.html", "../deck/index.html",
  "../geiger/index.html", "../geigerwall/index.html", "../heat/index.html",
  "../pulse/index.html", "../ranks/index.html", "../reflow/index.html",
  "../scenes/index.html", "../ticker/index.html", "../templates/allocation-module.html",
  "../templates/dcf.html", "../templates/fundamentals.html",
  "../templates/sector-rotation.html",
].map((rel) => [rel, read(rel)]);

test("the broad compatibility interceptor is physically absent", () => {
  assert.doesNotMatch(provider, /SC_PROVIDER_SHIM/);
  assert.doesNotMatch(provider, /scInstallProviderShim/);
  assert.doesNotMatch(provider, /window\.fetch\s*=/);
  assert.doesNotMatch(provider, /window\.pg\s*=/);
  assert.match(provider, /never intercepts fetch\(\), never rewrites pg\(\)/);
});

test("provider APIs are named by product result", () => {
  for (const name of ["equityQuotes", "equityGeiger", "equityCandles", "fmpDailyIndicators",
    "massiveMinuteIndicators", "dailyIndicators"])
    assert.match(provider, new RegExp(`S\\.${name} = function`), name);
  for (const name of ["quotes", "geiger", "candles"])
    assert.match(provider, new RegExp(`${name}: function`), `narrow non-equity ${name}`);
});

test("retired indicator tables have no runtime vocabulary", () => {
  assert.doesNotMatch(provider, /board_rsi|derived_series/);
  for (const [name, source] of runtime)
    assert.doesNotMatch(source, /rest\/v1\/(?:board_rsi|derived_series)|(?:pg|j|sbGet)\([^\n]*(?:board_rsi|derived_series)/,
      `${name} has no retired indicator request`);
});

test("no surface expresses a provider-owned equity request as a legacy table call", () => {
  const legacy = /rest\/v1\/(?:live_quotes|composite_staged|ohlcv_history)|(?:pg|j|sbGet|stationDbGet)\([^\n]*(?:live_quotes|composite_staged|ohlcv_history)/;
  for (const [name, source] of runtime) assert.doesNotMatch(source, legacy, name);
});

test("surviving legacy literals are limited to guarded Realtime non-equity boundaries", () => {
  const permitted = new Set(["../chart/index.html", "../deck/index.html"]);
  for (const [name, source] of runtime) {
    if (permitted.has(name)) {
      assert.match(source, /table:\s*["']live_quotes["']/,
        `${name} keeps only the guarded Realtime non-equity channel`);
      assert.match(source, /ownershipKnown\(\)/);
      assert.match(source, /isProviderOwned/);
    } else {
      assert.doesNotMatch(source, /live_quotes|composite_staged|ohlcv_history/,
        `${name} has no legacy product vocabulary`);
    }
  }
});

test("transport and named absence remain distinct public error shapes", () => {
  assert.match(provider, /err\.scTransport = true/);
  assert.match(provider, /err\.scAbsence = named/);
  assert.match(provider, /Transport failures are kept SEPARATELY from named absences/);
});

test("provider and FMP indicator authorities stay deliberately separate", () => {
  assert.match(provider, /authority: 'MASSIVE_PROVIDER_D_BAR'/);
  assert.match(provider, /authority: 'PROVIDER_EQUALIZER'/);
  assert.match(provider, /authority: 'FMP_PROVIDER_INDICATORS'/);
  assert.match(provider, /authority: 'MASSIVE_PROVIDER_INDICATORS_CURRENT'/);
  assert.match(provider, /FMP_INDICATOR_MANIFEST_SHA256/);
  assert.match(provider, /MASSIVE_INDICATOR_MANIFEST_SHA256/);
  assert.match(provider, /contracts: payload\.contracts/);
  assert.match(provider, /session_state: normalized\.session_state/);
  assert.match(provider, /macd: null/);
});
