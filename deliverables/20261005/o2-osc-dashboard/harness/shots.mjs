// CH1 (5 Oct 2026) — headless only. node shots.mjs <stationRoot> <outDir> <tag> [tickers=CBRS,...] [ranges=1h,4h,1D,3D,1W] [hosts=station,hub]
// The Station is answered from <stationRoot> as https://station.scintillahub.ai. The chart API is fetched by node with the
// scintillahub.ai origin (the only origin it admits) and handed back with CORS relaxed. EVERY non-GET request is aborted.
// Writes <tag>-<name>.png at 1680 x 1050 and <tag>-shots.json: what each pane drew (price range, lens window, oscillator pane,
// Geiger chip) plus an OVERFLOW CHECK: every recorded box must sit inside the pane's canvas, and the oscillator's drawn values
// must sit inside its pane.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [stationRoot, outDir, tag, ...rest] = process.argv.slice(2);
const arg = (k, d) => { const a = rest.find((x) => x.startsWith(k + "=")); return a ? a.slice(k.length + 1).split(",") : d; };
const TICKERS = arg("tickers", ["CBRS"]), RANGES = arg("ranges", ["1h", "4h", "1D", "3D", "1W"]), HOSTS = arg("hosts", ["station", "hub"]);
const ST = "https://station.scintillahub.ai";
const BUBBLE = { "1h": "1d:60", "4h": "1d:60", "1D": "30m:3", "3D": "4h:12", "1W": "1d:20" };
const SHOTS = [];
for (const t of TICKERS) for (const r of RANGES) for (const h of HOSTS)
  SHOTS.push({ name: `${t}-${r}-${h}`, w: 1680, url: h === "hub"
    ? `${ST}/chart/?bare=hub&t=${t}&range=${r}&clouds=1&rsi=1&bubble=${BUBBLE[r]}`
    : `${ST}/chart/?t=${t}&range=${r}&clouds=1&rsi=1&bubble=${BUBBLE[r]}` });
