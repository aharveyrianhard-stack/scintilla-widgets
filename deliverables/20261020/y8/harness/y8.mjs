// Y8 (20 Oct 2026): the float on the real deck, measured in a hidden browser.
//   node y8.mjs <root> [screen|all] [chrome executable]
// Same rig as S11/Y7 (the checkout served locally; the chart API fetched by node with the scintillahub.ai origin), but
// on Google Chrome 155 headless, because Document Picture-in-Picture needs the full browser (the rig's headless shell is
// measured here too: it is a browser WITHOUT the API). Every non-GET request is aborted except YouTube's own player
// calls (youtube.com / googlevideo.com), so the Station writes nothing anywhere: the shared resume positions
// (yt_positions) and every other database write are refused. Throwaway profile; nothing deployed; output only to
// ../shots and ../measure. Charts: index ETFs only.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE as SHELL, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] || path.resolve(HERE, "../../../..")), ONLY = process.argv[3] || "all";
const CHROME = process.argv[4] || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(MEASURE, { recursive: true });
const SCREENS = [["1062x685", 1062, 685, "iMac, the Station's Brave window (16 Oct reading)"], ["2560x1440", 2560, 1440, "iMac, native full screen"]]
  .filter((s) => ONLY === "all" || s[0] === ONLY);
const ETFS = ["SPY", "QQQ", "DIA", "IWM", "XLK", "XLF", "XLE", "SMH", "TLT"];
const WALL = "/deck/?scene=live&charts=9&range=3D&" + ETFS.map((t, i) => "c" + (i + 1) + "=" + t).join("&");
const PANE_PATH = "/station-shells/scintilla-video-v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);

async function open(browser, w, h, { noPip = false } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const net = { refused: [], ytEmbeds: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (/(^|\.)youtube\.com$/.test(host) && /\/embed\//.test(url)) net.ytEmbeds.push({ at: Date.now(), id: (url.match(/\/embed\/([^?/]+)/) || [])[1] || "" });
    if (host.startsWith("127.0.0.1")) return route.fallback();
    const ytPlayer = /(^|\.)(youtube\.com|googlevideo\.com)$/.test(host);
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method()) && !ytPlayer) { net.refused.push(req.method() + " " + host + new URL(url).pathname); return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") {
      try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
    }
    return route.fallback();
  });
  await context.addInitScript((noPip) => {
    if (noPip) { try { delete window.documentPictureInPicture; } catch (_) {} try { Object.defineProperty(window, "documentPictureInPicture", { value: undefined, configurable: true }); } catch (_) {} }
    if (window.top === window) {
      try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.removeItem("station.chartsOnly"); } catch (_) {}
      /* record what the Station asks the browser for (the size), without changing it */
      window.__y8 = { requests: [] };
      try { if (window.documentPictureInPicture) { const dp = window.documentPictureInPicture, orig = dp.requestWindow.bind(dp);
        dp.requestWindow = (o) => { window.__y8.requests.push(JSON.parse(JSON.stringify(o || {}))); return orig(o); }; } } catch (_) {}
    }
  }, noPip);
  const page = await context.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, net };
}
const paneFrame = (page) => page.frames().find((f) => f.url().includes(PANE_PATH) && f.url().includes("feed=scintilla"));
async function until(fn, ms = 20000, step = 250) { const end = Date.now() + ms; let v; while (Date.now() < end) { try { v = await fn(); if (v) return v; } catch (_) {} await sleep(step); } return v; }

/* inside the pane: the bar, the buttons, the float's state, the player's state - one reading */
function readPane() {
  const R = (n) => { if (!n) return null; const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), display: cs.display, shown: cs.display !== "none" && r.width > 0 }; };
  let player = null;
  try { if (YT_PLAYER_READY) player = { state: YT_PLAYER.getPlayerState(), at: Math.round(YT_PLAYER.getCurrentTime() * 10) / 10, id: String(YT_PLAYER.getVideoData().video_id || ""),
    sameFrame: YT_PLAYER.getIframe().__y8 === "kept", frameLoads: window.__y8loads == null ? null : window.__y8loads }; } catch (e) { player = { err: String(e) }; }
  let float = null;
  if (typeof FLOAT !== "undefined" && FLOAT) {
    let page = null; try { page = FLOAT.frame.contentWindow.SC_FLOAT.state(); } catch (e) { page = { err: String(e).slice(0, 80) }; }
    float = { id: FLOAT.id, at: Math.round(FLOAT.at * 10) / 10, src: FLOAT.frame ? FLOAT.frame.src.replace(location.origin, "") : "", page,
      window: { w: FLOAT.win.innerWidth, h: FLOAT.win.innerHeight, frames: FLOAT.win.document.querySelectorAll("iframe").length } };
  }
  return { pane: { w: innerWidth, h: innerHeight }, body: document.body.className, canFloat: document.body.classList.contains("can-float"),
    playing: document.body.classList.contains("playing"), cur: typeof CUR !== "undefined" && CUR ? CUR.video_id : null,
    bar: R(document.getElementById("bar")), pipBar: R(document.getElementById("bPipBar")), full: R(document.getElementById("bFull")),
    pipBarOn: document.getElementById("bPipBar").classList.contains("on"), pipBarTitle: document.getElementById("bPipBar").title,
    menuItem: R(document.getElementById("bPip")), menuItemDisplay: getComputedStyle(document.getElementById("bPip")).display,
    hold: R(document.getElementById("floatHold")),
    note: R(document.getElementById("floatNote")), noteText: document.getElementById("floatNote").innerText.replace(/\s+/g, " ").trim(),
    player, float };
}
const topState = (page) => page.evaluate(() => { let w = null; try { w = window.documentPictureInPicture && window.documentPictureInPicture.window; } catch (_) {}
  return { api: typeof window.documentPictureInPicture, open: !!w, size: w ? { w: w.innerWidth, h: w.innerHeight } : null, requests: (window.__y8 && window.__y8.requests) || [] }; });
