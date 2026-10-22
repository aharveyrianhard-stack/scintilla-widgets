// Y9 (21 Oct 2026): the wall, measured in a hidden browser - today's deck (@3447276) and SIMPLE.
//   node wall.mjs <root> <label> [screens|sweep|all] [counts e.g. 9,6,4,2]
// Same rig as S11/Y7/Y8 (the checkout served locally; the chart API fetched by node with the scintillahub.ai
// origin). Headless shell; every non-GET request is aborted, so nothing is written anywhere. Output only to
// ../measure/<label>-*.json and ../shots/<label>-*.png. Charts: index ETFs only.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2]), LABEL = process.argv[3] || "today", ONLY = process.argv[4] || "all";
const COUNTS = (process.argv[5] || "9,6,4,2").split(",").map(Number);
const SIMPLE = process.env.Y9_SIMPLE === "1" ? "1" : process.env.Y9_SIMPLE === "0" ? "0" : null;   // force the mode on/off (SIMPLE build only)
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(MEASURE, { recursive: true });
const SCREENS = [["1728x1117", 1728, 1117, "MacBook Pro 16in, default scaling"], ["1512x982", 1512, 982, "MacBook Pro 14in, default scaling"], ["1440x900", 1440, 900, "MacBook, 'more space' off / older"]];
const ETFS = ["SPY", "QQQ", "DIA", "IWM", "XLK", "XLF", "XLE", "SMH", "TLT"];
const wallUrl = (n) => "/deck/?scene=live&charts=" + n + "&range=3D&" + ETFS.slice(0, n).map((t, i) => "c" + (i + 1) + "=" + t).join("&");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);

async function open(browser, w, h) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const net = { refused: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { net.refused.push(req.method() + " " + host); return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") {
      try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
    }
    /* YouTube's player and thumbnails are not needed for the wall's geometry; the pane's own feed read (supabase GET) is let through */
    if (/youtube\.com|ytimg\.com|googlevideo\.com|google\.com/.test(host)) return route.abort();
    return route.fallback();
  });
  await context.addInitScript((simple) => {
    if (window.top !== window) return;
    try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.removeItem("station.chartsOnly");
      if (simple === "1") localStorage.setItem("station.simple", "1"); else if (simple === "0") localStorage.setItem("station.simple", "0"); else localStorage.removeItem("station.simple"); } catch (_) {}
  }, SIMPLE);
  const page = await context.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, net };
}
/* one reading of the wall: who is where */
function readWall() {
  const R = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); const cs = getComputedStyle(n);
    return cs.display === "none" || r.width === 0 ? null : { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const dock = document.getElementById("dock"), grid = document.getElementById("grid"), top = document.getElementById("rowTop"), bot = document.getElementById("rowBot");
  const charts = [...document.querySelectorAll("#rowTop > .pane")].map((p) => ({ key: p.dataset.key, box: R(p), cls: p.className.replace("pane chart-pane", "").trim() })).filter((c) => c.box);
  const video = [...document.querySelectorAll(".pane[data-key]")].find((p) => p.dataset.key === (typeof VIDEO_FEED !== "undefined" ? VIDEO_FEED : "fa"));
  const x = document.querySelector('.pane[data-key="x"]');
  const slot = typeof SLOT_NOW !== "undefined" && SLOT_NOW && SLOT_NOW.slot ? { block: SLOT_NOW.slot.block, cols: SLOT_NOW.slot.cols, rows: SLOT_NOW.slot.rows, box: SLOT_NOW.slot.box, charts: SLOT_NOW.slot.charts, hidden: SLOT_NOW.slot.hidden } : null;
  const simple = typeof SIMPLE_NOW !== "undefined" ? SIMPLE_NOW : undefined;
  return { win: { w: innerWidth, h: innerHeight }, view: document.body.dataset.view || "", body: document.body.className,
    dock: { cls: dock ? dock.className : "", h: dock ? Math.round(dock.getBoundingClientRect().height) : null, fit: dock ? dock.style.getPropertyValue("--dock-fit") : "" },
    grid: R(grid), col: grid ? grid.style.getPropertyValue("--fp-col") : "", rowTop: top ? { cls: top.className, box: R(top), fpc: top.style.getPropertyValue("--fp-c" + (typeof CHART_COUNT !== "undefined" ? CHART_COUNT : "")), fpr: top.style.getPropertyValue("--fp-r" + (typeof CHART_COUNT !== "undefined" ? CHART_COUNT : "")) } : null,
    rowBot: R(bot), count: typeof CHART_COUNT !== "undefined" ? CHART_COUNT : null, slot, simple,
    video: video ? { key: video.dataset.key, cls: video.className.replace("pane integrated", "").trim(), box: R(video) } : null,
    x: x ? { cls: x.className.replace("pane integrated", "").trim(), box: R(x) } : null, charts };
}
const signature = (r) => JSON.stringify({ s: !!r.slot && r.slot.block, v: r.video && r.video.box && [r.video.box.w, r.video.box.h], g: r.rowTop && [r.rowTop.fpc, r.rowTop.fpr], d: r.dock.cls, view: r.view, n: r.charts.length, hid: r.slot && r.slot.hidden });
async function settle(page) { await sleep(700); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }

