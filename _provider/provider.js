/* SCINTILLA STATION — EXPLICIT PROVIDER-NATIVE CLIENT
   ===================================================
   Station calls this client by product result: equityQuotes, equityGeiger, equityCandles,
   fmpDailyIndicators and massiveMinuteIndicators. The client never intercepts fetch(), never rewrites pg(),
   and never makes an obsolete table-shaped request mean provider truth.

   Equity price, previous close and completed candles come from Massive. Geiger comes from the
   accepted Massive provider-bar artifact under the exact Equalizer receipt. Raw daily technical
   indicators come from the FMP provider indicator index with provider date and FORMING/SETTLED
   provenance intact. Current Massive-native minute indicators come from the bounded provider
   endpoint. The two catalogs remain separate and never feed or substitute for each other.

   Retained non-equity Supabase ownership is exposed only through SC_NON_EQUITY. Its three narrow
   adapters are named quotes, geiger and candles, verify that no provider-owned symbol can pass,
   and are never used as an equity fallback.

   RULES:
     - NO SILENT FALLBACK. Missing or failed provider data is named and remains unavailable.
     - OWNERSHIP FAILS CLOSED. The provider universe must exactly match the canonical 365 symbols.
     - NOTHING IS RECOMPUTED HERE except the quote change and percentage from the provider's own
       price and previous completed daily close. Indicators and bars remain provider-native.
*/
(function () {
  'use strict';
  var API = 'https://scintilla-massive-chart-api.fly.dev';

  var S = window.SC_PROVIDER = {
    api: API,
    bound: false,
    equalizer_receipt: null,
    counts: { quotes: 0, geiger: 0, candles: 0, indicators: 0, passthrough_non_equity: 0, unsatisfied: 0,
              transport_failures: 0, partial_batches: 0, slow_reads: 0 },
    unsatisfied: [],
    /* Transport failures are kept SEPARATELY from named absences. One is "we could not ask",
       the other is "we asked and the answer was no". A single list would lose that. */
    transport_failures: [],
    /* The provider's own compute time for the Geiger, carried verbatim. Null means unknown -
       never a stand-in read from this machine's clock. */
    geiger_computed_utc: null,
    /* Whether the last Geiger payload was computed under the accepted equalizer. Null until a
       read has happened; false is a hard stop, not a note. */
    equalizer_accepted: null,
    /* Set by a page that wants to hear when a provider read passes the SOFT threshold, so it
       can paint delayed and keep retrying while the request continues. Assigning this is the
       whole subscription; the client never cancels on its account. */
    onSlowRead: null,
    /* What is known about the ownership universe, and whether it was VERIFIED complete. Any
       surface that wants to show the universe reads this rather than counting rows it happens
       to have received. */
    ownership: { verified: false, count: null, expected: null, reason: 'not yet read' },
    /* SYNCHRONOUS MEMBERSHIP FOR NON-FETCH CALL SITES.
       The provider client cannot see Supabase REALTIME, which delivers rows over a WebSocket and
       never calls fetch at all. deck's station-deck-lq channel and chart's lq channel both wrote
       equity prices straight into the render path, bypassing every guard in this file - and
       transport diagnostics stayed empty the whole time, which made the provider path look clean while a
       legacy price moved a provider-owned symbol. Those handlers need an ANSWER NOW, not a
       promise, so the owned map is published here as it resolves. */
    owned_map: null,
    isProviderOwned: function (sym) {
      var m = window.SC_PROVIDER.owned_map;
      return !!(m && m[String(sym || '').toUpperCase()]);
    },
    /* THE THIRD STATE THE REALTIME GUARDS WERE MISSING.
       isProviderOwned answers false both for "the provider does not own this" and for "we do
       not know yet" - and the Realtime handlers treated false as permission to write a legacy
       price. Before the first /geiger resolves, or after it fails, that let a legacy equity
       price patch a provider-owned chart: the exact bypass those guards exist to close, open
       during the window they are most needed. Ownership is knowledge or it is nothing. */
    ownershipKnown: function () {
      var S2 = window.SC_PROVIDER;
      /* Verified, not merely present. A partial map is not knowledge. */
      return !!(S2.ownership && S2.ownership.verified && S2.owned_map && Object.keys(S2.owned_map).length);
    },
    realtime_unknown_ownership_refused: 0,
    realtime_equity_refused: 0,
    realtime_nonequity_passthrough: 0,

    /* NAMED ABSENCE, IN TWO SEPARATE LANES.
       `unsatisfied` is a rolling diagnostic log capped at 40 entries; it cannot answer "why is
       THIS pane empty" once the log has rolled, so a name a caller can paint is kept here.

       THE LANES DO NOT TOUCH. A quote absence is about a symbol; a history absence is about a
       symbol on one timeframe. Writing both keys for every absence made them one lane wearing
       two names: a candle answer of TIMEFRAME_NOT_MAPPED on MU/3h wrote MU as well, so MU's
       PRICE then read as a named absence it had never been given - and a later successful
       candle read on any timeframe deleted MU, erasing a real quote absence that was still
       true. Each lane now writes and clears only its own key.

         quote absence           -> "SYM"
         history/candle absence  -> "SYM|TF"   (tf is required; without one there is no lane) */
    absences: {},
    absenceFor: function (sym, tf) {
      var a = window.SC_PROVIDER.absences;
      var key = String(sym || '').toUpperCase();
      /* Asking about a timeframe asks the history lane only. Asking without one asks the quote
         lane only. Neither answers for the other. */
      return tf ? (a[key + '|' + String(tf)] || null) : (a[key] || null);
    },
    noteAbsence: function (sym, tf, reason) {
      var a = window.SC_PROVIDER.absences;
      var key = String(sym || '').toUpperCase();
      var named = String(reason || 'NOT_OBSERVED_BY_STREAM');
      if (tf) a[key + '|' + String(tf)] = named; else a[key] = named;
      return named;
    },
    clearAbsence: function (sym, tf) {
      var a = window.SC_PROVIDER.absences;
      var key = String(sym || '').toUpperCase();
      if (tf) delete a[key + '|' + String(tf)]; else delete a[key];
    }
  };

  /* The canonical names. NOT_OBSERVED_BY_STREAM is the stream's own answer for a symbol it
     does not carry; the other two describe an ask this surface cannot form, which is a
     different fact and is not disguised as the first. */
  var ABSENCE_NOT_OBSERVED = 'NOT_OBSERVED_BY_STREAM';
  var ABSENCE_TIMEFRAME_NOT_MAPPED = 'TIMEFRAME_NOT_MAPPED';
  var ABSENCE_TICKER_FILTER_REQUIRED = 'TICKER_FILTER_REQUIRED';
  var ABSENCE_INDICATOR_BASIS = 'INDICATOR_BASIS_NOT_VERIFIED';
  var INDICATOR_UNIVERSE_SHA256 =
    '7ad595cc4db5e1fd0bb63bb3780ac1450a938e6fa068df944aeec71445556063';
  var FMP_INDICATOR_MANIFEST_SHA256 =
    'f0732502ff280b40920cb6ededc6cff0965eaaf971688aa66c7fa9647f2b04e7';
  var MASSIVE_INDICATOR_MANIFEST_SHA256 =
    '2879b00ec0b681cdfd8055b252a425a52e9cffa016d83c8a76f29f429bcbc111';
  /* Exact owner-accepted catalogs. A missing contract is represented individually as
     NAMED_UNAVAILABLE. The whole snapshot is never thrown away merely because a newly listed
     equity has too little completed history for (for example) SMA 200. */
  var FMP_DAILY_INDICATOR_SPECS = [
    ['fmp.ema.5.daily','ema',5], ['fmp.ema.8.daily','ema',8],
    ['fmp.ema.13.daily','ema',13], ['fmp.ema.21.daily','ema',21],
    ['fmp.ema.34.daily','ema',34], ['fmp.sma.50.daily','sma',50],
    ['fmp.sma.100.daily','sma',100], ['fmp.sma.150.daily','sma',150],
    ['fmp.sma.200.daily','sma',200], ['fmp.wma.20.daily','wma',20],
    ['fmp.dema.20.daily','dema',20], ['fmp.tema.20.daily','tema',20],
    ['fmp.rsi.14.daily','rsi',14],
    ['fmp.standarddeviation.20.daily','standarddeviation',20],
    ['fmp.williams.14.daily','williams',14], ['fmp.adx.14.daily','adx',14]
  ].map(function (x) { return { id:x[0], family:x[1], period_length:x[2],
    key:x[1] + ':' + x[2] }; });
  var MASSIVE_MINUTE_INDICATOR_IDS = [
    'massive.sma.close.50.minute.adjusted',
    'massive.sma.close.100.minute.adjusted',
    'massive.sma.close.150.minute.adjusted',
    'massive.sma.close.200.minute.adjusted',
    'massive.ema.close.5.minute.adjusted',
    'massive.ema.close.8.minute.adjusted',
    'massive.ema.close.13.minute.adjusted',
    'massive.ema.close.21.minute.adjusted',
    'massive.ema.close.34.minute.adjusted',
    'massive.macd.close.12-26-9.minute.adjusted',
    'massive.rsi.close.14.minute.adjusted'
  ];

  /* One place builds the named-absence error, so every call site raises the same shape and a
     caller can tell "the stream said no" from "the read fell over" with one property. */
  S.absenceError = function (reason, sym, tf) {
    var named = S.noteAbsence(sym, tf, reason);
    var err = new Error(named);
    err.scAbsence = named;
    err.scTicker = sym == null ? null : String(sym).toUpperCase();
    err.scRange = tf == null ? null : String(tf);
    return err;
  };

  // ---- caches. Short TTLs matching each route's own cache-control. -----------------------------
  /* ONE CLOCK FOR MANY SYMBOLS WAS THE BUG.
     `qCache.at` was a single receipt time for the whole map, refreshed by ANY successful
     fetch. So a batch for AAPL at 10:00:05 renewed the apparent freshness of an MU row read at
     09:00:00, and the warm path then served that hour-old price as a five-second-old one. On a
     rotating wall - which is every Station wall - that is not an edge case, it is the normal
     path. Each symbol now carries its own receipt time and is judged on it alone. */
  var qCache = { map: {}, at: {} }, gCache = { at: 0, map: null }, gDetailCache = {}, ownedAt = 0, owned = null,
      ownedFlight = null, ownedController = null, ownedWaiters = 0, ownedSticky = false;

  /* A FAILED READ IS NOT AN EMPTY ANSWER.
     jget used to swallow every network error, timeout, 5xx and auth failure into `null`, and
     each caller then turned that null into an empty result. Downstream, an empty result is
     indistinguishable from "the stream does not carry this" - so a provider OUTAGE painted
     itself as a settled, permanent, named absence, and the surfaces stopped retrying it. The
     two must stay apart from here all the way to the pane, so transport failure is raised as
     a typed error and never converted into data. */
  function transportError (why, url, status) {
    var err = new Error(why);
    err.scTransport = true;
    err.scStatus = status == null ? null : status;
    err.scUrl = String(url || '').slice(0, 200);
    S.counts.transport_failures++;
    if (S.transport_failures.length < 40) S.transport_failures.push({ why: why, status: err.scStatus, url: err.scUrl });
    return err;
  }
  /* SLOW IS NOT DEAD, AND A HARD BOUND MUST NOT SAY IT IS.
     A request that never settles left the deck's in-flight flag set forever - no timeout, no
     rejection, no retry, and a wall that never moved again. So a bound is needed. But the first
     bound was a single 4.5s hard abort, and measurement says that is the wrong shape: five
     read-only /quotes probes returned 200 with time-to-first-byte of 0.84s, 6.86s, 1.27s, 2.71s
     and 0.27s. One in five valid reads was over 4.5s, so a hard abort there would have called a
     working provider unreachable a fifth of the time - manufacturing an outage out of latency.

     Two thresholds, doing two different jobs:

       SOFT (4.5s)  the UI's patience. The pane says delayed and starts retrying, because after
                    four and a half seconds a reader deserves to be told something. The request
                    is NOT cancelled: if it lands before the hard bound, its answer is used and
                    the pane recovers. A slow read is still a read.

       HARD (20s)   the ceiling that guarantees settlement. Chosen at roughly 3x the slowest
                    observed good response, so ordinary tail latency stays inside it and a
                    genuinely dead socket cannot hold a request open forever.

     A caller's own signal still cancels immediately - the caller's intent outranks both. */
  var PROVIDER_SOFT_MS = 4500;
  var PROVIDER_HARD_MS = 20000;
  function jget (url, signal, onSlow) {
    var controller = typeof AbortController === 'undefined' ? null : new AbortController();
    var settled = false;
    var hard = controller ? setTimeout(function () { controller.abort(); }, PROVIDER_HARD_MS) : null;
    var soft = setTimeout(function () {
      if (settled) return;
      S.counts.slow_reads++;
      /* Reported, not cancelled. The caller may paint delayed and retry while this continues.
         `onSlow` is the per-call hook; `S.onSlowRead` is the page-wide one, so a surface that
         does not thread a callback through every call site still hears about a late read. */
      if (typeof onSlow === 'function') { try { onSlow(url); } catch (e) {} }
      if (typeof S.onSlowRead === 'function') { try { S.onSlowRead(url); } catch (e) {} }
    }, PROVIDER_SOFT_MS);
    var done = function () { settled = true; if (hard) clearTimeout(hard); clearTimeout(soft); };
    /* A caller's own signal aborts this read outright; it is intent, not impatience.
       AND AN ALREADY-ABORTED SIGNAL IS STILL AN ABORT. Registering a listener only catches an
       abort that happens LATER, so a signal aborted before the read started was never noticed:
       the request then ran to the 20s hard bound while its caller had long since given up. That
       is reachable through the warm-ownership path, where providerOwned resolves from a cached
       map without touching the signal and the very next call inherits it already aborted. */
    if (signal && signal.aborted) {
      done();
      return Promise.reject(transportError('provider unreachable: cancelled by the caller', url, null));
    }
    if (signal && controller && typeof signal.addEventListener === 'function')
      signal.addEventListener('abort', function () { controller.abort(); }, { once: true });
    return fetch(url, controller ? { signal: controller.signal } : undefined).then(function (r) {
      return r;
    }, function (e) {
      done();
      var aborted = e && e.name === 'AbortError';
      var why = !aborted ? ((e && e.message) || 'network')
        : (signal && signal.aborted ? 'cancelled by the caller'
                                    : 'no response within ' + PROVIDER_HARD_MS + 'ms');
      throw transportError('provider unreachable: ' + why, url, null);
    }).then(function (r) {
      if (!r.ok) { done(); throw transportError('provider HTTP ' + r.status, url, r.status); }
      /* The bound covers the BODY too - headers arriving is not an answer. */
      return r.json().then(function (j) { done(); return j; }, function () {
        done();
        throw transportError('provider body was not JSON', url, r.status);
      });
    });
  }

  /* OWNERSHIP MUST FAIL CLOSED, AND "PRESENT" IS NOT "COMPLETE".
     Two versions of the same fail-open lived here. The first resolved a cold /geiger failure to
     {}, and an empty ownership map means "the provider owns nothing" - so every equity looked
     like a non-equity and went straight to the legacy Supabase tables, silently reinstating the
     exact data path this client exists to close.

     The second was subtler and survived the first repair: ANY payload carrying a `symbols`
     object was accepted, including an empty or partial one. A response listing 12 symbols
     published a 12-symbol ownership map, and the other 353 equities were then classified as
     non-equities and routed to legacy. The completeness check on the Geiger payload could not
     catch it, because the list of symbols it checked was derived from the very same truncated
     map - it was asking the answer to confirm itself.

     So the map must be VERIFIED COMPLETE before it is allowed to classify anything. The
     provider's universe is a known size; a payload of any other size is a disagreement, and a
     disagreement fails closed with a named reason rather than quietly becoming the new truth.
     EXPECTED_EQUITY_UNIVERSE is an editable default: when the provider's universe genuinely
     changes, this is the one line to move, and moving it is a deliberate act rather than
     something that happens to a wall at 04:00.

     A previously VERIFIED map still survives a bad read - that is knowledge, not a guess. */
  var EXPECTED_EQUITY_UNIVERSE = 365;
  /* CARDINALITY IS NOT IDENTITY, AND THE CANONICAL SET IS DERIVABLE.
     Checking only that the payload holds 365 symbols passes a set of the RIGHT SIZE and the
     WRONG MEMBERS: drop AAPL, add TICK, and the count still says 365 while AAPL is quietly
     reclassified as a non-equity and routed to the legacy tables - the exact failure the count
     check was added to stop, wearing a valid-looking number.

     The accepted identity is every ACTIVE ticker whose type is not crypto, future, index or
     rate. Measured 2026-08-19: 387 active less 22 excluded is exactly the 365 the provider
     publishes, missing [] and extra [], under equalizer receipt f6cf97b5…97ad1. So the check is
     a set comparison against a source the provider does not control. */
  /* NOT IN IS NULL-BLIND, AND MOST OF THIS UNIVERSE HAS A NULL TYPE.
     `type=not.in.(...)` compiles to SQL NOT IN, which is NULL - never true - for a NULL type. 90
     of the 387 active tickers have no type recorded, AAPL among them, so that filter returned
     275 and would have failed ownership for the entire Station on every cold start while the
     provider was answering correctly with 365. NULL is stated explicitly:
     365 = 275 typed-and-allowed + 90 untyped. Verified against the live table. */
  var CANONICAL_EQUITY_QUERY =
    'tickers?select=ticker&active=eq.true&or=(type.is.null,type.not.in.(crypto,future,index,rate))&order=ticker.asc&limit=1000';

  /* THE ACCEPTED EQUALIZER, IN FULL.
     The receipt was recorded and displayed but never checked, so a payload computed under ANY
     equalizer was admitted as long as its symbol set matched - and the symbol set says nothing
     about the weights the composite was built from. Two runs over identical symbols under
     different equalizers are different numbers wearing the same name, which is exactly the
     confusion this client exists to end.

     The digest is compared in full. A prefix comparison would pass the very fixtures that
     proved the hole. Wrong or missing fails closed: no ownership, no classification, and
     /health cannot grade the lane OK. */
  var ACCEPTED_EQUALIZER_SHA256 =
    'f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1';
  function equalizerAccepted (receipt) {
    return typeof receipt === 'string' &&
           receipt.toLowerCase() === ACCEPTED_EQUALIZER_SHA256;
  }
  function waitForOwnership (promise, signal) {
    /* A caller without a cancellation signal deliberately keeps the shared proof alive. Signal
       callers are counted so one cancelled pane cannot abort everybody else's proof, while the
       last cancelled waiter can still tear down a dead fetch instead of leaving its 20s timer
       alive after the page has stopped caring. */
    if (!signal) { ownedSticky = true; return promise; }
    if (signal.aborted)
      return Promise.reject(transportError('provider unreachable: cancelled by the caller', API + '/geiger', null));
    ownedWaiters++;
    return new Promise(function (resolve, reject) {
      var done = false;
      var finish = function (fn, value, cancelledByCaller) {
        if (done) return;
        done = true;
        ownedWaiters = Math.max(0, ownedWaiters - 1);
        signal.removeEventListener('abort', cancelled);
        if (cancelledByCaller && !ownedWaiters && !ownedSticky && ownedController)
          ownedController.abort();
        fn(value);
      };
      var cancelled = function () {
        finish(reject, transportError('provider unreachable: cancelled by the caller', API + '/geiger', null), true);
      };
      signal.addEventListener('abort', cancelled, { once: true });
      promise.then(function (value) { finish(resolve, value, false); },
                   function (error) { finish(reject, error, false); });
    });
  }
  function providerOwned (signal, origPg) {
    /* A warm map is knowledge and may answer without a read - but not for a caller who has
       already cancelled. Returning it here let the next call receive an aborted signal and run
       on regardless. */
    if (signal && signal.aborted)
      return Promise.reject(transportError('provider unreachable: cancelled by the caller', API + '/geiger', null));
    if (owned && Date.now() - ownedAt < 300000) return Promise.resolve(owned);
    /* A cold page can mount dozens of panes at once. They all need the SAME ownership fact, not
       dozens of simultaneous /geiger + canonical-set handshakes. Share the in-flight proof while
       keeping each caller's abort local to its own wait; one cancelled pane cannot cancel the
       verification every other pane is awaiting. */
    if (ownedFlight) return waitForOwnership(ownedFlight, signal);
    var fail = function (why, count) {
      S.ownership = { verified: false, count: count == null ? null : count,
                      expected: EXPECTED_EQUITY_UNIVERSE, reason: why };
      if (owned) return owned;                      // a verified map survives one bad answer
      throw transportError('provider ownership ' + why, API + '/geiger', null);
    };
    /* Read through the PAGE's own reader, so the provider client needs no credentials of its own. A
       failure here is fatal to a cold ownership map: the canonical set is the independent
       identity authority, and cardinality alone cannot prove membership. */
    var canonical = typeof origPg === 'function'
      ? origPg(CANONICAL_EQUITY_QUERY).then(function (rows) {
          return Array.isArray(rows)
            ? rows.map(function (r) { return String(r && r.ticker || '').toUpperCase(); }).filter(Boolean)
            : null;
        }, function () { return null; })
      : Promise.resolve(null);

    ownedController = typeof AbortController === 'undefined' ? null : new AbortController();
    ownedWaiters = 0;
    ownedSticky = false;
    var flight = Promise.all([jget(API + '/geiger', ownedController && ownedController.signal), canonical]).then(function (a) {
      var j = a[0], canon = a[1];
      var syms = j && j.symbols
        ? Object.keys(j.symbols).map(function (k) { return String(k).toUpperCase(); })
        : null;
      if (!syms) return fail('payload carried no symbols', null);
      if (!syms.length) return fail('payload listed no symbols', 0);
      /* The equalizer the composite was computed under, checked before the symbols are trusted
         to mean anything. */
      if (!equalizerAccepted(j.equalizer_receipt_sha256))
        return fail('equalizer receipt ' + (j.equalizer_receipt_sha256
          ? 'not the accepted digest (' + String(j.equalizer_receipt_sha256).slice(0, 12) + '…)'
          : 'absent'), syms.length);

      var next = {};
      syms.forEach(function (k) { next[k] = 1; });

      if (canon && canon.length) {
        /* IDENTITY, NOT CARDINALITY. A same-size swap - drop AAPL, add TICK - leaves the count
           untouched and fails here on membership, which is the case a count can only catch by
           luck. */
        var canonMap = {};
        canon.forEach(function (k) { canonMap[k] = 1; });
        var missing = canon.filter(function (k) { return !next[k]; });
        var extra = syms.filter(function (k) { return !canonMap[k]; });
        if (missing.length || extra.length)
          return fail('universe identity: missing [' + missing.slice(0, 8).join(',') + '] extra [' +
                      extra.slice(0, 8).join(',') + ']', syms.length);
      } else {
        /* NO CANONICAL SET, NO COLD VERIFICATION.
           Falling back to a bare count here reopened the exact hole the set comparison closes -
           drop AAPL, add TICK, and 365 is still 365 - and it did so precisely when Supabase was
           unavailable, which is not a moment to relax a check. A cold ownership map requires
           identity. Unverified stays unverified, which means retryable and delayed, never
           accepted on a count. */
        return fail('canonical set unavailable, so identity could not be verified' +
                    (syms.length === EXPECTED_EQUITY_UNIVERSE ? ' (count alone is not identity)' : ''),
                    syms.length);
      }

      owned = next;
      S.owned_map = owned;
      ownedAt = Date.now();
      S.equalizer_receipt = j.equalizer_receipt_sha256;
      S.geiger_computed_utc = j.computed_utc || null;
      S.ownership = { verified: true, count: syms.length, expected: EXPECTED_EQUITY_UNIVERSE,
                      reason: null, equalizer_receipt: j.equalizer_receipt_sha256 || null,
                      /* Stated so a reviewer can see what "verified" actually compared. */
                      /* Only one way to become verified, so this cannot describe a weaker one. */
                      identity: 'exact set match against ' + canon.length +
                                ' canonical active tickers (type null, or not crypto/future/index/rate)' };
      return owned;
    }, function (e) {
      if (owned) return owned;                      // warm knowledge survives one bad read
      S.ownership = { verified: false, count: null, expected: EXPECTED_EQUITY_UNIVERSE,
                      reason: 'ownership read failed: ' + (e && e.message || 'unknown') };
      throw e;                                      // cold failure stays a failure
    });
    ownedFlight = flight.then(function (value) {
      ownedFlight = null;
      ownedController = null;
      ownedWaiters = 0;
      ownedSticky = false;
      return value;
    }, function (error) {
      ownedFlight = null;
      ownedController = null;
      ownedWaiters = 0;
      ownedSticky = false;
      throw error;
    });
    return waitForOwnership(ownedFlight, signal);
  }

  /* THE PROVIDER'S OWN OBSERVATION TIME, OR NOTHING.
     ONE field, and it is the one the live /quotes payload carries: `price_observation_utc`.
     The field the earlier compatibility layer read, `price_sip_utc`, is not on the payload at all, so
     every row was stamped null - and null then travelled into surfaces that read
     `new Date(null)` as the epoch and called it a finite timestamp.

     A tolerant list of near-miss names was worse, not better. Every other candidate was a
     guess, and accepting a guess as interchangeable with the authority field means a genuine
     rename gets papered over by whichever alias happens to be present, with no way to tell
     the two apart afterwards. If the authority field is absent, the time is unknown - which
     is a fact, and a visible one. */
  var QUOTE_TIME_FIELD = 'price_observation_utc';
  function quoteObservedAt (q) {
    if (!q) return null;
    var v = q[QUOTE_TIME_FIELD];
    if (v == null || v === '') return null;
    return isFinite(new Date(v).getTime()) ? v : null;
  }

  /* A BATCH THAT COMES BACK SHORT IS NOT A SET OF NAMED ABSENCES.
     The provider names an absence per symbol - EQR answers NOT_OBSERVED_BY_STREAM with a null
     price, and that IS settled. A symbol the response never mentions is a different thing: the
     batch was incomplete, which is a transport condition and stays retryable. Conflating the
     two would let one truncated response mark a live symbol permanently unobserved. */
  /* ONLY THE PROVIDER MAY NAME AN ABSENCE.
     This used to fall through to ABSENCE_NOT_OBSERVED for any quote whose price was null,
     which meant the earlier compatibility layer was inventing the stream's answer out of a missing number. A payload
     that says state:'OK' and then carries no price is not a symbol the stream does not
     observe; it is a malformed response - a contract failure, and retryable. The distinction
     matters exactly where it is easiest to lose: both cases look like "no price here". */
  function quoteAbsenceName (q) {
    if (!q) return null;
    if (q.state && q.state !== 'OK') return String(q.state);
    if (q.absence) return String(q.absence);
    if (q.reason) return String(q.reason);
    return null;                       // unnamed. NOT an absence.
  }
  /* IS THERE A PRICE HERE AT ALL - asked before anything coerces it.
     `!isFinite(+q.price)` was the whole test, and JavaScript makes `+null` and `+''` into 0.
     A payload saying state:'OK' with price:null therefore passed the malformed check, reached
     the row builder, and published a quote of $0.00 - a number no provider ever sent, printed
     as though it had. A missing price is not a cheap price. Emptiness is decided on the raw
     value; only then is anything converted.

     Zero and negative are rejected too. Every symbol reaching this branch is one the provider
     OWNS, and a provider-owned equity does not print at or below zero; a 0 here is far more
     likely to be a null that survived some earlier coercion than a real trade. Recorded as an
     assumption rather than a silent rule: if the contract ever defines a legitimate
     non-positive print, this is the line that has to change. */
  /* Emptiness is decided on the RAW value. Number(null), Number('') and Number(false) are all
     0, so any check that converts first has already lost the distinction it was asked to make. */
  function numOrNull (raw) {
    if (raw == null || raw === '' || raw === true || raw === false) return null;
    var n = Number(raw);
    return isFinite(n) ? n : null;
  }
  function quoteHasPrice (q) {
    if (!q) return false;
    var n = numOrNull(q.price);
    return n != null && n > 0;
  }
  /* A quote that named nothing and priced nothing. Retryable, never terminal. */
  function quoteIsMalformed (q) {
    return !!q && !quoteAbsenceName(q) && !quoteHasPrice(q);
  }
  /* A CACHED ROW IS ONLY AN ANSWER TO THE REQUEST THAT FETCHED IT.
     The cache used to be handed back wholesale, so a symbol the CURRENT response omitted could
     still be served from an older one - a stale price presented as this moment's answer, and,
     worse, presented as proof that the symbol WAS accounted for. The cache is now only used
     when it is warm AND covers every requested symbol; otherwise the answer is built from the
     response actually received, and anything it did not carry is reported as missing. */
  function quotes (syms, signal) {
    var batch = syms.slice(0, 400);
    if (!batch.length) return Promise.resolve({ map: {}, missing: [], truncated: false });
    var truncated = syms.length > batch.length;
    var now = Date.now();
    /* Warm means EVERY requested symbol is individually within the window - not that the map
       as a whole was touched recently. */
    var covered = batch.every(function (s) {
      return (s in qCache.map) && (now - (qCache.at[s] || 0) < 5000);
    });
    if (covered) {
      var warm = {};
      batch.forEach(function (s) { warm[s] = qCache.map[s]; });
      return Promise.resolve({ map: warm, missing: [], truncated: truncated });
    }
    return jget(API + '/quotes?symbols=' + encodeURIComponent(batch.join(',')), signal).then(function (j) {
      if (!j || !j.quotes) throw transportError('provider quotes payload had no quotes', API + '/quotes', null);
      var receipt = Date.now();
      Object.keys(j.quotes).forEach(function (k) { qCache.map[k] = j.quotes[k]; qCache.at[k] = receipt; });
      /* A symbol this response did NOT carry keeps its old receipt time; it is not renewed by
         someone else's answer, and will simply age out of the warm window on its own. */
      var fresh = {};
      batch.forEach(function (s) { if (s in j.quotes) fresh[s] = j.quotes[s]; });
      var missing = batch.filter(function (sym) { return !(sym in j.quotes); });
      if (missing.length) S.counts.partial_batches++;
      return { map: fresh, missing: missing, truncated: truncated };
    });
  }

  function geiger (signal) {
    if (gCache.map && Date.now() - gCache.at < 30000) return Promise.resolve(gCache.map);
    return jget(API + '/geiger', signal).then(function (j) {
      if (!j || !j.symbols) {
        if (gCache.map) return gCache.map;
        throw transportError('provider geiger unavailable', API + '/geiger', null);
      }
      /* Same gate on the Geiger read itself: a composite computed under an equalizer this
         surface has not accepted is not the accepted Geiger, whatever else is right about it. */
      if (!equalizerAccepted(j.equalizer_receipt_sha256)) {
        S.equalizer_accepted = false;
        if (gCache.map) return gCache.map;
        throw transportError('provider geiger equalizer receipt not accepted', API + '/geiger', null);
      }
      S.equalizer_accepted = true;
      gCache.map = j.symbols; gCache.at = Date.now();
      S.equalizer_receipt = j.equalizer_receipt_sha256;
      /* THE ENDPOINT'S OWN COMPUTE TIME, CARRIED VERBATIM. The earlier compatibility layer stamped every
         composite row with Date.now(), so a Geiger computed hours ago always read as fresh.
         It is the provider's number or it is unknown; it is never this machine's clock. */
      S.geiger_computed_utc = j.computed_utc || null;
      return gCache.map;
    }, function (e) {
      if (gCache.map) return gCache.map;
      throw e;
    });
  }

  /* The default /geiger projection deliberately omits the bulky per-rung audit object. A
     single-ticker Geiger pane needs that object; the all-universe Ranks board does not. Keep the
     board on the light projection and make one bounded detail request only for an exact symbol. */
  function geigerDetail (sym, signal) {
    sym = String(sym || '').toUpperCase();
    var hit = gDetailCache[sym];
    if (hit && Date.now() - hit.at < 30000) {
      S.geiger_computed_utc = hit.computed_utc || S.geiger_computed_utc;
      return Promise.resolve(hit.map);
    }
    var url = API + '/geiger?symbols=' + encodeURIComponent(sym) + '&detail=1';
    return jget(url, signal).then(function (j) {
      if (!j || !j.symbols || j.requested !== 1 || j.returned !== 1 || !j.symbols[sym]) {
        if (hit) return hit.map;
        throw transportError('provider geiger detail incomplete for ' + sym, url, null);
      }
      if (!equalizerAccepted(j.equalizer_receipt_sha256) ||
          !Array.isArray(j.participating_rungs) || j.participating_rungs.length !== 8) {
        S.equalizer_accepted = false;
        if (hit) return hit.map;
        throw transportError('provider geiger detail contract not accepted', url, null);
      }
      S.equalizer_accepted = true;
      S.equalizer_receipt = j.equalizer_receipt_sha256;
      S.geiger_computed_utc = j.computed_utc || null;
      gDetailCache[sym] = { at: Date.now(), map: j.symbols, computed_utc: j.computed_utc || null };
      return j.symbols;
    }, function (e) {
      if (hit) return hit.map;
      throw e;
    });
  }

  // ---- explicit provider-native Station models ------------------------------------------------
  function epochSeconds (value) {
    if (value == null) return null;
    if (typeof value === 'number' && isFinite(value)) return value;
    var s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s = s.replace(' ', 'T') + 'Z';
    var ms = Date.parse(s);
    return isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  function selectedFmpSpecs (families) {
    if (!families || !families.length) return FMP_DAILY_INDICATOR_SPECS.slice();
    var wanted = {};
    families.forEach(function (family) { wanted[String(family || '').toLowerCase()] = 1; });
    var selected = FMP_DAILY_INDICATOR_SPECS.filter(function (spec) { return wanted[spec.family]; });
    var known = {};
    selected.forEach(function (spec) { known[spec.family] = 1; });
    var unknown = Object.keys(wanted).filter(function (family) { return !known[family]; });
    if (unknown.length)
      throw transportError('unknown FMP indicator families: ' + unknown.join(','),
        'provider_indicators_current', null);
    return selected;
  }

  function indicatorPath (symbols, specs) {
    var families = [];
    var seen = {};
    (specs || []).forEach(function (spec) {
      if (!seen[spec.family]) { seen[spec.family] = 1; families.push(spec.family); }
    });
    return 'provider_indicators_current?select=ticker,provider,timeframe,indicator,period_length,value,source_date,session_state,fetched_at,universe_hash' +
      '&ticker=in.(' + symbols.join(',') + ')' +
      '&provider=eq.FMP&timeframe=eq.1day&universe_hash=eq.' + INDICATOR_UNIVERSE_SHA256 +
      (families.length && families.length < 9 ? '&indicator=in.(' + families.join(',') + ')' : '') +
      '&limit=1000';
  }

  function providerIndicatorRows (symbols, specs, origPg) {
    if (!symbols.length) return Promise.resolve([]);
    return origPg(indicatorPath(symbols, specs)).then(function (rows) {
      if (!Array.isArray(rows)) throw transportError('provider indicator index did not return rows', 'provider_indicators_current', null);
      var requested = {}, allowed = {}, accepted = [], seen = {}, dates = {}, states = {};
      symbols.forEach(function (ticker) { requested[ticker] = 1; });
      specs.forEach(function (spec) { allowed[spec.key] = 1; });
      rows.forEach(function (r) {
        if (!r) throw transportError('provider indicator index returned a null row', 'provider_indicators_current', null);
        var ticker = String(r.ticker || '').toUpperCase();
        var key = String(r.indicator || '') + ':' + String(r.period_length);
        if (!requested[ticker] || !allowed[key] || r.provider !== 'FMP' || r.timeframe !== '1day' ||
            r.universe_hash !== INDICATOR_UNIVERSE_SHA256 || !isFinite(Number(r.value)) ||
            ['FORMING','SETTLED'].indexOf(String(r.session_state || '')) < 0 || !r.source_date) {
          throw transportError('provider indicator row violated the accepted FMP contract: ' +
            (ticker || 'UNKNOWN') + '/' + (key || 'UNKNOWN'), 'provider_indicators_current', null);
        }
        if (seen[ticker] && seen[ticker][key])
          throw transportError('duplicate provider indicator contract: ' + ticker + '/' + key,
            'provider_indicators_current', null);
        accepted.push(r);
        (seen[ticker] || (seen[ticker] = {}))[key] = 1;
        (dates[ticker] || (dates[ticker] = {}))[String(r.source_date || '')] = 1;
        (states[ticker] || (states[ticker] = {}))[String(r.session_state || '')] = 1;
      });
      var missing = [];
      symbols.forEach(function (s) {
        if (dates[s] && Object.keys(dates[s]).length !== 1) missing.push(s + '/MIXED_SOURCE_DATE');
        if (states[s] && Object.keys(states[s]).length !== 1) missing.push(s + '/MIXED_SESSION_STATE');
      });
      if (missing.length)
        throw transportError('provider indicator snapshot incoherent: ' + missing.join(','), 'provider_indicators_current', null);
      S.counts.indicators += accepted.length;
      return accepted;
    });
  }

  function normalizedIndicatorRow (ticker, rows, specs) {
    var by = {};
    rows.forEach(function (r) { by[String(r.indicator) + ':' + String(r.period_length)] = r; });
    var value = function (indicator, period) {
      var r = by[indicator + ':' + period], n = r && Number(r.value);
      return isFinite(n) ? n : null;
    };
    var stamp = rows[0] || {};
    var contracts = specs.map(function (spec) {
      var r = by[spec.key] || null;
      return {
        id: spec.id, family: spec.family, period_length: spec.period_length,
        provider: 'FMP', timeframe: '1day', adjustment_basis: 'SPLIT_ADJUSTED_PROVIDER_OUTPUT',
        state: r ? 'AVAILABLE' : 'NAMED_UNAVAILABLE',
        reason: r ? null : 'CURRENT_INDEX_VALUE_ABSENT',
        value: r ? Number(r.value) : null,
        source_date: r ? r.source_date : null,
        session_state: r ? r.session_state : null,
        fetched_at_utc: r ? r.fetched_at : null
      };
    });
    return {
      ticker: ticker, tf: '1D', timestamp: epochSeconds(stamp.source_date),
      rsi_raw: value('rsi', 14), wpr_raw: value('williams', 14),
      fan_ema5: value('ema', 5), fan_ema8: value('ema', 8), fan_ema13: value('ema', 13),
      fan_ema21: value('ema', 21), fan_ema34: value('ema', 34),
      fan_sma50: value('sma', 50), fan_sma100: value('sma', 100),
      fan_sma150: value('sma', 150), fan_sma200: value('sma', 200),
      macd_raw: null, macd_signed: null, cci_raw: null, roc_raw: null, stoch_raw: null,
      severity_ob: null, severity_os: null,
      source_date: stamp.source_date || null, session_state: stamp.session_state || null,
      updated_ts: epochSeconds(stamp.fetched_at), sc_source: 'FMP_PROVIDER_INDICATORS',
      contracts: contracts
    };
  }

  /* Station's chart asks for a Hub timeframe token; the chart API speaks its own. Written out
     rather than lower-cased, because '1m' (minute) and '1M' (month) differ ONLY by case. */
  /* '5' and '1' are the LEGACY intraday tokens templates/sector-rotation.html still sends. They
     were absent from this map, so those two datasets resolved to TIMEFRAME_NOT_MAPPED and - via
     the fetch boundary's absence-to-empty conversion - arrived as a successful HTTP 200 with no
     bars, while the page advertised a live provider 5-minute and 1-minute spine. Mapped
     explicitly to the tokens the contract accepts. */
  var TF = { '1':'1m','5':'5m',
             '1m':'1m','2m':'2m','3m':'3m','5m':'5m','10m':'10m','15m':'15','15':'15','30m':'30','30':'30',
             '1h':'60','60':'60','2h':'120','120':'120','3h':'180','180':'180','4h':'240','240':'240',
             '6h':'6h','12h':'12h','1D':'D','D':'D','1d':'D','3D':'3D','3d':'3D','1W':'W','W':'W','1w':'W',
             '2W':'2W','2w':'2W','1M':'M','M':'M' };

  function note (why, path) {
    S.counts.unsatisfied++;
    if (S.unsatisfied.length < 40) S.unsatisfied.push({ why: why, path: String(path).slice(0, 160) });
  }

  var supabaseReader = null;
  function normalizeSymbols (symbols) {
    if (symbols == null) return null;
    var seen = {};
    return (Array.isArray(symbols) ? symbols : [symbols]).map(function (s) {
      return String(s || '').trim().toUpperCase();
    }).filter(function (s) {
      if (!s || seen[s]) return false;
      seen[s] = 1;
      return true;
    });
  }
  function readSupabase (path) {
    if (typeof supabaseReader !== 'function')
      return Promise.reject(transportError('Station Supabase reader is not bound', path, null));
    return Promise.resolve().then(function () { return supabaseReader(path); });
  }
  S.bindSupabaseReader = function (reader) {
    if (typeof reader !== 'function') return false;
    supabaseReader = reader;
    S.bound = true;
    return true;
  };
  window.scBindProviderClient = function (reader) {
    return S.bindSupabaseReader(reader || window.pg);
  };
  S.verifyOwnership = function (signal) { return providerOwned(signal, readSupabase); };

  function providerQuoteRows (symbols, signal) {
    if (!symbols.length) return Promise.resolve([]);
    return quotes(symbols, signal).then(function (res) {
      var qm = res.map, missing = res.missing;
      if (missing.length || res.truncated) {
        missing.forEach(function (sym) { S.clearAbsence(sym, null); });
        throw transportError('provider quotes batch incomplete: ' +
          (res.truncated ? 'request exceeded the 400-symbol batch limit' : missing.join(',')),
          API + '/quotes', null);
      }
      var malformed = symbols.filter(function (sym) { return quoteIsMalformed(qm[sym]); });
      if (malformed.length) {
        malformed.forEach(function (sym) { S.clearAbsence(sym, null); });
        throw transportError('provider quote malformed (no state, no price): ' + malformed.join(','),
          API + '/quotes', null);
      }
      var rows = [];
      symbols.forEach(function (sym) {
        var value = qm[sym];
        var named = quoteAbsenceName(value);
        if (named) {
          note('provider named ' + named, sym);
          S.noteAbsence(sym, null, named);
          return;
        }
        var price = numOrNull(value && value.price);
        var previous = numOrNull(value && value.previous_close);
        if (price == null || price <= 0)
          throw transportError('unpriced provider quote reached the Station model for ' + sym,
            API + '/quotes', null);
        S.clearAbsence(sym, null);
        rows.push({
          ticker: sym,
          price: price,
          previous_close: previous,
          prev_close: previous,
          change: previous ? price - previous : null,
          change_percent: previous ? (price - previous) / previous * 100 : null,
          chg_pct: previous ? (price - previous) / previous * 100 : null,
          volume: null,
          observed_at: quoteObservedAt(value),
          updated_ts: quoteObservedAt(value),
          provider: 'MASSIVE',
          authority: 'MASSIVE_PROVIDER_D_BAR'
        });
      });
      S.counts.quotes += rows.length;
      return rows;
    });
  }

  function requireProviderOwned (symbols, own, operation) {
    var wrong = symbols.filter(function (sym) { return !own[sym]; });
    if (!wrong.length) return;
    wrong.forEach(function (sym) { S.noteAbsence(sym, operation, 'NOT_PROVIDER_OWNED'); });
    throw transportError(operation + ' request included non-provider symbols: ' + wrong.join(','),
      API, null);
  }

  S.equityQuotes = function (symbols, options) {
    options = options || {};
    var requested = normalizeSymbols(symbols);
    return providerOwned(options.signal, readSupabase).then(function (own) {
      var equities = requested || Object.keys(own);
      requireProviderOwned(equities, own, 'equityQuotes');
      return providerQuoteRows(equities, options.signal);
    });
  };

  function geigerRows (symbols, map) {
    var absent = symbols.filter(function (sym) { return !map[sym]; });
    if (absent.length) {
      absent.forEach(function (sym) { S.clearAbsence(sym, 'D'); });
      throw transportError('provider geiger payload incomplete: ' + absent.join(','), API + '/geiger', null);
    }
    var rows = symbols.map(function (sym) {
      var value = map[sym];
      return {
        ticker: sym,
        timeframe: 'D',
        tf: 'D',
        composite: value.composite,
        trend: value.trend,
        momentum: value.momentum,
        structure: value.structure == null ? null : value.structure,
        tf_contributors: value.tf_contributors,
        rungs: value.rungs || {},
        computed_utc: S.geiger_computed_utc || null,
        updated_ts: S.geiger_computed_utc || null,
        provider: 'MASSIVE',
        authority: 'PROVIDER_EQUALIZER'
      };
    });
    S.counts.geiger += rows.length;
    return rows;
  }

  S.equityGeiger = function (symbols, options) {
    options = options || {};
    var requested = normalizeSymbols(symbols);
    return providerOwned(options.signal, readSupabase).then(function (own) {
      var equities = requested || Object.keys(own);
      requireProviderOwned(equities, own, 'equityGeiger');
      var detail = !!options.detail && equities.length === 1;
      return (detail ? geigerDetail(equities[0], options.signal) : geiger(options.signal))
        .then(function (map) { return geigerRows(equities, map); });
    });
  };

  function providerCandleRows (symbol, rawTf, limit, signal) {
    var tf = TF[rawTf];
    if (!tf) {
      note('unmapped timeframe ' + rawTf, symbol);
      return Promise.reject(S.absenceError(ABSENCE_TIMEFRAME_NOT_MAPPED, symbol, rawTf));
    }
    var bounded = Math.min(Math.max(Number(limit) || 200, 1), 400);
    var url = API + '/candles?symbol=' + encodeURIComponent(symbol) + '&tf=' + encodeURIComponent(tf) +
      '&authority=provider&limit=' + bounded;
    return jget(url, signal).then(function (payload) {
      var named = payload && (payload.absence || payload.reason ||
        (payload.state && payload.state !== 'OK' ? payload.state : null));
      if (!payload || !Array.isArray(payload.series) || !payload.series.length) {
        if (named) throw S.absenceError(named, symbol, rawTf);
        S.clearAbsence(symbol, rawTf);
        throw transportError('provider series empty and unnamed for ' + symbol + '/' + tf, url, null);
      }
      if (named) throw S.absenceError(named, symbol, rawTf);
      S.clearAbsence(symbol, rawTf);
      S.counts.candles += payload.series.length;
      return payload.series.map(function (bar) {
        return {
          ticker: symbol,
          timestamp: Math.floor(bar.t / 1000),
          open: Number(bar.o),
          high: Number(bar.h),
          low: Number(bar.l),
          close: Number(bar.c),
          volume: Number(bar.v),
          provider: 'MASSIVE',
          authority: 'PROVIDER_BUILT'
        };
      }).reverse().slice(0, bounded);
    });
  }

  S.equityCandles = function (symbol, timeframe, options) {
    options = options || {};
    var sym = normalizeSymbols(symbol);
    if (!sym || sym.length !== 1)
      return Promise.reject(S.absenceError(ABSENCE_TICKER_FILTER_REQUIRED, '', timeframe));
    return providerOwned(options.signal, readSupabase).then(function (own) {
      requireProviderOwned(sym, own, 'equityCandles');
      return providerCandleRows(sym[0], String(timeframe || ''), options.limit, options.signal);
    });
  };

  function indicatorSnapshot (ticker, rows, specs) {
    var normalized = normalizedIndicatorRow(ticker, rows, specs);
    var contractValue = function (id) {
      var c = normalized.contracts.find(function (x) { return x.id === id; });
      return c && c.state === 'AVAILABLE' ? c.value : null;
    };
    return {
      ticker: ticker,
      provider: 'FMP',
      timeframe: '1day',
      catalog_manifest_sha256: FMP_INDICATOR_MANIFEST_SHA256,
      catalog_fixed_spec_count: 16,
      requested_spec_count: specs.length,
      adjustment_basis: 'SPLIT_ADJUSTED_PROVIDER_OUTPUT',
      source_date: normalized.source_date,
      session_state: normalized.session_state,
      fetched_at: normalized.updated_ts,
      rsi14: normalized.rsi_raw,
      williams14: normalized.wpr_raw,
      ema5: normalized.fan_ema5,
      ema8: normalized.fan_ema8,
      ema13: normalized.fan_ema13,
      ema21: normalized.fan_ema21,
      ema34: normalized.fan_ema34,
      sma50: normalized.fan_sma50,
      sma100: normalized.fan_sma100,
      sma150: normalized.fan_sma150,
      sma200: normalized.fan_sma200,
      wma20: contractValue('fmp.wma.20.daily'),
      dema20: contractValue('fmp.dema.20.daily'),
      tema20: contractValue('fmp.tema.20.daily'),
      standarddeviation20: contractValue('fmp.standarddeviation.20.daily'),
      adx14: contractValue('fmp.adx.14.daily'),
      macd: null,
      macd_state: 'NOT_IN_FMP_ACCEPTED_CATALOG',
      contracts: normalized.contracts,
      authority: 'FMP_PROVIDER_INDICATORS'
    };
  }

  S.fmpDailyIndicators = function (symbols, options) {
    options = options || {};
    var requested = normalizeSymbols(symbols);
    var specs;
    try { specs = selectedFmpSpecs(options.indicators || null); }
    catch (e) { return Promise.reject(e); }
    return providerOwned(options.signal, readSupabase).then(function (own) {
      requested = requested || Object.keys(own);
      if (!requested.length)
        throw S.absenceError(ABSENCE_TICKER_FILTER_REQUIRED, '', 'fmpDailyIndicators');
      if (symbols == null && (!Array.isArray(options.indicators) || !options.indicators.length))
        throw transportError('full-universe fmpDailyIndicators requires an explicit provider family list',
          'provider_indicators_current', null);
      requireProviderOwned(requested, own, 'fmpDailyIndicators');
      return providerIndicatorRows(requested, specs, readSupabase).then(function (raw) {
        var grouped = {};
        raw.forEach(function (row) {
          var ticker = String(row.ticker || '').toUpperCase();
          (grouped[ticker] || (grouped[ticker] = [])).push(row);
        });
        return requested.map(function (ticker) {
          S.clearAbsence(ticker, '1D');
          return indicatorSnapshot(ticker, grouped[ticker] || [], specs);
        });
      });
    });
  };

  /* Compatibility is method-level only: the result still means FMP daily provider indicators,
     never a legacy table. New surfaces use the explicit provider-named method. */
  S.dailyIndicators = function (symbols, options) {
    return S.fmpDailyIndicators(symbols, options);
  };

  function validateMassiveIndicatorSnapshot (ticker, payload) {
    if (!payload || payload.schema_version !== 'scintilla.provider-current-indicators.v1' ||
        payload.provider !== 'MASSIVE' || payload.symbol !== ticker || payload.timeframe !== 'minute' ||
        payload.adjusted !== true || payload.series_type !== 'close' ||
        payload.catalog_manifest_sha256 !== MASSIVE_INDICATOR_MANIFEST_SHA256 ||
        payload.catalog_fixed_spec_count !== 11 || !Array.isArray(payload.contracts) ||
        payload.contracts.length !== MASSIVE_MINUTE_INDICATOR_IDS.length) {
      throw transportError('Massive indicator snapshot violated the accepted catalog contract',
        API + '/indicators', null);
    }
    var cutoff = Date.parse(payload.completed_minute_cutoff_utc || '');
    if (!isFinite(cutoff))
      throw transportError('Massive indicator snapshot has no completed-minute cutoff',
        API + '/indicators', null);
    payload.contracts.forEach(function (c, i) {
      if (!c || c.id !== MASSIVE_MINUTE_INDICATOR_IDS[i] || c.provider !== 'MASSIVE' ||
          c.timeframe !== 'minute' || c.adjusted !== true || c.series_type !== 'close' ||
          ['AVAILABLE','NAMED_UNAVAILABLE'].indexOf(c.state) < 0) {
        throw transportError('Massive indicator contract mismatch at ' + i, API + '/indicators', null);
      }
      if (c.state === 'AVAILABLE') {
        var source = Date.parse(c.source_timestamp_utc || '');
        if (!isFinite(Number(c.value)) || !isFinite(source) || source > cutoff ||
            c.source_finality !== 'COMPLETED_PROVIDER_MINUTE' || !c.source_session_et ||
            !c.source_market_session) {
          throw transportError('Massive indicator available value lacks finality: ' + c.id,
            API + '/indicators', null);
        }
        if (c.family === 'macd' && (!isFinite(Number(c.signal)) || !isFinite(Number(c.histogram))))
          throw transportError('Massive MACD contract lacks signal or histogram', API + '/indicators', null);
      } else if (c.value !== null || !c.reason) {
        throw transportError('Massive named unavailability is malformed: ' + c.id,
          API + '/indicators', null);
      }
    });
    return {
      schema_version: payload.schema_version,
      ticker: ticker,
      provider: 'MASSIVE',
      provider_symbol: payload.provider_symbol,
      timeframe: 'minute',
      adjustment_basis: 'SPLIT_ADJUSTED_PROVIDER_OUTPUT',
      catalog_manifest_sha256: payload.catalog_manifest_sha256,
      catalog_fixed_spec_count: 11,
      generated_utc: payload.generated_utc || null,
      completed_minute_cutoff_utc: payload.completed_minute_cutoff_utc,
      available_count: payload.available_count,
      unavailable_count: payload.unavailable_count,
      historical_archive_dependency: payload.historical_archive_dependency === false ? false : null,
      contracts: payload.contracts,
      authority: 'MASSIVE_PROVIDER_INDICATORS_CURRENT'
    };
  }

  S.massiveMinuteIndicators = function (symbol, options) {
    options = options || {};
    var requested = normalizeSymbols(symbol);
    if (!requested || requested.length !== 1)
      return Promise.reject(S.absenceError(ABSENCE_TICKER_FILTER_REQUIRED, '', 'massiveMinuteIndicators'));
    return providerOwned(options.signal, readSupabase).then(function (own) {
      requireProviderOwned(requested, own, 'massiveMinuteIndicators');
      var ticker = requested[0];
      var url = API + '/indicators?provider=MASSIVE&symbol=' + encodeURIComponent(ticker);
      return jget(url, options.signal).then(function (payload) {
        var out = validateMassiveIndicatorSnapshot(ticker, payload);
        S.counts.indicators += out.contracts.filter(function (c) { return c.state === 'AVAILABLE'; }).length;
        return out;
      });
    });
  };

  var N = window.SC_NON_EQUITY = {
    authority: 'RETAINED_SUPABASE_NON_EQUITY',
    quotes: function (symbols, options) {
      options = options || {};
      var requested = normalizeSymbols(symbols);
      return providerOwned(options.signal, readSupabase).then(function (own) {
        if (requested) {
          var wrong = requested.filter(function (sym) { return own[sym]; });
          if (wrong.length)
            throw transportError('non-equity quote adapter refused provider symbols: ' + wrong.join(','),
              'SC_NON_EQUITY.quotes', null);
        }
        var path = requested
          ? 'live_quotes?select=ticker,price,change,chg_pct,prev_close,updated_ts&ticker=in.(' + requested.join(',') + ')'
          : 'live_quotes?select=ticker,price,change,chg_pct,prev_close,updated_ts&limit=2000';
        return readSupabase(path).then(function (rows) {
          S.counts.passthrough_non_equity += requested ? requested.length : 1;
          return (Array.isArray(rows) ? rows : []).filter(function (row) {
            return !own[String(row && row.ticker || '').toUpperCase()];
          });
        });
      });
    },
    geiger: function (symbols, options) {
      options = options || {};
      var requested = normalizeSymbols(symbols);
      return providerOwned(options.signal, readSupabase).then(function (own) {
        if (requested) {
          var wrong = requested.filter(function (sym) { return own[sym]; });
          if (wrong.length)
            throw transportError('non-equity Geiger adapter refused provider symbols: ' + wrong.join(','),
              'SC_NON_EQUITY.geiger', null);
        }
        var path = requested
          ? 'composite_staged?select=ticker,tf,trend,momentum,composite,updated_ts&tf=eq.D&ticker=in.(' + requested.join(',') + ')'
          : 'composite_staged?select=ticker,tf,trend,momentum,composite,updated_ts&tf=eq.D&limit=2000';
        return readSupabase(path).then(function (rows) {
          S.counts.passthrough_non_equity += requested ? requested.length : 1;
          return (Array.isArray(rows) ? rows : []).filter(function (row) {
            return !own[String(row && row.ticker || '').toUpperCase()];
          });
        });
      });
    },
    candles: function (symbol, timeframe, options) {
      options = options || {};
      var requested = normalizeSymbols(symbol);
      if (!requested || requested.length !== 1)
        return Promise.reject(S.absenceError(ABSENCE_TICKER_FILTER_REQUIRED, '', timeframe));
      var sym = requested[0];
      return providerOwned(options.signal, readSupabase).then(function (own) {
        if (own[sym])
          throw transportError('non-equity candle adapter refused provider symbol: ' + sym,
            'SC_NON_EQUITY.candles', null);
        var limit = Math.min(Math.max(Number(options.limit) || 200, 1), 1000);
        var path = 'ohlcv_history?select=ticker,timestamp,open,high,low,close,volume&ticker=eq.' +
          encodeURIComponent(sym) + '&tf=eq.' + encodeURIComponent(String(timeframe || '')) +
          '&order=timestamp.desc&limit=' + limit;
        S.counts.passthrough_non_equity++;
        return readSupabase(path);
      });
    }
  };

  S.marketQuotes = function (symbols, options) {
    options = options || {};
    var requested = normalizeSymbols(symbols);
    return providerOwned(options.signal, readSupabase).then(function (own) {
      var equities = requested ? requested.filter(function (sym) { return own[sym]; }) : Object.keys(own);
      var nonEquities = requested ? requested.filter(function (sym) { return !own[sym]; }) : null;
      return Promise.all([
        providerQuoteRows(equities, options.signal),
        nonEquities && !nonEquities.length ? Promise.resolve([]) : N.quotes(nonEquities, options)
      ]).then(function (parts) { return parts[0].concat(parts[1]); });
    });
  };

  S.marketGeiger = function (symbols, options) {
    options = options || {};
    var requested = normalizeSymbols(symbols);
    return providerOwned(options.signal, readSupabase).then(function (own) {
      var equities = requested ? requested.filter(function (sym) { return own[sym]; }) : Object.keys(own);
      var nonEquities = requested ? requested.filter(function (sym) { return !own[sym]; }) : null;
      var providerPart = equities.length
        ? (options.detail && equities.length === 1 ? geigerDetail(equities[0], options.signal) : geiger(options.signal))
          .then(function (map) { return geigerRows(equities, map); })
        : Promise.resolve([]);
      return Promise.all([
        providerPart,
        nonEquities && !nonEquities.length ? Promise.resolve([]) : N.geiger(nonEquities, options)
      ]).then(function (parts) { return parts[0].concat(parts[1]); });
    });
  };

  S.marketCandles = function (symbol, timeframe, options) {
    options = options || {};
    var requested = normalizeSymbols(symbol);
    if (!requested || requested.length !== 1)
      return Promise.reject(S.absenceError(ABSENCE_TICKER_FILTER_REQUIRED, '', timeframe));
    var sym = requested[0];
    return providerOwned(options.signal, readSupabase).then(function (own) {
      return own[sym]
        ? providerCandleRows(sym, String(timeframe || ''), options.limit, options.signal)
        : N.candles(sym, timeframe, options);
    });
  };
})();
