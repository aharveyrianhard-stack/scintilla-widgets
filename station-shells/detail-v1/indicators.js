/* SCINTILLA · STATION DETAIL — the oscillator arithmetic, and nothing else.
   ============================================================================
   WHAT THIS IS: the four readings Alan named for the zoomed view — RSI, Williams %R,
   Stochastic and MACD — plus relative volume, computed from the SAME chart-API bars the
   price line is drawn from. No new table, no second provider, no fetch, no DOM, no clock.

   WHY IT IS COMPUTED HERE AND NOT READ: the inventory (24 Sep) says our stores hold
     · FMP daily, per ticker: ema 5/8/13/21/34, sma 50/100/150/200, wma20, dema20, tema20,
       rsi 14, standarddeviation 20, williams 14, adx 14   — NO stochastic, NO macd, NO rvol;
     · MASSIVE minute, per ticker: sma 50/100/150/200, ema 5/8/13/21/34, macd 12-26-9,
       rsi 14                                              — NO williams, NO stochastic, NO rvol.
   So Stochastic and relative volume exist in no store at all, Williams exists only as a
   DAILY number, and MACD only on the MINUTE timeframe. A detail view that must show all
   four on whatever timeframe the chart is showing can only get them from the bars.

   THE DEFINITIONS ARE THE ORDINARY ONES, so a number here and the same number on Alan's
   TradingView template mean the same thing:
     RSI(14)        Wilder smoothing, seeded with the simple mean of the first 14 changes.
     Williams %R(14) (highest high - close) / (highest high - lowest low) x -100.
     Stochastic(14,3,3) raw %K, then %K = 3-bar mean of raw, %D = 3-bar mean of %K.
     MACD(12,26,9)  EMA12 - EMA26, each EMA seeded with the simple mean of its first N
                    closes; signal = 9-bar EMA of the MACD line, seeded the same way.

   TWO RULES THE WHOLE FILE OBEYS:
     1. A reading that cannot be computed is NULL with a reason and a count — never 0,
        never 50, never a flat line. A flat range (high == low over the window) is a real
        state and returns null too, because %R and %K are undefined when the range is zero.
     2. Nothing is invented forward: index i of a series is computed only from bars 0..i. */