const MIME = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png", webmanifest: "application/json" };
async function open(width) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width, height: 1050 }, deviceScaleFactor: 2 });
  let blocked = 0;
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { blocked++; return route.abort(); }
    if (u.host === "scintilla-massive-chart-api.fly.dev") {
      try {
        const r = await fetch(u.href, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
        return route.fulfill({ status: r.status, contentType: "application/json", body: await r.text(), headers: { "access-control-allow-origin": "*" } });
      } catch (_) { return route.abort(); }
    }
    if (u.host === "station.scintillahub.ai") {
      let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
      let f = path.join(stationRoot, p);
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(f), headers: { "cache-control": "no-store" } });
      return route.fulfill({ status: 404, body: "nf" });
    }
    return route.continue();
  });
  await context.addInitScript(() => { try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  return { browser, context, blocked: () => blocked };
}
/* what the pane drew, read from the host the chart keeps its state on */
async function dump(page) {
  return page.evaluate(() => {
    const h = document.querySelector(".sc-nchart"); if (!h) return null;
    const area = h.querySelector(".sc-nchart__area"), cv = area && area.querySelector("canvas");
    const a = area.getBoundingClientRect();
    const pts = h._series || [];
    const P = h._plot, L = h._lens, D = h._rsiDrawn;
    const vis = P ? pts.slice(P.start, P.end + 1).map((q) => q.p) : [];
    const badge = h.querySelector(".sc-nchart__live");
    const g = h.querySelector(".sc-nchart__live-geiger:not([hidden])");
    const gr = g ? g.getBoundingClientRect() : null;
    const lensCv = h.querySelector("canvas[data-lens], .sc-lens, canvas.sc-nchart__lens") || Array.from(h.querySelectorAll("canvas")).find((c) => c !== cv && c.getAttribute("aria-label"));
    const lr = lensCv ? lensCv.getBoundingClientRect() : null;
    const fanVis = (() => { try { const f = h._rsiFan || h._fan; return null; } catch (_) { return null; } })();
    const slim = (p) => p && { mode: p.mode, top: p.top, height: p.height, yLo: p.yLo, yHi: p.yHi, guides: p.guides, visLo: p.visLo, visHi: p.visHi,
      chip: p.chip && { text: p.chip.text, box: p.chip.box || { x: p.chip.x, y: p.chip.y, w: p.chip.w, h: p.chip.h } },
      wChip: p.wChip && { text: p.wChip.text, box: p.wChip.box }, lines: (p.lines || []).map((l) => [l.key, l.value]), williams: p.williams && p.williams.map ? p.williams.map((l) => [l.key, l.value]) : p.williams };
    return { t: h.dataset.t, range: h._range, url: location.pathname + location.search, area: [a.left, a.top, a.width, a.height],
      canvas: cv ? [cv.clientWidth, cv.clientHeight] : null, bars: pts.length,
      header: badge ? badge.textContent.trim().replace(/\s+/g, " ") : null,
      plot: P ? { padL: P.padL, padT: P.padT, iw: P.iw, ih: P.ih, start: P.start, end: P.end, yLo: P.yLo, yHi: P.yHi, visLo: Math.min(...vis), visHi: Math.max(...vis), visN: vis.length,
        first: pts[P.start] && pts[P.start].d, last: pts[P.end] && pts[P.end].d, lastP: pts[P.end] && pts[P.end].p } : null,
      cloudLabels: h._cloudLabels, lens: L ? { ...L, spot: L.spot } : null, lensState: h.dataset.lensState, lensWhy: h.dataset.lensWhy,
      lensLabel: lensCv ? lensCv.getAttribute("aria-label") : null, lensRect: lr ? [lr.left - a.left, lr.top - a.top, lr.width, lr.height] : null,
      geiger: g ? { text: g.textContent.trim().replace(/\s+/g, " "), rect: [gr.left - a.left, gr.top - a.top, gr.width, gr.height], spot: h._geigerSpot } : null,
      trace: P ? pts.slice(P.start, P.end + 1).map((q, k) => [P.padL + (k / Math.max(1, P.end - P.start + P.rightBars)) * P.iw, P.padT + (1 - (q.p - P.yLo) / (P.yHi - P.yLo)) * P.ih]) : null,
      osc: D ? { mode: D.mode, osc: D.osc, top: D.top, height: D.height, panes: (D.panes || [D]).map(slim) } : null };
  });
}
/* the overflow check: boxes inside the canvas, oscillator values inside their pane, lens inside the plot */
function overflow(d) {
  const out = [];
  if (!d || !d.canvas) return ["no pane"];
  const [W, H] = d.canvas;
  const inside = (name, b) => { if (!b) return; const x = b.x != null ? b.x : b[0], y = b.y != null ? b.y : b[1], w = b.w != null ? b.w : b[2], h = b.h != null ? b.h : b[3];
    if (x < -0.5 || y < -0.5 || x + w > W + 0.5 || y + h > H + 0.5) out.push(`${name} outside canvas: ${[x, y, w, h].map((v) => Math.round(v)).join(",")} vs ${W}x${H}`); };
  if (d.lens && d.lens.spot) inside("lens", d.lens.spot);
  if (d.lensRect) inside("lens canvas", d.lensRect);
  if (d.geiger) inside("geiger chip", d.geiger.rect);
  if (d.plot) { if (!(d.plot.yLo <= d.plot.visLo && d.plot.yHi >= d.plot.visHi)) out.push(`price range ${d.plot.yLo}..${d.plot.yHi} does not hold the visible ${d.plot.visLo}..${d.plot.visHi}`); }
  if (d.osc) for (const p of d.osc.panes) {
    inside("rsi chip", p.chip && p.chip.box); inside("w chip", p.wChip && p.wChip.box);
    if (p.yLo != null) for (const [k, v] of (p.lines || [])) if (v != null && (v < p.yLo - 1e-9 || v > p.yHi + 1e-9)) out.push(`osc ${k}=${v} outside ${p.yLo}..${p.yHi}`);
    if (p.visLo != null && p.yLo != null && (p.visLo < p.yLo - 1e-9 || p.visHi > p.yHi + 1e-9)) out.push(`osc visible ${p.visLo}..${p.visHi} outside the pane's room ${p.yLo}..${p.yHi}`);
    if (p.yLo != null && !(p.yLo <= 30 && p.yHi >= 70)) out.push(`osc room ${p.yLo}..${p.yHi} drops the 30/70 bands`);
  }
  /* RULE D: the price trace (rebuilt from the pane's own scale) never passes through the lens, the Geiger chip or a cloud label */
  if (d.plot && d.trace) {
    const hit = (name, b, padPx = 2) => { if (!b) return; const x = b.x != null ? b.x : b[0], y = b.y != null ? b.y : b[1], w = b.w != null ? b.w : b[2], h = b.h != null ? b.h : b[3];
      const X0 = x - padPx, Y0 = y - padPx, X1 = x + w + padPx, Y1 = y + h + padPx;
      for (let i = 1; i < d.trace.length; i++) { const [ax, ay] = d.trace[i - 1], [bx, by] = d.trace[i];
        for (let k = 0; k <= 8; k++) { const px = ax + (bx - ax) * k / 8, py = ay + (by - ay) * k / 8; if (px >= X0 && px <= X1 && py >= Y0 && py <= Y1) { out.push(`${name} sits on the price trace at ${Math.round(px)},${Math.round(py)}`); return; } } } };
    if (d.lens && d.lens.spot) hit("lens", d.lens.spot, d.lens.oval ? -Math.round(d.lens.oval.short * 0.15) : 0);
    if (d.geiger) hit("geiger chip", d.geiger.rect);
    for (const l of d.cloudLabels || []) hit("cloud label " + l.text, { x: l.x, y: l.y - 6, w: l.width, h: 12 }, 0);
  }
  if (d.geiger && d.lens && d.lens.spot) { const g = d.geiger.rect, s = d.lens.spot;
    if (g[0] < s.x + s.w && g[0] + g[2] > s.x && g[1] < s.y + s.h && g[1] + g[3] > s.y) out.push("geiger chip overlaps the lens"); }
  return out;
}
const results = [];
for (const s of SHOTS) {
  const { browser, context, blocked } = await open(s.w);
  try {
    const page = await context.newPage();
    const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
    await page.goto(s.url);
    let d = null;
    for (let i = 0; i < 70; i++) { await sleep(500); d = await dump(page); if (d && d.plot && d.lens && d.lens.spot && d.osc) break; }
    await sleep(2500); d = await dump(page);
    const out = path.join(outDir, `${tag}-${s.name}.png`);
    await page.screenshot({ path: out });
    const over = overflow(d);
    results.push({ name: s.name, url: s.url, at: new Date().toISOString(), png: path.basename(out), pane: d, overflow: over, errs, blockedWrites: blocked() });
    console.log(s.name, d && d.header, "| plot", d && d.plot && `${d.plot.yLo.toFixed(2)}..${d.plot.yHi.toFixed(2)} vis ${d.plot.visLo}..${d.plot.visHi}`,
      "| lens", d && d.lens ? `${d.lens.key} ${d.lens.sessions}s ${d.lens.bars}b last ${d.lens.last} @${d.lens.lastT} ${d.lens.stale ? "STALE" : "fresh"} why=${d.lens.why}` : d && d.lensWhy,
      "| osc", d && d.osc ? d.osc.panes.map((p) => `${p.mode} ${p.yLo}-${p.yHi} ` + (p.lines || []).map((l) => l[0] + ":" + (l[1] == null ? "—" : l[1].toFixed(1))).join(" ")).join(";") : "none",
      "| geiger", d && d.geiger && d.geiger.text, "| OVER", over.length ? over.join("; ") : "none", "| errs", errs.length);
  } finally { await browser.close(); }
}
const jf = path.join(outDir, `${tag}-shots.json`);
const prev = fs.existsSync(jf) ? JSON.parse(fs.readFileSync(jf, "utf8")) : [];
fs.writeFileSync(jf, JSON.stringify(prev.filter((p) => !results.some((r) => r.name === p.name)).concat(results), null, 1));
