/* ONE SOURCE (2026-09-22). Every price the Station shows comes from the chart API. This file pins
   the removal: no database client on the chart pane or the wall, the twin byte-identical to the
   pane, the provider client routing macro symbols to the API, and the identity proof that made
   the last database dependency of the price path unnecessary. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const chart = read("../chart/index.html");
const twin = read("../station-shells/chart-v1/index.html");
const deck = read("../deck/index.html");
const provider = read("../_provider/provider.js");

test("the deck mounts the twin, so the twin is byte-identical to the chart pane", () => {
  assert.equal(twin, chart);
});

test("the chart pane holds no Supabase URL, key, REST reader, client or realtime channel", () => {
  for (const bad of [/wadinxqplrggagkvrdag/, /eyJhbGciOi/, /rest\/v1\//, /createClient\(/, /supabase-js-/, /postgres_changes/, /\.channel\("lq"\)/, /async function pg\(/])
    assert.doesNotMatch(chart, bad, String(bad));
  assert.match(chart, /window\.SC_REALTIME = \{ available: false, channel: "retired",/);
});

test("the wall keeps only non-price reads: favourites and the canonical ticker list", () => {
  assert.doesNotMatch(deck, /supabase-js-|createClient\(|postgres_changes|deckSb\.channel\(/);
  const reads = [...deck.matchAll(/pg\("([a-z_]+)\?/g)].map((m) => m[1]);
  assert.ok(reads.length > 0, "the non-price reader is still used");
  for (const table of reads) assert.ok(["hub_favorites", "tickers"].includes(table), "non-price read only: " + table);
});

test("the provider client routes macro symbols to the chart API and names everything else", () => {
  assert.match(provider, /var MACRO_SYMBOLS = \{ VIX: 1, DXY: 1, US10Y: 1 \};/);
  assert.match(provider, /API \+ '\/macro\?symbols='/);
  assert.match(provider, /if \(own\[sym\] \|\| MACRO_SYMBOLS\[sym\]\)\s+return providerCandleRows\(/);
  assert.match(provider, /throw S\.absenceError\(ABSENCE_NOT_SERVED, sym/);
  assert.doesNotMatch(provider, /ohlcv_history|live_quotes\?select/);
  assert.match(provider, /provider: payload\.provider \|\| 'MASSIVE'/, "the provider the API stated travels with every candle row");
  assert.match(provider, /authority: 'RETAINED_SUPABASE_NON_EQUITY_GEIGER_ONLY'/);
});

test("ownership identity is proven from the payload digest when no canonical reader is bound", () => {
  assert.match(provider, /function universeDigest \(syms\)/);
  assert.match(provider, /subtle\.digest\('SHA-256', new TextEncoder\(\)\.encode\(JSON\.stringify\(unique\)\)\)/);
  assert.match(provider, /digest === ACCEPTED_UNIVERSE_SHA256 \? null/);
  assert.match(provider, /universe identity could not be computed/);
  assert.match(provider, /'sha256 over the ' \+ syms\.length \+ ' returned symbols equals the pinned accepted universe digest'/);
});
