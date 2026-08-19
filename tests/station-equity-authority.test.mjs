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

test("/health's non-equity probes are unit-correct, scoped, and bounded", () => {
  /* Three separate ways the restored rows were unsound.

     UNITS. composite_staged.updated_ts is bigint epoch SECONDS (live value 1787128860) while
     live_quotes.updated_ts is timestamptz. Marking both "ts" made new Date(1787128860) read as
     1970, so a feed one minute old reported ~55 years stale. Units are per table, verified
     against information_schema, never assumed to match.

     SCOPE. Both probes were unfiltered while labelled NON-EQUITY LANE ONLY, so the newest row
     in the whole table answered — and one fresh EQUITY row would have reported the non-equity
     lane green. Measured the same day: futures and crypto were minutes old while US10Y and VIX
     had not moved since 2026-08-14.

     COST. An unfiltered order-by on ohlcv_history returns Supabase 57014, a statement timeout;
     filtered to the roster with tf=D the same probe is an index scan, measured at 1.5ms. */
  const feeders = health.slice(health.indexOf("const FEEDERS = ["), health.indexOf("];", health.indexOf("const FEEDERS = [")));

  const composite = /t: "composite_staged",[^\n]*/.exec(feeders)[0];
  assert.match(composite, /kind: "epoch"/, "composite_staged.updated_ts is epoch seconds");
  const quotes = /t: "live_quotes",[^\n]*/.exec(feeders)[0];
  assert.match(quotes, /kind: "ts"/, "live_quotes.updated_ts is timestamptz");
  const bars = /t: "ohlcv_history",[^\n]*/.exec(feeders)[0];
  assert.match(bars, /kind: "epoch"/);
  assert.match(bars, /filt: "&tf=eq\.D"/, "and is bounded to one timeframe");

  for (const row of [composite, quotes, bars]) {
    assert.match(row, /roster: true/, "probed by name, not across the whole table");
    assert.match(row, /oldest: true/, "and reported on its oldest member");
  }

  /* The roster is named, and TICK/TRIN are deliberately not in it — they hold no rows in any
     of the three tables, which is a real gap rather than something to paper over. */
  const roster = /const NON_EQUITY_ROSTER = \[([^\]]*)\]/.exec(health)[1];
  for (const sym of ["BTCUSD", "ESUSD", "NQUSD", "CLUSD", "GCUSD", "SIUSD", "DXUSD", "US10Y", "VIX"])
    assert.ok(roster.includes(`"${sym}"`), `${sym} is a retained non-equity symbol`);
  assert.ok(!roster.includes('"TICK"') && !roster.includes('"TRIN"'),
    "symbols with no rows anywhere are not listed as healthy members");

  assert.match(health, /async function oldestOfRoster\(f\)/);
  assert.match(health, /readable\.reduce\(\(a, b\) => \(a\.minutes > b\.minutes \? a : b\)\)/,
    "the OLDEST member decides the lane, so one fresh symbol cannot hide a stale one");
  /* A HEAD count=exact on ohlcv_history is expensive and was never the question. */
  assert.match(health, /A count is\n\s*deliberately NOT taken here/);
});

