/* SCINTILLA · STATION CLOUDS — the Indicator Lab's cloud ribbon, ported for Station.
   ============================================================================
   WHAT THIS IS, in plain words: two fast lines (13-day and 21-day exponential
   averages), two slow ones (50-day and 200-day simple averages), and the three
   coloured clouds that fill the space between them. Indigo when the faster line
   is above the slower one, pink when it is below. That is the whole indicator —
   the same one Alan watches on TradingView ("SCINTILLA · Clouds Unified") and
   the same one the Cloud Workshop shows.

   WHERE THE NUMBERS COME FROM — and the one rule that decides everything here:
   THE AVERAGES ARE DAILY-LOCKED ON EVERY TIMEFRAME. Alan ruled on this in the
   18 Sep cloud review, in these words: "Show the ribbon with real intraday
   candles, including 10-minute views and extended sessions, while keeping the
   moving averages daily-locked. The short candle view is for seeing bar
   behavior, not an instruction to calculate 10-minute MAs."
   So a 15-minute chart does NOT get 13-bar averages of 15-minute bars; it gets
   the same 13-DAY average the daily chart shows, held flat across the session.

   NO VALUE IS EVER SHOWN BEFORE IT EXISTED. On an intraday chart each bar shows
   the average of the last COMPLETED session before that bar's own session — the
   number that was actually knowable while that bar was forming. On a daily,
   3-session or weekly chart each bar shows the newest completed daily average
   inside that bar's own period. No VALUE is interpolated, smoothed or filled.
   (The pen's path between two sessions may be smoothed for the eye - see DISPLAY
   GEOMETRY below - but every number a label names, and every anchor the curve passes
   through, is a real completed-session value. Alan, 22 Sep: "I don't need it to be
   really exact, the history of the curves. What matters is that the current level in
   the labels is exact.")

   Everything in this file is pure arithmetic and geometry: no fetch, no DOM, no
   clock, no storage. chart/index.html owns the candle read (the same provider
   loader and cache the price line uses) and the canvas.

   Visual contract, unchanged from the approved Cloud Workshop
   (scintillahub.ai/prototypes/indicator-lab/ → Cloud Workshop, model.mjs):
     lines   EMA13 w1 · EMA21 w2 · SMA50 w3 · SMA200 w4 (solid),
             optional dashed EMA8 (w0.6) and dashed SMA100 (w3) — neither adds a cloud
     clouds  13/21 blue44 pink22 · 21/50 blue36 pink17 · 50/200 blue26 pink10
     colour  indigo #3455FF / neon pink #FF00A8, one family per direction, no white
     tiling  the fastest cloud owns any overlap, and every fill is split at the
             actual line crossings so a cloud never leaves a hole (Lab, 21 Sep)
   ============================================================================ */
