// ST3 soak: the live Station in one headless page, with this checkout's files served in place of
// the deployed ones (data still comes from the live services). Sampled every minute.
// usage: node soak.mjs <label> <localDir> <minutes> <outDir> [heapAtMinutes e.g. 5,15,30]
// Headless only. Every non-GET request is blocked and counted.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [label, localDir, minutesS, outDir, heapAtS] = process.argv.slice(2);
const minutes = Number(minutesS), heapAt = new Set(String(heapAtS || "").split(",").filter(Boolean).map(Number));
const ORIGIN = "https://station.scintillahub.ai";
fs.mkdirSync(outDir, { recursive: true });
const out = (n) => path.join(outDir, `${label}-${n}`);

// runs in every document before its scripts: who makes a chart document, and from which line
const INIT = () => {
  if (window.top !== window || window.__st3) return;
  const S = (window.__st3 = { made: [], spare: { taken: 0, none: 0, mismatch: 0, why: {} }, lt: [] });
  const site = () => ((new Error().stack || "").split("\n").slice(3, 9)
    .map((l) => (l.match(/at (\S+) .*?:(\d+):\d+\)?$/) || l.match(/()(?:.*?):(\d+):\d+\)?$/) || []))
    .filter((m) => m.length).map((m) => (m[1] || "?") + ":" + m[2]).slice(0, 3).join(" < "));
  const isChart = (u) => /chart-v1/.test(String(u || ""));
  const note = (how, u) => { if (isChart(u) && S.made.length < 5000) S.made.push([Math.round(performance.now()), how, site(), String(u).replace(/^.*\?/, "").slice(0, 120)]); };
  const d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src");
  Object.defineProperty(HTMLIFrameElement.prototype, "src", { configurable: true, get() { return d.get.call(this); },
    set(v) { note(this.isConnected ? "re-src" : "new", v); return d.set.call(this, v); } });
  const sa = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (k, v) { if (this.tagName === "IFRAME" && k === "src") note("re-src", v); return sa.call(this, k, v); };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (S.lt.length < 20000) S.lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ entryTypes: ["longtask"] }); } catch {}
  // why a parked frame was not used (the deck's own functions are globals of a classic script)
  addEventListener("DOMContentLoaded", () => {
    const take = window.takeSpare; if (typeof take !== "function") return;
    window.takeSpare = function (pane, src) {
      const f = pane && pane.spare; let why = "";
      if (!f) why = "no parked frame";
      else if (f.parentNode !== pane.body || !f.contentWindow) why = "parked frame detached";
      else if (!f._spareTicker) why = "parked frame never settled";
      const r = take.apply(this, arguments);
      if (r) S.spare.taken++; else { if (!why) { why = "address differs"; S.spare.mismatch++; } else S.spare.none++; S.spare.why[why] = (S.spare.why[why] || 0) + 1; }
      return r;
    };
  });
};

const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
const [VW, VH] = (process.env.ST3_VIEWPORT || "1680x1050").split("x").map(Number);   /* ST3_VIEWPORT=390x844 for the phone picture */
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
await ctx.addInitScript(INIT);
const req = { total: 0, blocked: 0, blockedBy: {}, candles: 0, candlesByMin: [], local: 0, chartDocs: 0, chartDocsByMin: [], chartFiles: 0, bytesChartFiles: 0 };
let minuteIdx = 0;
await ctx.route("**/*", async (route) => {
  const r = route.request();
  if (r.method() !== "GET") { req.blocked++; let k = r.method(); try { const u = new URL(r.url()); k += " " + u.host + u.pathname.slice(0, 50); } catch {} req.blockedBy[k] = (req.blockedBy[k] || 0) + 1; return route.abort("blockedbyclient"); }
  if (r.url().startsWith(ORIGIN)) {
    const u = new URL(r.url()); let p = decodeURIComponent(u.pathname);
    if (p === "/") p = "/deck/index.html"; else if (p.endsWith("/")) p += "index.html";
    const f = path.join(localDir, p);
    if (!p.includes("..") && fs.existsSync(f) && fs.statSync(f).isFile()) { req.local++; return route.fulfill({ path: f, headers: { "cache-control": "no-cache" } }); }
  }
  return route.continue();
});
const page = await ctx.newPage();
page.on("request", (r) => {
  req.total++; const u = r.url();
  if (/\/candles(\?|\/|$)/.test(u)) { req.candles++; req.candlesByMin[minuteIdx] = (req.candlesByMin[minuteIdx] || 0) + 1; }
  if (/\/station-shells\/chart-v1\/?(\?|$)/.test(u) && r.resourceType() === "document") { req.chartDocs++; req.chartDocsByMin[minuteIdx] = (req.chartDocsByMin[minuteIdx] || 0) + 1; }
});
const errors = {}; page.on("pageerror", (e) => { const k = String(e).slice(0, 200); errors[k] = (errors[k] || 0) + 1; });
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable");
await cdp.send("HeapProfiler.enable");
const metrics = async () => { const o = {}; for (const m of (await cdp.send("Performance.getMetrics")).metrics) o[m.name] = m.value; return o; };

