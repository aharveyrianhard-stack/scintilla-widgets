// W2 (22 Oct 2026): live-v1 measured in a hidden browser, against the chart API's own JSON and the TradingView embed.
//   node w2.mjs <tv-root> [--live-min=6]   -> ../measure/w2-precision.json, w2-live.json, w2-pictures.json; ../shots/*.png
// <tv-root>: a folder holding station-shells/tv-v1/index.html exported read-only from station/w1-widget-wall-20261022 (W1's shell;
// it is not on this branch). Same rig as W1/Y9: headless shell 1234, throwaway profiles, the checkout served on 127.0.0.1, the chart
// API fetched by node with the scintillahub.ai origin (the only origin it admits) and handed to the page; every non-GET request is
// aborted (nothing is written anywhere). TradingView's embed loads from TradingView as in W1's probe.
// What it proves:
//   1. PRECISION - for SPY, QQQ and NVDA: the shell's last 10 completed 5-minute bars against the API's own JSON fetched by node at
//      the same moment (t, o, h, l, c, v equal), the crosshair readout of each of those bars (the printed text), and the shell's two
//      VWAPs against VWAP computed here, independently, from the same JSON (equal to the cent); plus the last regular-session hour
//      (15:00-15:55, 12 bars) for the 09:30 anchor. The TradingView embed's newest bar at the same moment (W1's legend method) for contrast.
//   2. LIVE - a 1m and a 5m chart left running: when each new bar reached the screen after its close, and every chart-API call
//      the pages made (the cost).
//   3. PICTURES - live-v1 beside tv-v1 at the WIDGETS slot sizes (1074 x 756 at 2560 x 1440; 537 x 397 at 1280 x 800, dpr 2).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../..");
const MEASURE = path.resolve(HERE, "../measure"), SHOTS = path.resolve(HERE, "../shots");
fs.mkdirSync(MEASURE, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
const TV_ROOT = path.resolve(process.argv[2] || "");
if (!fs.existsSync(path.join(TV_ROOT, "station-shells/tv-v1/index.html"))) throw new Error("tv-root must hold station-shells/tv-v1/index.html");
const LIVE_MIN = +((process.argv.find((a) => a.startsWith("--live-min=")) || "=6").split("=")[1]);
const API = "https://scintilla-massive-chart-api.fly.dev";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);

/* ---- New York time and VWAP, written here independently of the shell -------------------------------------------------- */
const ETF = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const et = (ms) => { const p = {}; for (const x of ETF.formatToParts(new Date(ms))) p[x.type] = x.value; return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, label: `${String(+p.hour % 24).padStart(2, "0")}:${p.minute}` }; };
/* sum(hlc3 x v) / sum(v), cumulative from the anchor, per New York day. 0400: bars opening 04:00-19:59; 0930: bars holding a minute of
   09:30-16:00. The same definitions the shell states; the arithmetic is this file's own. Also the exact trade VWAP from the provider's
   per-bar vw (sum(vw x v) / sum(v)), for the record. */
function vwapAt(rows, idx, tfMin, anchor, field) {
  const day = et(rows[idx].t).day; let pv = 0, vv = 0, any = false;
  for (let i = 0; i <= idx; i++) {
    const b = rows[i], e = et(b.t); if (e.day !== day) continue;
    const ok = anchor === "0930" ? (e.min + tfMin > 570 && e.min < 960) : (e.min >= 240 && e.min < 1200);
    if (!ok) continue; any = true;
    if (b.v > 0) { pv += (field === "vw" ? b.vw : (b.h + b.l + b.c) / 3) * b.v; vv += b.v; }
  }
  const e = et(rows[idx].t), inside = anchor === "0930" ? (e.min + tfMin > 570 && e.min < 960) : (e.min >= 240 && e.min < 1200);
  return inside && any && vv > 0 ? pv / vv : null;
}
const cents = (v) => v == null ? null : Math.round(v * 100) / 100;
/* the shell's price text, rebuilt here: the shortest decimals (two at least) that read back as the same number */
function pxText(v) { for (let d = 2; d <= 8; d++) if (+v.toFixed(d) === v) return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); return String(v); }

