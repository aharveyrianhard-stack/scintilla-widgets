// S2 station rotation rig (29 Sep). Headless only; nothing is shown on screen.
// Drives every workflow page in rotation order, measuring each page change frame by frame.
//   node rotation.mjs <root> <out.json> [--w=1680] [--laps=2] [--window=12] [--shots=a,b,c] [--slots=secs]
// The chart API is proxied from node with the scintillahub.ai origin (the API only accepts that
// origin); every other non-local request that is not a GET is refused. No writes leave the rig.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const [root, out, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const W = +(opt.w || 1680), H = W < 600 ? 844 : 1050, MOBILE = W < 600;
const LAPS = +(opt.laps || 2), WINDOW = +(opt.window || 12) * 1000;
const SHOTS = new Set(String(opt.shots || "").split(",").filter(Boolean));

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
const net = { api: 0, apiFail: [], blocked: [] };
await context.route("**/*", async (route) => {
  const req = route.request(), url = req.url(), host = new URL(url).host;
  if (host.startsWith("127.0.0.1")) return route.fallback();
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { net.blocked.push(req.method() + " " + url.slice(0, 100)); return route.abort(); }
  if (host === "scintilla-massive-chart-api.fly.dev") {
    net.api++;
    try {
      const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
      const body = await r.text();
      if (r.status >= 400) net.apiFail.push(r.status + " " + url.slice(0, 140));
      return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } });
    } catch (e) { net.apiFail.push("ERR " + e.message); return route.abort(); }
  }
  return route.fallback();
});
/* the page lap is paused (the rig drives the pages itself) */
await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
/* THE SAMPLER: runs in the deck, one probe per painted frame (requestAnimationFrame). */
await context.addInitScript(() => {
  if (window.top !== window) return;
  const R = window.__rot = { on: false, log: [], t0: 0 };
  const frameState = (f) => {
    try {
      const doc = f.contentDocument, h = doc && doc.querySelector("#chartSlot .sc-nchart");
      if (!h) return { t: null, drawn: false };
      /* a name with no bars shows its named reason: that is drawn, and nothing more will come */
      const absent = !!(h._dataState && h._dataState.history === "absent" && !(h._series && h._series.length >= 2));
      if (absent) return { t: h.dataset.t, id: (() => { const a = new URL(f.dataset.shown || f.getAttribute("src") || "", location.href); a.searchParams.delete("transition"); return a.pathname + a.search; })(),
        drawn: true, absent: true, price: true, clouds: true, lens: true, lensShown: false, chip: true, chipShown: false };
      const drawn = !!(h._series && h._series.length >= 2 && h._plot);
      const badge = h.querySelector(".sc-nchart__live");
      const price = !!(badge && /\d/.test(badge.textContent || ""));
      const cbtn = doc.querySelector('[data-act="clouds"]');
      const cloudsOn = !cbtn || cbtn.classList.contains("on");
      const clouds = !cloudsOn || !!(h._cloudRows && h._cloudRows.length >= 2) || !!h._cloudAbsence;
      const lcv = h.querySelector(".sc-nchart__lens");
      const lensShown = !!(lcv && lcv.style.display === "block");
      const bubble = new URL(f.dataset.shown || f.src, location.href).searchParams.get("bubble");
      const why = h.dataset.lensWhy || "";
      const lens = !bubble || lensShown || (!!why && !/not drawn yet|not read yet/.test(why));
      const chipEl = h.querySelector(".sc-nchart__live-geiger.is-float");
      const chipShown = !!(chipEl && !chipEl.hidden && chipEl.style.visibility !== "hidden");
      let reading = false;
      try { reading = !!(DECK_GEIGER.readings && DECK_GEIGER.readings[h.dataset.t]); } catch (_) {}
      const chip = chipShown || !reading;
      const addr = new URL(f.dataset.shown || f.getAttribute("src") || "", location.href);
      addr.searchParams.delete("transition");
      return { t: h.dataset.t, id: addr.pathname + addr.search, drawn, price, clouds, lens, lensShown, chip, chipShown };
    } catch (e) { return { t: null, drawn: false, err: e.message }; }
  };
  const probe = () => {
    const now = performance.now() - R.t0, panes = [];
    for (const node of document.querySelectorAll("#rowTop > .pane")) {
      const cs = getComputedStyle(node);
      if (cs.display === "none") continue;
      const r = node.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const frames = [];
      for (const f of node.querySelectorAll(".body > iframe")) {
        const fs = getComputedStyle(f);
        if (fs.visibility === "hidden" || fs.display === "none") continue;
        const op = +fs.opacity;
        if (op < 0.02) continue;
        const fr = f.getBoundingClientRect();
        frames.push(Object.assign({ op: +op.toFixed(2), box: [fr.left, fr.top, fr.width, fr.height].map(Math.round).join(",") }, frameState(f)));
      }
      panes.push({ k: node.dataset.key, box: [r.left, r.top, r.width, r.height].map(Math.round).join(","), inc: node.classList.contains("page-incoming") ? 1 : 0, frames });
    }
    R.log.push({ t: Math.round(now), panes });
  };
  const loop = () => { if (!R.on) return; probe(); requestAnimationFrame(loop); };
  R.start = () => { R.log = []; R.t0 = performance.now(); R.on = true; probe(); requestAnimationFrame(loop); };
  R.stop = () => { R.on = false; return R.log; };
});
const page = await context.newPage();
const logs = [];
page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message.slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") logs.push("error: " + m.text().slice(0, 200)); });
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");

