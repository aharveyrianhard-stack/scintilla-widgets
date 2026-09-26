/* S1 follow-ups: page-change frame harness (headless).
   node frames.mjs <root> <label> <outDir>
   - serves <root> statically at 127.0.0.1
   - chart API: fetched from Node with Origin https://scintillahub.ai, cached in api-cache.json so
     the before and after runs see the same stored prices
   - Supabase: GET/HEAD pass through read-only; every other method is answered here (201 []) and logged
   - everything else except fonts is refused and logged */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const [ROOT, LABEL, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const CACHE_FILE = path.join(HERE, "api-cache.json");
const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) : {};
const log = { writes: [], refused: [], apiMiss: 0, apiHit: 0 };

const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript", ".mjs":"text/javascript", ".css":"text/css",
  ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".webmanifest":"application/json" };
const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.normalize(path.join(ROOT, clean));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file) && !path.extname(file)) file += "/index.html";
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + server.address().port;

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
await context.addInitScript(() => { try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
await context.route("**/*", async (route) => {
  const req = route.request(); const url = req.url(); const host = new URL(url).host;
  if (host.startsWith("127.0.0.1")) return route.fallback();
  if (host === "scintilla-massive-chart-api.fly.dev") {
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    let hit = cache[url];
    if (hit) log.apiHit++;
    else {
      log.apiMiss++;
      try {
        const r = await fetch(url, { headers: { Origin: "https://scintillahub.ai" } });
        hit = { status: r.status, body: await r.text() };
        if (r.status === 200 || r.status === 404) cache[url] = hit;
      } catch (e) { return route.fulfill({ status: 503, headers: CORS, body: "{}" }); }
    }
    return route.fulfill({ status: hit.status, headers: { ...CORS, "content-type": "application/json" }, body: hit.body });
  }
  if (host === "wadinxqplrggagkvrdag.supabase.co") {
    const m = req.method();
    if (m === "GET" || m === "HEAD") return route.continue();
    if (m === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    log.writes.push({ method: m, url, body: (req.postData() || "").slice(0, 400) });
    return route.fulfill({ status: 201, headers: { ...CORS, "content-type": "application/json" }, body: "[]" });
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(host)) return route.continue();
  log.refused.push(host);
  return route.abort();
});

const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

/* the per-paint probe: every visible chart pane, empty / old symbol / drawn */
const PROBE = () => {
  const out = { empty: 0, old: 0, ok: 0, panes: [] };
  for (const pane of document.querySelectorAll(".pane.chart-pane")) {
    if (pane.classList.contains("chart-off") || !pane.offsetParent) continue;
    const o = (typeof PANES !== "undefined" ? PANES : []).find((x) => x.node === pane);
    const want = o && o.def.title !== "Choose a symbol" ? String(o.def.title || "").trim() : "";
    const f = pane.querySelector("iframe");
    let state = "empty", t = "";
    try {
      const host = f && f.contentDocument && f.contentDocument.querySelector(".sc-nchart");
      const cv = host && host.querySelector("canvas");
      if (host && cv && host._series && host._series.length) { t = host.dataset.t || ""; state = t === want ? "ok" : "old"; }
    } catch (_) {}
    let why = "";
    if (state === "empty") {
      try {
        const doc = f && f.contentDocument, host = doc && doc.querySelector(".sc-nchart");
        why = !f ? "nof" : !doc ? "nodoc" : !host ? "nohost(" + doc.readyState + "," + (f.getAttribute("src") || "").slice(0, 60) + ")" : !host.querySelector("canvas") ? "nocv" : "noseries";
      } catch (_) { why = "x"; }
    }
    if (pane.querySelector(".card")) { state = "empty"; why = "card"; }
    out[state]++; out.panes.push(want + ":" + state + (why ? "/" + why : ""));
  }
  return out;
};

async function settle(n, ms = 20000) {
  const t = Date.now(); let p;
  while (Date.now() - t < ms) { p = await page.evaluate(PROBE); if (p.ok >= n && p.empty === 0 && p.old === 0) return p; await page.waitForTimeout(250); }
  return p;
}

const cdp = await context.newCDPSession(page);
let frames = [];
cdp.on("Page.screencastFrame", async (f) => {
  frames.push({ ts: f.metadata.timestamp * 1000, data: f.data });
  try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch (_) {}
});

async function transition(to, name, want) {
  await page.evaluate(() => { window.__plog = []; });
  frames = [];
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
  await page.waitForTimeout(300);
  const t0 = await page.evaluate(({ to, probeSrc }) => {
    const probe = eval("(" + probeSrc + ")");
    const start = performance.now(); const wall = Date.now();
    const tick = () => { const t = performance.now() - start; if (t > 1600) return; window.__plog.push({ t: Math.round(t), ...probe() }); requestAnimationFrame(tick); };
    applyScene(to); requestAnimationFrame(tick);
    return wall;
  }, { to, probeSrc: PROBE.toString() });
  await page.waitForTimeout(1800);
  await cdp.send("Page.stopScreencast");
  const plog = await page.evaluate(() => window.__plog);
  const settled = await settle(want);
  /* the picture on screen at each 100 ms mark: the newest screencast frame at or before it */
  const dir = path.join(OUT, name); fs.mkdirSync(dir, { recursive: true });
  const marks = [];
  for (let ms = 0; ms <= 1000; ms += 100) {
    const at = t0 + ms; let best = null;
    for (const f of frames) if (f.ts <= at + 8 && (!best || f.ts > best.ts)) best = f;
    if (!best) best = frames[0];
    const file = path.join(dir, String(ms).padStart(4, "0") + ".jpg");
    if (best) fs.writeFileSync(file, Buffer.from(best.data, "base64"));
    const probeAt = [...plog].reverse().find((p) => p.t <= ms) || plog[0];
    marks.push({ ms, frameAge: best ? Math.round(at - best.ts) : null, empty: probeAt?.empty, old: probeAt?.old, ok: probeAt?.ok });
  }
  const never = new Set((settled?.panes || []).filter((x) => !x.endsWith(":ok")).map((x) => x.split(":")[0]));
  for (const p of plog) p.empty = p.panes.filter((x) => /:empty/.test(x) && !never.has(x.split(":")[0])).length;
  const paints = plog.length;
  const emptyPaneFrames = plog.reduce((a, p) => a + p.empty, 0);
  const oldPaneFrames = plog.reduce((a, p) => a + p.old, 0);
  const firstComplete = plog.find((p) => p.ok >= want && p.empty === 0 && p.old === 0);
  const maxEmpty = plog.reduce((a, p) => Math.max(a, p.empty), 0);
  const lastEmpty = [...plog].reverse().find((p) => p.empty > 0);
  return { name, to, want, paints, emptyPaneFrames, oldPaneFrames, maxEmpty,
    emptyUntilMs: lastEmpty ? lastEmpty.t : 0, completeAtMs: firstComplete ? firstComplete.t : null,
    screencastFrames: frames.length, neverDrew: [...never],
    marks: marks.map((m) => { const p = [...plog].reverse().find((q) => q.t <= m.ms) || plog[0]; return { ...m, empty: p?.empty, panes: p?.panes }; }),
    firstPaints: plog.slice(0, 14).map((q) => q.t + " " + q.panes.join(" ")),
    settled: settled && { ok: settled.ok, empty: settled.empty, old: settled.old } };
}

const results = [];
await page.goto(ORIGIN + "/deck/?scene=ai1", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
results.push({ boot: await settle(8, 40000) });
const lap = process.env.LAP === "rsi" ? [["targetsOsc", 8], ["spyQqqOsc", 2], ["otherIndexesOsc", 6], ["targetsOsc", 8], ["ai1", 8]] : [["spyQqqOsc", 2], ["otherIndexesOsc", 6], ["otherIndexes1D", 6], ["targets1D", 8], ["ai1", 8]];
for (const pass of [1, 2]) {
  for (const [to, want] of lap) {
    const r = await transition(to, "lap" + pass + "-" + to, want);
    results.push({ pass, ...r });
    console.log(LABEL, pass, to, "empty pane-frames", r.emptyPaneFrames, "empty until", r.emptyUntilMs, "complete at", r.completeAtMs, "paints", r.paints);
    await page.waitForTimeout(1500);
  }
}
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ label: LABEL, root: ROOT, results, writes: log.writes,
  refusedHosts: [...new Set(log.refused)], apiHit: log.apiHit, apiMiss: log.apiMiss, errors: errors.slice(0, 20) }, null, 1));
fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
await browser.close(); server.close();
console.log("writes answered locally:", log.writes.length, "refused hosts:", [...new Set(log.refused)].join(","), "errors:", errors.length);
