// S10 (2 Oct 2026): the floor plan study, headless.
//   node floorplan.mjs today            today's live deck (/deck/?scene=targets3D, eight charts) at the three screens → today.json, shots/today-<w>x<h>.png
//   node floorplan.mjs measure          every candidate — 3 screens × 3 column widths × 4 chart grids — geometry only, from the mock's
//                                       own window.__floorplan() → plan.json (the study table is built from this file, nothing else)
//   node floorplan.mjs shots [screen]   the pictures: 9- and 4-chart grids at each column width, charts loaded (22 s), plus a crop of the
//                                       X column + YouTube corner → shots/plan-<w>x<h>-col<c>-c<n>.png, shots/corner-<w>x<h>-col<c>.png, shots.json
// Headless only; every non-GET request is aborted; the chart API is fetched by node with the scintillahub.ai origin (the API admits only that
// origin) and handed to the page — the rig from the layout workshop, with the device scale set per screen: the MacBook is a 2× screen,
// the Apple TV and the external are 1× (so their pictures are their real pixels).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../.."), OUT = path.resolve(HERE, "..");
const MODE = process.argv[2] || "measure";
const SCREENS = [["1680x1050", 1680, 1050, 2, "the MacBook"], ["1920x1080", 1920, 1080, 1, "the Apple TV"], ["2560x1440", 2560, 1440, 1, "the external"]]
  .filter((s) => !process.argv[3] || s[0] === process.argv[3]);
