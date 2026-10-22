// Y9 (21 Oct 2026): the YouTube pane's sound, measured in a hidden Brave with a throwaway profile.
//   node audio.mjs <root> <label> [brave executable]
// Three cases, each in a fresh context (no YouTube cookies, no remembered volume):
//   A. the deck's wall, a real click on a card (the way Alan starts a video)         -> muted? volume? blocked? CONTINUE shown?
//   B. the pane alone with ?v=<id>&autoplay=1 and NO gesture (the night reload / a deep link) -> same readings
//   C. after A: one click on the pane's bar (not on the player)                       -> did the sound state change?
// Every non-GET request is aborted except YouTube's own player calls, so nothing is written anywhere.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2]), LABEL = process.argv[3] || "today";
const BRAVE = process.argv[4] || "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const MEASURE = path.resolve(HERE, "../measure"); fs.mkdirSync(MEASURE, { recursive: true });
const ETFS = ["SPY", "QQQ", "DIA", "IWM", "XLK", "XLF", "XLE", "SMH", "TLT"];
const WALL = "/deck/?scene=live&charts=9&range=3D&" + ETFS.map((t, i) => "c" + (i + 1) + "=" + t).join("&");
const PANE_PATH = "/station-shells/scintilla-video-v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);
async function open(browser, w = 1728, h = 1117) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const net = { refused: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    const ytPlayer = /(^|\.)(youtube\.com|googlevideo\.com|google\.com|googleapis\.com|ytimg\.com|gstatic\.com|doubleclick\.net|youtube-nocookie\.com)$/.test(host);   /* jnn-pa.googleapis.com: the player's own attestation POST, without which the embed never starts */
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method()) && !ytPlayer) { net.refused.push(req.method() + " " + host); return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") {
      try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
    }
    return route.fallback();
  });
  await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.removeItem("station.chartsOnly"); } catch (_) {} });
  const page = await context.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, net };
}
const paneFrame = (page) => page.frames().find((f) => f.url().includes(PANE_PATH) && f.url().includes("feed=scintilla"));
async function until(fn, ms = 20000, step = 250) { const end = Date.now() + ms; let v; while (Date.now() < end) { try { v = await fn(); if (v) return v; } catch (_) {} await sleep(step); } return v; }
function readSound() {
  const vis = (id) => { const n = document.getElementById(id); if (!n) return null; const cs = getComputedStyle(n); const r = n.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0; };
  let p = null;
  try { if (typeof YT_PLAYER_READY !== "undefined" && YT_PLAYER_READY) p = { state: YT_PLAYER.getPlayerState(), muted: YT_PLAYER.isMuted(), volume: YT_PLAYER.getVolume(), at: Math.round(YT_PLAYER.getCurrentTime() * 10) / 10, id: String(YT_PLAYER.getVideoData().video_id || "") }; } catch (e) { p = { err: String(e).slice(0, 100) }; }
  let session = null; try { session = sessionStorage.getItem("station.sound"); } catch (_) {}
  const soundNote = document.getElementById("soundNote");
  return { playing: document.body.classList.contains("playing"), autoplayBlocked: document.body.dataset.autoplayBlocked || "", continueShown: vis("bContinue"), player: p, hasGesture: typeof navigator.userActivation !== "undefined" ? { active: navigator.userActivation.isActive, been: navigator.userActivation.hasBeenActive } : null,
    soundNote: soundNote ? { shown: !soundNote.hidden && getComputedStyle(soundNote).display !== "none", text: soundNote.textContent } : null, session };
}
const { server, origin } = await serve(ROOT);
const out = { root: ROOT, label: LABEL, at: new Date().toISOString(), cases: {} };
const browser = await chromium.launch({ executablePath: BRAVE, headless: true, args: ["--no-sandbox", "--autoplay-policy=document-user-activation-required"] });
out.browser = browser.version(); log("browser", out.browser);
/* also the browser's default policy (no flag): Brave's own */
const browserDefault = await chromium.launch({ executablePath: BRAVE, headless: true, args: ["--no-sandbox"] });
for (const [who, b] of [["default-policy", browserDefault], ["gesture-required-policy", browser]]) {
  const res = {};
  try {
    /* A + C: the wall, a card click, then a click on the bar */
    const { context, page, errs, net } = await open(b);
    await page.goto(origin + WALL, { waitUntil: "domcontentloaded" });
    const pane = await until(() => paneFrame(page), 30000);
    await until(() => pane.evaluate(() => document.querySelectorAll("#grid .card").length >= 4), 40000); await sleep(1000);
    res.beforeClick = await pane.evaluate(readSound);
    /* a recorded video, not a live stream: the feed puts what is on air first, and a live embed never starts in a headless browser (no stream) */
    const vid = await pane.evaluate(() => { const c = [...document.querySelectorAll("#grid .card")].find((n) => !n.querySelector(".dur.live") && !n.querySelector(".dur.soon"))   /* not on air, not a premiere still to come: a recorded video, which can play */ || document.querySelector("#grid .card"); return c ? c.dataset.v : ""; });
    res.video = vid;
    await pane.click('#grid .card[data-v="' + vid + '"]');
    res.A_wait = await until(() => pane.evaluate(() => typeof YT_PLAYER_READY !== "undefined" && YT_PLAYER_READY && [1, 2].includes(YT_PLAYER.getPlayerState()) ? YT_PLAYER.getPlayerState() : 0), 40000, 500) ? "playing" : "never started within 40 s";
    await sleep(3000);
    res.A_cardClick = await pane.evaluate(readSound);
    await page.screenshot({ path: path.join(MEASURE, "..", "shots", `audio-${LABEL}-${who}-A.png`) });   /* what the embed shows (a bot check, a held ▶, a picture) */
    log(who, "A card click", JSON.stringify(res.A_cardClick));
    /* C: a click on the pane's bar, away from the buttons (the left of the bar) */
    const barBox = await pane.evaluate(() => { const r = document.getElementById("bar").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const fb = await page.evaluate(() => { const f = [...document.querySelectorAll("iframe")].find((x) => (x.src || "").includes("scintilla-video-v1") && (x.src || "").includes("feed=scintilla")); const r = f.getBoundingClientRect(); return { x: r.left, y: r.top }; });
    await page.mouse.click(Math.round(fb.x + barBox.x + barBox.w * 0.5), Math.round(fb.y + barBox.y + barBox.h / 2)); await sleep(1500);
    res.C_barClick = await pane.evaluate(readSound);
    /* and a click on the picture itself (goes to YouTube's own player) is not measured: it toggles play/pause there */
    log(who, "C bar click", JSON.stringify(res.C_barClick));
    res.errors = errs; res.refused = [...new Set(net.refused)];
    await context.close();
    /* B: the pane alone, autoplay=1, no gesture */
    const B = await open(b);
    await B.page.goto(origin + PANE_PATH + "/?shell=v1&feed=scintilla&cols=2&v=" + vid + "&autoplay=1", { waitUntil: "domcontentloaded" });
    res.B_wait = await until(() => B.page.evaluate(() => typeof YT_PLAYER_READY !== "undefined" && YT_PLAYER_READY && [1, 2, 5].includes(YT_PLAYER.getPlayerState()) ? YT_PLAYER.getPlayerState() : 0), 40000, 500) ? "started" : "never started within 40 s";
    await sleep(3000);
    res.B_autoplayNoGesture = Object.assign({ video: vid }, await B.page.evaluate(readSound));
    log(who, "B autoplay no gesture", JSON.stringify(res.B_autoplayNoGesture));
    /* B2: then one click on the pane's bar */
    const bb = await B.page.evaluate(() => { const r = document.getElementById("bar").getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height / 2 }; });
    await B.page.mouse.click(Math.round(bb.x), Math.round(bb.y)); await sleep(2500);
    res.B2_afterBarClick = await B.page.evaluate(readSound);
    log(who, "B2 after bar click", JSON.stringify(res.B2_afterBarClick));
    /* B3: CONTINUE, if it is shown */
    if (res.B2_afterBarClick.continueShown) { await B.page.click("#bContinue"); await sleep(4000); res.B3_afterContinue = await B.page.evaluate(readSound); log(who, "B3 after CONTINUE", JSON.stringify(res.B3_afterContinue)); }
    await B.page.screenshot({ path: path.join(MEASURE, "..", "shots", `audio-${LABEL}-${who}-B.png`) });
    res.errorsB = B.errs;
    await B.context.close();
    /* B4: a recorded video known to have started in this rig on 20 Oct (Y8: V-wWOeDaVhg), the pane alone, autoplay=1, no gesture */
    const K = await open(b);
    await K.page.goto(origin + PANE_PATH + "/?shell=v1&feed=scintilla&cols=2&v=V-wWOeDaVhg&autoplay=1", { waitUntil: "domcontentloaded" });
    res.K_wait = await until(() => K.page.evaluate(() => typeof YT_PLAYER_READY !== "undefined" && YT_PLAYER_READY && [1, 2, 5].includes(YT_PLAYER.getPlayerState()) ? YT_PLAYER.getPlayerState() : 0), 40000, 500) ? "started" : "never started within 40 s";
    await sleep(3000);
    res.K_knownVideoNoGesture = await K.page.evaluate(readSound);
    log(who, "K known video, no gesture", res.K_wait, JSON.stringify(res.K_knownVideoNoGesture.player));
    const kb = await K.page.evaluate(() => { const r = document.getElementById("bar").getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height / 2 }; });
    await K.page.mouse.click(Math.round(kb.x), Math.round(kb.y)); await sleep(2500);
    res.K2_afterBarClick = await K.page.evaluate(readSound);
    log(who, "K2 after bar click", JSON.stringify(res.K2_afterBarClick.player));
    await K.page.screenshot({ path: path.join(MEASURE, "..", "shots", `audio-${LABEL}-${who}-K.png`) });
    await K.context.close();
  } catch (e) { res.error = String(e.stack || e).slice(0, 500); log("ERR", who, e.message); }
  out.cases[who] = res;
}
await browser.close(); await browserDefault.close(); server.close();
fs.writeFileSync(path.join(MEASURE, `${LABEL}-audio.json`), JSON.stringify(out, null, 1));
log("wrote", path.join(MEASURE, `${LABEL}-audio.json`));
process.exit(0);
