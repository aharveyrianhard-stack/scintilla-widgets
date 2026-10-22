// Y9 (21 Oct 2026): SIMPLE on the real deck, measured in a hidden browser - the switch, the symbol memory, the
// no-reflow rule (1728 -> 1440 -> 1728), the handle, and the pictures (today beside SIMPLE; the symbol box in use).
//   node y9.mjs <root-of-this-branch> <root-of-today>
// Same rig as S11/Y7/Y8: headless shell, the checkout served locally, the chart API fetched by node with the
// scintillahub.ai origin; every non-GET request is aborted, so nothing is written anywhere. Thumbnails (ytimg) are
// let through for the pictures; YouTube's player is not loaded. Charts: index ETFs only. Output: ../shots, ../measure.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2]), TODAY = path.resolve(process.argv[3] || ROOT);
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(MEASURE, { recursive: true });
const SCREENS = [["1728x1117", 1728, 1117], ["1512x982", 1512, 982]];
const ETFS = ["SPY", "QQQ", "DIA", "IWM", "XLK", "XLF", "XLE", "SMH", "TLT"];
const WALL = "/deck/?scene=live&charts=9&range=3D&" + ETFS.map((t, i) => "c" + (i + 1) + "=" + t).join("&");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);
async function open(browser, w, h, { simple = null, screenWidth = null } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, screen: screenWidth ? { width: screenWidth, height: Math.round(screenWidth * 9 / 16) } : undefined });
  const net = { refused: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { net.refused.push(req.method() + " " + host); return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") {
      try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
    }
    if (/youtube\.com|googlevideo\.com|google\.com/.test(host)) return route.abort();
    return route.fallback();
  });
  await context.addInitScript((simple) => {
    if (window.top !== window) return;
    try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.removeItem("station.chartsOnly");
      /* a fresh machine: SIMPLE's keys cleared once per context (not on the reload, which is itself a measurement) */
      if (!sessionStorage.getItem("__y9")) { sessionStorage.setItem("__y9", "1");
        localStorage.removeItem("station.simple"); localStorage.removeItem("station.simple.split"); localStorage.removeItem("station.simple.chart.1"); localStorage.removeItem("station.simple.chart.2");
        if (simple === "1" || simple === "0") localStorage.setItem("station.simple", simple); } } catch (_) {}
  }, simple);
  const page = await context.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, net };
}
function readWall() {
  const R = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); const cs = getComputedStyle(n);
    return cs.display === "none" || r.width === 0 ? null : { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const charts = [...document.querySelectorAll("#rowTop > .pane")].map((p) => ({ key: p.dataset.key, box: R(p), off: p.classList.contains("slot-off") || p.classList.contains("chart-off") })).filter((c) => c.box);
  const video = document.querySelector('.pane[data-key="' + VIDEO_FEED + '"]'), x = document.querySelector('.pane[data-key="x"]');
  const ls = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  return { win: { w: innerWidth, h: innerHeight }, screen: { w: screen.width, h: screen.height }, body: document.body.className, simpleOn: typeof simpleOn === "function" ? simpleOn() : null,
    simple: typeof SIMPLE_NOW !== "undefined" ? SIMPLE_NOW : undefined, slotBlock: SLOT_NOW && SLOT_NOW.slot ? SLOT_NOW.slot.block : null,
    col: document.getElementById("grid").style.getPropertyValue("--fp-col"), videoPx: document.getElementById("grid").style.getPropertyValue("--simple-video-px"),
    grid: R(document.getElementById("grid")), rowTop: R(document.getElementById("rowTop")), tapes: R(document.getElementById("tapes")), handle: R(document.getElementById("simpleHandle")),
    video: video ? { cls: video.className, box: R(video) } : null, x: x ? R(x) : null, charts, count: CHART_COUNT, tickers: CHARTS.slice(0, 3),
    buttons: { wall: (document.getElementById("wallBtn") || {}).className, simple: (document.getElementById("simpleBtn") || {}).className, rotate: { text: document.getElementById("rotateToggle").textContent, disabled: document.getElementById("rotateToggle").disabled, title: document.getElementById("rotateToggle").title } },
    stored: { simple: ls("station.simple"), split: ls("station.simple.split"), c1: ls("station.simple.chart.1"), c2: ls("station.simple.chart.2"), liveC1: ls("station.live.chart.1") },
    rotateTimer: typeof rotateTimer !== "undefined" ? rotateTimer : null };
}
const layoutSig = (r) => JSON.stringify({ cells: r.charts.filter((c) => !c.off).map((c) => c.key), x: r.x && Math.round(r.x.w / r.win.w * 1000), band: r.video && r.video.box && Math.round(r.video.box.h / r.grid.h * 1000), vw: r.video && r.video.box && r.video.box.w === r.rowTop.w, simple: !!(r.simple && r.simple.slot) });
async function settle(page) { await sleep(600); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }
async function until(fn, ms = 20000, step = 250) { const end = Date.now() + ms; let v; while (Date.now() < end) { try { v = await fn(); if (v) return v; } catch (_) {} await sleep(step); } return v; }
const chartFrame = (page, t) => page.frames().find((f) => f.url().includes("/chart") && f.url().includes("t=" + t));

