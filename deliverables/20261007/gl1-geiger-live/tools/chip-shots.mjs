// GL1 — the Station chip, before and after. Headless only; ONE pane at a time; every non-GET request is aborted.
// The Station is answered from this worktree as https://station.scintillahub.ai (CH1's harness pattern); the chart API is
// fetched by node with the scintillahub.ai origin and handed back with CORS relaxed. For the "after" shots the /geiger
// answer is given what the GL1 back end adds for the name: the live numbers the GL1 publisher code computed from real
// bars and stored minutes (live-readings.json, copied from the Hub branch's deliverable), `reading` and `price_utc`.
//   node deliverables/20261007/gl1-geiger-live/tools/chip-shots.mjs <liveReadings.json> [tickers=MU,VST,CAT]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url)), D = path.dirname(HERE), ROOT = path.resolve(D, "..", "..", "..");
const LIVE = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const TICKERS = (process.argv[3] || "tickers=MU,VST,CAT").replace(/^tickers=/, "").split(",");
const ST = "https://station.scintillahub.ai", sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png", webmanifest: "application/json" };
const out = { at: new Date().toISOString(), shots: [] };
async function one(t, width, height, on) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  let blocked = 0; const errors = [];
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { blocked++; return route.abort(); }
    if (u.host === "scintilla-massive-chart-api.fly.dev") {
      try {
        const r = await fetch(u.href, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
        let body = await r.text();
        if (on && u.pathname === "/geiger") { try { const j = JSON.parse(body);
          for (const [sym, v] of Object.entries(j.symbols || {})) { const L = LIVE.names[sym]; if (!L) continue;
            v.settled = { composite: L.settled.c, trend: L.settled.t, momentum: L.settled.m }; v.composite = L.live.c; v.trend = L.live.t; v.momentum = L.live.m;
            v.reading = L.reading; v.price_utc = new Date(Date.now() - LIVE.price_age_ms).toISOString(); }
          body = JSON.stringify(j); } catch (_) {} }
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } });
      } catch (_) { return route.abort(); }
    }
    if (u.host === "station.scintillahub.ai") {
      let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
      let f = path.join(ROOT, p);
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(f), headers: { "cache-control": "no-store" } });
      return route.fulfill({ status: 404, body: "nf" });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${ST}/chart/?t=${t}&range=1D${on ? "&gl1=1" : ""}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  let chip = null;
  try { await page.waitForSelector(".sc-nchart__live-geiger:not([hidden])", { timeout: 45000 }); await sleep(2500);
    chip = await page.evaluate(() => { const n = document.querySelector(".sc-nchart__live-geiger:not([hidden])"); if (!n) return null; const b = n.getBoundingClientRect(), h = document.querySelector(".sc-nchart").getBoundingClientRect();
      return { text: n.querySelector(".sc-gbar__v").textContent, title: n.title, thin: n.querySelectorAll(".sc-gbar--thin").length, size: n.dataset.size, gl1: n.dataset.gl1 || null,
        box: { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }, insidePane: b.left >= h.left - 1 && b.right <= h.right + 1 && b.top >= h.top - 1 }; });
  } catch (e) { errors.push("no chip: " + String(e.message).slice(0, 120)); }
  const name = `station-chip-${t}-${on ? "after" : "before"}-${width}`;
  await page.screenshot({ path: path.join(D, "shots", name + ".png") });
  if (chip) await page.screenshot({ path: path.join(D, "shots", name + "-close.png"), clip: { x: Math.max(0, chip.box.x - 260), y: Math.max(0, chip.box.y - 14), width: Math.min(width - Math.max(0, chip.box.x - 260), chip.box.w + 280), height: chip.box.h + 40 } });
  await browser.close();
  out.shots.push({ ticker: t, width, switchedOn: on, chip, nonGetStopped: blocked, pageErrors: errors });
  console.log(t, width, on ? "after" : "before", JSON.stringify(chip && { text: chip.text, thin: chip.thin, size: chip.size, inside: chip.insidePane, box: chip.box }), "errors", errors.length);
  await sleep(1500);
}
for (const t of TICKERS.slice(0, 1)) { await one(t, 1680, 1050, false); await one(t, 1680, 1050, true); }
for (const t of TICKERS) await one(t, 420, 300, true);          // the size of one pane of the 8-up wall
fs.mkdirSync(path.join(D, "data"), { recursive: true });
fs.writeFileSync(path.join(D, "data", "chip-shots.json"), JSON.stringify(out, null, 1));
