/* SCINTILLA · STATION — THE OSCILLATOR PANE THE WAY INDICATOR LAB DRAWS IT (S7, 2 Oct): RSI + Williams %R, ONE pane.
   ============================================================================
   Alan, 2 Oct ~09:25 ET: "MRG — what is MRG? I have no clue what that is… Take a look at how Indicator Lab put it on the
   TradingView desktop app ('Scintilla RSI plus Williams MTF review V2'). Take it as the guide. Display the merged one —
   the merged one is enough… it doesn't look right to me compared with what Indicator Lab last did."

   THE GUIDE (read, never edited): INDICATOR_LAB/sprints/2026-10-02-rotation/
   SCINTILLA_RSI_Williams_MTF_REVIEW_V2_Clear_Value.pine. "No Stoch, W/K dedupe, Geiger blend, new smoothing, clamping or
   normalization." So S6's 60/40 blend of the Geiger's stretched, clamped maps is gone. What the pane draws instead:
     · RSI 14, native 0-100: 3H 4H 6H 8H 12H solid width 1 on the opacity ladder (12H 66% … 3H 54%), the Daily solid
       width 3 at 90%, painted last;
     · Williams %R 14 + 100 (a display shift ONLY, so its native -100…0 sits on 0-100): the same timeframes, the same pink
       and ladder, DOTTED; the Daily dotted width 2 at 90%;
     · the RSI-only cloud: min/max of the raw RSI on 2D 3D W 2W, muted pink #C84C86 at 30%, none if one is missing;
     · guides 30/70 solid, 20/80 dashed, 50 dotted; 0 and 100 not drawn; the 0-100 scale is never clipped to 20-80;
     · two daily chips at their exact heights: "RSI D 49.2" and, further right, "W D 85.6 · %R −14.4" (the plotted height
       first, the native Williams value second).
   One pink family (#FF4FAD) for everything.

   Pure functions. No fetch, no DOM, no clock of its own. */
