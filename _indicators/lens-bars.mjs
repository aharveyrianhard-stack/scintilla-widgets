/* THE CONTEXT LENS, ROUND 3 — A CORNER BUBBLE OF INTRADAY BARS.
   Alan, 25 Sep: on the 3-day LINE pages, a small corner bubble that shows the same name's
   intraday picture as BARS (candles) — "the bar chart at zoom" — so a glance at the 3-day line
   also shows what today and this week look like up close. No tape.

   One file, imported by the workshop page and by tests/context-lens-bars.test.mjs, so the
   geometry the page draws is the geometry the tests check. WHERE the bubble goes is not decided
   here: that is the reviewed 23 Sep rule, /_indicators/lens-placement.mjs since 27 Sep
   (never cover the price line, 8 px clear of it, the emptiest allowed corner, a busy corner refused,
   the newest fifth of the line protected). This file only shapes the box that rule is asked to place,
   and draws what goes inside it. */

import { place, clearsPrice, clearsTail, clearsTailPoints, inkShare, pathPoints, DEFAULTS as PLACE_DEFAULTS }
  from "./lens-placement.mjs";

export const ET = "America/New_York";

/* ---- DIALS. Every value is a baseline Alan can move; the recommended ones are here. ---- */
export const DIALS = Object.freeze({
  size: "M",            // of the plot the pane drew — see BUBBLE_SIZES
  timeframe: "30m",     // 15m | 30m | 1h
  sessions: 3,          // sessions shown, newest last
  hours: "regular",     // regular 09:30–16:00 ET | extended 04:00–20:00 ET
  prefer: "auto",       // corner rule: auto = the 23 Sep rule follows the trend; or a fixed corner
  opacity: 0.96,
  volume: false,        // a volume strip under the candles
  colour: "bar",        // bar = each candle by its own close vs open; day = the whole bubble by the day
  refreshMin: 10,       // how often a live bubble re-reads its bars (a completed bar cannot change)
  margin: PLACE_DEFAULTS.margin,   // 8 px clear of the price line
  maxInk: PLACE_DEFAULTS.maxInk,   // a corner more than 55% painted on is refused
});

/* Bubble boxes are WIDER than the 23 Sep lens: candles want width more than height. Fractions of the
   plot the pane actually drew, with an absolute floor under which a candle is not a candle.
   27 Sep (CL4), Alan: "it could be smaller… they could still be quite a bit smaller." Every size,
   the floor and the ceiling are 60% of the 26 Sep review's (M was 0.42 × 0.46, floor 132 × 84,
   ceiling 340 × 210). On an 8-up pane that is 93 × 68 px, about 5% of the pane. */
export const SHRINK = 0.6;
export const BUBBLE_SIZES = Object.freeze({
  L: Object.freeze({ w: 0.288, h: 0.312 }),
  M: Object.freeze({ w: 0.252, h: 0.276 }),
  S: Object.freeze({ w: 0.216, h: 0.24 }),
});
export const SIZE_LADDER = ["L", "M", "S"];
export const FLOOR = Object.freeze({ w: 79, h: 50 });
/* and a ceiling: on a 2-up pane (840 × 554) the fraction alone would give a 210-pixel bubble, a poster
   rather than a glance. */
export const CEILING = Object.freeze({ w: 204, h: 126 });
/* Text is never under 8 px (Alan's floor). Under 120 px wide a day label is its weekday alone. */
export const MIN_FONT = 8;
export const WEEKDAY_ONLY_BELOW = 120;
/* the chamfer: the corner facing the price line cut at 45°, 8 px (it was 14 on the bigger box) */
export const CHAMFER = 8;
/* height at most this share of the width: candles want width more than height */
export const MAX_ASPECT = 0.8;

