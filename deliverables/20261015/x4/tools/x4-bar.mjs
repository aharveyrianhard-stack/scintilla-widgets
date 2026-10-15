/* X4 · the X bar today vs the build, and one press of −30s, headless (15 Oct 2026; after X3's x3-rewind.mjs).
 *
 * One run = the REAL bridge (a folder; 0.7.27, the one on the iMac) loaded as an unpacked extension in a hidden Chromium,
 * scrolling a stand-in x.com page (x.com refuses an automated browser) in a window the size of Alan's X window
 * (1062 × 640 CSS px at 2×), feeding the REAL pane (the deployed shell, or this branch's) at the iMac's pane size
 * (255 × 450 under a 29 px bar, dpr 2). Once the crop has settled:
 *   1. the bar is read (every control's box, the bar's overflow, the −30s box and whether its label fits) in the view the
 *      deck gives the iMac (auto) and in the four other view profiles, and photographed zoomed (and with ⋯ open);
 *   2. −30s is pressed the way the shell offers it - TODAY: ⋯ then −30s in the panel; THE BUILD: −30s on the bar - with
 *      the pointer on the button; the X page's scroll position is sampled every 50 ms for 3 s; the pane's own postMessage
 *      (left the pane), the bridge background's forwarding (reached the bridge) and the X page's scroll are counted;
 *   3. THE BUILD only: the keyboard - focus on ↻, one Tab, then Enter - must land on −30s and ask for one more rewind.
 * Disclosed differences from the iMac: the capture is handed to the bridge's capture document through the browser's tab
 * picker; the feed is a stand-in; the timed page-up is held off (0.7.26 and later decline it anyway).
 *
 * usage: node x4-bar.mjs --label build --bridge <dir> --shell <index.html> --speed 12 --out <dir>
 * Headless only. Nothing is written outside --out. */
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const LABEL = args.get("label") || "run";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../..");
/* playwright-core from the workspace's visual-supervisor (beside the main checkout, or two up from a worktree) */
const SUPERVISOR = [process.env.X4_PLAYWRIGHT_FROM, path.resolve(REPO, "../visual-supervisor/package.json"), path.resolve(REPO, "../../visual-supervisor/package.json")]
  .find((p) => p && fs.existsSync(p));
const { chromium } = createRequire(SUPERVISOR)("playwright-core");
const SHELL = path.resolve(args.get("shell") || path.join(REPO, "station-shells/x-v2/index.html"));
const SHELL_NAME = args.get("shell-name") || path.relative(REPO, SHELL);
const BRIDGE_SRC = path.resolve(args.get("bridge") || path.join(REPO, "station-x-bridge-draft"));
const FIXTURE_FILE = path.resolve(args.get("fixture") || path.join(HERE, "x-source-fixture.html"));
const OUT = path.resolve(args.get("out") || path.join(HERE, "../data"));
const SPEED = args.has("speed") ? Number(args.get("speed")) : null;
const SAMPLE_MS = Number(args.get("sample") || 50), WATCH_MS = Number(args.get("watch") || 3000);
const WINDOW = (args.get("window") || "1062x640").split("x").map(Number);
const WINDOW_FRAME_PX = Number(args.get("frame") || 87);
const BAR_PX = Number(args.get("bar") || 29);
const PANE = (args.get("pane") || "255x450").split("x").map(Number);
const ZOOM = Number(args.get("zoom") || 3);
const SCRATCH = await fsp.mkdtemp(path.join(os.tmpdir(), "x4-bar-"));
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
let result = { label: LABEL, bridgeVersion, bridgeContentSha256: sha(path.join(BRIDGE, "content.js")), shell: SHELL_NAME, shellSha256: sha(SHELL),
  speedAsked: SPEED, window: WINDOW, pane: PANE, bar: BAR_PX, at: new Date().toISOString() };
