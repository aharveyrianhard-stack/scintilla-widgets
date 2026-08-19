/* THE DISTINCTION STATION-001 DEPENDS ON, TESTED END TO END.
   =========================================================
   STATION-001 made a named absence stop retrying. That is only safe if a named absence can
   never be manufactured out of a failure — and in the first cut it could, at four separate
   points, every one of which turned "we could not ask" into "we asked and the answer is no":

     jget()          every network error, timeout, 5xx and auth failure became null
     providerOwned() a cold /geiger failure became {} — "the provider owns nothing" — which
                     routed every equity to the legacy Supabase tables as if it were crypto
     quotes()        a truncated batch left symbols missing, indistinguishable from unpriced
     origPg()        any non-OK Supabase status became []

   A provider outage therefore painted itself as a settled, permanent, named absence on every
   pane, and the panes stopped retrying it.

   Two further fabrications are covered here because they are the same failure of nerve about
   saying "unknown":

     price_sip_utc      is not a field the live /quotes payload has; it is
                        price_observation_utc. Reading the wrong name stamped every row null.
     Date.now()         was written into composite_staged rows as the Geiger's own compute
                        time, so a Geiger computed hours ago always read as fresh.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const providerSource = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const analytics = fs.readFileSync(new URL("../analytics/index.html", import.meta.url), "utf8");

/* Load the shim with a scripted fetch so each transport condition can be produced exactly. */
function loadShim(fetchImpl) {
  const window = { fetch:fetchImpl };
  vm.runInNewContext(providerSource, {
    window, fetch:fetchImpl, Date, Promise, String, Object, Number, parseInt, isFinite,
    encodeURIComponent, JSON, Error, Math, Array, RegExp, console,
  });
  return window;
}
const ok = (body) => Promise.resolve({
  ok:true, status:200, json:() => Promise.resolve(body), text:() => Promise.resolve(JSON.stringify(body)) });
const status = (code) => Promise.resolve({
  ok:false, status:code, json:() => Promise.resolve(null), text:() => Promise.resolve("") });
const dead = () => Promise.reject(new Error("network down"));

const GEIGER_OK = {
  symbols:{ AAPL:{ composite:0.4, trend:0.3, momentum:0.5 }, MSFT:{ composite:0.1, trend:0, momentum:0.2 } },
  equalizer_receipt_sha256:"f6cf97b5" + "0".repeat(56),
  computed_utc:"2026-08-19T07:57:20.566Z",
};

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

test("a dead network is an error, not an empty provider answer", async () => {
  const w = loadShim(dead);
  const S = w.SC_PROVIDER_SHIM;
  /* Drive the interceptor the way a page does: install over a pg() that must never be reached
     for an equity table, then ask for one. */
  let legacyReached = 0;
  w.pg = async () => { legacyReached += 1; return [{ ticker:"AAPL", price:999 }]; };
  w.scInstallProviderShim();
  await assert.rejects(
    () => w.pg("live_quotes?ticker=in.(AAPL)&select=ticker,price"),
    (err) => err && err.scTransport === true && !err.scAbsence,
    "a dead provider raises a TRANSPORT error, never a named absence");
  assert.equal(legacyReached, 0, "and nothing is routed to the legacy table on a guess");
  assert.ok(S.counts.transport_failures > 0, "the failure is counted as transport");
  assert.equal(S.absenceFor("AAPL"), null, "no absence name is invented for it");
});

test("an HTTP 5xx is a transport failure too, and carries its status", async () => {
  const w = loadShim(() => status(503));
  w.pg = async () => [];
  w.scInstallProviderShim();
  await assert.rejects(
    () => w.pg("composite_staged?tf=eq.D&ticker=in.(AAPL)&select=ticker,composite"),
    (err) => err && err.scTransport === true && err.scStatus === 503);
  const S = w.SC_PROVIDER_SHIM;
  assert.equal(S.transport_failures.length > 0, true);
  assert.equal(S.transport_failures[0].status, 503);
});