(function (root) {
  "use strict";

  const WILLIAMS_PERIOD = 14, SHIFT = 100;

  /* Williams %R(14) at every bar, TradingView's ta.wpr(14): 100 * (close - highest high) / (highest high - lowest low) over
     the last 14 bars, this one included. bars [{ h, l, c }] ascending. A bar without its own high and low cannot give an
     honest range, so any window that holds one is null (never filled from closes); a flat window (high = low) is null too,
     as ta.wpr's division by zero is na in Pine. */
  function williamsValues(bars, period) {
    const n = period || WILLIAMS_PERIOD, list = bars || [], out = new Array(list.length).fill(null);
    for (let i = n - 1; i < list.length; i++) {
      let hh = -1e18, ll = 1e18, ok = true;
      for (let j = i - n + 1; j <= i; j++) {
        const b = list[j];
        if (!b || !Number.isFinite(b.h) || !Number.isFinite(b.l)) { ok = false; break; }
        if (b.h > hh) hh = b.h; if (b.l < ll) ll = b.l;
      }
      const c = list[i] && list[i].c;
      if (!ok || !Number.isFinite(c) || !(hh > ll)) continue;
      out[i] = 100 * (c - hh) / (hh - ll);
    }
    return out;
  }
  /* the Lab's display shift and back: native -100…0 <-> plotted 0…100 (w = ta.wpr(14) + 100) */
  const toPlot = (wr) => (Number.isFinite(wr) ? wr + SHIFT : null);
  const toNative = (p) => (Number.isFinite(p) ? p - SHIFT : null);

  /* One source's two series from its RSI series (station-rsi-fan lineSeries: [{ t, end, v, approx, forming }]) and the same
     bars' Williams values. Every Williams point keeps the RSI point's clock (t, end, forming), so the fan's sampling,
     developing tip and STALE rule apply unchanged. RSI is passed through untouched. */
  function deriveSets(rsiSeries, wrValues) {
    const s = rsiSeries || [], w = wrValues || [];
    const williams = s.map((p, i) => { const q = Object.assign({}, p); q.v = w[i] == null ? null : toPlot(w[i]); return q; });
    return { rsi:s, williams };
  }

  /* ---- what the pane looks like: the Lab's script, line by line ---------------------------------------------------- */
  const DOT = Object.freeze([1, 2]), DASH = Object.freeze([4, 3]);
  const PINK = "#FF4FAD", PINK_CLOUD = "#C84C86";
  /* hline opacities from the script's transparencies: 30/70 color.new(pink, 30) -> 70%; 20/80 (55) -> 45%; 50 (70) -> 30% */
  const g = (v, opacity, dash) => Object.freeze({ v, opacity, width:1, dash:dash || null });
  const LOOK = Object.freeze({ key:"lab", ink:PINK, cloud:Object.freeze({ ink:PINK_CLOUD, opacity:.30 }),
    domain:Object.freeze([0, 100]), padPx:3, title:"RSI + WILLIAMS %R",
    guides:Object.freeze([g(80, .45, DASH), g(70, .70), g(50, .30, DOT), g(30, .70), g(20, .45, DASH)]),
    chipLook:Object.freeze({ text:.95, fill:.18, leader:.55, gap:6 }),
    /* the Williams chip sits this much further right than the RSI chip (the script's wDailyOffset, in px) */
    wChipOffset:14 });
  /* how one line is stroked. spec is the fan's line (station-rsi-fan BY_KEY: alpha = the ladder, width, daily).
     RSI: solid at the fan's width (intraday 1, Daily 3). Williams: dotted, intraday 1, Daily 2. Same opacity for both. */
  function lineStyle(set, spec) {
    const daily = !!(spec && spec.daily), alpha = spec && spec.alpha != null ? spec.alpha : 1;
    if (set === "williams") return { alpha, width:daily ? 2 : 1, dash:DOT };
    return { alpha, width:spec && spec.width ? spec.width : 1, dash:null };
  }
  /* The paint order, the script's explicit_plot_zorder: Williams 12H…3H then its Daily, then RSI 12H…3H, the RSI Daily last.
     lines: { rsi:[{ key, values }], williams:[…] }; isDaily(key). Returns [{ set, line }] back to front. */
  function paintOrder(lines, isDaily) {
    const out = [];
    for (const set of ["williams", "rsi"]) {
      const l = (lines && lines[set]) || [];
      const fast = l.filter((x) => x.values && !isDaily(x.key)).reverse(), day = l.filter((x) => x.values && isDaily(x.key));
      for (const line of fast.concat(day)) out.push({ set, line });
    }
    return out;
  }
  /* value -> y inside [top, top + height] on the fixed 0-100 domain, padPx kept at each end */
  function lookY(v, top, height) {
    const p = LOOK.padPx, lo = LOOK.domain[0], hi = LOOK.domain[1];
    return top + p + (1 - (v - lo) / (hi - lo)) * Math.max(1, height - 2 * p);
  }
  const fmt = (v) => (v == null || !Number.isFinite(v) ? "—" : v < 0 ? "−" + Math.abs(v).toFixed(1) : v.toFixed(1));
  /* the two daily chips: "RSI D 49.2" · "W D 85.6 · %R −14.4" (plotted height first, the native Williams value second) */
  const rsiChip = (v) => "RSI D " + fmt(v);
  const williamsChip = (p) => "W D " + fmt(p) + " · %R " + fmt(toNative(p));
  /* one timeframe on the hover row: "3H R54.8 W79.5" (Williams on the plotted 0-100 scale) */
  const hoverItem = (label, r, w) => label + " R" + fmt(r) + " W" + fmt(w);
  const HOVER_SEP = " · ";

  /* WHICH HOVER THE PANE PRINTS. A COMPACT pane - inside the deck or the Hub, and not the deck's ⤢ pane nor the Hub's
     EXPAND - prints the Daily alone ("D R49.2 W85.6"). An expanded pane, or the chart opened on its own, prints every visible
     timeframe ("3H R54.8 W79.5 · … · D R49.2 W85.6"). Either way ONE row, never wrapped. */
  function readoutFor(o) {
    if (!o || o.deckFull || o.hubSplit === true) return "full";
    return o.embedded ? "compact" : "full";
  }

  root.SC_OSC_LAB = Object.freeze({
    WILLIAMS_PERIOD, SHIFT, LOOK, DOT, DASH, PINK, PINK_CLOUD, HOVER_SEP,
    williamsValues, toPlot, toNative, deriveSets, lineStyle, paintOrder, lookY, fmt, rsiChip, williamsChip, hoverItem, readoutFor
  });
})(typeof globalThis === "object" ? globalThis : window);
