/* STATION-004 — /analytics and /health presented legacy tables as equity authority.
   ================================================================================
   The provider cutover moved equity price, previous close and the Geiger to the provider
   contract (/quotes, /geiger, /candles?authority=provider). Measured across the full
   365-symbol universe on 2026-08-18, the legacy live_quotes baseline disagreed with the
   provider's previous close on 359 of 365 symbols and pointed the WRONG DIRECTION on 183.

   Two surfaces were left behind, in two different ways:

     /analytics never loaded _provider/provider.js at all. It reads with a bare fetch()
     rather than a pg() — which is the exact case the shim's fetch hook was written for, per
     its own header — so every equity number on the page came from the legacy tables while
     every other Station surface had moved.

     /health did not read equity as data; it ADVERTISED it. live_quotes led the page as
     "price and change for the whole board" and composite_staged as the Geiger, both graded
     for freshness, on a page whose whole job is to say what is true.

   The contract under test: no surface may present a legacy equity table as authority, and a
   universe that disagrees with the canonical 365 must be shown disagreeing rather than
   quietly adopted.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const analytics = fs.readFileSync(new URL("../analytics/index.html", import.meta.url), "utf8");
const health = fs.readFileSync(new URL("../health/index.html", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");

const LEGACY_EQUITY_TABLES = ["live_quotes", "composite_staged", "ohlcv_history"];

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

test("/analytics routes every equity read through the provider authority shim", () => {
  assert.match(analytics, /<script src="\/_provider\/provider\.js"><\/script>/,
    "the shim must load before the page issues anything — this tag was simply absent");
  /* The shim hooks fetch as well as pg(), and this page only has fetch. Its tag must come
     before the page's own script, or the first burst of reads escapes the hook. */
  const shimAt = analytics.indexOf('<script src="/_provider/provider.js">');
  const pageAt = analytics.indexOf("const SB='https://wadinxqplrggagkvrdag.supabase.co/rest/v1'");
  assert.ok(shimAt > -1 && pageAt > shimAt, "the shim is installed before the page's own reads");
});

test("neither surface claims a legacy equity table as authority in what it says", () => {
  /* Prose is the defect here as much as the queries are: /health graded live_quotes as
     "price and change for the whole board" on a page whose job is to say what is true. */
  const CLAIMS = [
    /price and change for the whole board/i,
    /Geiger = <b>composite_staged<\/b>/i,
    /TA-surface source of truth/i,
    /PRICE = live_quotes/i,
    /PRICE-BASIS PROOF/i,
  ];
  for (const claim of CLAIMS) {
    assert.doesNotMatch(analytics, claim, `/analytics still claims: ${claim}`);
    assert.doesNotMatch(health, claim, `/health still claims: ${claim}`);
  }
  /* And both must say what the authority actually is. */
  for (const [name, source] of Object.entries({ "/analytics":analytics, "/health":health })) {
    assert.match(source, /scintilla-massive-chart-api/, `${name} names the provider contract`);
    assert.match(source, /\/quotes/, `${name} names the quote endpoint`);
    assert.match(source, /\/geiger/, `${name} names the geiger endpoint`);
  }
});

