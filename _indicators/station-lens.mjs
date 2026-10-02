/* SCINTILLA · STATION — THE CONTEXT LENS ON THE LIVE CHART PANE (CL4, 27 Sep 2026).
   ============================================================================
   Alan, 26–27 Sep: the last three trading days of 30-minute candles, in a small square, only on the
   3-day charts — "I like this one at the bottom left" — and "they could still be quite a bit smaller".

   WHAT IT IS: a second canvas, bottom-left of the plot, drawing the same name's 30-minute candles for
   its last three regular sessions (09:30–16:00 ET). The geometry and the drawing are the reviewed
   26 Sep bubble (/_indicators/lens-bars.mjs) at 60% of its size; nothing here re-derives them.
   WHEN: only when the pane's URL carries ?bubble= (O1, 27 Sep: 4h:12 on the nine 3-day pages, 30m:3 on
   the daily pages) AND the pane is showing the 3D or 1D range. Without the switch the chart never even
   loads this file.
   WHERE (O1, 27 Sep, Alan: "position must seek the emptiest dark space (not fixed)"): the emptiest
   region of the plot, bottom-left whenever bottom-left is as empty as anywhere; never the newest fifth,
   never the badge or the deck's arrows; it holds its place unless somewhere is clearly emptier. The
   pane records why (data-lens-why). A caret on the date axis marks where the lens' window starts.
   THE COST: one candle read per chart, re-read at most every ten minutes (a finished 30-minute bar
   cannot change), under the chart's own load permit so it never delays a price.
   STALE MUST LOOK STALE: if the newest bar belongs to a session older than the last one that has
   opened, the bubble is drawn dimmed and its head says STALE.
   ============================================================================ */
import { lastSessions, sessionsOf, flatten, barsToRequest, drawBubble, bubbleBox, placeBubble, layout,
  candleGeometry, drawCandles, CHAMFER, DIALS, TIMEFRAMES, HOURS, etParts, FLOOR } from "./lens-bars.mjs";
import { pathPoints, clearsTail, clearsTailPoints, emptiestSpot, inkReader, lineTailBox, DEFAULTS as PLACE } from "./lens-placement.mjs";

/* O1 (27 Sep), Alan: "30-minute is too short for 3-day charts -> use 4h; on DAILY charts use the
   30-minute lens. Weekly macro pages: no lens." The deck says which lens a page carries (4h:12 on the
   3-day pages, 30m:3 on the daily ones); the pane draws one only on those two ranges. */
export const RANGE = "3D";
/* 29 Sep, Alan: "THERE IS STILL A TON OF CHARTS WITHOUT A CONTEXT LENS… CONTEXT LENSES FOR SHORT TERM
   CHARTS ARE STILL USEFUL TO SHOW THE ZOOMED OUT VIEW." THE RULE: the lens shows the view the chart itself
   cannot. A 15-minute to 12-hour chart gets the zoomed-OUT view (daily candles, about three months); a 1D
   chart keeps the last three sessions of 30-minute candles; a 3D chart keeps twelve sessions of 4-hour
   candles; a 1W chart gets the last twenty daily candles. Every range on the ladder has one. */
export const INTRADAY_RANGES = Object.freeze(["15m", "30m", "1h", "2h", "3h", "4h", "6h", "12h"]);
export const LENS_FOR_RANGE = Object.freeze(Object.assign(
  Object.fromEntries(INTRADAY_RANGES.map((r) => [r, "1d:60"])), { "1D": "30m:3", "3D": "4h:12", "1W": "1d:20" }));
export const RANGES = Object.freeze(Object.keys(LENS_FOR_RANGE));
export const lensForRange = (range) => LENS_FOR_RANGE[range] || null;
export const REFRESH_MS = DIALS.refreshMin * 60000;
/* Its own colours. Candles follow the wall's rule (up green, down red: the chart's own --bull/--bear);
   everything else is a true grey (channels within 24 of each other, none above 210) and nothing white. */
export const INK = Object.freeze({ paper: "#0B0B0F", frame: "#4A4A50", ink: "#9C9CA4", dim: "#6E6E74" });
export const STALE_ALPHA = 0.42;

/* ---- the switch ---- */
/* "30m:3" → { timeframe:"30m", sessions:3 }; "4h:12" → twelve sessions of 4-hour bars. Anything else
   is off: a switch that cannot be read is not quietly turned into some other bubble. At most 15
   sessions (60 candles of 4h), because the chart API's newest bar moves above 400 bars. */
export function parseBubble(value) {
  const v = String(value || "").trim();
  const m = /^(15m|30m|1h|4h):([1-9]|1[0-5])$/.exec(v);
  if (m) return { timeframe: m[1], sessions: +m[2], key: m[0] };
  /* daily candles (29 Sep): 5 to 90 of them */
  const d = /^1d:([5-9]|[1-8][0-9]|90)$/.exec(v);
  return d ? { timeframe: "1d", sessions: +d[1], key: d[0] } : null;
}
/* a request FITS a range when it is that range's KIND of lens: intraday candles on a 1D or 3D chart (any
   of 15m/30m/1h/4h, as before), daily candles on a short chart or a weekly one */
export const wanted = (req, range) => {
  const own = parseBubble(lensForRange(range));
  return !!req && !!own && !!TIMEFRAMES[own.timeframe].daily === !!TIMEFRAMES[req.timeframe].daily;
};
/* The lens a pane draws: the page's own when it fits the pane's range; when the wall's timeframe bar has
   moved the pane to a range the page's lens does not fit, that range's lens instead. No request, no lens. */
export function lensFor(request, range) {
  const req = parseBubble(request);
  if (!req) return null;
  return wanted(req, range) ? req : parseBubble(lensForRange(range));
}
/* Futures and crypto keep their own clock (27 Sep night): the whole CME session, or the whole day. */
/* 29 Sep: DXUSD left this list. The dollar's bars are published 00:00-17:00 ET only (P3, 28 Sep: "no
   1h/15m bars in the dollar's evening session"), so on the CME clock its lens said STALE every evening;
   it is read on the stock-day hours and judged on the NYSE calendar like VIX and the yields. */
const FUTURES = new Set(["ESUSD", "NQUSD", "CLUSD", "GCUSD", "SIUSD"]);
export const marketOf = (t) => FUTURES.has(String(t || "").toUpperCase()) ? "globex"
  : CRYPTO.has(String(t || "").toUpperCase()) ? "allday" : "nyse";
