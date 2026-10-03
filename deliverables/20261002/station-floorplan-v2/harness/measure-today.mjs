// S9 (2 Oct 2026): measure TODAY's live Station deck headless, like a floor plan, at the three screens Alan named in the S9
// brief — 1680×1050 (the MacBook), 2560×1440 (its external) and 1920×1080 (the Apple TV). Serves this worktree (deck layout =
// live 6069a35) and opens /deck/?scene=targets3D (the eight-chart wall), reads the boxes of the dock, the chart row, every chart
// pane, the video pane and the X pane, and writes measure-today.json and shots/today-<w>x<h>.png.
// Headless only; every non-GET request is aborted by the rig (S8's measure-today.mjs, re-pointed at the S9 screens).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { serve, open } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const OUT = path.resolve(HERE, "..");
const SIZES = process.argv[2] ? [process.argv[2].split("x").map(Number)] : [[1680, 1050], [2560, 1440], [1920, 1080]];
const SCENE = process.argv[3] || "targets3D";
const { server, origin } = await serve(ROOT);
const jf = path.join(HERE, "measure-today.json");
const res = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, "utf8")) : {};
for (const [w, h] of SIZES) {
  const { browser, context } = await open({ width: w });
  const page = await context.newPage(); await page.setViewportSize({ width: w, height: h });
  const t0 = Date.now();
  await page.goto(origin + "/deck/?scene=" + SCENE); await page.waitForTimeout(18000);
  const m = await page.evaluate(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const panes = (sel) => [...document.querySelectorAll(sel)].filter((p) => getComputedStyle(p).display !== "none")
      .map((p) => ({ cls: p.className, title: (p.querySelector(".ph .t") || {}).textContent, box: r(p), body: r(p.querySelector(".body")) }));
    const bottom = panes("#rowBot > .pane");
    const video = bottom.find((b) => /video/.test(b.cls)) || bottom[0] || null;
    return { vw: innerWidth, vh: innerHeight, body: document.body.className, dock: r(document.getElementById("dock")), grid: r(document.getElementById("grid")),
      rowTop: r(document.getElementById("rowTop")), rowTopCls: (document.getElementById("rowTop") || {}).className, rowBot: r(document.getElementById("rowBot")),
      charts: panes("#rowTop > .pane"), bottom, video, x: bottom.find((b) => b !== video) || null };
  });
  m.loadMs = Date.now() - t0;
  const px = (b) => (b ? b.w * b.h : 0);
  const screen = w * h;
  const chartsPx = px(m.rowTop), videoPx = px(m.video && m.video.box), xPx = px(m.x && m.x.box);
  m.floor = { screen, charts: chartsPx, video: videoPx, x: xPx, chrome: Math.max(0, screen - chartsPx - videoPx - xPx),
    share: { charts: +(chartsPx / screen).toFixed(3), video: +(videoPx / screen).toFixed(3), x: +(xPx / screen).toFixed(3), chrome: +(Math.max(0, screen - chartsPx - videoPx - xPx) / screen).toFixed(3) },
    chart0: m.charts[0] ? m.charts[0].box : null, chartsOnWall: m.charts.length };
  res[w + "x" + h] = m;
  await page.screenshot({ path: path.join(OUT, "shots", `today-${w}x${h}.png`) });
  await browser.close();
  console.log(w + "x" + h, JSON.stringify({ body: m.body, rowTop: m.rowTop, rowBot: m.rowBot, charts: m.charts.length, chart0: m.floor.chart0, video: m.video && m.video.box, x: m.x && m.x.box, floor: m.floor }));
  fs.writeFileSync(jf, JSON.stringify(res, null, 1));
}
server.close(); process.exit(0);
