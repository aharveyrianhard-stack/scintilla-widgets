/* SCINTILLA · STATION — THE RSI FAN: one RSI(14) line per LOCKED source timeframe.
   ============================================================================
   Alan, 25 Sep: "we have a multi-timeframe RSI… I believe it's six lines — three hour, four
   hour, eight hour… the ones that I established on the Chrome tab group with oscillators."

   THE SOURCE OF TRUTH is the Indicator Lab's script (read, never edited):
     INDICATOR_LAB/sprints/2026-09-24-stack-alignment/threshold-experiments-20260924T223332Z/
       owner-review/RSI_MTF_Context_Threshold_Experiment_V1.pine
   and before it SCINTILLA_RSI_Fixed_Timeframe_Fan_V1.pine + RSI_FIXED_FAN_REVIEW_2026-09-17.md.
   Taken from it, exactly:
     · ta.rsi(close, 14) computed INSIDE each source timeframe, never on a resampled close;
     · source timeframes 2H 3H 4H 6H 8H 12H D; 2H is OFF by default, the other six ON;
     · one ink family (the script's indigo #526DFF), slower = more solid: transparency
       2H 55 · 3H 48 · 4H 40 · 6H 33 · 8H 26 · 12H 18 · D 10; every line width 1 except
       the Daily, which the script draws wider and dashed;
     · reference lines 30 / 50 / 70 with the "Upper green / lower red" boundary scheme:
       70 = #39D98A, 30 = #F05B78, 50 dotted in the family ink.
   Not taken (and why): the envelope cloud over 2D/3D/W/2W and the SMA20 signal (context the
   brief did not ask for), and the experiment's green/red RECOLOURING of a line while it is
   beyond 70/30 (the brief asks for one ink per line).

   THE ARITHMETIC is not written here. RSI is SC_DETAIL_MATH.rsiSeries from the detail shell
   (station-shells/detail-v1/indicators.js): Wilder smoothing seeded with the simple mean of
   the first 14 changes, which is what ta.rsi does.

   THE ONE RULE FOR PUTTING A SOURCE LINE ON A CHART BAR — NO PEEKING AHEAD:
     a chart bar shows the RSI of the LAST SOURCE BAR THAT HAD FINISHED by the time that
     chart bar finished. A 4H line on a daily chart shows the day's last 4H value; a daily
     line on a 4H chart shows yesterday's value until today's daily bar has closed. This is
     what the script's lookahead_off request (and, below the chart timeframe, its "last
     intrabar" sample) shows on historical bars.
   And one rule against lying by omission: a value is carried forward only across an
   ordinary market gap (MAX_CARRY_MS). A source that stopped updating stops on the chart
   and its label says the date it stopped — it is never stretched flat to the present.

   Pure functions. No fetch, no DOM, no clock of its own. */