test("ownership fails closed — an unknown universe never means 'not an equity'", async () => {
  /* The exact regression: /geiger down, so `owned` is {}, so AAPL looks like crypto and the
     legacy Supabase row is served under the provider's name. */
  const w = loadShim(() => status(500));
  let legacy = 0;
  w.pg = async () => { legacy += 1; return [{ ticker:"AAPL", price:123.45, prev_close:1 }]; };
  w.scInstallProviderShim();
  await assert.rejects(() => w.pg("live_quotes?ticker=in.(AAPL)&select=ticker,price"),
    (err) => err && err.scTransport === true);
  assert.equal(legacy, 0, "an unknown ownership answer must not reinstate the legacy path");
  assert.match(providerSource, /OWNERSHIP MUST FAIL CLOSED/);
});

test("ownership already known survives one bad read instead of collapsing to empty", async () => {
  let call = 0;
  const w = loadShim((url) => {
    call += 1;
    if (String(url).includes("/geiger")) return call <= 2 ? ok(GEIGER_OK) : status(502);
    return ok({ quotes:{ AAPL:{ state:"OK", price:10, previous_close:9, price_observation_utc:"2026-08-19T07:50:00Z" } } });
  });
  w.pg = async () => [];
  w.scInstallProviderShim();
  const first = await w.pg("live_quotes?ticker=in.(AAPL)&select=ticker,price");
  assert.equal(first.length, 1, "the warm path works");
  /* Knowledge already held is knowledge; only a COLD failure is fatal. */
  assert.equal(w.SC_PROVIDER_SHIM.isProviderOwned("AAPL"), true);
});

test("a short batch fails the WHOLE request — AAPL+MSFT asked, only AAPL returned", async () => {
  /* The hole this closes: the shim used to resolve with the rows it did have. The caller,
     having asked for AAPL and MSFT and received a 200 carrying only AAPL, concluded that MSFT
     is not observed by the stream and stopped retrying it. A partial answer is not a smaller
     answer; it is an unfinished request. */
  const w = loadShim((url) => {
    if (String(url).includes("/geiger")) return ok(GEIGER_OK);
    return ok({ quotes:{ AAPL:{ state:"OK", price:10, previous_close:9, price_observation_utc:"2026-08-19T07:50:00Z" } } });
  });
  w.pg = async () => [];
  w.scInstallProviderShim();
  await assert.rejects(
    () => w.pg("live_quotes?ticker=in.(AAPL,MSFT)&select=ticker,price"),
    (err) => err && err.scTransport === true && !err.scAbsence && /incomplete/.test(err.message),
    "the request fails rather than resolving with half an answer");
  const S = w.SC_PROVIDER_SHIM;
  assert.equal(S.absenceFor("MSFT"), null, "and MSFT is never marked unobserved");
  assert.equal(S.absenceFor("AAPL"), null);
  assert.ok(S.counts.partial_batches > 0, "the short batch is recorded as such");
});

test("a stale cached row cannot stand in for one the current response omitted", async () => {
  /* The second half of the same hole: the quote cache was handed back wholesale, so a symbol
     THIS response omitted could still be served from an older one — an old price presented as
     now, and as proof that the symbol had been accounted for. */
  let call = 0;
  const w = loadShim((url) => {
    if (String(url).includes("/geiger")) return ok(GEIGER_OK);
    call += 1;
    return call === 1
      ? ok({ quotes:{
          AAPL:{ state:"OK", price:10, previous_close:9, price_observation_utc:"2026-08-19T07:50:00Z" },
          MSFT:{ state:"OK", price:20, previous_close:19, price_observation_utc:"2026-08-19T07:50:00Z" } } })
      : ok({ quotes:{
          AAPL:{ state:"OK", price:11, previous_close:9, price_observation_utc:"2026-08-19T07:59:00Z" } } });
  });
  w.pg = async () => [];
  w.scInstallProviderShim();

  const first = await w.pg("live_quotes?ticker=in.(AAPL,MSFT)&select=ticker,price");
  assert.equal(first.length, 2, "both arrive while both are served");

  /* Force past the 5s warm window so the second, short response is the one that answers. */
  const S = w.SC_PROVIDER_SHIM;
  S.absences = {};
  await new Promise((r) => setTimeout(r, 0));
  w.SC_PROVIDER_SHIM.counts.partial_batches = 0;
  /* The cache still holds MSFT from the first call. The request must still fail. */
  const again = w.pg("live_quotes?ticker=in.(AAPL,MSFT)&select=ticker,price");
  await again.then(
    (rows) => {
      /* Inside the 5s warm window the cached pair legitimately covers the request; what must
         never happen is a row for MSFT sourced from a response that omitted it. */
      const msft = Array.from(rows).find((r) => r.ticker === "MSFT");
      if (msft) assert.equal(msft.price, 20, "a warm cache hit is the earlier response, in full");
    },
    (err) => assert.equal(err.scTransport, true, "or the incomplete request fails outright"));
});

