// Headless-only proof rig for the O1 Station fixes lane. Never opens a visible window.
// ROOT = directory served; chart API proxied from Node with Origin https://scintillahub.ai,
// cached on disk so before/after runs see identical data. Non-GET requests are aborted.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const SCR = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
/* APICACHE picks a cache folder: "apicache" holds the 09:20 ET reads the before/after pairs share,
   "apicache-live" the in-session reads taken later */
const CACHE_DIR = path.join(SCR, process.env.APICACHE || "apicache");
fs.mkdirSync(CACHE_DIR, { recursive: true });
// any directory whose node_modules holds playwright-core (this run used the repo's visual-supervisor)
const require = createRequire((process.env.PW_MODULE_DIR || "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor") + "/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

export function serve(root) {
  const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.normalize(path.join(root, clean));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file) && !path.extname(file)) file += "/index.html";
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(fs.readFileSync(file));
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, origin: "http://127.0.0.1:" + server.address().port })));
}

const CACHE = CACHE_DIR;
async function apiFetch(url, replayOnly) {
  const key = crypto.createHash("sha1").update(url).digest("hex");
  const f = path.join(CACHE, key + ".json");
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  if (replayOnly) return { status: 404, body: "{}" };
  const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
  const out = { status: r.status, body: await r.text() };
  if (r.status === 200) fs.writeFileSync(f, JSON.stringify(out));
  return out;
}

export async function open({ root, width = 1680, height = 1050, cpu = 1, replayOnly = false, now = null }) {
  const { server, origin } = await serve(root);
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const stats = { api: 0, blocked: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (req.method() !== "GET") { stats.blocked.push(req.method() + " " + url.slice(0, 90)); return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") {
      stats.api++;
      try {
        const r = await apiFetch(url, replayOnly);
        /* PROOF-ONLY (28 Sep): the live /geiger now carries equalizer d0da9a46…, which the Station's
           provider client does not accept (it pins f6cf97b5…), so every stock's Geiger chip is hidden,
           live too. With GEIGER_ACCEPT=1 this local relay swaps the digest so the chip's PLACEMENT can be
           seen; the composite values are the live API's own. Never used for anything but screenshots. */
        if (process.env.GEIGER_ACCEPT === "1" && /\/geiger/.test(url) && r.body)
          r.body = r.body.replace(/"equalizer_receipt_sha256":"[0-9a-f]{64}"/, '"equalizer_receipt_sha256":"f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1"');
        if (+process.env.LAT) await new Promise((res) => setTimeout(res, +process.env.LAT));
        return route.fulfill({ status: r.status, contentType: "application/json", body: r.body,
          headers: { "access-control-allow-origin": "*" } });
      } catch (e) { return route.abort(); }
    }
    return route.fallback();
  });
  if (process.env.PREFILL) await context.addInitScript(() => {
    if (window.top !== window || localStorage.getItem("__prefilled")) return;
    const pts = []; let d = Date.parse("2020-10-01T20:00:00Z");
    for (let i = 0; i < 1500; i++) { pts.push({ d: new Date(d).toISOString(), p: 100 + Math.sin(i / 9) * 20 + i / 50 }); d += 86400000; }
    const body = JSON.stringify({ ts: Date.now() - 3600e3, pts, asked: 1500 });
    let n = 0;
    try { for (; n < 400; n++) localStorage.setItem("sc_clouds_FAKE" + n, body.replace('"ts":', '"ts":' + (n % 7) + '0+')); } catch (_) {}
    try { localStorage.setItem("__prefilled", String(n)); } catch (_) { localStorage.removeItem("sc_clouds_FAKE0"); localStorage.setItem("__prefilled", String(n)); }
  });
  const page = await context.newPage();
  if (cpu > 1) { const cdp = await context.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu }); page._cdp = cdp; }
  const logs = [];
  page.on("console", (m) => logs.push(m.type() + ": " + m.text()));
  page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message));
  return { browser, context, page, origin, stats, logs, close: async () => { await browser.close(); server.close(); } };
}
