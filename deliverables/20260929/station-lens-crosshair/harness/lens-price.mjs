// Headless only. node lens-price.mjs <root> [--at=2026-09-29T14:47:00-04:00] [--t=SPY] [--out=json]
// Measures, on the standalone chart pane, the context lens's newest price against the badge's live price,
// on the 3D (4h:12) and 1D (30m:3) lenses. With --at, the page's clock is moved to that instant, every
// candle the API returns is cut to the bars COMPLETED by then (a recorded session, replayed), and the
// live quote is the recorded 1-minute close at that instant, pushed exactly as the deck pushes it.
import fs from "node:fs";
import { serve, open } from "./rig.mjs";
const [root, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const T = (opt.t || "SPY").toUpperCase();
const AT = opt.at ? Date.parse(opt.at) : null;
const API = "https://scintilla-massive-chart-api.fly.dev", H = { origin: "https://scintillahub.ai" };
const TF_MS = { "5": 3e5, "15": 9e5, "30": 18e5, "60": 36e5, "120": 72e5, "180": 108e5, "240": 144e5, "D": 864e5, "3D": 2592e5, "W": 6048e5 };
let recordedQuote = null;
if (AT) {
  const j = await (await fetch(`${API}/candles?symbol=${T}&tf=1m&limit=900`, { headers: H })).json();
  const done = j.series.filter((r) => r.t + 6e4 <= AT);
  const b = done[done.length - 1];
  recordedQuote = { price: b.c, updated_ts: new Date(b.t + 6e4 - 1000).toISOString() };
}
const { server, origin } = await serve(root);
const rows = [];
for (const [range, bubble] of [["3D", "4h:12"], ["1D", "30m:3"]]) {
  const { browser, context } = await open({ width: 1680 });
  try {
    if (AT) {
      await context.addInitScript((at) => {
        const shift = at - Date.now(), RealDate = Date;
        class D extends RealDate { constructor(...a) { super(...(a.length ? a : [RealDate.now() + shift])); } static now() { return RealDate.now() + shift; } }
        window.Date = D;
      }, AT);
      await context.route(/\/candles\?/, async (route) => {
        const url = route.request().url(), tf = new URL(url).searchParams.get("tf");
        const r = await fetch(url, { headers: H }), j = await r.json();
        const w = TF_MS[tf] || 0;
        if (Array.isArray(j.series)) j.series = j.series.filter((b) => b.t + w <= AT);
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j), headers: { "access-control-allow-origin": "*" } });
      });
      await context.route(/\/quotes\?/, async (route) => {
        const url = route.request().url(), r = await fetch(url, { headers: H }), j = await r.json();
        if (j.quotes && j.quotes[T]) Object.assign(j.quotes[T], { price: recordedQuote.price, price_observation_utc: recordedQuote.updated_ts, updated_ts: recordedQuote.updated_ts, price_freshness: "FRESH" });
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j), headers: { "access-control-allow-origin": "*" } });
      });
    }
    const page = await context.newPage();
    const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
    await page.goto(`${origin}/chart/index.html?shell=v1&bare=1&t=${T}&range=${range}&bubble=${encodeURIComponent(bubble)}`);
    await page.waitForTimeout(9000);
    if (AT) await page.evaluate((q) => scChartLive(q.t, q.price, q.updated_ts, null), { t: T, ...recordedQuote });   // the deck's push
    await page.waitForTimeout(2500);
    const r = await page.evaluate(async ({ bubble }) => {
      const host = document.querySelector(".sc-nchart");
      const L = await import("/_indicators/lens-bars.mjs"), S = await import("/_indicators/station-lens.mjs");
      const want = S.parseBubble(bubble), t = host.dataset.t;
      const q = liveQuote[t];
      const series = host._series || [];
      const lastPt = series[series.length - 1];
      /* what the lens drew: its own record when it keeps one (after the fix), else the same read it makes */
      let lensLast = host._lens && host._lens.last != null ? host._lens.last : null, lensLastT = host._lens && host._lens.lastT || null, source = "host._lens.last";
      if (lensLast == null) {
        const tf = L.TIMEFRAMES[want.timeframe].tf;
        const rows = await fetchProviderCandles(t, tf, L.barsToRequest(want.timeframe, want.sessions, S.hoursOf(want.timeframe, t)), 1);
        const bars = rows.map((x) => ({ t: x.timestamp * 1000, o: +x.open, h: +x.high, l: +x.low, c: +x.close }));
        const flat = L.flatten(L.lastSessions(bars, want.sessions, S.hoursOf(want.timeframe, t)));
        const b = flat[flat.length - 1]; lensLast = b ? b.c : null; lensLastT = b ? new Date(b.t).toISOString() : null; source = "recomputed from the lens's own read";
      }
      const badge = host.querySelector(".sc-nchart__live-change");
      return { t, range: host._range || null, badgeText: badge ? badge.textContent.trim() : null, quote: q ? q.price : null, quoteTs: q ? q.updated_ts : null,
        chartLast: lastPt ? lastPt.p : null, chartLastLive: !!(lastPt && lastPt.live), chartLastD: lastPt ? lastPt.d : null,
        lensLast, lensLastT, source, lensState: host.dataset.lensState || null, lensWhy: host.dataset.lensWhy || null,
        lensForming: host._lens ? !!host._lens.forming : null };
    }, { bubble });
    r.gapPct = r.quote && r.lensLast ? +(((r.lensLast - r.quote) / r.quote) * 100).toFixed(3) : null;
    r.matches = r.quote != null && r.lensLast != null && Math.abs(r.lensLast - r.quote) < 1e-6;
    r.at = AT ? new Date(AT).toISOString() : new Date().toISOString(); r.bubble = bubble; r.errs = errs;
    rows.push(r);
  } finally { await browser.close(); }
}
server.close();
const out = JSON.stringify({ at: AT ? opt.at : "now", t: T, rows }, null, 1);
if (opt.out) fs.writeFileSync(opt.out, out);
console.log(out);