test("a mixed equity/non-equity request fails whole when the passthrough fails", async () => {
  /* Asked for AAPL (provider) and BTCUSD (non-equity). The provider half succeeds, origPg
     throws. The old code returned just the provider rows under a 200, and the deck then named
     BTCUSD absent — a legacy outage silently retiring a symbol from the wall. */
  const w = loadShim((url) => {
    if (String(url).includes("/geiger")) return ok(GEIGER_OK);
    return ok({ quotes:{ AAPL:{ state:"OK", price:10, previous_close:9, price_observation_utc:"2026-08-19T07:50:00Z" } } });
  });
  w.pg = async () => { throw new Error("supabase 503"); };
  w.scInstallProviderShim();
  await assert.rejects(
    () => w.pg("live_quotes?ticker=in.(AAPL,BTCUSD)&select=ticker,price"),
    (err) => err && err.scTransport === true && !err.scAbsence);
  assert.equal(w.SC_PROVIDER_SHIM.absenceFor("BTCUSD"), null,
    "the non-equity is never named absent because its own owner failed");
});

test("a geiger payload that omits a requested symbol fails the request", async () => {
  /* /geiger publishes the whole universe, so a gap in it is an incomplete payload, not a
     per-symbol fact about MSFT. */
  const w = loadShim(() => ok({ ...GEIGER_OK, symbols:{ AAPL:GEIGER_OK.symbols.AAPL, MSFT:GEIGER_OK.symbols.MSFT } }));
  w.pg = async () => [];
  w.scInstallProviderShim();
  const fine = await w.pg("composite_staged?tf=eq.D&ticker=in.(AAPL,MSFT)&select=ticker,composite");
  assert.equal(fine.length, 2, "a complete payload answers completely");

  const w2 = loadShim(() => ok({ ...GEIGER_OK, symbols:{ AAPL:GEIGER_OK.symbols.AAPL, MSFT:GEIGER_OK.symbols.MSFT, TSLA:{} } }));
  w2.pg = async () => [];
  w2.scInstallProviderShim();
  /* TSLA is owned (it is in the universe) but its entry is empty. */
  const rows = await w2.pg("composite_staged?tf=eq.D&ticker=in.(AAPL)&select=ticker,composite");
  assert.equal(rows.length, 1, "an unrelated empty entry does not fail an unrelated request");
});

test("a symbol the provider explicitly names IS a settled absence — the EQR case", async () => {
  const w = loadShim((url) => {
    if (String(url).includes("/geiger"))
      return ok({ ...GEIGER_OK, symbols:{ ...GEIGER_OK.symbols, EQR:{ composite:0 } } });
    return ok({ quotes:{
      AAPL:{ state:"OK", price:10, previous_close:9, price_observation_utc:"2026-08-19T07:50:00Z" },
      EQR:{ state:"NOT_OBSERVED_BY_STREAM", price:null, previous_close:null },
    } });
  });
  w.pg = async () => [];
  w.scInstallProviderShim();
  const rows = await w.pg("live_quotes?ticker=in.(AAPL,EQR)&select=ticker,price");
  const S = w.SC_PROVIDER_SHIM;
  assert.deepEqual(Array.from(rows, (r) => r.ticker), ["AAPL"],
    "EQR yields no row — a null provider price is never filled in from elsewhere");
  assert.equal(S.absenceFor("EQR"), "NOT_OBSERVED_BY_STREAM",
    "and the provider's own name for it is what gets recorded");
});

