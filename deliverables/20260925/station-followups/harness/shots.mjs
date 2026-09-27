/* S1 follow-ups: headless screenshots + the SAVE AS RADAR write capture.
   node shots.mjs <root> <outDir> [only] */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const [ROOT, OUT, ONLY] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const CACHE_FILE = path.join(HERE, "api-cache.json");
const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) : {};
const writes = [], refused = new Set(), report = {};
const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png" };
function serve(root, extra) {
  const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (extra && extra[clean]) { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(extra[clean]()); return; }
    let file = path.normalize(path.join(root, clean));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}
const station = await serve(ROOT);
const SORIGIN = "http://127.0.0.1:" + station.address().port;
/* a stand-in for the Hub's company CHART tab: its timeframe row above the embedded pane, served
   from ANOTHER origin (localhost vs 127.0.0.1) so the pane is a cross-site frame as on the Hub */
let HUB_SRC = "";
const hubMock = await serve(HERE, { "/hub.html": () => `<!doctype html><html><head><style>
  body{margin:0;background:#0b0c11;color:#b8bcc8;font:11px Menlo,monospace}
  .bar{display:flex;gap:4px;align-items:center;padding:6px 10px;border-bottom:1px solid #1f2230}
  .bar b{padding:3px 8px;border:1px solid #2a2e3c;border-radius:3px;color:#9aa0b0;font-weight:400}.bar b.on{color:#d0d4dc;border-color:#4a5066}
  .bar span{margin-left:auto;color:#6c7080}
  iframe{display:block;width:100%;height:calc(100vh - 34px);border:0}
  </style></head><body><div class="bar"><b>1h</b><b>4h</b><b class="on">1D</b><b>3D</b><b>1W</b><span>station chart · NVDA (stand-in for the Hub's company CHART tab)</span></div>
  <iframe src="${HUB_SRC}" referrerpolicy="no-referrer"></iframe></body></html>` });
