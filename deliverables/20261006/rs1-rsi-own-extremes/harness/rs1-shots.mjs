// RS1 (6 Oct 2026) — headless only. node rs1-shots.mjs <stationRoot> <outDir> <tag> [ownRows.json]
// The Station is answered from <stationRoot> as https://station.scintillahub.ai (before = the tree at
// origin/station/merge-20260923, after = this branch). The chart API is fetched by node with the scintillahub.ai origin
// (the only origin it admits) and handed back with CORS relaxed. EVERY non-GET request is aborted and counted.
// /geiger reads the Hub's nightly table public.rsi_own_percentiles, which is NOT applied yet: when [ownRows.json] is given
// (the Hub loader's dry run), that ONE read is answered from it in the shape the database would send; every other read
// is live. The chart pane never asks for it (it builds its scale from its own daily bars) — the record proves that.
// Writes <tag>-<name>.png and <tag>-shots.json: the chip the pane drew (text, own-scale colour, hover line), the daily
// requests each pane made, and what /geiger's RSI row shows.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [stationRoot, outDir, tag, ownFile] = process.argv.slice(2);
const own = ownFile && fs.existsSync(ownFile) ? new Map(JSON.parse(fs.readFileSync(ownFile, "utf8")).rows.map((r) => [r.ticker, r])) : null;
const ST = "https://station.scintillahub.ai";
const SHOTS = [
  { name: "chart-NFLX-1D", w: 1680, h: 1050, url: `${ST}/chart/?t=NFLX&range=1D&clouds=1&rsi=1&bubble=30m:3` },
  { name: "chart-NFLX-1D-hub", w: 1680, h: 1050, url: `${ST}/chart/?bare=hub&t=NFLX&range=1D&clouds=1&rsi=1&bubble=30m:3` },
  { name: "chart-TLT-1D", w: 1680, h: 1050, url: `${ST}/chart/?t=TLT&range=1D&clouds=1&rsi=1&bubble=30m:3` },
  { name: "chart-TSM-4h", w: 1680, h: 1050, url: `${ST}/chart/?t=TSM&range=4h&clouds=1&rsi=1&bubble=1d:60` },
  { name: "chart-SPY-1D", w: 1680, h: 1050, url: `${ST}/chart/?t=SPY&range=1D&clouds=1&rsi=1&bubble=30m:3` },
  { name: "chart-NFLX-1D-phone", w: 390, h: 844, url: `${ST}/chart/?t=NFLX&range=1D&clouds=1&rsi=1` },
  { name: "geiger-NFLX", w: 1680, h: 1050, url: `${ST}/geiger/?t=NFLX`, geiger: true },
  { name: "geiger-TLT", w: 1680, h: 1050, url: `${ST}/geiger/?t=TLT`, geiger: true },
  { name: "geiger-NFLX-phone", w: 390, h: 844, url: `${ST}/geiger/?t=NFLX`, geiger: true },
];
const MIME = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png", webmanifest: "application/json" };
fs.mkdirSync(outDir, { recursive: true });
const record = { tag, at: new Date().toISOString(), root: stationRoot, own_rows_file: ownFile || null, shots: [] };
for (const s of SHOTS) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const rec = { name: s.name, url: s.url.replace(ST, ""), blocked_writes: 0, daily_requests: [], own_table_reads: 0, own_table_reads_from_chart_page: 0, errors: [] };
  try {
    const phone = s.w < 600;
    const context = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
    await context.route("**/*", async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { rec.blocked_writes++; return route.abort(); }
      if (u.pathname === "/rest/v1/rsi_own_percentiles") {
        rec.own_table_reads++; if (!s.geiger) rec.own_table_reads_from_chart_page++;
        if (!own) return route.continue();   // before / no dry run: the live database answers (404 today)
        const want = (u.searchParams.get("ticker") || "").replace(/^(in\.\(|eq\.)/, "").replace(/\)$/, "").split(",").map(decodeURIComponent).filter(Boolean);
        const since = (u.searchParams.get("as_of") || "").replace(/^gte\./, ""), cols = (u.searchParams.get("select") || "").split(",").filter(Boolean);
        const rows = want.map((t) => own.get(t)).filter((r) => r && (!since || r.as_of >= since)).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows), headers: { "access-control-allow-origin": "*" } });
      }
      if (u.host === "scintilla-massive-chart-api.fly.dev") {
        if (u.pathname === "/candles" && /^(D|1d|1D)$/.test(u.searchParams.get("tf") || "") && !u.searchParams.get("forming")) rec.daily_requests.push(u.searchParams.get("symbol") + " limit " + u.searchParams.get("limit"));
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
    const page = await context.newPage();
    page.on("pageerror", (e) => rec.errors.length < 10 && rec.errors.push(String(e.message).slice(0, 160)));
    await page.goto(s.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (s.geiger) {
      await page.waitForFunction(() => { const n = document.querySelector('[data-gs="rsitable"]'); return n && /gs-mrow/.test(n.innerHTML); }, null, { timeout: 45000 }).catch(() => { rec.noRsiRow = true; });
      await sleep(2500);
      rec.geiger = await page.evaluate(() => {
        const n = document.querySelector('[data-gs="rsitable"]'); if (!n) return null;
        const row = n.querySelector(".gs-mrow"), v = n.querySelector(".gs-mv"), th = n.querySelector(".gs-mth");
        return { marks: [...n.querySelectorAll(".gs-mhd span")].map((x) => x.textContent + " @ " + x.style.left), value: v && v.textContent, value_color: v && getComputedStyle(v).color,
          thumb_color: th && getComputedStyle(th).backgroundColor, hover: row && row.title || null, sub: (document.querySelector('[data-gs="rsisub"]') || {}).textContent || null };
      });
      const box = await page.evaluate(() => { const n = document.querySelector('[data-gs="rsitable"]'); const p = n && n.closest(".gs-ip"); if (!p) return null; const r = p.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      await page.screenshot({ path: path.join(outDir, `${tag}-${s.name}.png`) });
      if (box && box.w > 10) await page.screenshot({ path: path.join(outDir, `${tag}-${s.name}-rsi-row.png`), clip: { x: Math.max(0, box.x - 4), y: Math.max(0, box.y - 4), width: Math.min(s.w - Math.max(0, box.x - 4), box.w + 8), height: box.h + 8 } });
    } else {
      for (let i = 0; i < 70; i++) { const ok = await page.evaluate(() => { const h = document.querySelector(".sc-nchart"); return !!(h && h._series && h._series.length > 5 && h._rsiDrawn && h._rsiDrawn.chip); }); if (ok) break; await sleep(500); }
      await sleep(3500);
      rec.pane = await page.evaluate(() => {
        const h = document.querySelector(".sc-nchart"); if (!h) return null;
        const D = h._rsiDrawn, c = D && D.chip, area = h.querySelector(".sc-nchart__area");
        return { t: h.dataset.t, bars: (h._series || []).length, mode: D && D.mode, chip: c ? { text: c.text, value: c.value, title: c.title, own: c.own || null, box: c.box, developing: c.developing } : null,
          wChip: D && D.wChip ? D.wChip.text : null, guides: D && D.guides ? D.guides.map((g) => g.v) : null, lines: D && D.lines ? D.lines.map((l) => l.key + " " + l.value) : null,
          area_title_at_rest: area ? area.title : null };
      });
      await page.screenshot({ path: path.join(outDir, `${tag}-${s.name}.png`) });
      /* the chip, large: a tight clip around it and the right end of the oscillator pane */
      const b = rec.pane && rec.pane.chip && rec.pane.chip.box, ar = await page.evaluate(() => { const a = document.querySelector(".sc-nchart__area"); if (!a) return null; const r = a.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      if (b && ar) {
        const cw = Math.min(phone ? 300 : 460, s.w), x = Math.max(0, Math.min(s.w - cw, ar.x + b.x + b.w + 12 - cw)), y = Math.max(0, ar.y + b.y - 70);
        await page.screenshot({ path: path.join(outDir, `${tag}-${s.name}-chip.png`), clip: { x, y, width: cw, height: Math.min(s.h - y, 150) } });
        /* the hover: rest the pointer on the chip, then read the title the pane sets (a native tooltip never shows in a headless picture) */
        if (!phone) { await page.mouse.move(ar.x + b.x + b.w / 2, ar.y + b.y + b.h / 2); await sleep(700);
          rec.pane.area_title_on_chip = await page.evaluate(() => { const a = document.querySelector(".sc-nchart__area"); return a ? a.title : null; });
          await page.mouse.move(ar.x + 60, ar.y + 60); await sleep(500);
          rec.pane.area_title_off_chip = await page.evaluate(() => { const a = document.querySelector(".sc-nchart__area"); return a ? a.title : null; }); }
      }
    }
  } catch (e) { rec.failed = String(e && e.message || e).slice(0, 240); }
  finally { await browser.close(); }
  record.shots.push(rec);
  console.log(JSON.stringify({ name: rec.name, failed: rec.failed || null, chip: rec.pane && rec.pane.chip && { text: rec.pane.chip.text, own: rec.pane.chip.own && { pct: rec.pane.chip.own.pct, ink: rec.pane.chip.own.ink, extreme: rec.pane.chip.own.extreme }, title: rec.pane.chip.title }, on_chip: rec.pane && rec.pane.area_title_on_chip, geiger: rec.geiger, daily: rec.daily_requests, own_reads: rec.own_table_reads, writes: rec.blocked_writes, errors: rec.errors.length }));
}
fs.writeFileSync(path.join(outDir, `${tag}-shots.json`), JSON.stringify(record, null, 1));
