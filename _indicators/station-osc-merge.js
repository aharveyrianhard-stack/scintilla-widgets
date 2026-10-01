/* SCINTILLA · STATION — THE MERGED OSCILLATOR (S6, 1 Oct): RSI + Williams %R, blended the Geiger's way.
   ============================================================================
   Alan, 1 Oct ~10:35 ET: "we do have Williams… why don't we present the oscillators for Williams anywhere?…
   the merged oscillators, RSI and Williams alone without stochastic, I think it would look pretty clean… the
   pink one is the latest visually approved… adding the merge of both with a slightly different colour;
   wherever we have oscillators on Station and on Hub present the merged; as I expand into more real estate,
   present the individuals." And: "the Geiger momentum is 60/40 RSI Williams — that one is correct. We keep it."

   THE ARITHMETIC IS THE GEIGER'S, read (never edited) from the provider repo,
   services/hot-query/geiger-publish-artifact.mjs (origin/provider/live-20260929 @ 2cce315) and its Equalizer
   snapshot control/acceptance/EQUALIZER_SNAPSHOT_2026-08-18.json (momentum_mix rsi 0.6, williams 0.4):
     RSI_OS 23, RSI_OB 77, W_OS -90, W_OB -10, RSI(14), Williams(14)
     williams = hh > ll ? (hh - close) / (hh - ll) * -100 : -50      (hh/ll over the last 14 bars, this one included)
     momentum = (cl((rsi - 23) / (77 - 23) * 2 - 1) * 0.6 + cl((wr + 90) / (-10 + 90) * 2 - 1) * 0.4) / 1.0
   so RSI 23 -> -1 … 77 -> +1 and Williams -90 -> -1 … -10 -> +1, each clamped to -1…+1. Nothing is redesigned.
   On the pane the signed value is drawn on the RSI pane's fixed 0-100 axis as (m + 1) * 50, so it sits with
   the 30/70 guides: 0 = momentum -1, 50 = 0, 100 = +1.

   Pure functions. No fetch, no DOM, no clock of its own. */
