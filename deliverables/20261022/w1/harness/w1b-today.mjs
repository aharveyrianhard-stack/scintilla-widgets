// W1B (22 Oct 2026): how big is the playing video today? Measured headless on @a4fae52's deck at 2560 x 1440 and 1280 x 800:
// the WALL as it boots on a fresh machine, the WALL with nine charts, and SIMPLE; a recorded video played in each; the
// shell's #stage (the picture box) read inside the frame and the 16:9 picture inside it computed. YouTube's player allowed.
//   node w1b-today.mjs <root-of-a4fae52> [label]     -> ../measure/w1b-today.json, ../shots/w1b-today-*.png
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2]), LABEL = process.argv[3] || "today";
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
const SCREENS = [["2560x1440", 2560, 1440, 1], ["1280x800", 1280, 800, 2]];
const ETFS = ["SPY", "QQQ", "DIA", "IWM", "XLK", "XLF", "XLE", "SMH", "TLT"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);
const CASES = (label) => label === "today"
  ? [["wall-default", "/deck/?scene=live", { simple: "0", widgets: "0" }], ["wall-9", "/deck/?scene=live&charts=9&range=3h&" + ETFS.map((t, i) => "c" + (i + 1) + "=" + t).join("&"), { simple: "0", widgets: "0" }], ["simple", "/deck/?scene=live&charts=9&range=3h", { simple: "1", widgets: "0" }]]
  : [["widgets-a", "/deck/?scene=live&charts=9&range=3h", { widgets: "1", arrangement: "a" }], ["widgets-b", "/deck/?scene=live&charts=9&range=3h", { widgets: "1", arrangement: "b" }]];
async function open(browser, w, h, dpr, store) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, screen: { width: w, height: h }, timezoneId: "America/New_York" });
  const net = { refused: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { net.refused.push(req.method() + " " + host); return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") { try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text(); return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); } }
    return route.fallback();
  });
  await context.addInitScript((store) => { if (window.top !== window) return; try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.removeItem("station.chartsOnly");
    for (const k of ["station.widgets", "station.widgets.arrangement", "station.simple", "station.simple.split"]) localStorage.removeItem(k);
    if (store.simple != null) localStorage.setItem("station.simple", store.simple); if (store.widgets != null) localStorage.setItem("station.widgets", store.widgets); if (store.arrangement) localStorage.setItem("station.widgets.arrangement", store.arrangement);
    localStorage.setItem("station.simple.chart.1", "SPY"); localStorage.setItem("station.simple.chart.2", "QQQ"); } catch (_) {} }, store);
  const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, net };
}
const fit169 = (w, h) => { const pw = Math.min(w, Math.floor(h * 16 / 9)); return { w: pw, h: Math.round(pw * 9 / 16) }; };
function readDeck() {
  const R = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return getComputedStyle(n).display === "none" || !r.width ? null : { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const video = document.querySelector('.pane[data-key="' + VIDEO_FEED + '"]'), x = document.querySelector('.pane[data-key="x"]');
  const charts = [...document.querySelectorAll("#rowTop > .pane")].filter((p) => !p.classList.contains("slot-off") && !p.classList.contains("chart-off") && R(p)).map((p) => ({ key: p.dataset.key, box: R(p) }));
  return { win: { w: innerWidth, h: innerHeight }, body: document.body.className, count: CHART_COUNT, simpleOn: typeof simpleOn === "function" ? simpleOn() : null, widgetsOn: typeof widgetsOn === "function" ? widgetsOn() : null,
    slot: SLOT_NOW && SLOT_NOW.slot ? { block: SLOT_NOW.slot.block, box: SLOT_NOW.slot.box, picture: SLOT_NOW.slot.picture, simple: !!SLOT_NOW.slot.simple, widgets: !!SLOT_NOW.slot.widgets } : null,
    col: document.getElementById("grid").style.getPropertyValue("--fp-col"), video: R(video), x: R(x), charts, tapes: R(document.getElementById("tapes")), meter: R(document.getElementById("wgMeter")), lenses: R(document.getElementById("wgLenses")) };
}
const out = { at: new Date().toISOString(), root: ROOT, label: LABEL, runs: [] };
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  for (const [key, W, H, dpr] of SCREENS) for (const [name, url, store] of CASES(LABEL)) {
    const { context, page, errs, net } = await open(browser, W, H, dpr, store);
    await page.goto(origin + url, { waitUntil: "domcontentloaded" }); await sleep(9000);
    const idle = await page.evaluate(readDeck);
    const frame = page.frames().find((f) => /station-shells\/(scintilla|personal)-video-v1/.test(f.url()));
    let play = null;
    if (frame) {
      const picked = await frame.evaluate(() => { const cards = [...document.querySelectorAll("#grid .card")]; const c = cards.find((k) => !/LIVE|live in|premier/i.test(k.innerText)) || cards[0]; if (!c) return null; c.scrollIntoView(); return c.dataset.v; }).catch(() => null);
      if (picked) { await frame.click('#grid .card[data-v="' + picked + '"]').catch(() => {}); await sleep(7000); }
      play = await frame.evaluate(() => { const R = (n) => { const b = n.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
        return { playing: document.body.classList.contains("playing"), beside: document.body.classList.contains("beside"), bar: R(document.getElementById("bar")), stage: R(document.getElementById("stage")), video: R(document.getElementById("video")), grid: R(document.getElementById("grid")), gridDisplay: getComputedStyle(document.getElementById("grid")).display, state: (typeof YT_PLAYER !== "undefined" && YT_PLAYER && YT_PLAYER.getPlayerState) ? YT_PLAYER.getPlayerState() : null }; }).catch((e) => ({ error: String(e) }));
      if (play && play.video) play.picture = fit169(play.video.w, play.video.h);
    }
    const after = await page.evaluate(readDeck);
    await page.screenshot({ path: path.join(SHOTS, `w1b-${LABEL}-${name}-${key}.png`) });
    out.runs.push({ screen: key, dpr, name, url, idle, play, after, errors: errs, refused: [...new Set(net.refused)] });
    log(LABEL, key, name, "count", idle.count, "pane", JSON.stringify(idle.video), "slot picture", JSON.stringify(idle.slot && idle.slot.picture), "playing", play && play.playing, "picture", JSON.stringify(play && play.picture), "x", JSON.stringify(after.x && [after.x.w, after.x.h]), "errs", errs.length);
    await context.close();
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(MEASURE, `w1b-${LABEL}.json`), JSON.stringify(out, null, 1)); log("wrote", LABEL);