(function (root) {
  "use strict";

  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  const closes = (bars) => bars.map((b) => Number(b.c));
  const NY = "America/New_York";

  /* ---- the plain means, spelled out once ---- */
  function sma(values, length, at) {
    if (at < length - 1) return null;
    let sum = 0;
    for (let i = at - length + 1; i <= at; i++) {
      if (!finite(values[i])) return null;
      sum += values[i];
    }
    return sum / length;
  }
  /* An EMA seeded with the simple mean of its first `length` values, which is what
     TradingView's ta.ema does — a seed of "the first close" drifts for dozens of bars. */
  function emaSeries(values, length) {
    const out = new Array(values.length).fill(null);
    if (!Array.isArray(values) || values.length < length || length < 1) return out;
    const k = 2 / (length + 1);
    let prev = sma(values, length, length - 1);
    if (prev == null) return out;
    out[length - 1] = prev;
    for (let i = length; i < values.length; i++) {
      if (!finite(values[i])) { out[i] = null; continue; }
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }

  /* ---- RSI(14), Wilder ---- */
  function rsiSeries(bars, length) {
    const n = Number(length) || 14;
    const c = closes(bars);
    const out = new Array(c.length).fill(null);
    if (c.length <= n) return out;
    let gain = 0, loss = 0;
    for (let i = 1; i <= n; i++) {
      const d = c[i] - c[i - 1];
      if (d >= 0) gain += d; else loss -= d;
    }
    let avgGain = gain / n, avgLoss = loss / n;
    out[n] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = n + 1; i < c.length; i++) {
      const d = c[i] - c[i - 1];
      avgGain = (avgGain * (n - 1) + (d > 0 ? d : 0)) / n;
      avgLoss = (avgLoss * (n - 1) + (d < 0 ? -d : 0)) / n;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
  }

  /* ---- the window extremes both %R and %K stand on ---- */
  function extremes(bars, at, length) {
    if (at < length - 1) return null;
    let hi = -Infinity, lo = Infinity;
    for (let i = at - length + 1; i <= at; i++) {
      const h = Number(bars[i].h), l = Number(bars[i].l);
      if (!finite(h) || !finite(l)) return null;
      if (h > hi) hi = h;
      if (l < lo) lo = l;
    }
    return hi > lo ? { hi, lo } : null;   /* a zero-width range leaves %R and %K undefined */
  }

  /* ---- Williams %R(14): 0 at the top of the range, -100 at the bottom ---- */
  function williamsSeries(bars, length) {
    const n = Number(length) || 14;
    return bars.map((bar, i) => {
      const e = extremes(bars, i, n);
      if (!e) return null;
      const close = Number(bar.c);
      return finite(close) ? ((e.hi - close) / (e.hi - e.lo)) * -100 : null;
    });
  }

  /* ---- Stochastic(14,3,3) ---- */
  function stochasticSeries(bars, length, smoothK, smoothD) {
    const n = Number(length) || 14, sk = Number(smoothK) || 3, sd = Number(smoothD) || 3;
    const raw = bars.map((bar, i) => {
      const e = extremes(bars, i, n);
      if (!e) return null;
      const close = Number(bar.c);
      return finite(close) ? ((close - e.lo) / (e.hi - e.lo)) * 100 : null;
    });
    const k = raw.map((_, i) => sma(raw, sk, i));
    const d = k.map((_, i) => sma(k, sd, i));
    return { raw, k, d };
  }

  /* ---- MACD(12,26,9) ---- */
  function macdSeries(bars, fast, slow, signal) {
    const f = Number(fast) || 12, s = Number(slow) || 26, g = Number(signal) || 9;
    const c = closes(bars);
    const ef = emaSeries(c, f), es = emaSeries(c, s);
    const line = c.map((_, i) => (ef[i] == null || es[i] == null ? null : ef[i] - es[i]));
    /* The signal is a 9-bar EMA OF THE MACD LINE, so it starts where the line starts. */
    const start = line.findIndex((v) => v != null);
    const sig = new Array(line.length).fill(null);
    const hist = new Array(line.length).fill(null);
    if (start >= 0) {
      const tail = line.slice(start).map((v) => (v == null ? NaN : v));
      const se = emaSeries(tail, g);
      for (let i = 0; i < se.length; i++) if (se[i] != null) sig[start + i] = se[i];
    }
    for (let i = 0; i < line.length; i++)
      if (line[i] != null && sig[i] != null) hist[i] = line[i] - sig[i];
    return { line, signal: sig, histogram: hist };
  }

  /* ---- relative volume ------------------------------------------------------
     TWO HONEST ANSWERS, never one dressed as the other.

     (a) SAME TIME OF DAY. On an intraday timeframe a 10:00 bar is compared with the
         20 most recent PREVIOUS sessions' 10:00 bars, because volume at the open and
         volume at lunch are different animals. Today's own session never votes in its
         own average.
     (b) DAILY. On a daily/3-day/weekly timeframe there is no time of day, so it is this
         bar's volume against the mean of the previous 20 bars — and the caller is told
         `basis:"daily"` so the screen can SAY so.

     Either way the answer carries how many sessions actually voted (`n` of `want`); a
     thin history returns a number AND its thinness, or null when nothing can vote. */
  function sessionKey(ms) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: NY, year: "numeric", month: "2-digit", day: "2-digit" })
        .format(new Date(ms));
    } catch (e) { return String(new Date(ms).toISOString().slice(0, 10)); }
  }
  function timeKey(ms) {
    try {
      return new Intl.DateTimeFormat("en-GB", { timeZone: NY, hour: "2-digit", minute: "2-digit", hour12: false })
        .format(new Date(ms));
    } catch (e) { return String(new Date(ms).toISOString().slice(11, 16)); }
  }
  const INTRADAY = new Set(["15m", "30m", "1h", "2h", "3h", "4h", "6h", "12h"]);

  function relativeVolume(bars, range, options) {
    const opts = options || {};
    const want = Number(opts.sessions) || 20;
    const list = (bars || []).filter((b) => finite(Number(b.v)) && finite(Number(b.t)));
    if (!list.length) return { value: null, basis: null, n: 0, want, reason: "NO_VOLUME_IN_BARS" };
    const at = opts.at == null ? list.length - 1 : Number(opts.at);
    const bar = list[at];
    if (!bar) return { value: null, basis: null, n: 0, want, reason: "NO_SUCH_BAR" };
    const vol = Number(bar.v);

    if (INTRADAY.has(String(range))) {
      const slot = timeKey(bar.t), day = sessionKey(bar.t);
      const past = [];
      for (let i = at - 1; i >= 0 && past.length < want; i--) {
        const b = list[i];
        if (timeKey(b.t) !== slot) continue;
        if (sessionKey(b.t) === day) continue;          /* today never votes on itself */
        past.push(Number(b.v));
      }
      if (!past.length)
        return { value: null, basis: "time-of-day", slot, n: 0, want, reason: "NO_MATCHING_SLOT_IN_HISTORY" };
      const avg = past.reduce((s, v) => s + v, 0) / past.length;
      return { value: avg > 0 ? vol / avg : null, basis: "time-of-day", slot, n: past.length, want,
        average: avg, volume: vol, thin: past.length < want,
        reason: avg > 0 ? null : "HISTORY_HAS_NO_VOLUME" };
    }

    const past = [];
    for (let i = at - 1; i >= 0 && past.length < want; i--) past.push(Number(list[i].v));
    if (!past.length) return { value: null, basis: "daily", n: 0, want, reason: "NO_PRIOR_BARS" };
    const avg = past.reduce((s, v) => s + v, 0) / past.length;
    return { value: avg > 0 ? vol / avg : null, basis: "daily", n: past.length, want,
      average: avg, volume: vol, thin: past.length < want,
      reason: avg > 0 ? null : "HISTORY_HAS_NO_VOLUME" };
  }

  /* A per-bar rvol series for the volume row under the price — same rules, bar by bar. */
  function relativeVolumeSeries(bars, range, options) {
    return (bars || []).map((_, i) => relativeVolume(bars, range, Object.assign({}, options, { at: i })));
  }

  /* ---- one call the shell makes, so the page holds no arithmetic of its own ---- */
  function readings(bars, range, options) {
    const opts = options || {};
    const list = Array.isArray(bars) ? bars : [];
    const last = list.length - 1;
    const rsi = rsiSeries(list, opts.rsi || 14);
    const wpr = williamsSeries(list, opts.williams || 14);
    const st = stochasticSeries(list, opts.stochastic || 14, 3, 3);
    const macd = macdSeries(list, 12, 26, 9);
    const rvol = relativeVolume(list, range, { sessions: opts.sessions || 20 });
    const need = { rsi: (opts.rsi || 14) + 1, williams: opts.williams || 14, stochastic: (opts.stochastic || 14) + 5, macd: 26 + 8 };
    return {
      bars: list.length,
      rsi: { series: rsi, value: last >= 0 ? rsi[last] : null, length: opts.rsi || 14, need: need.rsi },
      williams: { series: wpr, value: last >= 0 ? wpr[last] : null, length: opts.williams || 14, need: need.williams },
      stochastic: { series: st, k: last >= 0 ? st.k[last] : null, d: last >= 0 ? st.d[last] : null, need: need.stochastic },
      macd: { series: macd, line: last >= 0 ? macd.line[last] : null, signal: last >= 0 ? macd.signal[last] : null,
        histogram: last >= 0 ? macd.histogram[last] : null, need: need.macd },
      relativeVolume: rvol
    };
  }

  root.SC_DETAIL_MATH = Object.freeze({
    sma, emaSeries, rsiSeries, williamsSeries, stochasticSeries, macdSeries,
    relativeVolume, relativeVolumeSeries, readings, INTRADAY_RANGES: Object.freeze(Array.from(INTRADAY))
  });
})(typeof globalThis === "object" ? globalThis : window);
