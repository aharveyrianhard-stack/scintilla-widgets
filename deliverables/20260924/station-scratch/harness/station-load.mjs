/* M69 · WHAT THE TWO NEW PAGES COST, in CPU-seconds per minute across every browser process.
 *
 * Headless. The same request control as the screenshot harness: the chart API is proxied with
 * the Origin it accepts, the Hub symbol list is stubbed, TradingView is allowed (TO-DO's cost IS
 * its TradingView panes), everything else is aborted.
 *
 * Each run: open the deck at one page, let it settle, then measure the CPU time consumed by the
 * whole browser process tree over a fixed window. Idle cost, not a benchmark of anything clever.
 *
 * usage: node station-load.mjs <root-dir> <label> <scene> [seconds]
 */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.argv[2];
const LABEL = process.argv[3] || "run";
const SCENE = process.argv[4] || "indexNow";
const SECONDS = Number(process.argv[5] || 60);
const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8", ".css":"text/css", ".json":"application/json",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon" };
const srv = http.createServer((q, r) => {
  let rel = decodeURIComponent(new URL(q.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
  try { if (fs.statSync(path.join(ROOT, rel)).isDirectory()) rel += "/index.html"; } catch (_) {}
  try { const b = fs.readFileSync(path.join(ROOT, rel));
    r.writeHead(200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream", "cache-control":"no-store" });
    r.end(b); } catch (_) { r.writeHead(404); r.end("no"); }
});
await new Promise((res) => srv.listen(0, "127.0.0.1", res));
const ORIGIN = `http://127.0.0.1:${srv.address().port}`;
const CATALOGUE = JSON.stringify(["SPY","QQQ","NVDA","MU","AAPL","TSLA","VIX","PCC"].map((t) => ({ ticker:t, type:"equity", cohort:"T" })));

/* EVERY browser process this run owns. playwright-core here does not hand back the browser's
   own pid, so the run's processes are the Chromium processes that did not exist before it
   started - which is also the honest definition for "across all processes". */
function chromiumPids() {
  try {
    return execSync(`ps -Ao pid=,command= | grep -i "[C]hromium" || true`, { encoding: "utf8" })
      .trim().split("\n").filter(Boolean).map((l) => Number(l.trim().split(/\s+/)[0])).filter(Boolean);
  } catch (_) { return []; }
}
/* PER PROCESS, because a renderer that exits mid-window would otherwise take its CPU time out
   of the total and hand back a negative number. A process that appears mid-window counts from
   zero; one that leaves keeps what it had spent when last seen. */
function cpuMap(pids) {
  const map = new Map();
  for (const pid of pids) map.set(pid, cpuSeconds([pid]));
  return map;
}
function cpuDelta(a, b) {
  let total = 0;
  for (const [pid, t] of b) total += t - (a.get(pid) || 0);
  for (const [pid, t] of a) if (!b.has(pid)) total += 0;       /* gone: its last sample is kept, not subtracted */
  return total;
}
function cpuSeconds(pids) {
  let total = 0;
  for (const pid of pids) {
    try {
      const t = execSync(`ps -p ${pid} -o time= || true`, { encoding: "utf8" }).trim();
      if (!t) continue;
      const parts = t.split(/[:.]/).map(Number);           /* mm:ss.cc or hh:mm:ss.cc */
      total += parts.length === 3 ? parts[0] * 60 + parts[1] + parts[2] / 100
             : parts.length === 4 ? parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 100 : 0;
    } catch (_) {}
  }
  return total;
}

const BEFORE_PIDS = new Set(chromiumPids());
const browser = await playwright.chromium.launch({ headless: true });
const ours = () => chromiumPids().filter((pid) => !BEFORE_PIDS.has(pid));
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
await ctx.route("**/*", async (route) => {
  const url = route.request().url();
  if (url.startsWith(ORIGIN)) return route.continue();
  if (url.includes("scintilla-massive-chart-api.fly.dev")) {
    try {
      const up = await fetch(url, { headers: { origin: "https://scintillahub.ai", accept: "application/json" } });
      return route.fulfill({ status: up.status, body: Buffer.from(await up.arrayBuffer()),
        headers: { "content-type": up.headers.get("content-type") || "application/json", "access-control-allow-origin": "*" } });
    } catch (_) { return route.fulfill({ status: 502, body: "proxy failed" }); }
  }
  if (url.includes("/rest/v1/tickers"))
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: CATALOGUE });
  if (url.includes("s.tradingview.com") || url.includes("tradingview-widget.com")) return route.continue();
  return route.abort();
});
const page = await ctx.newPage();
await page.goto(`${ORIGIN}/deck/?scene=${SCENE}`, { waitUntil: "domcontentloaded" });
/* ROTATION OFF for the measurement, or the window measures a slideshow instead of a page. The
   first run of this harness proved the point: a 60 s window starting on INDEX NOW ended on
   INDEX LEADERSHIP, because auto-rotate is on by default. */
await page.waitForTimeout(3000);
await page.evaluate(() => { try { window.setRotationPaused && window.setRotationPaused(true); } catch (_) {} });
await page.waitForTimeout(17000);                     /* settle: charts load, panes mount */

const pids = ours();
const m0 = cpuMap(pids), w0 = Date.now();
await page.waitForTimeout(SECONDS * 1000);
const after = ours();
const m1 = cpuMap(after), w1 = Date.now();
const t1 = cpuDelta(m0, m1), t0 = 0;
const minutes = (w1 - w0) / 60000;
const scene = await page.evaluate(() => document.getElementById("sceneMode")?.value);
const frames = await page.evaluate(() => document.querySelectorAll("iframe").length);
const result = { label: LABEL, scene, asked: SCENE, processes: after.length, frames,
  window_s: Math.round((w1 - w0) / 1000), cpu_s: +(t1 - t0).toFixed(2),
  cpu_s_per_min: +((t1 - t0) / minutes).toFixed(2) };
console.log(JSON.stringify(result));
await browser.close(); srv.close();