function procTree() {
  const out = execSync("ps -axo pid=,ppid=,rss=,time=,command=").toString().trim().split("\n").map((l) => l.trim().split(/\s+/));
  const kids = new Set([process.pid]); let grew = true;
  while (grew) { grew = false; for (const [p, pp] of out) if (kids.has(+pp) && !kids.has(+p)) { kids.add(+p); grew = true; } }
  let rss = 0, cpu = 0;
  for (const [p, , r, t] of out) if (kids.has(+p) && +p !== process.pid) {
    rss += +r; const parts = t.split(":").map(Number);
    cpu += parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  }
  return { rssMB: Math.round(rss / 1024), cpuSec: +cpu.toFixed(2), procs: kids.size - 1 };
}

const order = JSON.parse(execSync(`node -e 'globalThis.window=globalThis;require(${JSON.stringify(path.join(root, "deck/scenes.js"))});console.log(JSON.stringify((globalThis.StationScenes||globalThis.SceneModel||{}).WORKFLOW_IDS||null))'`).toString());
if (!order) throw new Error("no WORKFLOW_IDS");
if (opt.only) order.splice(+opt.only);
const start = order[order.length - 1];
await page.goto(origin + "/deck/?scene=" + start);
await page.waitForTimeout(14000);
/* the in-slot rotation is held still while page changes are measured (its steps would mix in) */
await page.evaluate(() => { ROTATE_AT = 900; });

const changes = [];
for (let lap = 1; lap <= LAPS; lap++) {
  for (const id of order) {
    const p0 = procTree(), m0 = (await cdp.send("Performance.getMetrics")).metrics;
    await page.evaluate(() => window.__rot.start());
    const t0 = Date.now();
    const applied = page.evaluate(async (scene) => {
      ROTATE_BUSY = true;
      const a = performance.now();
      try { await applyScene(scene, { rotate: true, screen: true }); } finally { ROTATE_BUSY = false; }
      return Math.round(performance.now() - a);
    }, id);
    let shot = null;
    if (SHOTS.has(id) && lap === LAPS && opt.shotAt) {
      await page.waitForTimeout(+opt.shotAt);
      shot = path.join(path.dirname(out), "shots", path.basename(out, ".json") + "-" + id + "-t+" + opt.shotAt + "ms.png"); await page.screenshot({ path: shot });
    } else if (SHOTS.has(id) && lap === LAPS) {
      /* capture mid-dissolve: the first moment a page-level fade is between 30% and 80% */
      const until = Date.now() + 10000;
      while (Date.now() < until && !shot) {
        const mid = await page.evaluate(() => [...document.querySelectorAll("#rowTop iframe.slot-next.in, #rowTop iframe.page-next.in")].map((f) => +getComputedStyle(f).opacity).some((o) => o > 0.3 && o < 0.8)).catch(() => false);
        if (mid) { shot = path.join(path.dirname(out), "shots", path.basename(out, ".json") + "-" + id + "-mid.png"); await page.screenshot({ path: shot }); }
        else await page.waitForTimeout(40);
      }
      if (!shot) { shot = path.join(path.dirname(out), "shots", path.basename(out, ".json") + "-" + id + "-t+" + (Date.now() - t0) + "ms.png"); await page.screenshot({ path: shot }); }
    }
    const applyMs = await applied;
    const left = WINDOW - (Date.now() - t0);
    if (left > 0) await page.waitForTimeout(left);
    const log = await page.evaluate(() => window.__rot.stop());
    const p1 = procTree(), m1 = (await cdp.send("Performance.getMetrics")).metrics;
    const mm = (m, k) => (m.find((x) => x.Name === k) || {}).Value || 0;
    const final = await page.evaluate(() => ({ fade: window.__pageFadeLast || null, scene: SCENE, count: CHART_COUNT, charts: CHARTS.slice(0, CHART_COUNT),
      ids: CHARTS.slice(0, CHART_COUNT).map((_, i) => { const p = PANES.find((x) => x.def.key === "c" + (i + 1)); if (!p || !p.def.src) return ""; const a = new URL(p.def.src, location.href); a.searchParams.delete("transition"); return a.pathname + a.search; }),
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      frames: document.querySelectorAll("iframe").length }));
    changes.push({ lap, id, applyMs, cpuSec: +(p1.cpuSec - p0.cpuSec).toFixed(2), rssMB: p1.rssMB, procs: p1.procs,
      taskSec: +(mm(m1, "TaskDuration") - mm(m0, "TaskDuration")).toFixed(2), shot, final, log });
    process.stdout.write(`${lap} ${id} apply=${applyMs}ms cpu=${(p1.cpuSec - p0.cpuSec).toFixed(2)} rss=${p1.rssMB}\n`);
  }
}

