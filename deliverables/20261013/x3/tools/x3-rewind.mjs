/* X3 · the −30s button, measured headless (13 Oct 2026; after X1's x1-pictures.mjs).
 *
 * One run = the REAL bridge (a folder) loaded as an unpacked extension in a hidden Chromium, scrolling a stand-in x.com
 * page (x.com refuses an automated browser) in a window the size of Alan's X window (1062 × 640 CSS px at 2×), feeding
 * the REAL pane (the deployed shell, or this branch's) at the iMac's pane size (255 × 450 under the bar, dpr 2).
 * Once the crop has settled, the ⋯ panel is opened and −30s is pressed; the X page's scroll position is sampled every
 * 50 ms for 3 s. Three counters say where the request got to: the pane's own postMessage (left the pane), the bridge's
 * background forwarding it to the X tab (reached the bridge), and the page's scroll events (moved the page). The crop
 * the bridge reports to the pane before and after says whether the pane was told.
 * Disclosed differences from the iMac: the capture is handed to the bridge's capture document through the browser's tab
 * picker; the feed is a stand-in; the timed page-up is held off (it is declined by 0.7.26 anyway).
 *
 * usage: node x3-rewind.mjs --label 4x-on --bridge <dir> --shell <index.html> --speed 12 --pointer on|off --out <dir>
 *   --pointer on  : the mouse is over the −30s button and clicks it (the pointer is on the pane, as his would be)
 *   --pointer off : the click is dispatched by script with the pointer parked at the top-left of the bar and a
 *                   pointerleave sent to the picture (the pane's hover hold, were it on, released)
 * Headless only. Nothing is written outside --out. */
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
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
const FIXTURE_FILE = path.resolve(args.get("fixture") || path.join(REPO, "deliverables/20261012/x1/tools/x-source-fixture.html"));
const OUT = path.resolve(args.get("out") || path.join(HERE, "../data"));
const SPEED = args.has("speed") ? Number(args.get("speed")) : null;
const POINTER = args.get("pointer") || "on";
const SAMPLE_MS = Number(args.get("sample") || 50), WATCH_MS = Number(args.get("watch") || 3000);
const WINDOW = (args.get("window") || "1062x640").split("x").map(Number);
const WINDOW_FRAME_PX = Number(args.get("frame") || 87);
const BAR_PX = Number(args.get("bar") || 29);
const PANE = (args.get("pane") || "255x450").split("x").map(Number);
const SCRATCH = await fsp.mkdtemp(path.join(os.tmpdir(), "x3-rewind-"));
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
  viewport: null,
});
const sha = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
let result = { label: LABEL, bridgeVersion, bridge: BRIDGE_SRC, bridgeContentSha256: sha(path.join(BRIDGE, "content.js")), shell: path.relative(REPO, SHELL), shellSha256: sha(SHELL),
  speedAsked: SPEED, pointer: POINTER, window: WINDOW, pane: PANE, at: new Date().toISOString() };