async function tagPaneFrame(pane) { return pane.evaluate(() => { const f = YT_PLAYER.getIframe(); f.__y8 = "kept"; window.__y8loads = 0; f.addEventListener("load", () => { window.__y8loads++; }); return true; }); }
/* how long the way back takes: from the moment the window goes until the pane's own player is playing again */
async function playingAgain(pane, ms = 12000) {
  const t = Date.now();
  const ok = await until(() => pane.evaluate(() => typeof YT_PLAYER_READY !== "undefined" && YT_PLAYER_READY && YT_PLAYER.getPlayerState() === 1), ms, 100);
  return { playingAfterMs: ok ? Date.now() - t : null, within: ms };
}
async function deckKey(page, key) { await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); }); await page.keyboard.press(key); }
async function pipShot(context, file) {
  /* the floating window's own pixels, if the browser hands it over as a page; else the same page rendered at the window's size */
  const pages = context.pages(); const pip = pages.length > 1 ? pages[pages.length - 1] : null;
  if (pip) { try { await pip.screenshot({ path: file }); return "the PiP window's own page"; } catch (e) { return "PiP page present, screenshot refused: " + String(e.message || e).slice(0, 80); } }
  return "no page for the PiP window";
}

async function screen(browser, origin, [key, W, H, note]) {
  const res = { screen: key, note, at: new Date().toISOString() };
  const { context, page, errs, net } = await open(browser, W, H);
  await page.goto(origin + WALL, { waitUntil: "domcontentloaded" });
  const pane = await until(() => paneFrame(page), 30000);
  if (!pane) { res.error = "no SCINTILLA pane; frames: " + page.frames().map((f) => f.url().replace(origin, "")).join(" | ").slice(0, 600); await context.close(); return res; }
  await until(() => pane.evaluate(() => document.querySelectorAll("#grid .card").length >= 4), 40000);
  await sleep(1500);
  res.grid = await pane.evaluate(readPane);
  /* 1 - play the first video, as a click */
  await pane.click("#grid .card");
  await until(() => pane.evaluate(() => typeof YT_PLAYER_READY !== "undefined" && YT_PLAYER_READY && YT_PLAYER.getPlayerState() === 1), 25000);
  await sleep(6000);
  res.playing = await pane.evaluate(readPane); res.top0 = await topState(page);
  await page.screenshot({ path: path.join(SHOTS, `y8-playing-${key}.png`) });
  const paneBox = await page.evaluate(() => { const f = [...document.querySelectorAll("iframe")].find((x) => (x.src || "").includes("scintilla-video-v1") && (x.src || "").includes("feed=scintilla"));
    const r = f && f.getBoundingClientRect(); return r ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null; });
  res.paneBox = paneBox;
  log(key, "playing", JSON.stringify(res.playing.player), "pipBar", JSON.stringify(res.playing.pipBar));
  /* 2 - P on the deck: float */
  await tagPaneFrame(pane);
  const before = await pane.evaluate(() => Math.round(YT_PLAYER.getCurrentTime() * 10) / 10);
  const embedsBefore = net.ytEmbeds.length;
  await deckKey(page, "p");
  await until(() => pane.evaluate(() => !!FLOAT), 8000);
  await sleep(1200);
  res.floatOpen = { pressedAt: before, top: await topState(page), pane: await pane.evaluate(readPane) };
  await sleep(8000);
  res.floatLater = { top: await topState(page), pane: await pane.evaluate(readPane) };
  await page.screenshot({ path: path.join(SHOTS, `y8-floating-${key}.png`) });
  res.pipShot = await pipShot(context, path.join(SHOTS, `y8-pip-window-${key}.png`));
  /* a held autoplay: one click on the window's ▶ (real input, inside the window) */
  { const pages = context.pages(), pipPage = pages.length > 1 ? pages[pages.length - 1] : null;
    if (pipPage) { const vp = await pipPage.evaluate(() => ({ w: innerWidth, h: innerHeight }));
      await pipPage.mouse.click(Math.round(vp.w / 2), Math.round(vp.h / 2)); await sleep(5000);
      res.floatAfterClick = { pane: await pane.evaluate(readPane) };
      try { await pipPage.screenshot({ path: path.join(SHOTS, `y8-pip-window-clicked-${key}.png`) }); } catch (_) {} } }
  log(key, "floating", JSON.stringify(res.floatLater.pane.float), "note", res.floatLater.pane.noteText);
  /* 3 - close the window as Alan would (its ✕): the browser's close, nothing from the pane */
  const lastFloat = res.floatLater.pane.float ? res.floatLater.pane.float.at : null;
  await page.evaluate(() => documentPictureInPicture.window.close());
  const closeTiming = await playingAgain(pane); await sleep(500);
  res.closed = { timing: closeTiming, top: await topState(page), pane: await pane.evaluate(readPane), floatSecondAtClose: lastFloat, embedsDuringCycle: net.ytEmbeds.length - embedsBefore };
  log(key, "closed", JSON.stringify(res.closed.pane.player), "embeds this cycle", res.closed.embedsDuringCycle);
  /* 4 - P inside the pane, then BRING IT BACK */
  await sleep(3000);
  const e2 = net.ytEmbeds.length;
  await pane.focus("#bBack"); await page.keyboard.press("p");
  await until(() => pane.evaluate(() => !!FLOAT), 8000); await sleep(7000);
  res.paneKey = { pane: await pane.evaluate(readPane) };
  await pane.click("#bBringBack");
  const backTiming = await playingAgain(pane); await sleep(500);
  res.bringBack = { timing: backTiming, top: await topState(page), pane: await pane.evaluate(readPane), embedsDuringCycle: net.ytEmbeds.length - e2 };
  log(key, "bring back", JSON.stringify(res.bringBack.pane.player));
  /* 5 - a new choice while it floats goes to the window; closing loads it here at that second */
  await deckKey(page, "p"); await until(() => pane.evaluate(() => !!FLOAT), 8000); await sleep(2500);
  const was = await pane.evaluate(() => CUR.video_id);
  await pane.click("#bNext"); await sleep(6000);
  res.nextWhileFloating = { was, pane: await pane.evaluate(readPane) };
  await deckKey(page, "p");
  const nextTiming = await playingAgain(pane); await sleep(500);
  res.nextBack = { timing: nextTiming, pane: await pane.evaluate(readPane), top: await topState(page) };
  log(key, "next while floating", JSON.stringify(res.nextWhileFloating.pane.float), "-> back", JSON.stringify(res.nextBack.pane.player));
  res.refused = [...new Set(net.refused)].slice(0, 40); res.refusedCount = net.refused.length; res.errors = errs;
  await context.close();
  return res;
}

