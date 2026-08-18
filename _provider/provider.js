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
    counts: { quotes: 0, geiger: 0, candles: 0, passthrough_non_equity: 0, unsatisfied: 0 },
    unsatisfied: [],
    legacy_equity_calls: []          // must stay empty; anything here is a contract breach
  };

  // ---- caches. Short TTLs matching each route's own cache-control. -----------------------------
  var qCache = { at: 0, map: {} }, gCache = { at: 0, map: null }, ownedAt = 0, owned = null;

  function jget (url) {
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  /* The set of symbols the provider owns. Anything outside it keeps its existing owner. */
  function providerOwned () {
    if (owned && Date.now() - ownedAt < 300000) return Promise.resolve(owned);
    return jget(API + '/geiger').then(function (j) {
      if (!j || !j.symbols) return owned || {};
      owned = {}; Object.keys(j.symbols).forEach(function (k) { owned[k] = 1; });
      ownedAt = Date.now();
      S.equalizer_receipt = j.equalizer_receipt_sha256;
      return owned;
    });
  }

  function quotes (syms) {
    var need = syms.filter(function (s) { return !(s in qCache.map); });
    if (Date.now() - qCache.at < 5000 && !need.length) return Promise.resolve(qCache.map);
    var batch = syms.slice(0, 400);
    if (!batch.length) return Promise.resolve(qCache.map);
    return jget(API + '/quotes?symbols=' + encodeURIComponent(batch.join(','))).then(function (j) {
      if (j && j.quotes) { Object.keys(j.quotes).forEach(function (k) { qCache.map[k] = j.quotes[k]; }); qCache.at = Date.now(); }
      return qCache.map;
    });
  }

  function geiger () {
    if (gCache.map && Date.now() - gCache.at < 30000) return Promise.resolve(gCache.map);
    return jget(API + '/geiger').then(function (j) {
      if (j && j.symbols) { gCache.map = j.symbols; gCache.at = Date.now(); S.equalizer_receipt = j.equalizer_receipt_sha256; }
      return gCache.map || {};
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
        return quotes(eq).then(function (qm) {
          var rows = [];
          eq.forEach(function (s) {
            var v = qm[s];
            if (!v || v.state !== 'OK') { note('no provider quote', s); return; }
            var price = +v.price, prev = +v.previous_close;
            rows.push({
              ticker: s, price: price, prev_close: prev,
              chg_pct: (prev ? (price - prev) / prev * 100 : null),
              change: (prev ? price - prev : null),
              volume: null,                 // the provider quote carries no volume; null, never 0
              updated_ts: v.price_sip_utc || null,
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
                   updated_ts: Math.floor(Date.now() / 1000),
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
      if (!oT || oT.length !== 1) { note('ohlcv_history without a single ticker', path); return Promise.resolve([]); }
      var sym = oT[0];
      var rawTf = (q.tf || '').replace(/^eq\./, '');
      var tf = TF[rawTf];
      return providerOwned().then(function (own) {
        if (!own[sym]) { S.counts.passthrough_non_equity++; return origPg(path); }   // non-equity keeps its owner
        if (!tf) { note('unmapped timeframe ' + rawTf, path); return []; }
        var lim = limitOf(q, 200);
        return jget(API + '/candles?symbol=' + encodeURIComponent(sym) + '&tf=' + encodeURIComponent(tf) +
                    '&authority=provider&limit=' + Math.min(lim, 400)).then(function (j) {
          if (!j || !j.series) { note('no provider series', sym + '/' + tf); return []; }
          S.counts.candles += j.series.length;
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
        var r = handle(path, function (p2) { return origFetch(SBBASE(url) + '/rest/v1/' + p2 + (p2.indexOf('?') < 0 ? '?' : '&') + MARK, init).then(function (rr) { return rr.ok ? rr.json() : []; }); });
        if (r) return r.then(fakeResponse);
      }
    } catch (e) { note('fetch shim threw: ' + e.message, url); }
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
      } catch (e) { note('shim threw: ' + e.message, path); return Promise.resolve([]); }
      if (/ohlcv_history|live_quotes|composite_staged/.test(String(path))) {
        S.legacy_equity_calls.push(String(path).slice(0, 160));   // visible breach, never silent
      }
      return orig(path, tries);
    };
    S.installed = true;
    return true;
  };
})();
