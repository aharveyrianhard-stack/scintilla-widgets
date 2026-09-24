/* SCINTILLA · STATION LENS — the Context Lens, as it is mounted in the chart pane.
   ============================================================================
   WHAT THIS IS, in plain words. The chart pane shows one view of the bars. The
   lens is a second, much smaller view of THE SAME live bars, at the opposite
   zoom, sitting inside the same pane:

       the main chart is zoomed out  ->  the lens zooms IN  (the last 30 bars)
       the main chart is zoomed in   ->  the lens pulls BACK (six times the window)

   Alan, 23 Sep: "Seems to replay in the zoom level of history. I don't really care
   about that. I care about the zoom in current bars." · "It's just a view of the
   current bars with the opposite view, and another view of the one that we're in on
   the charts and what it is."

   So: not a place you travel to, not a dropdown, not a replay of history. Both views
   always end on the SAME bar, and the wide mode is a multiple of what is on screen —
   never "all of history", which is the replay Alan threw out.

   WHERE THE TWO RULES COME FROM. This file ships what two reviewed modules already
   proved, so the Station draws the rule the tests check:
     · WHAT it shows  — deliverables/20260924/station-calm/lens/lens-view.mjs      (M51)
     · WHERE it sits  — a reserved band under the price, see PART TWO for why the
       M47 corner inset was measured and rejected for this pane
   tests/station-lens-mount.test.mjs runs this shipped copy and those two modules over
   the same cases and fails if they ever disagree, so the copy cannot drift.

   Everything here is arithmetic and geometry: NO fetch, NO DOM, NO timer, NO storage.
   It reads the bars the chart already holds and the geometry the chart already
   recorded when it painted (host._plot). That is why mounting it adds no network
   request and no second layout read.
   ========================================================================== */
