// S7 (from F1's / S6's harness) — headless only. node shots.mjs <stationRoot> <hubIndexHtml|-> <outDir> <tag> [only=a,b]
// The Station is answered from <stationRoot> as https://station.scintillahub.ai and the Hub's page from <hubIndexHtml> as
// https://scintillahub.ai/ (every other Hub asset and read goes to the live site, GET only). The chart API is fetched by node
// with the scintillahub.ai origin (the only origin it admits) and handed back with CORS relaxed. EVERY non-GET request is
// aborted, so nothing here writes anywhere. Writes <tag>-<name>.png and <tag>-shots.json (what each oscillator block drew).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [stationRoot, hubFile, outDir, tag, onlyArg] = process.argv.slice(2);
const only = onlyArg ? new Set(onlyArg.replace(/^only=/, "").split(",")) : null;
const hubHtml = hubFile && hubFile !== "-" ? fs.readFileSync(hubFile) : null;
const ST = "https://station.scintillahub.ai";
const SHOTS = [
  { name: "station-8up-hover-wide", url: ST + "/deck/index.html?scene=targetsOsc", w: 1680, wait: 28000, hover: [0.6, 0.4] },
  { name: "station-8up-hover", url: ST + "/deck/index.html?scene=targetsOsc", w: 1680, wait: 28000, hover: [0.6, 0.4], crop: 0 },
  { name: "station-single-SPY-1D", url: ST + "/chart/?t=SPY&range=1D&rsi=1", w: 1680, wait: 22000 },
  { name: "station-single-SPY-1D-hover", url: ST + "/chart/?t=SPY&range=1D&rsi=1", w: 1680, wait: 22000, hover: [0.62, 0.4] },
  { name: "station-deck-expanded-hover", url: ST + "/deck/index.html?scene=targetsOsc", w: 1680, wait: 28000, solo: true, hover: [0.6, 0.35], crop: 0 },
  { name: "hub-collapsed-MU-hover", hub: "MU", exp: "0", w: 1680, wait: 9000, hover: [0.6, 0.35], crop: 0 },
  { name: "hub-expanded-MU-hover", hub: "MU", exp: "1", w: 1680, wait: 9000, hover: [0.6, 0.35], full: true },
  { name: "station-phone-390-deck", url: ST + "/deck/index.html?scene=spyQqq1D", w: 390, wait: 24000, crop: 0 },
  { name: "hub-phone-390-MU", hub: "MU", exp: "0", w: 390, wait: 9000, crop: 0 }
];
const MIME = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png", webmanifest: "application/json" };
async function open(width, exp) {
  const H = width < 600 ? 844 : 1050, MOBILE = width < 600;
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width, height: H }, deviceScaleFactor: 2, isMobile: MOBILE, hasTouch: MOBILE });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
    if (u.host === "scintilla-massive-chart-api.fly.dev") {
      try {
        const r = await fetch(u.href, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
        return route.fulfill({ status: r.status, contentType: "application/json", body: await r.text(), headers: { "access-control-allow-origin": "*" } });
      } catch (_) { return route.abort(); }
    }
    if (hubHtml && u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html"))
      return route.fulfill({ status: 200, contentType: MIME.html, body: hubHtml, headers: { "cache-control": "no-store" } });
    if (u.host === "station.scintillahub.ai") {
      let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
      let f = path.join(stationRoot, p);
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(f), headers: { "cache-control": "no-store" } });
      return route.fulfill({ status: 404, body: "nf" });
    }
    return route.continue();
  });
  await context.addInitScript(([e]) => { if (window.top !== window) return; try { localStorage.setItem("station.rotate.paused", "1");
    localStorage.setItem("hub.chart.range", "1D"); if (e != null) localStorage.setItem("hub.company.expanded", e); } catch (_) {} }, [exp == null ? null : exp]);
  return { browser, context };
}
/* what every visible chart pane drew: its oscillator block and the panes inside it */
async function dump(page) {
  const hosts = [];
  for (const f of page.frames()) {
    try {
      const r = await f.evaluate(() => {
        const h = document.querySelector("#chartSlot .sc-nchart"); if (!h) return null;
        const fe = window.frameElement;
        let off = { left: 0, top: 0 };
        if (fe) { try { const cs = getComputedStyle(fe); if (cs.opacity === "0" || cs.visibility === "hidden" || !fe.offsetWidth || fe.classList.contains("slot-next") || fe.classList.contains("slot-spare")) return null; off = fe.getBoundingClientRect(); } catch (_) {} }
        const a = h.querySelector(".sc-nchart__area").getBoundingClientRect();
        const d = h._rsiDrawn;
        const slim = (p) => p && { mode: p.mode, top: p.top, height: p.height, yLo: p.yLo, yHi: p.yHi, ink: p.ink, chip: p.chip && { text: p.chip.text, value: p.chip.value, developing: p.chip.developing, displaced: p.chip.displaced }, wChip: p.wChip && { text: p.wChip.text, value: p.wChip.value, native: p.wChip.native, developing: p.wChip.developing, displaced: p.wChip.displaced, box: p.wChip.box }, williams: p.williams,
          lines: (p.lines || []).map((l) => [l.key, l.value, l.developing, l.stale]), cloud: p.cloud && { lo: p.cloud.lo, hi: p.cloud.hi, missing: p.cloud.missing }, hover: p.hover, readout: p.readout, readoutRows: p.readoutRows, leftOff: p.leftOff, guides: p.guides };
        return { t: h.dataset.t, range: h._range, url: location.pathname + location.search, frameOffset: [off.left, off.top], area: [a.left, a.top, a.width, a.height],
          plot: h._plot ? { padL: h._plot.padL, iw: h._plot.iw, padT: h._plot.padT, ih: h._plot.ih } : null, bars: h._series ? h._series.length : 0,
          osc: d ? { mode: d.mode, osc: d.osc, top: d.top, height: d.height, panes: (d.panes || [d]).map(slim) } : null };
      });
      /* F1: a cross-origin frame (the Hub's chart pane on station.*) cannot read its own frameElement; ask the browser */
      if (r && f !== page.mainFrame() && r.frameOffset[0] === 0 && r.frameOffset[1] === 0) {
        const fe = await f.frameElement(); const bb = fe && await fe.boundingBox(); if (bb) r.frameOffset = [bb.x, bb.y]; }
      if (r) hosts.push(r);
    } catch (_) {}
  }
  hosts.sort((a, b) => (a.frameOffset[1] + a.area[1]) - (b.frameOffset[1] + b.area[1]) || (a.frameOffset[0] + a.area[0]) - (b.frameOffset[0] + b.area[0]));
  return hosts;
}
const results = [];
for (const s of SHOTS) {
  if (only && !only.has(s.name)) continue;
  const { browser, context } = await open(s.w, s.exp);
  try {
    const page = await context.newPage();
    const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
    if (s.hub) {
      await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
      await page.waitForFunction((t) => typeof S !== "undefined" && document.querySelector('[data-act="row"][data-t="' + t + '"]'), s.hub, { timeout: 60000 });
      await sleep(1500);
      await page.evaluate((t) => document.querySelector('[data-act="row"][data-t="' + t + '"]').click(), s.hub);
      await sleep(s.wait);
      /* wait for the pane's oscillator block (up to 30 s more) */
      for (let i = 0; i < 60; i++) { const h = await dump(page); if (h.some((x) => x.osc && x.osc.panes && x.osc.panes[0].lines.length)) break; await sleep(500); }
      /* F1: bring the chart pane into the viewport so the hover and the crop land on it */
      for (const f of page.frames()) { if (f === page.mainFrame()) continue;
        try { if (await f.evaluate(() => !!document.querySelector("#chartSlot .sc-nchart"))) { const fe = await f.frameElement(); await fe.scrollIntoViewIfNeeded(); await sleep(800); break; } } catch (_) {} }
    } else {
      await page.goto(s.url);
      await sleep(s.wait);
    }
    if (s.solo) {
      /* the deck's ⤢ on the first chart pane */
      await page.evaluate(() => { const b = document.querySelector(".chart-pane .chart-full"); if (b) b.click(); });
      await sleep(5000);
    }
    let hosts = await dump(page);
    const pick = s.crop != null ? hosts[s.crop] : hosts[0];
    if (s.hover && pick && pick.plot) {
      const x = pick.frameOffset[0] + pick.area[0] + pick.plot.padL + pick.plot.iw * s.hover[0];
      const y = pick.frameOffset[1] + pick.area[1] + pick.plot.padT + pick.plot.ih * s.hover[1];
      await page.mouse.move(x - 20, y - 10); await page.mouse.move(x, y, { steps: 4 });
      await sleep(900);
      hosts = await dump(page);
    }
    const out = path.join(outDir, `${tag}-${s.name}.png`);
    const target = s.crop != null ? hosts[s.crop] : null;
    if (target) await page.screenshot({ path: out, clip: { x: Math.max(0, target.frameOffset[0] + target.area[0] - 4), y: Math.max(0, target.frameOffset[1] + target.area[1] - 4), width: target.area[2] + 8, height: target.area[3] + 8 } });
    else await page.screenshot({ path: out, fullPage: !!s.full });
    results.push({ name: s.name, url: s.url || ("hub " + s.hub + " expanded=" + s.exp), w: s.w, at: new Date().toISOString(), hosts, errs });
    console.log(s.name, "panes", hosts.length, "osc", hosts.map((h) => h.osc ? h.osc.osc + ":" + h.osc.panes.map((p) => p.mode + "/" + p.lines.filter((l) => l[1] != null).length + "/" + p.readout + "/rows" + p.readoutRows + (p.hover ? " [" + p.hover.join(" | ") + "]" : "")).join(",") : "none").join(" "), "errs", errs.length);
  } finally { await browser.close(); }
}
const jf = path.join(outDir, `${tag}-shots.json`);
const prev = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, "utf8")) : [];
fs.writeFileSync(jf, JSON.stringify(prev.filter((p) => !results.some((r) => r.name === p.name)).concat(results), null, 1));
