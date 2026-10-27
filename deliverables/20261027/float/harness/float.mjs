// 27 Oct 2026: "it should just play from where I was ... Just go." The float measured in a hidden browser.
//   node float.mjs <root> [chrome executable] [video id] [top|deck]
//   top: the pane on its own page; deck: the pane inside the real deck (the Station as Alan has it), floated by the
//   button on the pane's bar - the window then belongs to the deck, the top level
// Google Chrome headless (the full browser: Document Picture-in-Picture), a throwaway profile with no history, so the
// browser holds a new window's sound exactly as it does on a Mac whose Brave has no media-engagement exception for the
// Station. The pane is served from <root> on 127.0.0.1; every non-GET request is aborted except YouTube's own player
// calls, so nothing is written anywhere (the shared resume positions included). Output: ../measure/float-measure.json
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] || path.resolve(HERE, "../../../.."));
const CHROME = process.argv[3] || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIDEO = process.argv[4] || "HiX5dZCDHUA";
const WHERE = process.argv[5] || "top";
const ETFS = ["SPY", "QQQ", "DIA", "IWM", "XLK", "XLF", "XLE", "SMH", "TLT"];
const WALL = "/deck/?scene=live&charts=9&range=3D&" + ETFS.map((t, i) => "c" + (i + 1) + "=" + t).join("&");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);
async function until(fn, ms = 20000, step = 250) { const end = Date.now() + ms; let v; while (Date.now() < end) { try { v = await fn(); if (v) return v; } catch (_) {} await sleep(step); } return v; }

function read() {
  let pane = null, float = null, page = null;
  try { if (YT_PLAYER_READY) pane = { state: YT_PLAYER.getPlayerState(), at: Math.round(YT_PLAYER.getCurrentTime() * 10) / 10, muted: YT_PLAYER.isMuted(), id: String(YT_PLAYER.getVideoData().video_id || "") }; } catch (e) { pane = { err: String(e).slice(0, 80) }; }
  if (typeof FLOAT !== "undefined" && FLOAT) {
    float = { sound: FLOAT.sound, id: FLOAT.id };
    try { const F = FLOAT.frame.contentWindow.SC_FLOAT; page = Object.assign(F.state(), { muted: F.muted(), hasSound: F.sound(), at: Math.round(F.at() * 10) / 10 }); } catch (e) { page = { err: String(e).slice(0, 80) }; }
  }
  return { pane, float, page, hold: !document.getElementById("floatHold").hidden, note: !document.getElementById("floatNote").hidden };
}
async function series(pane, ms, every = 500) { const out = []; const end = Date.now() + ms; while (Date.now() < end) { out.push(Object.assign({ t: Date.now() - t0 }, await pane.evaluate(read))); await sleep(every); } return out; }

const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const out = { root: ROOT, video: VIDEO, browser: browser.version(), at: new Date().toISOString() };
log("browser", out.browser);
const context = await browser.newContext({ viewport: { width: 1062, height: 685 }, deviceScaleFactor: 1 });
const refused = [];
await context.route("**/*", async (route) => {
  const req = route.request(), url = req.url(), host = new URL(url).host;
  if (host.startsWith("127.0.0.1")) return route.fallback();
  const ytPlayer = /(^|\.)(youtube\.com|googlevideo\.com|ytimg\.com|google\.com|gstatic\.com|doubleclick\.net)$/.test(host);
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method()) && !ytPlayer) { refused.push(req.method() + " " + host + new URL(url).pathname); return route.abort(); }
  if (host === "scintilla-massive-chart-api.fly.dev") {
    try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
      return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
  }
  return route.fallback();
});
await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.setItem("station.video.mode.scintilla", "grid"); } catch (_) {} });
const page = await context.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
out.where = WHERE;
let pane;
if (WHERE === "deck") {
  await page.goto(origin + WALL, { waitUntil: "domcontentloaded" });
  pane = await until(() => page.frames().find((f) => f.url().includes("/station-shells/scintilla-video-v1") && f.url().includes("feed=scintilla")), 30000);
} else {
  await page.goto(origin + "/station-shells/scintilla-video-v1/?feed=scintilla&cols=2&mode=grid", { waitUntil: "domcontentloaded" });
  pane = page.mainFrame();
}
await until(() => pane.evaluate(() => document.querySelectorAll("#grid .card").length >= 4), 40000);
out.canFloat = await pane.evaluate(() => typeof canFloat === "function" && canFloat());
/* 1 - play the video, as a click (the pane gets the gesture it needs for sound) */
const card = pane.locator(`#grid .card[data-v="${VIDEO}"]`);
if (await card.count()) await card.first().click(); else await pane.locator("#grid .card").first().click();
await until(() => pane.evaluate(() => typeof YT_PLAYER_READY !== "undefined" && YT_PLAYER_READY && YT_PLAYER.getPlayerState() === 1), 30000);
await sleep(6000);
out.before = await pane.evaluate(read); log("playing", JSON.stringify(out.before.pane));
/* 2 - float it (the bar's button, a real click) and watch 8 s without touching the window */
await pane.locator("#bPipBar").click();
await until(() => pane.evaluate(() => !!FLOAT), 8000);
out.floating = await series(pane, 8000);
const last = out.floating[out.floating.length - 1];
log("floating", JSON.stringify(last));
/* 3 - one click in the window (real input, inside it) */
const pip = await until(() => { const ps = context.pages(); return ps.length > 1 ? ps[ps.length - 1] : null; }, 5000);
out.pipPage = !!pip;
if (pip) { const vp = await pip.evaluate(() => ({ w: innerWidth, h: innerHeight })); await pip.mouse.click(Math.round(vp.w / 2), Math.round(vp.h / 2)); }
out.afterClick = await series(pane, 6000);
log("after click", JSON.stringify(out.afterClick[out.afterClick.length - 1]));
/* 4 - close the window: the pane goes on from the window's second */
await page.evaluate(() => documentPictureInPicture.window && documentPictureInPicture.window.close());
out.closed = await series(pane, 5000);
log("closed", JSON.stringify(out.closed[out.closed.length - 1]));
/* 5 - float again and close it WITHOUT touching it: the pane never stopped, nothing reloads */
await sleep(2000);
await pane.locator("#bPipBar").click();
await until(() => pane.evaluate(() => !!FLOAT), 8000);
out.floating2 = await series(pane, 5000);
await page.evaluate(() => documentPictureInPicture.window && documentPictureInPicture.window.close());
out.closed2 = await series(pane, 3000);
log("closed untouched", JSON.stringify(out.closed2[out.closed2.length - 1]));
out.refused = [...new Set(refused)].slice(0, 30); out.refusedCount = refused.length; out.errors = errs;
await browser.close(); server.close();
const file = path.resolve(HERE, "../measure/float-" + WHERE + "-" + out.browser.split(".")[0] + ".json");
fs.writeFileSync(file, JSON.stringify(out, null, 1));
log("wrote", file);
process.exit(0);
