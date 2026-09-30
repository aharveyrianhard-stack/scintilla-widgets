// Headless only. node value-check.mjs <root> <out.json> [tickers] [ranges]
// THE TIMESTAMPED SOURCE-VALUE CHECK (S3-RSI-ONLY). For each ticker and viewing range, for every drawn line
// (3H 4H 6H 8H 12H D) and every cloud source (2D 3D W 2W):
//   1. the pane's own newest drawn value, and the SOURCE BAR it came from (its timestamp);
//   2. the exact source bars the pane used (its in-memory cache), compared close-for-close, timestamp-for-
//      timestamp, with a fresh read of the SAME chart API URL made by this script;
//   3. an independent Wilder RSI(14), written here and not shared with the Station code, on those bars,
//      at that same timestamp, compared with the drawn value.
// Composed widths (8H from 4H, 2D/2W from 1D/W) are composed with the Station's composeBars (named as such).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { serve, open } from "./rig.mjs";
const [root, outJson, tArg = "SPY,MU,BTCUSD", rArg = "1D"] = process.argv.slice(2);
const ctx = { Intl, Date, Math, Number, JSON, Array, Object, Set, Map, isFinite, parseInt, console };
vm.runInNewContext(fs.readFileSync(path.join(root, "_indicators/station-rsi-fan.js"), "utf8"), ctx);
const F = ctx.SC_RSI_FAN;

/* Independent Wilder RSI(14): seed = simple mean of the first 14 changes, then (prev*13 + x)/14. */
function wilder(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= n) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) g += d; else l -= d; }
  g /= n; l /= n;
  out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}
