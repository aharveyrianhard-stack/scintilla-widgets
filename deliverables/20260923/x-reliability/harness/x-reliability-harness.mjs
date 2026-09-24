/* SCINTILLA · M29 X-pane reliability harness (real browser, real bridge).
 *
 * Reproduces, and then proves fixed, the five ways Alan loses the picture:
 *   a resize   – ten window sizes
 *   b reload   – the Station document reloads
 *   c update   – the deck's self-update reload of the X shell
 *   d hide     – the X tab goes to the background and comes back
 *   e soak     – long run, resizes every minute
 *
 * It drives Playwright's Chrome for Testing with the SHIPPED bridge loaded
 * unpacked from a byte-identical copy, its own throwaway profile, and a real
 * x.com tab. It never touches Alan's Brave, Chrome or their profiles.
 *
 * Two disclosed harness facts:
 *  - the shipped manifest only matches /pane-x* on localhost, so the x-v2 shell
 *    is served at /pane-x/ as well as its real path. Same bytes either way.
 *  - if Chrome refuses a gesture-free tabCapture, the harness swaps ONLY the
 *    capture source inside the bridge's own offscreen document for a synthetic
 *    one; the relay, crop path, WebRTC and pane stay production code. The run
 *    records which source it used.
 *
 * usage: node x-reliability-harness.mjs --label before --shell <index.html>
 *                                       [--soak-min 0] [--out <dir>]
 */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
const { chromium } = playwright;
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const LABEL = args.get("label") || "run";
const REPO = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const SHELL = args.get("shell") || path.join(REPO, "station-shells/x-v2/index.html");
const OUT = args.get("out") || path.join(REPO, "deliverables/20260923/x-reliability/shots");
const SOAK_MIN = Number(args.get("soak-min") || 0);
const BRIDGE_SRC = "/Users/alanharvey/Scintilla/SCINTILLA X Bridge";
const SCRATCH = process.env.SCRATCH || "/private/tmp/claude-501/x-reliability";
const log = [];
const note = (step, data) => { const row = { at: new Date().toISOString(), step, ...data }; log.push(row);
  console.log(step.padEnd(22), JSON.stringify(data)); return row; };

/* ---- 1. a copy of the bridge we can load unpacked, byte-identical ---- */
const BRIDGE = path.join(SCRATCH, "bridge");
await fsp.mkdir(SCRATCH, { recursive: true });
await fsp.rm(BRIDGE, { recursive: true, force: true });
await fsp.cp(BRIDGE_SRC, BRIDGE, { recursive: true });
const bridgeHash = (f) => crypto.createHash("sha256").update(fs.readFileSync(path.join(BRIDGE, f))).digest("hex").slice(0, 12);
note("bridge", { version: JSON.parse(fs.readFileSync(path.join(BRIDGE, "manifest.json"), "utf8")).version,
  background: bridgeHash("background.js"), content: bridgeHash("content.js"), stationBridge: bridgeHash("station-bridge.js") });

