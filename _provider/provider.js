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
              transport_failures: 0, partial_batches: 0 },
    unsatisfied: [],
    /* Transport failures are kept SEPARATELY from named absences. One is "we could not ask",
       the other is "we asked and the answer was no". A single list would lose that. */
    transport_failures: [],
    /* The provider's own compute time for the Geiger, carried verbatim. Null means unknown -
       never a stand-in read from this machine's clock. */
    geiger_computed_utc: null,
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
      var m = window.SC_PROVIDER_SHIM.owned_map;
      return !!(m && Object.keys(m).length);
    },
    realtime_unknown_ownership_refused: 0,
    realtime_equity_refused: 0,
    realtime_nonequity_passthrough: 0,

    /* NAMED ABSENCE, KEPT BY SYMBOL AND TIMEFRAME.
       `unsatisfied` is a rolling diagnostic log capped at 40 entries; it cannot answer
       "why is THIS pane empty" once the log has rolled. Callers need a name they can paint,
       so every absence is also recorded here under its own key and never evicted by a later
       unrelated one. Nothing is substituted for the missing data - only named. */
    absences: {},
    absenceFor: function (sym, tf) {
      var a = window.SC_PROVIDER_SHIM.absences;
      var key = String(sym || '').toUpperCase();
      return (tf ? a[key + '|' + String(tf)] : null) || a[key] || null;
    },
    noteAbsence: function (sym, tf, reason) {
      var key = String(sym || '').toUpperCase();
      var named = String(reason || 'NOT_OBSERVED_BY_STREAM');
      window.SC_PROVIDER_SHIM.absences[key] = named;
      if (tf) window.SC_PROVIDER_SHIM.absences[key + '|' + String(tf)] = named;
      return named;
    },
    clearAbsence: function (sym, tf) {
      var a = window.SC_PROVIDER_SHIM.absences;
      var key = String(sym || '').toUpperCase();
      delete a[key];
      if (tf) delete a[key + '|' + String(tf)];
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
  var qCache = { at: 0, map: {} }, gCache = { at: 0, map: null }, ownedAt = 0, owned = null;

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
  function jget (url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw transportError('provider HTTP ' + r.status, url, r.status);
      return r.json().catch(function () { throw transportError('provider body was not JSON', url, r.status); });
    }, function (e) {
      if (e && e.scTransport) throw e;
      throw transportError('provider unreachable: ' + (e && e.message || 'network'), url, null);
    });
  }

  /* OWNERSHIP MUST FAIL CLOSED.
     A cold /geiger failure used to resolve to {}, and an empty ownership map means "the
     provider owns nothing" - so every equity looked like a non-equity and was passed
     straight through to the legacy Supabase tables. A provider outage silently reinstated
     exactly the data path this shim exists to close. An unknown ownership answer is an
     ERROR now: callers retry, and nothing is routed on a guess. A previously resolved map is
     still usable while it is warm, because that is knowledge, not a guess. */
  function providerOwned () {
    if (owned && Date.now() - ownedAt < 300000) return Promise.resolve(owned);
    return jget(API + '/geiger').then(function (j) {
      if (!j || !j.symbols) {
        if (owned) return owned;                    // stale but real beats invented
        throw transportError('provider ownership unavailable', API + '/geiger', null);
      }
      owned = {};
      S.owned_map = owned; Object.keys(j.symbols).forEach(function (k) { owned[k] = 1; });
      ownedAt = Date.now();
      S.equalizer_receipt = j.equalizer_receipt_sha256;
      S.geiger_computed_utc = j.computed_utc || null;
      return owned;
    }, function (e) {
      if (owned) return owned;                      // warm knowledge survives one bad read
      throw e;                                      // cold failure stays a failure
    });
  }

  /* THE PROVIDER'S OWN OBSERVATION TIME, OR NOTHING.
     The live /quotes payload carries `price_observation_utc`. The field this shim originally
     read, `price_sip_utc`, is not on the payload at all, so every row was stamped null - and
     null then travelled into surfaces that read `new Date(null)` as the epoch and called it a
     finite timestamp. The preference list is written out so a field rename shows up as a
     missing stamp rather than as a wrong one, and an unknown time stays null: this function
     never returns a clock reading of its own. */
  var QUOTE_TIME_FIELDS = ['price_observation_utc', 'observation_utc', 'price_sip_utc', 'as_of_utc'];
  function quoteObservedAt (q) {
    if (!q) return null;
    for (var i = 0; i < QUOTE_TIME_FIELDS.length; i++) {
      var v = q[QUOTE_TIME_FIELDS[i]];
      if (v == null || v === '') continue;
      var t = new Date(v).getTime();
      if (isFinite(t)) return v;
    }
    return null;
  }

  /* A BATCH THAT COMES BACK SHORT IS NOT A SET OF NAMED ABSENCES.
     The provider names an absence per symbol - EQR answers NOT_OBSERVED_BY_STREAM with a null
     price, and that IS settled. A symbol the response never mentions is a different thing: the
     batch was incomplete, which is a transport condition and stays retryable. Conflating the
     two would let one truncated response mark a live symbol permanently unobserved. */
  function quoteAbsenceName (q) {
    if (!q) return null;
    if (q.state && q.state !== 'OK') return String(q.state);
    if (q.absence) return String(q.absence);
    if (q.reason) return String(q.reason);
    if (q.price == null) return ABSENCE_NOT_OBSERVED;
    return null;
  }
  function quotes (syms) {
    var need = syms.filter(function (s) { return !(s in qCache.map); });
    if (Date.now() - qCache.at < 5000 && !need.length) return Promise.resolve({ map: qCache.map, missing: [] });
    var batch = syms.slice(0, 400);
    if (!batch.length) return Promise.resolve({ map: qCache.map, missing: [] });
    return jget(API + '/quotes?symbols=' + encodeURIComponent(batch.join(','))).then(function (j) {
      if (!j || !j.quotes) throw transportError('provider quotes payload had no quotes', API + '/quotes', null);
      Object.keys(j.quotes).forEach(function (k) { qCache.map[k] = j.quotes[k]; });
      qCache.at = Date.now();
      var missing = batch.filter(function (sym) { return !(sym in j.quotes); });
      if (missing.length) S.counts.partial_batches++;
      return { map: qCache.map, missing: missing };
    });
  }

  function geiger () {
    if (gCache.map && Date.now() - gCache.at < 30000) return Promise.resolve(gCache.map);
    return jget(API + '/geiger').then(function (j) {
      if (!j || !j.symbols) {
        if (gCache.map) return gCache.map;
        throw transportError('provider geiger unavailable', API + '/geiger', null);
      }
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
  function handle (path, origPg) {
    var p = parse(path), q = p.q;

    if (p.table === 'live_quotes') {
      var lqT = wantedTickers(q);
      return providerOwned().then(function (own) {
        var syms = lqT || Object.keys(own);
        var eq = syms.filter(function (s) { return own[s]; });
        var nonEq = syms.filter(function (s) { return !own[s]; });
        return quotes(eq).then(function (res) {
          var qm = res.map, missing = res.missing;
          var rows = [];
          /* A symbol the batch never mentioned is INCOMPLETE, not absent. It is recorded as a
             transport condition so a caller retries it, and no absence name is written for it. */
          missing.forEach(function (sym) {
            transportError('quote missing from batch response', API + '/quotes', null);
            S.clearAbsence(sym, null);
          });
          eq.forEach(function (s) {
            var v = qm[s];
            if (!v) return;                              // covered by `missing` above
            var named = quoteAbsenceName(v);
            if (named) { note('provider named ' + named, s); S.noteAbsence(s, null, named); return; }
            var price = +v.price, prev = +v.previous_close;
            if (!isFinite(price)) { note('provider quote had no usable price', s); S.noteAbsence(s, null, ABSENCE_NOT_OBSERVED); return; }
            S.clearAbsence(s, null);
            rows.push({
              ticker: s, price: price, prev_close: isFinite(prev) ? prev : null,
              chg_pct: (isFinite(prev) && prev ? (price - prev) / prev * 100 : null),
              change: (isFinite(prev) && prev ? price - prev : null),
              volume: null,                 // the provider quote carries no volume; null, never 0
              /* The provider's own observation time, or null. Never this machine's clock. */
              updated_ts: quoteObservedAt(v),
              sc_source: 'MASSIVE_PROVIDER_D_BAR'
            });
          });
          S.counts.quotes += rows.length;
          if (!nonEq.length) return rows;
          // Non-equities keep their existing owner. Only they reach the legacy table.
          S.counts.passthrough_non_equity += nonEq.length;
          var pass = path.replace(/ticker=(in\.\([^)]*\)|eq\.[^&]*)/, 'ticker=in.(' + nonEq.join(',') + ')');
          if (!lqT) pass = 'live_quotes?select=ticker,price,chg_pct,prev_close,updated_ts&ticker=in.(' + nonEq.join(',') + ')';
          return origPg(pass).then(function (extra) { return rows.concat(extra || []); }, function () { return rows; });
        });
      });
    }

    if (p.table === 'composite_staged') {
      var csT = wantedTickers(q);
      return Promise.all([providerOwned(), geiger()]).then(function (a) {
        var own = a[0], gm = a[1];
        var syms = csT || Object.keys(own);
        var eq = syms.filter(function (s) { return own[s]; });
        var nonEq = syms.filter(function (s) { return !own[s]; });
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
        if (!nonEq.length) return lim ? rows.slice(0, lim) : rows;
        S.counts.passthrough_non_equity += nonEq.length;
        return origPg('composite_staged?select=ticker,tf,trend,momentum,composite,updated_ts&tf=eq.D&ticker=in.(' + nonEq.join(',') + ')')
          .then(function (extra) { var all = rows.concat(extra || []); return lim ? all.slice(0, lim) : all; },
                function () { return lim ? rows.slice(0, lim) : rows; });
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
      return providerOwned().then(function (own) {
        if (!own[sym]) { S.counts.passthrough_non_equity++; return origPg(path); }   // non-equity keeps its owner
        if (!tf) {
          note('unmapped timeframe ' + rawTf, path);
          return Promise.reject(S.absenceError(ABSENCE_TIMEFRAME_NOT_MAPPED, sym, rawTf));
        }
        var lim = limitOf(q, 200);
        return jget(API + '/candles?symbol=' + encodeURIComponent(sym) + '&tf=' + encodeURIComponent(tf) +
                    '&authority=provider&limit=' + Math.min(lim, 400)).then(function (j) {
          /* The provider may name the absence itself. When it does, that name is kept verbatim
             and preferred over the generic one - it is closer to the truth than anything here. */
          var named = j && (j.absence || j.reason || (j.state && j.state !== 'OK' ? j.state : null));
          if (!j) { note('candles unreachable', sym + '/' + tf); return Promise.reject(new Error('candles unreachable')); }
          if (!j.series || !j.series.length) {
            note('no provider series', sym + '/' + tf);
            return Promise.reject(S.absenceError(named || ABSENCE_NOT_OBSERVED, sym, rawTf));
          }
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
        var r = handle(path, function (p2) {
          return origFetch(SBBASE(url) + '/rest/v1/' + p2 + (p2.indexOf('?') < 0 ? '?' : '&') + MARK, init)
            .then(function (rr) {
              if (!rr.ok) throw transportError('supabase HTTP ' + rr.status, p2, rr.status);
              return rr.json();
            });
        });
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
