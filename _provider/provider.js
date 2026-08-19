/* SCINTILLA STATION — PROVIDER AUTHORITY SHIM
   ============================================
   Station is 29 standalone pages, each with its own copy of pg(). Rewriting every call site would
   mean touching hundreds of places across those files, and every one of them is a chance to get a
   shape subtly wrong. Instead this shim intercepts the THREE legacy equity tables inside pg() and
   answers them from the accepted provider APIs, returning rows in exactly the shape each caller
   already expects. One file, one hook per page.

   WHAT IT REPLACES, and with what:
     live_quotes      -> GET /quotes   current provider price + provider previous completed daily
                                       close (MASSIVE_PROVIDER_D_BAR). This is the percentage
                                       authority the Hub cut over to.
     composite_staged -> GET /geiger   Trend, Momentum and the composite recomputed from
                                       provider-built bars under Alan's captured Equalizer
                                       (receipt f6cf97b5…97ad1). Structure is null; the Volume
                                       family does not exist.
     ohlcv_history    -> GET /candles  provider-built bars, authority=provider, completed periods
                                       only — the serving layer withholds any trailing bar whose
                                       period has not elapsed.

   WHY IT MATTERS HERE. Measured on the full 365-symbol universe on 2026-08-18, the legacy
   live_quotes baseline disagreed with the provider's previous close on 359 of 365 symbols and
   pointed the WRONG DIRECTION on 183 of them. AMD read +6.50% while the provider's own numbers
   give -1.26%. The Hub was cut over for exactly this reason; leaving Station on the old table
   would keep two surfaces disagreeing about the same stock.

   RULES THIS SHIM OBEYS:
     - NO SILENT FALLBACK. If a query cannot be satisfied from provider data, it returns an empty
       result and records a NAMED reason in window.SC_PROVIDER_SHIM.unsatisfied. It never quietly
       reaches for the legacy table, because a wrong number that looks right is worse than a gap.
     - NON-EQUITIES KEEP THEIR OWNER. A symbol the provider does not own (crypto, futures, indices,
       rates) is passed through to the original pg(). That is provider routing, not a fallback.
     - NOTHING IS COMPUTED HERE. No bars are derived, no percentages are invented, no unfinished
       period is composed. Every number comes from an accepted API.
*/
(function () {
  'use strict';
  var API = 'https://scintilla-massive-chart-api.fly.dev';

  var S = window.SC_PROVIDER_SHIM = {
    api: API,
    installed: false,
    equalizer_receipt: null,
    counts: { quotes: 0, geiger: 0, candles: 0, passthrough_non_equity: 0, unsatisfied: 0,
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
       whole subscription; the shim never cancels on its account. */
    onSlowRead: null,
    /* What is known about the ownership universe, and whether it was VERIFIED complete. Any
       surface that wants to show the universe reads this rather than counting rows it happens
       to have received. */
    ownership: { verified: false, count: null, expected: null, reason: 'not yet read' },
    legacy_equity_calls: [],         // must stay empty; anything here is a contract breach
    /* SYNCHRONOUS MEMBERSHIP FOR NON-FETCH CALL SITES.
       The fetch wrapper cannot see Supabase REALTIME, which delivers rows over a WebSocket and
       never calls fetch at all. deck's station-deck-lq channel and chart's lq channel both wrote
       equity prices straight into the render path, bypassing every guard in this file - and
       legacy_equity_calls stayed empty the whole time, which made the shim look clean while a
       legacy price moved a provider-owned symbol. Those handlers need an ANSWER NOW, not a
       promise, so the owned map is published here as it resolves. */
    owned_map: null,
    isProviderOwned: function (sym) {
      var m = window.SC_PROVIDER_SHIM.owned_map;
      return !!(m && m[String(sym || '').toUpperCase()]);
    },
    /* THE THIRD STATE THE REALTIME GUARDS WERE MISSING.
       isProviderOwned answers false both for "the provider does not own this" and for "we do
       not know yet" - and the Realtime handlers treated false as permission to write a legacy
       price. Before the first /geiger resolves, or after it fails, that let a legacy equity
       price patch a provider-owned chart: the exact bypass those guards exist to close, open
       during the window they are most needed. Ownership is knowledge or it is nothing. */
    ownershipKnown: function () {
      var S2 = window.SC_PROVIDER_SHIM;
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
      var a = window.SC_PROVIDER_SHIM.absences;
      var key = String(sym || '').toUpperCase();
      /* Asking about a timeframe asks the history lane only. Asking without one asks the quote
         lane only. Neither answers for the other. */
      return tf ? (a[key + '|' + String(tf)] || null) : (a[key] || null);
    },
    noteAbsence: function (sym, tf, reason) {
      var a = window.SC_PROVIDER_SHIM.absences;
      var key = String(sym || '').toUpperCase();
      var named = String(reason || 'NOT_OBSERVED_BY_STREAM');
      if (tf) a[key + '|' + String(tf)] = named; else a[key] = named;
      return named;
    },
    clearAbsence: function (sym, tf) {
      var a = window.SC_PROVIDER_SHIM.absences;
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
  var qCache = { map: {}, at: {} }, gCache = { at: 0, map: null }, ownedAt = 0, owned = null;

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
     exact data path this shim exists to close.

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
  var CANONICAL_EQUITY_QUERY =
    'tickers?select=ticker&active=eq.true&type=not.in.(crypto,future,index,rate)&order=ticker.asc&limit=1000';

  /* THE ACCEPTED EQUALIZER, IN FULL.
     The receipt was recorded and displayed but never checked, so a payload computed under ANY
     equalizer was admitted as long as its symbol set matched - and the symbol set says nothing
     about the weights the composite was built from. Two runs over identical symbols under
     different equalizers are different numbers wearing the same name, which is exactly the
     confusion this shim exists to end.

     The digest is compared in full. A prefix comparison would pass the very fixtures that
     proved the hole. Wrong or missing fails closed: no ownership, no classification, and
     /health cannot grade the lane OK. */
  var ACCEPTED_EQUALIZER_SHA256 =
    'f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1';
  function equalizerAccepted (receipt) {
    return typeof receipt === 'string' &&
           receipt.toLowerCase() === ACCEPTED_EQUALIZER_SHA256;
  }
  function providerOwned (signal, origPg) {
    /* A warm map is knowledge and may answer without a read - but not for a caller who has
       already cancelled. Returning it here let the next call receive an aborted signal and run
       on regardless. */
    if (signal && signal.aborted)
      return Promise.reject(transportError('provider unreachable: cancelled by the caller', API + '/geiger', null));
    if (owned && Date.now() - ownedAt < 300000) return Promise.resolve(owned);
    var fail = function (why, count) {
      S.ownership = { verified: false, count: count == null ? null : count,
                      expected: EXPECTED_EQUITY_UNIVERSE, reason: why };
      if (owned) return owned;                      // a verified map survives one bad answer
      throw transportError('provider ownership ' + why, API + '/geiger', null);
    };
    /* Read through the PAGE's own reader, so the shim needs no credentials of its own. A
       failure here is not fatal on its own - it drops the check back to cardinality, and says
       so - because the canonical set is a cross-check, not the provider's replacement. */
    var canonical = typeof origPg === 'function'
      ? origPg(CANONICAL_EQUITY_QUERY).then(function (rows) {
          return Array.isArray(rows)
            ? rows.map(function (r) { return String(r && r.ticker || '').toUpperCase(); }).filter(Boolean)
            : null;
        }, function () { return null; })
      : Promise.resolve(null);

    return Promise.all([jget(API + '/geiger', signal), canonical]).then(function (a) {
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
      } else if (syms.length !== EXPECTED_EQUITY_UNIVERSE) {
        return fail('universe disagreement: ' + syms.length + ' symbols, expected ' +
                    EXPECTED_EQUITY_UNIVERSE + ' (canonical set unavailable)', syms.length);
      }

      owned = next;
      S.owned_map = owned;
      ownedAt = Date.now();
      S.equalizer_receipt = j.equalizer_receipt_sha256;
      S.geiger_computed_utc = j.computed_utc || null;
      S.ownership = { verified: true, count: syms.length, expected: EXPECTED_EQUITY_UNIVERSE,
                      reason: null, equalizer_receipt: j.equalizer_receipt_sha256 || null,
                      /* Stated so a reviewer can see what "verified" actually compared. */
                      identity: canon && canon.length
                        ? 'exact set match against ' + canon.length + ' canonical active non-(crypto/future/index/rate) tickers'
                        : 'CARDINALITY ONLY - the canonical set could not be read' };
      return owned;
    }, function (e) {
      if (owned) return owned;                      // warm knowledge survives one bad read
      S.ownership = { verified: false, count: null, expected: EXPECTED_EQUITY_UNIVERSE,
                      reason: 'ownership read failed: ' + (e && e.message || 'unknown') };
      throw e;                                      // cold failure stays a failure
    });
  }

  /* THE PROVIDER'S OWN OBSERVATION TIME, OR NOTHING.
     ONE field, and it is the one the live /quotes payload carries: `price_observation_utc`.
     The field this shim originally read, `price_sip_utc`, is not on the payload at all, so
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
     which meant the shim was inventing the stream's answer out of a missing number. A payload
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
      /* THE ENDPOINT'S OWN COMPUTE TIME, CARRIED VERBATIM. The shim used to stamp every
         composite row with Date.now(), so a Geiger computed hours ago always read as fresh.
         It is the provider's number or it is unknown; it is never this machine's clock. */
      S.geiger_computed_utc = j.computed_utc || null;
      return gCache.map;
    }, function (e) {
      if (gCache.map) return gCache.map;
      throw e;
    });
  }

  // ---- minimal PostgREST query reading. Only what these three tables actually use. -------------
  function parse (path) {
    var qi = path.indexOf('?');
    var table = (qi < 0 ? path : path.slice(0, qi)).replace(/^\/+/, '');
    var q = {};
    (qi < 0 ? '' : path.slice(qi + 1)).split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('='); if (i < 0) return;
      q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    });
    return { table: table, q: q };
  }
  function wantedTickers (q) {
    var t = q.ticker || '';
    if (t.indexOf('in.(') === 0) return t.slice(4).replace(/\)$/, '').split(',').map(function (x) { return x.replace(/"/g, '').trim().toUpperCase(); }).filter(Boolean);
    if (t.indexOf('eq.') === 0) return [t.slice(3).trim().toUpperCase()];
    return null;                      // no ticker filter: caller wants the whole table
  }
  function limitOf (q, dflt) { var n = parseInt(q.limit, 10); return isFinite(n) && n > 0 ? n : dflt; }

  /* Station's chart asks for a Hub timeframe token; the chart API speaks its own. Written out
     rather than lower-cased, because '1m' (minute) and '1M' (month) differ ONLY by case. */
  var TF = { '1m':'1m','2m':'2m','3m':'3m','5m':'5m','10m':'10m','15m':'15','15':'15','30m':'30','30':'30',
             '1h':'60','60':'60','2h':'120','120':'120','3h':'180','180':'180','4h':'240','240':'240',
             '6h':'6h','12h':'12h','1D':'D','D':'D','1d':'D','3D':'3D','3d':'3D','1W':'W','W':'W','1w':'W',
             '2W':'2W','2w':'2W','1M':'M','M':'M' };

  function note (why, path) {
    S.counts.unsatisfied++;
    if (S.unsatisfied.length < 40) S.unsatisfied.push({ why: why, path: String(path).slice(0, 160) });
  }

  // ---- the interceptor ------------------------------------------------------------------------
  function handle (path, origPg, signal) {
    var p = parse(path), q = p.q;

    if (p.table === 'live_quotes') {
      var lqT = wantedTickers(q);
      return providerOwned(signal, origPg).then(function (own) {
        /* AN UNFILTERED REQUEST ASKS FOR THE WHOLE BOARD, NOT THE PROVIDER'S HALF OF IT.
           `syms = lqT || Object.keys(own)` made the non-equity list EMPTY whenever the caller
           had not named tickers - because the only symbols in play were, by construction, the
           ones the provider owns. Every unfiltered Station consumer therefore lost crypto,
           futures, indices and rates entirely, silently, while the filtered path kept them.
           An unfiltered ask keeps its legacy half unfiltered too, and the provider's owned set
           is subtracted from it rather than standing in for it. */
        var syms = lqT || Object.keys(own);
        var eq = syms.filter(function (s) { return own[s]; });
        var nonEq = lqT ? syms.filter(function (s) { return !own[s]; }) : null;   // null = "everything not owned"
        return quotes(eq, signal).then(function (res) {
          var qm = res.map, missing = res.missing;
          /* A SUCCESSFUL RESPONSE MUST ACCOUNT FOR EVERY REQUESTED SYMBOL.
             A short batch used to resolve with the rows it did have, and the caller - having
             asked for AAPL and MSFT and received only AAPL - concluded that MSFT is not
             observed by the stream and stopped retrying it. A partial answer is not a smaller
             answer; it is an unfinished request, so the whole request fails and every symbol on
             it stays retryable. No absence name is written for any of them. */
          if (missing.length || res.truncated) {
            missing.forEach(function (sym) { S.clearAbsence(sym, null); });
            throw transportError('provider quotes batch incomplete: ' +
              (res.truncated ? 'request exceeded the 400-symbol batch limit' : missing.join(',')),
              API + '/quotes', null);
          }
          var rows = [];
          /* A malformed entry fails the whole request, like any other incomplete answer. It is
             not written down as an absence, because nothing named it one. */
          var malformed = eq.filter(function (s) { return quoteIsMalformed(qm[s]); });
          if (malformed.length) {
            malformed.forEach(function (sym) { S.clearAbsence(sym, null); });
            throw transportError('provider quote malformed (no state, no price): ' + malformed.join(','),
              API + '/quotes', null);
          }
          eq.forEach(function (s) {
            var v = qm[s];
            if (!v) return;                              // covered by `missing` above
            var named = quoteAbsenceName(v);
            if (named) { note('provider named ' + named, s); S.noteAbsence(s, null, named); return; }
            /* Guaranteed by the malformed sweep above; asserted here so a future edit to that
               sweep cannot quietly reopen the $0 path. */
            if (!quoteHasPrice(v)) { note('unpriced quote reached the row builder', s); return; }
            var price = numOrNull(v.price);
            /* SAME CLASS, SAME TRAP. `+v.previous_close` turned null and '' into 0, and 0 then
               passed isFinite - so Station received prev_close:0 instead of "unknown", and every
               percentage computed against it was a division by a number nobody sent. Unknown
               stays null, and the change/percent below are simply not computed. */
            var prev = numOrNull(v.previous_close);
            S.clearAbsence(s, null);
            rows.push({
              ticker: s, price: price, prev_close: prev,
              chg_pct: (prev ? (price - prev) / prev * 100 : null),
              change: (prev ? price - prev : null),
              volume: null,                 // the provider quote carries no volume; null, never 0
              /* The provider's own observation time, or null. Never this machine's clock. */
              updated_ts: quoteObservedAt(v),
              sc_source: 'MASSIVE_PROVIDER_D_BAR'
            });
          });
          S.counts.quotes += rows.length;
          if (nonEq && !nonEq.length) return rows;
          // Non-equities keep their existing owner. Only they reach the legacy table.
          S.counts.passthrough_non_equity += nonEq ? nonEq.length : 1;
          /* Filtered: ask the legacy table for exactly the non-owned tickers.
             Unfiltered: ask it for everything and drop the owned ones here, so the whole board
             still arrives and no equity slips back in under the legacy price. */
          var pass = nonEq
            ? path.replace(/ticker=(in\.\([^)]*\)|eq\.[^&]*)/, 'ticker=in.(' + nonEq.join(',') + ')')
            : 'live_quotes?select=ticker,price,chg_pct,prev_close,updated_ts&limit=2000';
          /* The non-equity half failing used to leave the provider rows standing alone, and the
             caller then read the absent non-equities as unobserved. Half a request is not a
             request: it fails, and every symbol on it stays retryable. */
          return origPg(pass).then(function (extra) {
            var kept = (extra || []).filter(function (r) {
              return !own[String(r && r.ticker || '').toUpperCase()];
            });
            return rows.concat(kept);
          }, function (e) {
            (nonEq || []).forEach(function (sym) { S.clearAbsence(sym, null); });
            if (e && (e.scTransport || e.scAbsence)) throw e;
            throw transportError('non-equity passthrough failed: ' + (e && e.message || 'unknown'), pass, null);
          });
        });
      });
    }

    if (p.table === 'composite_staged') {
      var csT = wantedTickers(q);
      return Promise.all([providerOwned(signal, origPg), geiger(signal)]).then(function (a) {
        var own = a[0], gm = a[1];
        /* Same rule as live_quotes: an unfiltered ask keeps its legacy half unfiltered. */
        var syms = csT || Object.keys(own);
        var eq = syms.filter(function (s) { return own[s]; });
        var nonEq = csT ? syms.filter(function (s) { return !own[s]; }) : null;
        /* Every requested equity must appear in the Geiger payload; /geiger publishes the whole
           universe, so a gap is an incomplete payload rather than a settled per-symbol fact. */
        var absent = eq.filter(function (s) { return !gm[s]; });
        if (absent.length) {
          absent.forEach(function (sym) { S.clearAbsence(sym, 'D'); });
          note('geiger payload did not account for ' + absent.length + ' requested symbols', path);
          throw transportError('provider geiger payload incomplete: ' + absent.join(','), API + '/geiger', null);
        }
        var rows = eq.map(function (s) {
          var v = gm[s]; if (!v) { note('no candidate geiger', s); return null; }
          return { ticker: s, tf: 'D', composite: v.composite, trend: v.trend, momentum: v.momentum,
                   structure: null,          // removed from the active contract
                   core: null, conviction: null,
                   tf_contributors: v.tf_contributors,
                   /* THE ENDPOINT'S COMPUTE TIME, NOT THIS MACHINE'S CLOCK. Stamping
                      Date.now() here made a Geiger computed hours ago read as seconds old
                      on every surface that showed its age. Unknown stays null. */
                   updated_ts: S.geiger_computed_utc || null,
                   computed_utc: S.geiger_computed_utc || null,
                   sc_source: 'CANDIDATE_PROVIDER_EQUALIZER' };
        }).filter(Boolean);
        S.counts.geiger += rows.length;
        var lim = limitOf(q, 0);
        if (nonEq && !nonEq.length) return lim ? rows.slice(0, lim) : rows;
        S.counts.passthrough_non_equity += nonEq ? nonEq.length : 1;
        var csPass = nonEq
          ? 'composite_staged?select=ticker,tf,trend,momentum,composite,updated_ts&tf=eq.D&ticker=in.(' + nonEq.join(',') + ')'
          : 'composite_staged?select=ticker,tf,trend,momentum,composite,updated_ts&tf=eq.D&limit=2000';
        return origPg(csPass)
          .then(function (extra) {
                  var kept = (extra || []).filter(function (r) {
                    return !own[String(r && r.ticker || '').toUpperCase()];
                  });
                  var all = rows.concat(kept); return lim ? all.slice(0, lim) : all; },
                function (e) {
                  /* Half a request is not a request - see the live_quotes branch. */
                  (nonEq || []).forEach(function (sym) { S.clearAbsence(sym, 'D'); });
                  if (e && (e.scTransport || e.scAbsence)) throw e;
                  throw transportError('non-equity composite passthrough failed: ' + (e && e.message || 'unknown'), path, null);
                });
      });
    }

    if (p.table === 'ohlcv_history') {
      var oT = wantedTickers(q);
      if (!oT || oT.length !== 1) {
        note('ohlcv_history without a single ticker', path);
        return Promise.reject(S.absenceError(ABSENCE_TICKER_FILTER_REQUIRED, (oT || []).join(','), null));
      }
      var sym = oT[0];
      var rawTf = (q.tf || '').replace(/^eq\./, '');
      var tf = TF[rawTf];
      return providerOwned(signal, origPg).then(function (own) {
        if (!own[sym]) { S.counts.passthrough_non_equity++; return origPg(path); }   // non-equity keeps its owner
        if (!tf) {
          note('unmapped timeframe ' + rawTf, path);
          return Promise.reject(S.absenceError(ABSENCE_TIMEFRAME_NOT_MAPPED, sym, rawTf));
        }
        var lim = limitOf(q, 200);
        return jget(API + '/candles?symbol=' + encodeURIComponent(sym) + '&tf=' + encodeURIComponent(tf) +
                    '&authority=provider&limit=' + Math.min(lim, 400), signal).then(function (j) {
          /* The provider may name the absence itself. When it does, that name is kept verbatim
             and preferred over the generic one - it is closer to the truth than anything here. */
          var named = j && (j.absence || j.reason || (j.state && j.state !== 'OK' ? j.state : null));
          if (!j) { note('candles unreachable', sym + '/' + tf); return Promise.reject(new Error('candles unreachable')); }
          /* SHORT IS NOT ABSENT.
             An empty or one-bar series used to be recorded as NOT_OBSERVED_BY_STREAM. But one
             real bar is proof the stream observes this symbol; a series too short to draw is a
             partial or still-warming answer, and inventing a terminal name for it retires a
             live symbol from the wall permanently. Only a name the PROVIDER supplied is
             terminal here. */
          if (!j.series || !j.series.length) {
            if (named) return Promise.reject(S.absenceError(named, sym, rawTf));
            note('provider returned an unnamed empty series', sym + '/' + tf);
            S.clearAbsence(sym, rawTf);
            return Promise.reject(transportError('provider series empty and unnamed for ' + sym + '/' + tf,
              API + '/candles', null));
          }
          if (named) return Promise.reject(S.absenceError(named, sym, rawTf));
          S.counts.candles += j.series.length;
          S.clearAbsence(sym, rawTf);
          // Legacy shape: seconds, newest first, close/open/high/low/volume.
          var out = j.series.map(function (b) {
            return { ticker: sym, timestamp: Math.floor(b.t / 1000), close: +b.c, open: +b.o,
                     high: +b.h, low: +b.l, volume: +b.v };
          }).reverse();
          return out.slice(0, lim);
        });
      });
    }
    return null;                       // not an equity table: caller proceeds normally
  }

  /* SOME PAGES BYPASS pg() ENTIRELY and call fetch(SB + "/rest/v1/<table>?...") directly —
     analytics/ and templates/sector-rotation.html both do. Intercepting only pg() would leave those
     reading the legacy table while every other surface had moved, which is exactly the kind of
     half-migration that produces two surfaces disagreeing about the same stock. This closes the
     class at the fetch boundary, so it does not matter how a page chooses to ask.

     Requests this shim itself issues carry a marker and are never re-intercepted. */
  var MARK = 'sc_shim=1';
  function fakeResponse (rows) {
    return { ok: true, status: 200, headers: { get: function () { return 'application/json'; } },
             json: function () { return Promise.resolve(rows); },
             text: function () { return Promise.resolve(JSON.stringify(rows)); } };
  }
  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    try {
      if (url.indexOf(MARK) < 0 && /\/rest\/v1\/(live_quotes|composite_staged|ohlcv_history)\b/.test(url)) {
        var path = url.split('/rest/v1/')[1];
        /* A non-OK Supabase status is a failed read, not an empty table. Returning [] here
           made every 5xx, 401 and 400 look like "this passthrough legitimately has no rows". */
        /* The caller's own AbortController travels with the request. The deck bounds its
           quote fetch at 4.5s; without this the shim's replacement read ignored that entirely
           and only the shim's own independent timer applied. */
        var r = handle(path, function (p2) {
          return origFetch(SBBASE(url) + '/rest/v1/' + p2 + (p2.indexOf('?') < 0 ? '?' : '&') + MARK, init)
            .then(function (rr) {
              if (!rr.ok) throw transportError('supabase HTTP ' + rr.status, p2, rr.status);
              return rr.json();
            });
        }, init && init.signal);
        /* A NAMED ABSENCE IS NOT A FAILED REQUEST. Over pg() it is raised so the caller can
           paint the name; over fetch() the honest HTTP answer is a successful read carrying no
           rows, because that is exactly what happened. The name is still recorded on the shim,
           so a caller that wants it asks SC_PROVIDER_SHIM.absenceFor(sym, tf). Rejecting here
           instead would make a settled answer look like a broken connection - the very
           conversion this change exists to stop. */
        if (r) return r.then(fakeResponse, function (err) {
          if (err && err.scAbsence) return fakeResponse([]);
          throw err;
        });
      }
    } catch (e) {
      /* FAIL CLOSED. Falling through to origFetch here would send an equity read straight to
         the legacy Supabase table - the exact path this shim exists to close - and it would do
         it precisely when the shim is malfunctioning and least able to notice. */
      note('fetch shim threw: ' + e.message, url);
      if (/\/rest\/v1\/(live_quotes|composite_staged|ohlcv_history)\b/.test(url))
        return Promise.reject(transportError('provider shim threw: ' + e.message, url, null));
    }
    return origFetch(input, init);
  };
  function SBBASE (url) { var i = url.indexOf('/rest/v1/'); return i < 0 ? '' : url.slice(0, i); }

  /* Install over a page's own pg(). Called after the page defines it. */
  window.scInstallProviderShim = function () {
    if (S.installed || typeof window.pg !== 'function') return S.installed;
    var orig = window.pg;
    window.pg = function (path, tries) {
      try {
        var r = handle(String(path), function (p2) { return orig(p2, tries); });
        if (r) return r;
      } catch (e) {
        /* A bug in here is a failure to ask, not an answer. Resolving [] made it look like a
           settled empty result and let a pane paint a permanent absence over a broken shim. */
        note('shim threw: ' + e.message, path);
        return Promise.reject(transportError('provider shim threw: ' + e.message, path, null));
      }
      if (/ohlcv_history|live_quotes|composite_staged/.test(String(path))) {
        S.legacy_equity_calls.push(String(path).slice(0, 160));   // visible breach, never silent
      }
      return orig(path, tries);
    };
    S.installed = true;
    return true;
  };
})();
