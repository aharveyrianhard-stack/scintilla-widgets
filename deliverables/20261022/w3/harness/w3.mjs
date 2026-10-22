// W3 (22 Oct 2026): LIVE · TV on each WIDGETS chart, measured in a hidden browser at 2560 x 1440 and 1280 x 800: the defaults (chart 1 LIVE,
// chart 2 TV), the switch both ways (the symbol and the interval carried), the Y9 door into whichever shell is mounted, the memory through a
// reload, ?chart1= / ?chart2= for one load. Same rig as W1; the chart API by node with the scintillahub.ai origin; every non-GET refused;
// YouTube aborted (not needed). Output: ../shots/w3-*.png, ../measure/w3-measure.json
//   node w3.mjs <root>
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
    if (!sessionStorage.getItem("__w3")) { sessionStorage.setItem("__w3", "1"); for (const k of ["station.widgets", "station.widgets.src.1", "station.widgets.src.2", "station.widgets.chart.1", "station.widgets.chart.2", "station.widgets.tf.1", "station.widgets.tf.2", "station.simple"]) localStorage.removeItem(k);
      localStorage.setItem("station.simple.chart.1", "SPY"); localStorage.setItem("station.simple.chart.2", "QQQ"); } } catch (_) {} });
  const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, net };
}
function readDeck() {
  const R = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return getComputedStyle(n).display === "none" || !r.width ? null : { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const ls = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const slot = (i) => { const p = document.querySelector('#rowTop > .pane[data-key="c' + i + '"]'); const f = p && p.querySelector("iframe"); const src = f ? (f.dataset.shown || f.getAttribute("src")) : null;
    const q = src ? new URL(src, location.origin).searchParams : null; return { box: R(p), src, shell: src ? (/live-v1/.test(src) ? "live" : /tv-v1/.test(src) ? "tv" : "chart") : null, t: q && q.get("t"), tf: q && q.get("tf"), n: q && q.get("n"), badge: p ? ((p.querySelector(".ph .t") || {}).textContent || (p.querySelector(".ph .tkin") || {}).value || null) : null }; };
  return { win: { w: innerWidth, h: innerHeight }, widgetsOn: widgetsOn(), tickers: CHARTS.slice(0, 2), c1: slot(1), c2: slot(2), src: [widgetsSrc(0), widgetsSrc(1)],
    stored: { s1: ls("station.widgets.src.1"), s2: ls("station.widgets.src.2"), c1: ls("station.widgets.chart.1"), c2: ls("station.widgets.chart.2"), tf1: ls("station.widgets.tf.1"), tf2: ls("station.widgets.tf.2") } };
}
const frameOf = (page, n, shell) => page.frames().find((f) => new RegExp("station-shells/" + shell + "-v1/.*[?&]n=" + n + "(&|$)").test(f.url()));
async function stripOf(frame) { return frame.evaluate(() => { const b = (id) => { const e = document.getElementById(id); return e ? { text: e.textContent, on: e.classList.contains("on") } : null; }; const tf = [...document.querySelectorAll("#tfs button")].find((x) => x.classList.contains("on")); return { live: b("srcLive"), tv: b("srcTv"), tf: tf ? tf.textContent : null, sym: (document.getElementById("sym") || {}).textContent || (document.getElementById("sym") || {}).value || null }; }).catch((e) => ({ error: String(e).slice(0, 120) })); }
const out = { at: new Date().toISOString(), root: ROOT, screens: [] };
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  for (const [key, W, H, dpr] of SCREENS) {
    const { context, page, errs, net } = await open(browser, W, H, dpr);
    const e = { screen: key, dpr, errors: errs };
    await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(14000);
    e.boot = await page.evaluate(readDeck);
    await page.screenshot({ path: path.join(SHOTS, `w3-wall-${key}.png`) });
    /* the switch close up: chart 1's strip (live) and chart 2's (tv) */
    if (e.boot.c1.box) await page.screenshot({ path: path.join(SHOTS, `w3-strip-live-${key}.png`), clip: { x: e.boot.c1.box.x, y: e.boot.c1.box.y, width: Math.min(e.boot.c1.box.w, 700), height: 48 } });
    if (e.boot.c2.box) await page.screenshot({ path: path.join(SHOTS, `w3-strip-tv-${key}.png`), clip: { x: e.boot.c2.box.x, y: e.boot.c2.box.y, width: Math.min(e.boot.c2.box.w, 700), height: 48 } });
    const f1 = frameOf(page, 1, "live"), f2 = frameOf(page, 2, "tv");
    e.strips = { c1: f1 ? await stripOf(f1) : null, c2: f2 ? await stripOf(f2) : null };
    /* an interval chosen on chart 1 (live) before the switch, so the carry can be seen: 15m */
    if (f1) { await f1.click('#tfs button[data-tf="15m"]').catch(() => {}); await sleep(2500); }
    /* the switch: chart 1 LIVE -> TV, chart 2 TV -> LIVE */
    if (f1) { await f1.click("#srcTv").catch((x) => { e.c1ClickError = String(x).slice(0, 120); }); }
    await sleep(9000);
    if (f2) { await f2.click("#srcLive").catch((x) => { e.c2ClickError = String(x).slice(0, 120); }); }
    await sleep(14000);
    e.afterSwitch = await page.evaluate(readDeck);
    const g1 = frameOf(page, 1, "tv"), g2 = frameOf(page, 2, "live");
    e.afterSwitch.strips = { c1: g1 ? await stripOf(g1) : null, c2: g2 ? await stripOf(g2) : null };
    await page.screenshot({ path: path.join(SHOTS, `w3-switched-${key}.png`) });
    /* the Y9 door into chart 1, now TV: NVDA */
    await page.evaluate(() => focusTickerFor("c1")); await page.keyboard.type("NVDA"); await page.keyboard.press("Enter"); await sleep(8000);
    e.symbol = await page.evaluate(readDeck);
    /* the reload keeps the choices, the symbols and the intervals */
    await page.reload({ waitUntil: "domcontentloaded" }); await sleep(12000);
    e.reload = await page.evaluate(readDeck);
    const h1 = frameOf(page, 1, "tv"), h2 = frameOf(page, 2, "live");
    e.reload.strips = { c1: h1 ? await stripOf(h1) : null, c2: h2 ? await stripOf(h2) : null };
    /* the URL wins for one load and is not remembered */
    await page.goto(origin + "/deck/?scene=live&charts=9&range=3h&chart1=live&chart2=tv", { waitUntil: "domcontentloaded" }); await sleep(10000);
    e.url = await page.evaluate(readDeck);
    await page.screenshot({ path: path.join(SHOTS, `w3-back-${key}.png`) });
    e.refused = [...new Set(net.refused)];
    out.screens.push(e); await context.close();
    log(key, "boot", e.boot.c1.shell, e.boot.c2.shell, JSON.stringify(e.strips), "| switched", e.afterSwitch.c1.shell, e.afterSwitch.c1.t, e.afterSwitch.c1.tf, e.afterSwitch.c2.shell, e.afterSwitch.c2.t, e.afterSwitch.c2.tf, JSON.stringify(e.afterSwitch.stored), "| symbol", e.symbol.c1.t, e.symbol.c1.shell, "| reload", e.reload.c1.shell, e.reload.c1.t, e.reload.c1.tf, e.reload.c2.shell, e.reload.c2.t, "| url", e.url.c1.shell, e.url.c2.shell, JSON.stringify(e.url.stored), "errs", errs.length, e.c1ClickError || "", e.c2ClickError || "");
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(MEASURE, "w3-measure.json"), JSON.stringify(out, null, 1)); log("wrote");