const HORIGIN = "http://localhost:" + hubMock.address().port;

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
async function ctx(viewport, clockIso) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => { try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
  await context.route("**/*", async (route) => {
    const req = route.request(); const url = req.url(); const host = new URL(url).host;
    if (host.startsWith("127.0.0.1") || host.startsWith("localhost")) return route.fallback();
    if (host === "scintilla-massive-chart-api.fly.dev") {
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      let hit = /\/quotes|\/quote|\/last/.test(url) ? null : cache[url];
      if (!hit) {
        try { const r = await fetch(url, { headers: { Origin: "https://scintillahub.ai" } }); hit = { status: r.status, body: await r.text() };
          if (r.status === 200 && !/\/quotes|\/quote|\/last/.test(url)) cache[url] = hit; }
        catch (_) { return route.fulfill({ status: 503, headers: CORS, body: "{}" }); }
      }
      return route.fulfill({ status: hit.status, headers: { ...CORS, "content-type": "application/json" }, body: hit.body });
    }
    if (host === "wadinxqplrggagkvrdag.supabase.co") {
      const m = req.method();
      if (m === "GET" || m === "HEAD") return route.continue();
      if (m === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      writes.push({ method: m, url: url.replace(/^https:\/\/[^/]+/, ""), prefer: req.headers()["prefer"] || "", body: req.postData() || "" });
      return route.fulfill({ status: 201, headers: { ...CORS, "content-type": "application/json" }, body: "[]" });
    }
    if (/fonts\.(googleapis|gstatic)\.com$/.test(host)) return route.continue();
    refused.add(host); return route.abort();
  });
  const page = await context.newPage();
  if (clockIso) await page.clock.setFixedTime(new Date(clockIso));
  return { context, page };
}
const shot = (page, name, full) => page.screenshot({ path: path.join(OUT, name), type: "jpeg", quality: 80, fullPage: !!full });
const stamps = (page) => page.evaluate(() => {
  const out = [];
  for (const f of document.querySelectorAll("iframe")) {
    try { for (const s of f.contentDocument.querySelectorAll(".sc-nchart__live-lastbar"))
      out.push((f.contentDocument.querySelector(".sc-nchart")?.dataset.t || "?") + " | " + s.textContent + " | stale=" + s.dataset.stale); } catch (_) {}
  }
  return out;
});
const want = (k) => !ONLY || ONLY.split(",").includes(k);

if (want("desk")) {
  const { context, page } = await ctx({ width: 1680, height: 1050 });
  await page.goto(SORIGIN + "/deck/?scene=targets1D"); await page.waitForTimeout(9000);
  await shot(page, "desk-targets-1680.jpg"); report.deskStamps = await stamps(page);
  await context.close();
}
if (want("stale")) {
  /* the clock is fixed at Monday 28 Sep 10:00 ET; the bars are Friday's real bars */
  const { context, page } = await ctx({ width: 1680, height: 1050 }, "2026-09-28T14:00:00Z");
  await page.goto(SORIGIN + "/deck/?scene=intraday4h"); await page.waitForTimeout(10000);
  await shot(page, "stale-monday-1680.jpg"); report.staleStamps = await stamps(page);
  const f = page.frames().find((fr) => /\/chart\//.test(fr.url()) && fr !== page.mainFrame());
  if (f) { const el = await f.$(".sc-nchart__live"); if (el) await el.screenshot({ path: path.join(OUT, "stale-badge-zoom.jpg"), type: "jpeg", quality: 90 }); }
  await context.close();
}
if (want("phone")) {
  const { context, page } = await ctx({ width: 390, height: 844 });
  await page.goto(SORIGIN + "/deck/?scene=targets1D"); await page.waitForTimeout(9000);
  await shot(page, "phone-targets-390.jpg"); await shot(page, "phone-targets-390-full.jpg", true);
  report.phoneStamps = await stamps(page);
  report.phonePanes = await page.evaluate(() => PANES.filter((p) => p.def.kind === "chart" && p.def.ticker).map((p) =>
    p.def.ticker + ":" + (p.frame ? "live" : (p.body.querySelector(".card")?.textContent || "none").slice(0, 40))));
  await context.close();
}
if (want("hub")) {
  for (const [vp, tag] of [[{ width: 1680, height: 760 }, "1680"], [{ width: 390, height: 640 }, "390"]]) {
    for (const bare of ["", "bare=hub&"]) {
      HUB_SRC = SORIGIN + "/chart/?" + bare + "t=NVDA&range=1D&clouds=1";
      const { context, page } = await ctx(vp);
      const posts = [];
      await page.exposeFunction("__post", (m) => posts.push(m));
      await page.addInitScript(() => addEventListener("message", (e) => { try { window.__post && window.__post(JSON.stringify(e.data).slice(0, 80)); } catch (_) {} }));
      await page.goto(HORIGIN + "/hub.html"); await page.waitForTimeout(8000);
      const name = "hub-" + (bare ? "after" : "before") + "-" + tag + ".jpg";
      await shot(page, name);
      const fr = page.frames().find((x) => x !== page.mainFrame());
      const info = fr ? await fr.evaluate(() => ({ cls: document.documentElement.className,
        barShown: !!document.querySelector(".sc-nchart__bar") && getComputedStyle(document.querySelector(".sc-nchart__bar")).display !== "none",
        badge: document.querySelector(".sc-nchart__live")?.textContent || "", fresh: document.querySelector(".sc-nchart__live")?.dataset.fresh,
        clouds: !!document.querySelector(".sc-nchart")?._cloudRows, series: document.querySelector(".sc-nchart")?._series?.length || 0,
        storage: (() => { try { return Object.keys(localStorage); } catch (_) { return "blocked"; } })() })) : null;
      if (bare && fr) { await page.waitForTimeout(11000); info.badgeAfter11s = await fr.evaluate(() => document.querySelector(".sc-nchart__live")?.textContent || ""); }
      report[name] = { ...info, messagesToParent: posts.slice(0, 5), src: HUB_SRC.replace(SORIGIN, "") };
      await context.close();
    }
  }
}
if (want("radar")) {
  const { context, page } = await ctx({ width: 1680, height: 1050 });
  await page.goto(SORIGIN + "/deck/?scene=scratch"); await page.waitForTimeout(5000);
  const names = ["NVDA", "LRCX", "ZETA"];
  await page.evaluate((names) => { names.forEach((n, i) => { const inp = el("t" + (i + 1)); inp.value = n; commitTicker(i, n, inp); }); }, names);
  await page.waitForTimeout(2500);
  const before = writes.length;
  await page.evaluate(() => { revealDock(); el("saveRadar").click(); revealDock(); });
  let text = "";
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(150); text = await page.locator("#saveRadar").textContent(); if (text !== "save as radar") break; }
  await page.waitForTimeout(400); text = await page.locator("#saveRadar").textContent();
  await page.evaluate(() => revealDock()); await page.waitForTimeout(300);
  await shot(page, "radar-receipt-1680.jpg");
  const bar = await page.locator("#saveRadar").boundingBox();
  if (bar) await page.screenshot({ path: path.join(OUT, "radar-receipt-zoom.jpg"), type: "jpeg", quality: 90,
    clip: { x: Math.max(0, bar.x - 420), y: Math.max(0, bar.y - 14), width: Math.min(900, 1680 - Math.max(0, bar.x - 420)), height: bar.height + 28 } });
  report.radar = { names, button: text, writes: writes.slice(before) };
  await context.close();
}
fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify({ report, allWrites: writes, refused: [...refused] }, null, 1));
fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
await browser.close(); station.close(); hubMock.close();
console.log(JSON.stringify({ report, refused: [...refused] }, null, 1).slice(0, 6000));
