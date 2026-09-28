// Pre-deploy reviewer rig. Headless only. Live chart API (no cache), real clock.
// node pd.mjs <root> <deckPath> <seconds> <outPrefix> [--w=1680] [--cpu=1] [--pauseLap=1] [--hover=c7] [--fast=1]
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const [root, deckPath, secs, outPrefix, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const W = +(opt.w || 1680), H = W < 600 ? 844 : 1050, MOBILE = W < 600;

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
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: MOBILE, hasTouch: MOBILE });
const net = { api: 0, apiFail: [], failed: [], bad: [], blocked: [], hosts: {} };
await context.route("**/*", async (route) => {
  const req = route.request(), url = req.url(), host = new URL(url).host;
  net.hosts[host] = (net.hosts[host] || 0) + 1;
  if (host.startsWith("127.0.0.1")) return route.fallback();
  if (req.method() !== "GET" && req.method() !== "HEAD" && req.method() !== "OPTIONS") { net.blocked.push(req.method() + " " + url.slice(0, 120)); return route.abort(); }
  if (host === "scintilla-massive-chart-api.fly.dev") {
    net.api++; (net.apiUrls = net.apiUrls || []).push([Date.now() - (globalThis.T0 || 0), url.replace(/^https:\/\/[^/]+/, '')]);
    try {
      const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
      const body = await r.text();
      if (r.status >= 400) net.apiFail.push(r.status + " " + url.slice(0, 160));
      return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } });
    } catch (e) { net.apiFail.push("ERR " + e.message + " " + url.slice(0, 160)); return route.abort(); }
  }
  return route.fallback();
});
if (opt.pauseLap === "1") await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
await context.addInitScript(() => { if (window.top !== window) return; window.__lt = { n: 0, ms: 0, max: 0 };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt.n++; window.__lt.ms += e.duration; window.__lt.max = Math.max(window.__lt.max, e.duration); } }).observe({ type: "longtask", buffered: true }); } catch (_) {} });
const page = await context.newPage();
page.on("requestfailed", (r) => { const u = r.url(); if (!/scintilla-massive-chart-api/.test(u)) net.failed.push((r.failure() || {}).errorText + " " + u.slice(0, 160)); });
page.on("response", (r) => { if (r.status() >= 400) net.bad.push(r.status() + " " + r.url().slice(0, 160)); });
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + ": " + m.text().slice(0, 300)); });
page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message.slice(0, 300)));
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");
if (+opt.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: +opt.cpu });

const bpid = process.pid; // node is the parent of the headless shell tree
function procTree() {
  if (!bpid) return null;
  try {
    const out = execSync("ps -axo pid=,ppid=,rss=,time=,command=").toString().trim().split("\n").map((l) => l.trim().split(/\s+/));
    const kids = new Set([bpid]); let grew = true;
    while (grew) { grew = false; for (const [p, pp] of out) if (kids.has(+pp) && !kids.has(+p)) { kids.add(+p); grew = true; } }
    let rss = 0, cpu = 0; const by = {};
    for (const [p, , r, t, ...cmd] of out) if (kids.has(+p) && +p !== bpid) { rss += +r; const parts = t.split(":").map(Number); const c = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]; cpu += c;
      const ty = (cmd.join(" ").match(/--type=([a-z-]+)/) || [, "browser"])[1]; by[ty] = +((by[ty] || 0) + c).toFixed(2); }
    return { rssMB: Math.round(rss / 1024), cpuSec: +cpu.toFixed(2), procs: kids.size, by };
  } catch (_) { return null; }
}
async function metrics() { const m = await page.evaluate(() => ({ JSHeapUsedSize: performance.memory ? performance.memory.usedJSHeapSize : 0, Frames: document.querySelectorAll("iframe").length, Nodes: document.getElementsByTagName("*").length, LT: Object.assign({}, window.__lt) }));
  const t = (await cdp.send("Performance.getMetrics")).metrics; for (const x of t) m[x.Name] = x.Value; return m; }