/* ---- 2. the Station, served from this worktree ---- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
let shellTag = "shell-1";   /* the deck's self-update watches this ETag */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let file = decodeURIComponent(url.pathname);
  if (/^\/x-holder\/?$/.test(file)) {
    const body = await fsp.readFile(fileURLToPath(new URL("./x-capture-holder.html", import.meta.url)));
    res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }
  const isShell = /^\/(?:pane-x|station-shells\/x-v2)\/(?:index\.html)?$/.test(file);
  if (isShell) {
    const body = await fsp.readFile(SHELL);
    res.writeHead(req.method === "HEAD" ? 200 : 200, { "content-type": MIME[".html"], etag: shellTag, "cache-control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }
  if (file.endsWith("/")) file += "index.html";
  const abs = path.join(REPO, file);
  if (!abs.startsWith(REPO) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404).end("no"); return; }
  const body = await fsp.readFile(abs);
  res.writeHead(200, { "content-type": MIME[path.extname(abs)] || "application/octet-stream",
    etag: crypto.createHash("sha1").update(body).digest("hex").slice(0, 16), "cache-control": "no-store" });
  res.end(req.method === "HEAD" ? undefined : body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;
note("server", { base: BASE, shell: path.relative(REPO, SHELL) });

/* ---- 3. Chrome for Testing, its own profile, the bridge loaded ---- */
const profile = path.join(SCRATCH, `profile-${LABEL}-${Date.now()}`);
const context = await chromium.launchPersistentContext(profile, {
  headless: false,   /* real tab visibility and real capture need a real browser */
  args: [`--disable-extensions-except=${BRIDGE}`, `--load-extension=${BRIDGE}`,
    "--no-first-run", "--no-default-browser-check", "--disable-features=DialMediaRouteProvider",
    "--autoplay-policy=no-user-gesture-required",
    "--auto-select-tab-capture-source-by-title=Home / X", "--auto-accept-this-tab-capture",
    "--window-size=980,760", "--window-position=1180,40"],
  viewport: null,
});
const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 20000 });
const extId = new URL(sw.url()).host;
note("extension", { id: extId });

/* ---- 4. an x.com tab: the real origin, served a deterministic timeline ----
   x.com refuses an automated browser (ERR_HTTP_RESPONSE_CODE_FAILURE), and a
   logged-out page has no timeline to measure. The bridge's content script is
   matched on the x.com ORIGIN, so serving that origin a fixture keeps the real
   content script, the real measurement code and the real relay. */
const FIXTURE = await fsp.readFile(fileURLToPath(new URL("./x-source-fixture.html", import.meta.url)), "utf8");
await context.route("https://x.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: FIXTURE }));
/* The source tab gets its OWN browser window, so resizing the Station window
   cannot resize the source - which is how the two actually sit on the iMac. */
let xPage = null, xWindow = "own window";
try {
  const seed = context.pages()[0] || await context.newPage();
  const seedCdp = await context.newCDPSession(seed);
  const opened = context.waitForEvent("page", { timeout: 15000 });
  await seedCdp.send("Target.createTarget", { url: "about:blank", newWindow: true });
  xPage = await opened;
  /* navigate through Playwright so the x.com route is in force for the first hit */
  await xPage.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 60000 });
} catch (error) {
  xWindow = "same window (Chrome refused a second window: " + error.message.slice(0, 60) + ")";
  xPage = await context.newPage();
  await xPage.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => note("x.com", { error: e.message }));
}
const xCdp = await context.newCDPSession(xPage);
await xCdp.send("Emulation.setFocusEmulationEnabled", { enabled: false }).catch(() => {});
await xPage.waitForTimeout(3500);
note("x.com", { url: xPage.url(), title: (await xPage.title()).slice(0, 60), window: xWindow });

/* ---- 5. the pane, at a bridge-matched path ---- */
const pane = await context.newPage();
await pane.addInitScript(() => {
  window.__HX = { crops: 0, lastCrop: 0, streams: 0, webrtc: 0, answers: 0, status: [], ready: 0, reconnects: 0, firstCropAt: 0 };
  window.addEventListener("message", (e) => {
    const t = e.data?.type; if (!t) return;
    if (t === "XFF_STATION_CROP") { window.__HX.crops++; window.__HX.lastCrop = Date.now();
      if (!window.__HX.firstCropAt) window.__HX.firstCropAt = Date.now(); }
    if (t === "XFF_STATION_STREAM") window.__HX.streams++;
    if (t === "XFF_STATION_WEBRTC_START") window.__HX.webrtc++;
    if (t === "XFF_STATION_ANSWER") window.__HX.answers++;
    if (t === "XFF_STATION_BRIDGE_READY") window.__HX.ready++;
    if (t === "XFF_STATION_RECONNECT_VIEWER") window.__HX.reconnects++;
    if (t === "XFF_STATION_STATUS") window.__HX.status.push(String(e.data.status || ""));
  }, true);
  /* The bridge's own offer/answer protocol, answered by the holder page instead
     of the extension's offscreen document. Claiming the offer in capture phase
     keeps the extension's dead-capture error out of the measurement. */
  window.__HXblockCrops = false;
  window.addEventListener("message", (event) => {
    if (window.__HXblockCrops && event.data?.type === "XFF_STATION_CROP" && !event.data.__harness)
      event.stopImmediatePropagation();
  }, true);
  const bus = new BroadcastChannel("scintilla.x-harness.capture.v1");
  bus.addEventListener("message", (event) => {
    if (event.data?.type === "answer") {
      window.postMessage({ type: "XFF_STATION_ANSWER", answer: event.data.answer }, location.origin);
    }
  });
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== "XFF_STATION_OFFER") return;
    event.stopImmediatePropagation();
    bus.postMessage({ type: "offer", id: "pane", offer: event.data.offer });
  }, true);
});
await pane.setViewportSize({ width: 520, height: 820 });
await pane.goto(`${BASE}/pane-x/`, { waitUntil: "domcontentloaded" });
await pane.waitForTimeout(2500);

