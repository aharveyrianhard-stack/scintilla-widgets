/* ST3 · the X pane's scroll, measured (headless; after M29's harness).
 *
 * The Station's X pane is not a list of posts: it is a live picture of a real x.com tab, which the
 * bridge extension scrolls and the pane crops and paints. So this runs the real pieces together:
 *   - the bridge from this checkout (content.js scrolls the source; background.js relays),
 *   - the pane from this checkout (station-shells/x-v2, or --shell <file>),
 *   - a stand-in x.com page with a ruler down its edge (x.com refuses an automated browser),
 *   - one tab capture of that page at the bridge's cap (1920x1080, at most 15 frames a second).
 * Disclosed differences from Alan's desk: the bridge's capture document is opened as a tab and handed
 * its stream through the browser's tab picker (a headless browser cannot press the extension's
 * shortcut) - everything it then does is the shipped code; the stand-in feed is plain boxes, lighter
 * than X's own page; and the pane's 60 s "page up" is held off during the measurement, because it is
 * a jump and not a scroll.
 *
 * usage: node xscroll.mjs --label before --speed 3 [--shell <index.html>] [--bridge <dir>] [--seconds 40] [--out <dir>] [--throttle 1] [--pace-check 1]
 * Headless only (new headless, the one that can load an extension). Nothing is written outside --out.
 */
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const LABEL = args.get("label") || "run";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../..");
const SHELL = args.get("shell") || path.join(REPO, "station-shells/x-v2/index.html");
const BRIDGE_SRC = args.get("bridge") || path.join(REPO, "station-x-bridge-draft");
const OUT = args.get("out") || path.join(HERE, "../data");
const SPEED = args.has("speed") ? Number(args.get("speed")) : null;   /* px/s saved in the bridge; null = its default */
const SECONDS = Number(args.get("seconds") || 40);
const THROTTLE = Number(args.get("throttle") || 1);
const PANE = (args.get("pane") || "520x820").split("x").map(Number);
const SCRATCH = await fsp.mkdtemp(path.join(os.tmpdir(), "st3-xscroll-"));
const say = (step, data) => console.log(LABEL, step.padEnd(12), JSON.stringify(data));