(function (root) {
  "use strict";

  const HOUR = 3600000, DAY = 86400000;
  const INK = Object.freeze({ family:"#526DFF", upper:"#39D98A", lower:"#F05B78" });
  /* tf is the chart API token the provider client already maps (8h added to that map for this). */
  const LINES = Object.freeze([
    Object.freeze({ key:"2h",  tf:"2h",  label:"2H",  on:false, alpha:.45, durMs:2 * HOUR,  perSession:8 }),
    Object.freeze({ key:"3h",  tf:"3h",  label:"3H",  on:true,  alpha:.52, durMs:3 * HOUR,  perSession:6 }),
    Object.freeze({ key:"4h",  tf:"4h",  label:"4H",  on:true,  alpha:.60, durMs:4 * HOUR,  perSession:4 }),
    Object.freeze({ key:"6h",  tf:"6h",  label:"6H",  on:true,  alpha:.67, durMs:6 * HOUR,  perSession:4 }),
    Object.freeze({ key:"8h",  tf:"8h",  label:"8H",  on:true,  alpha:.74, durMs:8 * HOUR,  perSession:3 }),
    Object.freeze({ key:"12h", tf:"12h", label:"12H", on:true,  alpha:.82, durMs:12 * HOUR, perSession:2 }),
    /* A daily bar is stamped at midnight New York and its extended session ends at 20:00 New
       York, so it has FINISHED 20 hours after its stamp, in summer and in winter alike. */
    Object.freeze({ key:"1D",  tf:"1D",  label:"D",   on:true,  alpha:.90, durMs:20 * HOUR, perSession:1, daily:true })
  ]);
  const BY_KEY = Object.freeze(Object.fromEntries(LINES.map((l) => [l.key, l])));
  const ALIASES = Object.freeze({ "2h":"2h", "120":"2h", "3h":"3h", "180":"3h", "4h":"4h", "240":"4h",
    "6h":"6h", "8h":"8h", "12h":"12h", "1d":"1D", "d":"1D", "daily":"1D" });
  const LENGTH = 14;
  /* Wilder's average forgets its seed slowly; the first 150 values of a truncated history can
     sit a point or more away from TradingView's, which starts at the listing. They are
     computed and not drawn, like the cloud ribbon's warm-up. */
  const WARMUP = 150;
  const MIN_SOURCE = 300, MAX_SOURCE = 3000;
  const MAX_CARRY_MS = 4 * DAY;        /* a long weekend, never a stalled feed */
  const PANEL_SHARE = 0.26;            /* of the pane height, gap included: under the 28% ceiling */
  const PHONE_MAX = 390;

  /* ?rsi=  →  what the pane was asked for.
       absent / 0 / off      nothing
       1 / on / all          the script's default six (3H 4H 6H 8H 12H D)
       2h,4h,1D              exactly those, in the fan's own order
       auto                  the default six, asked for by a DECK PAGE rather than typed:
                             hidden when the window is phone-narrow (≤ 390 px).
     Tokens nobody recognises are dropped and reported, never guessed at. */
  function parseRsiParam(raw) {
    if (raw == null) return { on:false, explicit:false, lines:[], dropped:[] };
    const text = String(raw).trim().toLowerCase();
    if (text === "" || text === "0" || text === "off" || text === "false")
      return { on:false, explicit:true, lines:[], dropped:[] };
    const defaults = LINES.filter((l) => l.on).map((l) => l.key);
    if (text === "1" || text === "on" || text === "all" || text === "true")
      return { on:true, explicit:true, lines:defaults, dropped:[] };
    if (text === "auto") return { on:true, explicit:false, lines:defaults, dropped:[] };
    const want = new Set(), dropped = [];
    for (const token of text.split(/[\s,]+/).filter(Boolean)) {
      const key = ALIASES[token];
      if (key) want.add(key); else dropped.push(token);
    }
    const lines = LINES.map((l) => l.key).filter((k) => want.has(k));
    return { on:lines.length > 0, explicit:true, lines, dropped };
  }
  function visibleAt(request, windowWidth) {
    if (!request || !request.on) return false;
    return request.explicit || !(Number(windowWidth) <= PHONE_MAX);
  }

  /* How many source bars cover the chart's span plus the warm-up, bounded so a six-up
     wall never asks for more than it can use. Sessions per calendar day: 252/365. */
  function sourceLimit(key, spanMs) {
    const line = BY_KEY[key];
    if (!line) return MIN_SOURCE;
    const sessions = Math.max(0, Number(spanMs) || 0) / DAY * (252 / 365);
    /* rounded before the ceiling: 365 days x 252/365 is 252.00000000000003 in floating point */
    const need = Math.ceil(Math.round(sessions * line.perSession * 1e6) / 1e6) + WARMUP + 50;
    return Math.max(MIN_SOURCE, Math.min(MAX_SOURCE, need));
  }

  /* bars: [{ t: ms, c: close }] ascending → [{ t, end, v }] with the warm-up set to null. */
  function lineSeries(key, bars, math) {
    const line = BY_KEY[key];
    const M = math || root.SC_DETAIL_MATH;
    if (!line || !M || typeof M.rsiSeries !== "function") return [];
    const list = (bars || []).filter((b) => b && Number.isFinite(b.t) && Number.isFinite(b.c));
    const values = M.rsiSeries(list, LENGTH);
    return list.map((b, i) => ({ t:b.t, end:b.t + line.durMs, v:i < WARMUP ? null : values[i] }));
  }

  /* chartTimes: ascending ms of the chart's bars; chartDurMs: the chart's own nominal bar
     length, used only for the newest bar (every other bar ends where the next begins).
     Returns one value (or null) per chart bar. Two pointers: O(chart + source). */
  function sampleToChart(chartTimes, series, chartDurMs) {
    const n = chartTimes.length, out = new Array(n).fill(null);
    let j = -1;
    for (let i = 0; i < n; i++) {
      const end = i + 1 < n ? chartTimes[i + 1] : chartTimes[i] + (Number(chartDurMs) || DAY);
      while (j + 1 < series.length && series[j + 1].end <= end) j++;
      if (j < 0) continue;
      const s = series[j];
      if (s.v == null || end - s.end > MAX_CARRY_MS) continue;
      out[i] = s.v;
    }
    return out;
  }

  /* The label's facts: the newest finished value, when it finished, and whether the source
     has fallen behind the chart by more than an ordinary gap. */
  function lineStatus(series, chartLastEnd) {
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].v == null) continue;
      const stale = Number.isFinite(chartLastEnd) && chartLastEnd - series[i].end > MAX_CARRY_MS;
      return { value:series[i].v, t:series[i].t, end:series[i].end, stale };
    }
    return { value:null, t:null, end:null, stale:false };
  }

  function ink(key, alphaBoost) {
    const line = BY_KEY[key];
    const a = Math.min(1, (line ? line.alpha : 1) + (alphaBoost || 0));
    const hex = INK.family.slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return "rgba(" + r + "," + g + "," + b + "," + a.toFixed(2) + ")";
  }

  root.SC_RSI_FAN = Object.freeze({
    LINES, BY_KEY, INK, LENGTH, WARMUP, MIN_SOURCE, MAX_SOURCE, MAX_CARRY_MS, PANEL_SHARE, PHONE_MAX,
    parseRsiParam, visibleAt, sourceLimit, lineSeries, sampleToChart, lineStatus, ink
  });
})(typeof globalThis === "object" ? globalThis : window);