/* PART 3: the in-slot rotation on a rotating page, left to run for --slots seconds (a full cycle and
   far past it). Every 10 s: frame gaps (a dropped frame shows as a gap), blank pane time, slot fades
   completed, parked frames, documents, memory and CPU. */
let slots = null;
if (+opt.slots > 0) {
  const scene = opt.slotPage || "intraday4h";
  await page.evaluate(async (s) => { ROTATE_AT = 33; ROTATE_BUSY = true; try { await applyScene(s, { rotate: true, screen: true }); } finally { ROTATE_BUSY = false; } }, scene);
  await page.evaluate(() => {
    const W = window.__slot = { fades: 0, b: null };
    const fresh = () => ({ frames: 0, maxGap: 0, gaps50: 0, blankMs: 0 });
    W.b = fresh(); W.reset = () => { const r = W.b; W.b = fresh(); return r; };
    new MutationObserver((ms) => { for (const m of ms) { const n = m.target; if (n.tagName === "IFRAME" && n.classList.contains("slot-next") && n.classList.contains("in") && !(m.oldValue || "").includes(" in")) W.fades++; } })
      .observe(document.getElementById("rowTop"), { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
    let prev = performance.now();
    const loop = (now) => {
      const gap = now - prev; prev = now; const b = W.b; b.frames++;
      if (gap > b.maxGap) b.maxGap = gap; if (gap > 50) b.gaps50++;
      for (const node of document.querySelectorAll("#rowTop > .pane:not(.chart-off)")) {
        let drawn = false;
        for (const f of node.querySelectorAll(".body > iframe:not(.slot-spare)")) {
          try { const h = f.contentDocument.querySelector("#chartSlot .sc-nchart"); if (h && h._series && h._series.length >= 2 && getComputedStyle(f).opacity > 0.02) { drawn = true; break; } } catch (_) {}
        }
        if (!drawn) b.blankMs += gap;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  slots = [];
  const t0 = Date.now();
  while (Date.now() - t0 < +opt.slots * 1000) {
    await page.waitForTimeout(10000);
    const p = procTree(), m = (await cdp.send("Performance.getMetrics")).metrics;
    const s = await page.evaluate(() => ({ heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      frames: document.querySelectorAll("iframe").length, spares: document.querySelectorAll("iframe.slot-spare").length,
      fades: window.__slot.fades, bucket: window.__slot.reset(),
      marks: SLOT_ROT.marks.map((x) => x ? x.at + "/" + x.of : "-").join(" "), charts: CHARTS.slice(0, CHART_COUNT).join(" ") }));
    s.bucket.maxGap = Math.round(s.bucket.maxGap); s.bucket.blankMs = Math.round(s.bucket.blankMs);
    slots.push({ t: Date.now() - t0, cpuSec: p.cpuSec, rssMB: p.rssMB, procs: p.procs, taskSec: +((m.find((x) => x.Name === "TaskDuration") || {}).Value || 0).toFixed(2), ...s });
    process.stdout.write(`slot t=${Math.round((Date.now() - t0) / 1000)}s fades=${s.fades} gap=${s.bucket.maxGap} blank=${s.bucket.blankMs} rss=${p.rssMB} heap=${s.heapMB} docs=${s.frames} spares=${s.spares}\n`);
  }
}
fs.writeFileSync(out, JSON.stringify({ root, W, order, net: { api: net.api, apiFail: net.apiFail.slice(0, 20), blocked: net.blocked }, logs, changes, slots }));
console.log("done", out, "api", net.api, "fail", net.apiFail.length, "blocked", net.blocked.length, "errors", logs.length);
await browser.close(); server.close();
