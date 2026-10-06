// LB1 — headless only. node shots.mjs <stationRoot> <outDir> [only=SPY-1D,...]
// The Station is answered from <stationRoot> as https://station.scintillahub.ai; the chart API is fetched by node with the
// scintillahub.ai origin (the only origin it admits) and handed back with CORS relaxed. EVERY non-GET request is aborted
// and counted, so nothing here writes anywhere. Writes <name>.png (1680 wide) and shots.json (what each chart drew:
// reviewed lines on screen, console errors, blocked requests).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const [stationRoot, outDir, onlyArg] = process.argv.slice(2);
const only = onlyArg ? new Set(onlyArg.replace(/^only=/, "").split(",")) : null;
const ST = "https://station.scintillahub.ai";
const SHOTS = [];
for (const t of ["SPY", "QQQ", "NVDA", "MU"]) for (const r of ["1D", "1W"]) SHOTS.push({ name: `${t}-${r}`, url: `${ST}/chart/?t=${t}&range=${r}&clouds=1`, w: 1680, wait: 24000 });
SHOTS.push({ name: "SPY-1D-reviewed-off", url: `${ST}/chart/?t=SPY&range=1D&clouds=1&reviewed=0`, w: 1680, wait: 20000 });
SHOTS.push({ name: "SPY-1D-phone", url: `${ST}/chart/?t=SPY&range=1D&clouds=1`, w: 390, wait: 20000 });
const MIME = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png", webmanifest: "application/manifest+json", woff2: "font/woff2" };
fs.mkdirSync(outDir, { recursive: true });
const report = [];
const browser = await chromium.launch({ executablePath: fs.existsSync(EXE) ? EXE : undefined, headless: true, args: ["--no-sandbox"] });
for (const s of SHOTS) {
  if (only && !only.has(s.name)) continue;
  const H = s.w < 600 ? 844 : 1050, MOBILE = s.w < 600;
  const context = await browser.newContext({ viewport: { width: s.w, height: H }, deviceScaleFactor: 2, isMobile: MOBILE, hasTouch: MOBILE });
  const blocked = [], errors = [];
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { blocked.push(req.method() + " " + u.href); return route.abort(); }
    if (u.host === "scintilla-massive-chart-api.fly.dev") {
      try { const r = await fetch(u.href, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
        return route.fulfill({ status: r.status, contentType: "application/json", body: await r.text(), headers: { "access-control-allow-origin": "*" } }); }
      catch (_) { return route.abort(); }
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
  await context.addInitScript(() => { try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  await page.goto(s.url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(s.wait);
  const drawn = await page.evaluate(() => {
    const hosts = [...document.querySelectorAll("[data-t]")].filter((h) => h._reviewedDrawn !== undefined);
    return hosts.map((h) => ({ t: h.dataset.t, range: h._range || null, bars: h._series ? h._series.length : 0, reviewed: h._reviewedDrawn, on: typeof REVIEWED_ON !== "undefined" ? REVIEWED_ON : null, loaded: typeof REVIEWED_DATA !== "undefined" && !!REVIEWED_DATA }));
  });
  const file = path.join(outDir, `${s.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  report.push({ name: s.name, url: s.url, file, drawn, errors, blocked });
  console.log(s.name, JSON.stringify({ drawn: drawn.map((d) => ({ t: d.t, range: d.range, bars: d.bars, lines: Array.isArray(d.reviewed) ? d.reviewed.length : d.reviewed, loaded: d.loaded })), errors: errors.length, blocked: blocked.length }));
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, "shots.json"), JSON.stringify(report, null, 1));