(function (root) {
  "use strict";

  /* ======================================================================
     PART ONE — WHAT THE LENS LOOKS AT  (M51)
     ====================================================================== */

  var VIEW_DEFAULTS = Object.freeze({
    detailBars: 30,    // the zoomed-in window, in bars
    wideFactor: 6,     // the pulled-back window is this many times the main one
    zoomedInMax: 60,   // a main chart showing this few bars counts as "zoomed in"
    minBars: 5,        // below this there is nothing worth drawing
  });

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(Number(n) || 0))); }

  function view(mode, start, end, total, mainBars, why) {
    var bars = end - start + 1;
    return { mode: mode, start: Math.max(0, start), end: end, bars: bars, of: total,
      mainBars: mainBars,
      label: (mode === "wide" ? "WIDER · LAST " : "ZOOM · LAST ") + bars + " BARS", why: why };
  }
  function none(end, mainBars, why) {
    return { mode: "none", start: end, end: end, bars: 0, of: 0, mainBars: mainBars, label: "", why: why };
  }

  /* main: {total, start, end} — what the big chart is showing right now. */
  function lensView(main, opt) {
    var k = Object.assign({}, VIEW_DEFAULTS, opt || {});
    var total = Math.max(0, Math.round(Number(main && main.total) || 0));
    if (!total) return none(0, 0, "there are no bars yet");
    var end = clamp(main.end, 0, total - 1);
    var start = clamp(main.start, 0, end);
    var mainBars = end - start + 1;

    var wideBars = Math.min(total, mainBars * k.wideFactor);
    var wideOk = wideBars > mainBars;
    var detailBars = Math.min(k.detailBars, mainBars - 1);
    var detailOk = detailBars >= k.minBars;

    var zoomedIn = mainBars <= k.zoomedInMax;
    var order = zoomedIn ? ["wide", "detail"] : ["detail", "wide"];
    for (var i = 0; i < order.length; i++) {
      var mode = order[i];
      if (mode === "wide" && wideOk) return view("wide", end - wideBars + 1, end, total, mainBars,
        zoomedIn ? "the chart is zoomed in, so the lens pulls back" : "there is no room to zoom in further");
      if (mode === "detail" && detailOk) return view("detail", end - detailBars + 1, end, total, mainBars,
        zoomedIn ? "the chart already shows everything there is, so the lens zooms in"
                 : "the chart is zoomed out, so the lens zooms in");
    }
    return none(end, mainBars, "the chart is showing too few bars for a second view");
  }

  /* The second line of the heading: the span it covers, in plain dates. */
  function lensSpan(v, dateAt) {
    if (!v || v.mode === "none") return "";
    var from = dateAt(v.start), to = dateAt(v.end);
    return from && to ? from + " → " + to : "";
  }

  /* The invariant the lens must never break: both panes end on the same bar. */
  function endsTogether(v, main) {
    return v.mode === "none" ||
      v.end === clamp(main.end, 0, Math.max(0, (Number(main.total) || 1) - 1));
  }

  /* ======================================================================
     PART TWO — WHERE THE LENS SITS: A RESERVED STRIP UNDER THE CHART
     ======================================================================
     M47 built an inset that hunts for the emptiest corner and refuses any corner the
     price line crosses. Measured on this pane (M58, headless, 1680 and 390), that rule
     REFUSES EVERY CORNER on a zoomed-out chart: the price scale fits the visible high
     and low to the pane, so the line sweeps the full height and there is no clear
     corner left. The lens then disappears exactly in the view Alan spends most of his
     time in, which is worse than no lens at all.

     So the mount takes the other placement the brief offers: the lens gets its OWN
     reserved band under the price, the main chart is drawn shorter by exactly that
     band, and the two never overlap. It cannot cover the price line, it cannot hop
     from corner to corner while the chart pans, and it is always there.
     (M47's inset rule is untouched in deliverables/20260923/context-lens-2/
     lens-placement.mjs, if a later pane ever has the room for it.) */

  var STRIP = Object.freeze({
    minH: 38, maxH: 70, share: 0.18,   // the band, as a share of the pane, with limits
    minPaneW: 220, minPaneH: 150,      // below this a pane keeps its whole height
    gapTop: 4, pad: 7,
    labelMin: 96, labelMax: 190, labelShare: 0.16, labelFloor: 60,
  });

  /* How much height the lens takes out of the pane. 0 means the pane is too small to
     give any away, and the chart is drawn exactly as it was before the lens existed. */
  function stripBand(paneW, paneH, on) {
    if (!on || paneW < STRIP.minPaneW || paneH < STRIP.minPaneH) return 0;
    return Math.round(Math.max(STRIP.minH, Math.min(STRIP.maxH, paneH * STRIP.share)));
  }

  /* Where everything inside the band goes, from the geometry the chart already has:
     the frame, the two lines of words on the left, and the little chart on the right. */
  function stripLayout(g) {
    var frame = { x: g.padL, y: g.padT + g.ih + STRIP.gapTop,
                  w: g.iw, h: Math.max(10, g.band - STRIP.gapTop - 2) };
    /* The words come first and the little chart takes what is left. The pane measures
       its own text and passes the width, because a fixed fraction of a phone-width pane
       is narrower than "WIDER · LAST 240 BARS" and the line then runs through the words. */
    var labelW = g.labelW != null
      ? Math.round(Math.max(STRIP.labelFloor, g.labelW))
      : Math.round(Math.max(STRIP.labelMin, Math.min(STRIP.labelMax, g.iw * STRIP.labelShare)));
    if (labelW > frame.w * 0.45) labelW = Math.round(frame.w * 0.45);
    return {
      frame: frame, labelW: labelW,
      label: { x: frame.x + 2, y: frame.y + 11 },
      span:  { x: frame.x + 2, y: frame.y + 23 },
      line:  { x: frame.x + labelW + STRIP.pad, y: frame.y + 3,
               w: Math.max(10, frame.w - labelW - STRIP.pad * 2), h: Math.max(8, frame.h - 6) },
    };
  }

  var API = Object.freeze({
    /* what it shows */
    VIEW_DEFAULTS: VIEW_DEFAULTS, lensView: lensView, lensSpan: lensSpan, endsTogether: endsTogether,
    /* where it sits */
    STRIP: STRIP, stripBand: stripBand, stripLayout: stripLayout,
  });
  root.SC_LENS = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