const t0 = Date.now();
/* ST3_QUERY="?keepcharts=1" turns the parked-chart keeping on (the "after" runs of the report had it on) */
await page.goto(ORIGIN + "/" + (process.env.ST3_QUERY || ""), { waitUntil: "domcontentloaded", timeout: 60000 });
try { await page.waitForLoadState("networkidle", { timeout: 30000 }); } catch {}
await cdp.send("HeapProfiler.startSampling", { samplingInterval: 8192, includeObjectsCollectedByMajorGC: false, includeObjectsCollectedByMinorGC: false });
await page.screenshot({ path: out("start.png") }).catch(() => {});

const samples = [];
const snap = async (m) => {
  await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
  const p = await metrics();
  const inPage = await page.evaluate(() => ({ made: window.__st3.made.length, spare: window.__st3.spare, lt: window.__st3.lt.length,
    iframes: document.querySelectorAll("iframe").length, spares: document.querySelectorAll("iframe.slot-spare").length,
    scene: typeof SCENE === "string" ? SCENE : "", charts: typeof CHART_COUNT === "number" ? CHART_COUNT : null,
    /* the deck's shared price-history store: how much it holds, and how much of that is past its time */
    cache: (() => { const st = window.__SC_PROVIDER_CANDLES_V1; if (!st) return null; const now = Date.now(); let dead = 0, deadChars = 0;
      st.expires.forEach((at, k) => { if (!(now < at)) { dead++; deadChars += (st.text.get(k) || "").length; } });
      return { entries: st.text.size, mChars: +(st.chars / 1e6).toFixed(2), expired: dead, expiredMChars: +(deadChars / 1e6).toFixed(2) }; })() })).catch(() => null);
  samples.push({ m, t: Date.now() - t0, heapMB: +(p.JSHeapUsedSize / 1048576).toFixed(2), nodes: p.Nodes, listeners: p.JSEventListeners, docs: p.Documents, frames: p.Frames,
    scriptS: +p.ScriptDuration.toFixed(2), taskS: +p.TaskDuration.toFixed(2), layoutS: +p.LayoutDuration.toFixed(2), req: req.total, candles: req.candles, chartDocs: req.chartDocs, ...inPage });
  fs.writeFileSync(out("samples.json"), JSON.stringify(samples, null, 1));
  if (heapAt.has(m)) {
    const { profile } = await cdp.send("HeapProfiler.getSamplingProfile");
    fs.writeFileSync(out(`heap-m${m}.json`), JSON.stringify(profile));
  }
  console.log(label, "m" + m, JSON.stringify(samples[samples.length - 1]));
};
await snap(0);
/* every page change the deck reports (window.__pageFadeLast): how long the next page took to be drawn and
   ready before it faded in, and how many chart documents were built since the page change before it */
const fades = []; let fadeSeen = "", fadeMade = 0, polling = true;
(async () => { while (polling) {
  try { const f = await page.evaluate(() => ({ last: window.__pageFadeLast || null, made: window.__st3.made.length, scene: typeof SCENE === "string" ? SCENE : "", t: Math.round(performance.now()) }));
    const key = JSON.stringify(f.last);
    if (f.last && key !== fadeSeen) { fadeSeen = key; fades.push({ t: f.t, scene: f.scene, readyMs: f.last.readyMs, jobs: f.last.jobs, settled: f.last.settled, late: (f.last.late || []).length, built: f.made - fadeMade }); fadeMade = f.made; }
    else if (!f.last) fadeMade = f.made;
  } catch {}
  await new Promise((r) => setTimeout(r, 1500)); } })();
for (let m = 1; m <= minutes; m++) {
  minuteIdx = m;
  const until = t0 + m * 60000 + 0; const left = until - Date.now();
  if (left > 0) await page.waitForTimeout(left);
  await snap(m);
}
await page.screenshot({ path: out("end.png") }).catch(() => {});
const made = await page.evaluate(() => ({ made: window.__st3.made, spare: window.__st3.spare, lt: window.__st3.lt })).catch(() => null);
polling = false;
fs.writeFileSync(out("result.json"), JSON.stringify({ label, localDir, minutes, samples, req, errors, made, fades }, null, 1));
await browser.close();
console.log(label, "done");