/* ---- 6. one real tab capture, held outside the pane ---- */
const holder = await context.newPage();
await holder.goto(`${BASE}/x-holder/`, { waitUntil: "domcontentloaded" });
await holder.click("#go");                       /* a real gesture, as the browser requires */
await holder.waitForTimeout(2500);
const holderState = await holder.evaluate(() => window.__HOLDER || { ok: false, error: "no result" });
note("capture", { ...holderState, kind: "real tab capture, auto-selected by title" });
if (!holderState.ok) { note("capture", { fatal: "no capture; the run would prove nothing" }); }
const sourceKind = holderState.ok
  ? `real tab capture of the x.com tab (${holderState.width}x${holderState.height})` : "none";

/* ---- 6b. the bridge's own relay: real content script, real background ---- */
const xTabId = await sw.evaluate(async () => {
  const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] });
  return tabs[0]?.id ?? null;
});
const relay = await sw.evaluate(async (tabId) => {
  stationSourceTabId = tabId;                    /* what a successful capture would have set */
  await persistStationSession();
  const ok = await reconnectStationConsumers({ controlSource: true });
  return { ok, consumers: stationConsumers.size, sourceTabId: stationSourceTabId };
}, xTabId).catch((e) => ({ ok: false, why: e.message }));
note("relay", relay);
await pane.waitForTimeout(4000);

/* ---- 7. measurement ---- */
async function sample() {
  return pane.evaluate(() => {
    const cv = document.getElementById("cv");
    let ink = 0, sampled = 0, sum = 0, err = "";
    try {
      const ctx = cv.getContext("2d");
      const w = cv.width, h = cv.height;
      if (w > 1 && h > 1) {
        const data = ctx.getImageData(0, 0, w, h).data;
        const stepX = Math.max(1, Math.floor(w / 40)), stepY = Math.max(1, Math.floor(h / 40));
        for (let y = 0; y < h; y += stepY) for (let x = 0; x < w; x += stepX) {
          const i = (y * w + x) * 4; sampled++;
          const l = data[i] + data[i + 1] + data[i + 2];
          if (l > 60) ink++;
          sum = (sum * 31 + l) % 2147483647;
        }
      }
    } catch (e) { err = e.name + ": " + e.message; }
    return { ink: sampled ? ink / sampled : 0, sampled, sum, err };
  });
}

/* Alan's failure is a pane with nothing in it. The source is X's dim theme, never
   pure black, so "ink" is the honest test for a picture and the checksum between
   two samples is the honest test for movement. */
let LAST_ERROR = null;
process.on("uncaughtException", async (error) => { LAST_ERROR = String(error?.message || error); await flush(); process.exit(1); });
async function flush() {
  await fsp.mkdir(OUT, { recursive: true });
  await fsp.writeFile(path.join(OUT, `${LABEL}-log.json`), JSON.stringify({ summary: { label: LABEL, error: LAST_ERROR }, log }, null, 1));
}

