// S11 (3 Oct 2026): the Station floor plan, BUILT — measured on the real deck, headless.
//   node build.mjs probe [screen]          which pages give 9 / 6 / 4 charts, geometry only (quick)
//   node build.mjs measure [screen]        3 screens × 9/6/4 (+ 8, TARGETS, for reference) → floorplan.json
//   node build.mjs shots [screen] [grid]   the same, charts drawn first, plus the X column + YouTube corner → shots/*.png, shots.json
// Reuses the S10 rig (deliverables/20261001/station-layout-workshop/harness/rig.mjs): the repo served locally,
// headless Chromium, every non-GET request aborted, the chart API fetched by node with the scintillahub.ai origin
// (the API admits only that origin) and handed to the page. The MacBook is a 2× screen, the Apple TV and the
// external 1×. Rotation is paused in the test browser so a page does not turn mid-measurement; nothing else changes.
// The measurement is S10's (every gap between neighbouring panes and between a pane and the screen's edge; a
// gap wider than the 1 px hairline is black), run on the deck's own panes instead of a mock.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../.."), OUT = path.resolve(HERE, "..");
const MODE = process.argv[2] || "measure";
const SCREENS = [["1680x1050", 1680, 1050, 2, "the MacBook"], ["1920x1080", 1920, 1080, 1, "the Apple TV"], ["2560x1440", 2560, 1440, 1, "the external"]]
  .filter((s) => !process.argv[3] || process.argv[3] === "all" || s[0] === process.argv[3]);