try {
  const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 20000 });
  /* settingsVersion 10: 0.7.26's first-session step must not override the pace asked for here */
  if (SPEED != null) await sw.evaluate(async (speed) => { await chrome.storage.local.set({ xFeedFloatSettings: { settingsVersion: 10, speedPxPerSecond: speed } }); }, SPEED);
  /* the bridge's background: count every control it forwards to the X tab (the shipped code calls chrome.tabs.sendMessage by name) */
  await sw.evaluate(() => {
    const orig = chrome.tabs.sendMessage;
    self.__X4 = { forwarded: {} };
    chrome.tabs.sendMessage = function (tabId, message, ...rest) {
      if (message && message.type === "XFF_STATION_CONTROL") self.__X4.forwarded[message.action] = (self.__X4.forwarded[message.action] || 0) + 1;
      return orig.call(chrome.tabs, tabId, message, ...rest);
    };
  });

  const FIXTURE = await fsp.readFile(FIXTURE_FILE, "utf8");
  await context.route("https://x.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: FIXTURE }));
  let blocked = 0;
  await context.route((u) => !/^https:\/\/x\.com\//.test(u.href), (route) => route.request().method() === "GET" ? route.continue() : (blocked++, route.abort("blockedbyclient")));
  const xPage = context.pages()[0] || await context.newPage();
  const xConsole = []; result.xConsole = xConsole;
  xPage.on("console", (m) => { if (["warning", "error"].includes(m.type()) && xConsole.length < 20) xConsole.push(m.type() + ": " + m.text().slice(0, 200)); });
  await xPage.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 60000 });
  await xPage.waitForTimeout(2000);

  const pane = await context.newPage();
  await pane.addInitScript(() => {
    const M = (window.__M = { crops: 0, last: null, draws: 0, posted: {} });
    window.addEventListener("message", (e) => {
      if (e.data?.type === "XFF_STATION_CROP") { M.crops++; M.last = e.data.crop; }
      if (e.data?.type === "XFF_STATION_CONTROL") M.posted[e.data.action] = (M.posted[e.data.action] || 0) + 1;
    }, true);
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (src, ...a) {
      const r = draw.call(this, src, ...a);
      if (this.canvas.id === "cv" && a.length === 8) M.draws++;
      return r;
    };
  });
  const pageErrors = []; pane.on("pageerror", (e) => pageErrors.push(String(e.message || e).slice(0, 300)));
  const cdp = await context.newCDPSession(pane);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: PANE[0], height: PANE[1] + BAR_PX, deviceScaleFactor: 2, mobile: false });
  const shoot = async (file, clip) => {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, ...(clip ? { clip } : {}) });
    await fsp.writeFile(file, Buffer.from(data, "base64"));
  };
  await pane.goto(`${BASE}/pane-x/`, { waitUntil: "domcontentloaded" });
  await pane.addStyleTag({ content: `#bar{min-height:${BAR_PX}px;box-sizing:border-box}` });
  await pane.waitForTimeout(1200);

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
    const st = await pane.evaluate(() => ({ crops: window.__M.crops, draws: window.__M.draws, vw: document.getElementById("v").videoWidth }));
    if (st.crops > 5 && st.vw > 0 && st.draws > 3) break;
  }
  await pane.waitForTimeout(2500);
  /* the X page's own side of the crop: the column width the bridge asked for, and the column's box */
  const xColumn = () => xPage.evaluate(() => {
    const c = document.querySelector('[data-testid="primaryColumn"]')?.getBoundingClientRect();
    return { asked: getComputedStyle(document.documentElement).getPropertyValue("--xff-capture-column-width").trim() || null,
      layout: !!document.getElementById("x-feed-float-capture-layout"), column: c ? [Math.round(c.left), Math.round(c.width)] : null };
  });
  /* The bridge re-measures its crop in a requestAnimationFrame on the X page. Here the X page is a tab behind the pane
     (on the iMac it is its own visible window), so that frame can fail to come and the crop stays on the column's old
     width while the column itself is already laid out (X1/X3's "cached crop" flake). If the column is laid out and the
     crop has not followed after NUDGE_AT s, the X tab is brought forward for one second, once, and the pane back.
     Observed 15 Oct: this did NOT cure it (the one run where it fired stayed at the old width for 90 s); a run that
     settles does so by itself at ~20 s. Keep only runs whose crop settled (settle.to), and say how many were re-run. */
  const settle = { samples: [], x: [], nudgedAt: null };
  const SETTLE_S = Number(args.get("settle") || 90), NUDGE_AT = Number(args.get("nudge") || 25);
  for (let i = 0; i < SETTLE_S; i++) {
    await pane.waitForTimeout(1000);
    const r = await pane.evaluate(() => (window.__M.last && window.__M.last.rect) ? [window.__M.last.rect.left, window.__M.last.rect.top, window.__M.last.rect.width, window.__M.last.rect.height] : null);
    settle.samples.push(r);
    if (i % 10 === 0) settle.x.push([i, await xColumn()]);
    const tail = settle.samples.slice(-4);
    const same = tail.length === 4 && tail.every((s) => s && s.join() === tail[0].join());
    const changed = settle.samples.some((s) => s && s.join() !== settle.samples[0]?.join());
    if (same && changed) break;
    if (!changed && settle.nudgedAt === null && i >= NUDGE_AT && (await xColumn()).asked) {
      settle.nudgedAt = i;
      await xPage.bringToFront(); await xPage.waitForTimeout(1000);
      await pane.bringToFront(); await pane.mouse.move(1, 1);
    }
  }
  result.settle = { seconds: settle.samples.length, from: settle.samples[0], to: settle.samples.at(-1), nudgedAt: settle.nudgedAt, x: settle.x, xEnd: await xColumn() };
  say("settled", result.settle);
  result.pageErrors = pageErrors;

  /* 1 · the bar, as the iMac's deck shows it (view auto), and in the other four view profiles */
  const readBar = () => pane.evaluate(() => {
    const bar = document.getElementById("bar");
    const box = (n) => { const r = n.getBoundingClientRect(); return [+r.left.toFixed(2), +r.top.toFixed(2), +r.width.toFixed(2), +r.height.toFixed(2)]; };
    const items = [...bar.children].filter((n) => getComputedStyle(n).display !== "none" && !n.hidden).map((n) => ({
      id: n.id || null, tag: n.tagName.toLowerCase(), cls: n.className || null, text: n.querySelector("svg") ? "(icon)" : n.textContent.trim(), title: n.title || null, box: box(n) }));
    const back = document.getElementById("bXBack"), refresh = document.getElementById("bXRefresh");
    let label = null;
    if (back) {
      const range = document.createRange(); range.selectNodeContents(back);
      const t = range.getBoundingClientRect(), b = back.getBoundingClientRect(), cs = getComputedStyle(back);
      label = { text: back.textContent, shown: cs.display !== "none", inBar: back.parentElement === bar, tag: back.tagName.toLowerCase(), tabIndex: back.tabIndex,
        font: cs.fontSize + " " + cs.fontFamily.split(",")[0], transform: cs.textTransform, box: box(back), labelWidth: +t.width.toFixed(2),
        labelInside: t.left >= b.left + 1 - 0.01 && t.right <= b.right - 1 + 0.01, clipped: back.scrollWidth > back.clientWidth,
        border: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor, background: cs.backgroundColor, color: cs.color };
    }
    return { view: document.documentElement.dataset.view, barBox: box(bar), scrollWidth: bar.scrollWidth, clientWidth: bar.clientWidth, overflows: bar.scrollWidth > bar.clientWidth,
      items, refresh: refresh ? { box: box(refresh), border: getComputedStyle(refresh).borderTopWidth + " " + getComputedStyle(refresh).borderTopStyle + " " + getComputedStyle(refresh).borderTopColor, background: getComputedStyle(refresh).backgroundColor, color: getComputedStyle(refresh).color } : null,
      back: label, every: document.getElementById("xfEvery") ? { text: document.getElementById("xfEvery").textContent, shown: getComputedStyle(document.getElementById("xfEvery")).display !== "none", box: box(document.getElementById("xfEvery")) } : null,
      panelHasBack: !!document.querySelector("#xMore #bXBack"), more: document.getElementById("bXMore").title };
  });
  result.bar = await readBar();
  say("bar", { view: result.bar.view, overflows: result.bar.overflows, items: result.bar.items.map((i) => (i.id || i.cls) + ":" + i.text).join(" · "), back: result.bar.back && { inBar: result.bar.back.inBar, box: result.bar.back.box, labelInside: result.bar.back.labelInside, font: result.bar.back.font } });
  result.views = {};
  for (const view of ["desk", "ipad", "display", "compact", "auto"]) {
    await pane.evaluate((v) => { document.documentElement.dataset.view = v; }, view);
    await pane.waitForTimeout(150);
    const b = await readBar();
    result.views[view] = { overflows: b.overflows, refresh: b.refresh?.box, back: b.back && { box: b.back.box, font: b.back.font, labelWidth: b.back.labelWidth, labelInside: b.back.labelInside, clipped: b.back.clipped } };
  }
  say("views", result.views);
  await fsp.mkdir(OUT, { recursive: true });
  await pane.mouse.move(1, PANE[1]);   /* off the bar: no hover colour in the picture of the bar */
  await pane.waitForTimeout(200);
  await shoot(path.join(OUT, `${LABEL}-bar.png`), { x: 0, y: 0, width: PANE[0], height: BAR_PX, scale: ZOOM });

  /* 2 · one press of −30s, the way this shell offers it */
  const xTop = () => xPage.evaluate(() => document.scrollingElement.scrollTop);
  const paneSnap = () => pane.evaluate(() => {
    const M = window.__M, c = M.last || {};
    return { crops: M.crops, draws: M.draws, posted: { ...M.posted }, speed: c.speedPxPerSecond ?? null, sourceScroll: c.sourceScroll?.scrollTop ?? null,
      panel: document.body.classList.contains("x-more"), backShown: getComputedStyle(document.getElementById("bXBack")).display !== "none", active: document.activeElement?.id || null };
  });
  const forwarded = () => sw.evaluate(() => ({ ...self.__X4.forwarded }));
  const paceA = await xTop(); await pane.waitForTimeout(10000); const paceB = await xTop();
  result.pace = { pxIn10s: paceB - paceA, pxPerSecond: +((paceB - paceA) / 10).toFixed(2) };
  say("pace", result.pace);

  const inPanel = await pane.evaluate(() => !!document.querySelector("#xMore #bXBack"));
  result.before = { xScrollTop: await xTop(), pane: await paneSnap(), forwarded: await forwarded() };
  const clicks = [];
  if (inPanel) {
    await pane.click("#bXMore"); clicks.push("⋯"); await pane.waitForTimeout(400);
    await pane.mouse.move(1, PANE[1]); await pane.waitForTimeout(150);
    await shoot(path.join(OUT, `${LABEL}-panel.png`), { x: 0, y: 0, width: PANE[0], height: BAR_PX + 86, scale: ZOOM });
  }
  result.beforeClick = await paneSnap();
  if (!result.beforeClick.backShown) throw new Error("the −30s button is not shown");
  await pane.hover("#bXBack"); await pane.waitForTimeout(150);
  const scrollAtClick = await xTop();
  await shoot(path.join(OUT, `${LABEL}-before.png`));
  const t0 = Date.now();
  await pane.click("#bXBack"); clicks.push("−30s");
  const samples = [];
  while (Date.now() - t0 < WATCH_MS) {
    samples.push([Date.now() - t0, await xTop()]);
    await new Promise((r) => setTimeout(r, SAMPLE_MS));
  }
  await pane.mouse.move(1, PANE[1]); await pane.waitForTimeout(100);
  result.after = { pane: await paneSnap(), forwarded: await forwarded(), xScrollTop: await xTop() };
  await shoot(path.join(OUT, `${LABEL}-after.png`));
  if (inPanel && result.after.pane.panel) await pane.click("#bXMore").catch(() => {});
  const tops = samples.map((s) => s[1]);
  const minTop = Math.min(...tops), minAt = samples[tops.indexOf(minTop)][0];
  const expected = Math.round((result.after.pane.speed ?? SPEED ?? 0) * 30);
  result.rewind = {
    clicks, expectedPx: expected, scrollAtClick, minScrollTop: minTop, minAtMs: minAt, movedBackPx: scrollAtClick - minTop,
    at3000ms: samples.at(-1)[1], netAfter3sPx: scrollAtClick - samples.at(-1)[1],
    leftThePane: (result.after.pane.posted.rewind || 0) - (result.before.pane.posted.rewind || 0),
    reachedTheBridge: (result.after.forwarded.rewind || 0) - (result.before.forwarded.rewind || 0),
    paneToldSourceScroll: [result.before.pane.sourceScroll, result.after.pane.sourceScroll], samples
  };
  say("rewind", { ...result.rewind, samples: undefined });

  /* 3 · the keyboard (the build): focus on ↻, one Tab, Enter */
  if (!inPanel) {
    const k0 = { pane: await paneSnap(), forwarded: await forwarded(), xScrollTop: await xTop() };
    await pane.focus("#bXRefresh");
    await pane.keyboard.press("Tab");
    const focused = await pane.evaluate(() => ({ id: document.activeElement?.id || null, focusVisible: document.activeElement?.matches(":focus-visible") ?? null }));
    await pane.keyboard.press("Enter");
    await pane.waitForTimeout(600);
    const k1 = { pane: await paneSnap(), forwarded: await forwarded(), xScrollTop: await xTop() };
    result.keyboard = { tabFromRefreshLandsOn: focused.id, focusVisible: focused.focusVisible,
      enterLeftThePane: (k1.pane.posted.rewind || 0) - (k0.pane.posted.rewind || 0), enterReachedTheBridge: (k1.forwarded.rewind || 0) - (k0.forwarded.rewind || 0),
      xScrollTop: [k0.xScrollTop, k1.xScrollTop] };
    say("keyboard", result.keyboard);
  }
  result.crop = await pane.evaluate(() => { const r = window.__M.last?.rect; return r ? [r.left, r.top, r.width, r.height] : null; });
  result.blocked = blocked;
} catch (error) { result.error = String(error?.stack || error).split(os.homedir()).join("~").slice(0, 800); say("error", { error: result.error }); }
await fsp.mkdir(OUT, { recursive: true });
await fsp.writeFile(path.join(OUT, `${LABEL}-raw.json`), JSON.stringify(result, null, 1));
await context.close().catch(() => {});
server.close();
await fsp.rm(SCRATCH, { recursive: true, force: true }).catch(() => {});
say("done", { error: result.error || null });