async function noPipCase(browser, origin, label) {
  const { context, page, errs } = await open(browser, 1062, 685, { noPip: label === "chrome155-api-removed" });
  await page.goto(origin + WALL, { waitUntil: "domcontentloaded" });
  const pane = await until(() => paneFrame(page), 30000);
  await until(() => pane.evaluate(() => document.querySelectorAll("#grid .card").length >= 4), 40000);
  await pane.click("#grid .card"); await until(() => pane.evaluate(() => document.body.classList.contains("playing")), 15000); await sleep(1500);
  const before = await pane.evaluate(readPane), topApi = await topState(page);
  await deckKey(page, "p"); await sleep(1000);
  await pane.focus("#bBack"); await page.keyboard.press("p"); await sleep(1000);
  const after = await pane.evaluate(readPane), topAfter = await topState(page);
  if (label !== "chrome155-api-removed") await page.screenshot({ path: path.join(SHOTS, "y8-no-api-" + label + ".png") });
  await context.close();
  return { label, version: browser.version(), topApi, before, after, topAfter, errors: errs };
}

const { server, origin } = await serve(ROOT);
const out = { root: ROOT, at: new Date().toISOString(), screens: [] };
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
out.browser = browser.version(); log("browser", out.browser);
for (const s of SCREENS) { try { out.screens.push(await screen(browser, origin, s)); } catch (e) { out.screens.push({ screen: s[0], error: String(e.stack || e).slice(0, 400) }); log("ERR", s[0], e.message); } }
try { out.noApi = [await noPipCase(browser, origin, "chrome155-api-removed")]; } catch (e) { out.noApi = [{ error: String(e).slice(0, 300) }]; }
await browser.close();
try { const shell = await chromium.launch({ executablePath: SHELL, headless: true, args: ["--no-sandbox"] }); out.noApi.push(await noPipCase(shell, origin, "headless-shell")); await shell.close(); }
catch (e) { out.noApi.push({ label: "headless-shell", error: String(e).slice(0, 300) }); }
server.close();
fs.writeFileSync(path.join(MEASURE, "y8-measure.json"), JSON.stringify(out, null, 1));
log("wrote", path.join(MEASURE, "y8-measure.json"));
process.exit(0);
