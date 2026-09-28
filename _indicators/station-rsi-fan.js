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
   And one rule against lying by omission, counted in the CHART'S OWN BARS (which already skip
   nights, weekends and holidays): a finished source value may stand on the chart for as many
   bars as one source bar spans — a daily line on a 4H chart holds through today's five 4H bars,
   a 3H line on a daily chart holds for none. So a session the source never delivered is a gap
   in its line, a source that stopped stops on the chart, and the label names the day of the
   value it shows whenever the line does not reach the last completed bar. Nothing is ever
   stretched flat to the present.

   28 SEP — THE FULL FAN. Alan: "The oscillators look really weird to me. I don't think the oscillators
   include my RSI situation. Three hour, four hour, six hour, eight hour, 12 hour - that's not the full
   fan. And I only see one line in most of these." The Lab's CURRENT definition is V4 (read, never
   edited): INDICATOR_LAB/sprints/2026-09-24-stack-alignment/rotation-output/RSI_MTF_Context_V4.pine
   and V4-REVIEW-NOTES.md, the "installed V3/V4 independent MTF" card on the Lab page:
     · six visible lines 3H 4H 6H 8H 12H D (2H optional, off), RSI 14, no smoothing, extended session;
     · the SLOW CONTEXT CLOUD: at every bar, the band between the lowest and the highest of the 2D, 3D,
       W and 2W RSI(14) - "not moving averages", 24% opacity, drawn behind the lines;
     · 30 / 50 / 70 references; right-edge labels at each line's exact value, staggered sideways.
   The Station now draws exactly that. What it changes from the Lab, and why:
     · colour: the Station's rule (BRIEF-COMMON, Alan 23 Sep: "Daily up, daily down, green, red") - each
       line is green when its RSI is at or above where it stood a day earlier, red when below; the
       timeframe is told by the line's weight (fast thin and light, slow thick and solid) and by its tag
       at the right edge. The cloud keeps the Lab's family ink;
     · missing widths are COMPOSED from bars the fan already reads (never invented): the chart API has
       no 8H for futures and its stocks' 8H stopped on 18 Aug, and it serves futures only a month of
       intraday bars (6H: 82, 12H: 45). 8H = two 4H bars, 12H = three 4H bars, 6H = two 3H bars (on the
       Eastern clock the API cuts them on), 2D = two sessions, 2W = two weeks. A composed line is used
       only when the served one is missing, shorter or older (pickSource);
     · a short history is warmed up over 42+ bars instead of 150 (warmFor), so a futures line with a
       month of bars still draws; its readout carries "≈" because the first values can sit a few tenths
       from TradingView's, which starts at the listing.

   Pure functions. No fetch, no DOM, no clock of its own. */
