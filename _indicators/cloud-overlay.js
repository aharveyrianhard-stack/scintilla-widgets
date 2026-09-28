/* SCINTILLA Station cloud overlay
   --------------------------------
   Pure daily-locked moving-average math and display geometry shared by the
   standalone chart and the Station chart shell. This file reads and writes no
   market data; chart/index.html supplies completed provider daily closes.

   The visual contract is the approved Cloud Workshop contract:
     EMA 8 (quiet dashed), EMA 13, EMA 21, SMA 50, optional SMA 100 (dashed),
     SMA 200; fast/middle/slow non-overlapping clouds; indigo/pink hierarchy.
*/
(function (root) {
  "use strict";

  var palette = Object.freeze({ blue:"#3455FF", pink:"#FF00A8" });
  var specs = Object.freeze([
    { key:"e8", label:"8D", kind:"EMA", period:8, width:.6, style:"dashed", blueOpacity:20, pinkOpacity:8, stateKey:"price" },
    { key:"e13", label:"13D", kind:"EMA", period:13, width:1, style:"solid", blueOpacity:26, pinkOpacity:10, stateKey:"f" },
    { key:"e21", label:"21D", kind:"EMA", period:21, width:2, style:"solid", blueOpacity:32, pinkOpacity:13, stateKey:"f" },
    { key:"s50", label:"50D", kind:"SMA", period:50, width:3, style:"solid", blueOpacity:38, pinkOpacity:16, stateKey:"m" },
    { key:"s100", label:"100D", kind:"SMA", period:100, width:3, style:"dashed", blueOpacity:41, pinkOpacity:18.5, stateKey:"price", optional:true },
    { key:"s200", label:"200D", kind:"SMA", period:200, width:4, style:"solid", blueOpacity:44, pinkOpacity:21, stateKey:"o" }
  ].map(Object.freeze));
  var cloudSpecs = Object.freeze({
    fast:Object.freeze({ blueOpacity:44, pinkOpacity:22 }),
    middle:Object.freeze({ blueOpacity:36, pinkOpacity:17 }),
    slow:Object.freeze({ blueOpacity:26, pinkOpacity:10 })
  });

  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function activeSpecs(showSma100) { return specs.filter(function (spec) { return !spec.optional || showSma100; }); }

  function normalizeDaily(rows) {
    if (!Array.isArray(rows)) throw new TypeError("Daily candle rows must be an array");
    var out = rows.map(function (row, index) {
      var seconds = Number(row && row.timestamp), close = Number(row && row.close);
      if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(close) || close <= 0)
        throw new TypeError("Invalid daily close at row " + index);
      return { time:Math.round(seconds * 1000), close:close };
    }).sort(function (a,b) { return a.time - b.time; });
    for (var i=1; i<out.length; i++) if (out[i].time <= out[i-1].time)
      throw new RangeError("Daily candle timestamps must be unique and chronological");
    return out;
  }

  /* Same first-close EMA seed and complete-window SMA rule as the approved
     workshop. A 400-row native daily pull is the current Station provider's
     bounded history contract; SMA values are exact over their windows and EMA
     seed influence is far below display precision by the visible tail. */
  function computeDaily(rows) {
    var bars = normalizeDaily(rows), e8 = null, e13 = null, e21 = null;
    var sums = { 50:0, 100:0, 200:0 };
    return bars.map(function (bar, index) {
      e8 = e8 === null ? bar.close : (2 / 9) * bar.close + (1 - 2 / 9) * e8;
      e13 = e13 === null ? bar.close : (2 / 14) * bar.close + (1 - 2 / 14) * e13;
      e21 = e21 === null ? bar.close : (2 / 22) * bar.close + (1 - 2 / 22) * e21;
      var ma = {};
      [50,100,200].forEach(function (period) {
        sums[period] += bar.close;
        if (index >= period) sums[period] -= bars[index-period].close;
        ma["s" + period] = index + 1 >= period ? sums[period] / period : null;
      });
      return {
        time:bar.time, close:bar.close, e8:e8, e13:e13, e21:e21,
        s50:ma.s50, s100:ma.s100, s200:ma.s200,
        f:e13 >= e21,
        m:ma.s50 === null ? null : e21 >= ma.s50,
        o:ma.s50 === null || ma.s200 === null ? null : ma.s50 >= ma.s200
      };
    });
  }

  function subtractRange(lo, hi, cutLo, cutHi, cut) {
    if (!finite(lo) || !finite(hi)) return [null,null,null,null];
    var overlaps = cut !== false && finite(cutLo) && finite(cutHi) && cutHi > lo && cutLo < hi;
    var aHi = overlaps ? Math.max(lo, Math.min(hi, cutLo)) : hi;
    var bLo = overlaps ? Math.min(hi, Math.max(lo, cutHi)) : hi;
    return [lo,aHi,bLo,hi];
  }

  function cloudBands(row, includeZero) {
    function range(a,b) { return finite(a) && finite(b) ? [Math.min(a,b),Math.max(a,b)] : [null,null]; }
    var f = range(row.e13,row.e21), m = range(row.e21,row.s50), s = range(row.s50,row.s200);
    var mCut = subtractRange(m[0],m[1],f[0],f[1],true);
    var sCut = subtractRange(s[0],s[1],m[0],m[1],true);
    var sA = subtractRange(sCut[0],sCut[1],f[0],f[1],true);
    var sB = subtractRange(sCut[2],sCut[3],f[0],f[1],true);
    var bands = [];
    function add(key, layer, lo, hi, bullish) {
      if (!finite(lo) || !finite(hi) || hi < lo || (!includeZero && hi === lo) || typeof bullish !== "boolean") return;
      bands.push({ key:key, layer:layer, lo:lo, hi:hi, bullish:bullish,
        color:bullish ? palette.blue : palette.pink,
        opacity:bullish ? cloudSpecs[layer].blueOpacity : cloudSpecs[layer].pinkOpacity });
    }
    add("slow-AA","slow",sA[0],sA[1],row.o); add("slow-AB","slow",sA[2],sA[3],row.o);
    add("slow-BA","slow",sB[0],sB[1],row.o); add("slow-BB","slow",sB[2],sB[3],row.o);
    add("middle-A","middle",mCut[0],mCut[1],row.m); add("middle-B","middle",mCut[2],mCut[3],row.m);
    add("fast","fast",f[0],f[1],row.f);
    return bands;
  }

  /* Split straight daily-anchor joins at every crossing, then tile each
     vertical interval once. These are display polygons, never observations. */
  function cloudPolygons(a,b) {
    var keys = ["e13","e21","s50","s200"].filter(function (key) { return finite(a[key]) && finite(b[key]); });
    if (keys.length < 2) return [];
    function at(key,t) { return a[key] + (b[key]-a[key]) * t; }
    var cuts = [0,1];
    for (var i=0; i<keys.length; i++) for (var j=i+1; j<keys.length; j++) {
      var d0 = a[keys[i]] - a[keys[j]], d1 = b[keys[i]] - b[keys[j]];
      if (d0*d1 < 0) cuts.push(d0/(d0-d1));
    }
    cuts.sort(function (x,y) { return x-y; });
    var out = [], families = [["fast","e13","e21"],["middle","e21","s50"],["slow","s50","s200"]]
      .filter(function (family) { return keys.indexOf(family[1]) >= 0 && keys.indexOf(family[2]) >= 0; });
    for (var c=1; c<cuts.length; c++) {
      var t0=cuts[c-1], t1=cuts[c]; if (t1-t0 < 1e-12) continue;
      var middle=(t0+t1)/2, sorted=keys.slice().sort(function (x,y) { return at(x,middle)-at(y,middle); });
      for (var k=1; k<sorted.length; k++) {
        var lo=sorted[k-1], hi=sorted[k], p=(at(lo,middle)+at(hi,middle))/2;
        if (at(hi,middle)-at(lo,middle) < 1e-12) continue;
        var family=families.find(function (candidate) {
          return p >= Math.min(at(candidate[1],middle),at(candidate[2],middle)) &&
                 p <= Math.max(at(candidate[1],middle),at(candidate[2],middle));
        });
        if (!family) continue;
        var layer=family[0], x=family[1], y=family[2], bullish=at(x,middle)>=at(y,middle);
        out.push({ layer:layer, bullish:bullish, color:bullish?palette.blue:palette.pink,
          opacity:bullish?cloudSpecs[layer].blueOpacity:cloudSpecs[layer].pinkOpacity,
          t0:t0,t1:t1,previousLo:at(lo,t0),previousHi:at(hi,t0),lo:at(lo,t1),hi:at(hi,t1) });
      }
    }
    return out;
  }

  /* Historical daily observations become visible from the next supplied
     session. The newest completed daily observation is carried to the current
     chart endpoint; it is never discarded merely because no next session has
     arrived yet. */
  function curveAnchors(rows, through) {
    if (!Array.isArray(rows) || !rows.length || !finite(through)) return [];
    var out = rows.slice(0,-1).map(function (row,index) {
      return Object.assign({}, row, { sourceTime:row.time, time:rows[index+1].time });
    }).filter(function (row) { return row.time <= through; });
    var latest = rows[rows.length-1];
    if (latest.time <= through) {
      var carried = Object.assign({}, latest, { sourceTime:latest.time, time:through, displayOnly:through !== latest.time });
      if (!out.length || out[out.length-1].time < carried.time) out.push(carried);
      else if (out[out.length-1].time === carried.time) out[out.length-1] = carried;
    }
    return out;
  }

  function ribbonInk(hex, opacity) {
    var gain=Math.sqrt(Math.max(0,Math.min(100,opacity))/100);
    return "rgb(" + [1,3,5].map(function (i) { return Math.round(parseInt(hex.slice(i,i+2),16)*gain); }).join(",") + ")";
  }
  function cloudInk(band) {
    var gain=band.bullish ? {fast:.85,middle:.53,slow:.23}[band.layer] : Math.sqrt(band.opacity/100)*.94;
    return "rgb(" + [1,3,5].map(function (i) { return Math.round(parseInt(band.color.slice(i,i+2),16)*gain); }).join(",") + ")";
  }
  function lineBullish(spec,row) {
    return spec.stateKey === "price" ? finite(row.close) && finite(row[spec.key]) && row.close >= row[spec.key] : row[spec.stateKey] === true;
  }
  function displayMetrics(width, height, candleCount) {
    var compact=width<650, plotWidth=Math.max(60,width-24), spacing=plotWidth/Math.max(1,candleCount);
    var zoom=Math.max(0,Math.min(1,Math.log2(Math.max(1,spacing))/5));
    return { scale:.28+.57*zoom, font:10+(compact?4:7)*zoom, priceWidth:3.8+1.2*zoom,
      labelWidth:Math.max(108,(10+(compact?4:7)*zoom)*9), gap:Math.max(29,(10+(compact?4:7)*zoom)*2.6), height:height };
  }
  function indicatorStroke(spec, metrics) { return Math.max(spec.key === "e8" ? .32 : .45, spec.width*metrics.scale); }
  function signedPercent(value, price) { return finite(value) && finite(price) && price !== 0 ? 100*(value/price-1) : null; }
  function latestLabelsVisible(start, end, count) {
    return count > 0 && start <= count-1 && end >= count-1;
  }
  /* Exact price-height annotations. Nearby values move into horizontal lanes;
     their Y coordinate is never changed to manufacture visual separation. */
  function endpointLabels(items, options) {
    var width=options.width, height=options.height, endpointX=options.endpointX;
    var labelWidth=options.labelWidth, gap=options.gap, font=options.font || 11;
    var rows=items.filter(function (row) {
      return finite(row.y) && row.y >= 12 && row.y <= height-12;
    }).map(function (row) { return Object.assign({},row,{anchorY:row.y}); });
    var placed=[];
    rows.forEach(function (row) {
      var compact=rows.some(function (other) { return other !== row && Math.abs(other.y-row.y) < Math.max(21,gap); });
      var textWidth=compact ? Math.max(width<500?32:40,(font+1.2)*2.4) : labelWidth;
      var x=endpointX+7;
      placed.forEach(function (other) {
        if (Math.abs(other.y-row.y)<Math.max(21,gap) && x<other.x+other.textWidth+3)
          x=other.x+other.textWidth+3;
      });
      if (x+textWidth<=width-4) placed.push(Object.assign({},row,{x:x,textWidth:textWidth,compact:compact}));
    });
    return placed;
  }

  root.SC_CLOUD_OVERLAY = Object.freeze({
    palette:palette, specs:specs, cloudSpecs:cloudSpecs, activeSpecs:activeSpecs,
    computeDaily:computeDaily, cloudBands:cloudBands, cloudPolygons:cloudPolygons,
    curveAnchors:curveAnchors, ribbonInk:ribbonInk, cloudInk:cloudInk,
    lineBullish:lineBullish, displayMetrics:displayMetrics,
    indicatorStroke:indicatorStroke, signedPercent:signedPercent,
    latestLabelsVisible:latestLabelsVisible, endpointLabels:endpointLabels
  });
})(typeof window !== "undefined" ? window : globalThis);