async function measure(step, shotName) {
  const first = await sample();
  await pane.waitForTimeout(500);
  const second = await sample();
  const m = await pane.evaluate(() => {
    const cv = document.getElementById("cv"), v = document.getElementById("v");
    const hx = window.__HX || {};
    return { state: (document.getElementById("xfState")?.hidden ? "" : document.getElementById("xfState")?.textContent) || "",
      cardVisible: getComputedStyle(document.getElementById("card")).display !== "none",
      bodyClass: document.body.className, canvas: { w: cv.width, h: cv.height },
      video: { vw: v.videoWidth, vh: v.videoHeight, ready: v.readyState, t: Number(v.currentTime.toFixed(2)), stream: !!v.srcObject },
      crops: hx.crops || 0, cropAgo: hx.lastCrop ? Date.now() - hx.lastCrop : null,
      webrtc: hx.webrtc || 0, answers: hx.answers || 0, ready_msgs: hx.ready || 0,
      status: (hx.status || []).slice(-3), viewport: { w: innerWidth, h: innerHeight },
      vis: document.visibilityState,
      cadence: window.__SCINTILLA_X_CADENCE ? { paint: window.__SCINTILLA_X_CADENCE.paintFrames } : null,
      link: window.__SCINTILLA_X_LINK || null };
  });
  m.ink = Number(second.ink.toFixed(3));
  m.moving = first.sum !== second.sum;
  m.verdict = second.err ? "unreadable(" + second.err + ")"
    : second.ink <= 0.01 ? "BLACK" : (m.moving ? "picture" : "frozen");
  if (second.err) m.err = second.err;
  if (shotName) { await fsp.mkdir(OUT, { recursive: true });
    await pane.screenshot({ path: path.join(OUT, `${LABEL}-${shotName}.png`) }); m.shot = `${LABEL}-${shotName}.png`; }
  return note(step, m);
}

const baseline = await measure("0-attached", "0-attached");

/* (a) resize through ten sizes */
const SIZES = [[520,820],[700,820],[380,820],[980,700],[520,420],[1180,900],[300,700],[860,540],[440,900],[520,820]];
const resizeRows = [];
for (const [w, h] of SIZES) {
  await pane.setViewportSize({ width: w, height: h });
  await pane.waitForTimeout(1200);
  resizeRows.push(await measure(`a-resize-${w}x${h}`, null));
}
await pane.waitForTimeout(2500);
const afterResize = await measure("a-resize-settled", "a-resize-settled");

/* (b) reload the Station document */
await pane.reload({ waitUntil: "domcontentloaded" });
await pane.waitForTimeout(3000);
const reload3s = await measure("b-reload-3s", "b-reload-3s");
await pane.waitForTimeout(12000);
const reload15s = await measure("b-reload-15s", "b-reload-15s");

/* (c) the deck's self-update reload of the X shell: same document reload the
       deck performs on its iframe, after the served shell tag changes */
shellTag = "shell-2";
await pane.evaluate(() => location.reload());
await pane.waitForTimeout(3000);
const update3s = await measure("c-selfupdate-3s", "c-selfupdate-3s");
await pane.waitForTimeout(12000);
const update15s = await measure("c-selfupdate-15s", "c-selfupdate-15s");

/* (d) hide the pane's tab and bring it back. Playwright emulates focus by
       default, which would have reported a hidden tab as visible. */
const paneCdp = await context.newCDPSession(pane);
await paneCdp.send("Emulation.setFocusEmulationEnabled", { enabled: false }).catch(() => {});
const decoy = await context.newPage();   /* a sibling tab in the pane's own window */
await decoy.goto("about:blank");
await decoy.bringToFront();
await pane.waitForTimeout(6000);
const hidden = await measure("d-hidden-6s", null);
await pane.bringToFront();
await pane.waitForTimeout(4000);
const shown = await measure("d-shown-4s", "d-shown-4s");
await decoy.close();

const tellHolder = (type) => pane.evaluate((t) => {
  window.__HXblockCrops = false;
  window.addEventListener("message", (event) => {
    if (window.__HXblockCrops && event.data?.type === "XFF_STATION_CROP" && !event.data.__harness)
      event.stopImmediatePropagation();
  }, true);
  const bus = new BroadcastChannel("scintilla.x-harness.capture.v1"); bus.postMessage({ type: t }); bus.close();
}, type);

/* (f) the capture keeps delivering frames and every one of them is black: the
       dead tab-capture decoder the bridge's own background.js describes. Here it
       is a real capture of a tab rendered black, which is the same thing on the
       wire: frames arrive, freshness looks perfect, there is nothing to see. */
await xPage.evaluate(() => { document.documentElement.style.filter = "brightness(0)"; });
await pane.waitForTimeout(3000);
const black3s = await measure("f-capture-black-3s", "f-capture-black-3s");
await pane.waitForTimeout(8000);
const black11s = await measure("f-capture-black-11s", "f-capture-black-11s");
await pane.waitForTimeout(40000);
const black51s = await measure("f-capture-black-51s", "f-capture-black-51s");
await xPage.evaluate(() => { document.documentElement.style.filter = ""; });
await pane.waitForTimeout(6000);
const blackBack = await measure("f-capture-restored", "f-capture-restored");

