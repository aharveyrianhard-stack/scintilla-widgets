// counts canvas readbacks (getImageData) per page load in every chart frame
import { open } from "./rig.mjs";
const [root, p] = process.argv.slice(2);
const r = await open({ root, replayOnly: true });
await r.context.addInitScript(() => { const g = CanvasRenderingContext2D.prototype.getImageData; window.__gid = 0;
  CanvasRenderingContext2D.prototype.getImageData = function (...a) { window.__gid++; return g.apply(this, a); }; });
await r.page.goto(r.origin + p); await r.page.waitForTimeout(15000);
let n = 0, panes = 0; for (const f of r.page.frames()) { if (!/chart-v1/.test(f.url())) continue; panes++; n += await f.evaluate(() => window.__gid || 0); }
console.log(p, "panes", panes, "getImageData calls", n);
await r.close();
