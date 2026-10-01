// Headless only (Chrome for Testing, --headless=new: no window on screen). node pip.mjs <root> <out-prefix> [--w=1680]
// Plays the first video in the Station's video pane, lets it run, presses the pane's float button, and reads
// back what opened: the Document Picture-in-Picture window, its player URL (the start second), the pane's
// words. Screenshots the Station and, when the browser exposes it as a page, the floating window.
import fs from "node:fs";
import { serve, chromium } from "./rig.mjs";
const [root, out, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const W = +(opt.w || 1680), MOBILE = W < 600;
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const { server, origin } = await serve(root);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--headless=new", "--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: W, height: MOBILE ? 844 : 1050 }, deviceScaleFactor: 2, isMobile: MOBILE, hasTouch: MOBILE });
/* --nopip: a browser without Document Picture-in-Picture (Safari, Firefox) - the fallback window */
if (opt.nopip) await context.addInitScript(() => { try { delete window.documentPictureInPicture; Object.defineProperty(window, "documentPictureInPicture", { value: undefined }); } catch (_) {} });
await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.chartsOnly", "0"); } catch (_) {} });
await context.route("**/*", async (route) => {
  const req = route.request(), host = new URL(req.url()).host;
  if (host === "scintilla-massive-chart-api.fly.dev") {
    try { const r = await fetch(req.url(), { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); return route.fulfill({ status: r.status, contentType: "application/json", body: await r.text(), headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
  }
  return route.fallback();
});
const R = { w: W, browser: browser.version() };
try {
  const page = await context.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  await page.goto(origin + "/deck/?scene=targets3D");
  await page.waitForTimeout(12000);
  R.api = await page.evaluate(() => ({ documentPictureInPicture: "documentPictureInPicture" in window }));
  /* on a phone the deck is one column and the video pane is mounted when it scrolls into view */
  if (MOBILE) {
    await page.evaluate(() => { const n = document.querySelector("#rowBot"); if (n) n.scrollIntoView({ block: "start" }); });
    await page.waitForTimeout(6000);
  }
  let vf = null;
  for (let k = 0; k < 20 && !vf; k++) {
    vf = page.frames().find((f) => /personal-video-v1|scintilla-video-v1/.test(f.url()) && f.parentFrame() === page.mainFrame());
    if (!vf) await page.waitForTimeout(1000);
  }
  if (!vf) throw new Error("no video pane");
  await vf.waitForSelector(".card[data-v]", { timeout: 20000 });
  const card = await vf.$(".card[data-v]");
  R.video = await card.getAttribute("data-v");
  if (MOBILE) await card.tap(); else await card.click();
  await page.waitForTimeout(9000);   /* let it play a few seconds */
  R.pane = await vf.evaluate(() => { try { captureActiveVideoPosition(); } catch (_) {} return { playing: document.body.classList.contains("playing"), at: PLAYER_POSITION.time, ready: YT_PLAYER_READY, barButton: getComputedStyle(document.getElementById("bPipBar")).display }; });
  await page.screenshot({ path: out + "-station-before.png" });
  const popup = context.waitForEvent("page", { timeout: 6000 }).catch(() => null);
  if (MOBILE) await vf.tap("#bPipBar"); else await vf.click("#bPipBar");
  await page.waitForTimeout(2500);
  R.deck = await page.evaluate(() => {
    const w = window.documentPictureInPicture && documentPictureInPicture.window;
    if (!w) return { pipWindow: false };
    const f = w.document.querySelector("iframe");
    return { pipWindow: true, size: [w.innerWidth, w.innerHeight], title: w.document.title, src: f && f.src };
  });
  R.paneAfter = await vf.evaluate(() => ({ path: document.body.dataset.pip, note: document.getElementById("pipNote").textContent,
    state: (() => { try { return YT_PLAYER.getPlayerState(); } catch (_) { return null; } })() }));
  if (R.deck.src) R.deck.start = +new URL(R.deck.src).searchParams.get("start");
  await page.screenshot({ path: out + "-station-after.png" });
  const pip = await popup;
  R.pipAsPage = !!pip;
  if (pip) R.pipUrl = pip.url();
  if (pip) { await pip.waitForTimeout(3000); try { await pip.screenshot({ path: out + "-pipwindow.png" }); R.pipShot = true; } catch (e) { R.pipShot = String(e.message).slice(0, 160); } }
  R.errs = errs;
} finally { await browser.close(); server.close(); }
fs.writeFileSync(out + ".json", JSON.stringify(R, null, 1));
console.log(JSON.stringify(R));
