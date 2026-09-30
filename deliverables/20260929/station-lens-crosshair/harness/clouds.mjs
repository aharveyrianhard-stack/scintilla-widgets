// Headless only. node clouds.mjs <root> <out.json> [--runs=3] [--wait=16000] [--scenes=a,b]
// Per scene, in a COLD browser (empty storage): for every visible chart pane, when its price first painted,
// when its cloud ribbon first arrived (ms after navigation), how many times the ribbon was replaced after
// that (a redraw the eye sees), and every chart-API read the page made (daily reads counted per ticker).
import fs from "node:fs";
import { serve, open } from "./rig.mjs";
const [root, outFile, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const SCENES = ["wkIndexes","wkMacro","targets3D","sectors3D","mainIndexes3D","mag7","ai1","ai2","ai3","other3D","blueChip3D",
  "spyQqq1D","otherIndexes1D","otherIndexesOsc","macro1D","targets1D","targetsOsc","macroIntraday","intraday4h","intraday1h","intraday30m",
  "scintillas","companyLeadership","focus2","macroCrossAsset","internalsFast","todo"];
const list = opt.scenes ? opt.scenes.split(",") : SCENES;
const RUNS = +(opt.runs || 3), WAIT = +(opt.wait || 16000);
const { server, origin } = await serve(root);
const result = [];
const probe = () => {
  const t0 = performance.timeOrigin;
  const M = window.__m = { price: null, cloud: null, swaps: 0, t: null, rows: null };
  const tick = () => {
    const h = document.querySelector(".sc-nchart");
    if (h) {
      const now = performance.timeOrigin + performance.now();
      if (M.t !== h.dataset.t) { M.t = h.dataset.t; M.price = null; M.cloud = null; M.swaps = 0; M.rows = null; }
      if (M.price == null && h._plot && h._series && h._series.length > 1) M.price = now;
      if (h._cloudRows && h._cloudTicker === h.dataset.t) {
        if (M.cloud == null) M.cloud = now;
        else if (h._cloudRows !== M.rows) M.swaps++;
        M.rows = h._cloudRows;
      }
    }
    setTimeout(tick, 50);
  };
  tick();
};
for (let run = 1; run <= RUNS; run++) {
  for (const scene of list) {
    const log = [];
    const { browser, context } = await open({ width: 1680, log });
    await context.addInitScript(probe);
    try {
      const page = await context.newPage();
      const nav = Date.now();
      await page.goto(`${origin}/deck/index.html?scene=${scene}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(WAIT);
      const panes = [];
      for (const f of page.frames()) {
        try {
          const r = await f.evaluate(() => {
            const h = document.querySelector(".sc-nchart"); if (!h || !window.__m) return null;
            const fe = window.frameElement;
            if (fe) { const cs = getComputedStyle(fe); if (cs.opacity === "0" || cs.visibility === "hidden" || !fe.offsetWidth || fe.classList.contains("slot-next") || fe.classList.contains("slot-spare")) return null; }
            return { t: h.dataset.t, range: S.chartRange, clouds: CLOUDS_ON, price: window.__m.price, cloud: window.__m.cloud, swaps: window.__m.swaps, absence: h._cloudAbsence || null };
          });
          if (r) panes.push({ ...r, priceMs: r.price ? Math.round(r.price - nav) : null, cloudMs: r.cloud ? Math.round(r.cloud - nav) : null });
        } catch (_) {}
      }
      const daily = log.filter((x) => /tf=D&/.test(x.url));
      const perTicker = {};
      for (const d of daily) { const s = new URL("http://x" + d.url).searchParams.get("symbol"); (perTicker[s] = perTicker[s] || []).push({ limit: +new URL("http://x" + d.url).searchParams.get("limit"), ms: d.ms, at: d.at - nav }); }
      const row = { run, scene, panes: panes.map(({ price, cloud, ...p }) => p), reads: log.length, dailyReads: daily.length,
        dailyPerTicker: perTicker, slowestDailyMs: daily.reduce((m, d) => Math.max(m, d.ms), 0) };
      const cl = row.panes.filter((p) => p.clouds).map((p) => p.cloudMs);
      row.cloudLastMs = cl.length && cl.every((x) => x != null) ? Math.max(...cl) : null;
      row.cloudMissing = row.panes.filter((p) => p.clouds && p.cloudMs == null).map((p) => p.t);
      row.swaps = row.panes.reduce((a, p) => a + p.swaps, 0);
      row.lateVsPrice = Math.max(0, ...row.panes.filter((p) => p.cloudMs != null && p.priceMs != null).map((p) => p.cloudMs - p.priceMs));
      result.push(row);
      console.log(`run ${run} ${scene.padEnd(18)} panes ${row.panes.length}  cloud-last ${row.cloudLastMs}ms  worst cloud-after-price ${row.lateVsPrice}ms  swaps ${row.swaps}  D reads ${row.dailyReads} (slowest ${row.slowestDailyMs}ms)  missing [${row.cloudMissing}]`);
    } finally { await browser.close(); }
  }
}
server.close();
fs.writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), root, runs: RUNS, wait: WAIT, result }, null, 1));
