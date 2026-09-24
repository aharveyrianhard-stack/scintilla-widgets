/* Does the pane actually say what a bar is? Real Chromium, headless, over the served repo,
   with the REAL measured SPY 3-hour bars the live chart API returned on 2026-09-24 at 13:25 ET
   and the independent 13:27 price as the live quote. Shot at 1680 and at 390. */
import fs from "node:fs";
import path from "node:path";
import { launch } from "../rig.mjs";

const EV = process.env.EV, OUT = process.env.OUT, TAG = process.env.TAG || "after";
const spy = JSON.parse(fs.readFileSync(path.join(EV, "spy-180.json"), "utf8"));
/* The real provider universe, read once from the public /universe route: ownership fails closed
   against the canonical 364-symbol digest, so a made-up universe would leave the pane empty. */
const universe = JSON.parse(fs.readFileSync(path.join(EV, "universe.json"), "utf8"));
const facts = JSON.parse(fs.readFileSync(path.join(EV, "facts.json"), "utf8"));
const { context, origin, close } = await launch();
const page = await context.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));

await page.route("**/universe**", (r) => {
  const u = new URL(r.request().url());
  if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(universe) });
});
await page.route("**/candles**", (r) => {
  const u = new URL(r.request().url());
  if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
  const tf = u.searchParams.get("tf");
  const lim = Math.min(400, Number(u.searchParams.get("limit") || 200));
  const series = (tf === "180" ? spy.series : spy.series).slice(-lim);
  return r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ ...spy, tf, series }) });
});
await page.route("**/quotes**", (r) => {
  const u = new URL(r.request().url());
  if (u.host !== "scintilla-massive-chart-api.fly.dev") return r.fallback();
  const quotes = {};
  for (const sym of (u.searchParams.get("symbols") || "").split(",").filter(Boolean))
    quotes[sym] = { state: "OK", price: facts.SPY.now_px, previous_close: 767.81,
      price_observation_utc: "2026-09-24T17:27:00.000Z" };
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ quotes }) });
});

const read = async () => page.evaluate(() => {
  const el = document.querySelector(".sc-nchart__live-window");
  const cv = document.querySelector("#chartSlot .sc-nchart__cv");
  return { text: el ? el.textContent : null, title: el ? el.title : null,
    canvas: cv ? { w: cv.width, h: cv.height } : null };
});

const shots = [];
for (const [w, h, name] of [[1680, 1000, "1680"], [390, 780, "390"]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(origin + "/chart/?t=SPY&range=3h" + (process.env.QUERY || ""), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#chartSlot .sc-nchart__cv", { timeout: 20000 });
  await page.waitForTimeout(5000);
  const file = path.join(OUT, `${TAG}-spy-3h-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push({ viewport: `${w}x${h}`, file: path.basename(file), ...(await read()) });
}
console.log(JSON.stringify({ tag: TAG, pageerrors: errs, shots }, null, 1));
await close();
