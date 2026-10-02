// S8 (2 Oct 2026) — headless only. node lens-shots.mjs <stationRoot> <outDir> <tag> [only=a,b]
// Serves <stationRoot> as https://station.scintillahub.ai; the chart API is fetched by node with the scintillahub.ai origin (the
// only origin it admits) and handed back with CORS relaxed; EVERY non-GET request is aborted, so nothing here writes anywhere.
// Opens the deck on TARGETS (3-day) and INTRADAY · 1H at 1680×1000 and at 390×844, waits for every visible chart's lens, reads
// each pane's lens record (shape, spot, pixels covered, the oval's axes) and writes <tag>-<name>.png (the wall),
// <tag>-<name>-pane.png (the first pane with a lens, at 2×), <tag>-<name>-lens.png (the lens itself, close) and <tag>-lens.json.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [stationRoot, outDir, tag, onlyArg] = process.argv.slice(2);
const only = onlyArg ? new Set(onlyArg.replace(/^only=/, "").split(",")) : null;
const ST = "https://station.scintillahub.ai";
const SHOTS = [
  { name: "targets3D-1680", url: ST + "/deck/index.html?scene=targets3D", w: 1680, h: 1000 },
  { name: "intraday1h-1680", url: ST + "/deck/index.html?scene=intraday1h", w: 1680, h: 1000 },
  { name: "targets3D-390", url: ST + "/deck/index.html?scene=targets3D", w: 390, h: 844 },
  { name: "intraday1h-390", url: ST + "/deck/index.html?scene=intraday1h", w: 390, h: 844 },
];
const MIME = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png", webmanifest: "application/json" };
let blocked = 0;
async function open(width, height) {
  const MOBILE = width < 600;
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: MOBILE, hasTouch: MOBILE });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { blocked++; return route.abort(); }
    if (u.host === "scintilla-massive-chart-api.fly.dev") {
      try {
        const r = await fetch(u.href, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
        return route.fulfill({ status: r.status, contentType: "application/json", body: await r.text(), headers: { "access-control-allow-origin": "*" } });
      } catch (_) { return route.abort(); }
    }
    if (u.host === "station.scintillahub.ai") {
      let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
      let f = path.join(stationRoot, p);
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(f), headers: { "cache-control": "no-store" } });
      return route.fulfill({ status: 404, body: "nf" });
    }
    return route.continue();
  });
  await context.addInitScript(() => { if (window.top !== window) return; try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  return { browser, context };
}
/* every visible chart pane: its box, its plot and its lens record */
async function dump(page) {
  const hosts = [];
  for (const f of page.frames()) {
    try {
      const r = await f.evaluate(() => {
        const h = document.querySelector("#chartSlot .sc-nchart"); if (!h) return null;
        const fe = window.frameElement; let off = { left: 0, top: 0 };
        if (fe) { try { const cs = getComputedStyle(fe); if (cs.opacity === "0" || cs.visibility === "hidden" || !fe.offsetWidth || fe.classList.contains("slot-next") || fe.classList.contains("slot-spare")) return null; off = fe.getBoundingClientRect(); } catch (_) {} }
        const a = h.querySelector(".sc-nchart__area").getBoundingClientRect();
        const L = h._lens, cv = h.querySelector(".sc-nchart__lens");
        return { t: h.dataset.t, range: h._range, url: location.pathname + location.search, frameOffset: [off.left, off.top], area: [a.left, a.top, a.width, a.height],
          plot: h._plot ? { padL: h._plot.padL, iw: h._plot.iw, padT: h._plot.padT, ih: h._plot.ih } : null, bars: h._series ? h._series.length : 0,
          lensWhy: h.dataset.lensWhy || null, lensShape: h.dataset.lensShape || null, lensState: h.dataset.lensState || null, canvasShown: !!(cv && cv.style.display !== "none"),
          lens: L ? { shape: L.shape || "box", key: L.key, spot: L.spot && [L.spot.x, L.spot.y, L.spot.w, L.spot.h], covered: L.covered, boxCovered: L.boxCovered, oval: L.oval || null,
            why: L.why, stale: L.stale, bars: L.bars, sessions: L.sessions, forming: L.forming, last: L.last } : null };
      });
      if (r) hosts.push(r);
    } catch (_) {}
  }
  hosts.sort((a, b) => (a.frameOffset[1] + a.area[1]) - (b.frameOffset[1] + b.area[1]) || (a.frameOffset[0] + a.area[0]) - (b.frameOffset[0] + b.area[0]));
  return hosts;
}
const results = [];
for (const s of SHOTS) {
  if (only && !only.has(s.name)) continue;
  const { browser, context } = await open(s.w, s.h);
  try {
    const page = await context.newPage();
    const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
    const t0 = Date.now();
    await page.goto(s.url);
    await sleep(20000);
    let hosts = await dump(page);
    /* every pane has either a lens or a reason, and at least one lens is drawn: up to 50 s more */
    for (let i = 0; i < 100; i++) {
      const settled = hosts.length && hosts.every((h) => h.lens || h.lensWhy) && hosts.some((h) => h.lens && h.canvasShown);
      if (settled) break;
      await sleep(500); hosts = await dump(page);
    }
    await sleep(1500); hosts = await dump(page);
    await page.screenshot({ path: path.join(outDir, `${tag}-${s.name}.png`), fullPage: s.w < 600 });
    const pick = hosts.find((h) => h.lens && h.canvasShown);
    if (pick) {
      const ax = pick.frameOffset[0] + pick.area[0], ay = pick.frameOffset[1] + pick.area[1];
      await page.screenshot({ path: path.join(outDir, `${tag}-${s.name}-pane.png`), clip: { x: Math.max(0, ax - 2), y: Math.max(0, ay - 2), width: pick.area[2] + 4, height: pick.area[3] + 4 } });
      const [lx, ly, lw, lh] = pick.lens.spot;
      await page.screenshot({ path: path.join(outDir, `${tag}-${s.name}-lens.png`), clip: { x: Math.max(0, ax + lx - 36), y: Math.max(0, ay + ly - 30), width: lw + 72, height: lh + 60 } });
    }
    results.push({ name: s.name, url: s.url, w: s.w, h: s.h, at: new Date().toISOString(), ms: Date.now() - t0, hosts, errs, pickedPane: pick ? pick.t : null });
    console.log(s.name, "panes", hosts.length, "lenses", hosts.filter((h) => h.lens).length,
      hosts.map((h) => h.t + ":" + (h.lens ? h.lens.shape + "/" + h.lens.covered + "px²" + (h.lens.oval ? "/" + Math.round(h.lens.oval.long) + "x" + Math.round(h.lens.oval.short) + "@" + (h.lens.oval.theta * 180 / Math.PI).toFixed(0) + "°" : "") : "none(" + (h.lensWhy || "?") + ")")).join(" "), "errs", errs.length, "blocked-writes", blocked);
  } finally { await browser.close(); }
}
const jf = path.join(outDir, `${tag}-lens.json`);
const prev = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, "utf8")) : [];
fs.writeFileSync(jf, JSON.stringify(prev.filter((p) => !results.some((r) => r.name === p.name)).concat(results), null, 1));
console.log("blocked non-GET requests:", blocked);
