// node evidence.mjs <root> <tag> <width> <path> [--clock=ISO] [--hover=x,y] [--settle=ms]
import { open } from "./rig.mjs";
const [root, tag, width, p, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const W = +width, H = W < 600 ? 844 : 1050;
const r = await open({ root, width: W, height: H });
if (opt.clock) await r.context.clock.setFixedTime(new Date(opt.clock));
await r.page.goto(r.origin + p);
await r.page.waitForTimeout(+(opt.settle || 14000));
if (opt.hover) { const [x, y] = opt.hover.split(",").map(Number); await r.page.mouse.move(x, y); await r.page.waitForTimeout(600); }
const name = `${tag}-${W}.png`;
await r.page.screenshot({ path: new URL("./shots/" + name, import.meta.url).pathname });
const info = [];
for (const f of [r.page.mainFrame(), ...r.page.frames()]) {
  try { const x = await f.evaluate(() => { const h = document.querySelector(".sc-nchart"); if (!h) return null;
    const st = h.querySelector(".sc-nchart__live-lastbar"), g = h.querySelector(".sc-nchart__live-geiger");
    return `${h.dataset.t} lens=${h.dataset.lensWhy || "-"} stamp="${st ? st.textContent : ""}" geiger=${g && !g.hidden ? "shown" : "none"}`; });
    if (x && !info.includes(x)) info.push(x); } catch (_) {}
}
console.log(name + "\n  " + info.join("\n  "));
await r.close();