test("/health grades the legacy tables as the non-equity lane, under a true label", () => {
  const feeders = health.slice(health.indexOf("const FEEDERS = ["), health.indexOf("];", health.indexOf("const FEEDERS = [")));
  const stock = health.slice(health.indexOf("const STOCK = ["), health.indexOf("];", health.indexOf("const STOCK = [")));
  /* Removing them outright was an over-correction. The shim passes every symbol the provider
     does NOT own — crypto, futures, indices, rates — straight through to these tables, so they
     are the live owner of the non-equity lane and a stale one is a real outage on real panes.
     What had to go was the claim that they are the board's price and the Geiger. */
  for (const table of LEGACY_EQUITY_TABLES) {
    const row = new RegExp(`t: "${table}",[^\n]*`).exec(feeders);
    assert.ok(row, `${table} is still monitored`);
    assert.match(row[0], /nonEquity: true/, `${table} is labelled as the non-equity lane`);
    assert.doesNotMatch(row[0], /whole board|the Geiger"/i, `${table} makes no equity claim`);
    assert.doesNotMatch(stock, new RegExp(`t: "${table}"`), `${table} is not counted as equity stock`);
  }
  assert.match(health, /NON-EQUITY LANE ONLY/, "and the page prints the distinction");
  /* The non-equity lanes must survive — this repair is not "delete rows until it is green". */
  for (const kept of ["spine_events", "feed_alerts", "youtube_feed", "news"])
    assert.match(feeders, new RegExp(`t: "${kept}"`), `${kept} is an explicit non-equity lane and must remain`);
  for (const kept of ["ticker_cohorts", "hub_favorites", "earnings_events", "econ_calendar", "youtube_feed"])
    assert.match(stock, new RegExp(`t: "${kept}"`), `${kept} is an explicit non-equity lane and must remain`);
  /* And an equity lane must exist, asked of the contract that owns it. */
  assert.match(health, /const PROVIDER_API = "https:\/\/scintilla-massive-chart-api\.fly\.dev";/);
  assert.match(health, /const EQUITY_LANES = \[/);
  assert.match(health, /async function runEquity\(\)/);
});

test("a universe that disagrees with the canonical 365 is shown disagreeing", () => {
  for (const [name, source] of Object.entries({ "/analytics":analytics, "/health":health })) {
    assert.match(source, /CANONICAL_EQUITY_UNIVERSE = 365/, `${name} carries the canonical number`);
    const agree = fnFrom(source, "universeAgreement", { CANONICAL_EQUITY_UNIVERSE:365, isFinite, Math });

    const exact = agree(365);
    assert.equal(exact.state, "agrees", `${name}: 365 agrees`);
    assert.equal(exact.delta, 0);

    /* The defect was a surface quietly presenting a different universe. Both directions of
       disagreement must surface, not just a shortfall. */
    const short = agree(211);
    assert.equal(short.state, "disagrees", `${name}: 211 disagrees`);
    assert.equal(short.delta, -154);
    assert.equal(short.expected, 365);

    const over = agree(400);
    assert.equal(over.state, "disagrees", `${name}: 400 disagrees`);
    assert.equal(over.delta, 35);

    /* No answer is its own state and is never reported as agreement. */
    for (const nothing of [null, undefined, NaN, Infinity]) {
      const unknown = agree(nothing);
      assert.equal(unknown.state, "unknown", `${name}: ${nothing} is unknown, not agreement`);
      assert.equal(unknown.count, null);
    }
  }
});

test("/analytics stops deriving a return window from legacy equity bars", () => {
  /* The old line built 'rest/v1/ohlcv_history?...' and appended it to an SB that already
     ended in /rest/v1, so it 404'd on every load — the window has been dead, not working. */
  assert.doesNotMatch(analytics, /'rest\/v1\/ohlcv_history\?/,
    "the doubled /rest/v1 prefix is gone");
  /* And when the provider cannot serve a whole-universe window, the page says so by name
     rather than filling the column from the legacy bar table. */
  assert.match(analytics, /RETURN unavailable/);
  assert.match(analytics, /a whole-universe '\+TF\+' window is not served/);
});

test("/analytics no longer overlays two legacy bar tables as a basis claim", () => {
  assert.doesNotMatch(analytics, /eod_adjusted\?select/, "the legacy adjusted table is no longer read");
  assert.doesNotMatch(analytics, /adj_c/, "and none of its columns are drawn");
  assert.doesNotMatch(analytics, /source=eq\.FMP/, "no vendor-pinned legacy bar filter survives");
  /* The drawer still draws something real: the provider's completed daily closes. */
  assert.match(analytics, /PROVIDER, COMPLETED DAILY BARS/);
  assert.match(analytics, /no completed provider bars for/,
    "an empty provider series is stated, not left as a blank canvas");
});

test("the shim's own rules are intact — no silent fallback, non-equities keep their owner", () => {
  assert.match(provider, /NO SILENT FALLBACK/);
  assert.match(provider, /NON-EQUITIES KEEP THEIR OWNER/);
  assert.match(provider, /legacy_equity_calls/,
    "a legacy equity call remains a visible breach rather than a silent one");
  /* The three tables the shim owns are exactly the three legacy equity tables. */
  for (const table of LEGACY_EQUITY_TABLES)
    assert.match(provider, new RegExp(`p\\.table === '${table}'`), `${table} is intercepted`);
});