async function apiJson(url) {
  const r = await fetch(API + url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
  return { status: r.status, at: Date.now(), hot: r.headers.get("x-hot-read"), cc: r.headers.get("cache-control"), json: await r.json() };
}

/* ---- the rig: one browser, a context per job; chart-API GETs relayed and logged; nothing but GET leaves ------------------- */
const { server, origin } = await serve(REPO);
const tv = await serve(TV_ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const calls = [];
async function context(width, height, dpr, tag) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, timezoneId: "America/New_York" });
  const refused = [];
  await ctx.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { refused.push(req.method() + " " + host); return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") {
      const at = Date.now();
      try {
        const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
        const body = await r.text();
        calls.push({ tag, at, ms: Date.now() - at, path: url.replace(/^https:\/\/[^/]+/, ""), status: r.status, bytes: body.length, hot: r.headers.get("x-hot-read"), cc: r.headers.get("cache-control") });
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } });
      } catch (e) { return route.abort(); }
    }
    return route.fallback();
  });
  ctx._refused = refused;
  return ctx;
}
async function openLive(ctx, query) {
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  await page.goto(origin + "/station-shells/live-v1/" + query, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(() => window.SC_LIVE && window.SC_LIVE.snapshot()).catch(() => null);
    if (s && !s.loading && s.quote && (!s.clouds || s.cloudRows)) break;
    await sleep(500);
  }
  await sleep(800);
  page._errs = errs;
  return page;
}
const snap = (page) => page.evaluate(() => window.SC_LIVE.snapshot());

/* ---- W1's TradingView legend reader (deliverables/20261022/w1/harness/tv.mjs on station/w1-widget-wall-20261022), unchanged ---- */
const readLegend = () => {
  const items = [...document.querySelectorAll('[data-qa-id="legend-series-item"], [class*="item-"][class*="study-"]')].map((it) => {
    const title = it.querySelector('[data-qa-id*="legend-source-title"], [class*="titleWrapper-"]');
    const values = [...it.querySelectorAll('[class*="valueItem-"]')].map((v) => ({ k: ((v.querySelector('[class*="valueTitle-"]') || {}).textContent || "").trim(), v: ((v.querySelector('[class*="valueValue-"]') || {}).textContent || "").trim() }));
    return { title: title ? title.innerText.trim() : it.innerText.slice(0, 80), text: it.innerText.replace(/\n/g, " ").slice(0, 200), values, series: /series-/.test(it.className) };
  });
  return items;
};
const num = (s) => { const m = String(s || "").replace(/[,\s]/g, "").match(/-?\d+(\.\d+)?/); return m ? +m[0] : NaN; };
const volNum = (s) => { const t = String(s || "").replace(/[,\s]/g, ""); const m = t.match(/(-?\d+(\.\d+)?)([KMB])?/i); if (!m) return NaN; const k = { K: 1e3, M: 1e6, B: 1e9 }[(m[3] || "").toUpperCase()] || 1; return +m[1] * k; };
function parseSeries(items) {
  const s = items.find((it) => it.series) || items.find((it) => it.values.some((v) => /^O$/i.test(v.k.trim()))) || items[0];
  if (!s) return null;
  const g = (k) => { const v = s.values.find((x) => x.k.trim().toUpperCase() === k); return v ? num(v.v) : NaN; };
  const vol = items.find((it) => /^vol/i.test(it.title || "") || /volume/i.test(it.text)); const vv = vol && vol.values.length ? volNum(vol.values[0].v) : NaN;
  const vwap = items.find((it) => /vwap/i.test(it.title || "") || /vwap/i.test(it.text)); const vwv = vwap && vwap.values.find((x) => Number.isFinite(num(x.v)));
  return { o: g("O"), h: g("H"), l: g("L"), c: g("C"), v: vv, vwap: vwv ? num(vwv.v) : NaN, series: s.text };
}
async function widgetFrame(page) {
  for (let i = 0; i < 60; i++) {
    const f = page.frames().find((fr) => /tradingview-widget\.com|tradingview\.com\/widgetembed/.test(fr.url()));
    if (f) { try { const n = await f.evaluate(() => document.querySelectorAll('[data-qa-id="legend-series-item"] [class*="valueValue-"]').length); if (n) return f; } catch (_) {} }
    await sleep(1000);
  }
  return null;
}
async function openTv(ctx, symbol, tf, extra) {
  const page = await ctx.newPage();
  await page.goto(tv.origin + "/station-shells/tv-v1/?t=" + symbol + "&tf=" + tf + "&n=1" + (extra || ""), { waitUntil: "domcontentloaded" });
  const frame = await widgetFrame(page);
  await sleep(5000);
  return { page, frame };
}