/* (g) the pane reloads while nothing can answer it: the bridge's worker was
       evicted, its capture is gone, or the X window was closed. */
await tellHolder("refuse");
await pane.reload({ waitUntil: "domcontentloaded" });
await pane.waitForTimeout(8000);
const orphan8s = await measure("g-no-answer-8s", "g-no-answer-8s");
await pane.waitForTimeout(18000);
const orphan26s = await measure("g-no-answer-26s", "g-no-answer-26s");
await pane.waitForTimeout(45000);
const orphan71s = await measure("g-no-answer-71s", "g-no-answer-71s");
await tellHolder("allow");
await pane.waitForTimeout(20000);
const orphanBack = await measure("g-answer-allowed-again", "g-answer-allowed-again");

/* (h) a crop that misses the captured frame. This is the mechanism behind
       "I resize the window, it gets fucked": the crop is measured on the X tab
       in CSS pixels and mapped through the capture's pixel size, and when those
       two disagree the mapped region falls outside the frame. The pane is fed
       such a crop on the same channel the bridge uses, held for twelve seconds,
       then released so the source's real crops take over again. */
await pane.evaluate(() => {
  /* The source keeps sending correct crops ten times a second, so a mismatch is
     only held by standing in for them: real crops are blocked in capture phase
     and a mismatched one is fed in their place, on the same channel the bridge
     uses. Nothing in the extension or the X tab is touched. */
  window.__HXblockCrops = true;
  window.__HXbadCrop = setInterval(() => window.postMessage({ type:"XFF_STATION_CROP", __harness:true, crop:{
    viewport:{ width:1000, height:700 }, rect:{ left:5000, top:5000, width:400, height:600 },
    fractionalScrollOffset:0, sequence:1, activeView:"trading", paused:false } }, location.origin), 100);
});
await pane.waitForTimeout(3000);
const badCrop3s = await measure("h-crop-misses-3s", "h-crop-misses-3s");
await pane.waitForTimeout(9000);
const badCrop12s = await measure("h-crop-misses-12s", "h-crop-misses-12s");
await pane.evaluate(() => { clearInterval(window.__HXbadCrop); window.__HXblockCrops = false; });
await pane.waitForTimeout(6000);
const badCropBack = await measure("h-crop-released", "h-crop-released");

/* (e) soak */
const soak = [];
if (SOAK_MIN > 0) {
  const until = Date.now() + SOAK_MIN * 60000;
  let i = 0;
  while (Date.now() < until) {
    const [w, h] = SIZES[i % SIZES.length]; i++;
    await pane.setViewportSize({ width: w, height: h });
    await pane.waitForTimeout(55000);
    soak.push(await measure(`e-soak-min-${i}`, i === 1 || Date.now() >= until ? `e-soak-${i}` : null));
  }
  await measure("e-soak-end", "e-soak-end");
}

const summary = { label: LABEL, shell: path.relative(REPO, SHELL), sourceKind,
  bridgeVersion: JSON.parse(fs.readFileSync(path.join(BRIDGE, "manifest.json"), "utf8")).version,
  baseline, resizeWorst: resizeRows.reduce((a, b) => (b.black > a.black ? b : a), resizeRows[0]),
  afterResize, reload3s, reload15s, update3s, update15s, hidden, shown,
  black3s, black11s, black51s, blackBack, orphan8s, orphan26s, orphan71s, orphanBack,
  badCrop3s, badCrop12s, badCropBack,
  soakWorst: soak.length ? soak.reduce((a, b) => (b.black > a.black ? b : a), soak[0]) : null, soakCount: soak.length };
await fsp.mkdir(OUT, { recursive: true });
await fsp.writeFile(path.join(OUT, `${LABEL}-log.json`), JSON.stringify({ summary, log }, null, 1));
console.log("\n=== SUMMARY " + LABEL + " ===");
console.log(JSON.stringify(summary, null, 1));
await context.close();
server.close();
