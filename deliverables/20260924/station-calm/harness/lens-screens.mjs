/* M51 · the lens in both modes, at 1680 and 2560. Headless, offline, saved bars. */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const OUT = path.join(ROOT, "deliverables/20260924/station-calm/screens");
fs.mkdirSync(OUT, { recursive: true });
const MIME = { ".html":"text/html; charset=utf-8", ".mjs":"text/javascript; charset=utf-8",
  ".js":"text/javascript; charset=utf-8", ".json":"application/json", ".css":"text/css" };
const srv = http.createServer((q, r) => {
  let rel = decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\/+/, "");
  try { if (fs.statSync(path.join(ROOT, rel)).isDirectory()) rel += "/index.html"; } catch (_) {}
  try { const b = fs.readFileSync(path.join(ROOT, rel));
    r.writeHead(200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream", "cache-control":"no-store" });
    r.end(b); } catch (_) { r.writeHead(404); r.end("no"); }
});
await new Promise((res) => srv.listen(0, "127.0.0.1", res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const PAGE = ORIGIN + "/deliverables/20260924/station-calm/lens/LENS-LIVE.html";
const browser = await playwright.chromium.launch({ headless: true });
const seen = [];
for (const width of [1680, 2560]) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const shot = async (name) => {
    const file = path.join(OUT, `lens-${name}-${width}.png`);
    await page.screenshot({ path: file });
    const info = await page.evaluate(() => ({ label: document.getElementById("lensLabel").textContent,
      span: document.getElementById("lensSpan").textContent,
      readout: document.getElementById("readout").textContent.trim().slice(0, 240),
      main: document.getElementById("mainTag").textContent,
      box: (() => { const r = document.getElementById("lens").getBoundingClientRect();
        const p = document.getElementById("pane").getBoundingClientRect();
        return { x: Math.round(r.x - p.x), y: Math.round(r.y - p.y), w: Math.round(r.width), h: Math.round(r.height),
                 paneW: Math.round(p.width), clearsNewestFifth: Math.round(r.x + r.width) < Math.round(p.width * 0.8) }; })(),
      clip: getComputedStyle(document.getElementById("lens")).clipPath.slice(0, 40) }));
    seen.push({ name, width, ...info });
    console.log(`\n${name} @ ${width}: ${info.label} ${info.span}\n  ${info.main}\n  lens box ${JSON.stringify(info.box)}\n  ${info.readout}`);
  };
  await shot("zoomed-out");                       // 200 bars on screen -> the lens zooms in
  for (let i = 0; i < 4; i++) await page.click("#zoomIn");   // 200 -> 13 bars -> the lens pulls back
  await page.waitForTimeout(200);
  await shot("zoomed-in");
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, "lens-screens.json"), JSON.stringify(seen, null, 1));
await browser.close(); srv.close();
