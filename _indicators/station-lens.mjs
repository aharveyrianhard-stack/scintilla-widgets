/* SCINTILLA · STATION — THE CONTEXT LENS ON THE LIVE CHART PANE (CL4, 27 Sep 2026).
   ============================================================================
   Alan, 26–27 Sep: the last three trading days of 30-minute candles, in a small square, only on the
   3-day charts — "I like this one at the bottom left" — and "they could still be quite a bit smaller".

   WHAT IT IS: a second canvas, bottom-left of the plot, drawing the same name's 30-minute candles for
   its last three regular sessions (09:30–16:00 ET). The geometry and the drawing are the reviewed
   26 Sep bubble (/_indicators/lens-bars.mjs) at 60% of its size; nothing here re-derives them.
   WHEN: only when the pane's URL carries ?bubble=30m:3 (the deck adds it on the nine 3-day pages) AND
   the pane is showing the 3D range. Without the switch the chart never even loads this file.
   WHERE (the coordinator's ruling, on Alan's preference): FIXED bottom-left. It may cover the OLDEST
   stretch of the 3-day line (the far past); it never covers the newest fifth of the line, and never
   the pane's badge. If bottom-left would break either, the bubble takes the emptiest corner the
   23 Sep rule allows, and the pane records why (data-lens-why, and the console).
   THE COST: one candle read per chart, re-read at most every ten minutes (a finished 30-minute bar
   cannot change), under the chart's own load permit so it never delays a price.
   STALE MUST LOOK STALE: if the newest bar belongs to a session older than the last one that has
   opened, the bubble is drawn dimmed and its head says STALE.
   ============================================================================ */
import { lastSessions, flatten, barsToRequest, drawBubble, bubbleBox, placeBubble, layout,
  CHAMFER, DIALS, TIMEFRAMES, etParts } from "./lens-bars.mjs";
import { pathPoints, clearsTail, clearsTailPoints, DEFAULTS as PLACE } from "./lens-placement.mjs";

export const RANGE = "3D";
export const REFRESH_MS = DIALS.refreshMin * 60000;
/* Its own colours. Candles follow the wall's rule (up green, down red: the chart's own --bull/--bear);
   everything else is a true grey (channels within 24 of each other, none above 210) and nothing white. */
export const INK = Object.freeze({ paper: "#0B0B0F", frame: "#4A4A50", ink: "#9C9CA4", dim: "#6E6E74" });
export const STALE_ALPHA = 0.42;

/* ---- the switch ---- */
/* "30m:3" → { timeframe:"30m", sessions:3 }. Anything else is off: a switch that cannot be read is
   not quietly turned into some other bubble. */
export function parseBubble(value) {
  const m = /^(15m|30m|1h):([1-5])$/.exec(String(value || "").trim());
  return m ? { timeframe: m[1], sessions: +m[2], key: m[0] } : null;
}
export const wanted = (req, range) => !!req && range === RANGE;

/* ---- stale or not ---- */
/* The New York date of the newest session that has OPENED by `nowMs`: today once 09:30 ET has passed
   on a trading day, otherwise the trading day before. `settled` is the provider's own calendar
   (SC_PROVIDER.expectedSettledSession: NYSE holidays included); a day is a trading day exactly when
   the calendar would call it settled at 21:00 that evening. */
