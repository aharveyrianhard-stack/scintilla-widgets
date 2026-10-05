// S14 (5 Oct 2026): the two tapes on the chart area, measured on the real deck in a hidden browser.
//   node s14.mjs [screen|all]
// Same rig as S11 / S12 (headless Chromium, every non-GET request aborted and counted, the chart API fetched by node with
// the scintillahub.ai origin). Three screens × 9 / 6 / 4 charts: where the tapes are, what the charts gave up, black pixels,
// what is cut, the lists, the prices, the speed, the pause, the tap, the switch. Nothing is written anywhere.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../.."), OUT = path.resolve(HERE, "../shots");
const ONLY = process.argv[2];
const SCREENS = [["1680x1050", 1680, 1050, 2, "MacBook"], ["1920x1080", 1920, 1080, 1, "Apple TV"], ["2560x1440", 2560, 1440, 1, "External"]]
  .filter((s) => !ONLY || ONLY === "all" || s[0] === ONLY);
const NINE = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT", "SPY"];
/* the same three walls S11 measured: nine by hand, six and four as the pages that hold them */
const WALLS = { 9: "/deck/?scene=live&charts=9&range=3D&" + NINE.map((t, i) => "c" + (i + 1) + "=" + t).join("&"), 6: "/deck/?scene=otherIndexes1D", 4: "/deck/?scene=macroIntraday" };
const wall = (n) => WALLS[n];
async function open(browser, w, h, scale) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  let blocked = 0;
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { blocked++; return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") {
      try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
    }
    return route.fallback();
  });
  await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, blocked: () => blocked };
}
const drawn = (page) => page.evaluate(() => [...document.querySelectorAll("#rowTop > .pane.chart-pane:not(.chart-off) iframe:not(.slot-spare)")]
  .filter((f) => getComputedStyle(f.closest(".pane")).display !== "none").map((f) => { try { const cv = f.contentDocument.querySelector("canvas.sc-nchart__cv"); if (!cv || !cv.width) return 0;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let lit = 0; for (let i = 0; i < d.length; i += 64) if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; return lit; } catch (e) { return -1; } }));
/* THE MEASUREMENT, in the page. Black = any gap that is not the Station's 1 px seam between two things, or any gap at all
   at the screen's edge. Cut = anything of a chart or a tape outside the screen, or a tape cell taller than its row. */
