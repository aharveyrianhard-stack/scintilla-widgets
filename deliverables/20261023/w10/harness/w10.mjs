// W10 (23 Oct 2026): the fixed wall, proved. (1) the resize sweep 1280x720 -> 2560x1440 in 12 steps (and 1920x1080): every box's position and
// size against the window width - a straight line or not; (2) idle and playing at 2560x1440 and 1920x1080: the same boxes; (3) the grid reloaded
// twice while a video plays: the player untouched; (4) the tapes' motion sampled every animation frame for 30 s: the step sizes; (5) the volume
// panel with a recorded in-session heartbeat and with the live (closed) one. Same rig; every non-GET refused; YouTube allowed for the playing runs.
//   node w10.mjs <root> [all|sweep|tapes|video|volume] -> ../shots/w10-*.png, ../measure/w10-*.json
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(process.argv[2]), ONLY = process.argv[3] || "all";
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
const RECORDED = JSON.parse(fs.readFileSync(path.join(MEASURE, "heartbeat-20261022-1801ET.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);
async function open(browser, w, h, dpr, { youtube = true, recorded = false } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, screen: { width: w, height: h }, timezoneId: "America/New_York" });
  const net = { refused: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { net.refused.push(req.method() + " " + host); return route.abort(); }
    if (recorded && /volume-pulse-pied\.vercel\.app\/api\/heartbeat/.test(url)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RECORDED), headers: { "access-control-allow-origin": "*" } });
    if (host === "scintilla-massive-chart-api.fly.dev") { try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text(); return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); } }
    if (!youtube && /youtube\.com|googlevideo\.com|google\.com/.test(host)) return route.abort();
    return route.fallback();
  });
  await context.addInitScript(() => { if (window.top !== window) return; try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.removeItem("station.chartsOnly");
    for (const k of ["station.widgets", "station.widgets.src.1", "station.widgets.src.2", "station.widgets.chart.1", "station.widgets.chart.2", "station.widgets.tf", "station.widgets.tf.1", "station.widgets.tf.2", "station.simple", "station.lenses.list", "station.lenses.style"]) localStorage.removeItem(k);
    localStorage.setItem("station.simple.chart.1", "SPY"); localStorage.setItem("station.simple.chart.2", "QQQ"); } catch (_) {} });
  const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, net };
}
function readBoxes() {
  const R = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return getComputedStyle(n).display === "none" || !r.width ? null : { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const q = (s) => document.querySelector(s);
  const b = { x: R(q('.pane[data-key="x"]')), c1: R(q('#rowTop > .pane[data-key="c1"]')), c2: R(q('#rowTop > .pane[data-key="c2"]')), video: R(q('.pane[data-key="' + VIDEO_FEED + '"]')), lens: R(q("#wgLensTape")), volume: R(q("#wgVolume")), tapes: R(q("#tapes")), ctl: R(q("#wgCtl")) };
  const A = innerWidth * innerHeight; b.shares = Object.fromEntries(Object.entries(b).filter(([k, v]) => v && k !== "shares").map(([k, v]) => [k, +(v.w * v.h / A * 100).toFixed(1)]));
  b.win = { w: innerWidth, h: innerHeight }; b.playing = typeof VIDEO_PLAYING !== "undefined" ? VIDEO_PLAYING.on : null; b.rows = WIDGETS_NOW && WIDGETS_NOW.slot && WIDGETS_NOW.slot.lensTape ? WIDGETS_NOW.slot.lensTape.rows : null;
  return b;
}
/* a straight-line test: for each box edge, fit v = a·W + b across the sweep (least squares) and report the largest residual in px */
function linearity(samples) {
  const out = {}; const keys = ["x", "c1", "c2", "video", "lens", "volume", "tapes"];
  for (const k of keys) for (const e of ["x", "y", "w", "h"]) {
    const pts = samples.filter((s) => s.boxes[k]).map((s) => [s.w, s.boxes[k][e]]); if (pts.length < 3) continue;
    const n = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0), sxx = pts.reduce((a, p) => a + p[0] * p[0], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
    const a = (n * sxy - sx * sy) / (n * sxx - sx * sx), b = (sy - a * sx) / n;
    const res = pts.map((p) => Math.abs(p[1] - (a * p[0] + b))); out[k + "." + e] = { slope: +a.toFixed(4), maxResidualPx: +Math.max(...res).toFixed(1) };
  }
  return out;
}
const out = { at: new Date().toISOString(), root: ROOT };
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  if (ONLY === "all" || ONLY === "sweep") {
    /* 1. the sweep: one window, 1280x720 -> 2560x1440 in 12 steps (16:9 both), then 1920x1080; the order of the boxes and their lines */
    const { context, page, errs } = await open(browser, 1280, 720, 1, { youtube: false });
    await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(9000);
    const samples = [];
    for (let i = 0; i <= 12; i++) { const w = 1280 + Math.round((2560 - 1280) * i / 12), h = Math.round(w * 9 / 16); await page.setViewportSize({ width: w, height: h }); await sleep(900); samples.push({ w, h, boxes: await page.evaluate(readBoxes) }); }
    await page.setViewportSize({ width: 1920, height: 1080 }); await sleep(900); const tv = await page.evaluate(readBoxes);
    const order = samples.map((s) => Object.entries(s.boxes).filter(([k, v]) => v && typeof v === "object" && "x" in v).sort((a, b) => a[1].x - b[1].x || a[1].y - b[1].y).map(([k]) => k).join(">"));
    out.sweep = { samples, linearity: linearity(samples), orderBySample: order, sameOrder: order.every((o) => o === order[0]), appleTv: tv, errors: errs };
    const worst = Object.entries(out.sweep.linearity).sort((a, b) => b[1].maxResidualPx - a[1].maxResidualPx).slice(0, 4);
    log("sweep", "sameOrder", out.sweep.sameOrder, "worst residuals", JSON.stringify(worst), "1920 charts", JSON.stringify(tv.c1), "errs", errs.length);
    await context.close();
  }
  if (ONLY === "all" || ONLY === "video") {
    /* 2 + 3. idle and playing at 2560 and 1920: the same boxes; the grid reloaded twice while playing: the player untouched */
    out.video = [];
    for (const [key, W, H] of [["2560x1440", 2560, 1440], ["1920x1080", 1920, 1080]]) {
      const { context, page, errs } = await open(browser, W, H, 1);
      await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(14000);
      const idle = await page.evaluate(readBoxes); await page.screenshot({ path: path.join(SHOTS, `w10-idle-${key}.png`) });
      if (idle.tapes) await page.screenshot({ path: path.join(SHOTS, `w10-tape-${key}.png`), clip: { x: idle.tapes.x, y: idle.tapes.y, width: Math.min(idle.tapes.w, 1400), height: idle.tapes.h } });
      if (idle.lens) await page.screenshot({ path: path.join(SHOTS, `w10-lens-${key}.png`), clip: { x: idle.lens.x, y: idle.lens.y, width: idle.lens.w, height: idle.lens.h } });
      const vf = page.frames().find((f) => /station-shells\/(scintilla|personal)-video-v1/.test(f.url()));
      const shell0 = vf ? await vf.evaluate(() => ({ fixed: document.body.classList.contains("fixed"), col: getComputedStyle(document.body).getPropertyValue("--beside-col"), gridDisplay: getComputedStyle(document.getElementById("grid")).display, cards: document.querySelectorAll("#grid .card").length, idleNote: getComputedStyle(document.getElementById("idleNote")).display })).catch(() => null) : null;
      let play = null, reloads = [];
      if (vf) {
        const picked = await vf.evaluate(() => { const c = [...document.querySelectorAll("#grid .card")].find((k) => !/LIVE|live in|premier/i.test(k.innerText)); if (!c) return null; c.scrollIntoView(); return c.dataset.v; }).catch(() => null);
        if (picked) { await vf.click('#grid .card[data-v="' + picked + '"]').catch(() => {}); await sleep(8000); }
        const snap = () => vf.evaluate(() => { const f = document.querySelector("#video iframe"); const R = (n) => { const b = n.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
          window.__pf = window.__pf || f; return { playing: document.body.classList.contains("playing"), sameIframe: window.__pf === f, iframeSrc: f ? f.getAttribute("src").slice(0, 60) : null, player: typeof YT_PLAYER !== "undefined" && YT_PLAYER ? { state: YT_PLAYER.getPlayerState ? YT_PLAYER.getPlayerState() : null, time: YT_PLAYER.getCurrentTime ? +YT_PLAYER.getCurrentTime().toFixed(1) : null } : null, stage: R(document.getElementById("stage")), grid: R(document.getElementById("grid")), gridDisplay: getComputedStyle(document.getElementById("grid")).display, cards: document.querySelectorAll("#grid .card").length, cur: typeof CUR !== "undefined" && CUR ? CUR.video_id : null }; }).catch((e) => ({ error: String(e).slice(0, 100) }));
        play = await snap();
        for (let i = 0; i < 2; i++) { await vf.click("#bRefresh").catch(() => {}); await sleep(6000); reloads.push(await snap()); }
      }
      const playing = await page.evaluate(readBoxes); await page.screenshot({ path: path.join(SHOTS, `w10-playing-${key}.png`) });
      const same = JSON.stringify([idle.x, idle.c1, idle.c2, idle.video, idle.lens, idle.volume, idle.tapes]) === JSON.stringify([playing.x, playing.c1, playing.c2, playing.video, playing.lens, playing.volume, playing.tapes]);
      out.video.push({ screen: key, idle, shell0, play, reloads, playing, sameBoxesPlaying: same, errors: errs });
      log(key, "idle", JSON.stringify(idle.shares), "rows", idle.rows, "shell", JSON.stringify(shell0), "| play", JSON.stringify(play).slice(0, 300), "| reloads", JSON.stringify(reloads.map((r) => [r.sameIframe, r.player, r.cur, r.cards])), "| same boxes while playing:", same, "errs", errs.length);
      await context.close();
    }
  }
  if (ONLY === "tapes2") {
    /* 4b. the same tapes sampled again, with the frame's own length kept: a long frame (the headless CPU paused) moves the tape further in one
       step while the speed (px per ms) stays the same - that is a dropped frame, not a jump of the tape. The lens tape on MACRO (12 names,
       more than 3 rows hold) so it runs. */
    const { context, page, errs } = await open(browser, 2560, 1440, 1, { youtube: false });
    await context.addInitScript(() => { if (window.top !== window) return; try { localStorage.setItem("station.lenses.list", "macro"); } catch (_) {} });
    await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(14000);
    await page.evaluate(() => { window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push({ t: Math.round(e.startTime), ms: Math.round(e.duration), where: (e.attribution || []).map((a) => (a.containerType || "") + ":" + (a.containerSrc || a.containerName || a.name || "").replace(/^https?:\/\/[^/]+/, "").slice(0, 70)).join(" ") }); }).observe({ entryTypes: ["longtask"] }); } catch (e) { window.__long.push({ err: String(e) }); } });
    const sample2 = (frame, sel) => frame.evaluate((sel) => new Promise((resolve) => { const t = document.querySelector(sel); if (!t) return resolve(null); const xs = []; const start = performance.now();
      const step = () => { const m = new DOMMatrixReadOnly(getComputedStyle(t).transform); xs.push([performance.now() - start, -m.m41, t.getBoundingClientRect().width]); if (performance.now() - start < 30000) requestAnimationFrame(step); else {
        const steps = [], dts = [], speeds = []; for (let i = 1; i < xs.length; i++) { let d = xs[i][1] - xs[i - 1][1]; if (d < -xs[i][2] / 4) d += xs[i][2] / 2; const dt = xs[i][0] - xs[i - 1][0]; steps.push(+d.toFixed(2)); dts.push(+dt.toFixed(1)); speeds.push(+(d / dt).toFixed(4)); }
        const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
        const mS = med(steps), mT = med(dts), mV = med(speeds);
        const bigSteps = steps.map((s, i) => [s, dts[i], speeds[i]]).filter((x) => x[0] > 2 * mS + 0.05);
        const merged = []; for (let i = 0; i < steps.length; i++) { if (dts[i] < 4 && merged.length) { merged[merged.length - 1][0] += steps[i]; merged[merged.length - 1][1] += dts[i]; } else merged.push([steps[i], dts[i]]); }
        const mSpeeds = merged.map((x) => x[0] / x[1]), mmV = med(mSpeeds);
        const mergedOut = { intervals: merged.length, speedMedian: +mmV.toFixed(4), speedMax: +Math.max(...mSpeeds).toFixed(4), speedMin: +Math.min(...mSpeeds).toFixed(4), over2x: mSpeeds.filter((v) => v > 2 * mmV).length, under50pct: mSpeeds.filter((v) => v < mmV / 2).length, longest: merged.filter((x) => x[1] > 2 * mT).map((x) => [+x[0].toFixed(2), +x[1].toFixed(1), +(x[0] / x[1]).toFixed(4)]) };
        resolve({ frames: xs.length, step: { median: mS, max: Math.max(...steps), over2x: bigSteps.length, negative: steps.filter((s) => s < -0.05).length }, frameMs: { median: mT, max: Math.max(...dts), over2x: dts.filter((d) => d > 2 * mT).length }, speedPxPerMs: { median: mV, max: Math.max(...speeds), min: Math.min(...speeds.filter((v) => v > 0)), over2x: speeds.filter((v) => v > 2 * mV).length, under50pct: speeds.filter((v) => v < mV / 2).length }, bigStepsAreLongFrames: bigSteps.every((x) => x[1] > 2 * mT), bigSteps: bigSteps.slice(0, 12), merged: mergedOut, widthsSeen: [...new Set(xs.map((x) => Math.round(x[2])))], running: getComputedStyle(t).animationName }); } }; requestAnimationFrame(step); }), sel);
    const lensFrame = page.frames().find((f) => /lens-v1\/.*mode=tape/.test(f.url()));
    const [fav, lens] = await Promise.all([sample2(page.mainFrame(), '#tapes .tape[data-tape="FAVORITES"] .track'), lensFrame ? sample2(lensFrame, ".track.run") : Promise.resolve(null)]);
    const lensState = lensFrame ? await lensFrame.evaluate(() => ({ setKey: window.__tape.setKey(), tracks: window.__tape.tracks() })).catch(() => null) : null;
    const longTasks = await page.evaluate(() => window.__long).catch(() => null);
    out.tapes2 = { favorites: fav, lens, lensState, longTasks, errors: errs };
    log("long tasks", JSON.stringify(longTasks).slice(0, 1500));
    log("tapes2", "favorites", JSON.stringify(fav), "lens", JSON.stringify(lens), "lensState", JSON.stringify(lensState));
    await page.screenshot({ path: path.join(SHOTS, "w10-tape-lens-macro.png"), clip: await page.evaluate(() => { const r = document.querySelector("#tapes .tape[data-tape=\"LENS\"], #lensTape, iframe[src*=\"mode=tape\"]"); if (!r) return { x: 0, y: 0, width: 1400, height: 66 }; const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }) }).catch(() => {});
    await context.close();
  }
  if (ONLY === "all" || ONLY === "tapes") {
    /* 4. the tapes' motion: the FAVORITES track and a lens track, their transform sampled every animation frame for 30 s on the 2560 wall */
    const { context, page, errs } = await open(browser, 2560, 1440, 1, { youtube: false });
    await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(14000);
    const sampleTrack = (frame, sel) => frame.evaluate((sel) => new Promise((resolve) => { const t = document.querySelector(sel); if (!t) return resolve(null); const xs = []; const start = performance.now(); let n = 0;
      const step = () => { const m = new DOMMatrixReadOnly(getComputedStyle(t).transform); xs.push([performance.now() - start, -m.m41, t.getBoundingClientRect().width]); if (performance.now() - start < 30000) requestAnimationFrame(step); else { const steps = []; for (let i = 1; i < xs.length; i++) { let d = xs[i][1] - xs[i - 1][1]; if (d < -xs[i][2] / 4) d += xs[i][2] / 2; steps.push(+d.toFixed(2)); } const sorted = steps.slice().sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)]; const widths = new Set(xs.map((x) => Math.round(x[2]))); resolve({ frames: xs.length, median: med, max: Math.max(...steps), min: Math.min(...steps), over2x: steps.filter((s) => s > 2 * med + 0.05).length, negative: steps.filter((s) => s < -0.05).length, widthsSeen: [...widths], running: getComputedStyle(t).animationName }); } }; requestAnimationFrame(step); }), sel);
    const lensFrame = page.frames().find((f) => /lens-v1\/.*mode=tape/.test(f.url()));
    const [fav, lens] = await Promise.all([sampleTrack(page.mainFrame(), '#tapes .tape[data-tape="FAVORITES"] .track'), lensFrame ? sampleTrack(lensFrame, ".track.run") : Promise.resolve(null)]);
    const lensState = lensFrame ? await lensFrame.evaluate(() => ({ setKey: window.__tape.setKey(), tracks: window.__tape.tracks() })).catch(() => null) : null;
    out.tapes = { favorites: fav, lens, lensState, errors: errs };
    log("tapes", "favorites", JSON.stringify(fav), "lens", JSON.stringify(lens));
    await context.close();
  }
  if (ONLY === "all" || ONLY === "volume") {
    /* 5. the volume panel at the 2560 column's size: the recorded in-session heartbeat (22 Oct 18:01 ET, after hours with size and flow), then live */
    for (const [label, recorded] of [["recorded", true], ["live", false]]) {
      const { context, page, errs } = await open(browser, 435, 460, 1, { youtube: false, recorded });
      await page.goto(origin + "/station-shells/volume-v1/?shell=v1", { waitUntil: "domcontentloaded" }); await sleep(7000);
      const r = await page.evaluate(() => ({ num: document.getElementById("num").textContent, state: document.getElementById("state").textContent, buy: document.getElementById("buy").textContent, sell: document.getElementById("sell").textContent, tsize: document.getElementById("tsize").innerText, sizeAt: document.getElementById("sizeAt").textContent, block: document.getElementById("block").innerText, day: document.getElementById("dayX").innerText, badges: [...document.querySelectorAll(".badge")].map((b) => b.className.replace("badge", "").trim() + ":" + b.textContent.trim()), mmss: document.getElementById("mmss").textContent, graph: { polyline: !!document.querySelector("#chart polyline"), circles: document.querySelectorAll("#chart circle").length, beat: !!document.querySelector("#chart .beat-core"), labels: [...document.querySelectorAll("#chart text")].map((t) => t.textContent) }, descriptions: /of a usual|who is in control|does it sustain/.test(document.body.innerText) }));
      await page.screenshot({ path: path.join(SHOTS, `w10-volume-${label}.png`) });
      out["volume_" + label] = { reading: r, errors: errs }; await context.close();
      log("volume", label, JSON.stringify(r).slice(0, 500));
    }
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(MEASURE, `w10-${ONLY}.json`), JSON.stringify(out, null, 1)); log("wrote", ONLY);
