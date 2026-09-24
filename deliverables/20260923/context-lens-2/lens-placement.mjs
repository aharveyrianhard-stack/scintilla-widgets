/* THE CONTEXT LENS PLACEMENT RULE.
   One file, imported by the workshop page and by tests/context-lens-placement.test.mjs,
   so the rule the page draws is the rule the tests check.

   The rule in one sentence: never cover the price line, keep a stated margin clear of
   it, and among the corners that pass take the one with the least ink already drawn --
   ink meaning anything the Station chart painted, the cloud ribbon and its names
   included. A tie goes to the preferred corner. If no corner passes at the chosen
   size, the lens shrinks; if it still does not fit, it parks on the shelf below the
   chart rather than sitting on top of price. */

export const CORNERS = ["tr", "tl", "br", "bl", "tc", "bc"];
export const SIZE_STEPS = ["L", "M", "S"];

/* Fractions of the drawn plot, not fixed pixels: a Station pane is a wide short
   band, not the tall stage the v4 review drew on, so a 360x232 box would swallow it. */
export const SIZES = { L: [0.36, 0.52], M: [0.30, 0.44], S: [0.24, 0.36] };

export const DEFAULTS = Object.freeze({
  size: "M",
  prefer: "tr",
  margin: 8,          // clear pixels demanded between the lens and the price line
  edge: 6,            // clear pixels between the lens and the edge of the plot
  view: "context",
  opacity: 0.96,
  maxInk: 0.55,      // a corner more painted on than this is too busy to sit in
  minW: 116,
  minH: 74,
});

/* The x/y of every visible bar, in pane pixels, from the geometry the chart itself
   recorded when it painted (host._plot). This reads the chart's numbers; it does not
   re-derive them. */
export function pathPoints(plot, series) {
  const { padL, padT, iw, ih, start, end, rightBars, yLo, yHi } = plot;
  const span = Math.max(1, end - start + (rightBars || 0));
  const out = [];
  for (let i = start; i <= end && i < series.length; i++) {
    const p = series[i] && series[i].p;
    if (!isFinite(p)) continue;
    out.push({
      x: padL + ((i - start) / span) * iw,
      y: padT + (1 - (p - yLo) / (yHi - yLo)) * ih,
    });
  }
  return out;
}

export function candidateRects(plot, sizeKey, opt = {}) {
  const { padL, padT, iw, ih } = plot;
  const edge = opt.edge == null ? DEFAULTS.edge : opt.edge;
  const [fw, fh] = SIZES[sizeKey] || SIZES.M;
  const w = Math.max(opt.minW || DEFAULTS.minW, Math.round(iw * fw));
  const h = Math.max(opt.minH || DEFAULTS.minH, Math.round(ih * fh));
  if (w + edge * 2 > iw || h + edge * 2 > ih) return [];
  const left = padL + edge, right = padL + iw - edge - w;
  const centre = padL + (iw - w) / 2, top = padT + edge, bottom = padT + ih - edge - h;
  const at = { tl: [left, top], tc: [centre, top], tr: [right, top],
               bl: [left, bottom], bc: [centre, bottom], br: [right, bottom] };
  return CORNERS.map((corner) => ({ corner, x: at[corner][0], y: at[corner][1], w, h }));
}

/* Does this box keep the demanded margin from every visible bar, and from the line
   drawn between them? Segment-aware: a steep line between two bars crosses boxes that
   neither endpoint sits in. */
export function clearsPrice(rect, pts, margin) {
  const box = { x: rect.x - margin, y: rect.y - margin,
                w: rect.w + margin * 2, h: rect.h + margin * 2 };
  const inside = (p) => p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
  for (let i = 0; i < pts.length; i++) {
    if (inside(pts[i])) return false;
    if (i && segmentHitsBox(pts[i - 1], pts[i], box)) return false;
  }
  return true;
}

function segmentHitsBox(a, b, box) {
  const x1 = box.x, y1 = box.y, x2 = box.x + box.w, y2 = box.y + box.h;
  if (Math.max(a.x, b.x) < x1 || Math.min(a.x, b.x) > x2) return false;
  if (Math.max(a.y, b.y) < y1 || Math.min(a.y, b.y) > y2) return false;
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) < 1e-9) return true;             // vertical inside the x band
  for (const xx of [x1, x2]) {
    const t = (xx - a.x) / dx;
    if (t >= 0 && t <= 1) { const yy = a.y + t * dy; if (yy >= y1 && yy <= y2) return true; }
  }
  if (Math.abs(dy) < 1e-9) return false;
  for (const yy of [y1, y2]) {
    const t = (yy - a.y) / dy;
    if (t >= 0 && t <= 1) { const xx = a.x + t * dx; if (xx >= x1 && xx <= x2) return true; }
  }
  return false;
}