(function (root) {
  "use strict";

  const HOUR = 3600000, DAY = 86400000;
  const INK = Object.freeze({ family:"#526DFF", upper:"#39D98A", lower:"#F05B78" });
  /* tf is the chart API token the provider client already maps (8h added to that map for this). */
  const LINES = Object.freeze([
    Object.freeze({ key:"2h",  tf:"2h",  label:"2H",  on:false, alpha:.26, width:.8,  durMs:2 * HOUR,  perSession:8 }),
    /* 28 Sep review: the five intraday RSIs move together, so they almost always share a colour; the
       first ramp (alpha .52-.84, width 1-1.6) read as one bundle at 1680. The timeframe is now told by a
       STRONG ramp - light and thin for fast, solid and heavy for slow - and the two fastest are broken
       (3H dotted, 4H dashed), so each line can be followed without its right-edge tag. */
    Object.freeze({ key:"3h",  tf:"3h",  label:"3H",  on:true,  alpha:.34, width:.9,  durMs:3 * HOUR,  perSession:6, dash:Object.freeze([1.5, 2.5]) }),
    Object.freeze({ key:"4h",  tf:"4h",  label:"4H",  on:true,  alpha:.46, width:1.1, durMs:4 * HOUR,  perSession:4, dash:Object.freeze([5, 3]) }),
    /* compose: { from, factor, gridH } - the served width is swapped for `factor` bars of `from` joined on
       the Eastern clock (buckets start every gridH hours from midnight New York) when pickSource says so */
    Object.freeze({ key:"6h",  tf:"6h",  label:"6H",  on:true,  alpha:.58, width:1.3, durMs:6 * HOUR,  perSession:4,
      compose:Object.freeze({ from:"3h", factor:2, gridH:6 }) }),
    Object.freeze({ key:"8h",  tf:"8h",  label:"8H",  on:true,  alpha:.72, width:1.7, durMs:8 * HOUR,  perSession:3,
      compose:Object.freeze({ from:"4h", factor:2, gridH:8 }) }),
    Object.freeze({ key:"12h", tf:"12h", label:"12H", on:true,  alpha:.86, width:2.1, durMs:12 * HOUR, perSession:2,
      compose:Object.freeze({ from:"4h", factor:3, gridH:12 }) }),
    /* A daily bar is stamped at midnight New York and its extended session ends at 20:00 New
       York, so it has FINISHED 20 hours after its stamp, in summer and in winter alike. */
    Object.freeze({ key:"1D",  tf:"1D",  label:"D",   on:true,  alpha:1,   width:2.6, durMs:20 * HOUR, perSession:1, daily:true })
  ]);
  /* THE SLOW CONTEXT CLOUD's four sources (Lab V4: min/max of 2D/3D/W/2W RSI14). Not lines: at each chart
     bar the band between the lowest and the highest of the four. A daily-and-longer bar has finished at
     its last session's 20:00 ET, which the NEXT bar's stamp tells better than a fixed length (a 3D bar
     that spans a weekend, a week stamped on its Sunday), so these end at the next stamp less 4 hours, and
     the newest one at its longest possible length. 2D and 2W are composed: the chart API's own 2D stopped
     on 16 Aug and it serves no 2W for futures. Pairs are counted from fixed anchors (2D: weekdays from
     22 Jan 2020, where the API's 2D starts; 2W: weeks from 31 Aug 2003, where its 2W starts), so a pair
     never shifts when a new day arrives. */
  const CONTEXT = Object.freeze([
    Object.freeze({ key:"c2D", tf:"1D", label:"2D", durMs:3 * DAY + 20 * HOUR, perSession:1 / 2, byNext:true,
      compose:Object.freeze({ from:"1D", factor:2, pairs:"weekday", anchor:Date.UTC(2020, 0, 22) }) }),
    Object.freeze({ key:"c3D", tf:"3D", label:"3D", durMs:4 * DAY + 20 * HOUR, perSession:1 / 3, byNext:true }),
    Object.freeze({ key:"cW",  tf:"1W", label:"W",  durMs:5 * DAY + 20 * HOUR, perSession:1 / 5, byNext:true }),
    Object.freeze({ key:"c2W", tf:"1W", label:"2W", durMs:12 * DAY + 20 * HOUR, perSession:1 / 10, byNext:true,
      compose:Object.freeze({ from:"cW", factor:2, pairs:"week", anchor:Date.UTC(2003, 7, 31) }) })
  ]);
  const CHART_LINES = Object.freeze([
    /* D2 (27 Sep) — the chart's OWN timeframes, so ?rsi=chart can draw the one RSI that matches the
       pane (Alan, 27 Sep: "the RSI as an oscillator pane on the chart is just easier"). Off in the
       default fan. durMs is when a bar has finished: 3D and 1W end on their last session's 20:00 ET. */
    Object.freeze({ key:"15m", tf:"15m", label:"15M", on:false, alpha:.90, durMs:HOUR / 4, perSession:64 }),
    Object.freeze({ key:"30m", tf:"30m", label:"30M", on:false, alpha:.90, durMs:HOUR / 2, perSession:32 }),
    Object.freeze({ key:"1h",  tf:"1h",  label:"1H",  on:false, alpha:.90, durMs:HOUR,      perSession:16 }),
    Object.freeze({ key:"3D",  tf:"3D",  label:"3D",  on:false, alpha:.90, durMs:2 * DAY + 20 * HOUR, perSession:1 / 3 }),
    Object.freeze({ key:"1W",  tf:"1W",  label:"W",   on:false, alpha:.90, durMs:4 * DAY + 20 * HOUR, perSession:1 / 5 })
  ]);
  /* every line a pane can ask for: the Lab's seven first (the fan's own order), then the chart's own */
  const ALL_LINES = Object.freeze(LINES.concat(CHART_LINES));
  const CONTEXT_BY_KEY = Object.freeze(Object.fromEntries(CONTEXT.map((l) => [l.key, l])));
  const BY_KEY = Object.freeze(Object.fromEntries(ALL_LINES.concat(CONTEXT).map((l) => [l.key, l])));
  const ALIASES = Object.freeze({ "2h":"2h", "120":"2h", "3h":"3h", "180":"3h", "4h":"4h", "240":"4h",
    "6h":"6h", "8h":"8h", "12h":"12h", "1d":"1D", "d":"1D", "daily":"1D",
    "15m":"15m", "30m":"30m", "1h":"1h", "60":"1h", "3d":"3D", "1w":"1W", "w":"1W", "weekly":"1W" });
  /* the chart's range → the line that IS that timeframe (?rsi=chart) */
  const CHART_KEY = Object.freeze({ "15m":"15m", "30m":"30m", "1h":"1h", "2h":"2h", "3h":"3h", "4h":"4h",
    "6h":"6h", "12h":"12h", "1D":"1D", "3D":"3D", "1W":"1W" });
  const LENGTH = 14;
  /* Wilder's average forgets its seed slowly; the first 150 values of a truncated history can
     sit a point or more away from TradingView's, which starts at the listing. They are
     computed and not drawn, like the cloud ribbon's warm-up. */
  const WARMUP = 150;
  const MIN_SOURCE = 300, MAX_SOURCE = 3000;
  /* MEASURED 25 Sep 19:40Z, read-only: the chart API's INTRADAY series end at a different bar
     depending on how many are asked for. MU 3H: limit 400 → newest 23 Sep 16:00; limit 500 and
     above → newest 22 Sep 13:00 (SPY 4H the same; daily unaffected up to 6,000). So a line that
     needs more than TAIL_LIMIT bars reads the tail and the history separately and joins them. */
  const TAIL_LIMIT = 400;
  const PANEL_SHARE = 0.26;            /* of the pane height, gap included: under the 28% ceiling */
  const PHONE_MAX = 390;

  /* ?rsi=  →  what the pane was asked for.
       absent / 0 / off      nothing
       1 / on / all          the script's default six (3H 4H 6H 8H 12H D)
       2h,4h,1D              exactly those, in the fan's own order
       auto                  the default six, asked for by a DECK PAGE rather than typed:
                             hidden when the window is phone-narrow (≤ 390 px).
       chart                 ONE line: RSI(14) of the chart's own timeframe (1h on a 1h chart,
                             W on a 1W chart), following the pane's range. The Hub asks for this.
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
    /* one line, the chart's own timeframe; it follows the pane when its range changes */
    if (text === "chart") return { on:true, explicit:true, chart:true, lines:[], dropped:[] };
    const want = new Set(), dropped = [];
    for (const token of text.split(/[\s,]+/).filter(Boolean)) {
      const key = ALIASES[token];
      if (key) want.add(key); else dropped.push(token);
    }
    const lines = ALL_LINES.map((l) => l.key).filter((k) => want.has(k));
    return { on:lines.length > 0, explicit:true, lines, dropped };
  }
  /* the lines a pane draws: the request's own list, or (?rsi=chart) the one line of its range */
  function linesFor(request, range) {
    if (!request || !request.on) return [];
    if (!request.chart) return request.lines;
    const key = CHART_KEY[range];
    return key ? [key] : [];
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

  /* Join a long history read and a short tail read on timestamps; the tail wins where both have a
     bar. If the two do not overlap, the history is NOT bridged across the hole: the tail alone is
     returned (a shorter line is honest, an RSI computed across missing bars is not). */
  function joinTail(history, tail) {
    const h = (history || []).slice().sort((a, b) => a.t - b.t);
    const tl = (tail || []).slice().sort((a, b) => a.t - b.t);
    if (!tl.length) return { bars: h, joined: false, hole: false };
    if (!h.length) return { bars: tl, joined: false, hole: false };
    const first = tl[0].t;
    if (h[h.length - 1].t < first) return { bars: tl, joined: false, hole: true };
    return { bars: h.filter((b) => b.t < first).concat(tl), joined: true, hole: false };
  }

  /* How many first values are computed and not drawn. A full history keeps the 150 above; a short one
     (a futures width with a month of bars) keeps at least three RSI lengths (42 bars: Wilder's average
     then carries under 5% of its seed) and at most a third of what there is, so the line still draws. */
  const WARMUP_MIN = 3 * LENGTH;
  function warmFor(n) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    return count >= 2 * WARMUP ? WARMUP : Math.max(WARMUP_MIN, Math.min(WARMUP, Math.floor(count / 3)));
  }
  /* bars: [{ t: ms, c: close }] ascending → [{ t, end, v, approx }] with the warm-up set to null. */
  function lineSeries(key, bars, math) {
    const line = BY_KEY[key];
    const M = math || root.SC_DETAIL_MATH;
    if (!line || !M || typeof M.rsiSeries !== "function") return [];
    const list = (bars || []).filter((b) => b && Number.isFinite(b.t) && Number.isFinite(b.c));
    const values = M.rsiSeries(list, LENGTH);
    const warm = warmFor(list.length), approx = warm < WARMUP;
    return list.map((b, i) => ({ t:b.t,
      end:line.byNext && i + 1 < list.length ? Math.max(b.t + DAY, list[i + 1].t - 4 * HOUR) : b.t + line.durMs,
      v:i < warm ? null : values[i], approx }));
  }

  /* ---- composing a width from bars the fan already reads (28 Sep) ---- */
  const NY_PARTS = typeof Intl === "object" ? new Intl.DateTimeFormat("en-US", { timeZone:"America/New_York",
    year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", hourCycle:"h23" }) : null;
  function etDayHour(ms) {
    if (!NY_PARTS) { const d = new Date(ms - 4 * HOUR); return { day:d.toISOString().slice(0, 10), hour:d.getUTCHours() }; }
    const p = {}; for (const x of NY_PARTS.formatToParts(new Date(ms))) p[x.type] = x.value;
    return { day:p.year + "-" + p.month + "-" + p.day, hour:Number(p.hour) % 24 };
  }
  /* Weekdays from `anchor` to `ms` (both UTC days): the 2D pair counter. */
  function weekdaysSince(anchor, ms) {
    const a = Math.floor(anchor / DAY), b = Math.floor((ms - 4 * HOUR) / DAY);   /* the stamp's New York day */
    const n = b - a, weeks = Math.floor(n / 7);
    let count = weeks * 5;
    for (let d = a + weeks * 7; d < b; d++) { const w = new Date(d * DAY).getUTCDay(); if (w >= 1 && w <= 5) count++; }
    return count;
  }
  /* bars [{ t, c }] ascending, joined `factor` at a time → [{ t, c, n }]. Intraday widths bucket on the
     Eastern clock (gridH), 2D pairs weekdays and 2W pairs weeks from fixed anchors. The close of a
     composed bar is its last member's close; its stamp is the bucket's start. A bucket missing members
     (a holiday, a gap in the served bars) still counts: it is what trading there was. */
  function composeBars(bars, spec) {
    const out = [];
    let key = null, cur = null;
    for (const b of bars || []) {
      if (!b || !Number.isFinite(b.t) || !Number.isFinite(b.c)) continue;
      let k, start;
      if (spec.gridH) {
        const et = etDayHour(b.t), off = et.hour % spec.gridH;
        k = et.day + "|" + (et.hour - off); start = b.t - off * HOUR;
      } else if (spec.pairs === "weekday") {
        k = Math.floor(weekdaysSince(spec.anchor, b.t) / spec.factor); start = null;
      } else {
        k = Math.floor(Math.floor((b.t - spec.anchor + 12 * HOUR) / (7 * DAY)) / spec.factor); start = null;
      }
      if (k !== key) { if (cur) out.push(cur); key = k; cur = { t:start == null ? b.t : start, c:b.c, n:1 }; }
      else { cur.c = b.c; cur.n++; }
    }
    if (cur) out.push(cur);
    return out;
  }
  /* The served width or the composed one. Composed wins only when the served one is missing, is too
     short to warm up properly (under 2 x WARMUP bars) while the composed one is longer, or ends more than
     one bar earlier than the composed one (a stopped series, like the stocks' 8H in Aug 2026). */
  function pickSource(key, served, composed) {
    const line = BY_KEY[key], a = served || [], b = composed || [];
    if (!b.length) return { bars:a, from:"served" };
    if (!a.length) return { bars:b, from:"composed" };
    const lastA = a[a.length - 1].t, lastB = b[b.length - 1].t;
    if (lastB - lastA > (line ? line.durMs : DAY)) return { bars:b, from:"composed", why:"the served bars stop earlier" };
    if (a.length < 2 * WARMUP && b.length > a.length) return { bars:b, from:"composed", why:"the served bars are too few" };
    return { bars:a, from:"served" };
  }
  /* Which source widths a fan needs and how many bars of each: every line's own width, the widths its
     composition reads (asked for `factor` times as many), and the context cloud's. */
  function fetchPlan(keys, spanMs, withContext) {
    const need = new Map();
    const want = (k, n) => { const line = BY_KEY[k]; if (!line) return; const tf = line.tf;
      need.set(tf, Math.max(need.get(tf) || 0, Math.min(MAX_SOURCE, n))); };
    const plan = (k) => {
      const line = BY_KEY[k]; if (!line) return;
      const n = sourceLimit(k, spanMs);
      if (!line.compose || line.tf !== BY_KEY[line.compose.from].tf) want(k, n);
      if (line.compose) want(line.compose.from, n * line.compose.factor);
    };
    for (const k of keys || []) plan(k);
    if (withContext) for (const c of CONTEXT) plan(c.key);
    return Array.from(need.entries());
  }
  /* The context cloud at each chart bar: { lo, hi } where all four sources have a finished value. */
  function envelope(perSource) {
    const lists = (perSource || []).filter(Array.isArray);
    if (lists.length < CONTEXT.length) return null;
    const n = lists[0].length, out = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      let lo = Infinity, hi = -Infinity, ok = true;
      for (const l of lists) { const v = l[i]; if (v == null) { ok = false; break; } if (v < lo) lo = v; if (v > hi) hi = v; }
      if (ok) out[i] = { lo, hi };
    }
    return out;
  }
  /* Up or down on the day: the newest finished value against the last one that had finished a day
     before it (for the daily line, the day before). Equal is up, as it is for the price. */
  function dayDirection(series) {
    let last = -1;
    for (let i = series.length - 1; i >= 0; i--) if (series[i].v != null) { last = i; break; }
    if (last < 0) return null;
    const cut = series[last].end - 20 * HOUR;
    for (let i = last - 1; i >= 0; i--) {
      if (series[i].v == null) return null;
      if (series[i].end <= cut) return series[last].v >= series[i].v ? "up" : "down";
    }
    return null;
  }
  /* A line's ink: the pane's own up/down colours at the line's weight (fast light, slow solid). */
  function lineInk(key, dir, palette, boost) {
    const line = BY_KEY[key];
    const hex = dir === "down" ? palette.bear : dir === "up" ? palette.bull : INK.family;
    const a = Math.min(1, (line ? line.alpha : 1) + (boost || 0));
    const h = String(hex || "").replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return "rgba(" + r + "," + g + "," + b + "," + a.toFixed(2) + ")";
  }

  /* How many chart bars one finished source value may stand for: the whole number of chart bars
     one source bar spans. 3H on 1D → 0; D on 4H → 5; 12H on 4H → 3; D on 1D → 0. */
  function carryBars(key, chartDurMs) {
    const line = BY_KEY[key];
    const chart = Number(chartDurMs) || DAY;
    return line ? Math.floor(line.durMs / chart) : 0;
  }

  /* chartTimes: ascending ms of the chart's bars; chartDurMs: the chart's own nominal bar length,
     used only for the newest bar (every other bar ends where the next begins).
     Returns one value (or null) per chart bar. Three pointers, all monotonic: O(chart + source). */
  function sampleToChart(chartTimes, series, chartDurMs, carry) {
    const n = chartTimes.length, out = new Array(n).fill(null);
    const ends = chartTimes.map((t, i) => i + 1 < n ? chartTimes[i + 1] : t + (Number(chartDurMs) || DAY));
    const allowance = Math.max(0, Math.floor(Number(carry) || 0));
    let j = -1, k = 0;
    for (let i = 0; i < n; i++) {
      while (j + 1 < series.length && series[j + 1].end <= ends[i]) j++;
      if (j < 0) continue;
      const s = series[j];
      if (s.v == null) continue;
      /* k: the first chart bar that could show this value - the one during which it finished */
      while (k < n && ends[k] < s.end) k++;
      if (i - k > allowance) continue;
      out[i] = s.v;
    }
    return out;
  }

  /* The label's facts: the newest finished value and when its source bar began, and whether the
     line fails to reach the chart's last COMPLETED bar (lastIx) - then the label names its day. */
  function lineStatus(series, values, lastIx) {
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i].v == null) continue;
      const reaches = Array.isArray(values) && lastIx >= 0 && values[lastIx] != null;
      return { value:series[i].v, t:series[i].t, end:series[i].end, stale:!reaches };
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


  /* WHERE THE INTRADAY LINES BEGIN, when that is inside the window on screen (28 Sep review). The chart
     API serves futures only about a month of intraday bars, so on an ES/NQ daily chart the 3H-12H lines
     start part-way across (4H/8H/12H read from 4H bars, 3H/6H from the shorter 3H history) and the D line
     runs alone before that. The panel marks those points instead of letting a lone D line pass for the
     whole fan. lines: the fan's lines ({ key, values }); start/end: the visible bar indexes. Returns null
     when every intraday line is drawn from the window's left edge (within `slack` bars), else
     { ix, keys, groups:[{ ix, keys, labels, text }] } - one group per start point (lines starting within a
     twentieth of the window of the group's first share its mark, so two rules never crowd), earliest
     first; ix is the earliest late start. */
  function lateStart(lines, start, end, slack) {
    const s = Math.max(0, Number(start) || 0), e = Number(end), k = slack == null ? 2 : slack;
    const late = [];
    for (const line of lines || []) {
      const spec = BY_KEY[line.key];
      if (!spec || spec.daily || !line.values) continue;
      let first = -1;
      for (let i = s; i <= e; i++) if (line.values[i] != null) { first = i; break; }
      if (first > s + k) late.push({ key:line.key, first });
    }
    if (!late.length) return null;
    const rank = (key) => LINES.findIndex((l) => l.key === key);
    late.sort((x, y) => x.first - y.first || rank(x.key) - rank(y.key));
    const groups = [], near = Math.max(k, Math.round((e - s) / 20));
    for (const l of late) {
      const g = groups[groups.length - 1];
      if (g && l.first - g.ix <= near) g.keys.push(l.key); else groups.push({ ix:l.first, keys:[l.key] });
    }
    const all = LINES.filter((l) => !l.daily && l.on).map((l) => l.key);
    for (const g of groups) {
      g.keys.sort((x, y) => rank(x) - rank(y));
      g.labels = g.keys.map((key) => BY_KEY[key].label);
      g.text = g.keys.length === all.length && g.keys.every((key, i) => key === all[i])
        ? g.labels[0] + "–" + g.labels[g.labels.length - 1] : g.labels.join("/");
    }
    return { ix:groups[0].ix, keys:late.map((l) => l.key).sort((x, y) => rank(x) - rank(y)), groups };
  }

  root.SC_RSI_FAN = Object.freeze({
    LINES, CHART_LINES, CONTEXT, BY_KEY, INK, LENGTH, WARMUP, WARMUP_MIN, MIN_SOURCE, MAX_SOURCE, TAIL_LIMIT, PANEL_SHARE, PHONE_MAX,
    CHART_KEY, parseRsiParam, linesFor, visibleAt, sourceLimit, joinTail, lineSeries, carryBars, sampleToChart, lineStatus, ink,
    warmFor, composeBars, pickSource, fetchPlan, envelope, dayDirection, lineInk, etDayHour, lateStart
  });
})(typeof globalThis === "object" ? globalThis : window);
