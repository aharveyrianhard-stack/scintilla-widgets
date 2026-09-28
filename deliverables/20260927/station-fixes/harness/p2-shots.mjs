// node p2-shots.mjs <root> <outdir> <scene> <tag> [clockISO]   headless only, 1680x1050, rotation paused
import { serve } from "./rig.mjs"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const [root, outdir, scene, tag, clock = "2026-09-28T01:30:00Z"] = process.argv.slice(2);
const { server, origin } = await serve(root);
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
await context.route("**/*", async (route) => {
  const req = route.request(), host = new URL(req.url()).host;
  if (host.startsWith("127.0.0.1")) return route.fallback();
  if (req.method() !== "GET") return route.abort();
  if (host !== "scintilla-massive-chart-api.fly.dev") return route.fallback();
  const r = await fetch(req.url(), { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
  return route.fulfill({ status: r.status, contentType: "application/json", body: await r.text(), headers: { "access-control-allow-origin": "*" } });
});
await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
if (clock !== "real") await context.clock.setFixedTime(new Date(clock));
const page = await context.newPage();
await page.goto(origin + "/deck/?scene=" + scene);
await page.waitForTimeout(+(process.env.SETTLE || 18000));
await page.screenshot({ path: `${outdir}/${tag}-1680.png` });
const info = [];
for (const f of page.frames()) {
  try { const x = await f.evaluate(() => { const h = document.querySelector("#chartSlot .sc-nchart"); if (!h) return null;
    const q = new URLSearchParams(location.search), st = h.querySelector(".sc-nchart__live-lastbar");
    const done = (h._series || []).filter((p) => !p.live), live = (h._series || []).filter((p) => p.live);
    return `${h.dataset.t} range=${q.get("range")} rsi=${q.get("rsi") || "-"} bubble=${q.get("bubble") || "-"} lens=${h.dataset.lensState || "-"}/${h.dataset.lensWhy || "-"} ` +
      `bars=${done.length} first=${done[0] ? done[0].d.slice(0, 10) : "-"} last=${done.length ? done[done.length - 1].d.slice(0, 16) : "-"} live=${live.length ? live[0].d.slice(0, 16) : "-"} stale="${st ? st.textContent : ""}"`; });
    if (x && !info.includes(x)) info.push(x); } catch (_) {}
}
const label = await page.evaluate(() => (document.querySelector("#sceneMode") || {}).value || "");
console.log(`${tag}-1680.png scene=${label} clock=${clock}\n  ` + info.join("\n  "));
await browser.close(); server.close();