const out = { at: new Date().toISOString(), symbols: {}, tv: {} };

/* ---- 2 (started first, runs alongside): LIVE - a 1m and a 5m chart left running ------------------------------------------- */
const live = { started: new Date().toISOString(), minutes: LIVE_MIN, charts: {} };
const liveCtx = await context(1074, 756, 1, "live");
const livePages = {};
for (const tf of ["1m", "5m"]) { livePages[tf] = await openLive(liveCtx, `?symbol=SPY&tf=${tf}`); live.charts[tf] = { arrivals: [], samples: 0 }; }
let liveStop = false;
const liveLoop = (async () => {
  const seen = {};
  for (const tf of Object.keys(livePages)) { const s = await snap(livePages[tf]); seen[tf] = s.bars.filter((b) => !b.forming).slice(-1)[0].t; live.charts[tf].first = { newest: et(seen[tf]).label, at: new Date().toISOString() }; }
  while (!liveStop) {
    for (const tf of Object.keys(livePages)) {
      const s = await snap(livePages[tf]).catch(() => null); if (!s) continue;
      live.charts[tf].samples++;
      const newest = s.bars.filter((b) => !b.forming).slice(-1)[0];
      if (newest && newest.t > seen[tf]) {
        const tfMs = tf === "1m" ? 60000 : 300000, closeAt = newest.t + tfMs, now = Date.now();
        const read = s.log.filter((r) => r.kind === "tail" && r.grew).slice(-1)[0];
        live.charts[tf].arrivals.push({ bar: et(newest.t).label, closedAt: new Date(closeAt).toISOString(), onScreenBy: new Date(now).toISOString(),
          readAt: read ? new Date(read.at).toISOString() : null, secondsAfterClose: read ? +((read.at - closeAt) / 1000).toFixed(1) : +((now - closeAt) / 1000).toFixed(1),
          o: newest.o, h: newest.h, l: newest.l, c: newest.c, v: newest.v, state: s.state });
        seen[tf] = newest.t;
        log("live", tf, "new bar", et(newest.t).label, "on screen", live.charts[tf].arrivals.slice(-1)[0].secondsAfterClose, "s after close");
      }
    }
    await sleep(1000);
  }
})();