test("/health lanes are independent and bounded — one stalled owner cannot hold the others", () => {
  /* runEquity was awaited before the database probes were even launched, and providerJson had
     no bound. A provider socket that opened and said nothing therefore left every Supabase row
     at "checking…" — on the one page whose whole job is to say which owner is degraded. */
  assert.match(health, /const PROVIDER_HEALTH_SOFT_MS = 4500;/);
  assert.match(health, /const PROVIDER_HEALTH_HARD_MS = 20000;/);
  assert.match(health, /signal:controller\?\.signal/);
  assert.match(health, /no response within " \+ PROVIDER_HEALTH_HARD_MS \+ "ms"/);
  assert.match(health, /const equityLane = runEquity\(\)\.catch\(\(\) => \{\}\);/,
    "the equity lane is launched, not awaited");
  assert.match(health, /const feederLane = Promise\.all\(FEEDERS\.map/);
  assert.match(health, /const stockLane = Promise\.all\(STOCK\.map/);
  assert.match(health, /const internalsLane = runInternals\(\)\.catch\(\(\) => \{\}\);/);
  assert.match(health, /await Promise\.all\(\[equityLane, internalsLane, feederLane, stockLane\]\);/,
    "each lane paints as it resolves; only the stamp waits for all of them");
  assert.doesNotMatch(health, /await runEquity\(\);/, "nothing blocks on the provider first");
});

test("/analytics emits one body cell per header column", () => {
  /* The RET column was declared in the header and never emitted in the body, so every value to
     its right sat one column left of its own label: GEIGER appeared under RET, PE under GEIGER,
     and the last column had nothing under AGE. A mislabelled number is worse than a missing
     one, because it reads as an answer. */
  /* The header is built by concatenation, so count both the literal <th> cells and the th()
     helper calls on the line that assembles it. */
  const headerLine = analytics.split("\n").find((l) => l.includes("let h='<table><tr>") && l.includes("TICKER</th>"));
  const headerCells = (headerLine.match(/<th[ >]/g) || []).length + (headerLine.match(/th\('/g) || []).length;

  const bodyLine = /h\+='<tr class="click"[^\n]*<\/tr>'\}\);/.exec(analytics)[0];
  const bodyCells = (bodyLine.match(/<td/g) || []).length;

  assert.equal(bodyCells, headerCells,
    `header declares ${headerCells} columns, body emits ${bodyCells}`);
  assert.equal(headerCells, 14, "TICKER NAME PRICE CHG RET GEIGER PE ADJ-PE EPS REV MCAP DCF β AGE");

  /* The RET cell is present and states an unknown rather than printing a blank. */
  assert.match(analytics, /r\.ret==null\?'<span class="mut">—<\/span>':fP\(r\.ret\)/);
  /* And its position is between CHG and GEIGER, matching the header order. */
  const chgAt = bodyLine.indexOf("fP(r.chg)");
  const retAt = bodyLine.indexOf("fP(r.ret)");
  const geigAt = bodyLine.indexOf("fN(r.geig,3)");
  assert.ok(chgAt < retAt && retAt < geigAt, "RET sits where its header says it does");
});

test("/analytics counts the provider's universe, not the compatibility rows", () => {
  /* S.geiger is the composite_staged COMPATIBILITY read: the provider's equities PLUS the
     retained non-equities passed through to their own owner. Counting its rows reported roughly
     387 and a +22 disagreement while the provider itself was answering with exactly 365. */
  assert.doesNotMatch(analytics, /universeAgreement\(S\.geiger && !S\.geiger\.err \? S\.geiger\.length : null\)/,
    "the mixed compatibility rows cannot answer a universe question");
  assert.match(analytics, /const o = \(window\.SC_PROVIDER_SHIM \|\| \{\}\)\.ownership;/);
  assert.match(analytics, /return o && o\.verified \? o\.count : null;/,
    "only a VERIFIED ownership answer counts");
  assert.match(analytics, /const a = universeAgreement\(owned\);/);
});

test("a failed cohort read is never presented as an empty or uncurated universe", () => {
  const readFile = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
  const events = readFile("../events/index.html");
  const heat = readFile("../heat/index.html");
  const analyticsSrc = analytics;

  /* /events turned a transport or schema failure into "no tickers in cohort X" — a statement
     about the data, and a false one. */
  assert.match(events, /catch \(err\) \{\n\s*el\("cols"\)\.innerHTML = '<div class="empty">cohort membership unavailable/);
  assert.match(events, /cohort membership read truncated/);
  assert.doesNotMatch(events, /loadMemberships\(pg\)\.catch\(\(\) => null\)/,
    "the rejection is no longer swallowed");

  /* /heat turned a failed home read into every tile UNASSIGNED, which looks like a curation gap
     rather than a broken read. */
  assert.match(heat, /loadHomeCohorts\(pg\)\.catch\(\(err\) => \(\{ err \}\)\)/);
  assert.match(heat, /COHORT HOMES UNAVAILABLE — /);
  assert.doesNotMatch(heat, /loadHomeCohorts\(pg\)\.catch\(\(\) => null\)/);

  /* /analytics excluded the cohort axis from its feed tally, so a rejected membership read left
     the connection dot green while the universe was empty. */
  assert.match(analyticsSrc, /const feeds=keys\.length\+1;/);
  assert.match(analyticsSrc, /const ok=keys\.filter\(k=>!S\[k\]\.err\)\.length\+\(cohortAxis\.err\?0:1\);/);
  assert.match(analyticsSrc, /COHORT AXIS FAILED/);
  assert.match(analyticsSrc, /S\.cohorts\.err\?'<span class="mut">cohort axis unavailable<\/span>'/);
});

test("/health keeps the mounted-but-unowned internals visible, and BAD", () => {
  /* Leaving ADD/PCC/CUMTICK/TICK/TRIN out of the roster was its own kind of silence: five
     symbols the Station actually mounts would never be asked about, so this page could go green
     while five visible panes retried forever. They get their own lane, BAD by construction
     until an owner supports them. */
  assert.match(health, /const UNSUPPORTED_INTERNALS = \["ADD", "PCC", "CUMTICK", "TICK", "TRIN"\];/);
  assert.match(health, /const INTERNALS_LANES = \[/);
  assert.match(health, /async function runInternals\(\)/);
  assert.match(health, /async function internalsPresence\(\)/);
  /* The lane is BAD whether or not a row turns up: with rows because nothing NAMES them and the
     panes still cannot settle, without because there is nothing to show. */
  const runner = health.slice(health.indexOf("async function runInternals()"),
                              health.indexOf("// severity", health.indexOf("async function runInternals()")) + 1
                              || health.indexOf("async function run()"));
  assert.doesNotMatch(runner, /set\("internals", 0, "ok"/, "this lane cannot report ok");
  assert.doesNotMatch(runner, /set\("internals", 0, "warn"/, "nor soften to warn");
  assert.match(runner, /set\("internals", 0, "bad"/);
  assert.match(health, /no owner, no rows — panes retry forever/);
  /* And they are still absent from the healthy roster, which is now a stated split rather than
     an omission. */
  const roster = /const NON_EQUITY_ROSTER = \[([^\]]*)\]/.exec(health)[1];
  for (const sym of ["ADD", "PCC", "CUMTICK", "TICK", "TRIN"])
    assert.ok(!roster.includes(`"${sym}"`), `${sym} belongs to the unowned lane, not the healthy one`);
});

test("a roster member that cannot be read makes its lane BAD, not WARN", () => {
  /* "A lane is only as healthy as its stalest member" has to bind on severity, or one readable
     sibling quietly downgrades a missing member to a warning. */
  assert.match(health, /const st = \(missing \|\| r\.minutes > f\.bad\) \? "bad" : r\.minutes > f\.warn \? "warn" : "ok";/);
  assert.doesNotMatch(health, /r\.minutes > f\.bad \? "bad" : \(r\.minutes > f\.warn \|\| missing\) \? "warn"/,
    "the old ordering let a missing member land in warn");
});

test("no touched template uses a non-quote number as a current equity price", () => {
  const readFile = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
  const fundamentals = readFile("../templates/fundamentals.html");
  const allocation = readFile("../templates/allocation-module.html");
  const dcf = readFile("../templates/dcf.html");

  /* Loading the shim did not move fundamentals' arithmetic: it never issued a quote read at all
     and took fundamentals.price — a snapshot with its own vintage — as the current price for the
     comps table, the header and the DCF upside. */
  assert.match(fundamentals, /async function providerQuotes\(symbols\)/);
  assert.match(fundamentals, /live_quotes\?select=ticker,price,prev_close,updated_ts/);
  assert.match(fundamentals, /const price=quotePriceOf\(t\)/, "comps price from the quote spine");
  assert.match(fundamentals, /price: quotePriceOf\(sym\), priceUnavailable: quotePriceOf\(sym\) == null/);
  assert.doesNotMatch(fundamentals, /const price=f\?f\.price:null/, "the snapshot is no longer a price");
  assert.doesNotMatch(fundamentals, /price: f\.price,/);
  /* And current-price math is disabled rather than computed against nothing. */
  assert.match(fundamentals, /No provider price for /);
  assert.match(fundamentals, /b\.valuationDisabled = true;/);

  /* allocation silently substituted the cohort feed's Yahoo-derived price and day change into
     the same cells, unmarked, so a provider outage read as an ordinary quiet quote. */
  assert.doesNotMatch(allocation, /\(q && q\.price != null\) \? \+q\.price : c\.price/);
  assert.doesNotMatch(allocation, /\(q && q\.chg_pct != null\) \? \(\+q\.chg_pct\)\/100 : c\.day/);
  assert.match(allocation, /const price = q \? usable\(q\.price\) : null;/);
  assert.match(allocation, /const priceSrc = price == null \? 'unavailable' : 'provider';/);
  assert.match(allocation, /nothing is substituted">unavailable<\/span>/);
  /* The local geiger is gone from every path, not merely unused. */
  assert.doesNotMatch(allocation, /FALLBACK client geiger/);
  assert.doesNotMatch(allocation, /client Yahoo geiger in use/);

  /* dcf kept July static prices and valued companies against them when the overlay missed. */
  assert.match(dcf, /TICKERS\[s\]\.priceUnavailable=true/);
  assert.match(dcf, /price unavailable — valuation disabled/);
  assert.match(dcf, /if\(BASE\.price==null\)\{/);
  assert.doesNotMatch(dcf, /ok\.price\?'LIVE':'FALLBACK'/, "a partial overlay is not simply LIVE");
});

test("the allocation module cannot crash on a symbol with no accepted composite", () => {
  const allocation = fs.readFileSync(new URL("../templates/allocation-module.html", import.meta.url), "utf8");
  /* tickerG returns a TRUTHY {g:null} when a symbol is in a cohort but the accepted composite is
     absent. `!tg` does not catch that: null + styleAdj coerces to 0, the row ranks as a neutral
     score nobody produced, and r.g.toFixed(2) then throws on render. */
  assert.match(allocation, /if \(!tg \|\| tg\.g == null \|\| !isFinite\(tg\.g\)\) return null;/);
  assert.match(allocation, /\(tg && tg\.g != null && isFinite\(tg\.g\)\)/);
  assert.match(allocation, /r\.g==null\|\|!isFinite\(r\.g\)\?'<span class="cls">unavailable<\/span>'/);
  assert.doesNotMatch(allocation, /\.map\(s => \{ const tg = tickerG\(s\); if \(!tg\) return null;/);
});