/* How much of this box is already painted, 0 (empty) to 1 (solid).
   `ink(x, y)` answers for one pane pixel; the page reads it from the chart's canvas,
   the tests hand in a function, so the same rule is measured both times. */
export function inkShare(rect, ink, step = 3) {
  let seen = 0, lit = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += step) {
    for (let x = rect.x; x < rect.x + rect.w; x += step) {
      seen++; if (ink(x, y)) lit++;
    }
  }
  return seen ? lit / seen : 1;
}

/**
 * Choose the spot. Returns every corner it considered with its score and, when a
 * corner was refused, the reason -- that list is what the page draws faded.
 */
export function choose(opts) {
  const { plot, series, ink } = opts;
  const margin = opts.margin == null ? DEFAULTS.margin : opts.margin;
  const prefer = opts.prefer || DEFAULTS.prefer;
  const wanted = opts.size || DEFAULTS.size;
  const pts = opts.points || pathPoints(plot, series || []);
  const maxInk = opts.maxInk == null ? DEFAULTS.maxInk : opts.maxInk;
  const steps = SIZE_STEPS.slice(SIZE_STEPS.indexOf(wanted) < 0 ? 0 : SIZE_STEPS.indexOf(wanted));
  const considered = [];

  for (const sizeKey of steps) {
    const rects = candidateRects(plot, sizeKey, opts);
    const scored = rects.map((rect) => {
      const covers = !clearsPrice(rect, pts, margin);
      const share = ink ? inkShare(rect, ink, opts.step || 3) : 0;
      const busy = !covers && share > maxInk;
      return { ...rect, size: sizeKey, ink: share, clear: !covers && !busy,
               refused: covers ? "would cover price" : busy ? "too busy" : null };
    });
    considered.push(...scored);
    const open = scored.filter((r) => r.clear);
    if (!open.length) continue;
    open.sort((a, b) => (a.ink - b.ink) || (a.corner === prefer ? -1 : b.corner === prefer ? 1 : 0)
      || CORNERS.indexOf(a.corner) - CORNERS.indexOf(b.corner));
    /* A tie is "close enough to be the same picture", not an exact equality: the
       preferred corner wins whenever nothing else is meaningfully emptier. */
    const best = open[0];
    const preferred = open.find((r) => r.corner === prefer);
    const chosen = preferred && preferred.ink - best.ink <= 0.02 ? preferred : best;
    return {
      kind: "inset", spot: chosen, size: sizeKey, shrunk: sizeKey !== wanted,
      considered: considered.length ? considered : scored,
      why: chosen.corner === prefer
        ? `preferred corner, ${(chosen.ink * 100).toFixed(0)}% of it already drawn on`
        : `emptiest corner that clears price: ${(chosen.ink * 100).toFixed(0)}% drawn on`,
    };
  }
  return {
    kind: "shelf", spot: null, size: steps[steps.length - 1], shrunk: steps.length > 1,
    considered,
    why: "every corner either covers the price or is already too painted on, so the lens parks below the chart",
  };
}

/* ============================================================================
   M47 — THE LENS GETS OUT OF THE WAY.
   Alan: "if the chart is going up or down it needs to reposition itself to not
   block shit."

   Three rules on top of the one above (never cover price, take the emptiest
   corner):
     1. THE SIDE AWAY FROM THE ACTION. Where price is heading at the right edge
        is where the reader is looking: rising puts the lens LOW, falling puts it
        HIGH. That is a preference, not an override - a corner that would cover
        the line is still refused.
     2. THE TAIL IS NEVER COVERED. The last fifth of the drawn line is the newest
        price and it is the reason the chart is on the wall. No candidate may
        overlap it, at any size.
     3. IT DOES NOT JUMP WHILE IT IS BEING READ. A pointer on the lens pins it.
        Off it, the lens only moves when the new spot is meaningfully better than
        the one it is in, so a bar that changes the picture slightly does not
        start it hopping from corner to corner.
   ========================================================================== */

