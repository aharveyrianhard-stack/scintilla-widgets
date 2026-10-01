// W1: open a video in the pane and measure the box the picture gets (the 16:9 letterbox inside it is YouTube's).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { serve, open } from "./rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(HERE, "../../../.."); const OUT = path.resolve(HERE, "..");
const { server, origin } = await serve(ROOT); const res = {};
for (const [w,h] of [[1680,1050],[2560,1440]]) {
  const { browser, context } = await open({ width: w }); const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
  await page.goto(origin + "/deck/?scene=indexNow"); await page.waitForTimeout(14000);
  const vf = page.frames().find(f => f.url().includes("/station-shells/") && /video-v1/.test(f.url()));
  await vf.evaluate(() => { const c = document.querySelector(".card, .thumb"); c && c.click(); }); await page.waitForTimeout(5000);
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const inner = await vf.evaluate(`(${r.toString()})` + `(document.getElementById("video"))`);
  const outer = await page.evaluate(() => [...document.querySelectorAll("#rowBot > .pane")].filter(p => getComputedStyle(p).display !== "none").map(p => { const b = p.getBoundingClientRect(); return { title: p.querySelector(".ph .t")?.textContent?.trim(), cls: p.className, w: Math.round(b.width), h: Math.round(b.height) }; }));
  const pic = inner ? { w: Math.min(inner.w, Math.round(inner.h * 16 / 9)), h: Math.min(inner.h, Math.round(inner.w * 9 / 16)) } : null;
  res[w + "x" + h] = { videoBox: inner, picture: pic, blackEachSide: inner && pic ? Math.round((inner.w - pic.w) / 2) : null, panes: outer };
  await page.screenshot({ path: path.join(OUT, "shots", `today-playing-${w}x${h}.png`) });
  console.log(w + "x" + h, JSON.stringify(res[w + "x" + h])); await browser.close();
}
fs.writeFileSync(path.join(HERE, "play.json"), JSON.stringify(res, null, 1)); server.close(); process.exit(0);
