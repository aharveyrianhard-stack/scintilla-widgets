// W2 (22 Oct 2026): the failed-load path, headless. The first 600-bar history read answers 503 (the route, not the API); live-v1 must
// show the failure in words, then read the WHOLE history again ~15 s later (never a 24-bar tail). GET only; nothing is written.
//   node failpath.mjs <checkout>   -> stdout JSON (saved as ../measure/w2-failpath.json)
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const root = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { server, origin } = await serve(root);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
let failed = 0; const seen = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1074, height: 756 } });
  await ctx.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (req.method() !== "GET") return route.abort();
    if (host !== "scintilla-massive-chart-api.fly.dev") return route.abort();
    const path = url.replace(/^https:\/\/[^/]+/, "");
    seen.push({ at: Date.now(), path });
    if (/\/candles\?symbol=SPY&tf=5m&authority=provider&limit=600/.test(path) && failed === 0) { failed++; return route.fulfill({ status: 503, contentType: "application/json", body: "{}", headers: { "access-control-allow-origin": "*" } }); }
    const r = await fetch(url, { headers: { origin: "https://scintillahub.ai" } });
    return route.fulfill({ status: r.status, contentType: "application/json", body: await r.text(), headers: { "access-control-allow-origin": "*" } });
  });
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e)));
  const t0 = Date.now();
  await page.goto(origin + "/station-shells/live-v1/?symbol=SPY&tf=5m&clouds=0", { waitUntil: "domcontentloaded" });
  await sleep(3000);
  const a = await page.evaluate(() => { const s = window.SC_LIVE.snapshot(); return { bars: s.bars.length, error: s.error, next: s.nextRead, msg: document.getElementById("msg").textContent, hidden: document.getElementById("msg").hidden }; });
  await sleep(17000);
  const b = await page.evaluate(() => { const s = window.SC_LIVE.snapshot(); return { bars: s.bars.length, error: s.error, msgHidden: document.getElementById("msg").hidden, log: s.log.map((r) => r.kind + ":" + r.ok + (r.n ? "(" + r.n + ")" : "")) }; });
  console.log(JSON.stringify({ afterFailure: a, after20s: b, historyReads: seen.filter((x) => /limit=600/.test(x.path)).map((x) => ((x.at - t0) / 1000).toFixed(1) + "s"), errs }, null, 1));
} finally { await browser.close(); server.close(); }