(function (root) {
  "use strict";

  const RSI_OS = 23, RSI_OB = 77, W_OS = -90, W_OB = -10, WILLIAMS_PERIOD = 14;
  const MIX = Object.freeze({ rsi:0.6, williams:0.4 });
  const cl = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));

  /* the two maps and the blend, exactly the publisher's expressions */
  function mapRsi(rsi) { return Number.isFinite(rsi) ? cl((rsi - RSI_OS) / (RSI_OB - RSI_OS) * 2 - 1) : null; }
  function mapWilliams(wr) { return Number.isFinite(wr) ? cl((wr - W_OS) / (W_OB - W_OS) * 2 - 1) : null; }
  function blend(rsi, wr, mix) {
    const m = mix || MIX, a = mapRsi(rsi), b = mapWilliams(wr);
    if (a == null || b == null) return null;
    return (a * m.rsi + b * m.williams) / ((m.rsi + m.williams) || 1);
  }
  /* the signed -1…+1 on the 0-100 axis, and back */
  const toPane = (m) => (Number.isFinite(m) ? (m + 1) * 50 : null);
  const fromPane = (p) => (Number.isFinite(p) ? p / 50 - 1 : null);

  /* Williams %R(14) at every bar: bars [{ h, l, c }] ascending. A bar without its own high and low cannot give
     an honest range, so any window that holds one is null (never filled from closes). */
  function williamsValues(bars, period) {
    const n = period || WILLIAMS_PERIOD, list = bars || [], out = new Array(list.length).fill(null);
    for (let i = n - 1; i < list.length; i++) {
      let hh = -1e18, ll = 1e18, ok = true;
      for (let j = i - n + 1; j <= i; j++) {
        const b = list[j];
        if (!b || !Number.isFinite(b.h) || !Number.isFinite(b.l)) { ok = false; break; }
        if (b.h > hh) hh = b.h; if (b.l < ll) ll = b.l;
      }
      const c = list[i] && list[i].c;
      if (!ok || !Number.isFinite(c)) continue;
      out[i] = hh > ll ? (hh - c) / (hh - ll) * -100 : -50;
    }
    return out;
  }

  /* One source's three series from its RSI series (station-rsi-fan lineSeries: [{ t, end, v, approx, forming }])
     and the same bars' Williams values. Every point keeps the RSI point's clock (t, end, forming), so the fan's
     sampling, developing tip and STALE rule apply unchanged. The merged value exists only where both do (the
     RSI warm-up hides it, as it hides the RSI). */
  function deriveSets(rsiSeries, wrValues) {
    const s = rsiSeries || [], w = wrValues || [];
    const pick = (i, v) => { const p = Object.assign({}, s[i]); p.v = v; return p; };
    const williams = s.map((p, i) => pick(i, w[i] == null ? null : w[i]));
    const merged = s.map((p, i) => pick(i, p.v == null || w[i] == null ? null : toPane(blend(p.v, w[i]))));
    return { rsi:s, williams, merged };
  }

  /* ---- what each set looks like on its pane ------------------------------------------------------------ */
  const DOT = Object.freeze([1, 2]);
  /* the approved pink (the Lab's RSI-only table, station-rsi-fan VISUAL) */
  const PINK = "#FF4FAD", PINK_CLOUD = "#C84C86";
  /* THE MERGED TINT: the same pink family turned toward orchid, so it reads as a cousin of the RSI pane and is
     still told apart when the three are stacked. Same opacities, widths and dashes as the RSI table. */
  const ORCHID = "#E86BF0", ORCHID_CLOUD = "#B45CC2";
  /* WILLIAMS: the Hub's own token for Williams - the Equalizer's RSI | WILLIAMS mix slider draws WILLIAMS in
     cherenkov cyan, --crk #00D4FF (scintilla-hub index.html :root and the .sc-eq__mixrow). */
  const CYAN = "#00D4FF", CYAN_CLOUD = "#2A8FB0";
  const g = (v, opacity, dash) => Object.freeze({ v, opacity, width:1, dash:dash || null });
  const LOOKS = Object.freeze({
    merged: Object.freeze({ key:"merged", ink:ORCHID, cloud:Object.freeze({ ink:ORCHID_CLOUD, opacity:.30 }),
      domain:Object.freeze([0, 100]), padPx:3, title:"MERGED RSI+%R 60/40", chip:"MRG D", short:"M",
      guides:Object.freeze([g(100, .15), g(70, .70), g(50, .30, DOT), g(30, .70), g(0, .15)]),
      chipLook:Object.freeze({ text:.95, fill:.18, leader:.55, gap:6 }) }),
    rsi: Object.freeze({ key:"rsi", ink:PINK, cloud:Object.freeze({ ink:PINK_CLOUD, opacity:.30 }),
      domain:Object.freeze([0, 100]), padPx:3, title:"RSI 14", chip:"RSI D", short:"R",
      guides:Object.freeze([g(100, .15), g(70, .70), g(50, .30, DOT), g(30, .70), g(0, .15)]),
      chipLook:Object.freeze({ text:.95, fill:.18, leader:.55, gap:6 }) }),
    /* Williams' native range is -100…0; its usual bounds -20 (overbought) and -80 (oversold) take the place
       of 70/30, drawn the same way */
    williams: Object.freeze({ key:"williams", ink:CYAN, cloud:Object.freeze({ ink:CYAN_CLOUD, opacity:.30 }),
      domain:Object.freeze([-100, 0]), padPx:3, title:"%R 14", chip:"%R D", short:"W",
      guides:Object.freeze([g(0, .15), g(-20, .70), g(-50, .30, DOT), g(-80, .70), g(-100, .15)]),
      chipLook:Object.freeze({ text:.95, fill:.18, leader:.55, gap:6 }) })
  });
  /* value -> y inside [top, top + height] on the look's fixed domain, padPx kept at each end */
  function lookY(look, v, top, height) {
    const p = look.padPx, lo = look.domain[0], hi = look.domain[1];
    return top + p + (1 - (v - lo) / (hi - lo)) * Math.max(1, height - 2 * p);
  }
  function rgba(hex, a) {
    const h = String(hex || "").replace("#", "");
    const [r, gg, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return "rgba(" + r + "," + gg + "," + b + "," + Math.max(0, Math.min(1, a)).toFixed(2) + ")";
  }
  /* "MRG D 61.2" · "RSI D 52.3" · "%R D −23.4": the actual value at one decimal */
  function chipText(look, v) {
    if (!Number.isFinite(v)) return look.chip + " —";
    return look.chip + " " + (v < 0 ? "−" + Math.abs(v).toFixed(1) : v.toFixed(1));
  }
  const fmt = (v) => (v == null || !Number.isFinite(v) ? "—" : v < 0 ? "−" + Math.abs(v).toFixed(1) : v.toFixed(1));
  /* the hover item for one timeframe on the merged pane: its merged value and both sources' own values */
  function hoverItem(label, merged, rsi, wr) { return label + " " + fmt(merged) + " R" + fmt(rsi) + " W" + fmt(wr); }

  /* ---- which set the pane shows ---------------------------------------------------------------------------
     ?osc=  merged | split | auto (absent = auto). In auto:
       · a pane the deck has expanded (⤢, SCINTILLA_DECK_FULL_STATE active)        -> split
       · the Hub's company chart, told by the Hub (EXPAND on)                      -> split
       · the chart page opened on its own (not inside the deck or the Hub) and tall
         enough for price plus three readable panes (SPLIT_MIN_H)                  -> split
       · everything else - the 8-up and every compact wall pane, the Hub collapsed  -> merged
     A typed ?osc=merged or ?osc=split always wins. */
  const SPLIT_MIN_H = 560;
  function parseOscParam(raw) {
    const t = raw == null ? "" : String(raw).trim().toLowerCase();
    return t === "merged" || t === "merge" || t === "m" ? "merged" : t === "split" || t === "three" || t === "3" ? "split" : "auto";
  }
  function resolveMode(o) {
    const want = parseOscParam(o && o.param);
    if (want !== "auto") return want;
    if (o.deckFull) return "split";
    if (o.hubSplit === true) return "split";
    if (o.hubSplit === false || o.embedded) return "merged";
    return Number(o.areaH) >= SPLIT_MIN_H ? "split" : "merged";
  }
  /* The oscillator block's share of the pane: the one merged pane keeps the RSI pane's 26%; the three stacked
     take 46% (price keeps more than half), split evenly with a 6 px gap between them. */
  const MERGED_SHARE = 0.26, SPLIT_SHARE = 0.46, SPLIT_GAP = 6;
  function splitPanes(top, height) {
    const each = Math.max(1, Math.floor((height - 2 * SPLIT_GAP) / 3));
    return ["merged", "rsi", "williams"].map((key, i) => ({ key, top:top + i * (each + SPLIT_GAP), height:each }));
  }

  root.SC_OSC_MERGE = Object.freeze({
    RSI_OS, RSI_OB, W_OS, W_OB, WILLIAMS_PERIOD, MIX, LOOKS, SPLIT_MIN_H, MERGED_SHARE, SPLIT_SHARE, SPLIT_GAP,
    mapRsi, mapWilliams, blend, toPane, fromPane, williamsValues, deriveSets, lookY, rgba, chipText, hoverItem, fmt,
    parseOscParam, resolveMode, splitPanes
  });
})(typeof globalThis === "object" ? globalThis : window);
