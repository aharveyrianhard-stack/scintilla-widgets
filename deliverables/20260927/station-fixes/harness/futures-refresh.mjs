// Headless proof: does an already-open Station page draw new futures bars without a reload?
// The relay answers the chart API with Origin https://scintillahub.ai (read-only GETs). For ESUSD 30m it
// first serves the real series with its newest N bars held back ("before the server fix"), then the full
// real series ("the new bars arrive"). The page's clock is Sunday 21:30 ET and runs on its own; we then
// jump it 6 minutes (one pass of the pane's own timers) and read what the pane drew.
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
import { serve } from "./rig.mjs";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const [root, scene = "intraday30m", sym = "ESUSD", tf = "30", hold = "4"] = process.argv.slice(2);
const { server, origin } = await serve(root);
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const context = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
let phase = 1; const hits = { 1: 0, 2: 0 };
await context.route("**/*", async (route) => {
  const req = route.request(), url = req.url(), host = new URL(url).host;
  if (host.startsWith("127.0.0.1")) return route.fallback();
  if (req.method() !== "GET") return route.abort();
  if (host !== "scintilla-massive-chart-api.fly.dev") return route.fallback();
  const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
  let body = await r.text();
  const u = new URL(url);
  if (u.pathname === "/candles" && u.searchParams.get("symbol") === sym && u.searchParams.get("tf") === tf) {
    hits[phase]++;
    if (phase === 1) { try { const j = JSON.parse(body); j.series = j.series.slice(0, -(+hold)); body = JSON.stringify(j); } catch (_) {} }
  }
  return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } });
});
await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
await context.clock.install({ time: new Date("2026-09-28T01:30:00Z") });   // Sunday 21:30 ET
const page = await context.newPage();
await page.goto(origin + "/deck/?scene=" + scene);
await page.waitForTimeout(15000);
const read = async () => {
  for (const f of page.frames()) {
    try {
      const x = await f.evaluate((s) => { const h = document.querySelector("#chartSlot .sc-nchart");
        if (!h || h.dataset.t !== s || !h._series) return null;
        const done = h._series.filter((p) => !p.live), live = h._series.filter((p) => p.live);
        const st = h.querySelector(".sc-nchart__live-lastbar");
        return { t: h.dataset.t, bars: done.length, lastBar: done.length ? done[done.length - 1].d : null,
          livePoint: live.length ? live[0].d + " @ " + live[0].p : null, stale: st ? st.textContent : "", rsi: /rsi=/.test(location.search) ? new URLSearchParams(location.search).get("rsi") : "" }; }, sym);
      if (x) return x;
    } catch (_) {}
  }
  return null;
};
const before = await read();
phase = 2;
await context.clock.fastForward("06:00");
await page.waitForTimeout(12000);
const after = await read();
const shot = process.env.SHOT; if (shot) await page.screenshot({ path: shot });
console.log(JSON.stringify({ scene, sym, tf, hold: +hold, before, after, candleReads: hits }, null, 1));
await browser.close(); server.close();