function measureInPage() {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  const shown = (p) => getComputedStyle(p).display !== "none" && p.getBoundingClientRect().width > 0;
  const W = innerWidth, H = innerHeight;
  const grid = r(document.getElementById("grid")), top = document.getElementById("rowTop"), col = document.getElementById("rowBot");
  const tb = r(top), cb = r(col), strip = document.getElementById("tapes"), on = !!strip && shown(strip);
  const tapes = on ? [...strip.querySelectorAll(".tape")].map(r) : [];
  const charts = [...top.querySelectorAll(":scope > .pane.chart-pane")].filter(shown).map(r);
  const cols = getComputedStyle(top).gridTemplateColumns.split(" ").filter(Boolean).length, rows = Math.ceil(charts.length / cols);
  const gaps = [], add = (what, w, len, seam) => gaps.push({ what, w: +w.toFixed(2), len: Math.round(len), black: Math.max(0, Math.round((w - (seam ? 1 : 0)) * len)) < len * 0.5 ? 0 : Math.round((w - (seam ? 1 : 0)) * len) });
  add("column → chart area", tb.x - (cb.x + cb.w), H - grid.y, true);
  if (on) {
    add("column → tapes", tapes[0].x - (cb.x + cb.w), tapes[0].h * 2, true);
    add("grid top → LIKED tape", tapes[0].y - grid.y, tapes[0].w, false);
    add("LIKED → FAVORITES", tapes[1].y - (tapes[0].y + tapes[0].h), tapes[0].w, true);
    add("FAVORITES → charts", tb.y - (tapes[1].y + tapes[1].h), tapes[1].w, true);
    for (const t of tapes) add("tape → screen right", W - (t.x + t.w), t.h, false);
  } else add("grid top → charts", tb.y - grid.y, tb.w, false);
  charts.forEach((b, i) => { const ci = i % cols, rw = Math.floor(i / cols);
    if (rw === 0) add("chart row top → chart " + (i + 1), b.y - tb.y, b.w, false);
    if (ci === 0) add("chart area left → chart " + (i + 1), b.x - tb.x, b.h, false);
    if (ci < cols - 1) add("chart " + (i + 1) + " → chart " + (i + 2), charts[i + 1].x - (b.x + b.w), b.h, true); else add("chart " + (i + 1) + " → screen right", W - (b.x + b.w), b.h, false);
    if (rw < rows - 1) add("chart " + (i + 1) + " → chart " + (i + 1 + cols), charts[i + cols].y - (b.y + b.h), b.w, true); else add("chart " + (i + 1) + " → screen bottom", H - (b.y + b.h), b.w, false); });
  const cut = [];
  for (const [i, b] of charts.entries()) if (b.x < -0.5 || b.y < -0.5 || b.x + b.w > W + 0.5 || b.y + b.h > H + 0.5) cut.push("chart " + (i + 1));
  for (const [i, b] of tapes.entries()) if (b.x < cb.x + cb.w - 0.5 || b.x + b.w > W + 0.5 || b.y < grid.y - 0.5) cut.push("tape " + (i + 1));
  let cellsCut = 0, typePx = null, labelPx = null, cellH = null;
  if (on) { for (const c of strip.querySelectorAll(".cell")) { if (c.scrollHeight > c.clientHeight + 0.5 || c.getBoundingClientRect().height > 22.5) cellsCut++; }
    const c0 = strip.querySelector(".cell"), l0 = strip.querySelector(".lbl"); if (c0) { typePx = parseFloat(getComputedStyle(c0).fontSize); cellH = c0.getBoundingClientRect().height; } if (l0) labelPx = parseFloat(getComputedStyle(l0).fontSize); }
  const real = (sel) => on ? [...strip.querySelectorAll(sel + ' .cell:not([aria-hidden="true"])')] : [];
  const liked = real('[data-tape="LIKED"]').map((c) => c.dataset.t), fav = real('[data-tape="FAVORITES"]').map((c) => c.dataset.t);
  const priced = (cells) => cells.filter((c) => c.children[1].textContent !== "—").length;
  return { screen: { w: W, h: H }, gridTop: Math.round(grid.y), tapesOn: on, cols, rows, chartsN: charts.length,
    column: { x: Math.round(cb.x), w: Math.round(cb.w), sharePct: +(cb.w / W * 100).toFixed(1) },
    chartArea: { x: Math.round(tb.x), y: Math.round(tb.y), w: Math.round(tb.w), h: Math.round(tb.h), widthSharePct: +((W - (cb.x + cb.w)) / W * 100).toFixed(1) },
    tapes: tapes.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: +b.h.toFixed(1) })),
    tapesSpanChartArea: on ? tapes.every((b) => Math.abs(b.x - tb.x) < 0.5 && Math.abs(b.x + b.w - (tb.x + tb.w)) < 0.5) : null,
    tapesOverColumnPx: on ? Math.max(0, ...tapes.map((b) => Math.round(cb.x + cb.w - b.x))) : 0,
    stripPx: on ? Math.round(tb.y - grid.y) : 0,
    chart: charts[0] ? { w: Math.round(charts[0].w), h: Math.round(charts[0].h) } : null,
    blackPx: gaps.reduce((s, g) => s + g.black, 0), blackWhere: gaps.filter((g) => g.black).map((g) => g.what + " " + g.w + "px"), cut, cellsCut, typePx, labelPx, cellH,
    lists: { liked: liked.length, favorites: fav.length, onBoth: liked.filter((t) => fav.includes(t)).length, likedTwice: liked.length - new Set(liked).size, favTwice: fav.length - new Set(fav).size },
    priced: { liked: priced(real('[data-tape="LIKED"]')), favorites: priced(real('[data-tape="FAVORITES"]')) }, geigerLit: on ? strip.querySelectorAll('.cell:not([aria-hidden="true"]) .g i.on').length : 0,
    running: on ? [...strip.querySelectorAll(".track")].map((t) => t.classList.contains("run")) : [] };
}
const trackX = (page, which) => page.evaluate((which) => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('[data-tape="' + which + '"] .track')).transform).m41, which);
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const file = path.join(HERE, "s14.json"); const res = fs.existsSync(file) && ONLY && ONLY !== "all" ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
for (const [tag, w, h, scale, name] of SCREENS) for (const n of [9, 6, 4]) {
  const { context, page, errs, blocked } = await open(browser, w, h, scale);
  await page.goto(origin + wall(n));
  let t0 = Date.now(), lit = [];
  while (Date.now() - t0 < 90000) { await page.waitForTimeout(2000); lit = await drawn(page);
    const ok = await page.evaluate(() => { const s = document.getElementById("tapes"); return !!s && s.querySelectorAll('.cell:not([aria-hidden="true"])').length > 20 && [...s.querySelectorAll('.cell:not([aria-hidden="true"]) .px')].filter((e) => e.textContent !== "—").length > 20 && s.querySelectorAll(".g i.on").length > 0; });
    if (ok && lit.length === n && lit.every((v) => v > 50)) break; }
  await page.waitForTimeout(2500);
  const m = await page.evaluate(measureInPage); m.name = name; m.chartsDrawn = lit.filter((v) => v > 50).length;
  /* speed: where the track is, twice, 4 s apart, pointer away */
  await page.mouse.move(w - 5, h - 5); const a = await trackX(page, "LIKED"); await page.waitForTimeout(4000); const b = await trackX(page, "LIKED");
  m.speedPxS = +(((a - b) + (b > a ? await page.evaluate(() => document.querySelector('[data-tape="LIKED"] .track').scrollWidth / 2) : 0)) / 4).toFixed(1);
  const fa = await trackX(page, "FAVORITES"); await page.waitForTimeout(3000); const fb = await trackX(page, "FAVORITES");
  m.speedFavoritesPxS = +(((fa - fb) + (fb > fa ? await page.evaluate(() => document.querySelector('[data-tape="FAVORITES"] .track').scrollWidth / 2) : 0)) / 3).toFixed(1);
  await page.screenshot({ path: path.join(OUT, `s14-deck-${n}-${tag}.png`) });
  if (n === 9) { const t = m.tapes[0]; await page.screenshot({ path: path.join(OUT, `s14-tapes-close-${tag}.png`), clip: { x: Math.max(0, t.x - 60), y: Math.max(0, t.y - 8), width: Math.min(960, w - Math.max(0, t.x - 60)), height: 46 + 70 } }); }
  if (n === 9) {
    /* pause on hover */
    const t = m.tapes[0]; await page.mouse.move(t.x + t.w / 2, t.y + 11); await page.waitForTimeout(400); const p1 = await trackX(page, "LIKED"); await page.waitForTimeout(2000); const p2 = await trackX(page, "LIKED");
    m.hover = { movedPx: +Math.abs(p2 - p1).toFixed(2), favoritesStillRunning: null };
    const f1 = await trackX(page, "FAVORITES"); await page.waitForTimeout(1000); const f2 = await trackX(page, "FAVORITES"); m.hover.favoritesStillRunning = Math.abs(f2 - f1) > 5;
    /* tap: the name under the pointer, three times running - a name not on the wall goes to slot 1, the next to slot 2; a name on the wall stays where it is */
    const before = await page.evaluate(() => CHARTS.slice(0, CHART_COUNT));
    const pick = async () => page.evaluate(({ x, y }) => { const c = document.elementFromPoint(x, y)?.closest(".cell"); return c ? c.dataset.t : null; }, { x: t.x + t.w / 2, y: t.y + 11 });
    const taps = [];
    for (let k = 0; k < 2; k++) { await page.mouse.move(t.x + t.w / 2 + k * 190, t.y + 11); await page.waitForTimeout(300);
      const name1 = await page.evaluate(({ x, y }) => { const c = document.elementFromPoint(x, y)?.closest(".cell"); return c ? c.dataset.t : null; }, { x: t.x + t.w / 2 + k * 190, y: t.y + 11 });
      await page.mouse.click(t.x + t.w / 2 + k * 190, t.y + 11); await page.waitForTimeout(600);
      taps.push({ tapped: name1, wall: await page.evaluate(() => CHARTS.slice(0, CHART_COUNT)), note: await page.evaluate(() => document.getElementById("symbolNote").textContent) }); }
    const again = await page.evaluate(() => { const before = CHARTS.slice(0, CHART_COUNT).join(","); openTapeTicker("SPY"); return { same: before === CHARTS.slice(0, CHART_COUNT).join(","), note: document.getElementById("symbolNote").textContent }; });
    m.tap = { before, taps, nameAlreadyOnTheWall: again };
    await page.waitForTimeout(6000); await page.mouse.move(w - 5, h - 5); await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `s14-tap-${tag}.png`) });
    /* the switch: ⋯ → tapes · on */
    const colOn = m.column, areaOn = m.chartArea;
    await page.evaluate(() => { document.getElementById("moreBtn").click(); }); await page.waitForTimeout(500);
    const tg = await page.evaluate(() => { const b = document.getElementById("tapesToggle"), r = b.getBoundingClientRect(); return { text: b.textContent, pressed: b.getAttribute("aria-pressed"), visible: r.width > 0 && r.height > 0, inMore: !!b.closest("#moreGroup") }; });
    await page.screenshot({ path: path.join(OUT, `s14-switch-${tag}.png`), clip: { x: 0, y: 0, width: w, height: 140 } });
    await page.evaluate(() => document.getElementById("tapesToggle").click()); await page.waitForTimeout(1500);
    const off = await page.evaluate(measureInPage); const offText = await page.evaluate(() => document.getElementById("tapesToggle").textContent);
    await page.evaluate(() => { document.getElementById("moreBtn").click(); }); await page.mouse.move(w - 5, h - 5); await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(OUT, `s14-off-${tag}.png`) });
    m.switch = { button: tg, offText, off: { tapesOn: off.tapesOn, chartArea: off.chartArea, chart: off.chart, column: off.column, blackPx: off.blackPx, cut: off.cut },
      chartRowGaveUpPx: off.chartArea.h - areaOn.h, widthChangedPx: off.chartArea.w - areaOn.w, columnChangedPx: off.column.w - colOn.w,
      remembered: await page.evaluate(() => localStorage.getItem("station.tapes")) };
    await page.evaluate(() => document.getElementById("tapesToggle").click()); await page.waitForTimeout(800);
    m.switch.backOn = await page.evaluate(() => document.body.classList.contains("tapes"));
  }
  m.errs = errs; m.blocked = blocked(); res[`${tag}-${n}`] = m;
  console.log(tag, name, n, JSON.stringify({ share: m.chartArea.widthSharePct, strip: m.stripPx, tapes: m.tapes, chart: m.chart, grid: m.cols + "x" + m.rows, black: m.blackPx, where: m.blackWhere, cut: m.cut, cellsCut: m.cellsCut, lists: m.lists, priced: m.priced, geiger: m.geigerLit, speed: m.speedPxS, speedFav: m.speedFavoritesPxS, drawn: m.chartsDrawn, hover: m.hover, tap: m.tap, sw: m.switch, errs, blocked: m.blocked }));
  await context.close();
}
fs.writeFileSync(file, JSON.stringify(res, null, 1));
await browser.close(); server.close(); process.exit(0);
