/* THE GEIGER COMPOSITE BAR ON STATION CHARTS (G1-STATION-GEIGER-BAR, 27 Sep 2026).
   ============================================================================
   Alan, 27 Sep: "what I do really like is the Geiger composite bar at the top left… adding the
   Geiger bars to the Station charts somewhere small. Very small, very executive."

   WHAT IT IS: the Hub company view's GEIGER COMPOSITE bar (index.html .gs-cgr, painted by
   buildGeigerSummary), shrunk to 48 x 6 beside the chart badge. Same reading, same scale, same
   colours:
     - the reading is the composite on the fixed -1 ... +1 scale, centre = 0;
     - the fill grows from the centre, right for >= 0 and left for < 0, |v| clamped to 1 = half
       the track (the Hub's `Math.min(Math.abs(c), 1) * 50`);
     - green (--bull) at or above zero, red (--bear) below - the Hub's --gs-bull / --gs-bear, which
       are the pane's own --bull / --bear. There is no grey "neutral" band: the Hub's number goes
       to a light grey under 0.10, and the Station's rule is that a reading has a direction.

   WHERE THE NUMBER COMES FROM (the same two owners the Hub uses):
     - the 364 provider equities (funds such as SPY and QQQ included): the chart API's /geiger
       artifact, computed from Massive provider bars under the saved Equalizer, admitted only
       under the accepted Equalizer receipt (SC_PROVIDER.equityGeiger / equityGeigerOne);
     - the 22 non-equities (index futures, VIX, rates, crypto): the retained non-equity daily
       Geiger row (SC_NON_EQUITY.geiger - the one the Hub also reads for them), which only the
       deck can read - the chart pane has no database reader.

   NO READING, NO BAR. null, undefined, "" and NaN are absence. Number(null) is 0, so every
   reading is parsed here and nowhere else: a name with no reading shows nothing, never a zero.

   Pure functions: this file reads no data and draws nothing, so a chart that fails to load it
   simply has no Geiger bar. */