const NINE = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT", "SPY"];
/* 9: LIVE, the manual wall, at its new nine; 6 and 4: real named pages; 8: TARGETS (most rotation pages hold eight) */
const WALLS = {
  9: "/deck/?scene=live&charts=9&range=3D&" + NINE.map((t, i) => "c" + (i + 1) + "=" + t).join("&"),
  6: "/deck/?scene=otherIndexes1D",
  4: "/deck/?scene=macroIntraday",
  8: "/deck/?scene=targets3D",
};
const GRIDS = (process.argv[4] ? [+process.argv[4]] : MODE === "shots" ? [9, 6, 4] : [9, 6, 4, 8]);
async function open(w, h, scale) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
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
  const page = await context.newPage(); return { browser, page, blocked: () => blocked };
}
/* THE ONE MEASUREMENT, run in the deck. Every number in the table comes from here. */
function measureInPage() {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  const ri = (b) => b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) } : null;
  const shown = (p) => getComputedStyle(p).display !== "none" && p.getBoundingClientRect().width > 0;
  const W = innerWidth, H = innerHeight, screen = W * H, area = (b) => b ? b.w * b.h : 0;
  const top = document.getElementById("rowTop"), col = document.getElementById("rowBot");
  const charts = [...top.querySelectorAll(":scope > .pane.chart-pane")].filter(shown).map(r);
  const xp = col.querySelector(':scope > .pane[data-key="x"]');
  const vp = [...col.querySelectorAll(":scope > .pane")].find((p) => p !== xp && shown(p));
  const tb = r(top), cb = r(col), xb = r(xp), vb = vp ? r(vp) : null;
  const cols = getComputedStyle(top).gridTemplateColumns.split(" ").filter(Boolean).length;
  const rows = getComputedStyle(top).gridTemplateRows.split(" ").filter(Boolean).length;
  /* the YouTube picture: the pane minus the shell's own bar (read from the shell, same origin) */
  let bar = null; try { const f = vp.querySelector("iframe"); bar = f.contentDocument.getElementById("bar").getBoundingClientRect().height; } catch (_) {}
  const pic = vb && bar != null ? { w: vb.w, h: vb.h - bar } : null;
  /* black beside or above/below a 16:9 picture in that box, whole pixels only */
  const picBlack = pic ? Math.max(0, Math.floor(pic.w - pic.h * 16 / 9 - 0.5)) * pic.h + Math.max(0, Math.floor(pic.h - pic.w * 9 / 16 - 0.5)) * pic.w : null;
  const gaps = [];
  gaps.push({ what: "screen left → column", w: cb.x, len: H });
  gaps.push({ what: "column → charts", w: tb.x - (cb.x + cb.w), len: H });
  gaps.push({ what: "screen top → X", w: xb.y, len: cb.w });
  if (vb) { gaps.push({ what: "X → YouTube", w: vb.y - (xb.y + xb.h), len: cb.w }); gaps.push({ what: "YouTube → screen bottom", w: H - (vb.y + vb.h), len: cb.w }); }
  else gaps.push({ what: "X → screen bottom", w: H - (xb.y + xb.h), len: cb.w });
  for (let i = 0; i < charts.length; i++) { const b = charts[i], ci = i % cols, rw = Math.floor(i / cols);
    if (rw === 0) gaps.push({ what: "screen top → chart " + (i + 1), w: b.y, len: b.w });
    if (ci === 0) gaps.push({ what: "charts edge → chart " + (i + 1), w: b.x - tb.x, len: b.h });
    if (ci < cols - 1 && charts[i + 1]) gaps.push({ what: "chart " + (i + 1) + " → chart " + (i + 2), w: charts[i + 1].x - (b.x + b.w), len: b.h });
    else gaps.push({ what: "chart " + (i + 1) + " → screen right", w: W - (b.x + b.w), len: b.h });
    if (rw < rows - 1 && charts[i + cols]) gaps.push({ what: "chart " + (i + 1) + " → chart " + (i + 1 + cols), w: charts[i + cols].y - (b.y + b.h), len: b.w });
    else gaps.push({ what: "chart " + (i + 1) + " → screen bottom", w: H - (b.y + b.h), len: b.w });
  }
  const between = (g) => !/screen|edge/.test(g.what);           /* a seam is expected between two panes, never at the screen's edge */
  const seamPx = (g) => between(g) ? Math.min(Math.max(g.w, 0), 1) * g.len : 0;
  const blackPx = (g) => between(g) ? (g.w < 1.5 ? 0 : (g.w - 1) * g.len) : (g.w < 0.5 ? 0 : g.w * g.len);
  const seams = gaps.reduce((s, g) => s + seamPx(g), 0), blackGaps = gaps.reduce((s, g) => s + blackPx(g), 0);
  const widest = gaps.reduce((a, g) => (blackPx(g) > 0 && g.w > a.w) ? g : a, { what: "none", w: 0 });
  const chartsPanes = charts.reduce((s, b) => s + area(b), 0);
  const unused = screen - chartsPanes - area(xb) - area(vb);
  const pct = (px) => +(px / screen * 100).toFixed(1);
  /* THE CHARTS' SHARE, one definition on every row: everything right of the column — the chart panes and the
     hairline seams among and beside them — as a share of the whole screen (it spans the full height) */
  const chartsArea = (W - (cb.x + cb.w)) * H;
  const sharedAxis = [...top.querySelectorAll(":scope > .pane.chart-pane iframe")].filter((f) => /sharedAxis=1/.test(f.src)).length;
  return {
    screen: { w: W, h: H, px: screen }, dpr: devicePixelRatio, scene: (typeof SCENE === "string" ? SCENE : null), rowClass: top.className,
    chartsN: charts.length, cols, rows, sharedAxis,
    column: ri(cb), chartsBlock: ri(tb), chart0: ri(charts[0]), x: ri(xb), video: ri(vb), videoBar: bar, picture: pic ? { w: Math.round(pic.w), h: +pic.h.toFixed(1) } : null,
    px: { chartsArea: Math.round(chartsArea), chartsBlock: Math.round(area(tb)), chartsPanes: Math.round(chartsPanes), chart0: Math.round(area(charts[0])), x: Math.round(area(xb)), video: Math.round(area(vb)),
      seams: Math.round(seams), unused: Math.round(unused), blackGaps: Math.round(blackGaps), blackBesidePicture: picBlack, black: Math.round(blackGaps + (picBlack || 0)) },
    share: { chartsArea: pct(chartsArea), chartsBlock: pct(area(tb)), chartsPanes: pct(chartsPanes), chart0: pct(area(charts[0])), column: pct(area(cb)), x: pct(area(xb)), video: pct(area(vb)), seams: pct(seams), black: pct(blackGaps + (picBlack || 0)) },
    widthShare: { column: +(cb.w / W * 100).toFixed(2), charts: +(tb.w / W * 100).toFixed(2) },
    picture169: pic ? +(pic.w / pic.h).toFixed(4) : null, widestBlackGap: { what: widest.what, px: +widest.w.toFixed(2) },
    flush: vb ? { videoWidthEqualsColumn: Math.abs(vb.w - cb.w) < 0.5, videoAtFoot: Math.abs(vb.y + vb.h - H) < 0.5, xAtTop: Math.abs(xb.y) < 0.5 } : null,
    gaps: gaps.map((g) => ({ what: g.what, w: +g.w.toFixed(2) })).filter((g) => !(g.w >= 0.5 && g.w < 1.5) && g.w !== 0),
  };
}
const drawnCharts = (page) => page.evaluate(() => [...document.querySelectorAll("#rowTop > .pane.chart-pane:not(.chart-off) iframe:not(.slot-spare)")]
  .filter((f) => getComputedStyle(f.closest(".pane")).display !== "none").map((f) => { try { const cv = f.contentDocument.querySelector("canvas.sc-nchart__cv"); if (!cv || !cv.width) return 0;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let lit = 0; for (let i = 0; i < d.length; i += 64) if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; return lit; } catch (e) { return -1; } }));
