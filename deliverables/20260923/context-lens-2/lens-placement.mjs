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