export const TAIL_SHARE = 0.20;     // of the drawn width, measured from the right edge
export const MOVE_MARGIN = 0.08;    // how much emptier a new corner must be before the lens moves
export const TREND_FLAT = 0.08;     // |rise/run| below this reads as sideways

/* Which way the line is going where the reader is looking. Measured over the last
   third of the drawn points, in pane pixels, normalised by the plot height so the
   answer does not change with the price scale. y grows downward, so a rising price
   is a NEGATIVE dy. */
export function recentTrend(pts, plot, share = 1 / 3) {
  if (!pts || pts.length < 3) return { dir: "flat", slope: 0, n: pts ? pts.length : 0 };
  const from = Math.max(0, Math.floor(pts.length * (1 - share)));
  const tail = pts.slice(from);
  const a = tail[0], b = tail[tail.length - 1];
  const h = plot && plot.ih ? plot.ih : 1;
  const slope = (a.y - b.y) / h;                       // + = rising
  const dir = Math.abs(slope) < TREND_FLAT ? "flat" : (slope > 0 ? "up" : "down");
  return { dir, slope, n: tail.length };
}

/* Rising price -> the lens goes low; falling -> high; sideways -> top, because the
   line is through the middle. Always the left half: the right is where the tail is. */
export function preferFor(dir) {
  return dir === "up" ? "bl" : dir === "down" ? "tl" : "tl";
}

/* The strip of plot the newest prices are drawn in. Nothing may sit in it. */
export function tailBox(plot, share = TAIL_SHARE) {
  const { padL, padT, iw, ih } = plot;
  const w = iw * share;
  return { x: padL + iw - w, y: padT, w, h: ih };
}
export function clearsTail(rect, plot, share = TAIL_SHARE) {
  const t = tailBox(plot, share);
  return rect.x + rect.w <= t.x;
}

/* The strict rule above keeps the whole newest-price COLUMN free, which is what the
   reader is looking at. On a wide short Station pane that can leave nothing at all -
   and parking on the shelf costs more than sitting in an empty upper right. So there
   is a middle step: a box may enter that column only if it stays twice the usual
   margin clear of the newest prices THEMSELVES. Strict first, this second, shelf last;
   whichever applies is named in `why`. */
export function clearsTailPoints(rect, pts, plot, margin, share = TAIL_SHARE) {
  const t = tailBox(plot, share);
  const tail = pts.filter((p) => p.x >= t.x);
  if (!tail.length) return true;
  return clearsPrice(rect, tail, margin * 2);
}

/**
 * The placement the Station uses: the rule above, plus the trend preference and
 * the tail guard. Returns the same shape as choose(), with `trend` added.
 */
export function place(opts) {
  const pts = opts.points || pathPoints(opts.plot, opts.series || []);
  const trend = recentTrend(pts, opts.plot);
  const share = opts.tailShare == null ? TAIL_SHARE : opts.tailShare;
  const ink = opts.ink;
  /* The tail guard is applied to the candidates themselves, so a refused corner is
     REPORTED as refused ("would cover the newest prices") rather than silently
     scored low - the workshop page draws that list. */
  const guarded = (rect) => clearsTail(rect, opts.plot, share);
  const res = choose({ ...opts, points: pts, prefer: opts.prefer || preferFor(trend.dir),
    ink: ink ? (x, y) => ink(x, y) : ink });
  res.considered = res.considered.map((c) =>
    guarded(c) ? c : { ...c, clear: false, refused: c.refused || "would cover the newest prices" });
  const open = res.considered.filter((c) => c.clear && c.size === res.size);
  if (res.kind === "inset" && res.spot && guarded(res.spot)) return { ...res, trend };
  if (open.length) {
    const prefer = opts.prefer || preferFor(trend.dir);
    open.sort((a, b) => (a.ink - b.ink) || (a.corner === prefer ? -1 : b.corner === prefer ? 1 : 0));
    const preferred = open.find((c) => c.corner === prefer);
    const best = preferred && preferred.ink - open[0].ink <= 0.02 ? preferred : open[0];
    return { ...res, kind: "inset", spot: best, trend,
      why: `${trend.dir === "flat" ? "sideways" : trend.dir}: ${best.corner}, clear of the newest prices` };
  }
  /* the middle step: the newest-price column, but only well clear of the prices in it */
  const margin = opts.margin == null ? DEFAULTS.margin : opts.margin;
  const relaxed = res.considered.filter((c) => c.size === res.size &&
    c.refused === "would cover the newest prices" && clearsTailPoints(c, pts, opts.plot, margin, share));
  if (relaxed.length) {
    relaxed.sort((a, b) => a.ink - b.ink);
    const spot = relaxed[0];
    return { ...res, kind: "inset", spot: { ...spot, clear: true }, trend, relaxed: true,
      considered: res.considered.map((c) => (c === spot ? { ...c, clear: true, refused: null } : c)),
      why: `${spot.corner} - the only room left, and it stays ${margin * 2}px clear of the newest prices` };
  }
  return { ...res, kind: "shelf", spot: null, trend,
    why: "nothing clears both the price line and its newest fifth, so the lens parks below the chart" };
}