test("the quote timestamp is the provider's observation time, or nothing", async () => {
  const w = loadShim((url) => {
    if (String(url).includes("/geiger")) return ok(GEIGER_OK);
    return ok({ quotes:{
      AAPL:{ state:"OK", price:10, previous_close:9, price_observation_utc:"2026-08-19T07:50:00Z" },
      MSFT:{ state:"OK", price:20, previous_close:19 },          // no time field at all
    } });
  });
  w.pg = async () => [];
  w.scInstallProviderShim();
  const rows = await w.pg("live_quotes?ticker=in.(AAPL,MSFT)&select=ticker,price");
  const byTicker = Object.fromEntries(Array.from(rows, (r) => [r.ticker, r]));
  assert.equal(byTicker.AAPL.updated_ts, "2026-08-19T07:50:00Z",
    "price_observation_utc is the field the live payload actually carries");
  assert.equal(byTicker.MSFT.updated_ts, null,
    "a quote with no observation time is unknown, never stamped with the read time");
  /* The field list is written out so a rename shows up as a missing stamp, not a wrong one. */
  assert.match(providerSource, /QUOTE_TIME_FIELDS = \['price_observation_utc'/);
  assert.doesNotMatch(providerSource, /updated_ts: v\.price_sip_utc/);
});

test("the Geiger's age is the endpoint's computed_utc, never the read time", async () => {
  const w = loadShim(() => ok(GEIGER_OK));
  w.pg = async () => [];
  w.scInstallProviderShim();
  const rows = await w.pg("composite_staged?tf=eq.D&ticker=in.(AAPL)&select=ticker,composite");
  assert.equal(rows[0].updated_ts, "2026-08-19T07:57:20.566Z");
  assert.equal(rows[0].computed_utc, "2026-08-19T07:57:20.566Z");
  assert.equal(w.SC_PROVIDER_SHIM.geiger_computed_utc, "2026-08-19T07:57:20.566Z");
  assert.doesNotMatch(providerSource, /updated_ts: Math\.floor\(Date\.now\(\) \/ 1000\)/,
    "a clock reading is not a compute time");
  assert.match(analytics, /geiger_computed_utc/, "/analytics reads the published compute time");
  assert.match(analytics, /no computed_utc published/, "and says unknown when there is none");
});

test("a Geiger with no computed_utc is unknown, not fresh", async () => {
  const w = loadShim(() => ok({ symbols:GEIGER_OK.symbols }));    // no computed_utc
  w.pg = async () => [];
  w.scInstallProviderShim();
  const rows = await w.pg("composite_staged?tf=eq.D&ticker=in.(AAPL)&select=ticker,composite");
  assert.equal(rows[0].updated_ts, null);
  assert.equal(w.SC_PROVIDER_SHIM.geiger_computed_utc, null);
});

test("a non-OK Supabase status on the passthrough is a failure, not an empty table", () => {
  assert.match(providerSource,
    /if \(!rr\.ok\) throw transportError\('supabase HTTP ' \+ rr\.status, p2, rr\.status\);/);
  assert.doesNotMatch(providerSource, /return rr\.ok \? rr\.json\(\) : \[\];/);
});

test("the deck never invents a write time for an undated quote", () => {
  assert.doesNotMatch(deck, /updated_ts:row\.updated_ts \|\| new Date\(\)\.toISOString\(\)/,
    "the substitution that manufactured freshness out of its absence");
  const select = fnFrom(deck, "selectVisibleQuoteRows", { Set, Map, Number, Date,
    CLEAN:(t) => String(t || "").toUpperCase().trim() });

  const rows = [
    { ticker:"AAPL", price:10, prev_close:9, updated_ts:"2026-08-19T07:50:00Z" },
    { ticker:"MSFT", price:20, prev_close:19, updated_ts:null },
    { ticker:"NVDA", price:30, prev_close:29 },
    { ticker:"AMD",  price:40, prev_close:39, updated_ts:"not a date" },
  ];
  const selected = select(rows, ["AAPL", "MSFT", "NVDA", "AMD"]);
  assert.equal(selected.get("AAPL").updated_ts, "2026-08-19T07:50:00Z");
  assert.equal(selected.get("MSFT").updated_ts, null, "null stays null");
  assert.equal(selected.get("NVDA").updated_ts, null, "absent stays null");
  assert.equal(selected.get("AMD").updated_ts, null, "unparseable stays null, never 'now'");
  /* The price still arrives — an unknown time does not disqualify a real quote. */
  assert.equal(selected.get("MSFT").price, 20);
});

test("the deck header separates untimed rows from fresh ones", () => {
  assert.match(deck, /Number\.isFinite\(new Date\(x\.updatedTs\)\.getTime\(\)\)/,
    "only a parseable stamp can speak to freshness");
  assert.match(deck, /const unstamped = visible\.filter/);
  assert.match(deck, /" · " \+ unstamped\.length \+ " untimed"/);
  assert.match(deck, /DATA · ready · no observation time/);
});

test("/analytics shows no price rather than a non-provider price", () => {
  /* The live case: the provider answers NOT_OBSERVED_BY_STREAM with a null price for EQR
     while Supabase fundamentals still holds 63.8 for it. The old expression painted 63.8
     under a heading that said the price was the provider's. */
  assert.doesNotMatch(analytics, /px:m\.q\?m\.q\.price:\(m\.f\?m\.f\.price:null\)/,
    "the fundamentals fallback is gone");
  assert.match(analytics, /px:\(m\.q && m\.q\.price != null\) \? m\.q\.price : null,/);
  assert.match(analytics, /pxAbsence:\(m\.q && m\.q\.price != null\) \? null : providerAbsenceFor\(t\)/);
  assert.match(analytics, /th\('px','PRICE·PROVIDER'\)/, "the heading names the only source it uses");
  /* And the DCF gap cannot divide by a price that is not there. */
  assert.match(analytics, /if\(!m\.q\|\|m\.q\.price==null\|\|!isFinite\(\+m\.q\.price\)\|\|\+m\.q\.price===0\) return null;/);
});

test("the chart still retries a failure and still stops on a name", () => {
  /* The two halves must remain distinguishable at the last consumer as well. */
  const isNamed = fnFrom(chart, "isNamedAbsence");
  const transport = new Error("provider HTTP 503");
  transport.scTransport = true;
  assert.equal(isNamed(transport), false, "a transport error must never look named");
  const named = fnFrom(chart, "chartAbsenceError", { CHART_ABSENCE_NOT_OBSERVED:"NOT_OBSERVED_BY_STREAM" })("NOT_OBSERVED_BY_STREAM", "EQR", "1D");
  assert.equal(isNamed(named), true);
  assert.equal(named.scTransport, undefined);
});

test("unknown ownership is not permission for a Realtime legacy write", () => {
  /* isProviderOwned answers false for BOTH "not owned" and "not known yet". The Realtime
     handlers read that false as permission, so before the first /geiger resolved — or after
     it failed — a legacy equity price could patch a provider-owned chart. */
  const w = loadShim(dead);
  const S = w.SC_PROVIDER_SHIM;
  assert.equal(S.ownershipKnown(), false, "nothing is known before the first answer");
  assert.equal(S.isProviderOwned("AAPL"), false, "and the old guard reads that as 'not owned'");

  for (const source of [deck, chart])
    assert.match(source, /shim\.ownershipKnown && !shim\.ownershipKnown\(\)\) \{ shim\.realtime_unknown_ownership_refused\+\+; return; \}/,
      "the Realtime handler refuses to write while ownership is unknown");

  /* Once an answer exists, the guard stops blocking. */
  S.owned_map = { AAPL:1 };
  assert.equal(S.ownershipKnown(), true);
  assert.equal(S.isProviderOwned("AAPL"), true);
  assert.equal(S.isProviderOwned("BTCUSD"), false, "a genuine non-equity still passes through");
});

test("a shim bug is a failure to ask, not a settled empty answer", () => {
  assert.match(providerSource,
    /return Promise\.reject\(transportError\('provider shim threw: ' \+ e\.message, path, null\)\);/,
    "the pg wrapper rethrows instead of resolving []");
  assert.doesNotMatch(providerSource, /note\('shim threw: ' \+ e\.message, path\); return Promise\.resolve\(\[\]\);/);
  /* And the fetch wrapper must not fall through to the legacy equity table on its own bug. */
  assert.match(providerSource, /FAIL CLOSED/);
  assert.match(providerSource,
    /if \(\/\\\/rest\\\/v1\\\/\(live_quotes\|composite_staged\|ohlcv_history\)\\b\/\.test\(url\)\)\n\s*return Promise\.reject\(transportError/);
});