export function lastOpenedSession(nowMs, settled) {
  const now = etParts(nowMs);
  const cal = typeof settled === "function" ? settled : weekdayCalendar;
  const todayIsSession = cal(eveningOf(now.day)) === now.day;
  if (todayIsSession && now.minutes >= 9 * 60 + 30) return now.day;
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
export function freshness(sessions, nowMs, settled) {
  const newest = sessions && sessions.length ? sessions[sessions.length - 1] : null;
  const expected = lastOpenedSession(nowMs, settled);
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
export function placeLens({ plot, series, points, keepOut = [], slidePast = [], ink, size = DIALS.size }) {
  const box = bubbleBox(plot, size);
  const pts = points || pathPoints(plot, series || []);
  const bl = bottomLeft(plot, box, pts, keepOut, { slidePast });
  if (bl.spot) return { kind: "inset", spot: bl.spot, fixed: true, fallback: false, why: bl.why, box };
  /* the fallback: the reviewed rule at the SAME size, emptiest clear corner */
  const res = placeBubble({ plot, points: pts, keepOut, ink, size: "S", prefer: "auto" });
  const why = `${bl.why}; ${res.spot ? `${res.spot.corner} instead — ${res.why}` : "no corner is clear, so no bubble"}`;
  return { kind: res.spot ? "inset" : "none", spot: res.spot ? { ...res.spot, w: box.w, h: box.h } : null,
           fixed: false, fallback: true, why, box };
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
      const rows = await deps.fetchCandles(t, tf, barsToRequest(want.timeframe, want.sessions), 1);
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
  if (!entry) return hide(host, "30-minute bars not read yet");
  if (entry.absence) return hide(host, `no ${want.timeframe} bars: ${entry.absence}`);
  const sessions = lastSessions(entry.bars, want.sessions, DIALS.hours);
  const bars = flatten(sessions);
  if (!bars.length) return hide(host, `no ${want.timeframe} bars in regular hours`);
  const fresh = freshness(sessions, Date.now(), deps.settled);
  const day = deps.day(host);
  const area = host.querySelector(".sc-nchart__area");
  const badge = host.querySelector(".sc-nchart__live");
  const controls = deckControls(area);
  const sig = [controls.map((c) => [c.x, c.y, c.w, c.h].map(Math.round).join(",")).join(";"), area.clientWidth, area.clientHeight, plot.padL, plot.padT, plot.iw, plot.ih, plot.start, plot.end,
    pts.length, pts[pts.length - 1].d, entry.ts, fresh.stale, day, badge ? badge.offsetHeight + "x" + badge.offsetWidth : ""].join("|");
  if (host._lensMemo === sig) return;
  host._lensMemo = sig;

  const keepOut = [];
  if (badge && badge.offsetWidth) {
    const a = area.getBoundingClientRect(), b = badge.getBoundingClientRect();
    keepOut.push({ x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height });
  }
  const main = host.querySelector(".sc-nchart__cv");
  const inkAt = main ? inkReader(main) : null;
  const where = placeLens({ plot, series: pts, keepOut, slidePast: controls, ink: inkAt });
  if (!where.spot) { hide(host, where.why); return; }
  if (where.fallback) { try { console.info("[lens]", t, where.why); } catch (_) {} }

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
  drawBubble(ctx, inner, { bars, sessions, day, symbol: t, timeframe: want.timeframe.toUpperCase(),
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
  host._lens = { spot: r, why: where.why, fallback: where.fallback, stale: fresh.stale, through: fresh.through,
                 expected: fresh.expected, bars: bars.length, sessions: sessions.length, readAt: entry.ts };
}

/* The deck's edge arrows (#edgePrev / #edgeNext) float over the wall, outside this frame. The frame is
   same-origin, so their boxes are read from the deck and put into this pane's plot coordinates. */
function deckControls(area) {
  try {
    const fe = window.frameElement;
    if (!fe) return [];
    const doc = fe.ownerDocument, f = fe.getBoundingClientRect(), a = area.getBoundingClientRect(), out = [];
    for (const id of ["edgePrev", "edgeNext"]) {
      const b = doc.getElementById(id);
      if (!b || !b.offsetWidth) continue;
      const r = b.getBoundingClientRect();
      out.push({ x: r.left - f.left - a.left, y: r.top - f.top - a.top, w: r.width, h: r.height });
    }
    return out;
  } catch (_) { return []; }
}

/* "anything the chart painted", read from its own canvas — only asked for when bottom-left is refused */
function inkReader(canvas) {
  let data = null, W = 0, H = 0, ratio = 1;
  return (x, y) => {
    if (!data) {
      try {
        const c = canvas.getContext("2d"); W = canvas.width; H = canvas.height;
        ratio = W / Math.max(1, canvas.clientWidth);
        data = c.getImageData(0, 0, W, H).data;
      } catch (_) { data = new Uint8ClampedArray(0); }
    }
    const px = Math.round(x * ratio), py = Math.round(y * ratio);
    if (px < 0 || py < 0 || px >= W || py >= H) return false;
    return data[(py * W + px) * 4 + 3] > 40;
  };
}