const BRIDGE = path.join(SCRATCH, "bridge");
await fsp.cp(BRIDGE_SRC, BRIDGE, { recursive: true, filter: (src) => !/\/tests(\/|$)/.test(src) });
const bridgeVersion = JSON.parse(fs.readFileSync(path.join(BRIDGE, "manifest.json"), "utf8")).version;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let file = decodeURIComponent(url.pathname);
  const send = (body, type) => { res.writeHead(200, { "content-type": type, "cache-control": "no-store" }); res.end(req.method === "HEAD" ? undefined : body); };
  if (/^\/(?:pane-x|station-shells\/x-v2)\/(?:index\.html)?$/.test(file)) return send(await fsp.readFile(SHELL), MIME[".html"]);
  if (file.endsWith("/")) file += "index.html";
  const abs = path.join(REPO, file);
  if (!abs.startsWith(REPO) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404).end("no"); return; }
  send(await fsp.readFile(abs), MIME[path.extname(abs)] || "application/octet-stream");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const context = await chromium.launchPersistentContext(path.join(SCRATCH, "profile"), {
  headless: true, channel: "chromium",   /* the new headless mode: no window, and extensions load */
  args: [`--disable-extensions-except=${BRIDGE}`, `--load-extension=${BRIDGE}`, "--no-first-run", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required", "--auto-select-tab-capture-source-by-title=Home / X", "--auto-accept-this-tab-capture", "--window-size=1200,900"],
  viewport: null,   /* the source tab keeps its real size: an emulated one is not what the capture sees */
});
let result = { label: LABEL, speedAsked: SPEED, bridgeVersion, shell: path.relative(REPO, SHELL), seconds: SECONDS, throttle: THROTTLE, pane: PANE };
try {
  const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 20000 });
  if (SPEED != null) await sw.evaluate(async (speed) => { await chrome.storage.local.set({ xFeedFloatSettings: { settingsVersion: 9, speedPxPerSecond: speed } }); }, SPEED);

  const FIXTURE = await fsp.readFile(path.join(HERE, "x-source-fixture.html"), "utf8");
  await context.route("https://x.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: FIXTURE }));
  /* every non-GET request is blocked (the local pages make none) */
  let blocked = 0;
  await context.route((u) => !/^https:\/\/x\.com\//.test(u.href), (route) => route.request().method() === "GET" ? route.continue() : (blocked++, route.abort("blockedbyclient")));
  const xPage = context.pages()[0] || await context.newPage();
  await xPage.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 60000 });
  await xPage.waitForTimeout(2500);

  const pane = await context.newPage();
  await pane.addInitScript(() => {
    const M = (window.__M = { paints: [], raf: [], lt: [], crops: 0, cropLog: [], read: true, last: null });
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) M.lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ entryTypes: ["longtask"] }); } catch {}
    let lastRaf = 0; const loop = (t) => { if (lastRaf && M.raf.length < 20000) M.raf.push(+(t - lastRaf).toFixed(1)); lastRaf = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    window.addEventListener("message", (e) => {
      if (e.data?.type !== "XFF_STATION_CROP") return;
      const c = e.data.crop || {}; M.crops++; M.last = c;
      if (M.cropLog.length < 6000) M.cropLog.push([+performance.now().toFixed(1), c.sourceScroll?.scrollTop ?? null, +(Number(c.fractionalScrollOffset) || 0).toFixed(3), c.captureGeneration ?? null, c.sourceMetrics?.captureAckFallbacks ?? null, c.sourceMetrics?.runawayOffsetResets ?? null]);
    }, true);
    /* each paint of the pane's canvas: where the ruler's bars landed */
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (src, ...a) {
      const t0 = performance.now();
      const r = draw.call(this, src, ...a);
      if (this.canvas.id !== "cv" || a.length !== 8) return r;
      const row = [+t0.toFixed(1)];
      if (M.read) {
        try {
          const dx = a[4], dw = a[6], x0 = Math.round(dx + dw * 0.30), w = Math.max(4, Math.round(dw * 0.02)), h = this.canvas.height;
          const d = this.getImageData(x0, 0, w, h).data, lum = new Float32Array(h);
          let lo = 1e9, hi = -1;
          for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; s += d[i] + d[i + 1] + d[i + 2]; } lum[y] = s / (w * 3); if (lum[y] < lo) lo = lum[y]; if (lum[y] > hi) hi = lum[y]; }
          const mid = (lo + hi) / 2, bars = [];
          if (hi - lo > 80) for (let y = 1; y < h - 1; y++) if (lum[y] > mid && lum[y - 1] <= mid) {
            let a0 = y - 2, b0 = y; while (b0 < h - 1 && lum[b0] > mid) b0++; b0 += 1;
            if (a0 < 0 || b0 >= h) { y = b0; continue; }
            let sw = 0, sy = 0; for (let k = a0; k <= b0; k++) { const wgt = Math.max(0, lum[k] - lo); sw += wgt; sy += wgt * k; }
            bars.push(+(sy / sw).toFixed(3)); y = b0;
          }
          row.push(bars.slice(0, 8));
        } catch (e) { row.push(String(e).slice(0, 60)); }
      } else row.push(null);
      row.push(M.last ? [M.last.sourceScroll?.scrollTop ?? null, +(Number(M.last.fractionalScrollOffset) || 0).toFixed(3)] : null);
      /* what the pane read from this frame's corner (null before 0.7.24), and the source rows it drew from */
      try { row.push(typeof stationFrameCode === "undefined" ? null : stationFrameCode, +Number(a[1]).toFixed(3), typeof stationFrameSerial === "undefined" ? null : stationFrameSerial); } catch { row.push(null); }
      if (M.paints.length < 20000) M.paints.push(row);
      return r;
    };
  });
  if (process.env.ST3_DEBUG) { pane.on("console", (m) => say("pane.console", { t: m.text().slice(0, 200) })); xPage.on("console", (m) => say("x.console", { t: m.text().slice(0, 200) })); }
  await pane.setViewportSize({ width: PANE[0], height: PANE[1] });
  await pane.goto(`${BASE}/pane-x/`, { waitUntil: "domcontentloaded" });
  await pane.waitForTimeout(2000);

  /* The bridge's own capture document, opened as a tab so it can be handed its stream: its offer,
     answer and "this frame has been captured" code are the shipped code. Only the way the stream is
     obtained differs - the browser's tab picker (auto-accepted) instead of the extension's shortcut. */
  const extId = new URL(sw.url()).host;
  const holder = await context.newPage();
  await holder.goto(`chrome-extension://${extId}/offscreen.html`, { waitUntil: "domcontentloaded" });
  await holder.evaluate(() => {
    const b = document.createElement("button"); b.id = "go"; b.textContent = "take the capture"; document.body.appendChild(b);
    b.addEventListener("click", async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser", width: { max: 1920 }, height: { max: 1080 }, frameRate: { ideal: 15, max: 15 } }, audio: false,
          preferCurrentTab: false, selfBrowserSurface: "exclude", surfaceSwitching: "include" });
        captureStream = stream;                       /* offscreen.js's own variables */
        captureVideo = document.createElement("video");
        captureVideo.muted = true; captureVideo.playsInline = true; captureVideo.srcObject = stream;
        document.body.appendChild(captureVideo); await captureVideo.play();
        const st = stream.getVideoTracks()[0].getSettings();
        window.__HOLDER = { ok: true, width: st.width, height: st.height, frameRate: st.frameRate };
      } catch (error) { window.__HOLDER = { ok: false, error: error.name + ": " + error.message }; }
    });
  });
  await holder.click("#go");
  await holder.waitForTimeout(2500);
  result.capture = await holder.evaluate(() => window.__HOLDER || { ok: false, error: "no result" });
  say("capture", result.capture);
  if (!result.capture.ok) throw new Error("no capture: " + result.capture.error);

  const xTabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: ["https://x.com/*"] }))[0]?.id ?? null);
  result.relay = await sw.evaluate(async (tabId) => {
    stationSourceTabId = tabId;                    /* what the shortcut's capture would have set */
    await persistStationSession();
    const ok = await reconnectStationConsumers({ controlSource: true });
    return { ok, consumers: stationConsumers.size };
  }, xTabId).catch((e) => ({ ok: false, why: e.message }));
  say("relay", result.relay);
  /* the pane's 60 s "page up" is held off while the motion is measured (it is a jump, not a scroll):
     its own clock is told the last one has just happened */
  await pane.evaluate(() => { xRefreshAt = Date.now(); setInterval(() => { xRefreshAt = Date.now(); }, 2000); });
  await pane.bringToFront();
  /* wait until the pane holds a decoded picture and the source's crops are arriving */
  for (let i = 0; i < 20; i++) {
    await pane.waitForTimeout(1500);
    const st = await pane.evaluate(() => ({ crops: window.__M.crops, vw: document.getElementById("v").videoWidth, state: document.getElementById("xfState")?.textContent || "", link: window.__SCINTILLA_X_LINK || null }));
    if (process.env.ST3_DEBUG) say("wait", st);
    if (st.crops > 5 && st.vw > 0) break;
  }
  await pane.waitForTimeout(3000);

  const cdp = await context.newCDPSession(pane);
  await cdp.send("Performance.enable");
  if (THROTTLE > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  const perf = async () => { const o = {}; for (const m of (await cdp.send("Performance.getMetrics")).metrics) o[m.name] = m.value; return o; };
  const video = () => pane.evaluate(() => { const v = document.getElementById("v"), q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : {}; return { w: v.videoWidth, h: v.videoHeight, frames: q.totalVideoFrames || 0, dropped: q.droppedVideoFrames || 0 }; });
  const phase = async (read, seconds) => {
    await pane.evaluate((r) => { const M = window.__M; M.read = r; M.paints = []; M.raf = []; M.lt = []; M.cropLog = []; M.crops = 0; }, read);
    const p0 = await perf(), v0 = await video(), s0 = await xPage.evaluate(() => document.scrollingElement.scrollTop), t0 = Date.now();
    await pane.waitForTimeout(seconds * 1000);
    const p1 = await perf(), v1 = await video(), s1 = await xPage.evaluate(() => document.scrollingElement.scrollTop), dt = (Date.now() - t0) / 1000;
    const m = await pane.evaluate(() => { const M = window.__M; return { paints: M.paints, raf: M.raf, lt: M.lt, crops: M.crops, cropLog: M.cropLog, cadence: window.__SCINTILLA_X_CADENCE || null, canvas: [document.getElementById("cv").width, document.getElementById("cv").height], state: document.getElementById("xfState")?.textContent || "" }; });
    return { seconds: dt, sourcePx: s1 - s0, sourcePxPerS: +((s1 - s0) / dt).toFixed(2), video: { w: v1.w, h: v1.h, decoded: v1.frames - v0.frames, dropped: v1.dropped - v0.dropped },
      taskS: +(p1.TaskDuration - p0.TaskDuration).toFixed(3), scriptS: +(p1.ScriptDuration - p0.ScriptDuration).toFixed(3), heapMB: +(p1.JSHeapUsedSize / 1048576).toFixed(1), ...m };
  };
  if (process.env.ST3_DEBUG) {
    await xPage.screenshot({ path: path.join(OUT, `${LABEL}-source.png`) }).catch((e) => say("shot", { e: String(e) }));
    const grab = await pane.evaluate(() => { const v = document.getElementById("v"), c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0); return { url: c.toDataURL("image/png"), crop: window.__M.last }; });
    await fsp.mkdir(OUT, { recursive: true });
    await fsp.writeFile(path.join(OUT, `${LABEL}-frame.png`), Buffer.from(grab.url.split(",")[1], "base64"));
    say("crop", { rect: grab.crop?.rect, viewport: grab.crop?.viewport, scrollCode: grab.crop?.scrollCode, dpr: grab.crop?.viewportDpr, sourceCropped: grab.crop?.sourceCropped, speed: grab.crop?.speedPxPerSecond });
  }
  result.motion = await phase(true, SECONDS);      /* with the ruler read on every paint: how the picture really moved */
  await pane.screenshot({ path: path.join(OUT, `${LABEL}-pane.png`) }).catch(() => {});
  result.cost = await phase(false, SECONDS);       /* without the read: what the pane itself costs */
  /* --pace-check 1: the pace choice, end to end - open the ⋯, press 2×, and see the source really go twice as fast */
  if (args.get("pace-check")) {
    const srcSpeed = async (ms) => { const a = await xPage.evaluate(() => document.scrollingElement.scrollTop), t = Date.now(); await pane.waitForTimeout(ms); return +(((await xPage.evaluate(() => document.scrollingElement.scrollTop)) - a) / ((Date.now() - t) / 1000)).toFixed(2); };
    const row = () => pane.evaluate(() => ({ shown: [...document.querySelectorAll("#xMore .xs")].map((b) => [b.textContent, !b.hidden && getComputedStyle(b).display !== "none", b.classList.contains("on")]), reported: xfloatCrop?.speedPxPerSecond ?? null }));
    const check = { before: await row(), beforePxPerS: await srcSpeed(6000) };
    await pane.click("#bXMore"); await pane.waitForTimeout(400);
    await pane.screenshot({ path: path.join(OUT, `${LABEL}-more.png`) }).catch(() => {});
    check.panelOpen = await row();
    const two = pane.locator('#xMore .xs[data-v="6"]');
    if (await two.isVisible().catch(() => false)) { await two.click(); await pane.waitForTimeout(1500); check.after2x = await row(); check.after2xPxPerS = await srcSpeed(6000);
      await pane.click("#bXMore"); await pane.waitForTimeout(300); await pane.click('#xMore .xs[data-v="3"]'); await pane.waitForTimeout(1500); check.backTo1x = await row(); check.backTo1xPxPerS = await srcSpeed(6000); }
    result.paceCheck = check; say("pace", check);
  }
  /* what one reading of the scroll code costs this pane, on frames that keep changing (bridge 0.7.24 only) */
  result.codeReadMs = await pane.evaluate(() => new Promise((resolve) => {
    if (typeof readStationScrollCode !== "function" || !xfloatCrop?.scrollCode) return resolve(null);
    const v = document.getElementById("v"), ms = []; let n = 0;
    const step = () => { const t = performance.now(); readStationScrollCode(v, xfloatCrop); ms.push(performance.now() - t);
      if (++n < 240) requestAnimationFrame(step); else { ms.sort((a, b) => a - b); resolve({ n, mean: +(ms.reduce((a, b) => a + b, 0) / n).toFixed(3), p50: +ms[n >> 1].toFixed(3), p95: +ms[Math.floor(n * .95)].toFixed(3), max: +ms[n - 1].toFixed(3) }); } };
    requestAnimationFrame(step);
  })).catch(() => null);
  result.blocked = blocked;
} catch (error) { result.error = String(error?.stack || error).slice(0, 600); say("error", { error: result.error }); }
await fsp.mkdir(OUT, { recursive: true });
await fsp.writeFile(path.join(OUT, `${LABEL}-raw.json`), JSON.stringify(result));
await context.close().catch(() => {});
server.close();
await fsp.rm(SCRATCH, { recursive: true, force: true }).catch(() => {});
say("done", { error: result.error || null, codeReadMs: result.codeReadMs, source: result.motion?.sourcePxPerS, paints: result.motion?.paints?.length, bars: result.motion?.paints?.slice(-1)[0] });