export const TIMEFRAMES = Object.freeze({
  "15m": Object.freeze({ tf: "15", minutes: 15, regular: 26, extended: 64 }),
  "30m": Object.freeze({ tf: "30", minutes: 30, regular: 13, extended: 32 }),
  "1h":  Object.freeze({ tf: "60", minutes: 60, regular: 7,  extended: 16 }),
  /* 27 Sep (O1), Alan: 30-minute is too short on the 3-day charts, use 4h. The provider's 4h bars start
     at 04:00, 08:00, 12:00 and 16:00 ET, so only the 12:00 bar starts inside 09:30-16:00: a 4h lens
     reads the whole 04:00-20:00 day (four bars a session) or it would be one candle a day. */
  "4h":  Object.freeze({ tf: "240", minutes: 240, regular: 1, extended: 4, hours: "extended" }),
});
export const HOURS = Object.freeze({
  regular:  Object.freeze({ open: 9 * 60 + 30, close: 16 * 60, name: "09:30–16:00 ET" }),
  extended: Object.freeze({ open: 4 * 60,      close: 20 * 60, name: "04:00–20:00 ET" }),
});

/* ---- TIME. Every bar is stamped in New York, because a session is a New York thing. ---- */
const FMT = new Intl.DateTimeFormat("en-US", { timeZone: ET, hour12: false, weekday: "short",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const etCache = new Map();
export function etParts(ms) {
  const hit = etCache.get(ms);
  if (hit) return hit;
  const x = {};
  for (const p of FMT.formatToParts(new Date(ms))) x[p.type] = p.value;
  const out = { day: `${x.year}-${x.month}-${x.day}`, weekday: x.weekday.toUpperCase(),
                minutes: (+x.hour % 24) * 60 + (+x.minute), hm: `${(+x.hour % 24).toString().padStart(2, "0")}:${x.minute}`,
                dom: +x.day };
  if (etCache.size > 8000) etCache.clear();
  etCache.set(ms, out);
  return out;
}

/* Provider candles ({t,o,h,l,c,v}, t = the bar's START in ms) grouped into New York sessions, keeping
   only the bars that START inside the chosen hours. The bars come back ascending inside each session. */
export function sessionsOf(bars, hours = "regular") {
  const win = HOURS[hours] || HOURS.regular;
  const out = [];
  let cur = null;
  const list = (Array.isArray(bars) ? bars : []).slice().sort((a, b) => a.t - b.t);
  for (const b of list) {
    if (!b || !Number.isFinite(b.t) || !(b.c > 0) || !(b.o > 0)) continue;
    const et = etParts(b.t);
    if (et.minutes < win.open || et.minutes >= win.close) continue;
    if (!cur || cur.day !== et.day) { cur = { day: et.day, weekday: et.weekday, dom: et.dom, bars: [] }; out.push(cur); }
    cur.bars.push(b);
  }
  return out;
}
export function lastSessions(bars, n, hours) {
  const all = sessionsOf(bars, hours);
  return all.slice(Math.max(0, all.length - Math.max(1, n | 0)));
}
export function flatten(sessions) {
  const out = [];
  sessions.forEach((s, k) => s.bars.forEach((b) => out.push({ ...b, session: k })));
  return out;
}

/* How many bars to ask the chart API for. Extended-hours bars are on the same series, so the request
   has to cover them even when only the regular session is drawn. One spare session for a holiday or a
   half day; never more than 240, because above 400 the API's newest bar moves (RSI-fan lane, 25 Sep). */
export function barsToRequest(timeframe, sessions) {
  const tf = TIMEFRAMES[timeframe] || TIMEFRAMES["30m"];
  return Math.min(240, tf.extended * (Math.max(1, sessions | 0) + 1));
}

/* The gap: each session's first bar against the previous session's last close, for the sessions shown.
   `largest` is the one worth a word — the newest is not always the one that matters (BE gapped 7% down on
   the Thursday and 1% up on the Friday). */
export function gapsOf(sessions) {
  const out = [];
  for (let i = 1; i < (sessions || []).length; i++) {
    const prev = sessions[i - 1], cur = sessions[i];
    if (!prev.bars.length || !cur.bars.length) continue;
    const from = prev.bars[prev.bars.length - 1].c, to = cur.bars[0].o;
    out.push({ pct: (to / from - 1) * 100, from, to, day: cur.day, weekday: cur.weekday });
  }
  return out;
}
export function gapOf(sessions) {
  const all = gapsOf(sessions);
  if (!all.length) return null;
  return all.reduce((best, g) => (Math.abs(g.pct) > Math.abs(best.pct) ? g : best), all[0]);
}

/* Daily up or down — the wall's one colour rule, "daily up green, daily down red" — read from the
   completed daily bars: the newest close against the one before it. Unknown stays unknown. */
export function dayDirection(daily) {
  if (!Array.isArray(daily) || daily.length < 2) return null;
  const a = daily[daily.length - 2], b = daily[daily.length - 1];
  if (!(a && a.c > 0 && b && b.c > 0)) return null;
  return b.c >= a.c ? "up" : "down";
}

export const PALETTE = Object.freeze({ bull: "#00FFA3", bear: "#FF2D55", ink: "#9A9AB6", dim: "#868AAA",
  paper: "#0B0B12", frame: "#55555c" });
export function barColour(bar, mode, day, palette = PALETTE) {
  if (mode === "day") return day === "down" ? palette.bear : palette.bull;   // unknown day: not grey — see the note in the page
  return bar.c >= bar.o ? palette.bull : palette.bear;
}

/* ---- THE BOX INSIDE THE BOX. A head line (name · timeframe · sessions), the candles, an optional
   volume strip, and a tiny time axis. Pixels, not fractions: the head and the axis are text. ---- */
export function layout(rect, opt = {}) {
  /* the Station (27 Sep, O1) asks for no day labels (axis:false) and a head that carries only the
     timeframe (compact:true): the pane's badge already names the ticker */
  const head = opt.compact ? 11 : rect.h >= 96 ? 15 : 13, axis = opt.axis === false ? 0 : 12;
  const tag = rect.w >= 150 ? 40 : rect.w >= 120 ? 34 : 0;     // the last-price tag's gutter on the right
  const inner = { x: rect.x + 4, y: rect.y + head, w: rect.w - 8 - tag, h: rect.h - head - axis - 3 };
  const vol = opt.volume && inner.h >= 60 ? Math.round(inner.h * 0.22) : 0;
  return {
    head: { x: rect.x, y: rect.y, w: rect.w, h: head },
    plot: { x: inner.x, y: inner.y + 3, w: Math.max(10, inner.w), h: Math.max(10, inner.h - vol - 3 - (vol ? 3 : 0)) },
    vol: vol ? { x: inner.x, y: inner.y + inner.h - vol, w: Math.max(10, inner.w), h: vol } : null,
    axis: axis ? { x: inner.x, y: rect.y + rect.h - axis, w: Math.max(10, inner.w), h: axis } : null,
    tag: tag ? { x: rect.x + rect.w - tag - 4, w: tag } : null,
  };
}

/* Candle geometry: every bar gets one slot; the body is 62% of the slot, never under 1 px; a session
   boundary costs half a slot of air so the eye sees where a day ends without a line being drawn. */
export function candleGeometry(bars, box, opt = {}) {
  const n = bars.length;
  if (!n) return { candles: [], lo: null, hi: null, slot: 0, breaks: [] };
  let lo = Infinity, hi = -Infinity;
  for (const b of bars) { if (b.l < lo) lo = b.l; if (b.h > hi) hi = b.h; }
  if (!(hi > lo)) { hi = lo + 1; lo -= 1; }
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const breaks = [];
  for (let i = 1; i < n; i++) if (bars[i].session !== bars[i - 1].session) breaks.push(i);
  const slots = n + breaks.length * 0.5;
  const slot = box.w / slots;
  const body = Math.max(1, Math.min(opt.maxBody || 9, slot * 0.62));
  const y = (v) => box.y + (1 - (v - lo) / (hi - lo)) * box.h;
  const candles = [];
  let k = 0, offset = 0;
  for (let i = 0; i < n; i++) {
    if (breaks[k] === i) { offset += 0.5; k++; }
    const cx = box.x + (i + offset + 0.5) * slot;
    const b = bars[i];
    candles.push({ i, x: cx, w: body, yO: y(b.o), yC: y(b.c), yH: y(b.h), yL: y(b.l), up: b.c >= b.o, session: b.session });
  }
  return { candles, lo, hi, slot, breaks, y, breakXs: breaks.map((i) => candles[i].x - slot * 0.75) };
}

/* One label per session at its first bar ("THU 24"); on a single session, the hours instead. */
export function axisTicks(bars, geometry, sessions, opt = {}) {
  const out = [];
  if (!bars.length) return out;
  if (sessions.length <= 1) {
    for (let i = 0; i < bars.length; i++) {
      const et = etParts(bars[i].t);
      if (et.minutes % 60 === 0 && (et.minutes / 60) % 2 === 0) out.push({ x: geometry.candles[i].x, label: et.hm.slice(0, 2) });
    }
    return out;
  }
  let session = -1;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].session === session) continue;
    session = bars[i].session;
    const s = sessions[session];
    out.push({ x: geometry.candles[i].x, label: opt.weekdayOnly ? s.weekday : `${s.weekday} ${s.dom}` });
  }
  return out;
}

