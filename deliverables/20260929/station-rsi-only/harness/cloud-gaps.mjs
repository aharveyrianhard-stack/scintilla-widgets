// Headless only. node cloud-gaps.mjs <root> <ticker> [range]: which of the cloud's four sources is empty where the cloud is hidden.
import path from "node:path";
import { serve, open } from "./rig.mjs";
const [root, t, range = "1D"] = process.argv.slice(2);
const { server, origin } = await serve(path.resolve(root));
const { browser, context } = await open({ width: 1680 });
try {
  const page = await context.newPage();
  await page.goto(`${origin}/chart/index.html?bare=1&t=${t}&range=${range}&rsi=auto`);
  await page.waitForTimeout(20000);
  const r = await page.evaluate(() => {
    const h = document.querySelector(".sc-nchart"), m = h._rsiMemo, pts = h._series;
    const out = { bars: pts.length, hidden: 0, byPart: {}, sample: [] };
    for (let i = h._plot.start; i < pts.length; i++) {
      if (m.cloud.band[i]) continue;
      out.hidden++;
      const miss = m.cloud.parts.filter((p) => !p.values || p.values[i] == null).map((p) => p.key);
      for (const k of miss) out.byPart[k] = (out.byPart[k] || 0) + 1;
      if (out.sample.length < 8) out.sample.push(pts[i].d.slice(0, 10) + " " + new Date(pts[i].d).getUTCDay() + " " + miss.join("/"));
    }
    const c3 = rsiSourceCache.get(h.dataset.t + "|3D"), w = rsiSourceCache.get(h.dataset.t + "|1W");
    out.src3D = c3 ? c3.bars.slice(-6).map((b) => new Date(b.t).toISOString().slice(0, 13)) : null;
    out.src1W = w ? w.bars.slice(-4).map((b) => new Date(b.t).toISOString().slice(0, 13)) : null;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
} finally { await browser.close(); server.close(); }