const CRYPTO = new Set(["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "DOGEUSD", "ADAUSD", "AVAXUSD", "LINKUSD", "LTCUSD"]);
export const hoursOf = (tf, t) => TIMEFRAMES[tf] && TIMEFRAMES[tf].daily ? "allday"
  : FUTURES.has(String(t || "").toUpperCase()) ? "globex"
  : CRYPTO.has(String(t || "").toUpperCase()) ? "allday"
  : (TIMEFRAMES[tf] && TIMEFRAMES[tf].hours) || DIALS.hours;

/* ---- stale or not ---- */
/* The New York date of the newest session that has OPENED by `nowMs`: today once 09:30 ET has passed
   on a trading day, otherwise the trading day before. `settled` is the provider's own calendar
   (SC_PROVIDER.expectedSettledSession: NYSE holidays included); a day is a trading day exactly when
   the calendar would call it settled at 21:00 that evening. */
export function lastOpenedSession(nowMs, settled, dueMinutes = 9 * 60 + 30) {
  const now = etParts(nowMs);
  const cal = typeof settled === "function" ? settled : weekdayCalendar;
  const todayIsSession = cal(eveningOf(now.day)) === now.day;
  if (todayIsSession && now.minutes >= dueMinutes) return now.day;
  /* the calendar asked on yesterday evening: yesterday if it was a session, else the one before */
  return cal(eveningOf(new Date(Date.parse(now.day + "T12:00:00Z") - 86400e3).toISOString().slice(0, 10)));
}
function eveningOf(day) { return Date.parse(day + "T12:00:00Z") + 13 * 3600e3; }   /* 01:00Z next day = 21:00 EDT / 20:00 EST */
/* without the provider's calendar: weekdays only, and the evening boundary the provider uses (20:00 ET) */
function weekdayCalendar(ms) {
  const et = etParts(ms);
  let d = et.day;
  const isWeekday = (x) => { const w = new Date(x + "T12:00:00Z").getUTCDay(); return w >= 1 && w <= 5; };
  if (isWeekday(d) && et.minutes >= 20 * 60) return d;
  for (let i = 0; i < 10; i++) { d = new Date(Date.parse(d + "T12:00:00Z") - 86400e3).toISOString().slice(0, 10); if (isWeekday(d)) return d; }
  return d;
}
/* NOT STALE BEFORE THE FIRST BAR CAN EXIST (28 Sep, Alan: "the Station says the context lens is stale.
   Why?"). Today's session was expected from 09:30, but a 30-minute lens's first regular bar only
   completes at 10:00 (and is served a few minutes later), so every daily-page lens said STALE for the
   first half hour of each day. With `lens` = { hours, minutes }, today is expected only once its first
   bar in those hours has had time to complete and be served (open + one bar + 20 minutes). Futures and
   crypto lenses are judged on their own clock: stale only when the newest bar is more than two bars
   plus 30 minutes old while that market is open. Without `lens` the old 09:30 rule stands. */
const SERVE_GRACE_MIN = 20;
function cmeOpen(ms) {
  const e = etParts(ms), dow = new Date(e.day + "T12:00:00Z").getUTCDay();
  if (dow === 6) return false;
  if (dow === 0) return e.minutes >= 18 * 60;
  if (dow === 5) return e.minutes < 17 * 60;
  return e.minutes < 17 * 60 || e.minutes >= 18 * 60;
}
export function freshness(sessions, nowMs, settled, lens = null) {
  const newest = sessions && sessions.length ? sessions[sessions.length - 1] : null;
  /* A DAILY LENS (29 Sep) is stale only when it is missing TWO sessions: the newest settled one may take
     a while to be published, and a forming candle carries today anyway. Stocks, VIX, the dollar and the
     yields count NYSE sessions (so a Monday morning or the day after a holiday is never stale); futures
     and crypto only when their newest daily candle is more than four calendar days old. */
  if (lens && lens.minutes >= 1440) {
    if (!newest) return { stale: false, empty: true, expected: null, through: null };
    const label = `${newest.weekday} ${newest.dom}`;
    if (lens.market === "globex" || lens.market === "allday") {
      const age = (Date.parse(etParts(nowMs).day + "T12:00:00Z") - Date.parse(newest.day + "T12:00:00Z")) / 86400e3;
      return { stale: age > 4, empty: false, expected: null, through: newest.day, label };
    }
    const cal = typeof settled === "function" ? settled : weekdayCalendar;
    const settledDay = cal(nowMs);
    const before = cal(eveningOf(new Date(Date.parse(settledDay + "T12:00:00Z") - 86400e3).toISOString().slice(0, 10)));
    return { stale: newest.day < before, empty: false, expected: before, through: newest.day, label };
  }
  if (lens && (lens.hours === "globex" || lens.hours === "allday")) {
    const last = newest && newest.bars.length ? newest.bars[newest.bars.length - 1] : null;
    if (!last) return { stale: false, empty: true, expected: null, through: null };
    const width = (lens.minutes || 30) * 60000;
    const open = lens.hours === "allday" ? true : cmeOpen(nowMs);
    return { stale: open && nowMs - (last.t + width) > 2 * width + 30 * 60000, empty: false, expected: null,
             through: newest.day, label: `${newest.weekday} ${newest.dom}` };
  }
  /* 28 Sep midday: the candles are drawn from 04:00, but a name with no pre-market trade (XLRE today) has
     no 04:00 bar, so lateness is judged from the REGULAR open: today is expected once the first bar that
     ends after 09:30 (on the lens's own bar grid) has had time to be served — 30M after 10:20, 1H after
     10:20, 4H after 12:20. */
  const due = lens && HOURS[lens.hours]
    ? (() => { const o = HOURS[lens.hours].open, w = lens.minutes || 30, reg = 9 * 60 + 30;
               return o + (Math.floor(Math.max(0, reg - o) / w) + 1) * w + SERVE_GRACE_MIN; })()
    : 9 * 60 + 30;
  const expected = lastOpenedSession(nowMs, settled, due);
  if (!newest) return { stale: false, empty: true, expected, through: null };
  return { stale: newest.day < expected, empty: false, expected, through: newest.day,
           label: `${newest.weekday} ${newest.dom}` };
}

/* ---- the live price (29 Sep) ----
   Alan, 29 Sep: "THE CONTEXT LENSES AND CHARTS SOMETIMES DONT EVEN MATCH THE LIVE PRICE… I SAW A CONTEXT
   BAR FOR SPY THAT DIDNT MATCH THE LIVE PRICE OF THE CHART." Measured headlessly: after hours the SPY
   lenses ended at 766.07 (the 19:30 bar) while the badge said 764.20; replayed at 14:47 ET the 4H lens
   ended at 763.30 and the 30M lens at 763.97 while the badge said 764.80. The lens drew COMPLETED
   candles only; the main chart has drawn its forming point from the live price since P3 (28 Sep).
   Now the lens carries the same forming point, from the same quote the badge prints:
     · a live price in a LATER bucket that the lens's hours keep → a forming candle in that bucket, opened
       at the last completed close, its high and low widened by every tick seen while it forms;
     · a live price the lens's hours do not keep (after 20:00, overnight), inside the newest bar's own
       bucket, or without a time → it extends the newest candle: that candle's close becomes the live
       price and its high/low widen to reach it;
     · a price stamped BEFORE the newest bar started is older than the bars: nothing changes.
   So the newest close the lens shows is the price on the badge. `carry` is the last result for the same
   bar, so a forming candle's open, high and low survive from tick to tick. Pure; bars are not mutated. */
export function liveBars(bars, quote, { minutes = 30, hours = DIALS.hours, carry = null, nowMs = Date.now() } = {}) {
  const list = Array.isArray(bars) ? bars : [];
  const price = quote && Number(quote.price);
  if (!list.length || !(price > 0)) return { bars: list, forming: null };
  const last = list[list.length - 1], width = minutes * 60000;
  const at = quote.updated_ts != null && quote.updated_ts !== "" ? Date.parse(quote.updated_ts) : NaN;
  if (Number.isFinite(at) && at < last.t) return { bars: list, forming: null };
  if (Number.isFinite(at) && at > nowMs + width) return { bars: list, forming: null };   // a clock problem, not a price
  const keep = (b) => carry && carry.t === b.t ? carry : null;
  if (Number.isFinite(at) && at >= last.t + width) {
    const bucket = last.t + Math.floor((at - last.t) / width) * width;
    if (sessionsOf([{ t: bucket, o: price, h: price, l: price, c: price }], hours).length) {
      const was = keep({ t: bucket });
      const o = was ? was.o : last.c;
      const bar = { t: bucket, o, h: Math.max(o, price, was ? was.h : price), l: Math.min(o, price, was ? was.l : price), c: price, v: 0, live: true };
      return { bars: list.concat([bar]), forming: { mode: "new", t: bucket, o: bar.o, h: bar.h, l: bar.l, c: price } };
    }
  }
  const was = keep(last);
  const bar = { ...last, h: Math.max(last.h, price, was ? was.h : price), l: Math.min(last.l, price, was ? was.l : price), c: price, live: true };
  return { bars: list.slice(0, -1).concat([bar]), forming: { mode: "extend", t: last.t, o: bar.o, h: bar.h, l: bar.l, c: price } };
}

/* ---- where ---- */
const overlaps =(a, b, pad = 0) => !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);
/* Bottom-left at the bubble's size, or the reason it cannot be. The price line is ALLOWED under it
   (the far past); the newest fifth and the badge are not. */
export function bottomLeft(plot, box, pts, keepOut = [], opt = {}) {
  const edge = opt.edge == null ? PLACE.edge : opt.edge, margin = opt.margin == null ? PLACE.margin : opt.margin;
  const rect = { corner: "bl", x: plot.padL + edge, y: plot.padT + plot.ih - edge - box.h, w: box.w, h: box.h };
  if (box.w + edge * 2 > plot.iw || box.h + edge * 2 > plot.ih) return { spot: null, why: "the plot is smaller than the bubble" };
  /* a control the deck floats over the wall's left edge (its "previous page" arrow): the bubble slides
     right just past it and stays bottom-left */
  let slid = false;
  for (const k of opt.slidePast || []) {
    if (k && k.w > 0 && k.h > 0 && overlaps(rect, k, 4)) { rect.x = Math.max(rect.x, k.x + k.w + 4); slid = true; }
  }
  if (!clearsTail(rect, plot) && !clearsTailPoints(rect, pts, plot, margin))
    return { spot: null, why: "bottom-left would cover the newest fifth of the line" };
  if (keepOut.some((k) => k && k.w > 0 && k.h > 0 && overlaps(rect, k, margin)))
    return { spot: null, why: "bottom-left would cover the badge" };
  return { spot: rect, why: slid ? "bottom-left (fixed), moved right past the deck's page arrow" : "bottom-left (fixed)" };
}
/* O1 (27 Sep): no longer FIXED bottom-left. Alan: "position must seek the emptiest dark space (not
   fixed)". The lens takes the emptiest region of the plot (lens-placement.mjs emptiestSpot), bottom-left
   whenever bottom-left is as empty as anywhere, never in the newest fifth, never on the badge or the
   deck's arrows, and it keeps its place unless somewhere is meaningfully emptier. */
/* 28 Sep — THE RULE, REWRITTEN FOR THE NEW FIRST VIEWS AND FOR ZOOMING. Alan: "You made some level of
   rule but a partial rule; it doesn't consider zooming… play around with the default zooms and rewrite the
   rules so it fits cleanly." In plain words, in order:
     1. only over the OLDER four-fifths of the line on screen: never over its newest fifth, nor anything
        right of it (the average names, the live point, the price scale) - lens-placement lineTailBox;
     2. never on the ticker badge, the Geiger chip (top right) or the deck's arrows and timeframe tag;
     3. among the spots left, the one with the least already drawn in it (price line, clouds, grid lines,
        all read from the chart's own pixels); a spot the price line runs through costs a quarter of a
        box extra, so an empty patch always wins over a crossed one; and when every spot at the usual
        size crosses the line, the lens shrinks (one size down, then its smallest) before it sits on it;
     4. bottom-left whenever it is about as empty as the best spot (within 5% of the box);
     5. once placed it stays through data refreshes unless somewhere else is clearly (8%) emptier or its
        spot breaks rules 1-3;
     6. zoom and pan: while the view is moving the lens holds still (no re-reading of the pixels on every
        wheel notch); 0.2 s after the view stops it is placed again by rules 1-5, from the new picture;
     7. no spot at all (a pane too small for the box) - no lens, and the pane says why (data-lens-why).
   The same rule is checked by tests/station-zoom-fan-20260928.test.mjs. */
export const LENS_TOLERANCE = 0.05;
export const SETTLE_MS = 200;
/* rule 3b: a lens that would sit on the price line shrinks first - one size down, then its smallest (80% of
   that, never under the 79 x 50 floor) - and only when even that crosses the line does it take the
   least-crossed spot at its usual size */
export function lensBoxes(plot, size = DIALS.size) {
  const usual = bubbleBox(plot, size), small = bubbleBox(plot, "S");
  const least = { w: Math.max(FLOOR.w, Math.round(small.w * 0.8)), h: Math.max(FLOOR.h, Math.round(small.h * 0.8)) };
  const out = [usual];
  for (const b of [small, least]) if (!out.some((o) => o.w === b.w && o.h === b.h)) out.push(b);
  return out;
}
export function placeLens({ plot, series, points, keepOut = [], slidePast = [], ink, size = DIALS.size, prev = null }) {
  const pts = points || pathPoints(plot, series || []);
  const boxes = lensBoxes(plot, size);
  let res = null, box = boxes[0], first = null;
  for (const b of boxes) {
    const r = emptiestSpot({ plot, box: b, points: pts, ink, keepOut: keepOut.concat(slidePast), prefer: "bl", prev, tolerance: LENS_TOLERANCE });
    if (!first) first = { r, b };
    if (r.spot && !r.spot.covers) { res = r; box = b; if (b !== boxes[0]) res = { ...r, why: r.why + " (smaller, so it clears the price line)" }; break; }
  }
  if (!res) { res = first.r; box = first.b; }
  if (!res.spot) return { kind: "none", spot: null, fixed: false, fallback: true, why: res.why, box };
  const x0 = plot.padL + PLACE.edge, y1 = plot.padT + plot.ih - PLACE.edge - box.h;
  const corner = res.spot.y + box.h / 2 > plot.padT + plot.ih / 2 ? (res.spot.x + box.w / 2 < plot.padL + plot.iw / 2 ? "bl" : "br")
                                                                   : (res.spot.x + box.w / 2 < plot.padL + plot.iw / 2 ? "tl" : "tr");
  const atBL = Math.abs(res.spot.x - x0) <= 1 && Math.abs(res.spot.y - y1) <= 1;
  return { kind: "inset", spot: { corner, x: res.spot.x, y: res.spot.y, w: box.w, h: box.h }, fixed: false,
           fallback: !atBL, why: res.why, held: !!res.held, covers: !!res.spot.covers, box };
}

/* ============================================================================
   S8 (2 Oct) — THE OVAL. Alan: "Context lens oval-like shaped, from starting point to ending point, to save
   as much screen real estate as possible."
   The lens is drawn inside an ellipse whose long axis runs from the lens series' first bar to its last: the
   two tips are the start and the end of the zoomed-out view, so the oval TILTS with the series (a rising
   three months tilts up to the right, a falling one down) and its short axis is only as tall as the series'
   swings need. No box, no corner card: the candles are clipped to the ellipse, the edge is a faint line, the
   paper inside is the same dark paper as before. The timeframe / STALE tag sits in a 10 px row above it.
     · long axis  = the PANE width × 0.28 on a desktop, × 0.40 on a phone (the top window under 600 px);
     · short axis = the least that keeps the candles readable: the price range is drawn PLOT_H px tall
                    (a quarter of the long axis, 28 to 32 px - measured 2 Oct: letting it grow with the long
                    axis made the oval on a 4-up pane bigger than the card it replaces), then the ellipse is
                    grown just until every candle's
                    high, low and body corner is inside it, plus PAD px of air, rounded up to a 4 px step so a
                    tick does not resize it; never under MIN_SHORT, never taller than it is long;
     · where      = the S1 rule, unchanged: the ellipse's bounding box is the box the rule places (the
                    emptiest dark space, never the newest fifth, never the badge / chip / readout / arrows,
                    bottom-left when as empty as anywhere, held unless somewhere is clearly emptier).
   Toggle: deck ⋯ → lens: OVAL (default) · BOX. localStorage "station.lens.shape"; ?lens=box on a pane.
   ========================================================================== */
export const SHAPE_KEY = "station.lens.shape";
export const SHAPES = Object.freeze(["oval", "box"]);
export const OVAL = Object.freeze({ long: Object.freeze({ desktop: 0.28, phone: 0.40 }), phoneBelow: 600,
  inset: 0.82, minPlotH: 28, maxPlotH: 32, plotShare: 0.25, minShort: 34, pad: 3, step: 4, maxTilt: 30, tag: 10 });
/* ?lens= on the pane's own URL wins; then the browser's remembered choice; oval by default */
export function readShape({ search = "", stored = null } = {}) {
  const q = /(?:^|[?&])lens=(oval|box)(?:&|$)/.exec(String(search || ""));
  if (q) return q[1];
  return stored === "box" ? "box" : "oval";
}
export const isPhone = (topWidth) => Number(topWidth) > 0 && Number(topWidth) < OVAL.phoneBelow;
/* the long axis in px: the pane's width times the share, never wider than the room the rule has left of the
   newest fifth (so a lens is not dropped for being a few pixels too long) */
export function ovalLongAxis(paneWidth, phone, room = Infinity) {
  const want = Math.round(Math.max(0, Number(paneWidth) || 0) * (phone ? OVAL.long.phone : OVAL.long.desktop));
  return Math.max(0, Math.min(want, Math.floor(room)));
}
export const ovalPlotHeight = (long) => Math.round(Math.max(OVAL.minPlotH, Math.min(OVAL.maxPlotH, long * OVAL.plotShare)));
/* Pure. bars = the lens' candles (newest last, `session` set as flatten() sets it); long = the long axis in px.
   Returns the ellipse (a, b, theta, centre), the candle geometry in the same frame, the box around the tilted
   ellipse (bbox) and where the candle frame's origin sits inside that box (origin). Null without bars. */
export function ovalGeometry(bars, opt = {}) {
  const n = Array.isArray(bars) ? bars.length : 0;
  const long = Number(opt.long) || 0;
  if (!n || !(long > 0)) return null;
  const inset = opt.inset == null ? OVAL.inset : opt.inset, pad = opt.pad == null ? OVAL.pad : opt.pad;
  const step = opt.step == null ? OVAL.step : Math.max(1, opt.step), minShort = opt.minShort == null ? OVAL.minShort : opt.minShort;
  const maxTilt = (opt.maxTilt == null ? OVAL.maxTilt : opt.maxTilt) * Math.PI / 180;
  const plotH = opt.plotH > 0 ? opt.plotH : ovalPlotHeight(long);
  const a = long / 2;
  /* candleGeometry's own slots: one per bar, half a slot of air at each session break */
  let breaks = 0;
  for (let i = 1; i < n; i++) if (bars[i].session !== bars[i - 1].session) breaks++;
  const slots = n + breaks * 0.5;
  /* a first pass at the readable height gives the vertical distance between the start and the end point */
  const probe = candleGeometry(bars, { x: 0, y: 0, w: 1000, h: plotH });
  const mid = (c) => (c.yO + c.yC) / 2;
  const dy = probe.candles[n - 1].yC - mid(probe.candles[0]);
  /* the start and the end sit at ±inset of the long semi-axis; that distance less its vertical part is the
     horizontal run from the first bar's centre to the last's, and the candle frame is that run plus the half
     slots candleGeometry keeps outside the first and last centres */
  const run = Math.sqrt(Math.max(100, (2 * a * inset) ** 2 - dy * dy));
  const w = slots > 1 ? run * slots / (slots - 1) : run;
  const g = candleGeometry(bars, { x: 0, y: 0, w, h: plotH });
  const S = { x: g.candles[0].x, y: mid(g.candles[0]) }, E = { x: g.candles[n - 1].x, y: g.candles[n - 1].yC };
  const theta = Math.max(-maxTilt, Math.min(maxTilt, Math.atan2(E.y - S.y, E.x - S.x)));
  const centre = { x: (S.x + E.x) / 2, y: (S.y + E.y) / 2 };
  const cos = Math.cos(theta), sin = Math.sin(theta);
  /* the least short semi-axis that puts every candle inside: a point at (u, v) in the ellipse's own frame
     needs b ≥ |v| / sqrt(1 - (u/a)²) */
  const need = (x, y) => {
    const dx = x - centre.x, dyy = y - centre.y;
    const u = dx * cos + dyy * sin, v = -dx * sin + dyy * cos;
    const k = 1 - (u / a) ** 2;
    return k <= 1e-6 ? Infinity : Math.abs(v) / Math.sqrt(k);
  };
  let b = 0, binding = null;
  for (const cd of g.candles) {
    const hw = Math.max(0.5, cd.w / 2);
    for (const x of [cd.x - hw, cd.x + hw]) for (const y of [cd.yH, cd.yL]) {
      const r = need(x, y);
      if (Number.isFinite(r) && r > b) { b = r; binding = { x, y, i: cd.i }; }
    }
  }
  b = Math.max(minShort / 2, Math.ceil((b + pad) / step) * step);
  b = Math.min(b, a);
  const hw = Math.sqrt((a * cos) ** 2 + (b * sin) ** 2), hh = Math.sqrt((a * sin) ** 2 + (b * cos) ** 2);
  const bbox = { w: Math.ceil(hw * 2), h: Math.ceil(hh * 2) };
  return { a, b, theta, centre, candles: g, plotW: w, plotH, start: S, end: E, binding, bbox,
           origin: { x: bbox.w / 2 - centre.x, y: bbox.h / 2 - centre.y }, area: Math.PI * a * b };
}
/* is a point (in the candle frame) inside the ellipse? — the clip the candles are drawn under */
export function insideOval(geo, x, y, slack = 0) {
  const dx = x - geo.centre.x, dy = y - geo.centre.y, cos = Math.cos(geo.theta), sin = Math.sin(geo.theta);
  const u = dx * cos + dy * sin, v = -dx * sin + dy * cos;
  return (u / (geo.a + slack)) ** 2 + (v / (geo.b + slack)) ** 2 <= 1;
}
/* the S1 placement, asked for the oval's box: the same rule, the same keep-outs, one box (the long axis is
   fixed by the pane, so there is no size ladder to shrink down) */
export function placeOval({ plot, series, points, keepOut = [], slidePast = [], ink, box, prev = null }) {
  const pts = points || pathPoints(plot, series || []);
  const res = emptiestSpot({ plot, box, points: pts, ink, keepOut: keepOut.concat(slidePast), prefer: "bl", prev, tolerance: LENS_TOLERANCE });
  if (!res.spot) return { kind: "none", spot: null, fixed: false, fallback: true, why: res.why, box };
  const x0 = plot.padL + PLACE.edge, y1 = plot.padT + plot.ih - PLACE.edge - box.h;
  const corner = res.spot.y + box.h / 2 > plot.padT + plot.ih / 2 ? (res.spot.x + box.w / 2 < plot.padL + plot.iw / 2 ? "bl" : "br")
                                                                   : (res.spot.x + box.w / 2 < plot.padL + plot.iw / 2 ? "tl" : "tr");
  const atBL = Math.abs(res.spot.x - x0) <= 1 && Math.abs(res.spot.y - y1) <= 1;
  return { kind: "inset", spot: { corner, x: res.spot.x, y: res.spot.y, w: box.w, h: box.h }, fixed: false,
           fallback: !atBL, why: res.why, held: !!res.held, covers: !!res.spot.covers, box };
}
/* the pixels a lens covers: the card less its chamfer, or the ellipse */
export const coveredByBox = (w, h) => Math.round(w * h - CHAMFER * CHAMFER / 2);
export const coveredByOval = (geo) => Math.round(geo.area);
function currentShape(deps) {
  if (deps && typeof deps.shape === "function") { const s = deps.shape(); if (SHAPES.includes(s)) return s; }
  try { return readShape({ search: typeof location !== "undefined" ? location.search : "", stored: typeof localStorage !== "undefined" ? localStorage.getItem(SHAPE_KEY) : null }); }
  catch (_) { return "oval"; }
}
function topWidth() { try { return (window.top || window).innerWidth; } catch (_) { return window.innerWidth; } }

/* ---- the frame: a card with the corner that faces the chart cut at 45° ---- */
export function framePath(ctx, w, h, corner = "bl", cut = CHAMFER) {
  const c = Math.min(cut, w / 3, h / 3);
  ctx.beginPath();
  /* bottom-left: the line is above and to the right, so the top-right corner is cut */
  const cuts = { bl: "tr", br: "tl", tl: "br", tr: "bl", tc: "br", bc: "tr" };
  const cutAt = cuts[corner] || "tr";
  const P = { tl: [[0, c], [c, 0]], tr: [[w - c, 0], [w, c]], br: [[w, h - c], [w - c, h]], bl: [[c, h], [0, h - c]] };
  const full = { tl: [[0, 0]], tr: [[w, 0]], br: [[w, h]], bl: [[0, h]] };
  const order = ["tl", "tr", "br", "bl"];
  let first = true;
  for (const k of order) for (const [x, y] of (k === cutAt ? P[k] : full[k])) { first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; }
  ctx.closePath();
}

/* ============================================================================
   THE PANE SIDE. `deps` are the chart's own functions, handed in so this file reads nothing the pane
   does not already read: fetchCandles (fetchProviderCandles), permit (acquireChartLoadPermit),
   redraw (scChartDraw), colours (chColors), day (the pane's up/down claim), settled (the provider's
   calendar), isNamedAbsence.
   ============================================================================ */
const cache = new Map();      // ticker|timeframe → { ts, bars, absence }
const inflight = new Map();

export function state(host) { return host && host._lens; }

export async function ensure(host, deps, req, generation) {
  const want = lensFor(deps.request(), deps.range());
  if (!want || !host || !host.isConnected) return;
  const t = host.dataset.t, key = t + "|" + want.timeframe;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < REFRESH_MS) { deps.redraw(host); return; }
  if (inflight.has(key)) return;
  const work = (async () => {
    let release = null;
    try {
      release = await deps.permit(host, req + "|lens", generation);
      if (host._req !== req || !host.isConnected || host._transitionGeneration !== generation) return;
      const tf = TIMEFRAMES[want.timeframe].tf;
      const rows = await deps.fetchCandles(t, tf, barsToRequest(want.timeframe, want.sessions, hoursOf(want.timeframe, t)), 1);
      const bars = (Array.isArray(rows) ? rows : []).map((r) => ({ t: r.timestamp * 1000, o: +r.open, h: +r.high, l: +r.low, c: +r.close, v: +r.volume }))
        .filter((b) => Number.isFinite(b.t) && b.o > 0 && b.h > 0 && b.l > 0 && b.c > 0);
      cache.set(key, { ts: Date.now(), bars, absence: null });
    } catch (error) {
      /* a named absence is an answer (nothing is drawn, and the pane says why); a delay keeps any
         bars already held, and is asked again on the next refresh */
      const prev = cache.get(key);
      if (deps.isNamedAbsence(error)) cache.set(key, { ts: Date.now(), bars: [], absence: String(error.scAbsence || "not served") });
      else if (prev) cache.set(key, { ...prev, ts: Date.now() - REFRESH_MS + 60000 });
    } finally {
      if (release) release();
    }
    if (host.dataset.t === t && host.isConnected) deps.redraw(host);
  })();
  inflight.set(key, work);
  try { await work; } finally { inflight.delete(key); }
}

