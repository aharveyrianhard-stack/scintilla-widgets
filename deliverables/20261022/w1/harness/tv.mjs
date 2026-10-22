// W1 (22 Oct 2026): the free TradingView Advanced Chart widget, measured in a hidden browser.
//   node tv.mjs   -> ../measure/tv-probe.json, ../shots/tv-*.png
// What it asks: (1) are the US stock bars real-time or delayed, and whose volume do they carry (one exchange or the tape);
// (2) the widget's VWAP against VWAP from the house 5-minute bars (completed bars only), two names, one moment;
// (3) clouds: does `studies` take a public community script (a well-known open-source one, never Alan's), and does the
// widget's own indicator menu offer community scripts; (4) does the widget say anything back to the page (postMessage).
// Headless shell; the test pages are served from a scratch folder; every non-GET request is aborted (nothing is written
// anywhere); the chart API is fetched by node with the scintillahub.ai origin. Nothing of Alan's is used: SPY and QQQ only.
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MEASURE = path.resolve(HERE, "../measure"), SHOTS = path.resolve(HERE, "../shots");
fs.mkdirSync(MEASURE, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "w1-tv-"));
const API = "https://scintilla-massive-chart-api.fly.dev";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);
/* a public, open-source community script: Squeeze Momentum Indicator [LazyBear] (its id as the script page prints it) */
const COMMUNITY = { name: "Squeeze Momentum Indicator [LazyBear]", id: "USER;3C1tlFfLlxsL04ENWUiE3tXxLkQV5EXF", pub: "PUB;3C1tlFfLlxsL04ENWUiE3tXxLkQV5EXF" };
const base = (symbol, interval, extra) => Object.assign({ symbol, interval, timezone: "America/New_York", theme: "dark", style: "1", locale: "en",
  allow_symbol_change: true, hide_side_toolbar: false, backgroundColor: "#0a0a0a", gridColor: "rgba(255,255,255,0.04)", studies: ["STD;VWAP"],
  autosize: true, support_host: "https://www.tradingview.com" }, extra || {});
const CASES = [
  { key: "spy", cfg: base("SPY", "5") },
  { key: "qqq", cfg: base("QQQ", "5") },
  { key: "spy-ext", cfg: base("SPY", "5", { extended_hours: true }) },
  { key: "spy-clouds", cfg: base("SPY", "5", { studies: ["STD;VWAP", COMMUNITY.id, COMMUNITY.pub] }) },
];
for (const c of CASES) fs.writeFileSync(path.join(ROOT, c.key + ".html"), `<!doctype html><meta charset="utf-8"><title>${c.key}</title>
<style>html,body{margin:0;background:#0a0a0a;height:100%}#w{width:1200px;height:720px}</style>
<div id="w"><div class="tradingview-widget-container" style="height:100%"><div class="tradingview-widget-container__widget" style="height:100%"></div>
<script src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>${JSON.stringify(c.cfg)}</script></div></div>
<script>window.__msgs=[];addEventListener("message",(e)=>{try{window.__msgs.push({origin:e.origin,data:JSON.stringify(e.data).slice(0,240)})}catch(_){window.__msgs.push({origin:e.origin,data:"(unserialisable)"})}});</script>`);

async function houseBars(symbol, tries = 3) {
  for (let i = 1; i < tries; i++) { try { return await houseBarsOnce(symbol); } catch (e) { await sleep(1500); } }
  return houseBarsOnce(symbol);
}
async function houseBarsOnce(symbol) {
  const r = await fetch(`${API}/candles?symbol=${symbol}&tf=5m&limit=400&authority=provider&forming=1`, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
  const j = await r.json();
  const rows = (j.series || j.candles || j.bars || []).map((b) => ({ t: +b.t || Date.parse(b.t) || +b.time * (b.time > 1e12 ? 1 : 1000), o: +b.o, h: +b.h, l: +b.l, c: +b.c, v: +b.v }))
    .filter((b) => Number.isFinite(b.t) && Number.isFinite(b.o));
  return { meta: { provider: j.provider, surface: j.surface, volume_basis: j.volume_basis, session_extension: j.session_extension, acquired: j.provider_refresh && j.provider_refresh.acquired_utc, count: rows.length, sample: (j.series || [])[0] }, rows };
}
const ET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const et = (ms) => { const p = {}; for (const x of ET.formatToParts(new Date(ms))) p[x.type] = x.value; return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, label: `${p.hour}:${p.minute}` }; };
/* VWAP as TradingView computes it: sum(hlc3 x volume) / sum(volume) from the session's anchor through the bar */
function vwapThrough(rows, throughT, anchorMin) {
  const day = et(throughT).day;
  let pv = 0, vv = 0, n = 0;
  for (const b of rows) { const e = et(b.t); if (e.day !== day || e.min < anchorMin || b.t > throughT) continue; pv += (b.h + b.l + b.c) / 3 * b.v; vv += b.v; n++; }
  return vv ? { vwap: pv / vv, bars: n, volume: vv } : null;
}
/* the widget's legend (measured 22 Oct: data-qa-id="legend-series-item" for the series, class item-…study-… for each study;
   each value is a valueItem with a valueTitle and a valueValue; the exchange title carries the listing in its tooltip) */