const T0 = Date.now(); globalThis.T0 = T0;
await page.goto(origin + deckPath);
if (opt.hover) {
  await page.waitForTimeout(3000);
  const b = await page.evaluate((k) => { const n = document.querySelector('.pane[data-key="' + k + '"]'); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, opt.hover);
  if (b) await page.mouse.move(b.x, b.y);
}
const probe = () => page.evaluate(() => {
  const out = [];
  for (const pane of document.querySelectorAll(".pane")) {
    const frames = [...pane.querySelectorAll("iframe")].filter((f) => /chart/.test(f.src || ""));
    if (!frames.length) continue;
    const rows = frames.map((f) => {
      let d = null;
      try {
        const doc = f.contentDocument, h = doc && (doc.querySelector("#chartSlot .sc-nchart") || doc.querySelector(".sc-nchart"));
        if (h) {
          const g = h.querySelector(".sc-nchart__live-geiger");
          const cv = h.querySelector(".sc-nchart__cv");
          d = { t: h.dataset.t, bars: h._series ? h._series.length : 0, plot: !!h._plot,
            geiger: g ? (g.hidden ? "hidden" : (g.style.visibility === "hidden" ? "invisible:" + (g.dataset.why || "") : "shown:" + g.textContent.trim())) : "absent",
            lensState: h.dataset.lensState || "-", lensWhy: (h.dataset.lensWhy || "-").slice(0, 80), lensSpot: !!(h._lens && h._lens.spot),
            fan: h._rsiDrawn ? h._rsiDrawn.lines.map((l) => l.key + (l.value == null ? "∅" : "")).join(" ") : "-",
            cloud: h._rsiDrawn && h._rsiDrawn.cloud ? "y" : "-",
            rot: (h.querySelector(".sc-nchart__live-rot") || {}).textContent || "",
            cvW: cv ? cv.width : 0, why: g ? g.dataset.why : null, gt: g ? g.style.transform : null, plotR: h._plot ? h._plot.padL + h._plot.iw : null, ko: (() => { try { const W = f.contentWindow, area = h.querySelector(".sc-nchart__area"), a = area.getBoundingClientRect(), be = h.querySelector(".sc-nchart__live"), b = be.getBoundingClientRect(), gg = g.getBoundingClientRect(); return JSON.stringify({ keep: W.deckKeepOut(area), badge: [b.left - a.left, b.top - a.top, b.width, b.height], chip: [gg.width, gg.height], padT: h._plot.padT }); } catch (e) { return "err " + e.message; } })() };
        }
      } catch (e) { d = { err: e.message }; }
      const cs = getComputedStyle(f);
      return { cls: f.className, op: cs.opacity, src: new URL(f.src).searchParams.get("t"), d };
    });
    out.push({ key: pane.dataset.key, rows });
  }
  return { scene: (document.querySelector("#sceneMode") || {}).value || null, title: document.title, panes: out };
});
// ink count of the visible chart canvases (is a price line drawn?)
const ink = () => page.evaluate(() => {
  const res = {};
  for (const pane of document.querySelectorAll(".pane")) {
    const f = [...pane.querySelectorAll("iframe")].find((x) => /chart/.test(x.src || "") && !x.classList.contains("slot-next") && !x.classList.contains("slot-spare"));
    if (!f) continue;
    try { const cv = f.contentDocument.querySelector(".sc-nchart__cv"); if (!cv || !cv.width) { res[pane.dataset.key] = 0; continue; }
      const c = cv.getContext("2d"), dat = c.getImageData(0, 0, cv.width, cv.height).data; let n = 0;
      for (let i = 3; i < dat.length; i += 16) if (dat[i] > 40) n++; res[pane.dataset.key] = n; } catch (e) { res[pane.dataset.key] = "err"; }
  }
  return res;
});
const samples = [];
const firstDraw = {};
const step = +(opt.sample || 1000);
let m0 = null, p0 = null, mEnd = null, pEnd = null;
const total = +secs * 1000;
const cpuFrom = +(opt.cpuFrom || 30) * 1000;
while (Date.now() - T0 < total) {
  const t = Date.now() - T0;
  if (!m0 && t >= cpuFrom) { m0 = await metrics(); p0 = procTree(); m0._t = t; if (opt.prof === "1") { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 }); await cdp.send("Profiler.start"); } }
  let s = null;
  if (Math.floor(t / 5000) !== Math.floor((t - step) / 5000)) { const pt = procTree(); if (pt) (globalThis.PS = globalThis.PS || []).push({ t, ...pt }); }
  try { s = await probe(); } catch (e) { s = { err: e.message }; }
  if (s && s.panes) for (const p of s.panes) for (const r of p.rows) if (r.d && r.d.bars > 1 && !firstDraw[p.key + ":" + r.d.t]) firstDraw[p.key + ":" + r.d.t] = t;
  const row = { t, s };
  if (opt.ink === "1" && Math.floor(t / 5000) !== Math.floor((t - step) / 5000)) { try { row.ink = await ink(); } catch (_) {} }
  samples.push(row);
  if (opt.fadeShot && !globalThis.FADED && t > 8000) {
    const fading = await page.evaluate(() => [...document.querySelectorAll("iframe.slot-next.in")].map((f) => { const o = +getComputedStyle(f).opacity; return o; })).catch(() => []);
    if (fading.some((o) => o > 0.3 && o < 0.8)) { globalThis.FADED = t; await page.screenshot({ path: outPrefix + "-midfade.png" }); }
  }
  if (opt.shotAt && !globalThis.SHOT && t > +opt.shotAt * 1000) { globalThis.SHOT = 1; await page.screenshot({ path: outPrefix + "-at" + opt.shotAt + ".png" }); }
  await page.waitForTimeout(step);
}
mEnd = await metrics(); pEnd = procTree(); mEnd._t = Date.now() - T0;
if (opt.prof === "1" && m0) { const { profile } = await cdp.send("Profiler.stop"); const byId = new Map(profile.nodes.map((n) => [n.id, n])); const self = new Map();
  const dt = profile.timeDeltas; for (let i = 0; i < profile.samples.length; i++) { const n = byId.get(profile.samples[i]); const cf = n.callFrame; const k = (cf.functionName || "(anon)") + " " + (cf.url || "").replace(/^https?:\/\/[^/]+/, "") + ":" + cf.lineNumber; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); }
  const byUrl = new Map(); for (const [k, v] of self) { const u = k.split(" ").slice(1).join(" ").replace(/:\d+$/, ""); byUrl.set(u, (byUrl.get(u) || 0) + v); }
  fs.writeFileSync(outPrefix + ".prof.txt", "BY URL (ms)\n" + [...byUrl].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => (v / 1000).toFixed(0).padStart(7) + "  " + k).join("\n") + "\n\nBY FUNCTION (ms self)\n" + [...self].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => (v / 1000).toFixed(0).padStart(7) + "  " + k).join("\n") + "\n"); }