function canvasFor(host) {
  let cv = host.querySelector(".sc-nchart__lens");
  if (!cv) {
    const area = host.querySelector(".sc-nchart__area");
    if (!area) return null;
    cv = document.createElement("canvas");
    cv.className = "sc-nchart__lens";
    cv.setAttribute("role", "img");
    /* below the badge (z 3), above the chart; never takes the pointer, so pan and zoom are untouched */
    cv.style.cssText = "position:absolute;z-index:2;pointer-events:none;display:none";
    area.appendChild(cv);
  }
  return cv;
}
function hide(host, why) {
  const cv = host.querySelector(".sc-nchart__lens");
  if (cv) cv.style.display = "none";
  const mk = host.querySelector(".sc-nchart__lensmark");
  if (mk) mk.style.display = "none";
  host._lens = null;
  host._lensMemo = null;
  host._lensPlaced = null;
  if (why) host.dataset.lensWhy = why; else delete host.dataset.lensWhy;
  delete host.dataset.lensState;
}

/* Called after every chart paint. Cheap when nothing changed: a hover or a scrub repaints the chart
   but not the bubble. */
export function paint(host, deps) {
  const want = lensFor(deps.request(), deps.range());
  if (!want) return hide(host, null);
  const plot = host._plot, pts = host._series, t = host.dataset.t;
  if (!plot || !pts || pts.length < 2) return hide(host, "the chart has not drawn yet");
  const entry = cache.get(t + "|" + want.timeframe);
  if (!entry) return hide(host, `${want.timeframe} bars not read yet`);
  if (entry.absence) return hide(host, `no ${want.timeframe} bars: ${entry.absence}`);
  const hours = hoursOf(want.timeframe, t), minutes = TIMEFRAMES[want.timeframe].minutes;
  /* completed bars decide freshness; the drawing carries the live price (liveBars, 29 Sep) */
  const done = lastSessions(entry.bars, want.sessions, hours);
  const quote = deps.quote ? deps.quote(host) : null;
  const carry = host._lensForming && host._lensForming.t0 === t + "|" + want.key ? host._lensForming : null;
  const live = liveBars(flatten(sessionsOf(entry.bars, hours)), quote, { minutes, hours, carry });
  const sessions = lastSessions(live.bars, want.sessions, hours);
  const daily = !!TIMEFRAMES[want.timeframe].daily;
  /* daily candles are one run, not sessions with air between them */
  const bars = daily ? flatten(sessions).map((b) => ({ ...b, session: 0 })) : flatten(sessions);
  if (!bars.length) return hide(host, `no ${want.timeframe} bars in ${hours} hours`);
  host._lensForming = live.forming ? { ...live.forming, t0: t + "|" + want.key } : null;
  /* rule 6: the view is moving (a wheel, a drag, a pinch) - a lens already on screen holds still, and one
     placement is made once the view has been still for SETTLE_MS */
  const since = host._viewMovedAt ? performance.now() - host._viewMovedAt : Infinity;
  if (since < SETTLE_MS && host._lens && host._lens.spot && host._lens.t === t && host._lens.key === want.key) {
    if (!host._lensSettle) host._lensSettle = setTimeout(() => { host._lensSettle = null; if (host.isConnected) deps.redraw(host); }, SETTLE_MS - since + 20);
    return;
  }
  const fresh = freshness(done, Date.now(), deps.settled, { hours, minutes, market: marketOf(t) });
  const day = deps.day(host);
  const area = host.querySelector(".sc-nchart__area");
  const badge = host.querySelector(".sc-nchart__live");
  const controls = deckControls(area);
  const chip = host._geigerSpot && host.querySelector(".sc-nchart__live-geiger:not([hidden])") ? host._geigerSpot : null;
  /* S8: the shape, and for the oval the box its series needs (the long axis from the pane, the short axis
     from the candles) - a changed box is placed again; a tick inside the same box is not */
  const shape = currentShape(deps);
  const phone = isPhone(topWidth());
  /* the line in pane pixels (pts is the chart's series of dates and prices); the room is what lies left of its newest fifth */
  const path = pathPoints(plot, pts);
  const room = lineTailBox(plot, path).x - plot.padL - PLACE.edge * 2;
  const geo = shape === "oval" ? ovalGeometry(bars, { long: ovalLongAxis(area.clientWidth, phone, room) }) : null;
  const ovalBox = geo ? { w: geo.bbox.w, h: geo.bbox.h + OVAL.tag } : null;
  const sig = [controls.map((c) => [c.x, c.y, c.w, c.h].map(Math.round).join(",")).join(";"), area.clientWidth, area.clientHeight, plot.padL, plot.padT, plot.iw, plot.ih, plot.start, plot.end,
    pts.length, pts[pts.length - 1].d, entry.ts, fresh.stale, day, badge ? badge.offsetHeight + "x" + badge.offsetWidth : "",
    chip ? [chip.x, chip.y, chip.w, chip.h].map(Math.round).join(",") : "",
    /* the ribbon arriving after the lens repaints the ink it must avoid: place again */
    (host._cloudTicker || "") + ":" + ((host._cloudRows && host._cloudRows.length) || 0),
    shape, ovalBox ? ovalBox.w + "x" + ovalBox.h : ""].join("|");
  /* a tick changes the drawing, not the place: the pixels are read again only when the place signature moves */
  const last = bars[bars.length - 1];
  const drawSig = sig + "|" + [last.t, last.o, last.h, last.l, last.c].join(",");
  if (host._lensMemo === drawSig) return;
  host._lensMemo = drawSig;

  const keepOut = [];
  if (badge && badge.offsetWidth) {
    const a = area.getBoundingClientRect(), b = badge.getBoundingClientRect();
    keepOut.push({ x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height });
  }
  if (chip) keepOut.push(chip);
  /* the crosshair readout's fixed corner (S1, 29 Sep) is reserved, so a readout never lands on the lens */
  if (host._readoutSpot && host._readoutSpot.w > 0) keepOut.push(host._readoutSpot);
  const main = host.querySelector(".sc-nchart__cv");
  /* one read of the chart's pixels per paint, shared with the Geiger chip (host._inkAt, reset by the chart) */
  const inkAt = host._inkAt || (main ? (host._inkAt = inkReader(main)) : null);
  const prev = host._lens && host._lens.spot && host._lens.t === t && host._lens.key === want.key ? host._lens.spot : null;
  const where = host._lensPlaced && host._lensPlaced.sig === sig && host._lens && host._lens.t === t && host._lens.key === want.key
    ? host._lensPlaced.where
    : geo ? placeOval({ plot, points: path, keepOut, slidePast: controls, ink: inkAt, box: ovalBox, prev })
          : placeLens({ plot, points: path, keepOut, slidePast: controls, ink: inkAt, prev });
  host._lensPlaced = { sig, where };
  if (!where.spot) { hide(host, where.why); return; }

  const cv = canvasFor(host);
  if (!cv) return;
  const r = where.spot, dpr = window.devicePixelRatio || 1;
  cv.style.left = r.x + "px"; cv.style.top = r.y + "px";
  cv.style.width = r.w + "px"; cv.style.height = r.h + "px"; cv.style.display = "block";
  if (cv.width !== Math.round(r.w * dpr) || cv.height !== Math.round(r.h * dpr)) { cv.width = Math.round(r.w * dpr); cv.height = Math.round(r.h * dpr); }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.w, r.h);
  const col = deps.colours();
  const palette = { bull: col.bull, bear: col.bear, ink: INK.ink, dim: INK.dim, paper: INK.paper, frame: INK.frame };
  if (geo) {
    /* THE OVAL: paper inside the ellipse, the candles clipped to it, a faint edge, the tag in the row above */
    const ox = geo.origin.x, oy = geo.origin.y + OVAL.tag, cx = geo.centre.x + ox, cy = geo.centre.y + oy;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, geo.a, geo.b, geo.theta, 0, Math.PI * 2);
    ctx.globalAlpha = DIALS.opacity; ctx.fillStyle = INK.paper; ctx.fill(); ctx.globalAlpha = 1; ctx.clip();
    ctx.translate(ox, oy);
    drawCandles(ctx, bars, geo.candles, { colour: DIALS.colour, day, pal: palette });
    if (fresh.stale) { ctx.globalAlpha = 1 - STALE_ALPHA; ctx.fillStyle = INK.paper; ctx.fillRect(-ox, -oy, r.w, r.h); ctx.globalAlpha = 1; }
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1, geo.a - 0.5), Math.max(1, geo.b - 0.5), geo.theta, 0, Math.PI * 2);
    ctx.strokeStyle = INK.frame; ctx.lineWidth = 1; ctx.globalAlpha = fresh.stale ? 0.45 : 0.7; ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = `600 8px "SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace`;
    ctx.textBaseline = "middle"; ctx.textAlign = "center"; ctx.fillStyle = INK.ink; ctx.globalAlpha = 0.85;
    ctx.fillText(want.timeframe.toUpperCase() + (fresh.stale ? " · STALE" : ""), cx, OVAL.tag / 2 + 0.5);
    ctx.restore();
    const through = fresh.label ? ` through ${fresh.label}` : "";
    cv.setAttribute("aria-label", `${t}: ${want.timeframe} candles, last ${sessions.length} ${daily ? "days" : "sessions"}${through}, in an oval` +
      (fresh.stale ? ` — STALE: the last session that has opened is ${fresh.expected}` : ""));
    host.dataset.lensState = fresh.stale ? "stale" : "fresh";
    host.dataset.lensWhy = where.why;
    host.dataset.lensShape = "oval";
    const mark = paintMark(host, plot, pts, bars[0].t);
    host._lens = { t, key: want.key, spot: r, why: where.why, fallback: where.fallback, stale: fresh.stale, through: fresh.through,
                   expected: fresh.expected, bars: bars.length, sessions: sessions.length, readAt: entry.ts, markX: mark,
                   last: last.c, lastT: new Date(last.t).toISOString(), forming: live.forming ? live.forming.mode : null,
                   shape: "oval", covered: coveredByOval(geo), boxCovered: coveredByBox(r.w, r.h - OVAL.tag),
                   oval: { cx: r.x + cx, cy: r.y + cy, a: geo.a, b: geo.b, theta: geo.theta, long: geo.a * 2, short: geo.b * 2, plotH: geo.plotH, phone } };
    return;
  }
  ctx.save();
  framePath(ctx, r.w, r.h, r.corner);
  ctx.globalAlpha = DIALS.opacity; ctx.fillStyle = INK.paper; ctx.fill();
  ctx.globalAlpha = 1; ctx.clip();
  const inner = { x: 0, y: 0, w: r.w, h: r.h };
  /* O1: no ticker (the badge names it), no WED/THU/FRI; the small timeframe tag stays because the
     3-day pages (4H) and the daily pages (30M) now carry different lenses */
  drawBubble(ctx, inner, { bars, sessions, day, symbol: null, axis: false, timeframe: want.timeframe.toUpperCase(),
    colour: DIALS.colour, volume: false, font: 8 }, { palette });
  ctx.globalAlpha = 1;
  if (fresh.stale) {
    /* dimmed: a paper veil over the whole drawing (drawBubble sets its own alpha, so it cannot be dimmed from
       outside), then the head's right side names it: STALE, over a solid patch */
    ctx.globalAlpha = 1 - STALE_ALPHA; ctx.fillStyle = INK.paper; ctx.fillRect(0, 0, r.w, r.h); ctx.globalAlpha = 1;
    const L = layout(inner, {});
    ctx.font = `600 8px "SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace`;
    ctx.textBaseline = "middle"; ctx.textAlign = "right";
    const w = ctx.measureText("STALE").width;
    ctx.fillStyle = INK.paper; ctx.fillRect(r.w - w - 10, 1, w + 8, L.head.h - 1);
    ctx.fillStyle = INK.ink; ctx.fillText("STALE", r.w - 6, L.head.h / 2 + 0.5);
  }
  ctx.restore();
  ctx.save(); ctx.translate(0.5, 0.5); framePath(ctx, r.w - 1, r.h - 1, r.corner);
  ctx.strokeStyle = INK.frame; ctx.lineWidth = 1; ctx.globalAlpha = fresh.stale ? 0.6 : 1; ctx.stroke(); ctx.restore();

  const through = fresh.label ? ` through ${fresh.label}` : "";
  cv.setAttribute("aria-label", `${t}: ${want.timeframe} candles, last ${sessions.length} ${daily ? "days" : "sessions"}${through}` +
    (fresh.stale ? ` — STALE: the last session that has opened is ${fresh.expected}` : ""));
  host.dataset.lensState = fresh.stale ? "stale" : "fresh";
  host.dataset.lensWhy = where.why;
  host.dataset.lensShape = "box";
  const mark = paintMark(host, plot, pts, bars[0].t);
  host._lens = { t, key: want.key, spot: r, why: where.why, fallback: where.fallback, stale: fresh.stale, through: fresh.through,
                 expected: fresh.expected, bars: bars.length, sessions: sessions.length, readAt: entry.ts, markX: mark,
                 /* the newest price the lens shows, and whether it is the live price (a forming or extended candle) */
                 last: last.c, lastT: new Date(last.t).toISOString(), forming: live.forming ? live.forming.mode : null,
                 shape: "box", covered: coveredByBox(r.w, r.h) };
}