/* ---- 1: PRECISION ------------------------------------------------------------------------------------------------------------ */
const SYMBOLS = ["SPY", "QQQ", "NVDA"];
const precCtx = await context(1074, 756, 1, "precision");
const tvCtx = await context(1074, 756, 1, "tv");
for (const sym of SYMBOLS) {
  const r = { symbol: sym };
  const page = await openLive(precCtx, `?symbol=${sym}&tf=5m`);
  /* the TradingView embed for the same symbol, opened now so it is read at the same moment */
  const tvp = await openTv(tvCtx, sym, "5");
  const s = await snap(page);
  const api = await apiJson(`/candles?symbol=${sym}&tf=5m&limit=600&authority=provider`);
  r.readAt = { shellRead: s.log.filter((x) => x.kind === "bars").slice(-1)[0], apiFetchedAt: new Date(api.at).toISOString(), apiHot: api.hot, apiCacheControl: api.cc };
  const rows = api.json.series.map((b) => ({ t: +b.t, o: +b.o, h: +b.h, l: +b.l, c: +b.c, v: +b.v, vw: +b.vw, n: +b.n }));
  r.api = { provider: api.json.provider, surface: api.json.surface, volume_basis: api.json.volume_basis, bar_authority: api.json.bar_authority, finality: api.json.session_extension && api.json.session_extension.finality, newest: api.json.newest, count: rows.length };
  const done = s.bars.filter((b) => !b.forming);
  const last10 = done.slice(-10);
  const byT = new Map(rows.map((b, i) => [b.t, i]));
  r.bars = last10.map((b) => {
    const i = byT.get(b.t), a = i == null ? null : rows[i];
    return { et: et(b.t).label, t: b.t, inApi: !!a, equal: !!a && a.o === b.o && a.h === b.h && a.l === b.l && a.c === b.c && a.v === b.v,
      shell: { o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }, api: a && { o: a.o, h: a.h, l: a.l, c: a.c, v: a.v } };
  });
  r.newestShellBar = et(done[done.length - 1].t).label; r.newestApiBar = et(rows[rows.length - 1].t).label;
  /* the readout, bar by bar: the pointer on each of the ten bars, the printed text parsed back */
  const shellIdx = new Map(s.bars.map((b, i) => [b.t, i]));
  r.readout = [];
  for (const b of last10) {
    const ix = shellIdx.get(b.t), x = await page.evaluate((i) => window.SC_LIVE.xOf(i), ix);
    const box = await page.$("#area").then((h) => h.boundingBox());
    await page.mouse.move(box.x + x, box.y + box.height * 0.4); await sleep(120);
    const text = await page.evaluate(() => document.getElementById("readout").innerText.replace(/\s+/g, " ").trim());
    const m = text.match(/O ([\d,.]+) H ([\d,.]+) L ([\d,.]+) C ([\d,.]+) V ([\d,]+) (.*?)VWAP 09:30 ([\d,.]+|—)( \(16:00\))? VWAP 04:00 ([\d,.]+|—)/);
    const a = rows[byT.get(b.t)], i = byT.get(b.t);
    const want = { o: pxText(a.o), h: pxText(a.h), l: pxText(a.l), c: pxText(a.c), v: Math.round(a.v).toLocaleString("en-US") };
    const v930 = vwapAt(rows, i, 5, "0930"), v400 = vwapAt(rows, i, 5, "0400");
    /* after 16:00 the shell prints the regular session's 16:00 value: the last bar of the day that had one */
    let v930shown = v930, after = false;
    if (v930 == null && et(a.t).min >= 960) for (let j = i - 1; j >= 0 && et(rows[j].t).day === et(a.t).day; j--) { const v = vwapAt(rows, j, 5, "0930"); if (v != null) { v930shown = v; after = true; break; } }
    r.readout.push({ et: et(b.t).label, text, parsed: !!m,
      ohlcvTextEqual: !!m && m[1] === want.o && m[2] === want.h && m[3] === want.l && m[4] === want.c && m[5] === want.v,
      ohlcNumbersEqual: !!m && +m[1].replace(/,/g, "") === a.o && +m[2].replace(/,/g, "") === a.h && +m[3].replace(/,/g, "") === a.l && +m[4].replace(/,/g, "") === a.c,
      vwap0930: { shown: m ? m[7] : null, here: cents(v930shown), after16: after, equalToTheCent: !!m && (m[7] === "—" ? v930shown == null : +m[7].replace(/,/g, "") === cents(v930shown)) },
      vwap0400: { shown: m ? m[9] : null, here: cents(v400), equalToTheCent: !!m && (m[9] === "—" ? v400 == null : +m[9].replace(/,/g, "") === cents(v400)) },
      shellVwapExact: { v930: s.vw930[ix], v400: s.vw400[ix], here930: v930, here400: v400,
        maxAbsDiff: Math.max(Math.abs((s.vw930[ix] ?? NaN) - (v930 ?? NaN)) || 0, Math.abs((s.vw400[ix] ?? NaN) - (v400 ?? NaN)) || 0) },
      tradeVwap0400: cents(vwapAt(rows, i, 5, "0400", "vw")) });
  }
  await page.mouse.move(2, 2);
  /* the 09:30 anchor inside the regular session: the last ten 5-minute bars before 16:00 today */
  const today = et(rows[rows.length - 1].t).day;
  const rth = rows.map((b, i) => ({ b, i })).filter(({ b }) => et(b.t).day === today && et(b.t).min >= 900 && et(b.t).min < 960);
  r.regularSession = rth.map(({ b, i }) => {
    const ix = shellIdx.get(b.t), here = vwapAt(rows, i, 5, "0930"), shell = ix == null ? null : s.vw930[ix];
    return { et: et(b.t).label, shell: shell == null ? null : cents(shell), here: cents(here), equalToTheCent: shell != null && cents(shell) === cents(here), exactDiff: shell == null || here == null ? null : shell - here,
      tradeVwap: cents(vwapAt(rows, i, 5, "0930", "vw")) };
  });
  r.summary = { bars: r.bars.length, barsEqual: r.bars.filter((x) => x.equal).length, readoutsEqual: r.readout.filter((x) => x.ohlcvTextEqual && x.ohlcNumbersEqual).length,
    vwap0930ToTheCent: r.readout.filter((x) => x.vwap0930.equalToTheCent).length, vwap0400ToTheCent: r.readout.filter((x) => x.vwap0400.equalToTheCent).length,
    regularSessionVwapToTheCent: r.regularSession.filter((x) => x.equalToTheCent).length + " of " + r.regularSession.length,
    maxVwapFloatDiff: Math.max(0, ...r.readout.map((x) => x.shellVwapExact.maxAbsDiff), ...r.regularSession.map((x) => Math.abs(x.exactDiff || 0))) };
  /* the TradingView embed's newest bar at this moment, matched to the house bars by its open and high (W1's method) */
  if (tvp.frame) {
    const items = await tvp.frame.evaluate(readLegend).catch(() => []);
    const p = parseSeries(items);
    const tol = (a, b) => Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 1e-4);
    const cand = p ? rows.filter((b) => tol(p.o, b.o) && Math.abs(p.h - b.h) <= 0.02 && b.t > Date.now() - 3 * 3600e3) : [];
    const one = cand.length === 1 ? cand[0] : null;
    /* no exact match (Cboe One's after-hours bars can differ in open and high from the whole tape's): the nearest house bar by the
       summed O H L C distance, reported as NEAREST, never as a match */
    const near = !one && p ? rows.filter((b) => b.t > Date.now() - 3 * 3600e3).map((b) => ({ b, d: Math.abs(p.o - b.o) + Math.abs(p.h - b.h) + Math.abs(p.l - b.l) + Math.abs(p.c - b.c) }))
      .sort((x, y) => x.d - y.d)[0] : null;
    out.tv[sym] = { readAt: new Date().toISOString(), widget: p, legend: items.map((it) => it.text).slice(0, 4),
      matchedHouseBar: cand.map((b) => ({ et: et(b.t).label, o: b.o, h: b.h, l: b.l, c: b.c, v: Math.round(b.v) })),
      nearestHouseBarNotExact: near ? { et: et(near.b.t).label, o: near.b.o, h: near.b.h, l: near.b.l, c: near.b.c, v: Math.round(near.b.v), ohlcDistance: +near.d.toFixed(4),
        minutesBehindClock: Math.round((Date.now() - near.b.t) / 60000) } : null,
      minutesBehindClock: one ? Math.round((Date.now() - one.t) / 60000) : null,
      houseNewestCompleted: r.newestApiBar,
      volumeShareOfTape: one && Number.isFinite(p.v) && one.v ? +(p.v / one.v).toFixed(3) : null,
      vwapVsHouse0400: one && Number.isFinite(p.vwap) ? { widget: p.vwap, house: cents(vwapAt(rows, rows.indexOf(one), 5, "0400")), diff: +(p.vwap - vwapAt(rows, rows.indexOf(one), 5, "0400")).toFixed(4) } : null };
    log("tv", sym, JSON.stringify({ widget: p && { o: p.o, h: p.h, l: p.l, c: p.c, v: p.v, vwap: p.vwap }, matched: out.tv[sym].matchedHouseBar, behind: out.tv[sym].minutesBehindClock, share: out.tv[sym].volumeShareOfTape }));
  } else out.tv[sym] = { error: "the TradingView frame did not draw within 60 s" };
  r.pageErrors = page._errs;
  out.symbols[sym] = r;
  log("precision", sym, JSON.stringify(r.summary), "newest shell", r.newestShellBar, "api", r.newestApiBar);
  /* the pictures of this moment: live-v1 and the embed, same symbol, same size */
  await page.screenshot({ path: path.join(SHOTS, `w2-live-${sym.toLowerCase()}-5m-1074x756.png`) });
  await tvp.page.screenshot({ path: path.join(SHOTS, `w2-tv-${sym.toLowerCase()}-5m-1074x756.png`) });
  if (sym === "SPY") {
    const ix = s.bars.length - 8, x = await page.evaluate((i) => window.SC_LIVE.xOf(i), ix), box = await page.$("#area").then((h) => h.boundingBox());
    await page.mouse.move(box.x + x, box.y + box.height * 0.35); await sleep(200);
    await page.screenshot({ path: path.join(SHOTS, "w2-live-spy-5m-crosshair.png") });
  }
  await page.close(); await tvp.page.close();
}
fs.writeFileSync(path.join(MEASURE, "w2-precision.json"), JSON.stringify({ at: out.at, symbols: out.symbols, tv: out.tv, refused: [...new Set([...precCtx._refused, ...tvCtx._refused])] }, null, 1));