async function simpleCase(browser, origin, [key, W, H]) {
  const res = { screen: key };
  /* the machine's default: a fresh profile on a 1728-wide screen is SIMPLE by itself; nothing stored */
  const { context, page, errs, net } = await open(browser, W, H, { screenWidth: W });
  await page.goto(origin + WALL, { waitUntil: "domcontentloaded" });
  await until(() => page.evaluate(() => document.querySelectorAll("#rowTop > .pane iframe").length >= 2), 30000);
  await sleep(7000); await settle(page);
  res.boot = await page.evaluate(readWall);
  await page.screenshot({ path: path.join(SHOTS, `y9-simple-${key}.png`) });
  log(key, "boot: simpleOn", res.boot.simpleOn, "stored", JSON.stringify(res.boot.stored), "video", JSON.stringify(res.boot.video && res.boot.video.box), "cells", res.boot.charts.filter((c) => !c.off).map((c) => c.key).join(","), "rotate", JSON.stringify(res.boot.buttons.rotate));
  /* the no-reflow rule: 1728 -> 1440 -> 1728, the same layout (as shares) at every step */
  const steps = []; for (let w = W; w >= 1440; w -= 32) steps.push(w); for (let w = 1440; w <= W; w += 32) steps.push(w);
  const sigs = [];
  for (const w of steps) { await page.setViewportSize({ width: w, height: H }); await settle(page); const r = await page.evaluate(readWall); sigs.push({ w, sig: layoutSig(r), video: r.video.box, x: r.x }); }
  await page.setViewportSize({ width: W, height: H }); await settle(page);
  res.resize = { steps: sigs, distinctLayouts: [...new Set(sigs.map((s) => s.sig))].length, at1440: sigs.find((s) => s.w === 1440) };
  log(key, "resize: distinct layouts over", steps.length, "steps =", res.resize.distinctLayouts, "at 1440:", JSON.stringify(res.resize.at1440));
  /* the symbol box in use: the chart's own badge hands the deck's box the focus; type, picture, Enter */
  const c1 = chartFrame(page, "SPY");
  res.symbol = {};
  if (c1) {
    await until(() => c1.evaluate(() => !!document.querySelector(".sc-nchart__live-ticker")), 15000);
    await c1.click(".sc-nchart__live-ticker"); await sleep(400);
    res.symbol.focused = await page.evaluate(() => ({ active: document.activeElement && document.activeElement.id, editing: !!document.querySelector(".chart-pane.editing") }));
    await page.keyboard.type("NVDA"); await sleep(500);
    res.symbol.typing = await page.evaluate(() => ({ value: document.getElementById("t1").value, guideOpen: document.getElementById("symbolGuide").classList.contains("open"), guideRows: document.getElementById("symbolGuide").children.length }));
    await page.screenshot({ path: path.join(SHOTS, `y9-simple-symbol-${key}.png`) });
    await page.keyboard.press("Enter"); await sleep(1500);
    res.symbol.after = await page.evaluate(readWall);
    log(key, "symbol: focus", JSON.stringify(res.symbol.focused), "typed", JSON.stringify(res.symbol.typing), "-> CHARTS", res.symbol.after.tickers.join(","), "stored", JSON.stringify(res.symbol.after.stored));
  } else res.symbol.error = "no SPY chart frame";
  /* the switch: WALL, then SIMPLE again - remembered */
  /* the dock is tucked away (auto-hide): the buttons are reached as a click on the element, not by their place on the screen */
  await page.evaluate(() => document.getElementById("wallBtn").click()); await sleep(1200); await settle(page);
  res.wall = await page.evaluate(readWall);
  await page.screenshot({ path: path.join(SHOTS, `y9-wall-after-switch-${key}.png`) });
  await page.evaluate(() => document.getElementById("simpleBtn").click()); await sleep(1200); await settle(page);
  res.simpleAgain = await page.evaluate(readWall);
  log(key, "switch: WALL -> simpleOn", res.wall.simpleOn, "block", JSON.stringify(res.wall.slotBlock), "stored", res.wall.stored.simple, "| SIMPLE -> simpleOn", res.simpleAgain.simpleOn, "stored", res.simpleAgain.stored.simple, "tickers", res.simpleAgain.tickers.join(","));
  /* the handle: drag the seam 120 px down - the split is remembered */
  const hb = res.simpleAgain.handle;
  if (hb) {
    await page.mouse.move(hb.x + hb.w / 2, hb.y + hb.h / 2); await page.mouse.down(); await page.mouse.move(hb.x + hb.w / 2, hb.y + hb.h / 2 + 60, { steps: 4 }); await page.mouse.move(hb.x + hb.w / 2, hb.y + hb.h / 2 + 120, { steps: 4 }); await page.mouse.up();
    await sleep(800); await settle(page);
    res.handle = await page.evaluate(readWall);
    log(key, "handle: split", res.handle.stored.split, "video", JSON.stringify(res.handle.video.box), "handle", JSON.stringify(res.handle.handle));
  }
  /* a reload: the mode, the split and the two symbols come back */
  await page.reload({ waitUntil: "domcontentloaded" }); await sleep(6000); await settle(page);
  res.reload = await page.evaluate(readWall);
  log(key, "reload: simpleOn", res.reload.simpleOn, "tickers", res.reload.tickers.join(","), "split", res.reload.stored.split, "video", JSON.stringify(res.reload.video.box));
  res.errors = errs; res.refused = [...new Set(net.refused)];
  await context.close();
  return res;
}
/* the iMac's default: a 2560-wide screen with nothing stored is the WALL */
async function imacDefault(browser, origin) {
  const { context, page, errs } = await open(browser, 1062, 685, { screenWidth: 2560 });
  await page.goto(origin + WALL, { waitUntil: "domcontentloaded" }); await sleep(5000); await settle(page);
  const r = await page.evaluate(readWall); await context.close();
  log("iMac default (screen 2560, window 1062x685): simpleOn", r.simpleOn, "block", JSON.stringify(r.slotBlock), "stored", r.stored.simple);
  return { reading: r, errors: errs };
}
async function todayShots(browser, origin) {
  const out = [];
  for (const [key, W, H] of SCREENS) {
    const { context, page } = await open(browser, W, H, { screenWidth: W });
    await page.goto(origin + WALL, { waitUntil: "domcontentloaded" }); await sleep(7000); await settle(page);
    const r = await page.evaluate(readWall); await page.screenshot({ path: path.join(SHOTS, `y9-today-${key}.png`) });
    out.push({ screen: key, video: r.video && r.video.box, block: r.slotBlock, x: r.x }); await context.close();
    log("today", key, "video", JSON.stringify(r.video && r.video.box), "block", JSON.stringify(r.slotBlock));
  }
  return out;
}
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const out = { root: ROOT, today: TODAY, at: new Date().toISOString(), browser: browser.version(), screens: [] };
{ const { server, origin } = await serve(ROOT);
  for (const s of SCREENS) { try { out.screens.push(await simpleCase(browser, origin, s)); } catch (e) { out.screens.push({ screen: s[0], error: String(e.stack || e).slice(0, 500) }); log("ERR", s[0], e.message); } }
  try { out.imacDefault = await imacDefault(browser, origin); } catch (e) { out.imacDefault = { error: String(e).slice(0, 300) }; }
  server.close(); }
{ const { server, origin } = await serve(TODAY); try { out.todayShots = await todayShots(browser, origin); } catch (e) { out.todayShots = { error: String(e).slice(0, 300) }; } server.close(); }
await browser.close();
fs.writeFileSync(path.join(MEASURE, "y9-measure.json"), JSON.stringify(out, null, 1));
log("wrote", path.join(MEASURE, "y9-measure.json"));
process.exit(0);
