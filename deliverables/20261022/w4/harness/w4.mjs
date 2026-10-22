// W4 (22 Oct 2026): the wall at 2560 x 1440 and 1280 x 800 (both charts LIVE, the tight lens tape, the volume panel), the volume panel close
// up with the countdown, the TradingView embed zoomed out with a real pointer click on its Indicators button through the transform.
//   node w4.mjs <root> -> ../shots/w4-*.png, ../measure/w4-measure.json
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(process.argv[2]);
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
const SCREENS = [["2560x1440", 2560, 1440, 1], ["1280x800", 1280, 800, 2]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);
async function open(browser, w, h, dpr) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, screen: { width: w, height: h }, timezoneId: "America/New_York" });
  const net = { refused: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { net.refused.push(req.method() + " " + host); return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") { try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text(); return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); } }
    if (/youtube\.com|googlevideo\.com|google\.com/.test(host)) return route.abort();
    return route.fallback();
  });
  await context.addInitScript(() => { if (window.top !== window) return; try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.removeItem("station.chartsOnly");
    for (const k of ["station.widgets", "station.widgets.src.1", "station.widgets.src.2", "station.widgets.chart.1", "station.widgets.chart.2", "station.widgets.tf.1", "station.widgets.tf.2", "station.simple", "station.lenses.list", "station.lenses.mine"]) localStorage.removeItem(k);
    localStorage.setItem("station.simple.chart.1", "SPY"); localStorage.setItem("station.simple.chart.2", "QQQ"); } catch (_) {} });
  const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, net };
}
function readDeck() {
  const R = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return getComputedStyle(n).display === "none" || !r.width ? null : { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const slot = (i) => { const p = document.querySelector('#rowTop > .pane[data-key="c' + i + '"]'); const f = p && p.querySelector("iframe"); const src = f ? (f.dataset.shown || f.getAttribute("src")) : null; return { box: R(p), shell: src ? (/live-v1/.test(src) ? "live" : /tv-v1/.test(src) ? "tv" : "chart") : null, src }; };
  return { win: { w: innerWidth, h: innerHeight }, c1: slot(1), c2: slot(2), src: [widgetsSrc(0), widgetsSrc(1)], lensTape: R(document.getElementById("wgLensTape")), volume: R(document.getElementById("wgVolume")), video: R(document.querySelector('.pane[data-key="' + VIDEO_FEED + '"]')), tapes: R(document.getElementById("tapes")) };
}
const out = { at: new Date().toISOString(), root: ROOT, walls: [] };
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  for (const [key, W, H, dpr] of SCREENS) {
    const { context, page, errs, net } = await open(browser, W, H, dpr);
    await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(16000);
    const d = await page.evaluate(readDeck);
    await page.screenshot({ path: path.join(SHOTS, `w4-wall-${key}.png`) });
    if (d.lensTape) await page.screenshot({ path: path.join(SHOTS, `w4-lenstape-wall-${key}.png`), clip: { x: d.lensTape.x, y: d.lensTape.y, width: Math.min(d.lensTape.w, 1945), height: d.lensTape.h } });
    if (d.volume) await page.screenshot({ path: path.join(SHOTS, `w4-volume-${key}.png`), clip: { x: d.volume.x, y: d.volume.y, width: d.volume.w, height: d.volume.h } });
    const lensFrame = page.frames().find((f) => /lens-v1\/.*mode=tape/.test(f.url()));
    const lens = lensFrame ? await lensFrame.evaluate(() => ({ list: window.__lens.list(), tf: window.__lens.tf, bars: window.__lens.bars, names: window.__lens.names(), onScreen: [...document.querySelectorAll('.lens:not([aria-hidden="true"])')].filter((l) => { const b = l.getBoundingClientRect(); return b.left < innerWidth && b.right > 0; }).length, cellW: (document.querySelector(".lens") || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width, run: !!document.querySelector(".track.run"), duration: (document.querySelector(".track") || { style: {} }).style.animationDuration, addBox: !!document.getElementById("add") && getComputedStyle(document.getElementById("add")).display !== "none", placeholder: (document.getElementById("add") || {}).placeholder })).catch((e) => ({ error: String(e).slice(0, 120) })) : null;
    const volFrame = page.frames().find((f) => /volume-v1/.test(f.url()));
    const vol = volFrame ? await volFrame.evaluate(() => ({ buy: document.getElementById("buy").textContent, sell: document.getElementById("sell").textContent, buyPx: getComputedStyle(document.getElementById("buy")).fontSize, tsize: document.getElementById("tsize").innerText, block: document.getElementById("block").innerText, mmss: document.getElementById("mmss").textContent, num: document.getElementById("num").textContent, lights: [...document.querySelectorAll("#lights .light")].map((l) => l.className.replace("light ", "") + ":" + l.textContent), heart: { cls: document.getElementById("heart").className, core: document.querySelector("#heart .core").style.width }, trace: !!document.querySelector("#chart polyline"), labels: [...document.querySelectorAll("#chart text")].map((t) => t.textContent) })).catch((e) => ({ error: String(e).slice(0, 120) })) : null;
    out.walls.push({ screen: key, deck: d, lens, volume: vol, errors: errs, refused: [...new Set(net.refused)] });
    log(key, "charts", d.c1.shell, d.c2.shell, "lensTape", JSON.stringify(d.lensTape), "lens", JSON.stringify(lens), "vol", JSON.stringify(vol).slice(0, 300), "errs", errs.length);
    await context.close();
  }
  /* the embed zoomed out: tv-v1 alone at the 2560 slot's size; a real pointer click on its Indicators button, mapped through the 0.8 scale */
  { const { context, page, errs } = await open(browser, 1074, 756, 1);
    await page.goto(origin + "/station-shells/tv-v1/?shell=v1&bare=1&t=SPY&tf=5&n=2", { waitUntil: "domcontentloaded" }); await sleep(14000);
    const zoom = await page.evaluate(() => { const z = document.querySelector("#host .zoom"); const r = z.getBoundingClientRect(); const f = document.querySelector("#host iframe"); const fr = f ? f.getBoundingClientRect() : null; return { zoomBox: { x: r.left, y: r.top, w: r.width, h: r.height }, frameBox: fr && { x: fr.left, y: fr.top, w: fr.width, h: fr.height }, cssW: f && f.offsetWidth, cssH: f && f.offsetHeight }; });
    const frame = page.frames().find((f) => /tradingview-widget\.com/.test(f.url()));
    let click = null;
    if (frame) {
      const btn = await frame.evaluate(() => { const b = [...document.querySelectorAll('[data-name="open-indicators-dialog"]')].find((x) => x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }).catch(() => null);
      if (btn) {
        /* the frame's own CSS px -> the page: the frame's top-left in the page, plus the point scaled by 0.8 */
        const px = zoom.frameBox.x + btn.x * 0.8, py = zoom.frameBox.y + btn.y * 0.8;
        await page.mouse.click(px, py); await sleep(2500);
        const opened = await frame.evaluate(() => { const d = document.querySelector('[data-name="indicators-dialog"], [class*="dialog-"]'); return d ? d.innerText.slice(0, 80) : null; }).catch(() => null);
        click = { buttonInFrame: btn, clickedAtPage: { x: +px.toFixed(1), y: +py.toFixed(1) }, dialogOpened: !!opened, dialogText: opened };
        await page.screenshot({ path: path.join(SHOTS, "w4-tv-zoom-click.png") });
      }
    }
    out.tvZoom = { zoom, click, errors: errs }; await context.close();
    log("tv zoom", JSON.stringify(zoom), "click", JSON.stringify(click)); }
  /* the volume panel alone at the 2560 column size, and the countdown flash: wait for a 5-minute close if one is under 70 s away */
  { const { context, page, errs } = await open(browser, 738, 576, 1);
    await page.goto(origin + "/station-shells/volume-v1/?shell=v1", { waitUntil: "domcontentloaded" }); await sleep(7000);
    const left = await page.evaluate(() => { const [m, s] = document.getElementById("mmss").textContent.split(":").map(Number); return m * 60 + s; });
    let flash = null;
    if (left <= 70) { await sleep((left + 1) * 1000); flash = await page.evaluate(() => ({ cls: document.getElementById("count").className, closedAt: document.getElementById("count").dataset.closedAt, mmss: document.getElementById("mmss").textContent })); await page.screenshot({ path: path.join(SHOTS, "w4-volume-flash.png") }); }
    await page.screenshot({ path: path.join(SHOTS, "w4-volume-alone.png") });
    out.volumeAlone = { secondsToCloseAtOpen: left, flash, errors: errs }; await context.close();
    log("volume alone", left, "s to close", JSON.stringify(flash)); }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(MEASURE, "w4-measure.json"), JSON.stringify(out, null, 1)); log("wrote");