const COLS = [220, 260, 300], GRIDS = [2, 4, 6, 9];
async function open(w, h, scale) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
    if (host === "scintilla-massive-chart-api.fly.dev") {
      try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
    }
    return route.fallback();
  });
  await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  const page = await context.newPage(); return { browser, page };
}
const { server, origin } = await serve(ROOT);
const mockUrl = (c, n) => origin + "/deliverables/20261002/station-floorplan-proper/mock-proper.html?col=" + c + "&charts=" + n;
const load = (f) => fs.existsSync(path.join(HERE, f)) ? JSON.parse(fs.readFileSync(path.join(HERE, f), "utf8")) : {};
const save = (f, o) => { const cur = load(f); fs.writeFileSync(path.join(HERE, f), JSON.stringify(Object.assign(cur, o), null, 1)); };   /* merge: three screens may run at once */
if (MODE === "today") {
  const res = load("today.json");
  for (const [key, w, h, scale, name] of SCREENS) {
    const { browser, page } = await open(w, h, scale);
    await page.goto(origin + "/deck/?scene=targets3D"); await page.waitForTimeout(18000);
    const m = await page.evaluate(() => {
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      const vis = (sel) => [...document.querySelectorAll(sel)].filter((p) => getComputedStyle(p).display !== "none");
      const charts = vis("#rowTop > .pane").map(r), bottom = vis("#rowBot > .pane");
      const video = bottom.find((b) => /video/.test(b.className)), xp = bottom.find((b) => b !== video);
      const screen = innerWidth * innerHeight, A = (b) => b ? b.w * b.h : 0;
      const chartsPx = charts.reduce((s, b) => s + A(b), 0), vb = r(video), xb = r(xp);
      /* the YouTube picture inside today's pane: the pane minus the shell's 28 px bar, 16:9 letterboxed — anything beside it is black */
      const pic = vb ? { w: Math.min(vb.w, (vb.h - 28) * 16 / 9), h: vb.h - 28 } : { w: 0, h: 0 };
      const picBlack = vb ? (vb.w - pic.w) * pic.h : 0;
      /* today's seams: the 1 px hairlines of the deck (between the two rows, between the two bottom panes, inside the chart grid 4 × 2) */
      const rt = r(document.getElementById("rowTop")), rb = r(document.getElementById("rowBot"));
      const seams = rt.w + rb.h + 3 * rt.h + 1 * rt.w - 3;
      const unused = screen - chartsPx - A(vb) - A(xb);
      const pct = (px) => +(px / screen * 100).toFixed(1);
      const ri = (b) => b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) } : null;
      return { screen: { w: innerWidth, h: innerHeight, px: screen }, body: document.body.className, rowTopCls: document.getElementById("rowTop").className, chartsN: charts.length,
        chartsBlock: ri(rt), chart0: ri(charts[0]), x: ri(xb), video: ri(vb), picture: { w: Math.round(pic.w), h: Math.round(pic.h) },
        px: { charts: Math.round(chartsPx), chart0: Math.round(A(charts[0])), x: Math.round(A(xb)), video: Math.round(A(vb)), seams: Math.round(seams), unused: Math.round(unused), black: Math.round(unused - seams + picBlack), videoBlackBeside: Math.round(picBlack) },
        share: { charts: pct(chartsPx), chart0: pct(A(charts[0])), x: pct(A(xb)), video: pct(A(vb)), seams: pct(seams), black: pct(unused - seams + picBlack) } };
    });
    res[key] = m; await page.screenshot({ path: path.join(OUT, "shots", "today-" + key + ".png") }); await browser.close();
    console.log("today", key, name, JSON.stringify({ charts: m.chartsN, chart0: m.chart0, x: m.x, video: m.video, share: m.share, px: m.px }));
    save("today.json", res);
  }
} else if (MODE === "measure") {
  const res = {};
  for (const [key, w, h, scale] of SCREENS) {
    const { browser, page } = await open(w, h, scale);
    await page.route("**/station-shells/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><body style='background:#0A0A0F'>" }));
    for (const c of COLS) for (const n of GRIDS) {
      await page.goto(mockUrl(c, n)); await page.waitForTimeout(600);
      const m = await page.evaluate(() => window.__floorplan()); res[`${key}|${c}|${n}`] = m;
      console.log(key, "col", c, "→", m.column.w, "px", "charts", n, m.cols + "×" + m.rows, "chart0", m.chart0.w + "×" + m.chart0.h, "charts%", m.share.charts, "x%", m.share.x, "yt", m.video.w + "×" + m.video.h, m.share.video + "%", "seams", m.px.seams, "black", m.px.black, "flush", JSON.stringify(m.flush), "cpl", m.read.charsPerLine, "lines", m.read.linesPerPostAvg + "/" + m.read.linesPerPostMax, "posts", m.read.postsFully + "/" + m.read.postsPartly);
    }
    await browser.close();
  }
  save("plan.json", res);
} else {
  const res = load("shots.json");
  for (const [key, w, h, scale] of SCREENS) for (const c of COLS) for (const n of [9, 4]) {
    if (process.argv[4] && process.argv[4] !== `col${c}-c${n}`) continue;   /* node floorplan.mjs shots <screen> col300-c4 retakes one picture */
    const { browser, page } = await open(w, h, scale); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
    await page.goto(mockUrl(c, n));
    /* wait until every chart has actually DRAWN (lit pixels on its canvas), up to 90 s — a stalled chart API once left a picture with blank panes */
    const drawn = async () => page.evaluate(() => [...document.querySelectorAll(".pane.chart iframe")].map((f) => { try { const cv = f.contentDocument.querySelector("canvas.sc-nchart__cv"); if (!cv || !cv.width) return 0;
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let lit = 0; for (let i = 0; i < d.length; i += 64) if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; return lit; } catch (e) { return -1; } }));
    let lit = [], t0 = Date.now(); while (Date.now() - t0 < 90000) { await page.waitForTimeout(2000); lit = await drawn(); if (lit.length === n && lit.every((v) => v > 200)) break; }
    await page.waitForTimeout(3000);
    const m = await page.evaluate(() => window.__floorplan()); m.errs = errs; m.chartsDrawn = lit.filter((v) => v > 200).length; m.waitMs = Date.now() - t0; const name = `plan-${key}-col${c}-c${n}`; res[name] = m;
    await page.screenshot({ path: path.join(OUT, "shots", name + ".png") });
    if (n === 9) { /* the corner: the foot of the X column and the YouTube box, with a slice of the chart beside it, so the flush edges show */
      const clip = { x: 0, y: Math.max(0, h - m.video.h - 260), width: Math.min(w, m.column.w + 220), height: Math.min(h, m.video.h + 260) };
      await page.screenshot({ path: path.join(OUT, "shots", `corner-${key}-col${c}.png`), clip });
    }
    console.log(name, "drawn", m.chartsDrawn + "/" + n, "in", m.waitMs, "ms", "charts%", m.share.charts, "black", m.px.black, "beside", m.px.videoBlackBeside, "posts", m.read.postsFully + "/" + m.read.postsPartly, "errs", errs.length);
    await browser.close(); save("shots.json", res);
  }
}
server.close(); process.exit(0);
