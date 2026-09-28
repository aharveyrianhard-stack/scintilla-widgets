// node fill.mjs <root> <deckPath> [--timeout=ms] [--w=1680]
// Headless only. Measures, from navigation, when every chart pane's RSI fan has a value on every line
// (and the cloud), polling once a second - the "fan fill time" a lap page (~33 s on screen) must beat.
// Use an EMPTY APICACHE folder for a cold read (every bar read live through the proxy, as a first load).
import { open } from "./rig.mjs";
const [root, p, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const r = await open({ root, width: +(opt.w || 1680), height: 1050 });
await r.context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
const t0 = Date.now();
await r.page.goto(r.origin + p);
const limit = +(opt.timeout || 60000);
const firstFull = {};
let panes = [];
while (Date.now() - t0 < limit) {
  panes = [];
  for (const f of r.page.frames().filter((x) => /chart/.test(x.url()))) {
    try { const x = await f.evaluate(() => { const h = document.querySelector("#chartSlot .sc-nchart") || document.querySelector(".sc-nchart");
      if (!h) return null; const d = h._rsiDrawn;
      return { t: h.dataset.t, lines: d ? d.lines.length : 0, empty: d ? d.lines.filter((l) => l.value == null).map((l) => l.key) : ["no fan"],
        cloud: !!(d && d.cloud && d.cloud.lo != null) }; });
      if (x) panes.push(x); } catch (_) {}
  }
  const s = (Date.now() - t0) / 1000;
  for (const p of panes) if (p.lines && !p.empty.length && p.cloud && firstFull[p.t] == null) firstFull[p.t] = s;
  if (panes.length && panes.every((p) => firstFull[p.t] != null)) break;
  await r.page.waitForTimeout(1000);
}
console.log(JSON.stringify({ page: p, cache: process.env.APICACHE || "apicache", seconds: Math.round((Date.now() - t0) / 100) / 10,
  fullBy: firstFull, stillEmpty: panes.filter((p) => firstFull[p.t] == null).map((p) => p.t + ": " + p.empty.join(",") + (p.cloud ? "" : " (no cloud)")) }, null, 1));
await r.close();
