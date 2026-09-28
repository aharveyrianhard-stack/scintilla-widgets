/* THE CONTEXT LENS PLACEMENT RULE.
   (Moved here from workshop/context-lens/ on 27 Sep, CL4: the live chart pane imports it now.
   The old paths re-export this file.)
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
  /* boxW/boxH ask for an exact box (the 27 Sep bubble): no fraction and no floor overrides it. */
  const w = opt.boxW > 0 ? Math.round(opt.boxW) : Math.max(opt.minW || DEFAULTS.minW, Math.round(iw * fw));
  const h = opt.boxH > 0 ? Math.round(opt.boxH) : Math.max(opt.minH || DEFAULTS.minH, Math.round(ih * fh));
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

/* ============================================================================
   O1 (27 Sep) — THE EMPTIEST DARK REGION.
   Alan: the lens' "position must seek the emptiest dark space (not fixed)". Corners are not
   enough on a 3-day line that fills three of them, so this searches a grid of positions over
   the whole plot and takes the one with the least already painted on it - the chart's own
   pixels, clouds included. Rules, in order:
     1. never in the newest fifth (the whole column, not just the line in it);
     2. never on a keep-out box (the pane's badge, the deck's arrows, the lens for the Geiger chip);
     3. covering the price line costs COVER_COST on top of the ink it already counts, so an empty
        patch always beats a thin line, but a crowded chart still gets its least-bad spot;
     4. the preferred spot (bottom-left for the lens) wins whenever it is within `tolerance`
        of the best, and a spot already held keeps its place unless another is MOVE_MARGIN
        emptier - it does not hop on every tick.
   Pure: `ink(x, y)` is handed in (the page reads the chart canvas, the tests pass a function).
   ========================================================================== */
export const COVER_COST = 0.25;
/* 28 Sep — THE NEWEST FIFTH IS A FIFTH OF THE LINE, not of the plot. With the new, shorter first views
   the plot carries a right margin (a few empty bars, and the cloud ribbon's names) after the newest bar,
   so "the right fifth of the plot" was only about a tenth of the drawn line. The newest fifth is now
   measured on the line that is actually on screen: from its first drawn point to its last, the last
   fifth of that distance, and everything right of it (the names column, the live point) with it. */
export function lineTailBox(plot, pts, share = TAIL_SHARE) {
  if (!pts || pts.length < 2) return tailBox(plot, share);
  const left = pts[0].x, right = pts[pts.length - 1].x;
  const x = Math.min(plot.padL + plot.iw * (1 - share), right - share * Math.max(0, right - left));
  return { x, y: plot.padT, w: plot.padL + plot.iw - x, h: plot.ih };
}
/* The search grid follows the pane: about one position every 20 px across and 14 px down, so a wide
   two-chart pane is searched as finely as a small eight-up one. */
