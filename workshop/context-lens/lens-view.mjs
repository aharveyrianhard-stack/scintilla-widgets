/* M51 · WHAT THE LENS LOOKS AT.
 *
 * Alan, 24 Sep: "Seems to replay in the zoom level of history. I don't really care about that.
 * I care about the zoom in current bars." · "It's just a view of the current bars with the
 * opposite view, and another view of the one that we're in on the charts and what it is."
 *
 * So the lens is not a place you travel to and not a view you pick from a dropdown. It is the
 * opposite zoom of whatever the main chart is showing RIGHT NOW, on the same live bars:
 *
 *   main chart zoomed out  ->  the lens zooms IN   (the last handful of bars, large)
 *   main chart zoomed in   ->  the lens pulls BACK (the same window, times a few)
 *
 * Two rules hold in both modes:
 *   - both panes end on the SAME bar. The lens never shows a bar the main chart has not
 *     reached, and it never wanders off into history on its own;
 *   - the wide mode is a multiple of what is on screen, never "the whole history". The
 *     full-history view is the thing Alan called the replay, and it is gone.
 *
 * Placement (which corner, and the chamfer) stays exactly as M47 shipped it: this module
 * decides WHAT the lens shows, lens-placement.mjs decides WHERE it sits.
 */

export const DEFAULTS = Object.freeze({
  detailBars: 30,    // the zoomed-in window, in bars
  wideFactor: 6,     // the pulled-back window is this many times the main one
  zoomedInMax: 60,   // a main chart showing this few bars counts as "zoomed in"
  minBars: 5,        // below this there is nothing worth drawing
});

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

/**
 * @param {{total:number,start:number,end:number}} main  what the big chart is showing now
 * @returns {{mode:"detail"|"wide"|"none",start:number,end:number,bars:number,of:number,
 *            mainBars:number,label:string,why:string}}
 */
export function lensView(main, opt = {}) {
  const k = { ...DEFAULTS, ...opt };
  const total = Math.max(0, Math.round(Number(main?.total) || 0));
  if (!total) return none(0, 0, "there are no bars yet");
  const end = clamp(main.end, 0, total - 1);
  const start = clamp(main.start, 0, end);
  const mainBars = end - start + 1;

  const wideBars = Math.min(total, mainBars * k.wideFactor);
  const wideOk = wideBars > mainBars;
  const detailBars = Math.min(k.detailBars, mainBars - 1);
  const detailOk = detailBars >= k.minBars;

  const zoomedIn = mainBars <= k.zoomedInMax;
  const order = zoomedIn ? ["wide", "detail"] : ["detail", "wide"];
  for (const mode of order) {
    if (mode === "wide" && wideOk) return view("wide", end - wideBars + 1, end, total, mainBars,
      zoomedIn ? "the chart is zoomed in, so the lens pulls back" : "there is no room to zoom in further");
    if (mode === "detail" && detailOk) return view("detail", end - detailBars + 1, end, total, mainBars,
      zoomedIn ? "the chart already shows everything there is, so the lens zooms in" : "the chart is zoomed out, so the lens zooms in");
  }
  return none(end, mainBars, "the chart is showing too few bars for a second view");
}

function view(mode, start, end, total, mainBars, why) {
  const bars = end - start + 1;
  return { mode, start: Math.max(0, start), end, bars, of: total, mainBars,
    label: (mode === "wide" ? "WIDER · LAST " : "ZOOM · LAST ") + bars + " BARS", why };
}
const none = (end, mainBars, why) =>
  ({ mode: "none", start: end, end, bars: 0, of: 0, mainBars, label: "", why });

/** The second line of the lens heading: the span it covers, in plain dates. */
export function lensSpan(view, dateAt) {
  if (!view || view.mode === "none") return "";
  const from = dateAt(view.start), to = dateAt(view.end);
  return from && to ? from + " → " + to : "";
}

/** True when both panes end on the same bar — the invariant the lens must never break. */
export const endsTogether = (view, main) => view.mode === "none" || view.end === clamp(main.end, 0, Math.max(0, (Number(main.total) || 1) - 1));