try {
  const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 20000 });
  /* settingsVersion 10: 0.7.26's first-session step must not override the pace asked for here */
  if (SPEED != null) await sw.evaluate(async (speed) => { await chrome.storage.local.set({ xFeedFloatSettings: { settingsVersion: 10, speedPxPerSecond: speed } }); }, SPEED);
  /* the bridge's background: count every control it forwards to the X tab (the shipped code calls chrome.tabs.sendMessage by name) */
  await sw.evaluate(() => {
    const orig = chrome.tabs.sendMessage;
    self.__X3 = { forwarded: {} };
    chrome.tabs.sendMessage = function (tabId, message, ...rest) {
      if (message && message.type === "XFF_STATION_CONTROL") self.__X3.forwarded[message.action] = (self.__X3.forwarded[message.action] || 0) + 1;
      return orig.call(chrome.tabs, tabId, message, ...rest);
    };
  });

  const FIXTURE = await fsp.readFile(FIXTURE_FILE, "utf8");
  await context.route("https://x.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: FIXTURE }));
  let blocked = 0;
  await context.route((u) => !/^https:\/\/x\.com\//.test(u.href), (route) => route.request().method() === "GET" ? route.continue() : (blocked++, route.abort("blockedbyclient")));
  const xPage = context.pages()[0] || await context.newPage();
  /* the X page's own scroll events, with their positions (the content script's scrolls fire them like any other) */
  await xPage.addInitScript(() => {
    window.__SCR = [];
    addEventListener("scroll", () => { window.__SCR.push([Math.round(performance.now()), document.scrollingElement.scrollTop]); if (window.__SCR.length > 5000) window.__SCR.shift(); }, { passive: true, capture: true });
  });
  await xPage.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 60000 });
  await xPage.waitForTimeout(2000);
  const xWindow = () => xPage.evaluate(() => ({ innerWidth: innerWidth, innerHeight: innerHeight, dpr: devicePixelRatio, column: (({ left, width }) => ({ left, width }))(document.querySelector('[data-testid="primaryColumn"]').getBoundingClientRect()),
    textLeft: document.querySelector('[data-testid="tweetText"]').getBoundingClientRect().left, scrollHeight: document.scrollingElement.scrollHeight, scrollTop: document.scrollingElement.scrollTop }));
  result.xWindow = await xWindow();
  say("x window", result.xWindow);

  const pane = await context.newPage();
  await pane.addInitScript(() => {
    const M = (window.__M = { crops: 0, last: null, draws: 0, draw: null, posted: {} });
    window.addEventListener("message", (e) => {
      if (e.data?.type === "XFF_STATION_CROP") { M.crops++; M.last = e.data.crop; }
      if (e.data?.type === "XFF_STATION_CONTROL") M.posted[e.data.action] = (M.posted[e.data.action] || 0) + 1;
    }, true);
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (src, ...a) {
      const r = draw.call(this, src, ...a);
      if (this.canvas.id === "cv" && a.length === 8) { M.draws++; M.draw = { sx: a[0], sy: a[1], sw: a[2], sh: a[3], dx: a[4], dy: a[5], dw: a[6], dh: a[7], cw: this.canvas.width, ch: this.canvas.height }; }
      return r;
    };
  });
  const pageErrors = []; pane.on("pageerror", (e) => pageErrors.push(String(e.message || e).slice(0, 300)));
  const cdp = await context.newCDPSession(pane);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: PANE[0], height: PANE[1] + BAR_PX, deviceScaleFactor: 2, mobile: false });
  const shoot = async (file) => { const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await fsp.writeFile(file, Buffer.from(data, "base64")); };
  await pane.goto(`${BASE}/pane-x/`, { waitUntil: "domcontentloaded" });
  await pane.addStyleTag({ content: `#bar{min-height:${BAR_PX}px;box-sizing:border-box}` });
  await pane.waitForTimeout(1200);
  result.pageErrors = pageErrors;
  result.paneBox = await pane.evaluate(() => ({ inner: [innerWidth, innerHeight], dpr: devicePixelRatio, body: [document.getElementById("body").clientWidth, document.getElementById("body").clientHeight], bar: document.getElementById("bar").getBoundingClientRect().height,
    hoverPause: typeof XF_HOVER_PAUSE === "undefined" ? null : XF_HOVER_PAUSE, back: { text: document.getElementById("bXBack").textContent, title: document.getElementById("bXBack").title, tag: document.getElementById("bXBack").tagName } }));
  say("pane", { ...result.paneBox, pageErrors });

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
  await pane.evaluate(() => { xRefreshAt = Date.now(); setInterval(() => { xRefreshAt = Date.now(); }, 2000); });
  await pane.bringToFront();
  await pane.mouse.move(1, 1);
  for (let i = 0; i < 24; i++) {
    await pane.waitForTimeout(1500);
    const st = await pane.evaluate(() => ({ crops: window.__M.crops, draws: window.__M.draws, vw: document.getElementById("v").videoWidth, state: document.getElementById("xfState")?.textContent || "" }));
    if (st.crops > 5 && st.vw > 0 && st.draws > 3) break;
  }
  await pane.waitForTimeout(2500);
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
  result.settle = { seconds: settle.samples.length, from: settle.samples[0], to: settle.samples.at(-1) };
  say("settled", result.settle);

  const xTop = () => xPage.evaluate(() => document.scrollingElement.scrollTop);
  const paneSnap = () => pane.evaluate(() => {
    const M = window.__M, c = M.last || {};
    return { crops: M.crops, draws: M.draws, posted: { ...M.posted }, rect: c.rect || null, speed: c.speedPxPerSecond ?? null, sourceScroll: c.sourceScroll?.scrollTop ?? null,
      sequence: c.sequence ?? null, panel: document.body.classList.contains("x-more"), hoverInside: typeof stationHoverInside === "undefined" ? null : stationHoverInside,
      backShown: getComputedStyle(document.getElementById("bXBack")).display !== "none" };
  });
  const forwarded = () => sw.evaluate(() => ({ ...self.__X3.forwarded }));
  /* the pace, for the record: ten seconds of the feed before anything is pressed */
  const paceA = await xTop(); await pane.waitForTimeout(10000); const paceB = await xTop();
  result.pace = { pxIn10s: paceB - paceA, pxPerSecond: +((paceB - paceA) / 10).toFixed(2) };
  say("pace", result.pace);

  await fsp.mkdir(OUT, { recursive: true });
  result.before = { xScrollTop: await xTop(), pane: await paneSnap(), forwarded: await forwarded() };
  await shoot(path.join(OUT, `${LABEL}-before.png`));
  /* the ⋯ panel must be open to reach −30s */
  await pane.click("#bXMore"); await pane.waitForTimeout(400);
  result.panelOpen = await paneSnap();
  say("panel", { panel: result.panelOpen.panel, backShown: result.panelOpen.backShown, hoverInside: result.panelOpen.hoverInside });
  if (!result.panelOpen.backShown) throw new Error("the −30s button is not shown with the panel open");
  const t0 = Date.now();
  const scrollAtClick = await xTop();
  const scrEvents0 = await xPage.evaluate(() => window.__SCR.length);
  if (POINTER === "on") {
    await pane.hover("#bXBack"); await pane.waitForTimeout(150);
    await pane.click("#bXBack");
  } else {
    await pane.mouse.move(1, 1);
    await pane.evaluate(() => { document.getElementById("body").dispatchEvent(new PointerEvent("pointerleave", { bubbles: false })); });
    await pane.waitForTimeout(150);
    await pane.evaluate(() => document.getElementById("bXBack").click());
  }
  const clickAt = Date.now() - t0;
  const samples = [];
  while (Date.now() - t0 < WATCH_MS) {
    samples.push([Date.now() - t0, await xTop()]);
    await new Promise((r) => setTimeout(r, SAMPLE_MS));
  }
  const tops = samples.map((s) => s[1]);
  const minTop = Math.min(...tops), minAt = samples[tops.indexOf(minTop)][0];
  const at = (ms) => samples.find((s) => s[0] >= ms)?.[1] ?? null;
  const scrEvents = await xPage.evaluate((from) => window.__SCR.slice(from), scrEvents0);
  result.after = { pane: await paneSnap(), forwarded: await forwarded(), xScrollTop: await xTop() };
  await shoot(path.join(OUT, `${LABEL}-after.png`));
  await pane.click("#bXMore").catch(() => {});
  const expected = Math.round((result.after.pane.speed ?? SPEED ?? 0) * 30);
  result.rewind = {
    expectedPx: expected, scrollAtClick, clickAtMs: clickAt, minScrollTop: minTop, minAtMs: minAt, movedBackPx: scrollAtClick - minTop,
    at500ms: at(500), at1000ms: at(1000), at2000ms: at(2000), at3000ms: samples.at(-1)[1],
    netAfter3sPx: scrollAtClick - samples.at(-1)[1],
    leftThePane: (result.after.pane.posted.rewind || 0) - (result.before.pane.posted.rewind || 0),
    reachedTheBridge: (result.after.forwarded.rewind || 0) - (result.before.forwarded.rewind || 0),
    scrollEventsAfterClick: scrEvents.length, backwardScrollEvents: scrEvents.filter((e, i) => i > 0 && e[1] < scrEvents[i - 1][1]).length,
    paneToldSourceScroll: [result.before.pane.sourceScroll, result.after.pane.sourceScroll],
    samples
  };
  say("rewind", { ...result.rewind, samples: undefined });
  result.blocked = blocked;
} catch (error) { result.error = String(error?.stack || error).slice(0, 800); say("error", { error: result.error }); }
await fsp.mkdir(OUT, { recursive: true });
await fsp.writeFile(path.join(OUT, `${LABEL}-raw.json`), JSON.stringify(result, null, 1));
await context.close().catch(() => {});
server.close();
await fsp.rm(SCRATCH, { recursive: true, force: true }).catch(() => {});
say("done", { error: result.error || null });
