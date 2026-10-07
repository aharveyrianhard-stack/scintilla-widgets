/* SCINTILLA STATION · RS1 (6 Oct 2026) — a name's daily RSI read against ITS OWN last two years. Pure functions:
   it reads no data and draws nothing, so a page that fails to load it simply keeps the look it had.

   WHY. Alan, 6 Oct: "I see Netflix at 33 and I don't think that's green enough." and, on colouring RSI by each name's
   own extremes: "dude, that would be awesome … playbook-level, at the important levels, for the SPY, for the QQQ, for
   the macro." A fixed 30 / 70 is one ruler for every name. Here each name is its own ruler.

   THE SAME RULE AS THE HUB, value for value. The Hub's copy is supabase/functions/rsi-own-daily/rsi-own.mjs (it writes
   the nightly table public.rsi_own_percentiles and colours the board cell). tests/station-rs1-rsi-own-20261006.test.mjs
   runs this file against rows that loader produced from the live chart API, so the two repos cannot drift.

   TWO WAYS A STATION PAGE GETS A NAME'S SCALE.
     /chart (and its shell mirror)  holds no database client (ONE SOURCE, 22 Sep): it builds the scale itself with
                                    scaleFrom() from the finished daily bars the pane already reads for its ribbon.
     /geiger                        already reads the database for its FMP numbers: it reads the name's nightly row
                                    and hands it to read() as it is.

   DEFINITIONS (identical to the Hub's).
     RSI            Wilder's RSI(14) on finished daily closes, started at the first bar read.
     own two years  every finished daily session in the two calendar years BEFORE the reading being judged (the
                    estate's "prior observations only" rule). Saturday / Sunday prints are not sessions, except
                    Bitcoin's. A gap of more than 20 days means another company used the ticker before: only the bars
                    after it count.
     percentile     where a reading sits in that window, counted by days: 0 = under its lowest, 100 = at or over its highest.
     own extremes   at or below its own 10th percentile, or at or above its own 90th.
     too young      under one calendar year (or under 200 sessions) of its own RSI: no own scale, the page keeps its look. */
