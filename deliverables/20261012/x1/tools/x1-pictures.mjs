/* X1 · pictures for Alan, headless (12 Oct 2026; after ST3's xscroll.mjs rig).
 *
 * One run = one X column as the pane would show it on the iMac: the REAL bridge (a folder: 0.7.21 as archived on the
 * iMac, or this branch's 0.7.25) loaded as an unpacked extension in a hidden Chromium, scrolling a stand-in x.com page
 * (x.com refuses an automated browser) in a window the size of Alan's X window (1062 × 640 CSS px on a 2x screen, so the
 * tab capture comes out 1792 × 1080 as the iMac's health rows say), feeding the REAL pane (the deployed shell, or this
 * branch's) at the iMac's pane size (255 × 450 under the bar, dpr 2). The pane is photographed three times, --every
 * seconds apart, so a still picture shows the pace; the crop, the draw and the bar are recorded.
 * Disclosed differences from the iMac: the capture is handed to the bridge's own capture document through the browser's
 * tab picker (a headless browser cannot press the extension's shortcut) - everything after that is the shipped code;
 * the feed is a stand-in; the pane's timed page-up is held off (a jump, not a scroll).
 *
 * usage: node x1-pictures.mjs --label today-1x --bridge <dir> --shell <index.html> --speed 3 --out <dir> [--every 10] [--frames 3] [--window 1062x640] [--pane 255x450]
 * Headless only. Nothing is written outside --out. */
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
const SHELL = path.resolve(args.get("shell") || path.join(REPO, "station-shells/x-v2/index.html"));
const BRIDGE_SRC = path.resolve(args.get("bridge") || path.join(REPO, "station-x-bridge-draft"));
const OUT = path.resolve(args.get("out") || path.join(HERE, "../data"));
const SPEED = args.has("speed") ? Number(args.get("speed")) : null;
const EVERY = Number(args.get("every") || 10), FRAMES = Number(args.get("frames") || 3);
const WINDOW = (args.get("window") || "1062x640").split("x").map(Number);
/* headless Chromium keeps 87 px of window for its own frame: the window is asked for that much more, and the X page's
   innerWidth × innerHeight is reported (the capture sees the page, not the frame) */
const WINDOW_FRAME_PX = Number(args.get("frame") || 87);
/* the iMac's pane iframe is 255 × 479 (the bar 29 px, the picture 450 under it); the bridge sizes the X column from
   the iframe, so the bar is held at the iMac's height and the window at the iframe's size */
const BAR_PX = Number(args.get("bar") || 29);
const PANE = (args.get("pane") || "255x450").split("x").map(Number);
const SCRATCH = await fsp.mkdtemp(path.join(os.tmpdir(), "x1-pictures-"));
const say = (step, data) => console.log(LABEL, step.padEnd(10), JSON.stringify(data));

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
  headless: true, channel: "chromium",
  args: [`--disable-extensions-except=${BRIDGE}`, `--load-extension=${BRIDGE}`, "--no-first-run", "--mute-audio", "--force-device-scale-factor=2",
    "--autoplay-policy=no-user-gesture-required", "--auto-select-tab-capture-source-by-title=Home / X", "--auto-accept-this-tab-capture", `--window-size=${WINDOW[0]},${WINDOW[1] + WINDOW_FRAME_PX}`],
  viewport: null,   /* the source tab keeps its real window size: the capture must see the real thing */
});
import { createHash } from "node:crypto";
const sha = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
let result = { label: LABEL, bridgeVersion, bridge: BRIDGE_SRC, bridgeContentSha256: sha(path.join(BRIDGE, "content.js")), shell: path.relative(REPO, SHELL), shellSha256: sha(SHELL),
  speedAsked: SPEED, every: EVERY, frames: FRAMES, window: WINDOW, pane: PANE, at: new Date().toISOString() };
