// W7 (22 Oct 2026): the wall at 2560 x 1440, 1920 x 1080 (the Apple TV) and 1280 x 800, idle and with a video playing; the lens grid in BARS and
// LINE with RVol; the volume panel close up; one click on the control row changes both charts' timeframe; a ticker typed into chart 2 (on TV, the
// shell with the box this lane owns). Same rig; every non-GET refused; YouTube's player allowed for the playing pictures.
//   node w7.mjs <root> -> ../shots/w7-*.png, ../measure/w7-measure.json
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(process.argv[2]);
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
const SCREENS = [["2560x1440", 2560, 1440, 1], ["1920x1080", 1920, 1080, 1], ["1280x800", 1280, 800, 2]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);
async function open(browser, w, h, dpr, { youtube = true } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, screen: { width: w, height: h }, timezoneId: "America/New_York" });
  const net = { refused: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { net.refused.push(req.method() + " " + host); return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") { try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text(); return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); } }
    if (!youtube && /youtube\.com|googlevideo\.com|google\.com/.test(host)) return route.abort();
    return route.fallback();
  });
  await context.addInitScript(() => { if (window.top !== window) return; try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.removeItem("station.chartsOnly");
    for (const k of ["station.widgets", "station.widgets.src.1", "station.widgets.src.2", "station.widgets.chart.1", "station.widgets.chart.2", "station.widgets.tf", "station.widgets.tf.1", "station.widgets.tf.2", "station.widgets.clouds", "station.simple", "station.lenses.list", "station.lenses.mine", "station.lenses.style"]) localStorage.removeItem(k);
    localStorage.setItem("station.simple.chart.1", "SPY"); localStorage.setItem("station.simple.chart.2", "QQQ"); } catch (_) {} });
  const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, net };
}
function readDeck() {
  const R = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return getComputedStyle(n).display === "none" || !r.width ? null : { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const A = innerWidth * innerHeight, sh = (b) => b ? +(b.w * b.h / A * 100).toFixed(1) : null;
  const slot = (i) => { const p = document.querySelector('#rowTop > .pane[data-key="c' + i + '"]'); const f = p && p.querySelector("iframe"); const src = f ? (f.dataset.shown || f.getAttribute("src")) : null; const q = src ? new URL(src, location.origin).searchParams : null; return { box: R(p), shell: src ? (/live-v1/.test(src) ? "live" : /tv-v1/.test(src) ? "tv" : "chart") : null, t: q && q.get("t"), tf: q && q.get("tf"), sync: q && q.get("sync"), clouds: q && q.get("clouds") }; };
  const o = { win: { w: innerWidth, h: innerHeight }, c1: slot(1), c2: slot(2), tickers: CHARTS.slice(0, 2), tfOne: widgetsTfOne(), clouds: widgetsClouds(), x: R(document.querySelector('.pane[data-key="x"]')), video: R(document.querySelector('.pane[data-key="' + VIDEO_FEED + '"]')), lens: R(document.getElementById("wgLensTape")), volume: R(document.getElementById("wgVolume")), tapes: R(document.getElementById("tapes")), ctl: R(document.getElementById("wgCtl")), playing: widgetsPlaying(), rows: WIDGETS_NOW && WIDGETS_NOW.slot && WIDGETS_NOW.slot.lensTape ? WIDGETS_NOW.slot.lensTape.rows : null, tapeLeft: getComputedStyle(document.getElementById("tapes")).left, cellRv: (document.querySelector("#tapes .cell .rv") || {}).textContent || null };
  o.shares = { x: sh(o.x), chart1: sh(o.c1.box), chart2: sh(o.c2.box), video: sh(o.video), lens: sh(o.lens), volume: sh(o.volume), tapes: sh(o.tapes) };
  return o;
}
const out = { at: new Date().toISOString(), root: ROOT, walls: [] };
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  for (const [key, W, H, dpr] of SCREENS) {
    const { context, page, errs, net } = await open(browser, W, H, dpr);
    await page.goto(origin + "/deck/?scene=live&charts=9&range=3h&chart2=tv", { waitUntil: "domcontentloaded" }); await sleep(16000);
    const idle = await page.evaluate(readDeck);
    await page.screenshot({ path: path.join(SHOTS, `w7-idle-${key}.png`) });
    if (idle.volume) await page.screenshot({ path: path.join(SHOTS, `w7-volume-${key}.png`), clip: { x: idle.volume.x, y: idle.volume.y, width: idle.volume.w, height: idle.volume.h } });
    if (idle.lens) await page.screenshot({ path: path.join(SHOTS, `w7-lensgrid-${key}.png`), clip: { x: idle.lens.x, y: idle.lens.y, width: idle.lens.w, height: idle.lens.h } });
    if (idle.tapes) await page.screenshot({ path: path.join(SHOTS, `w7-tape-${key}.png`), clip: { x: idle.tapes.x, y: idle.tapes.y, width: Math.min(idle.tapes.w, 1400), height: idle.tapes.h } });
    const lensFrame = page.frames().find((f) => /lens-v1\/.*mode=tape/.test(f.url()));
    const lens = lensFrame ? await lensFrame.evaluate(() => ({ list: window.__lens.list(), style: window.__lens.style(), rows: window.__lens.rows(), tracks: document.querySelectorAll(".track").length, cells: document.querySelectorAll('.lens:not([aria-hidden="true"])').length, onScreen: [...document.querySelectorAll('.lens:not([aria-hidden="true"])')].filter((l) => { const b = l.getBoundingClientRect(); return b.left < innerWidth && b.right > 0 && b.top < innerHeight; }).length, cellW: (document.querySelector(".lens") || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width, rvol: Object.keys(window.__lens.rvol()).length, tkPx: getComputedStyle(document.querySelector(".lens .tk")).fontSize })).catch((e) => ({ error: String(e).slice(0, 120) })) : null;
    /* the synced timeframe: one click on the control row -> both charts */
    await page.evaluate(() => document.querySelector('#wgCtl button[data-tf="15"]').click()); await sleep(6000);
    const synced = await page.evaluate(readDeck);
    /* a ticker typed into chart 2 (TV's box) */
    const tvFrame = page.frames().find((f) => /tv-v1\/.*n=2/.test(f.url()));
    if (tvFrame) { await tvFrame.fill("#tbox", "NVDA").catch(() => {}); await tvFrame.press("#tbox", "Enter").catch(() => {}); await sleep(3000); }
    const typed = await page.evaluate(readDeck);
    await page.screenshot({ path: path.join(SHOTS, `w7-synced-${key}.png`) });
    /* a video playing */
    const vf = page.frames().find((f) => /station-shells\/(scintilla|personal)-video-v1/.test(f.url()));
    let play = null;
    if (vf) { const picked = await vf.evaluate(() => { const c = [...document.querySelectorAll("#grid .card")].find((k) => !/LIVE|live in|premier/i.test(k.innerText)); if (!c) return null; c.scrollIntoView(); return c.dataset.v; }).catch(() => null); if (picked) { await vf.click('#grid .card[data-v="' + picked + '"]').catch(() => {}); await sleep(7000); }
      play = await vf.evaluate(() => { const R = (n) => { const b = n.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; }; const v = R(document.getElementById("video")); const pw = Math.min(v.w, Math.floor(v.h * 16 / 9)); return { playing: document.body.classList.contains("playing"), video: v, picture: { w: pw, h: Math.round(pw * 9 / 16) } }; }).catch(() => null); }
    const playing = await page.evaluate(readDeck);
    await page.screenshot({ path: path.join(SHOTS, `w7-playing-${key}.png`) });
    out.walls.push({ screen: key, idle, lens, synced, typed, play, playing, errors: errs, refused: [...new Set(net.refused)] });
    log(key, "idle x", JSON.stringify(idle.x), "charts", JSON.stringify([idle.c1.box, idle.c2.box]), "video", JSON.stringify(idle.video), "lens", JSON.stringify(idle.lens), "rows", idle.rows, "vol", JSON.stringify(idle.volume), "tapes", JSON.stringify(idle.tapes), "tapeLeft", idle.tapeLeft, "shares", JSON.stringify(idle.shares), "| lens", JSON.stringify(lens), "| synced", synced.tfOne, synced.c1.tf, synced.c2.tf, "| typed", typed.tickers, typed.c2.t, "| playing", JSON.stringify(play && play.picture), JSON.stringify(playing.video), "errs", errs.length);
    await context.close();
  }
  /* the lens grid alone, MACRO and MINE, bars and line, three rows at the 2560 band's size */
  for (const [list, style] of [["macro", "bars"], ["macro", "line"], ["mine", "bars"]]) { try {
    const { context, page, errs } = await open(browser, 1255, 515, 1, { youtube: false });
    await context.addInitScript((style) => { try { localStorage.setItem("station.lenses.style", style); } catch (_) {} }, style);
    await page.goto(origin + "/station-shells/lens-v1/?shell=v1&mode=tape&rows=3&list=" + list, { waitUntil: "domcontentloaded" }); await sleep(14000);
    const r = await page.evaluate(() => ({ style: window.__lens.style(), rows: window.__lens.rows(), lenses: [...document.querySelectorAll('.lens:not([aria-hidden="true"])')].map((l) => ({ t: l.dataset.t, head: l.querySelector(".head").innerText.replace(/\n/g, " "), nm: (l.querySelector(".nm") || {}).textContent, why: l.querySelector(".why").textContent, bars: l.dataset.bars, num: (l.querySelector(".num") || {}).innerText || null })), rvol: window.__lens.rvol() }));
    await page.screenshot({ path: path.join(SHOTS, `w7-lensgrid-${list}-${style}.png`) });
    out["lens_" + list + "_" + style] = { reading: r, errors: errs }; await context.close();
    log("lens grid", list, style, r.lenses.length, "drawn", r.lenses.filter((l) => !l.why).length, "rvol", Object.keys(r.rvol).length, JSON.stringify(r.lenses.slice(0, 3)).slice(0, 400));
  } catch (e) { log("lens grid", list, style, "failed:", String(e).slice(0, 160)); out["lens_" + list + "_" + style] = { error: String(e).slice(0, 200) }; } }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(MEASURE, "w7-measure.json"), JSON.stringify(out, null, 1)); log("wrote");
