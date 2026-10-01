// W1: measure today's live Station layout headless. Serves this worktree (= live 75e653c) and
// opens /deck/ at several sizes; reads the boxes of the dock, the chart row, the video pane and
// the X pane, and what is inside the video pane. Writes measure.json and a screenshot per size.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { serve, open } from "./rig.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZES = [[1680,1050],[2560,1440],[1024,768],[390,844]];
const { server, origin } = await serve(ROOT);
const res = {};
for (const [w,h] of SIZES) {
  const { browser, context } = await open({ width: w });
  const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
  const t0 = Date.now();
  await page.goto(origin + "/deck/?scene=indexNow"); await page.waitForTimeout(16000);
  const m = await page.evaluate(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const panes = (sel) => [...document.querySelectorAll(sel)].filter(p => getComputedStyle(p).display !== "none").map(p => ({ cls: p.className, title: p.querySelector(".ph .t")?.textContent?.trim(), box: r(p), body: r(p.querySelector(".body")) }));
    return { vw: innerWidth, vh: innerHeight, body: document.body.className, dock: r(document.getElementById("dock")), grid: r(document.getElementById("grid")),
      rowTop: r(document.getElementById("rowTop")), rowTopCls: document.getElementById("rowTop")?.className, rowBot: r(document.getElementById("rowBot")),
      charts: panes("#rowTop > .pane"), bottom: panes("#rowBot > .pane") };
  });
  // inside the video frame: the shell's one chrome bar and the grid / stage
  const vid = {}; for (const f of page.frames()) { if (!(f.url().includes("/station-shells/") && /video-v1/.test(f.url()))) continue;
    try { Object.assign(vid, await f.evaluate(() => { const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      const cards = [...document.querySelectorAll(".card, .thumb")]; return { url: location.pathname + location.search, bar: r(document.querySelector("#bar, .bar, header")), grid: r(document.getElementById("grid")), stage: r(document.getElementById("stage")), video: r(document.getElementById("video")), thumbs: cards.length, thumb0: r(cards[0]) }; })); } catch (e) { vid.err = String(e); } }
  const x = {}; for (const f of page.frames()) { if (!/x-v2/.test(f.url())) continue;
    try { Object.assign(x, await f.evaluate(() => { const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      return { url: location.pathname + location.search, host: r(document.getElementById("host") || document.querySelector("canvas")?.parentElement), canvas: r(document.querySelector("canvas")), card: (document.getElementById("card")?.innerText || "").slice(0, 120) }; })); } catch (e) { x.err = String(e); } }
  m.video = vid; m.x = x; m.loadMs = Date.now() - t0;
  res[w + "x" + h] = m;
  await page.screenshot({ path: path.join(OUT, "shots", `today-${w}x${h}.png`) });
  await browser.close();
  console.log(w + "x" + h, JSON.stringify({ body: m.body, botCls: m.bottom.map(b => b.cls), dock: m.dock, rowTop: m.rowTop, rowBot: m.rowBot, charts: m.charts.length, bottom: m.bottom.map(b => [b.title, b.box]), video: m.video, x: m.x }));
}
fs.writeFileSync(path.join(OUT, "harness", "measure.json"), JSON.stringify(res, null, 1));
server.close(); process.exit(0);