/**
 * The same placement, but stable: pinned while the reader is on it, and otherwise
 * only moving when the new spot is meaningfully better. `prev` is the last result
 * this function returned.
 */
export function placeStable(opts) {
  const prev = opts.prev || null;
  const next = place(opts);
  if (!prev || !prev.spot) return { ...next, moved: !!next.spot, held: null };
  if (opts.reading) return { ...prev, moved: false, held: "the reader is on it" };
  if (!next.spot) return { ...next, moved: true, held: null };
  if (next.spot.corner === prev.spot.corner) return { ...next, moved: false, held: null };
  /* Is where it sits now still allowed? If it covers price or the tail after this
     bar, it moves whatever the margin says. */
  const stillOk = (prev.considered || []).find((c) => c.corner === prev.spot.corner &&
    c.size === prev.spot.size && c.clear);
  const prevNow = (next.considered || []).find((c) => c.corner === prev.spot.corner && c.size === next.size);
  if (prevNow && prevNow.clear) {
    if (next.spot.ink + MOVE_MARGIN >= prevNow.ink)
      return { ...next, spot: prev.spot, moved: false, held: "the new corner is not meaningfully emptier" };
  }
  return { ...next, moved: true, held: null, from: prev.spot.corner, stillOk: !!stillOk };
}

/* ---- SHAPE ----------------------------------------------------------------
   Alan: "I love it. I don't love the shape of it." Two on offer, both drawn in
   the workshop page; the Station ships CHAMFER.
     capsule  - fully rounded ends. Softest, but the radius eats the first and last
                character of every line, so a 3-line readout has to be padded in
                and the box grows to say the same thing.
     chamfer  - a card with the corner NEAREST the price line cut away at 45.
                The cut is the tell: it points at what it is dodging, it costs no
                text width, and on a wide short Station pane it reads as deliberate
                rather than as a bubble sitting on the chart.
   Both are pure CSS on the same box, so switching is one token. */
export const SHAPES = {
  capsule: { name: "capsule", css: (r) => `border-radius:${Math.round(Math.min(r.h, r.w) / 2)}px`,
             pad: "0 14px", note: "rounded ends; costs text width" },
  chamfer: { name: "chamfer", cut: 14,
             css: (r, corner) => `clip-path:${chamferPath(corner, 14)}`,
             pad: "0 9px", note: "the cut corner points at the price line it is dodging" },
};
/* the cut goes on the corner facing the line: a lens low-left is dodging a line
   above and to its right, so the top-right corner is cut. */
export function chamferPath(corner, cut = 14) {
  const c = `${cut}px`;
  const cuts = {
    bl: `polygon(0 0, calc(100% - ${c}) 0, 100% ${c}, 100% 100%, 0 100%)`,
    bc: `polygon(0 0, calc(100% - ${c}) 0, 100% ${c}, 100% 100%, 0 100%)`,
    br: `polygon(${c} 0, 100% 0, 100% 100%, 0 100%, 0 ${c})`,
    tl: `polygon(0 0, 100% 0, 100% calc(100% - ${c}), calc(100% - ${c}) 100%, 0 100%)`,
    tc: `polygon(0 0, 100% 0, 100% calc(100% - ${c}), calc(100% - ${c}) 100%, 0 100%)`,
    tr: `polygon(0 0, 100% 0, 100% 100%, ${c} 100%, 0 calc(100% - ${c}))`,
  };
  return cuts[corner] || cuts.tl;
}
export const SHIPPED_SHAPE = "chamfer";
