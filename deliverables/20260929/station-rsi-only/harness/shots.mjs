// Headless only. node shots.mjs <root> <outDir> <tag> [only=name,name]
// S3-RSI-ONLY: screenshots of the RSI study at the compact 8-up size (TARGETS · RSI) and as one chart,
// on SPY, an equity target (MU) and BTCUSD; with and without the crosshair. Writes <tag>-<name>.png and
// <tag>-shots.json (what each pane's RSI panel reports it drew: host._rsiDrawn).
import fs from "node:fs";
import path from "node:path";
import { serve, open } from "./rig.mjs";
const [root, outDir, tag, onlyArg] = process.argv.slice(2);
const only = onlyArg ? new Set(onlyArg.replace(/^only=/, "").split(",")) : null;
const SHOTS = [
  { name: "8up-targets-rsi", path: "/deck/index.html?scene=targetsOsc", w: 1680, wait: 26000 },
  { name: "8up-targets-rsi-crop0", path: "/deck/index.html?scene=targetsOsc", w: 1680, wait: 26000, crop: 0 },
  { name: "2up-spy-qqq-day", path: "/deck/index.html?scene=spyQqq1D", w: 1680, wait: 24000 },
  { name: "single-SPY-1D", path: "/chart/index.html?bare=1&t=SPY&range=1D&rsi=auto", w: 1680, wait: 20000 },
  { name: "single-MU-1D", path: "/chart/index.html?bare=1&t=MU&range=1D&rsi=auto", w: 1680, wait: 20000 },
  { name: "single-BTCUSD-1D", path: "/chart/index.html?bare=1&t=BTCUSD&range=1D&rsi=auto", w: 1680, wait: 20000 },
  { name: "single-SPY-1D-hover", path: "/chart/index.html?bare=1&t=SPY&range=1D&rsi=auto", w: 1680, wait: 20000, hover: [0.62, 0.4] },
  { name: "single-SPY-3h", path: "/chart/index.html?bare=1&t=SPY&range=3h&rsi=auto", w: 1680, wait: 22000 },
  { name: "single-SPY-1W", path: "/chart/index.html?bare=1&t=SPY&range=1W&rsi=auto", w: 1680, wait: 22000 },
  { name: "phone-390-spy-qqq", path: "/deck/index.html?scene=spyQqq1D", w: 390, wait: 20000 }
];
const { server, origin } = await serve(path.resolve(root));
const results = [];
try {
  for (const s of SHOTS) {
    if (only && !only.has(s.name)) continue;
    const { browser, context } = await open({ width: s.w });
    try {
      const page = await context.newPage();
      const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
      await page.goto(origin + s.path);
      await page.waitForTimeout(s.wait);
      const hosts = [];
      for (const f of page.frames()) {
        try {
          const r = await f.evaluate(() => {
            const h = document.querySelector(".sc-nchart"); if (!h) return null;
            const fe = window.frameElement;
            if (fe) { const cs = getComputedStyle(fe); if (cs.opacity === "0" || cs.visibility === "hidden" || !fe.offsetWidth || fe.classList.contains("slot-next") || fe.classList.contains("slot-spare")) return null; }
            const a = h.querySelector(".sc-nchart__area").getBoundingClientRect();
            const off = fe ? fe.getBoundingClientRect() : { left: 0, top: 0 };
            return { t: h.dataset.t, range: h._range || S.chartRange, off: [off.left + a.left, off.top + a.top], area: [a.width, a.height],
              plot: h._plot ? { padL: h._plot.padL, iw: h._plot.iw, padT: h._plot.padT, ih: h._plot.ih, start: h._plot.start, end: h._plot.end } : null,
              bars: h._series ? h._series.length : 0, rsi: h._rsiDrawn ? JSON.parse(JSON.stringify(h._rsiDrawn)) : null };
          });
          if (r) hosts.push(r);
        } catch (_) {}
      }
      hosts.sort((a, b) => a.off[1] - b.off[1] || a.off[0] - b.off[0]);
      if (s.hover && hosts[0] && hosts[0].plot) {
        const h = hosts[0], x = h.off[0] + h.plot.padL + h.plot.iw * s.hover[0], y = h.off[1] + h.plot.padT + h.plot.ih * s.hover[1];
        await page.mouse.move(x - 20, y - 10); await page.mouse.move(x, y, { steps: 4 });
        await page.waitForTimeout(800);
        const r = await page.frames()[0].evaluate(() => { const hh = document.querySelector(".sc-nchart"); return hh && hh._rsiDrawn ? JSON.parse(JSON.stringify(hh._rsiDrawn)) : null; });
        hosts[0].rsiHover = r;
      }
      const out = path.join(outDir, `${tag}-${s.name}.png`);
      if (s.crop != null && hosts[s.crop]) {
        const h = hosts[s.crop];
        await page.screenshot({ path: out, clip: { x: Math.max(0, h.off[0] - 4), y: Math.max(0, h.off[1] - 4), width: h.area[0] + 8, height: h.area[1] + 8 } });
      } else await page.screenshot({ path: out });
      results.push({ name: s.name, path: s.path, w: s.w, at: new Date().toISOString(), hosts, errs });
      console.log(s.name, "hosts", hosts.length, "rsi", hosts.filter((h) => h.rsi).length, "errs", errs.length);
    } finally { await browser.close(); }
  }
} finally { server.close(); }
const jf = path.join(outDir, `${tag}-shots.json`);
const prev = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, "utf8")) : [];
const merged = prev.filter((p) => !results.some((r) => r.name === p.name)).concat(results);
fs.writeFileSync(jf, JSON.stringify(merged, null, 1));