export function gridFor(span, step, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(span / step) + 1));
}
export function emptiestSpot(opts) {
  const { plot, box } = opts;
  const pts = opts.points || [];
  const edge = opts.edge == null ? DEFAULTS.edge : opts.edge;
  const margin = opts.margin == null ? 6 : opts.margin;
  const pad = opts.keepOutPad == null ? 4 : opts.keepOutPad;
  const tolerance = opts.tolerance == null ? 0.03 : opts.tolerance;
  const keepOut = (opts.keepOut || []).filter((k) => k && k.w > 0 && k.h > 0);
  const share = opts.tailShare == null ? TAIL_SHARE : opts.tailShare;
  const tail = opts.tailFrom === "plot" ? tailBox(plot, share) : lineTailBox(plot, pts, share);
  const x0 = plot.padL + edge, x1 = Math.min(tail.x - box.w, plot.padL + plot.iw - edge - box.w);
  const y0 = plot.padT + edge, y1 = plot.padT + plot.ih - edge - box.h;
  if (x1 < x0 || y1 < y0) return { spot: null, why: "the plot left of the newest fifth is smaller than the box" };
  const cols = opts.cols || gridFor(x1 - x0, 20, 6, 28), rows = opts.rows || gridFor(y1 - y0, 14, 4, 14);
  const hit = (r) => keepOut.some((k) => !(r.x + r.w + pad <= k.x || k.x + k.w + pad <= r.x || r.y + r.h + pad <= k.y || k.y + k.h + pad <= r.y));
  /* The chart's pixels are sampled ONCE on a step grid over the plot and summed, so each candidate's
     share of ink is four lookups rather than hundreds (the per-candidate sampling cost ~25 ms per wall
     at the iMac-like 4x CPU profile). The same sampling points inkShare would use. */
  const step = opts.step || 3;
  /* the lens and the Geiger chip ask about the same paint with the same reader: build the table once */
  const key = [plot.padL, plot.padT, plot.iw, plot.ih, step].join(",");
  let inkIn = null;
  if (opts.ink) {
    if (opts.ink.__sumKey === key) inkIn = opts.ink.__sum;
    else { inkIn = summedInk(plot, opts.ink, step); try { opts.ink.__sum = inkIn; opts.ink.__sumKey = key; } catch (_) {} }
  }
  /* the price points under a box and one either side: pathPoints is ordered by x */
  const near = (r) => {
    if (!pts.length) return pts;
    const a = r.x - margin, b = r.x + r.w + margin;
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (pts[m].x < a) lo = m + 1; else hi = m; }
    let end = lo;
    while (end < pts.length && pts[end].x <= b) end++;
    return pts.slice(Math.max(0, lo - 1), Math.min(pts.length, end + 1));
  };
  const score = (r) => {
    const share = inkIn ? inkIn(r) : 0;
    const covers = !clearsPrice(r, near(r), margin);
    return { ink: share, covers, score: share + (covers ? COVER_COST : 0) };
  };
  const xs = [], ys = [];
  for (let i = 0; i < cols; i++) xs.push(Math.round(x0 + (cols === 1 ? 0 : (i / (cols - 1)) * (x1 - x0))));
  for (let j = 0; j < rows; j++) ys.push(Math.round(y1 - (rows === 1 ? 0 : (j / (rows - 1)) * (y1 - y0))));
  const cands = [];
  for (const y of ys) for (const x of xs) {
    const r = { x, y, w: box.w, h: box.h };
    if (hit(r)) continue;
    cands.push({ ...r, ...score(r) });
  }
  /* a keep-out on the preferred corner (the deck's arrow): the same row slides right past it */
  if (!cands.length) return { spot: null, why: "every position left of the newest fifth sits on the badge or a control" };
  const prefer = opts.prefer || "bl";
  const want = prefer === "bl" ? { x: x0, y: y1 } : prefer === "tl" ? { x: x0, y: y0 } : prefer;
  const dist = (c) => Math.hypot(c.x - want.x, c.y - want.y);
  const preferred = cands.slice().sort((a, b) => dist(a) - dist(b))[0];
  let best = cands.slice().sort((a, b) => (a.score - b.score) || (dist(a) - dist(b)))[0];
  let why = "the emptiest dark space";
  if (preferred.score <= best.score + tolerance) { best = preferred; why = prefer === "bl" ? "bottom-left (preferred; as empty as anywhere)" : "the preferred spot (as empty as anywhere)"; }
  /* hold still: the spot it already has stays unless the new one is meaningfully emptier */
  const prev = opts.prev;
  if (prev && prev.w === box.w && prev.h === box.h && prev.x >= x0 - 1 && prev.x <= x1 + 1 && prev.y >= y0 - 1 && prev.y <= y1 + 1 && !hit(prev)) {
    const now = { ...prev, ...score(prev) };
    if (now.score <= best.score + MOVE_MARGIN) return { spot: now, why: "held: " + why + " is not meaningfully emptier", held: true, considered: cands.length };
  }
  return { spot: best, why: why + (best.covers ? " (nothing clear of the line was emptier)" : ""), held: false, considered: cands.length };
}