export function lastPrice(bars) {
  if (!bars.length) return null;
  const b = bars[bars.length - 1];
  return { price: b.c, up: b.c >= b.o, t: b.t };
}

/* ---- PLACEMENT: the 23 Sep rule, asked for a bubble-shaped box. The rule's own size steps are
   lens-shaped; here each step of OUR ladder is put to the rule as a single-size question (its "S"
   fraction is under our floor, so the floor wins) and the first step that fits is taken. Shrink first,
   shelf last, exactly as before. ---- */
export function bubbleBox(plot, sizeKey) {
  const f = BUBBLE_SIZES[sizeKey] || BUBBLE_SIZES.M;
  const w = Math.min(CEILING.w, Math.max(FLOOR.w, Math.round(plot.iw * f.w)));
  /* never taller than 0.8 of its width: on a tall phone pane the fraction alone made an 86 × 126 post */
  const h = Math.min(CEILING.h, Math.round(w * MAX_ASPECT), Math.max(FLOOR.h, Math.round(plot.ih * f.h)));
  return { w, h };
}
const overlaps = (a, b, pad = 0) => !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);
/* A corner that sits on the badge is not lost: the bubble TUCKS past it - down from a top corner, up from
   a bottom one - and the moved box is put to the same tests as any other (inside the plot, clear of the
   price, clear of the newest fifth, not too painted on). */
