// W4 (22 Oct 2026): are the lenses 5-minute and live? The lens tape alone (MINE and MACRO), polled every second across two 5-minute closes:
// for each name, the moment its newest bar advanced to the bar that just closed (seconds after the close), and the live price moving between.
//   node live.mjs <root> [minutes]  -> ../measure/w4-live.json, ../shots/w4-lenstape-{mine,macro}.png
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(process.argv[2]); const MIN = +(process.argv[3] || 11);
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);
const ET = (ms) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(ms));
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1945, height: 120 }, deviceScaleFactor: 1, timezoneId: "America/New_York" });
const net = { refused: [], candles: 0, quotes: 0 };
await context.route("**/*", async (route) => {
  const req = route.request(), url = req.url(), host = new URL(url).host;
  if (host.startsWith("127.0.0.1")) return route.fallback();
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { net.refused.push(req.method() + " " + host); return route.abort(); }
  if (host === "scintilla-massive-chart-api.fly.dev") { if (/\/candles/.test(url)) net.candles++; if (/\/quotes/.test(url)) net.quotes++;
    try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text(); return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); } }
  return route.fallback();
});
const pages = {};
for (const list of ["mine", "macro"]) {
  const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  await page.goto(origin + "/station-shells/lens-v1/?shell=v1&mode=tape&list=" + list, { waitUntil: "domcontentloaded" });
  pages[list] = { page, errs, seen: {}, arrivals: [], priceMoves: 0, samples: 0, lastQuotes: null };
}
await sleep(8000);
for (const list of Object.keys(pages)) { await pages[list].page.screenshot({ path: path.join(SHOTS, `w4-lenstape-${list}.png`) }); }
const start = Date.now();
while (Date.now() - start < MIN * 60000) {
  for (const list of Object.keys(pages)) {
    const P = pages[list];
    const r = await P.page.evaluate(() => ({ newest: window.__lens.newest(), quotes: window.__lens.quotes(), at: window.__lens.at(), list: window.__lens.list(), tf: window.__lens.tf, bars: window.__lens.bars })).catch(() => null);
    if (!r) continue; P.samples++;
    const now = Date.now();
    for (const [t, newest] of Object.entries(r.newest)) {
      if (newest == null) continue;
      if (P.seen[t] == null) { P.seen[t] = newest; continue; }
      if (newest > P.seen[t]) { const close = newest + 5 * 60000; P.arrivals.push({ t, bar: ET(newest), closedAt: ET(close), seenAt: ET(now), secondsAfterClose: +((now - close) / 1000).toFixed(1) }); P.seen[t] = newest; log(list, t, "bar", ET(newest), "closed", ET(close), "on screen", ET(now), "+" + ((now - close) / 1000).toFixed(1) + "s"); }
    }
    if (P.lastQuotes) for (const [t, p] of Object.entries(r.quotes)) if (P.lastQuotes[t] != null && p !== P.lastQuotes[t]) P.priceMoves++;
    P.lastQuotes = r.quotes; P.tf = r.tf; P.barsN = r.bars; P.listNow = r.list;
  }
  await sleep(1000);
}
const out = { at: new Date().toISOString(), minutes: MIN, startedEt: ET(start), endedEt: ET(Date.now()), network: { candles: net.candles, quotes: net.quotes, refused: [...new Set(net.refused)] }, lists: {} };
for (const list of Object.keys(pages)) { const P = pages[list]; out.lists[list] = { list: P.listNow, tf: P.tf, bars: P.barsN, names: Object.keys(P.seen), arrivals: P.arrivals, priceMoves: P.priceMoves, samples: P.samples, errors: P.errs }; await P.page.screenshot({ path: path.join(SHOTS, `w4-lenstape-${list}-end.png`) }); }
await browser.close(); server.close();
fs.writeFileSync(path.join(MEASURE, "w4-live.json"), JSON.stringify(out, null, 1));
log("wrote", JSON.stringify(Object.fromEntries(Object.entries(out.lists).map(([k, v]) => [k, { arrivals: v.arrivals.length, moves: v.priceMoves, errs: v.errors.length }]))));
