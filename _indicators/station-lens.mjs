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
import { lastSessions, flatten, barsToRequest, drawBubble, bubbleBox, placeBubble, layout,
  CHAMFER, DIALS, TIMEFRAMES, HOURS, etParts, FLOOR } from "./lens-bars.mjs";
import { pathPoints, clearsTail, clearsTailPoints, emptiestSpot, inkReader, DEFAULTS as PLACE } from "./lens-placement.mjs";

/* O1 (27 Sep), Alan: "30-minute is too short for 3-day charts -> use 4h; on DAILY charts use the
   30-minute lens. Weekly macro pages: no lens." The deck says which lens a page carries (4h:12 on the
   3-day pages, 30m:3 on the daily ones); the pane draws one only on those two ranges. */
export const RANGE = "3D";
export const RANGES = Object.freeze(["3D", "1D"]);
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
  const m = /^(15m|30m|1h|4h):([1-9]|1[0-5])$/.exec(String(value || "").trim());
  return m ? { timeframe: m[1], sessions: +m[2], key: m[0] } : null;
}
export const wanted = (req, range) => !!req && RANGES.includes(range);
/* Futures and crypto keep their own clock (27 Sep night): the whole CME session, or the whole day. */
const FUTURES = new Set(["ESUSD", "NQUSD", "CLUSD", "GCUSD", "SIUSD", "DXUSD"]);
const CRYPTO = new Set(["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD", "DOGEUSD", "ADAUSD", "AVAXUSD", "LINKUSD", "LTCUSD"]);
export const hoursOf = (tf, t) => FUTURES.has(String(t || "").toUpperCase()) ? "globex"
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

/* ---- where ---- */
const overlaps = (a, b, pad = 0) => !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);
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
  const want = parseBubble(deps.request());
  if (!want || !wanted(want, deps.range()) || !host || !host.isConnected) return;
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
  if (why) host.dataset.lensWhy = why; else delete host.dataset.lensWhy;
  delete host.dataset.lensState;
}

/* Called after every chart paint. Cheap when nothing changed: a hover or a scrub repaints the chart
   but not the bubble. */
export function paint(host, deps) {
  const want = parseBubble(deps.request());
  if (!want || !wanted(want, deps.range())) return hide(host, null);
  const plot = host._plot, pts = host._series, t = host.dataset.t;
  if (!plot || !pts || pts.length < 2) return hide(host, "the chart has not drawn yet");
  const entry = cache.get(t + "|" + want.timeframe);
  if (!entry) return hide(host, `${want.timeframe} bars not read yet`);
  if (entry.absence) return hide(host, `no ${want.timeframe} bars: ${entry.absence}`);
  const sessions = lastSessions(entry.bars, want.sessions, hoursOf(want.timeframe, t));
  const bars = flatten(sessions);
  if (!bars.length) return hide(host, `no ${want.timeframe} bars in ${hoursOf(want.timeframe, t)} hours`);
  /* rule 6: the view is moving (a wheel, a drag, a pinch) - a lens already on screen holds still, and one
     placement is made once the view has been still for SETTLE_MS */
  const since = host._viewMovedAt ? performance.now() - host._viewMovedAt : Infinity;
  if (since < SETTLE_MS && host._lens && host._lens.spot && host._lens.t === t && host._lens.key === want.key) {
    if (!host._lensSettle) host._lensSettle = setTimeout(() => { host._lensSettle = null; if (host.isConnected) deps.redraw(host); }, SETTLE_MS - since + 20);
    return;
  }
  const fresh = freshness(sessions, Date.now(), deps.settled, { hours: hoursOf(want.timeframe, t), minutes: TIMEFRAMES[want.timeframe].minutes });
  const day = deps.day(host);
  const area = host.querySelector(".sc-nchart__area");
  const badge = host.querySelector(".sc-nchart__live");
  const controls = deckControls(area);
  const chip = host._geigerSpot && host.querySelector(".sc-nchart__live-geiger:not([hidden])") ? host._geigerSpot : null;
  const sig = [controls.map((c) => [c.x, c.y, c.w, c.h].map(Math.round).join(",")).join(";"), area.clientWidth, area.clientHeight, plot.padL, plot.padT, plot.iw, plot.ih, plot.start, plot.end,
    pts.length, pts[pts.length - 1].d, entry.ts, fresh.stale, day, badge ? badge.offsetHeight + "x" + badge.offsetWidth : "",
    chip ? [chip.x, chip.y, chip.w, chip.h].map(Math.round).join(",") : "",
    /* the ribbon arriving after the lens repaints the ink it must avoid: place again */
    (host._cloudTicker || "") + ":" + ((host._cloudRows && host._cloudRows.length) || 0)].join("|");
  if (host._lensMemo === sig) return;
  host._lensMemo = sig;

  const keepOut = [];
  if (badge && badge.offsetWidth) {
    const a = area.getBoundingClientRect(), b = badge.getBoundingClientRect();
    keepOut.push({ x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height });
  }
  if (chip) keepOut.push(chip);
  const main = host.querySelector(".sc-nchart__cv");
  /* one read of the chart's pixels per paint, shared with the Geiger chip (host._inkAt, reset by the chart) */
  const inkAt = host._inkAt || (main ? (host._inkAt = inkReader(main)) : null);
  const prev = host._lens && host._lens.spot && host._lens.t === t && host._lens.key === want.key ? host._lens.spot : null;
  const where = placeLens({ plot, series: pts, keepOut, slidePast: controls, ink: inkAt, prev });
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
  cv.setAttribute("aria-label", `${t}: ${want.timeframe} candles, last ${sessions.length} sessions${through}` +
    (fresh.stale ? ` — STALE: the last session that has opened is ${fresh.expected}` : ""));
  host.dataset.lensState = fresh.stale ? "stale" : "fresh";
  host.dataset.lensWhy = where.why;
  const mark = paintMark(host, plot, pts, bars[0].t);
  host._lens = { t, key: want.key, spot: r, why: where.why, fallback: where.fallback, stale: fresh.stale, through: fresh.through,
                 expected: fresh.expected, bars: bars.length, sessions: sessions.length, readAt: entry.ts, markX: mark };
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