try {
  const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 20000 });
  if (SPEED != null) await sw.evaluate(async (speed) => { await chrome.storage.local.set({ xFeedFloatSettings: { settingsVersion: 9, speedPxPerSecond: speed } }); }, SPEED);

  const FIXTURE = await fsp.readFile(path.join(HERE, "x-source-fixture.html"), "utf8");
  await context.route("https://x.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: FIXTURE }));
  let blocked = 0;
  await context.route((u) => !/^https:\/\/x\.com\//.test(u.href), (route) => route.request().method() === "GET" ? route.continue() : (blocked++, route.abort("blockedbyclient")));
  const xPage = context.pages()[0] || await context.newPage();
  await xPage.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 60000 });
  await xPage.waitForTimeout(2000);
  const xWindow = () => xPage.evaluate(() => ({ innerWidth: innerWidth, innerHeight: innerHeight, dpr: devicePixelRatio, column: (({ left, width }) => ({ left, width }))(document.querySelector('[data-testid="primaryColumn"]').getBoundingClientRect()),
    textLeft: document.querySelector('[data-testid="tweetText"]').getBoundingClientRect().left, caretRight: document.querySelector('[data-testid="caret"]').getBoundingClientRect().right }));
  result.xWindow = await xWindow();
  say("x window", result.xWindow);

  const pane = await context.newPage();
  await pane.addInitScript(() => {
    const M = (window.__M = { crops: 0, last: null, draws: 0, draw: null });
    window.addEventListener("message", (e) => { if (e.data?.type === "XFF_STATION_CROP") { M.crops++; M.last = e.data.crop; } }, true);
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (src, ...a) {
      const r = draw.call(this, src, ...a);
      if (this.canvas.id === "cv" && a.length === 8) { M.draws++; M.draw = { sx: a[0], sy: a[1], sw: a[2], sh: a[3], dx: a[4], dy: a[5], dw: a[6], dh: a[7], cw: this.canvas.width, ch: this.canvas.height }; }
      return r;
    };
  });
  /* the pane: 255 CSS px wide, 450 under a 29 px bar, dpr 2 (the iMac). The bridge's content script attaches to /pane-x on
     127.0.0.1 (the server serves the chosen shell there); the dpr is set through CDP because a viewport override would reset it. */
  const pageErrors = []; pane.on("pageerror", (e) => pageErrors.push(String(e.message || e).slice(0, 300)));
  const cdp = await context.newCDPSession(pane);
  const paneMetrics = () => cdp.send("Emulation.setDeviceMetricsOverride", { width: PANE[0], height: PANE[1] + BAR_PX, deviceScaleFactor: 2, mobile: false });
  await paneMetrics();
  /* Playwright's own screenshot would drop that override (it believes the page has no viewport); CDP's does not */
  const shoot = async (file) => { const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await fsp.writeFile(file, Buffer.from(data, "base64")); };
  await pane.goto(`${BASE}/pane-x/`, { waitUntil: "domcontentloaded" });
  await pane.addStyleTag({ content: `#bar{min-height:${BAR_PX}px;box-sizing:border-box}` });
  await pane.waitForTimeout(1200);
  result.pageErrors = pageErrors;
  result.paneBox = await pane.evaluate(() => ({ inner: [innerWidth, innerHeight], dpr: devicePixelRatio, body: [document.getElementById("body").clientWidth, document.getElementById("body").clientHeight], bar: document.getElementById("bar").getBoundingClientRect().height }));
  say("pane", { ...result.paneBox, pageErrors });

  /* the bridge's own capture document, handed its stream through the tab picker (auto-accepted) */
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
        captureStream = stream;
        captureVideo = document.createElement("video");
        captureVideo.muted = true; captureVideo.playsInline = true; captureVideo.srcObject = stream;
        document.body.appendChild(captureVideo); await captureVideo.play();
        const st = stream.getVideoTracks()[0].getSettings();
        window.__HOLDER = { ok: true, width: st.width, height: st.height, frameRate: st.frameRate };
      } catch (error) { window.__HOLDER = { ok: false, error: error.name + ": " + error.message }; }
    });
  });
  await holder.click("#go");
  for (let i = 0; i < 12; i++) { await holder.waitForTimeout(1000); if (await holder.evaluate(() => !!window.__HOLDER)) break; }
  result.capture = await holder.evaluate(() => window.__HOLDER || { ok: false, error: "no result" });
  say("capture", result.capture);
  if (!result.capture.ok) throw new Error("no capture: " + result.capture.error);

  const xTabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: ["https://x.com/*"] }))[0]?.id ?? null);
  result.relay = await sw.evaluate(async (tabId) => {
    stationSourceTabId = tabId;
    await persistStationSession();
    const ok = await reconnectStationConsumers({ controlSource: true });
    return { ok, consumers: stationConsumers.size };
  }, xTabId).catch((e) => ({ ok: false, why: e.message }));
  say("relay", result.relay);
  /* the timed page-up is held off: its clock is told the last one has just happened (both shells keep that name) */
  await pane.evaluate(() => { xRefreshAt = Date.now(); setInterval(() => { xRefreshAt = Date.now(); }, 2000); });
  await pane.bringToFront();
  await pane.mouse.move(1, 1);
  for (let i = 0; i < 24; i++) {
    await pane.waitForTimeout(1500);
    const st = await pane.evaluate(() => ({ crops: window.__M.crops, draws: window.__M.draws, vw: document.getElementById("v").videoWidth, state: document.getElementById("xfState")?.textContent || "" }));
    if (st.crops > 5 && st.vw > 0 && st.draws > 3) break;
  }
  await pane.waitForTimeout(2500);
  result.xWindowFed = await xWindow();   /* once the bridge has laid the column out for this pane */
  say("x fed", result.xWindowFed);
  /* The bridge lays the column out for the pane the moment the pane connects, and takes its time to notice its own
     relayout (its crop geometry is re-measured after the page mutates and after a captured frame is acknowledged; on
     the iMac X mutates constantly, here the stand-in re-renders its ages once a second). Until it has, the crop it
     sends is the one measured on the column's old width. So the first picture waits for the crop to settle: the same
     rectangle in four samples a second apart, after it has changed at least once, or 60 s at most. */
  const settle = { samples: [] };
  for (let i = 0; i < 60; i++) {
    await pane.waitForTimeout(1000);
    const r = await pane.evaluate(() => (window.__M.last && window.__M.last.rect) ? [window.__M.last.rect.left, window.__M.last.rect.width] : null);
    settle.samples.push(r);
    const tail = settle.samples.slice(-4);
    const same = tail.length === 4 && tail.every((s) => s && s[0] === tail[0][0] && s[1] === tail[0][1]);
    const changed = settle.samples.some((s) => s && (s[0] !== settle.samples[0]?.[0] || s[1] !== settle.samples[0]?.[1]));
    if (same && changed) break;
  }
  result.settle = { seconds: settle.samples.length, from: settle.samples[0], to: settle.samples.at(-1), changed: JSON.stringify(settle.samples[0]) !== JSON.stringify(settle.samples.at(-1)) };
  say("settled", result.settle);
  const snap = async () => pane.evaluate(() => {
    const M = window.__M, v = document.getElementById("v"), c = M.last || {};
    return { crops: M.crops, draws: M.draws, draw: M.draw, video: [v.videoWidth, v.videoHeight], rect: c.rect || null, viewport: c.viewport || null, speed: c.speedPxPerSecond ?? null,
      paneInner: [innerWidth, innerHeight], paneDpr: devicePixelRatio, body: [document.getElementById("body").clientWidth, document.getElementById("body").clientHeight],
      sourceScroll: c.sourceScroll?.scrollTop ?? null, every: document.getElementById("xfEvery")?.textContent || "", everyTitle: document.getElementById("xfEvery")?.title || "",
      state: document.getElementById("xfState")?.textContent || "", paint: window.__SCINTILLA_X_PAINT || null, whole: document.body.className };
  });
  result.frames = [];
  const t0 = Date.now();
  for (let f = 0; f < FRAMES; f++) {
    if (f) await pane.waitForTimeout(EVERY * 1000 - (Date.now() - t0 - (f - 1) * EVERY * 1000 > 0 ? (Date.now() - t0) % (EVERY * 1000) : 0));
    const at = (Date.now() - t0) / 1000;
    const xTop = await xPage.evaluate(() => document.scrollingElement.scrollTop);
    const file = path.join(OUT, `${LABEL}-frame-${f}.png`);
    await fsp.mkdir(OUT, { recursive: true });
    await shoot(file);
    const s = await snap();
    result.frames.push({ f, at: +at.toFixed(2), xScrollTop: xTop, file: path.basename(file), ...s });
    say("frame", { f, at: +at.toFixed(1), xScrollTop: xTop, rect: s.rect, draw: s.draw && [s.draw.dx, s.draw.dw, s.draw.dh, s.draw.cw, s.draw.ch], every: s.every, pane: s.paneInner, dpr: s.paneDpr });
  }
  /* the panel, for the record: what the ⋯ offers */
  await pane.click("#bXMore").catch(() => {}); await pane.waitForTimeout(400);
  result.panel = await pane.evaluate(() => ({ refresh: [...document.querySelectorAll("#xMore .xr")].map((b) => [b.textContent, b.classList.contains("on")]),
    pace: [...document.querySelectorAll("#xMore .xs")].map((b) => [b.textContent, !b.hidden, b.classList.contains("on")]) }));
  await shoot(path.join(OUT, `${LABEL}-panel.png`));
  await pane.click("#bXMore").catch(() => {});
  say("panel", result.panel);
  /* the source's own picture, once, for the record (the whole X window the capture sees) */
  await xPage.screenshot({ path: path.join(OUT, `${LABEL}-source.png`) }).catch(() => {});
  result.blocked = blocked;
} catch (error) { result.error = String(error?.stack || error).slice(0, 800); say("error", { error: result.error }); }
await fsp.mkdir(OUT, { recursive: true });
await fsp.writeFile(path.join(OUT, `${LABEL}-raw.json`), JSON.stringify(result, null, 1));
await context.close().catch(() => {});
server.close();
await fsp.rm(SCRATCH, { recursive: true, force: true }).catch(() => {});
say("done", { error: result.error || null, frames: result.frames?.length || 0 });