const iso = (ms) => new Date(ms).toISOString();
const { server, origin } = await serve(path.resolve(root));
const report = [];
try {
  for (const range of rArg.split(",")) for (const t of tArg.split(",")) {
    const log = [];
    const { browser, context } = await open({ width: 1680, log });
    try {
      const page = await context.newPage();
      await page.goto(`${origin}/chart/index.html?bare=1&t=${t}&range=${range}&rsi=auto`);
      await page.waitForTimeout(24000);
      const got = await page.evaluate(() => {
        const h = document.querySelector(".sc-nchart"), m = h._rsiMemo, F = window.SC_RSI_FAN, T = h.dataset.t;
        if (!m) return null;
        const pts = h._series, last = pts.length - 1;
        const one = (item) => {
          const spec = F.BY_KEY[item.key];
          const own = !(spec.compose && spec.tf === F.BY_KEY[spec.compose.from].tf);
          const srcTf = item.from === "composed" ? F.BY_KEY[spec.compose.from].tf : spec.tf;
          const e = rsiSourceCache.get(T + "|" + srcTf);
          if (!e || !item.values) return { key: item.key, missing: true, absence: item.absence || null };
          let ix = -1; for (let i = last; i >= Math.max(0, last - 3); i--) if (item.values[i] != null) { ix = i; break; }
          if (ix < 0) return { key: item.key, missing: true, why: "no value on the newest bars" };
          const v = item.values[ix];
          const bars = item.from === "composed" ? F.composeBars(e.bars, spec.compose) : e.bars;
          const series = F.lineSeries(item.key, bars);
          let sIx = -1; for (let j = series.length - 1; j >= 0; j--) if (series[j].v === v) { sIx = j; break; }
          return { key: item.key, label: spec.label, tf: spec.tf, srcTf, from: item.from, ownRead: own, drawn: v, chartBar: pts[ix].d, chartIx: ix,
            live: !!pts[ix].live, sourceBarT: sIx >= 0 ? series[sIx].t : null, developing: item.tip ? item.tip.developing : null,
            rawBars: e.bars.map((b) => [b.t, b.c]), cacheFrom: e.from || "provider" };
        };
        return { t: T, range: h._range || S.chartRange, lines: m.lines.map(one), cloud: m.cloud ? m.cloud.parts.map(one) : [],
          chip: h._rsiDrawn && h._rsiDrawn.chip, cloudDrawn: h._rsiDrawn && h._rsiDrawn.cloud };
      });
      const readAt = Date.now();
      if (!got) { report.push({ t, range, error: "no RSI memo" }); continue; }
      /* 2 · re-read every URL the pane read for this ticker, from node, same origin header */
      const fresh = {};
      for (const e of log) {
        if (fresh[e.url]) continue;
        const r = await fetch("https://scintilla-massive-chart-api.fly.dev" + e.url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
        fresh[e.url] = r.ok ? await r.json() : null;
      }
      const rowsOf = (j) => (Array.isArray(j) ? j : j && Array.isArray(j.series) ? j.series : j && Array.isArray(j.candles) ? j.candles : j && Array.isArray(j.data) ? j.data : j && Array.isArray(j.results) ? j.results : []);
      const freshBars = (tf) => {
        const m = new Map();
        for (const [url, j] of Object.entries(fresh)) {
          const u = new URL("http://x" + url), p = Object.fromEntries(u.searchParams);
          /* the API's own width names: D, W, 3D, 240 (4H), 180 (3H), 12h, 6h, 8h */
          const API_TF = { "1D": "D", "1W": "W", "3D": "3D", "4h": "240", "3h": "180", "12h": "12h", "6h": "6h", "8h": "8h", "2h": "120" };
          const tfOk = String(p.tf) === (API_TF[tf] || tf);
          if (!tfOk) continue;
          for (const r of rowsOf(j)) { const ts = r.timestamp != null ? r.timestamp * 1000 : r.t; if (Number.isFinite(ts)) m.set(ts, +(r.close ?? r.c)); }
        }
        return m;
      };
      const check = (x) => {
        if (x.missing) return x;
        const fb = freshBars(x.srcTf);
        let same = 0, diff = 0, maxd = 0, lastMatch = null;
        for (const [ts, c] of x.rawBars) if (fb.has(ts)) { const d = Math.abs(fb.get(ts) - c); if (d < 1e-9) same++; else { diff++; maxd = Math.max(maxd, d); } lastMatch = ts; }
        const bars = x.from === "composed" ? F.composeBars(x.rawBars.map(([t, c]) => ({ t, c })), F.BY_KEY[x.key].compose) : x.rawBars.map(([t, c]) => ({ t, c }));
        const rsi = wilder(bars.map((b) => b.c));
        const k = bars.findIndex((b) => b.t === x.sourceBarT);
        const indep = k >= 0 ? rsi[k] : null;
        return { key: x.key, label: x.label, from: x.from, sourceTf: x.srcTf, chartBar: x.chartBar, liveChartBar: x.live,
          sourceBar: x.sourceBarT == null ? null : iso(x.sourceBarT), developing: x.developing,
          drawn: +x.drawn.toFixed(4), independent: indep == null ? null : +indep.toFixed(4), delta: indep == null ? null : +Math.abs(indep - x.drawn).toExponential(2),
          sourceBars: x.rawBars.length, sourceFirst: iso(x.rawBars[0][0]), sourceLast: iso(x.rawBars[x.rawBars.length - 1][0]),
          apiFresh: { bars: fb.size, sameTimestampSameClose: same, sameTimestampDifferentClose: diff, maxCloseDiff: maxd, newestMatched: lastMatch ? iso(lastMatch) : null },
          dailyReadFrom: x.cacheFrom };
      };
      /* the provider's own statement of session and finality, per width read */
      const provenance = Object.fromEntries(Object.entries(fresh).filter(([u, j]) => j && j.tf).map(([u, j]) => [u, {
        tf: j.tf, provider: j.provider, session_anchor: j.session_anchor, session_extension: j.session_extension, bar_finality: j.bar_finality,
        price_basis: j.price_basis, incomplete_trailing_dropped: j.incomplete_trailing_dropped, newest: j.newest }]));
      report.push({ t: got.t, range: got.range, checkedAt: iso(readAt), provenance, chip: got.chip, cloudDrawn: got.cloudDrawn,
        apiUrls: Object.keys(fresh), lines: got.lines.map(check), cloud: got.cloud.map(check) });
      const L = report[report.length - 1];
      console.log(t, range, [...L.lines, ...L.cloud].map((x) => `${x.label || x.key}:${x.drawn ?? "—"}/${x.independent ?? "—"}`).join(" "));
    } finally { await browser.close(); }
  }
} finally { server.close(); }
fs.writeFileSync(outJson, JSON.stringify(report, null, 1));