/* A summed table of ink samples on a `step` grid anchored at the plot's corner; returns rect -> share. */
export function summedInk(plot, ink, step = 3) {
  const x0 = Math.floor(plot.padL), y0 = Math.floor(plot.padT);
  const cols = Math.max(1, Math.ceil(plot.iw / step) + 1), rows = Math.max(1, Math.ceil(plot.ih / step) + 1);
  const S = new Uint32Array((cols + 1) * (rows + 1));
  for (let j = 0; j < rows; j++) {
    let run = 0;
    for (let i = 0; i < cols; i++) {
      if (ink(x0 + i * step, y0 + j * step)) run++;
      S[(j + 1) * (cols + 1) + i + 1] = S[j * (cols + 1) + i + 1] + run;
    }
  }
  const at = (i, j) => S[Math.max(0, Math.min(rows, j)) * (cols + 1) + Math.max(0, Math.min(cols, i))];
  return (r) => {
    const i0 = Math.ceil((r.x - x0) / step), i1 = Math.ceil((r.x + r.w - x0) / step);
    const j0 = Math.ceil((r.y - y0) / step), j1 = Math.ceil((r.y + r.h - y0) / step);
    const n = Math.max(0, i1 - i0) * Math.max(0, j1 - j0);
    if (!n) return 1;
    return (at(i1, j1) - at(i0, j1) - at(i1, j0) + at(i0, j0)) / n;
  };
}

/* "anything the chart painted", read once from its own canvas (alpha > 40). Shared by the lens and
   the Geiger chip so both see the same pixels. */
export function inkReader(canvas) {
  let data = null, W = 0, H = 0, ratio = 1;
  return (x, y) => {
    if (!data) {
      try {
        const c = canvas.getContext("2d", { willReadFrequently: false }); W = canvas.width; H = canvas.height;
        ratio = W / Math.max(1, canvas.clientWidth);
        data = c.getImageData(0, 0, W, H).data;
      } catch (_) { data = new Uint8ClampedArray(0); }
    }
    const px = Math.round(x * ratio), py = Math.round(y * ratio);
    if (px < 0 || py < 0 || px >= W || py >= H) return false;
    return data[(py * W + px) * 4 + 3] > 40;
  };
}

/* ============================================================================
   28 Sep — THE GEIGER CHIP TAKES THE TOP RIGHT.
   Alan: "The system is having trouble with the locations of things, so as not to consume space… I feel
   like the Geiger should take the TOP RIGHT."
     1. its row is the badge's row: the band above the plot the ticker badge already sits in, so it covers
        no price, no cloud and none of the lens' room;
     2. right-aligned to the plot's right edge: the price scale and the live price label live right of that
        edge (and below the plot's top), so the chip is clear of both;
     3. a keep-out box in that row (the deck's timeframe tag, its arrows) pushes it left, never onto the
        badge;
     4. no room left in that row: the plot's own top-right corner, just inside the edge;
     5. still no room: no chip, and the pane says why (data-why).
   Pure: boxes in, a spot out.
   ========================================================================== */
const hitBox = (a, b, pad = 0) => !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);
export function topRightSpot({ plot, box, badge = null, keepOut = [], pad = 4, gap = 2 }) {
  const right = plot.padL + plot.iw;
  const outs = (keepOut || []).filter((k) => k && k.w > 0 && k.h > 0);
  const rowY = badge && badge.h > 0 ? Math.round(badge.y + (badge.h - box.h) / 2) : Math.round(plot.padT - box.h - 3);
  let x = Math.round(right - box.w - gap);
  for (let guard = 0; guard < 8; guard++) {
    const k = outs.find((o) => hitBox({ x, y: rowY, w: box.w, h: box.h }, o, pad));
    if (!k) break;
    x = Math.round(k.x - pad - box.w);
  }
  const row = { x, y: rowY, w: box.w, h: box.h };
  const rowFree = rowY >= 0 && x >= plot.padL && !outs.some((o) => hitBox(row, o, pad)) && !(badge && hitBox(row, badge, pad));
  if (rowFree) return { spot: row, why: x === Math.round(right - box.w - gap) ? "top right, in the badge row" : "top right, in the badge row, left of the deck's tag" };
  const inside = { x: Math.round(right - box.w - gap), y: Math.round(plot.padT + gap), w: box.w, h: box.h };
  if (!outs.some((o) => hitBox(inside, o, pad)) && !(badge && hitBox(inside, badge, pad)) && inside.x >= plot.padL)
    return { spot: inside, why: "top right, just inside the plot (the badge row has no room)" };
  return { spot: null, why: "no room at the top right" };
}