await page.screenshot({ path: outPrefix + ".png" });
const perf = m0 ? {
  windowSec: +((mEnd._t - m0._t) / 1000).toFixed(1),
  taskSec: +(mEnd.TaskDuration - m0.TaskDuration).toFixed(2), scriptSec: +(mEnd.ScriptDuration - m0.ScriptDuration).toFixed(2),
  layoutSec: +(mEnd.LayoutDuration - m0.LayoutDuration).toFixed(2), heapMB0: +(m0.JSHeapUsedSize / 1048576).toFixed(1), heapMB1: +(mEnd.JSHeapUsedSize / 1048576).toFixed(1),
  nodes0: m0.Nodes, nodes1: mEnd.Nodes, frames1: mEnd.Frames, longTasks: mEnd.LT && m0.LT ? { n: mEnd.LT.n - m0.LT.n, ms: Math.round(mEnd.LT.ms - m0.LT.ms), maxAll: Math.round(mEnd.LT.max) } : null, docs1: mEnd.Documents,
  procCpuSec: p0 && pEnd ? +(pEnd.cpuSec - p0.cpuSec).toFixed(2) : null, cpuBy: p0 && pEnd ? Object.fromEntries(Object.keys(pEnd.by).map((k) => [k, +((pEnd.by[k] || 0) - (p0.by[k] || 0)).toFixed(2)])) : null, rssMB0: p0 && p0.rssMB, rssMB1: pEnd && pEnd.rssMB } : null;
fs.writeFileSync(outPrefix + ".json", JSON.stringify({ root, deckPath, W, opt, net, logs, perf, ps: globalThis.PS || [], firstDraw, samples }, null, 1));
console.log(JSON.stringify({ perf, api: net.api, apiFail: net.apiFail.length, failed: net.failed.length, bad: net.bad.length, blocked: net.blocked.length, logs: logs.length, pageErrors: logs.filter((l) => /PAGEERROR/.test(l)).length }));
await browser.close(); server.close();