function tuck(c, keepOut, opts, pts, margin) {
  const plot = opts.plot, edge = opts.edge == null ? PLACE_DEFAULTS.edge : opts.edge;
  const maxInk = opts.maxInk == null ? PLACE_DEFAULTS.maxInk : opts.maxInk;
  const rect = { x: c.x, y: c.y, w: c.w, h: c.h, corner: c.corner };
  for (const k of keepOut) {
    if (!overlaps(rect, k, margin)) continue;
    rect.y = c.corner.startsWith("t") ? k.y + k.h + margin : k.y - margin - rect.h;
  }
  if (rect.y < plot.padT + edge || rect.y + rect.h > plot.padT + plot.ih - edge) return null;
  if (keepOut.some((k) => overlaps(rect, k, margin))) return null;
  if (!clearsPrice(rect, pts, margin)) return null;
  if (!clearsTail(rect, plot) && !clearsTailPoints(rect, pts, plot, margin)) return null;
  const share = opts.ink ? inkShare(rect, opts.ink, opts.step || 3) : 0;
  if (share > maxInk) return null;
  return { ...c, x: rect.x, y: rect.y, ink: share, clear: true, refused: null, tucked: true };
}
export function placeBubble(opts) {
  const wanted = opts.size || DIALS.size;
  const ladder = SIZE_LADDER.slice(Math.max(0, SIZE_LADDER.indexOf(wanted)));
  /* keep-out boxes: the pane's badge (ticker, price, change) is DOM the canvas cannot see, and it is the
     most-read ink on the pane. A candidate that would sit on one is refused, like one that sits on price,
     and then offered the tuck. */
  const keepOut = Array.isArray(opts.keepOut) ? opts.keepOut.filter((r) => r && r.w > 0 && r.h > 0) : [];
  const margin = opts.margin == null ? PLACE_DEFAULTS.margin : opts.margin;
  const clearOfKeepOut = (r) => !keepOut.some((k) => overlaps(r, k, margin));
  const pts = opts.points || pathPoints(opts.plot, opts.series || []);
  let last = null;
  for (const sizeKey of ladder) {
    const box = bubbleBox(opts.plot, sizeKey);
    /* boxW/boxH: the box is exactly this size. Until 27 Sep the rule's own "S" fraction (0.24 × 0.36)
       was a second floor and made a small bubble taller than it was asked to be. */
    const res = place({ ...opts, points: pts, size: "S", minW: box.w, minH: box.h, boxW: box.w, boxH: box.h,
                        prefer: opts.prefer && opts.prefer !== "auto" ? opts.prefer : null });
    let considered = (res.considered || []).map((c) => ({ ...c, size: sizeKey }));
    /* the badge: refuse, then try the tuck on each refused corner */
    considered = considered.map((c) => {
      if (!c.clear || clearOfKeepOut(c)) return c;
      const t = tuck(c, keepOut, opts, pts, margin);
      return t ? t : { ...c, clear: false, refused: "would cover the badge" };
    });
    last = { ...res, size: sizeKey, shrunk: sizeKey !== wanted, box, considered };
    if (res.kind !== "inset" || !res.spot) continue;
    const pick = considered.find((c) => c.corner === res.spot.corner);
    if (pick && pick.clear) {
      const spot = pick.tucked ? pick : res.spot;
      return { ...last, spot, tucked: !!pick.tucked, why: pick.tucked ? `${res.why} - tucked under the badge` : res.why };
    }
    /* the rule's pick sits on the badge and cannot tuck: the emptiest corner still open at this size */
    const open = considered.filter((c) => c.clear);
    if (open.length) {
      open.sort((a, b) => a.ink - b.ink);
      return { ...last, spot: open[0], tucked: !!open[0].tucked,
               why: `${open[0].corner} - the rule's first choice sat on the badge; this is the emptiest corner left${open[0].tucked ? ", tucked under it" : ""}` };
    }
  }
  return { ...(last || { size: ladder[ladder.length - 1], considered: [] }), kind: "shelf", spot: null, shrunk: true,
           why: "nothing clears the price line, its newest fifth and the badge, so the lens parks below the chart" };
}

