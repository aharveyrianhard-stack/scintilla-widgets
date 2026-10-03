// S11: the modes still work in the new floor plan (headless): charts only, a chart on its own, X on its own,
// the video's two expand stages, a page change, and the phone. Geometry only; prints what each mode leaves on screen.
import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../..");
const { server, origin } = await serve(ROOT);
async function open(w, h) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 600, hasTouch: w < 600 });
  await ctx.route("**/*", (route) => { const req = route.request(), host = new URL(req.url()).host;
    if (host.startsWith("127.0.0.1")) return route.fallback(); if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
    if (host === "scintilla-massive-chart-api.fly.dev") return route.fulfill({ status: 200, contentType: "application/json", body: "{}", headers: { "access-control-allow-origin": "*" } });
    return route.fallback(); });
  await ctx.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160))); return { browser, page, errs };
}
const boxes = (page) => page.evaluate(() => { const b = (el) => { if (!el || getComputedStyle(el).display === "none") return "hidden"; const r = el.getBoundingClientRect(); return Math.round(r.x) + "," + Math.round(r.y) + " " + Math.round(r.width) + "×" + Math.round(r.height) + (getComputedStyle(el.closest("#rowBot") || el).opacity === "0" ? " (opacity 0)" : ""); };
  const top = document.getElementById("rowTop"), bot = document.getElementById("rowBot");
  const charts = [...top.querySelectorAll(":scope > .pane.chart-pane")].filter((p) => getComputedStyle(p).display !== "none");
  return { body: document.body.className, rowTop: b(top) + " [" + top.className + "]", column: b(bot), x: b(bot.querySelector('[data-key="x"]')),
    video: [...bot.querySelectorAll(':scope > .pane:not([data-key="x"])')].map((p) => p.dataset.key + " " + b(p)).filter((s) => !/hidden/.test(s)).join(" | "),
    charts: charts.length + " shown, first " + b(charts[0]) + ", last " + b(charts[charts.length - 1]) }; });
const NINE = "/deck/?scene=live&charts=9&range=3D&c1=GOOGL&c2=NBIS&c3=AVGO&c4=BE&c5=AMZN&c6=VST&c7=MU&c8=WMT&c9=SPY";
{ const { browser, page, errs } = await open(1680, 1050);
  await page.goto(origin + NINE); await page.waitForTimeout(4000);
  console.log("1680 LIVE 9 · plain", JSON.stringify(await boxes(page)));
  await page.evaluate(() => document.getElementById("chartsOnlyBtn").click()); await page.waitForTimeout(600); console.log("charts only", JSON.stringify(await boxes(page)));
  await page.evaluate(() => document.getElementById("chartsOnlyBtn").click()); await page.waitForTimeout(600);
  await page.evaluate(() => setSolo("c5")); await page.waitForTimeout(600); console.log("solo chart 5", JSON.stringify(await boxes(page)));
  await page.evaluate(() => setSolo(null)); await page.evaluate(() => setSolo("x")); await page.waitForTimeout(600); console.log("solo X", JSON.stringify(await boxes(page)));
  await page.evaluate(() => setSolo(null)); await page.evaluate(() => toggleMediaStage(VIDEO_FEED)); await page.waitForTimeout(600); console.log("video stage one", JSON.stringify(await boxes(page)));
  await page.evaluate(() => coverMediaX(VIDEO_FEED)); await page.waitForTimeout(600); console.log("video stage two", JSON.stringify(await boxes(page)));
  await page.evaluate(() => resetMediaStage()); await page.waitForTimeout(600); console.log("back to plain", JSON.stringify(await boxes(page)));
  console.log("errors", errs); await browser.close(); }
{ const { browser, page, errs } = await open(1680, 1050);
  await page.goto(origin + "/deck/?scene=targets3D"); await page.waitForTimeout(4000);
  console.log("TARGETS (8)", JSON.stringify(await boxes(page)));
  await page.evaluate(() => document.getElementById("screenNext").click()); await page.waitForTimeout(6000);
  console.log("next page →", await page.evaluate(() => SCENE), JSON.stringify(await boxes(page)));
  console.log("errors", errs); await browser.close(); }
{ const { browser, page, errs } = await open(390, 844);
  await page.goto(origin + "/deck/?scene=otherIndexes1D"); await page.waitForTimeout(4000);
  console.log("phone 390", JSON.stringify(await boxes(page))); console.log("errors", errs); await browser.close(); }
server.close(); process.exit(0);
