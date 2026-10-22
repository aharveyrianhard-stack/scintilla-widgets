// Y9: the picture. Real pixels only: today's wall beside SIMPLE at 1728 × 1117 and 1512 × 982, and the symbol box in use.
//   node picture.mjs   (reads ../measure/y9-measure.json and ../shots, writes ../Y9-SIMPLE-WALL.png)
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), Y9 = path.resolve(HERE, "..");
const m = JSON.parse(fs.readFileSync(path.join(Y9, "measure/y9-measure.json"), "utf8"));
const img = (f) => "data:image/png;base64," + fs.readFileSync(path.join(Y9, "shots", f)).toString("base64");
const s1728 = m.screens.find((s) => s.screen === "1728x1117"), s1512 = m.screens.find((s) => s.screen === "1512x982");
const t1728 = m.todayShots.find((s) => s.screen === "1728x1117"), t1512 = m.todayShots.find((s) => s.screen === "1512x982");
const PW = 1060;   /* each panel's width in the picture */
const panel = (file, W, H, cap) => { const k = PW / W; return `<div class="p"><div class="cap">${cap}</div><div class="frame" style="width:${PW}px;height:${Math.round(H * k)}px;background:url(${img(file)}) no-repeat;background-size:${PW}px ${Math.round(H * k)}px"></div></div>`; };
/* the symbol box: chart 1's top-left, at 1728, cut at 2x */
const sym = (() => { const W = 1728, H = 1117, cw = 620, ch = 300, k = 1.6; const b = s1728.boot; const x = b.charts[0].box.x, y = b.charts[0].box.y;
  return `<div class="p"><div class="cap"><b>the symbol box in use</b> · chart 1's own badge opens the box, the Hub's suggestions under it; Enter sets the chart and this machine remembers it (measured: ${s1728.symbol.after.tickers[0]}, stored station.simple.chart.1 = ${s1728.symbol.after.stored.c1})</div><div class="frame" style="width:${cw * k}px;height:${ch * k}px;background:url(${img("y9-simple-symbol-1728x1117.png")}) no-repeat;background-size:${W * k}px ${H * k}px;background-position:${-x * k}px ${-y * k}px"></div></div>`; })();
const v = (s) => s.boot.video.box, tv = (t) => t.video;
const facts = [
  ["the mode", "WALL · SIMPLE on the dock, beside CHARTS ONLY; remembered on this machine (localStorage station.simple). SIMPLE by itself on a screen 1800 px wide or less (the MacBooks); the WALL on the iMac (measured: screen 2560 → WALL, nothing stored)"],
  ["the layout", `X keeps its 24 % column top to bottom. Right of it: two charts (slots 1 and 2; the page's other slots stay mounted, hidden) over the YouTube pane across the whole width, 60/40, the tapes between them. At 1728 × 1117 the pane is ${v(s1728).w} × ${v(s1728).h}; at 1512 × 982, ${v(s1512).w} × ${v(s1512).h}. Today's block there: ${tv(t1728).w} × ${tv(t1728).h} and ${tv(t1512).w} × ${tv(t1512).h}`],
  ["nothing moves by itself", `1728 → 1440 → 1728 in 32 px steps: ${s1728.resize.distinctLayouts} layout (${s1728.resize.steps.length} readings) - the column a share, the split a share. Today's wall over the same sweep: the six-chart grid flips 3 × 2 → 2 × 3 at 1408 px and the pane's box with it (716 × 535 → 1069 × 356); the two-chart wall (the default count) is a full-height strip that flips to a stacked pair at 1408 px`],
  ["the symbols", `typed into the chart panes' own boxes (Enter), remembered under station.simple.chart.1/2, put back whenever SIMPLE comes on and at boot; a reload brought back ${s1728.reload.tickers[0]} (measured)`],
  ["the handle", `the seam between the rows drags; the split is remembered (station.simple.split${s1728.handle ? " = " + s1728.handle.stored.split + " after a 120 px drag, measured" : ""}). No rotation in SIMPLE (the button says so); CHARTS ONLY, a chart solo, ⛶ and the Y8 float work as before`],
  ["the sound", "the first tap anywhere on the YouTube pane turns the sound on at the session's last volume (sessionStorage station.sound); the bar says MUTED · TAP FOR SOUND while the browser holds it off. See the RETURN for what the headless probe found"],
];
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0A0A0F;color:#F2F2F8;font:16px "SF Mono",Menlo,monospace;width:2260px;padding:28px 34px;box-sizing:border-box}
h1{font-size:30px;margin:0 0 4px;letter-spacing:.02em} .sub{color:#9A9AB6;font-size:16px;margin-bottom:22px}
.row{display:flex;gap:34px;align-items:flex-start;margin-bottom:26px} .cap{color:#00D4FF;font-size:16px;margin:0 0 8px;letter-spacing:.04em;max-width:${PW}px}
.cap b{color:#F2F2F8;font-weight:600} .frame{position:relative;border:1px solid #1A1A2A}
.facts{display:grid;grid-template-columns:200px 1fr;gap:8px 18px;font-size:15px;line-height:1.45;margin-top:6px} .facts .k{color:#00D4FF;letter-spacing:.06em;text-transform:uppercase;font-size:13px;padding-top:2px}
</style><body>
<h1>Y9 · the SIMPLE wall for the MacBook</h1>
<div class="sub">two charts Alan sets by hand on top · YouTube across the bottom · X in its column · nothing moves by itself · measured headless on the real deck, ${m.at.slice(0, 16).replace("T", " ")} UTC · branch station/y9-simple-wall-20261021 on Y8</div>
<div class="row">${panel("y9-today-1728x1117.png", 1728, 1117, "<b>today (@3447276, Y7) at 1728 × 1117</b> · nine charts, the pane in a 2 × 2 block of the grid")}${panel("y9-simple-1728x1117.png", 1728, 1117, "<b>SIMPLE at 1728 × 1117</b> · two charts, the pane across the bottom, X's column")}</div>
<div class="row">${panel("y9-today-1512x982.png", 1512, 982, "<b>today at 1512 × 982</b>")}${panel("y9-simple-1512x982.png", 1512, 982, "<b>SIMPLE at 1512 × 982</b>")}</div>
<div class="row">${sym}<div class="facts">${facts.map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`).join("")}</div></div>
</body>`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 2260, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html); await page.waitForTimeout(500);
await page.screenshot({ path: path.join(Y9, "Y9-SIMPLE-WALL.png"), fullPage: true });
await browser.close(); console.log("wrote", path.join(Y9, "Y9-SIMPLE-WALL.png"));