/* O1, Alan: "add a small mark on the date axis where the lens window starts". A 5-px caret under the
   plot at the chart bar that holds the lens' first candle. When that bar is off screen (panned away),
   no mark. Returns the x it drew at, or null. */
export function markIndex(series, startMs) {
  let at = -1;
  for (let i = series.length - 1; i >= 0; i--) {
    const d = Date.parse(series[i] && series[i].d);
    if (Number.isFinite(d) && d <= startMs) { at = i; break; }
  }
  return at;
}
function paintMark(host, plot, series, startMs) {
  const area = host.querySelector(".sc-nchart__area");
  let el = host.querySelector(".sc-nchart__lensmark");
  const i = markIndex(series, startMs);
  if (i < plot.start || i > plot.end) { if (el) el.style.display = "none"; return null; }
  const span = Math.max(1, plot.end - plot.start + (plot.rightBars || 0));
  const x = plot.padL + ((i - plot.start) / span) * plot.iw;
  if (!el && area) {
    el = document.createElement("div");
    el.className = "sc-nchart__lensmark";
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:absolute;z-index:2;pointer-events:none;width:0;height:0;" +
      `border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:5px solid ${INK.ink}`;
    area.appendChild(el);
  }
  if (!el) return null;
  el.style.left = Math.round(x - 4) + "px";
  el.style.top = Math.round(plot.padT + plot.ih + 1) + "px";
  el.style.display = "block";
  return x;
}

/* The deck's edge arrows (#edgePrev / #edgeNext) float over the wall, outside this frame. The frame is
   same-origin, so their boxes are read from the deck and put into this pane's plot coordinates. */
function deckControls(area) {
  try {
    const fe = window.frameElement;
    if (!fe) return [];
    const doc = fe.ownerDocument, f = fe.getBoundingClientRect(), a = area.getBoundingClientRect(), out = [];
    for (const id of ["edgePrev", "edgeNext", "tfNow"]) {
      const b = doc.getElementById(id);
      if (!b || !b.offsetWidth) continue;
      const r = b.getBoundingClientRect();
      out.push({ x: r.left - f.left - a.left, y: r.top - f.top - a.top, w: r.width, h: r.height });
    }
    return out;
  } catch (_) { return []; }
}