/* ---- THE COST OF A BUILD, in requests. One intraday read per 3-day pane when the page mounts;
   the deck's pages come from deck/scenes.js, so the tests can hold this to the real lap. ---- */
export function lapRequests(pages, panesOf, opts = {}) {
  let panes = 0, pagesWithBubble = 0;
  for (const p of pages) {
    if (!p || p.range !== "3D") continue;
    pagesWithBubble++;
    panes += panesOf(p);
  }
  const refreshPerLap = opts.lapMinutes && opts.refreshMin ? Math.floor(opts.lapMinutes / opts.refreshMin) : 0;
  return { pagesWithBubble, panes, requests: panes, refreshPerLap };
}

/* ---- DRAWING. Canvas 2D, in CSS pixels; the caller sets the transform for the device ratio. ---- */
export function drawBubble(ctx, rect, model, opt = {}) {
  const { bars, sessions, day, timeframe, colour, volume, font } = model;
  const pal = opt.palette || PALETTE;
  /* model.symbol === null: no ticker in the head; model.axis === false: no day labels (Station, O1) */
  const compact = model.symbol == null, axis = model.axis !== false;
  const L = layout(rect, { volume, compact, axis });
  ctx.save();
  const size = Math.max(MIN_FONT, font || MIN_FONT);
  ctx.font = `${size}px "SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace`;
  ctx.textBaseline = "middle";
  /* head: name · timeframe · sessions, in the day's colour for the name */
  const dayColour = day === "down" ? pal.bear : day === "up" ? pal.bull : pal.ink;
  ctx.fillStyle = dayColour; ctx.textAlign = "left";
  if (!compact) ctx.fillText(model.symbol, L.head.x + 6, L.head.y + L.head.h / 2 + 0.5);
  ctx.fillStyle = pal.ink; ctx.globalAlpha = 0.85;
  const sub = `${timeframe} · ${sessions.length} ${sessions.length === 1 ? "SESSION" : "SESSIONS"}`;
  ctx.textAlign = compact ? "left" : "right";
  const hx = compact ? L.head.x + 6 : L.head.x + L.head.w - 6;
  if (timeframe) ctx.fillText(rect.w >= 150 && !compact ? sub : timeframe, hx, L.head.y + L.head.h / 2 + 0.5);
  ctx.globalAlpha = 1;
  if (!bars.length) {
    ctx.fillStyle = pal.ink; ctx.textAlign = "center";
    ctx.fillText("no intraday bars", rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore(); return L;
  }
  const g = candleGeometry(bars, L.plot);
  /* volume, under the candles, in each bar's colour at a quarter strength: not a grey line */
  if (L.vol) {
    let vmax = 0; for (const b of bars) if (b.v > vmax) vmax = b.v;
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < bars.length; i++) {
      const c = g.candles[i], h = vmax ? (bars[i].v / vmax) * L.vol.h : 0;
      ctx.fillStyle = barColour(bars[i], colour, day, pal);
      ctx.fillRect(c.x - c.w / 2, L.vol.y + L.vol.h - h, Math.max(1, c.w), h);
    }
    ctx.globalAlpha = 1;
  }
  /* candles: wick then body, one colour per bar */
  for (let i = 0; i < bars.length; i++) {
    const c = g.candles[i];
    const col = barColour(bars[i], colour, day, pal);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
    const wx = Math.round(c.x) + 0.5;
    ctx.beginPath(); ctx.moveTo(wx, c.yH); ctx.lineTo(wx, c.yL); ctx.stroke();
    const top = Math.min(c.yO, c.yC), hh = Math.max(1, Math.abs(c.yC - c.yO));
    if (c.w >= 2.5) {
      /* an up candle is hollow so the two directions read apart even at four pixels wide */
      if (c.up) { ctx.fillStyle = pal.paper; ctx.fillRect(c.x - c.w / 2, top, c.w, hh); ctx.strokeRect(Math.round(c.x - c.w / 2) + 0.5, Math.round(top) + 0.5, Math.round(c.w) - 1, Math.max(1, Math.round(hh) - 1)); }
      else ctx.fillRect(c.x - c.w / 2, top, c.w, hh);
    } else ctx.fillRect(c.x - c.w / 2, top, Math.max(1, c.w), hh);
  }
  /* the last price: a tag at its own height, in the last bar's colour */
  const lp = lastPrice(bars);
  if (lp && L.tag) {
    const y = g.y(lp.price);
    const col = barColour(bars[bars.length - 1], colour, day, pal);
    ctx.fillStyle = col; ctx.textAlign = "right";
    ctx.fillText(fmtPrice(lp.price), L.tag.x + L.tag.w, Math.max(L.plot.y + 5, Math.min(L.plot.y + L.plot.h - 5, y)));
    ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(g.candles[g.candles.length - 1].x + 3, Math.round(y) + 0.5); ctx.lineTo(L.tag.x - 2, Math.round(y) + 0.5); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  /* the tiny time axis: one label per session */
  if (!L.axis) { ctx.restore(); return L; }
  ctx.fillStyle = pal.ink; ctx.globalAlpha = 0.8; ctx.textAlign = "left";
  ctx.font = `${Math.max(MIN_FONT, size - 1)}px "SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace`;
  let lastRight = -Infinity;
  for (const t of axisTicks(bars, g, sessions, { weekdayOnly: rect.w < WEEKDAY_ONLY_BELOW })) {
    const w = ctx.measureText(t.label).width;
    if (t.x < lastRight + 6) continue;
    ctx.fillText(t.label, t.x - 2, L.axis.y + L.axis.h / 2);
    lastRight = t.x - 2 + w;
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  return L;
}

/* 27 Sep (O1), Alan: "commas in numbers" - 1,085 not 1085. */
const PRICE_FMT = [0, 1, 2].map((d) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
export function fmtPrice(v) {
  if (!Number.isFinite(v)) return "—";
  return PRICE_FMT[v >= 1000 ? 0 : v >= 100 ? 1 : 2].format(v);
}
