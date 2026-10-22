// W1C (22 Oct 2026): the wall after Alan's changes, measured in a hidden browser at 2560 x 1440 and 1280 x 800, idle and with a video
// playing; the lens tape alone on RADAR and MACRO; the volume column alone. Same rig as W1/W1B; YouTube's player allowed for the
// playing pictures; every non-GET refused. Output: ../shots/w1c-*.png, ../measure/w1c-measure.json
//   node w1c.mjs <root>
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(process.argv[2]);
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
const SCREENS = [["2560x1440", 2560, 1440, 1], ["1280x800", 1280, 800, 2]];
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
    for (const k of ["station.widgets", "station.widgets.arrangement", "station.simple", "station.lenses.list", "station.lenses.mine"]) localStorage.removeItem(k);
    localStorage.setItem("station.simple.chart.1", "SPY"); localStorage.setItem("station.simple.chart.2", "QQQ"); } catch (_) {} });
  const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, net };
}
const fit169 = (w, h) => { const pw = Math.min(w, Math.floor(h * 16 / 9)); return { w: pw, h: Math.round(pw * 9 / 16) }; };
function readDeck() {
  const R = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return getComputedStyle(n).display === "none" || !r.width ? null : { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const video = document.querySelector('.pane[data-key="' + VIDEO_FEED + '"]'), x = document.querySelector('.pane[data-key="x"]');
  const charts = [...document.querySelectorAll("#rowTop > .pane")].filter((p) => !p.classList.contains("slot-off") && !p.classList.contains("chart-off") && R(p)).map((p) => ({ key: p.dataset.key, box: R(p) }));
  const A = innerWidth * innerHeight, sh = (b) => b ? +(b.w * b.h / A * 100).toFixed(1) : null;
  const cell = document.querySelector("#tapes .tape .cell");
  const o = { win: { w: innerWidth, h: innerHeight }, body: document.body.className, widgetsOn: typeof widgetsOn === "function" ? widgetsOn() : null, playing: typeof widgetsPlaying === "function" ? widgetsPlaying() : null,
    slot: WIDGETS_NOW && WIDGETS_NOW.slot ? { picture: WIDGETS_NOW.slot.picture, chartsH: WIDGETS_NOW.slot.chartsH, bandH: WIDGETS_NOW.slot.bandH, lensTapeH: WIDGETS_NOW.slot.lensTapeH, rowBelow: WIDGETS_NOW.slot.rowBelow, playing: !!WIDGETS_NOW.slot.playing } : null,
    x: R(x), charts, video: R(video), volume: R(document.getElementById("wgVolume")), lensTape: R(document.getElementById("wgLensTape")), tapes: R(document.getElementById("tapes")), cell: R(cell), cellText: cell ? cell.innerText.replace(/\n/g, " | ") : null,
    tapeRows: document.querySelectorAll("#tapes .tape").length, dock: { arr: !!document.getElementById("widgetsArrBtn"), widgets: (document.getElementById("widgetsBtn") || {}).className } };
  o.shares = { x: sh(o.x), chart1: sh(o.charts[0] && o.charts[0].box), chart2: sh(o.charts[1] && o.charts[1].box), lensTape: sh(o.lensTape), video: sh(o.video), volume: sh(o.volume), tapes: sh(o.tapes) };
  return o;
}
const out = { at: new Date().toISOString(), root: ROOT, walls: [], lensTape: {}, volume: null };
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  for (const [key, W, H, dpr] of SCREENS) {
    const { context, page, errs, net } = await open(browser, W, H, dpr);
    await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(14000);
    const idle = await page.evaluate(readDeck);
    await page.screenshot({ path: path.join(SHOTS, `w1c-idle-${key}.png`) });
    if (idle.tapes) await page.screenshot({ path: path.join(SHOTS, `w1c-tape-${key}.png`), clip: { x: idle.tapes.x, y: idle.tapes.y, width: Math.min(idle.tapes.w, 1400), height: idle.tapes.h } });
    if (idle.lensTape) await page.screenshot({ path: path.join(SHOTS, `w1c-lenstape-${key}.png`), clip: { x: idle.lensTape.x, y: idle.lensTape.y, width: Math.min(idle.lensTape.w, 1500), height: idle.lensTape.h } });
    if (idle.volume) await page.screenshot({ path: path.join(SHOTS, `w1c-volume-${key}.png`), clip: { x: idle.volume.x, y: idle.volume.y, width: idle.volume.w, height: idle.volume.h } });
    const frame = page.frames().find((f) => /station-shells\/(scintilla|personal)-video-v1/.test(f.url()));
    let play = null;
    if (frame) {
      const picked = await frame.evaluate(() => { const cards = [...document.querySelectorAll("#grid .card")]; const c = cards.find((k) => !/LIVE|live in|premier/i.test(k.innerText)) || cards[0]; if (!c) return null; c.scrollIntoView(); return c.dataset.v; }).catch(() => null);
      if (picked) { await frame.click('#grid .card[data-v="' + picked + '"]').catch(() => {}); await sleep(7000); }
      play = await frame.evaluate(() => { const R = (n) => { const b = n.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; }; return { playing: document.body.classList.contains("playing"), video: R(document.getElementById("video")), grid: R(document.getElementById("grid")) }; }).catch(() => null);
      if (play && play.video) play.picture = fit169(play.video.w, play.video.h);
    }
    const playingDeck = await page.evaluate(readDeck);
    await page.screenshot({ path: path.join(SHOTS, `w1c-playing-${key}.png`) });
    out.walls.push({ screen: key, dpr, idle, play, playing: playingDeck, errors: errs, refused: [...new Set(net.refused)] });
    log(key, "idle charts", JSON.stringify(idle.charts.map((c) => [c.box.w, c.box.h])), "lensTape", JSON.stringify(idle.lensTape), "video", JSON.stringify(idle.video), "volume", JSON.stringify(idle.volume), "tapes", JSON.stringify(idle.tapes), "cell", idle.cellText, "| playing picture", JSON.stringify(play && play.picture), "lensTape", JSON.stringify(playingDeck.lensTape), "volume", JSON.stringify(playingDeck.volume), "errs", errs.length);
    await context.close();
  }
  /* the lens tape alone, RADAR and MACRO, at the 2560 wall's width and height */
  for (const list of ["radar", "macro"]) {
    const { context, page, errs } = await open(browser, 1945, 160, 1, { youtube: false });
    await page.goto(origin + "/station-shells/lens-v1/?shell=v1&mode=tape&list=" + list, { waitUntil: "domcontentloaded" }); await sleep(12000);
    const r = await page.evaluate(() => ({ list: document.body.dataset.list, tape: document.body.classList.contains("tape"), lenses: [...document.querySelectorAll('.lens:not([aria-hidden="true"])')].map((l) => ({ t: l.dataset.t, day: l.dataset.day, head: l.querySelector(".head").innerText.replace(/\n/g, " "), why: l.querySelector(".why").textContent, w: Math.round(l.getBoundingClientRect().width), h: Math.round(l.getBoundingClientRect().height) })), copies: document.querySelectorAll('.lens[aria-hidden="true"]').length, run: !!document.querySelector(".track.run"), duration: (document.querySelector(".track") || {}).style?.animationDuration || "", tf: typeof LENS_TF !== "undefined" ? LENS_TF : null }));
    await page.screenshot({ path: path.join(SHOTS, `w1c-lenstape-${list}.png`) });
    out.lensTape[list] = { reading: r, errors: errs }; await context.close();
    log("lens tape", list, r.lenses.length, "drawn", r.lenses.filter((l) => !l.why).length, "run", r.run, r.duration, "first", JSON.stringify(r.lenses[0]));
  }
  /* the volume column alone at the 2560 wall's column size */
  { const { context, page, errs } = await open(browser, 739, 576, 1, { youtube: false });
    await page.goto(origin + "/station-shells/volume-v1/?shell=v1", { waitUntil: "domcontentloaded" }); await sleep(8000);
    const r = await page.evaluate(() => ({ num: document.getElementById("num").textContent, of: document.getElementById("of").innerText.replace(/\n/g, " "), state: document.getElementById("stateText").textContent, lights: [...document.querySelectorAll("#lights .light")].map((l) => l.className.replace("light ", "") + ":" + l.textContent), facts: document.getElementById("facts").innerText.replace(/\n/g, " "), msg: document.getElementById("msg").textContent, svg: !!document.querySelector("#chart svg"), polyline: !!document.querySelector("#chart polyline"), circles: document.querySelectorAll("#chart circle").length, labels: [...document.querySelectorAll("#chart text")].map((t) => t.textContent).slice(0, 12) }));
    await page.screenshot({ path: path.join(SHOTS, `w1c-volume-alone.png`) });
    out.volume = { reading: r, errors: errs }; await context.close();
    log("volume", JSON.stringify(r).slice(0, 500)); }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(MEASURE, "w1c-measure.json"), JSON.stringify(out, null, 1)); log("wrote");