const readLegend = () => {
  const items = [...document.querySelectorAll('[data-qa-id="legend-series-item"], [class*="item-"][class*="study-"]')].map((it) => {
    const title = it.querySelector('[data-qa-id*="legend-source-title"], [class*="titleWrapper-"]');
    const values = [...it.querySelectorAll('[class*="valueItem-"]')].map((v) => ({ k: ((v.querySelector('[class*="valueTitle-"]') || {}).textContent || "").trim(), v: ((v.querySelector('[class*="valueValue-"]') || {}).textContent || "").trim() }));
    const titles = [...it.querySelectorAll('[title],[aria-label]')].map((n) => n.getAttribute("title") || n.getAttribute("aria-label")).filter(Boolean);
    const badges = [...it.querySelectorAll('[class*="statusItem"], [class*="dataMode"], [class*="marketStatus"], [data-qa-id*="status"], [data-qa-id*="mode"]')].map((n) => ({ text: n.innerText.trim(), title: n.getAttribute("title") || n.getAttribute("aria-label") || "" }));
    return { title: title ? title.innerText.trim() : it.innerText.slice(0, 80), text: it.innerText.replace(/\n/g, " ").slice(0, 200), values, titles, badges, series: /series-/.test(it.className) };
  });
  return items;
};
const frameText = () => document.body.innerText.slice(0, 4000);
const num = (s) => { const m = String(s || "").replace(/[,\s]/g, "").match(/-?\d+(\.\d+)?/); return m ? +m[0] : NaN; };
const volNum = (s) => { const t = String(s || "").replace(/[,\s]/g, ""); const m = t.match(/(-?\d+(\.\d+)?)([KMB])?/i); if (!m) return NaN; const k = { K: 1e3, M: 1e6, B: 1e9 }[(m[3] || "").toUpperCase()] || 1; return +m[1] * k; };
function parseSeries(items) {
  const s = items.find((it) => it.series) || items.find((it) => it.values.some((v) => /^O$/i.test(v.k.trim()))) || items[0];
  if (!s) return null;
  const g = (k) => { const v = s.values.find((x) => x.k.trim().toUpperCase() === k); return v ? num(v.v) : NaN; };
  const vol = items.find((it) => /^vol/i.test(it.title || "") || /volume/i.test(it.text)); const vv = vol && vol.values.length ? volNum(vol.values[0].v) : NaN;
  const vwap = items.find((it) => /vwap/i.test(it.title || "") || /vwap/i.test(it.text)); const vw = vwap && vwap.values.length ? num(vwap.values.find((x) => Number.isFinite(num(x.v))).v) : NaN;
  return { o: g("O"), h: g("H"), l: g("L"), c: g("C"), v: vv, vwap: vw, series: s.text, vwapText: vwap ? vwap.text : null, volText: vol ? vol.text : null };
}
async function widgetFrame(page) {
  for (let i = 0; i < 60; i++) {
    const f = page.frames().find((fr) => /tradingview-widget\.com|tradingview\.com\/widgetembed/.test(fr.url()));
    if (f) { try { const n = await f.evaluate(() => document.querySelectorAll('[data-qa-id="legend-series-item"] [class*="valueValue-"]').length); if (n) return f; } catch (_) {} }
    await sleep(1000);
  }
  return page.frames().find((fr) => /tradingview/.test(fr.url())) || null;
}
const out = { at: new Date().toISOString(), community: COMMUNITY, cases: {} };
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  for (const c of CASES) {
    const context = await browser.newContext({ viewport: { width: 1240, height: 760 }, deviceScaleFactor: 1, timezoneId: "America/New_York" });
    const net = { refused: [], hosts: new Set() };
    await context.route("**/*", async (route) => {
      const req = route.request(), host = new URL(req.url()).host; net.hosts.add(host);
      if (host.startsWith("127.0.0.1")) return route.fallback();
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { net.refused.push(req.method() + " " + host); return route.abort(); }
      return route.fallback();
    });
    const page = await context.newPage(); const errs = [];
    page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
    page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
    const r = { key: c.key, cfg: c.cfg, errors: errs };
    await page.goto(origin + "/" + c.key + ".html", { waitUntil: "domcontentloaded" });
    const frame = await widgetFrame(page);
    r.frameUrl = frame ? frame.url().slice(0, 300) : null;
    await sleep(6000);
    if (frame) {
      r.legendAtRest = await frame.evaluate(readLegend).catch((e) => ({ error: String(e) }));
      r.text = await frame.evaluate(frameText).catch(() => "");
      r.delayWords = (r.text.match(/[^\n]*(delay|real[- ]?time|cboe|bzx|15 min|end of day)[^\n]*/gi) || []).slice(0, 12);
      /* the data-mode badge (the orange D in the picture): every tooltip in the legend, and the badge's own */
      r.legendTooltips = await frame.evaluate(() => [...document.querySelectorAll('[data-qa-id="legend"] [title], [data-qa-id="legend"] [aria-label], [class*="legend"] [title]')].map((n) => (n.getAttribute("title") || n.getAttribute("aria-label")) + " :: " + n.innerText.trim().slice(0, 30)).filter((x, i, a) => a.indexOf(x) === i).slice(0, 30)).catch(() => []);
      r.dataMode = await frame.evaluate(() => { const hits = []; for (const n of document.querySelectorAll('[data-qa-id="legend"] *')) { const t = (n.innerText || "").trim(); if (/^(D|R|E|DELAYED|EOD)$/.test(t) && n.children.length <= 1) hits.push({ text: t, title: n.getAttribute("title") || n.closest("[title]")?.getAttribute("title") || "", cls: String(n.className).slice(0, 80) }); } return hits.slice(0, 6); }).catch(() => []);
      r.rest = parseSeries(Array.isArray(r.legendAtRest) ? r.legendAtRest : []);
      await page.screenshot({ path: path.join(SHOTS, `tv-${c.key}.png`) });
      /* the hover sweep: from the right edge of the price pane leftwards, one reading every 6 px */
      const fe = await page.$("iframe"); const fb = fe ? await fe.boundingBox() : null;
      const pane = await frame.evaluate(() => { const n = document.querySelector('[data-name="pane-canvas"], .chart-markup-table canvas, canvas'); if (!n) return null; const b = n.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }).catch(() => null);
      r.pane = pane;
      const hovers = [];
      if (fb && pane) {
        const y = fb.y + pane.y + pane.h * 0.5;
        for (let dx = 70; dx <= 520 && hovers.length < 14; dx += 6) {
          const x = fb.x + pane.x + pane.w - dx;
          await page.mouse.move(x, y); await sleep(220);
          const items = await frame.evaluate(readLegend).catch(() => []);
          const p = parseSeries(items);
          if (p && Number.isFinite(p.o) && !hovers.some((h) => h.o === p.o && h.h === p.h && h.l === p.l && h.c === p.c)) hovers.push(Object.assign({ x: Math.round(x), dx }, p));
        }
        await page.screenshot({ path: path.join(SHOTS, `tv-${c.key}-hover.png`) });
        await page.mouse.move(5, 5);
      }
      r.hovers = hovers;
      /* the house bars: match each hovered bar by its O H L C, then VWAP through that bar from 04:00 and from 09:30 */
      const sym = c.cfg.symbol;
      try {
        const house = await houseBars(sym); r.house = house.meta;
        const newest = house.rows[house.rows.length - 1]; r.houseNewest = newest ? { t: new Date(newest.t).toISOString(), et: et(newest.t).label, o: newest.o, h: newest.h, l: newest.l, c: newest.c, v: newest.v } : null;
        const tol = (a, b) => Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 1e-4);
        r.matches = hovers.map((hv) => {
          const m = house.rows.filter((b) => tol(hv.o, b.o) && tol(hv.h, b.h) && tol(hv.l, b.l) && tol(hv.c, b.c));
          if (m.length !== 1) return { hover: hv, matched: m.length };
          const b = m[0]; const v04 = vwapThrough(house.rows, b.t, 4 * 60), v930 = vwapThrough(house.rows, b.t, 9 * 60 + 30);
          return { hover: hv, matched: 1, bar: { t: new Date(b.t).toISOString(), et: et(b.t).label, v: b.v }, volumeShare: Number.isFinite(hv.v) && b.v ? +(hv.v / b.v).toFixed(4) : null,
            vwapFrom0400: v04 && { vwap: +v04.vwap.toFixed(4), bars: v04.bars, diff: Number.isFinite(hv.vwap) ? +(hv.vwap - v04.vwap).toFixed(4) : null },
            vwapFrom0930: v930 && { vwap: +v930.vwap.toFixed(4), bars: v930.bars, diff: Number.isFinite(hv.vwap) ? +(hv.vwap - v930.vwap).toFixed(4) : null } };
        });
        if (r.rest && Number.isFinite(r.rest.o)) {
          const cand = house.rows.filter((b) => tol(r.rest.o, b.o) && Math.abs(r.rest.h - b.h) <= 0.02 && b.t > Date.now() - 3 * 3600e3);
          r.newestBar = cand.length ? { tvO: r.rest.o, tvH: r.rest.h, matchedHouseBar: cand.map((b) => ({ et: et(b.t).label, o: b.o, h: b.h, l: b.l, c: b.c })), probeEt: et(Date.now()).label,
            minutesBehind: cand.length === 1 ? Math.round((Date.now() - cand[0].t) / 60000) : null } : { tvO: r.rest.o, tvH: r.rest.h, matched: 0 };
        }
        const good = r.matches.filter((m) => m.matched === 1);
        r.summary = { hovered: hovers.length, matched: good.length, latestMatchedBarEt: good.length ? good.map((m) => m.bar.et).sort().slice(-1)[0] : null,
          probeEt: et(Date.now()).label, medianVolumeShare: good.length ? good.map((m) => m.volumeShare).filter((x) => x != null).sort((a, b) => a - b)[Math.floor(good.length / 2)] : null };
      } catch (e) { r.houseError = String(e).slice(0, 200); }
      /* clouds: the legend names the studies the widget accepted */
      r.studiesInLegend = (Array.isArray(r.legendAtRest) ? r.legendAtRest : []).map((it) => it.title || it.text);
      if (c.key === "spy-clouds" || c.key === "spy") {
        /* the widget's own indicator menu: what its dialog offers */
        try {
          const btn = frame.locator('[data-name="open-indicators-dialog"]:visible').first();
          if (await btn.count()) { await btn.click({ timeout: 8000 }); await sleep(2500);
            r.indicatorDialog = await frame.evaluate(() => { const d = document.querySelector('[data-name="indicators-dialog"], [data-dialog-name], [class*="dialog-"]'); if (!d) return null;
              const tabs = [...d.querySelectorAll('[role="tab"], [data-name*="tab"], [class*="tab-"], [class*="Tab"]')].map((n) => n.innerText.trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 24);
              return { text: d.innerText.slice(0, 1500), tabs, community: /community/i.test(d.innerText), hasSearch: !!d.querySelector("input"), names: [...d.querySelectorAll("[data-name]")].map((n) => n.getAttribute("data-name")).filter((x, i, a) => a.indexOf(x) === i).slice(0, 30) }; });
            await page.screenshot({ path: path.join(SHOTS, `tv-${c.key}-indicators.png`) });
            if (r.indicatorDialog && r.indicatorDialog.hasSearch) {
              await frame.type("input", "Squeeze Momentum").catch(() => {}); await sleep(3000);
              r.indicatorSearch = await frame.evaluate(() => { const d = document.querySelector('[data-name="indicators-dialog"], [class*="dialog-"]'); return d ? d.innerText.slice(0, 1600) : null; });
              await page.screenshot({ path: path.join(SHOTS, `tv-${c.key}-indicators-search.png`) });
            }
          } else r.indicatorDialog = { error: "no indicators button found" };
        } catch (e) { r.indicatorDialog = { error: String(e).slice(0, 200) }; }
      }
    }
    r.messages = await page.evaluate(() => window.__msgs).catch(() => []);
    r.hosts = [...net.hosts]; r.refused = [...new Set(net.refused)];
    out.cases[c.key] = r;
    log(c.key, "frame", !!frame, "rest", JSON.stringify(r.rest), "summary", JSON.stringify(r.summary), "studies", JSON.stringify(r.studiesInLegend));
    await context.close();
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(MEASURE, "tv-probe.json"), JSON.stringify(out, null, 1));
log("wrote", path.join(MEASURE, "tv-probe.json"));