/* ---- 3: PICTURES at the WIDGETS slot sizes: live-v1 beside tv-v1 (the deck mounts both with ?bare=1) ------------------------- */
const pics = [];
for (const [w, h, dpr, label] of [[1074, 756, 1, "1074x756"], [537, 397, 2, "537x397"]]) {
  const c = await context(w, h, dpr, "pictures");
  const lp = await openLive(c, "?t=SPY&tf=5&n=1&bare=1");
  const tp = await openTv(c, "SPY", "5", "&bare=1");
  await lp.screenshot({ path: path.join(SHOTS, `w2-slot-live-spy-${label}.png`) });
  await tp.page.screenshot({ path: path.join(SHOTS, `w2-slot-tv-spy-${label}.png`) });
  pics.push({ size: label, dpr, live: `w2-slot-live-spy-${label}.png`, tv: `w2-slot-tv-spy-${label}.png`, at: new Date().toISOString(), state: (await snap(lp)).state });
  for (const [q, name] of [["?symbol=SPY&tf=1D", "1d"], ["?symbol=SPY&tf=1h", "1h"], ["?symbol=SPY&tf=5m&clouds=0", "5m-noclouds"]]) {
    if (label !== "1074x756") continue;
    const p2 = await openLive(c, q); await p2.screenshot({ path: path.join(SHOTS, `w2-live-spy-${name}-${label}.png`) }); await p2.close();
  }
  await c.close();
}
fs.writeFileSync(path.join(MEASURE, "w2-pictures.json"), JSON.stringify(pics, null, 1));