async function screens(browser, origin, count) {
  const out = [];
  for (const [key, W, H, note] of SCREENS) {
    const { context, page, errs, net } = await open(browser, W, H);
    await page.goto(origin + wallUrl(count), { waitUntil: "domcontentloaded" });
    await sleep(6000); await settle(page);
    const r = await page.evaluate(readWall);
    await page.screenshot({ path: path.join(SHOTS, `${LABEL}-${count}ch-${key}.png`) });
    out.push({ screen: key, note, count, reading: r, errors: errs, refused: [...new Set(net.refused)] });
    log(LABEL, count + "ch", key, "slot", JSON.stringify(r.slot && r.slot.block), "video", JSON.stringify(r.video && r.video.box), "dock", r.dock.cls || "plain", r.dock.h, "grid", JSON.stringify(r.rowTop && [r.rowTop.fpc, r.rowTop.fpr]), "simple", JSON.stringify(r.simple));
    await context.close();
  }
  return out;
}
/* the sweep: one window, narrowed 8 px at a time from 1800 to 1000 at the MacBook's height; every change of shape is recorded */
async function sweep(browser, origin, count, H = 1117) {
  const { context, page, errs } = await open(browser, 1800, H);
  await page.goto(origin + wallUrl(count), { waitUntil: "domcontentloaded" });
  await sleep(6000); await settle(page);
  const changes = []; let last = null;
  for (let w = 1800; w >= 1000; w -= 8) {
    await page.setViewportSize({ width: w, height: H }); await settle(page);
    const r = await page.evaluate(readWall); const sig = signature(r);
    if (sig !== last) { changes.push({ atWidth: w, reading: r }); last = sig; }
  }
  /* and back up, 1440 -> 1728, the way a window is dragged wider */
  const back = []; last = null;
  for (let w = 1440; w <= 1728; w += 8) {
    await page.setViewportSize({ width: w, height: H }); await settle(page);
    const r = await page.evaluate(readWall); const sig = signature(r);
    if (sig !== last) { back.push({ atWidth: w, reading: r }); last = sig; }
  }
  await context.close();
  log(LABEL, count + "ch sweep: " + changes.length + " shapes going down, " + back.length + " coming back up", changes.map((c) => c.atWidth + ":" + JSON.stringify(c.reading.slot && c.reading.slot.block) + "/" + (c.reading.video && c.reading.video.box ? c.reading.video.box.w + "x" + c.reading.video.box.h : "-") + "/" + c.reading.dock.cls).join("  "));
  return { count, height: H, down: changes, up: back, errors: errs };
}

const { server, origin } = await serve(ROOT);
const out = { root: ROOT, label: LABEL, at: new Date().toISOString(), screens: [], sweeps: [] };
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
out.browser = browser.version(); log("browser", out.browser, "root", ROOT);
for (const n of COUNTS) {
  if (ONLY === "all" || ONLY === "screens") { try { out.screens.push(...await screens(browser, origin, n)); } catch (e) { out.screens.push({ count: n, error: String(e.stack || e).slice(0, 400) }); log("ERR", n, e.message); } }
  if (ONLY === "all" || ONLY === "sweep") { try { out.sweeps.push(await sweep(browser, origin, n)); } catch (e) { out.sweeps.push({ count: n, error: String(e.stack || e).slice(0, 400) }); log("ERR sweep", n, e.message); } }
}
await browser.close(); server.close();
fs.writeFileSync(path.join(MEASURE, `${LABEL}-wall.json`), JSON.stringify(out, null, 1));
log("wrote", path.join(MEASURE, `${LABEL}-wall.json`));
process.exit(0);