const { server, origin } = await serve(ROOT);
const file = MODE === "shots" ? "shots.json" : MODE === "probe" ? "probe.json" : "floorplan.json";
const res = fs.existsSync(path.join(HERE, file)) ? JSON.parse(fs.readFileSync(path.join(HERE, file), "utf8")) : {};
for (const [key, w, h, scale, name] of SCREENS) for (const n of GRIDS) {
  const { browser, page, blocked } = await open(w, h, scale); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  await page.goto(origin + WALLS[n]);
  let lit = [], t0 = Date.now();
  const limit = MODE === "shots" ? 90000 : MODE === "probe" ? 6000 : 20000;
  while (Date.now() - t0 < limit) { await page.waitForTimeout(2000); lit = await drawnCharts(page); if (MODE !== "probe" && lit.length && lit.every((v) => v > 200) && Date.now() - t0 > 8000) break; }
  await page.waitForTimeout(MODE === "shots" ? 3000 : 1000);
  const m = await page.evaluate(measureInPage); m.errs = errs; m.blockedWrites = blocked(); m.chartsDrawn = lit.filter((v) => v > 200).length; m.waitMs = Date.now() - t0; m.url = WALLS[n];
  const id = `${key}|${n}`; res[id] = m;
  if (MODE === "shots") {
    await page.screenshot({ path: path.join(OUT, "shots", `deck-${key}-c${n}.png`) });
    if (n === 9) { const clip = { x: 0, y: Math.max(0, h - m.video.h - 300), width: Math.min(w, m.column.w + 260), height: Math.min(h, m.video.h + 300) };
      await page.screenshot({ path: path.join(OUT, "shots", `corner-${key}.png`), clip }); }
  }
  console.log(id, name, m.scene, "charts", m.chartsN, m.cols + "×" + m.rows, "charts", m.share.chartsArea + "%", "block", m.chartsBlock.w + "×" + m.chartsBlock.h, "one", m.chart0 && (m.chart0.w + "×" + m.chart0.h),
    "col", m.column.w, m.widthShare.column + "%w", "x", m.x.w + "×" + m.x.h, "yt", m.video && (m.video.w + "×" + m.video.h), "bar", m.videoBar, "pic", JSON.stringify(m.picture),
    "black", m.px.black, "gaps", JSON.stringify(m.gaps), "drawn", m.chartsDrawn + "/" + m.chartsN, "errs", errs.length, "blocked", m.blockedWrites);
  await browser.close(); fs.writeFileSync(path.join(HERE, file), JSON.stringify(res, null, 1));
}
server.close(); process.exit(0);