/* ---- 2, finished: wait out the live window, then count the calls ---------------------------------------------------------- */
const liveEnd = Date.parse(live.started) + LIVE_MIN * 60000;
while (Date.now() < liveEnd) await sleep(2000);
liveStop = true; await liveLoop;
for (const tf of Object.keys(livePages)) {
  const s = await snap(livePages[tf]);
  live.charts[tf].shellLog = s.log.map((r) => ({ at: new Date(r.at).toISOString(), kind: r.kind, ok: r.ok, grew: r.grew, n: r.n }));
  live.charts[tf].finalState = s.state; live.charts[tf].nextRead = s.nextRead && { at: new Date(s.nextRead.at).toISOString(), why: s.nextRead.why };
  await livePages[tf].screenshot({ path: path.join(SHOTS, `w2-live-spy-${tf}-after-${LIVE_MIN}min.png`) });
}
live.ended = new Date().toISOString();
const mins = (Date.parse(live.ended) - Date.parse(live.started)) / 60000;
const liveCalls = calls.filter((c) => c.tag === "live");
/* the shell's reads: /quotes (the live price), /universe (the provider client's ownership proof), tf=D (his clouds' daily closes),
   limit=24 (the newest bars, after a close) and the history read on load (limit 960 on 1m, 600 on 5m) */
const kind = (p) => p.startsWith("/quotes") ? "quotes" : p.startsWith("/universe") ? "universe"
  : p.includes("tf=D&") ? "daily (clouds)" : p.includes("&limit=24") ? "bars, newest" : "bars, history (load)";
live.calls = { minutes: +mins.toFixed(2), pages: 2, byKind: {}, perMinutePerChart: {}, log: liveCalls.map((c) => ({ at: new Date(c.at).toISOString(), path: c.path, ms: c.ms, bytes: c.bytes, hot: c.hot, cc: c.cc })) };
for (const c of liveCalls) { const k = kind(c.path); const o = live.calls.byKind[k] || (live.calls.byKind[k] = { n: 0, bytes: 0, msTotal: 0, hot: 0, miss: 0 }); o.n++; o.bytes += c.bytes; o.msTotal += c.ms; if (c.hot === "hit") o.hot++; if (c.hot === "miss") o.miss++; }
for (const [k, o] of Object.entries(live.calls.byKind)) live.calls.perMinutePerChart[k] = +(o.n / mins / 2).toFixed(2);
live.refused = [...new Set(liveCtx._refused)];
fs.writeFileSync(path.join(MEASURE, "w2-live.json"), JSON.stringify(live, null, 1));
log("live", JSON.stringify(live.calls.byKind), "arrivals", JSON.stringify(Object.fromEntries(Object.entries(live.charts).map(([k, v]) => [k, v.arrivals.map((a) => a.bar + " +" + a.secondsAfterClose + "s")]))));
await browser.close(); server.close(); tv.server.close();
log("wrote", MEASURE);
