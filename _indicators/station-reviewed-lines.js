/* SCINTILLA · STATION REVIEWED LINES — the Indicator Lab's Clean Review lines, drawn on our charts (LB1, 6 Oct 2026).
   ============================================================================
   WHAT THIS IS, in plain words: the lines Alan approved in the Lab's Clean Review (the long-term B channel, the active
   C and D patterns, the P1–P4 pivots, the selected Trendoscope rails) for the 19 reviewed names, drawn thin on the
   Station chart in the Lab's own colours, exactly where the Lab's packs put them. Alan, 6 Oct: "similar to the clouds,
   bring it in over here and use it … the technicals is more about when to buy, when to sell."

   WHERE THE NUMBERS COME FROM: /_indicators/reviewed-lines-extract.json — a READ-ONLY extract of the installed
   V24 packs (provider repo, scripts/reviewed-lines-extract.mjs). Every line has two anchors (time, price) the Lab
   recorded. Nothing here detects, refits or approves anything. The Lab owns the geometry.

   HOW A LINE IS DRAWN: a straight chord through the two anchors, continued to the right edge; a logarithmic rail is
   drawn as a straight chord in log price. (The Lab's native rule advances per SOURCE bar; the two agree at every anchor
   and differ by a fraction of a bar between them — the pane says so.) Horizontals are flat at their price.

   WHICH LINES ON WHICH CHART: a line's source timeframe must be at or above the chart's: a 1W chart shows 1W and 2W
   lines, a 3D chart adds 3D, a 1D or intraday chart shows them all — as the Clean pane does on a Daily view.

   Everything in this file is pure geometry: no fetch, no DOM. The chart page loads the extract and calls draw(). */
(function () {
  "use strict";
  var COLOUR = { horizontal: "#8FBEBB", sloped_linear: "#51CFC4", sloped_log: "#51CFC4", sloped_epoch: "#51CFC4" }; // the Lab's PIVOT / INK
  var RANK = { "1D": 1, "3D": 3, "1W": 7, "2W": 14 };
  var CHART_RANK = { "15m": 0, "30m": 0, "1h": 0, "2h": 0, "3h": 0, "4h": 0, "6h": 0, "12h": 0, "1D": 1, "3D": 3, "1W": 7, "2W": 14 };

  function linesFor(extract, ticker, range) {
    if (!extract || !Array.isArray(extract.lines)) return [];
    var floor = CHART_RANK[range] == null ? 1 : CHART_RANK[range];
    var out = [];
    for (var i = 0; i < extract.lines.length; i++) {
      var l = extract.lines[i];
      if (l.ticker !== ticker) continue;
      if ((RANK[l.source_timeframe] || 0) < floor) continue;
      var a = l.anchors && l.anchors[0], b = l.anchors && l.anchors[1];
      if (!b || !(b.price > 0) || !(b.t > 0)) continue;
      out.push(l);
    }
    return out;
  }

  /* price of the line at time t (ms): flat, linear chord, or log chord; epoch lines are linear in time by definition */
  function valueAt(l, t) {
    var a = l.anchors[0], b = l.anchors[1];
    if (l.kind === "horizontal") return b.price;
    if (!a || !(a.price > 0) || !(a.t > 0) || a.t === b.t) {
      /* no usable first anchor: fall back to the Lab's slope at the second anchor */
      if (l.kind === "sloped_epoch" && l.slope && isFinite(l.slope.per_ms)) return b.price + l.slope.per_ms * (t - b.t);
      return b.price;
    }
    var f = (t - a.t) / (b.t - a.t);
    if (l.kind === "sloped_log") return a.price * Math.exp(Math.log(b.price / a.price) * f);
    return a.price + (b.price - a.price) * f;
  }

  /* o: { ctx, pts, start, end, X, Y, padL, padT, iw, ih, yLo, yHi, rightBars, lines, font, labels } */
  function draw(o) {
    var ctx = o.ctx, pts = o.pts, lines = o.lines || [];
    if (!lines.length || !pts || pts.length < 2) return [];
    var tAt = function (i) { return Date.parse(pts[Math.max(0, Math.min(pts.length - 1, i))].d); };
    var t0 = tAt(o.start), tEnd = tAt(o.end);
    var span = Math.max(1, o.end - o.start);
    var msPerBar = span > 0 ? (tEnd - t0) / span : 86400000;
    var xEnd = o.end + (o.rightBars || 0);           /* the right edge the chart leaves after the last bar */
    var tRight = tEnd + msPerBar * (o.rightBars || 0);
    var drawn = [];
    ctx.save();
    ctx.beginPath(); ctx.rect(o.padL, o.padT, o.iw, o.ih); ctx.clip();
    ctx.lineWidth = 1; ctx.lineJoin = "round";
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      var y0v = valueAt(l, t0), y1v = valueAt(l, tRight);
      var inside = (y0v >= o.yLo && y0v <= o.yHi) || (y1v >= o.yLo && y1v <= o.yHi) || (Math.min(y0v, y1v) < o.yLo && Math.max(y0v, y1v) > o.yHi);
      if (!inside) continue;
      var mid = l.draw && l.draw.style === "dashed";
      var dotted = l.draw && l.draw.style === "dotted";
      ctx.strokeStyle = COLOUR[l.kind] || COLOUR.sloped_linear;
      ctx.globalAlpha = mid || dotted ? 0.55 : 0.85;
      ctx.setLineDash(mid ? [5, 4] : dotted ? [2, 3] : []);
      ctx.beginPath();
      /* straight chord: two points are exact for every kind (a log chord is drawn straight in price over a short window;
         for long weekly windows the curve is sampled so the picture follows the Lab's logarithmic rail) */
      if (l.kind === "sloped_log") {
        var steps = 24;
        for (var s = 0; s <= steps; s++) { var ii = o.start + (xEnd - o.start) * s / steps; var tt = t0 + (tRight - t0) * s / steps; var yy = o.Y(valueAt(l, tt)); if (s === 0) ctx.moveTo(o.X(ii), yy); else ctx.lineTo(o.X(ii), yy); }
      } else { ctx.moveTo(o.X(o.start), o.Y(y0v)); ctx.lineTo(o.X(xEnd), o.Y(y1v)); }
      ctx.stroke();
      drawn.push({ id: l.native_id, tf: l.source_timeframe, kind: l.kind, atRight: y1v, approvedSlope: l.approval && l.approval.slope_strip === true });
    }
    ctx.setLineDash([]);
    /* names at the right edge, at the line's own height, thinned so they never pile up */
    if (o.labels !== false) {
      ctx.font = (o.font || 9) + "px ui-monospace, Menlo, monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "right";
      var placed = [];
      drawn.sort(function (p, q) { return q.atRight - p.atRight; });
      for (var k = 0; k < drawn.length; k++) {
        var d = drawn[k], y = o.Y(d.atRight);
        if (y < o.padT + 4 || y > o.padT + o.ih - 4) continue;
        var clash = false; for (var m = 0; m < placed.length; m++) if (Math.abs(placed[m] - y) < (o.font || 9) + 1) { clash = true; break; }
        if (clash) continue;
        placed.push(y);
        ctx.globalAlpha = 0.9; ctx.fillStyle = COLOUR[d.kind] || COLOUR.sloped_linear;
        ctx.fillText(d.tf + " " + d.id.replace(/^(1W|2W|3D) /, "") + (d.approvedSlope ? " ✓" : ""), o.padL + o.iw - 2, y);
      }
    }
    ctx.restore();
    return drawn;
  }

  window.SC_REVIEWED = { linesFor: linesFor, valueAt: valueAt, draw: draw, COLOUR: COLOUR };
})();
