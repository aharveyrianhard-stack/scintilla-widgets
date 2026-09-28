// node frames.mjs <root> <deckPath> [--w=390]: headless; prints each chart frame's address and whether its RSI panel drew
import { open } from "./rig.mjs";
const [root, p, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const W = +(opt.w || 390);
const r = await open({ root, width: W, height: W < 600 ? 844 : 1050 });
await r.context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
await r.page.goto(r.origin + p); await r.page.waitForTimeout(+(opt.settle || 15000));
for (const f of r.page.frames().filter((f) => /chart/.test(f.url()))) {
  const u = new URL(f.url()); let drawn = null;
  try { drawn = await f.evaluate(() => { const h = document.querySelector(".sc-nchart"); return h && h._rsiDrawn ? h._rsiDrawn.lines.length : 0; }); } catch (_) {}
  console.log(u.searchParams.get("t"), "rsi=" + u.searchParams.get("rsi"), "view=" + u.searchParams.get("view"), "fanLines=" + drawn);
}
await r.close();