(function (root) {
  "use strict";

  /* The normal recompute cadence of each owner, MEASURED 27 Sep 2026 from the live stamps:
     /geiger computed_utc moved about every 4 minutes; the non-equity row's updated_ts every 60 s.
     The bar dims when its reading is older than that cadence plus the Station's own pickup
     delay (the deck reads once a minute, and the provider client may hold /geiger for 30 s),
     i.e. when at least one recompute has been missed. */
  var SOURCES = {
    PROVIDER_EQUALIZER: { label: "chart API /geiger · Massive provider bars · saved Equalizer", cadenceMs: 4 * 60000 },
    RETAINED_NON_EQUITY: { label: "retained non-equity daily Geiger row (the Hub's owner for these names)", cadenceMs: 60000 }
  };
  var PICKUP_MS = 90000;          /* 60 s deck cadence + 30 s provider cache */
  var TRACK_PX = 48, HEIGHT_PX = 6;

  function value (raw) {
    if (raw === null || raw === undefined || raw === "" || typeof raw === "boolean") return null;
    var v = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(v) ? v : null;
  }

  /* An ISO string, or epoch seconds (the non-equity row), or epoch milliseconds. Unknown is null. */
  function stampMs (raw) {
    if (raw === null || raw === undefined || raw === "") return null;
    if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? (raw < 1e12 ? raw * 1000 : raw) : null;
    if (/^\d+(\.\d+)?$/.test(String(raw))) return stampMs(Number(raw));
    var t = Date.parse(String(raw));
    return Number.isFinite(t) ? t : null;
  }

  function staleAfterMs (source) {
    var s = SOURCES[source];
    return s ? s.cadenceMs + PICKUP_MS : null;
  }

  function signed (v) {
    return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
  }

  function ageText (ms) {
    if (!Number.isFinite(ms) || ms < 0) return "";
    var m = Math.round(ms / 60000);
    if (m < 1) return "under a minute old";
    if (m < 90) return m + " min old";
    var h = Math.round(m / 60);
    return h < 48 ? h + " h old" : Math.round(h / 24) + " days old";
  }

  /* reading: { composite, stamp, source } -> what the pane draws, or null for nothing at all. */
  function model (reading, nowMs) {
    if (!reading || typeof reading !== "object") return null;
    var v = value(reading.composite);
    if (v === null) return null;
    var now = Number.isFinite(nowMs) ? nowMs : Date.now();
    var at = stampMs(reading.stamp);
    var limit = staleAfterMs(reading.source);
    var age = at === null ? null : Math.max(0, now - at);
    /* A reading with no stamp is not called stale - there is no time to judge - and says so. */
    var stale = age !== null && limit !== null && age > limit;
    var src = SOURCES[reading.source];
    var title = "Geiger composite " + signed(v) + " (scale −1 to +1)" +
      "\n" + (src ? src.label : "source not named") +
      "\n" + (at === null ? "no compute time on this reading"
        : "computed " + new Date(at).toISOString().replace(/\.\d{3}Z$/, "Z") + " · " + ageText(age)) +
      (stale ? "\nolder than this source normally is - at least one recompute has been missed" : "");
    /* GL1 (7 Oct 2026) — TREND AND MOMENTUM APART, AND WHICH READING IT IS. Alan: "I would like to see [trend and
       momentum] separately." Both were always in the provider's answer; since GL1 it also says `reading` ("live":
       every rung counts the bar it is still building; "settled": finished bars only) and `price_utc`, the newest
       price in the numbers. They are only MODELLED here; the pane draws them when tmOn() says so. A reading
       without them (a non-equity row, an older answer) models exactly as before. */
    var tr = value(reading.trend), mo = value(reading.momentum);
    var part = function (x) { return x === null ? null : { value: x, side: x >= 0 ? "up" : "down", fillPct: Math.min(Math.abs(x), 1) * 50, text: signed(x) }; };
    var rd = reading.reading === "live" || reading.reading === "settled" ? reading.reading : null;
    var priceAt = stampMs(reading.price_utc);
    var priceAge = priceAt === null ? null : Math.max(0, now - priceAt);
    var tm = tr === null && mo === null ? null : { trend: part(tr), momentum: part(mo),
      text: signed(v) + " · T " + (tr === null ? "—" : signed(tr)) + " · M " + (mo === null ? "—" : signed(mo)) };
    if (tm) title += "\ntrend " + (tr === null ? "—" : signed(tr)) + " · momentum " + (mo === null ? "—" : signed(mo));
    if (rd) title += "\n" + (rd === "live" ? "LIVE: every rung counts the bar it is still building" : "SETTLED: finished bars only") +
      (priceAge === null ? "" : " · newest price " + ageText(priceAge));
    return {
      value: v,
      side: v >= 0 ? "up" : "down",
      fillPct: Math.min(Math.abs(v), 1) * 50,
      text: signed(v),
      stampMs: at,
      ageMs: age,
      stale: stale,
      title: title,
      tm: tm,
      reading: rd,
      priceAgeMs: priceAge
    };
  }

  /* GL1 — drawn only when switched on (no look change goes live without Alan's word): ?gl1=1 in the pane's or the
     deck's address, or localStorage sc_gl1_tm = "1". */
  function tmOn () {
    try {
      if (root.SC_GL1_TM === true) return true;
      var href = String((root.location && root.location.href) || "");
      var top = "";
      try { top = String((root.parent && root.parent !== root && root.parent.location && root.parent.location.href) || ""); } catch (_) { top = ""; }
      if (/[?&#]gl1=1(?![0-9])/.test(href) || /[?&#]gl1=1(?![0-9])/.test(top)) return true;
      return !!(root.localStorage && root.localStorage.getItem("sc_gl1_tm") === "1");
    } catch (_) { return false; }
  }
  /* the two thin bars' markup and the chip's text, for a model that has them; "" otherwise */
  function tmBarsHTML (m) {
    if (!m || !m.tm) return "";
    var one = function (p, k) {
      return '<span class="sc-gbar sc-gbar--thin" data-k="' + k + '"' + (p ? ' data-side="' + p.side + '"' : "") + ">" +
        (p ? '<i style="' + (p.side === "up" ? "left" : "right") + ":50%;width:" + p.fillPct.toFixed(2) + '%"></i>' : "") + "</span>";
    };
    return one(m.tm.trend, "T") + one(m.tm.momentum, "M");
  }

  /* The fill's inline style: anchored at the centre, growing out to one side. */
  function fillStyle (m) {
    if (!m) return "";
    return (m.side === "up" ? "left" : "right") + ":50%;width:" + m.fillPct.toFixed(2) + "%";
  }

  /* Rows from either owner -> { TICKER: { composite, stamp, source } }. Rows with no reading are
     dropped here, so a missing name is simply absent from the map. */
  function readingsFrom (rows, source) {
    var out = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      var t = String(row && row.ticker || "").toUpperCase();
      if (!t || value(row.composite) === null) return;
      var stamp = row.computed_utc != null ? row.computed_utc : row.updated_ts;
      var prev = out[t];
      if (prev && (stampMs(prev.stamp) || 0) >= (stampMs(stamp) || 0)) return;   /* newest row wins */
      out[t] = { composite: value(row.composite), stamp: stamp == null ? null : stamp, source: source };
      /* GL1 — carried when the row has them; a row without them is exactly the reading it was */
      if (value(row.trend) !== null) out[t].trend = value(row.trend);
      if (value(row.momentum) !== null) out[t].momentum = value(row.momentum);
      if (row.reading === "live" || row.reading === "settled") out[t].reading = row.reading;
      if (row.price_utc) out[t].price_utc = row.price_utc;
    });
    return out;
  }

  /* HOW BIG THE CHIP IS ON A PANE (N10, 28 Sep). Alan: "Let's make the Geiger chip bigger. We have a ton
     of space there… It seems undersized versus the numerical value - maintain proportions, match the
     height of the numerical value. Don't go too crazy on the 8-chart layouts, we're tighter on space."
     The chip's number takes the size of the badge's price beside it (the badge already sizes itself to
     the pane), and the bar is as tall as that number's capital letters (CSS `1cap`). Only the bar's
     length depends on how much room the pane has, in ems of that number, measured on the live wall
     (28 Sep, 1680 wide): 8-up and 6-up panes are 419 x 277, 4-up 840 x 277, 2-up 840 x 554, one chart
     alone 1680 x 1021; a phone pane is 390 wide.
       s  - narrow pane (8-up, 6-up, phone): 5 em    (12 px number -> 60 x 8.5; was 48 x 6)
       m  - wide but short (4-up):          5.5 em
       l  - wide and tall (2-up):           6 em
       xl - one chart alone:                7 em
     areaW / areaH: the pane's plot area in CSS px; badgePx: the badge's computed font size. */
  function chipSize (areaW, areaH, badgePx) {
    var w = Number(areaW) || 0, h = Number(areaH) || 0, px = Number(badgePx);
    var font = Number.isFinite(px) && px > 0 ? Math.round(Math.max(11, Math.min(18, px)) * 10) / 10 : 12;
    var tier = w >= 1200 && h >= 600 ? "xl" : w >= 700 && h >= 440 ? "l" : w >= 700 ? "m" : "s";
    var bar = { s: 5, m: 5.5, l: 6, xl: 7 }[tier];
    return { tier: tier, font: font, barEm: bar, key: tier + ":" + font };
  }

  root.SC_GEIGER_BAR = {
    SOURCES: SOURCES, PICKUP_MS: PICKUP_MS, TRACK_PX: TRACK_PX, HEIGHT_PX: HEIGHT_PX,
    value: value, stampMs: stampMs, staleAfterMs: staleAfterMs, signed: signed,
    model: model, fillStyle: fillStyle, readingsFrom: readingsFrom, chipSize: chipSize,
    tmOn: tmOn, tmBarsHTML: tmBarsHTML
  };
})(typeof window !== "undefined" ? window : globalThis);