(function (root) {
  "use strict";

  var PALETTE = Object.freeze({ blue:"#3455FF", pink:"#FF00A8" });

  /* label = what the line is called on screen; width = the approved 1/2/3/4 hierarchy;
     stateKey = which comparison colours it (f: 13 vs 21, m: 21 vs 50, o: 50 vs 200,
     price: that session's close against the line itself). */
  var SPECS = Object.freeze([
    { key:"e8",   label:"8D",   kind:"EMA", period:8,   width:.6, style:"dashed", blueOpacity:20, pinkOpacity:8,    stateKey:"price", optional:"ema8" },
    { key:"e13",  label:"13D",  kind:"EMA", period:13,  width:1,  style:"solid",  blueOpacity:26, pinkOpacity:10,   stateKey:"f" },
    { key:"e21",  label:"21D",  kind:"EMA", period:21,  width:2,  style:"solid",  blueOpacity:32, pinkOpacity:13,   stateKey:"f" },
    { key:"s50",  label:"50D",  kind:"SMA", period:50,  width:3,  style:"solid",  blueOpacity:38, pinkOpacity:16,   stateKey:"m" },
    { key:"s100", label:"100D", kind:"SMA", period:100, width:3,  style:"dashed", blueOpacity:41, pinkOpacity:18.5, stateKey:"price", optional:"sma100" },
    { key:"s200", label:"200D", kind:"SMA", period:200, width:4,  style:"solid",  blueOpacity:44, pinkOpacity:21,   stateKey:"o" }
  ].map(Object.freeze));

  var CLOUD_LAYERS = Object.freeze({
    fast:  Object.freeze({ blueOpacity:44, pinkOpacity:22 }),
    middle:Object.freeze({ blueOpacity:36, pinkOpacity:17 }),
    slow:  Object.freeze({ blueOpacity:26, pinkOpacity:10 })
  });

  /* An exponential average has to start somewhere, and ours starts at the first
     close of the window the provider serves (at most 400 sessions). That seed
     still leaks into the earliest values, so the earliest rows are NOT drawn:
     after 60 sessions the seed is worth 0.3% of one bar for the 21-day average,
     which is far below a pixel. This is the difference between a drawn value
     and an invented one. */
  var EMA_SEED_WARMUP = 60;
  var INTRADAY_RANGES = ["15m","30m","1h","2h","3h","4h","6h","12h"];
  var PERIOD_MS = { "1D":86400000, "3D":259200000, "1W":604800000 };

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }

  /* The New York session date a timestamp belongs to. The provider stamps its bars
     in ET sessions, so "which session is this bar in" is an ET calendar question. */
  var dayFormatter = null;
  var dayCache = new Map();
  function sessionDate(ms) {
    var hit = dayCache.get(ms);
    if (hit) return hit;
    if (!dayFormatter) dayFormatter = new Intl.DateTimeFormat("en-CA",
      { timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit" });
    var value = dayFormatter.format(new Date(ms));
    if (dayCache.size > 8192) dayCache.clear();
    dayCache.set(ms, value);
    return value;
  }

  function activeSpecs(options) {
    var opts = options || {};
    return SPECS.filter(function (spec) { return !spec.optional || opts[spec.optional] === true; });
  }

  /* points: the chart's own completed daily candles, [{ d:ISO, p:close }] ascending.
     A transient live point is not a completed session and is dropped. */
  function dailyRows(points) {
    var bars = [], list = Array.isArray(points) ? points : [];
    for (var i = 0; i < list.length; i++) {
      var point = list[i];
      if (!point || point.live) continue;
      var time = Date.parse(point.d), close = Number(point.p);
      if (!Number.isFinite(time) || !(close > 0)) continue;
      if (bars.length && time <= bars[bars.length - 1].time) continue;
      bars.push({ time:time, close:close });
    }
    var e8 = null, e13 = null, e21 = null;
    var sums = { 50:0, 100:0, 200:0 }, rows = [];
    for (var index = 0; index < bars.length; index++) {
      var bar = bars[index], close2 = bar.close;
      e8  = e8  === null ? close2 : (2 / 9)  * close2 + (1 - 2 / 9)  * e8;
      e13 = e13 === null ? close2 : (2 / 14) * close2 + (1 - 2 / 14) * e13;
      e21 = e21 === null ? close2 : (2 / 22) * close2 + (1 - 2 / 22) * e21;
      var ma = {};
      for (var p = 0; p < 3; p++) {
        var period = [50, 100, 200][p];
        sums[period] += close2;
        if (index >= period) sums[period] -= bars[index - period].close;
        ma["s" + period] = index + 1 >= period ? sums[period] / period : null;
      }
      var warm = index >= EMA_SEED_WARMUP;
      var row = {
        time:bar.time, close:close2, day:sessionDate(bar.time),
        e8:warm ? e8 : null, e13:warm ? e13 : null, e21:warm ? e21 : null,
        s50:ma.s50, s100:ma.s100, s200:ma.s200
      };
      row.f = warm ? e13 >= e21 : null;
      row.m = warm && ma.s50 !== null ? e21 >= ma.s50 : null;
      row.o = ma.s50 === null || ma.s200 === null ? null : ma.s50 >= ma.s200;
      rows.push(row);
    }
    return rows;
  }

  function timeframeKind(range) {
    return INTRADAY_RANGES.indexOf(String(range)) >= 0
      ? { intraday:true, periodMs:0 }
      : { intraday:false, periodMs:PERIOD_MS[range] || 86400000 };
  }

  /* Which completed daily observation each chart bar is allowed to show.
     Intraday: the last session that had already CLOSED before this bar's session
     began. Daily and slower: the newest daily session inside this bar's own period,
     which is what a daily chart and TradingView both show. */
  function mapBarsToDaily(barTimes, rows, kind) {
    var out = new Array(barTimes.length).fill(null);
    if (!rows || !rows.length) return out;
    var at = -1;
    for (var b = 0; b < barTimes.length; b++) {
      var time = barTimes[b];
      if (!Number.isFinite(time)) { out[b] = at < 0 ? null : rows[at]; continue; }
      if (kind && kind.intraday) {
        var day = sessionDate(time);
        while (at + 1 < rows.length && rows[at + 1].day < day) at++;
      } else {
        var periodEnd = b + 1 < barTimes.length && Number.isFinite(barTimes[b + 1])
          ? barTimes[b + 1] : time + ((kind && kind.periodMs) || 86400000);
        while (at + 1 < rows.length && rows[at + 1].time < periodEnd) at++;
      }
      out[b] = at < 0 ? null : rows[at];
    }
    return out;
  }

  /* Contiguous stretches of bars that show the SAME daily observation. On a
     15-minute chart that is one run per session; on a daily chart every bar is
     its own run. Runs are what makes a redraw cheap: one rectangle per session
     instead of one per bar. */
  function runs(mapped, start, end) {
    var out = [], first = Math.max(0, Math.floor(start)), last = Math.min(mapped.length - 1, Math.ceil(end));
    for (var i = first; i <= last; i++) {
      var row = mapped[i];
      if (!row) continue;
      var current = out.length ? out[out.length - 1] : null;
      if (current && current.row === row && current.to === i - 1) current.to = i;
      else out.push({ from:i, to:i, row:row });
    }
    return out;
  }

  /* The approved four-boundary subtraction from the Pine source, kept exactly. */
  function subtractRange(lo, hi, cutLo, cutHi, cut) {
    if (!finite(lo) || !finite(hi)) return [null, null, null, null];
    var overlaps = cut !== false && finite(cutLo) && finite(cutHi) && cutHi > lo && cutLo < hi;
    var aHi = overlaps ? Math.max(lo, Math.min(hi, cutLo)) : hi;
    var bLo = overlaps ? Math.min(hi, Math.max(lo, cutHi)) : hi;
    return [lo, aHi, bLo, hi];
  }

  /* Display geometry only, straight from the Workshop: split the span between two
     observations at every line crossing, then tile each vertical gap exactly once,
     fastest cloud first. Endpoint-only clipping leaves holes whenever the order of
     the lines changes between two observations — that was the defect the Lab fixed
     on 21 Sep, and this is the fix. */
  function cloudPolygons(a, b) {
    var keys = ["e13", "e21", "s50", "s200"].filter(function (key) { return finite(a[key]) && finite(b[key]); });
    if (keys.length < 2) return [];
    var at = function (key, t) { return a[key] + (b[key] - a[key]) * t; };
    var cuts = [0, 1], i, j;
    for (i = 0; i < keys.length; i++) for (j = i + 1; j < keys.length; j++) {
      var d0 = a[keys[i]] - a[keys[j]], d1 = b[keys[i]] - b[keys[j]];
      if (d0 * d1 < 0) cuts.push(d0 / (d0 - d1));
    }
    cuts.sort(function (x, y) { return x - y; });
    var out = [];
    var families = [["fast", "e13", "e21"], ["middle", "e21", "s50"], ["slow", "s50", "s200"]]
      .filter(function (family) { return keys.indexOf(family[1]) >= 0 && keys.indexOf(family[2]) >= 0; });
    for (var c = 1; c < cuts.length; c++) {
      var t0 = cuts[c - 1], t1 = cuts[c];
      if (t1 - t0 < 1e-12) continue;
      var middle = (t0 + t1) / 2;
      var sorted = keys.slice().sort(function (x, y) { return at(x, middle) - at(y, middle); });
      for (var k = 1; k < sorted.length; k++) {
        var lo = sorted[k - 1], hi = sorted[k];
        if (at(hi, middle) - at(lo, middle) < 1e-12) continue;
        var mid = (at(lo, middle) + at(hi, middle)) / 2;
        var family = null;
        for (var f = 0; f < families.length && !family; f++) {
          var candidate = families[f];
          if (mid >= Math.min(at(candidate[1], middle), at(candidate[2], middle)) &&
              mid <= Math.max(at(candidate[1], middle), at(candidate[2], middle))) family = candidate;
        }
        if (!family) continue;
        var bullish = at(family[1], middle) >= at(family[2], middle);
        out.push({
          layer:family[0], bullish:bullish,
          color:bullish ? PALETTE.blue : PALETTE.pink,
          opacity:bullish ? CLOUD_LAYERS[family[0]].blueOpacity : CLOUD_LAYERS[family[0]].pinkOpacity,
          t0:t0, t1:t1,
          previousLo:at(lo, t0), previousHi:at(hi, t0), lo:at(lo, t1), hi:at(hi, t1)
        });
      }
    }
    return out;
  }

  /* Bands of one observation held flat — the same tiling with no crossings to split. */
  function cloudBands(row) { return cloudPolygons(row, row); }

  /* Tone, not transparency: the ribbon is painted as solid colour already dimmed
     towards the near-black pane, exactly as the Workshop does, so the hue reads the
     same whatever sits behind it. Same hue family, never a white tint. */
  function toneOf(hex, gain) {
    var out = [];
    for (var i = 1; i < 6; i += 2) out.push(Math.round(parseInt(hex.slice(i, i + 2), 16) * gain));
    return "rgb(" + out.join(",") + ")";
  }
  function lineInk(hex, opacity) { return toneOf(hex, Math.sqrt(Math.max(0, Math.min(100, opacity)) / 100)); }
  function cloudInk(band) {
    var gain = band.bullish ? { fast:.85, middle:.53, slow:.23 }[band.layer]
                            : Math.sqrt(band.opacity / 100) * .94;
    return toneOf(band.color, gain);
  }
  function lineBullish(spec, row) {
    if (!row) return null;
    if (spec.stateKey === "price") return finite(row.close) && finite(row[spec.key]) ? row.close >= row[spec.key] : null;
    return typeof row[spec.stateKey] === "boolean" ? row[spec.stateKey] : null;
  }

  /* Stroke weights follow the approved 1/2/3/4 hierarchy scaled by how much room a
     bar has, never by changing a period. The cap keeps the price line dominant:
     Station draws price at 2px, so the heaviest indicator stays below it. */
  function displayScale(plotWidth, barCount, priceWidth) {
    var spacing = Math.max(1, plotWidth) / Math.max(1, barCount);
    var zoom = Math.max(0, Math.min(1, Math.log2(Math.max(1, spacing)) / 5));
    var cap = Math.max(.2, ((priceWidth || 2) * .88) / 4);
    return Math.min(.28 + .57 * zoom, cap);
  }
  function strokeWidth(spec, scale) {
    return Math.max(spec.key === "e8" ? .32 : .45, spec.width * scale);
  }
  function signedPercent(value, price) {
    return finite(value) && finite(price) && price !== 0 ? 100 * (value / price - 1) : null;
  }

  /* Endpoint labels: the exact height of each line, never a made-up one. Labels that
     would sit on top of each other step sideways into their own lane and drop their
     percentage; a label with no honest room is not drawn at all. */
  function placeLabels(items, options) {
    var opts = options || {}, rowHeight = opts.rowHeight || 11;
    var left = opts.left || 0, maxRight = opts.maxRight || 0, gap = opts.gap == null ? 4 : opts.gap;
    var measure = typeof opts.measure === "function" ? opts.measure : function (text) { return String(text).length * 5; };
    var rows = items.slice().sort(function (a, b) { return a.y - b.y; });
    var placed = [];
    for (var i = 0; i < rows.length; i++) {
      var item = rows[i], crowded = false;
      for (var j = 0; j < rows.length; j++)
        if (rows[j] !== item && Math.abs(rows[j].y - item.y) < rowHeight) crowded = true;
      var text = crowded ? item.short : item.full;
      var x = left;
      for (var k = 0; k < placed.length; k++)
        if (Math.abs(placed[k].y - item.y) < rowHeight && x < placed[k].x + placed[k].width + gap)
          x = placed[k].x + placed[k].width + gap;
      var width = measure(text);
      if (x + width > maxRight && text !== item.short) { text = item.short; width = measure(text); }
      if (x + width > maxRight) continue;
      placed.push({ key:item.key, y:item.y, value:item.value, bullish:item.bullish, text:text, x:x, width:width, compact:text === item.short });
    }
    return placed;
  }

  /* ---- DISPLAY GEOMETRY: smoothed for the eye, labels exact -----------------------
     Alan, 22 Sep: "I'd like a proposal for smoothening the steppy behaviour... I don't
     want to do it mathematically. Just visually." and "I want clean curves, smooth as
     butter." So the values above are untouched; only the path the pen takes between two
     sessions changes. The curve is a monotone cubic (Fritsch-Carlson): it passes through
     every anchor EXACTLY and between two anchors it never leaves the interval between
     their values, so it cannot overshoot past a real session value. */
  function monotoneCurve(xs, ys) {
    var n = xs.length, i;
    if (!n) return null;
    if (n === 1) return function () { return ys[0]; };
    var d = [], m = [];
    for (i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { var t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      var k = 0;
      while (k < n - 2 && x > xs[k + 1]) k++;
      var h = xs[k + 1] - xs[k], u = (x - xs[k]) / h, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * ys[k] + (u3 - 2 * u2 + u) * h * m[k] +
             (-2 * u3 + 3 * u2) * ys[k + 1] + (u3 - u2) * h * m[k + 1];
    };
  }

  /* One anchor per session, at that session's LAST bar, so the newest bar on screen is
     always an anchor and the labels sit exactly where the curve ends. The run that opens a
     group also anchors its first bar, so the left edge is held flat rather than left blank.
     A break in the mapping (a bar older than every average) starts a new group. */
  function curveGroups(runList) {
    var groups = [], current = null;
    for (var i = 0; i < runList.length; i++) {
      var run = runList[i];
      if (!current || runList[i - 1].to + 1 !== run.from) {
        current = { xs:[], rows:[] };
        groups.push(current);
        if (run.to > run.from) { current.xs.push(run.from); current.rows.push(run.row); }
      }
      current.xs.push(run.to); current.rows.push(run.row);
    }
    return groups;
  }

  /* A row of the ribbon at any x inside a group: each average read off its own curve, the
     direction booleans recomputed from those values exactly as dailyRows computes them, and
     the close of the session this piece is heading to (for the price-coloured extras). */
  function curveFor(group, keys) {
    var fns = {}, k;
    for (k = 0; k < keys.length; k++) {
      var key = keys[k], xs = [], ys = [];
      for (var i = 0; i < group.xs.length; i++)
        if (finite(group.rows[i][key])) { xs.push(group.xs[i]); ys.push(group.rows[i][key]); }
      fns[key] = xs.length ? { at:monotoneCurve(xs, ys), lo:xs[0], hi:xs[xs.length - 1] } : null;
    }
    return function (x) {
      var row = {}, j = 0;
      while (j < group.xs.length - 1 && group.xs[j] < x) j++;
      var anchor = group.rows[j] || null;
      for (var q = 0; q < keys.length; q++) {
        var f = fns[keys[q]];
        row[keys[q]] = f && x >= f.lo && x <= f.hi ? f.at(x) : null;
      }
      row.close = anchor && finite(anchor.close) ? anchor.close : null;
      row.f = finite(row.e13) && finite(row.e21) ? row.e13 >= row.e21 : null;
      row.m = finite(row.e21) && finite(row.s50) ? row.e21 >= row.s50 : null;
      row.o = finite(row.s50) && finite(row.s200) ? row.s50 >= row.s200 : null;
      return row;
    };
  }

  var API = Object.freeze({
    PALETTE:PALETTE, SPECS:SPECS, CLOUD_LAYERS:CLOUD_LAYERS,
    EMA_SEED_WARMUP:EMA_SEED_WARMUP, INTRADAY_RANGES:Object.freeze(INTRADAY_RANGES.slice()),
    activeSpecs:activeSpecs, dailyRows:dailyRows, sessionDate:sessionDate,
    timeframeKind:timeframeKind, mapBarsToDaily:mapBarsToDaily, runs:runs,
    subtractRange:subtractRange, cloudPolygons:cloudPolygons, cloudBands:cloudBands,
    lineInk:lineInk, cloudInk:cloudInk, lineBullish:lineBullish,
    displayScale:displayScale, strokeWidth:strokeWidth, signedPercent:signedPercent,
    placeLabels:placeLabels,
    monotoneCurve:monotoneCurve, curveGroups:curveGroups, curveFor:curveFor
  });
  root.SC_CLOUDS = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