(function (root) {
  "use strict";
  const VERSION = "ro-1", PERIOD = 14, WINDOW_DAYS = 730, MIN_SPAN_DAYS = 365, MIN_SESSIONS = 200, JOIN_GAP_DAYS = 20;
  const OWN_LO = 10, OWN_HI = 90, DAY = 864e5;
  const SEVEN_DAY = Object.freeze(["BTCUSD"]);
  /* How many daily bars a pane's one shared daily read must hold for a full scale: two calendar years of a 7-day series
     (731) plus a run-in so Wilder's average has settled before the window starts. The same request the ribbon already
     makes, longer; never a second request. */
  const DAILY_NEED = 900;
  const LOW = Object.freeze([0, 255, 163]), HIGH = Object.freeze([255, 45, 85]);   // the Hub board's green and red

  function wilderRsi(closes, period) {
    const n = period || PERIOD, out = new Array(closes.length).fill(null);
    let ag = 0, al = 0;
    for (let i = 1; i < closes.length; i++) {
      const ch = closes[i] - closes[i - 1], g = ch > 0 ? ch : 0, l = ch < 0 ? -ch : 0;
      if (i <= n) {
        ag += g; al += l;
        if (i < n) continue;
        ag /= n; al /= n;
      } else {
        ag = (ag * (n - 1) + g) / n;
        al = (al * (n - 1) + l) / n;
      }
      out[i] = al === 0 ? (ag === 0 ? 50 : 100) : 100 - 100 / (1 + ag / al);
    }
    return out;
  }
  function percentileGrid(values) {
    const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (!s.length) return null;
    const grid = [];
    for (let k = 0; k <= 100; k++) {
      const i = (s.length - 1) * (k / 100), lo = Math.floor(i), hi = Math.ceil(i);
      grid.push(Math.round((s[lo] + (s[hi] - s[lo]) * (i - lo)) * 100) / 100);
    }
    return grid;
  }
  function percentileOf(grid, v) {
    const x = v == null || v === "" ? NaN : Number(v);
    if (!Array.isArray(grid) || grid.length !== 101 || !Number.isFinite(x)) return null;
    if (x < grid[0]) return 0;
    if (x >= grid[100]) return 100;
    let k = 0;
    for (let i = 0; i < 100; i++) if (grid[i] <= x) k = i; else break;
    const a = grid[k], b = grid[k + 1];
    /* 0 and 100 are the true ends only (at or under its lowest day, at or over its highest): a reading a hair inside the
       range reads 0.1 / 99.9, so the line never says "the lowest reading" of a name that has been lower. The Hub's rule. */
    const p = Math.round((k + (b > a ? (x - a) / (b - a) : 0)) * 10) / 10;
    return Math.min(99.9, x > grid[0] ? Math.max(0.1, p) : p);
  }
  function span(windowFrom, asOf) {
    const days = (Date.parse(asOf) - Date.parse(windowFrom)) / DAY;
    if (!Number.isFinite(days) || days >= 700) return "last two years";
    return "last " + Math.max(12, Math.round(days / 30.44)) + " months";
  }
  const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

  /* The name's own scale from finished daily bars, oldest first: [{ t: ms, c: close }] (or { d: ISO, p: close }, the
     ribbon's shape). `beforeMs` is the session of the reading being judged: only sessions before it are sampled. With
     no `beforeMs` the newest bar is taken as the reading. Returns null when there is too little to say anything. */
  function scaleFrom(symbol, barsIn, beforeMs) {
    const sevenDay = SEVEN_DAY.indexOf(symbol) >= 0;
    let bars = [];
    for (const b of barsIn || []) {
      const t = b && (typeof b.t === "number" ? b.t : Date.parse(b.d != null ? b.d : b.t)), c = Number(b && (b.c != null ? b.c : b.p));
      if (!Number.isFinite(t) || !Number.isFinite(c) || c <= 0) continue;
      if (!sevenDay) { const wd = new Date(t).getUTCDay(); if (wd === 0 || wd === 6) continue; }
      bars.push({ t, c });
    }
    let start = 0;
    for (let i = 1; i < bars.length; i++) if ((bars[i].t - bars[i - 1].t) / DAY > JOIN_GAP_DAYS) start = i;
    if (start) bars = bars.slice(start);
    if (bars.length < PERIOD + 1 + 20) return null;
    const rsi = wilderRsi(bars.map((b) => b.c));
    const judged = Number.isFinite(beforeMs) ? beforeMs : bars[bars.length - 1].t;
    const floor = judged - WINDOW_DAYS * DAY, win = [];
    let first = null;
    for (let i = 0; i < bars.length; i++) {
      if (rsi[i] == null || bars[i].t >= judged || bars[i].t <= floor) continue;
      if (first == null) first = bars[i].t;
      win.push(rsi[i]);
    }
    if (win.length < 20) return null;
    const grid = percentileGrid(win), spanDays = Math.round((judged - first) / DAY);
    return { ticker:symbol, as_of:dayOf(judged), window_from:dayOf(first), sessions:win.length,
      eligible:spanDays >= MIN_SPAN_DAYS && win.length >= MIN_SESSIONS,
      p10:grid[10], p20:grid[20], p50:grid[50], p80:grid[80], p90:grid[90], grid, version:VERSION };
  }

  /* The Hub's curve: nothing within 2 points of the name's own middle, then 35% tinted, fully coloured at its own
     10th / 90th. `neutral` is the surface's own resting colour ([r,g,b]): the Hub board's grey, this pane's pink, the
     /geiger row's purple — so a mid-range reading looks exactly as it did. Returns null for "leave it as it is". */
  function ownInk(pct, neutral) {
    const p = Number(pct);
    if (pct == null || !Number.isFinite(p) || !Array.isArray(neutral)) return null;
    const d = (p - 50) / 50;
    if (Math.abs(d) < 0.04) return null;
    const t = 0.35 + 0.65 * Math.min(1, Math.abs(d) / 0.8), to = d < 0 ? LOW : HIGH;
    return "rgb(" + neutral.map((c, i) => Math.round(c + (to[i] - c) * t)).join(",") + ")";
  }
  const ownExtreme = (pct) => pct != null && Number.isFinite(Number(pct)) && (Number(pct) <= OWN_LO || Number(pct) >= OWN_HI);
  function ownTitle(ticker, v, pct, spanWords) {
    const n = Math.round(Number(v));
    if (pct == null || !Number.isFinite(Number(pct))) return n + " — " + ticker + " has under a year of its own history: no own scale yet";
    const p = Number(pct), of = ticker + "'s " + (spanWords || "last two years");
    if (p <= 0) return n + " — the lowest reading of " + of;
    if (p >= 100) return n + " — the highest reading of " + of;
    if (p < 50) return n + " — lower than " + Math.min(99, Math.round(100 - p)) + "% of " + of;
    return n + " — higher than " + Math.min(99, Math.round(p)) + "% of " + of;
  }
  const hexRgb = (hex) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || "")); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null; };

  /* Everything a surface needs from a reading and the name's scale (scaleFrom's result, or a nightly table row).
     own:false means "no own scale": the caller keeps exactly the look it had (ink null, extreme false). */
  function read(ticker, v, scale, neutral) {
    const x = Number(v);
    if (!scale || v == null || !Number.isFinite(x)) return { pct:null, own:false, ink:null, extreme:false, title:"" };
    const pct = scale.eligible ? percentileOf(scale.grid, x) : null;
    if (pct == null) return { pct:null, own:false, ink:null, extreme:false, title:scale.eligible === false ? ownTitle(ticker, x, null) : "" };
    return { pct, own:true, ink:ownInk(pct, typeof neutral === "string" ? hexRgb(neutral) : neutral), extreme:ownExtreme(pct),
      title:ownTitle(ticker, x, pct, span(scale.window_from, scale.as_of)) };
  }

  root.SC_RSI_OWN = Object.freeze({ VERSION, PERIOD, WINDOW_DAYS, MIN_SPAN_DAYS, MIN_SESSIONS, OWN_LO, OWN_HI, DAILY_NEED, SEVEN_DAY,
    LOW, HIGH, wilderRsi, percentileGrid, percentileOf, span, scaleFrom, ownInk, ownExtreme, ownTitle, hexRgb, read });
})(typeof globalThis === "object" ? globalThis : window);
