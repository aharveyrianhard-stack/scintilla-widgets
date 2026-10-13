/* X1 · one picture a non-technical person can compare by eye: the X column TODAY (bridge 0.7.21 + the deployed pane)
 * beside THE BUILD (bridge 0.7.25 + this branch's pane), three moments each, with the two numbers the brief asks for
 * under each side. Headless: the layout is an HTML page photographed at 2x.
 * usage: node x1-compose.mjs --pace 1x --today <label> --build <label> --data <dir> --out <png> */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(args.get("data") || path.join(HERE, "../data"));
const OUT = path.resolve(args.get("out"));
const PACE = args.get("pace") || "1x";
const raw = (label) => JSON.parse(fs.readFileSync(path.join(DATA, label + "-raw.json"), "utf8"));
const today = raw(args.get("today")), build = raw(args.get("build"));
const png = (file) => "data:image/png;base64," + fs.readFileSync(path.join(DATA, file)).toString("base64");

/* "the text size": pane CSS px per source CSS px, from the draw the pane really made (dw / ratio) over the crop it was given */
function textScale(run) {
  const f = run.frames.at(-1), ratio = Math.min(1.25, f.paneDpr || 1);
  return (f.draw.dw / ratio) / f.rect.width;
}
/* blank pixels: canvas pixels outside the drawn picture (dx, 0, dw, dh in a cw × ch canvas), from the real draw */
function blank(run) {
  const d = run.frames.at(-1).draw;
  return Math.max(0, Math.round(d.cw * d.ch - Math.min(d.cw, d.dw) * Math.min(d.ch, d.dh)));
}
const moved = (run) => run.frames.at(-1).xScrollTop - run.frames[0].xScrollTop;
const tToday = textScale(today), tBuild = textScale(build);
const summary = {
  pace: PACE, speedAsked: build.speedAsked,
  today: { bridge: today.bridgeVersion, shell: today.shell, crop: today.frames.at(-1).rect, draw: today.frames.at(-1).draw, textScale: +tToday.toFixed(4), blank: blank(today), movedPx: moved(today), seconds: today.frames.at(-1).at, bar: today.frames.at(-1).every, capture: today.capture, speedReported: today.frames.at(-1).speed },
  build: { bridge: build.bridgeVersion, shell: build.shell, crop: build.frames.at(-1).rect, draw: build.frames.at(-1).draw, textScale: +tBuild.toFixed(4), blank: blank(build), movedPx: moved(build), seconds: build.frames.at(-1).at, bar: build.frames.at(-1).every, capture: build.capture, speedReported: build.frames.at(-1).speed },
};
summary.textChangePct = +((tBuild / tToday - 1) * 100).toFixed(1);
summary.leftEdgeToday = today.frames.at(-1).rect.left; summary.leftEdgeBuild = build.frames.at(-1).rect.left;
fs.writeFileSync(OUT.replace(/\.png$/, ".json"), JSON.stringify(summary, null, 1));

const frameW = 255, frameH = 479;
const col = (title, sub, run, lines) => `
  <section>
    <h2>${title}</h2><p class="sub">${sub}</p>
    <div class="frames">${run.frames.map((f) => `<figure><img src="${png(f.file)}" width="${frameW}" height="${frameH}"><figcaption>${f.at < 0.5 ? "now" : "after " + Math.round(f.at) + " s"}</figcaption></figure>`).join("")}</div>
    <ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
  </section>`;
const sign = (n) => (n > 0 ? "+" : "") + n;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#0b0d12;color:#e7e9ea;font:14px/1.45 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:22px 26px 26px;width:1720px;box-sizing:border-box}
  h1{font-size:22px;margin:0 0 4px;font-weight:600} .lead{color:#9aa0ad;margin:0 0 18px}
  .cols{display:flex;gap:34px;align-items:flex-start}
  section{flex:1 1 0;background:#12151c;border:1px solid #262a35;border-radius:12px;padding:16px 18px 14px}
  h2{font-size:17px;margin:0 0 2px;font-weight:600} .sub{color:#9aa0ad;margin:0 0 12px;font-size:13px}
  .frames{display:flex;gap:14px} figure{margin:0;flex:none} img{display:block;border:1px solid #2a2f3b;border-radius:4px;background:#000}
  figcaption{color:#9aa0ad;font-size:12px;text-align:center;margin-top:5px}
  ul{margin:12px 0 0;padding-left:18px} li{margin:3px 0} b{color:#fff;font-weight:600} .ok{color:#6fe3a1} .warn{color:#ffb86b}
  .foot{color:#6f7585;font-size:12px;margin-top:14px}
</style></head><body>
<h1>The X column on the iMac — today beside the build, at ${PACE} (${build.speedAsked ?? 3} px a second)</h1>
<p class="lead">Same window, same pane, same capture: X window ${build.xWindowFed.innerWidth} × ${build.xWindowFed.innerHeight} captured at ${build.capture.width} × ${build.capture.height}, the pane 255 × 450 at 2×. The three pictures of each side are the same pane photographed ${Math.round(build.every)} seconds apart, so the distance the posts travel is the pace. Headless, on a stand-in of x.com (x.com refuses an automated browser); the bridge and the pane are the real code.</p>
<div class="cols">
${col("TODAY", `bridge ${today.bridgeVersion} · the Station as deployed · the bar says <b>${today.frames.at(-1).every}</b> beside ↻`, today, [
  `The crop the bridge sends: text from <b>${today.frames.at(-1).rect.left}</b>, ${today.frames.at(-1).rect.width} wide`,
  `In ${Math.round(today.frames.at(-1).at)} s the feed moved <b>${moved(today)} px</b> on the X page`,
])}
${col("THE BUILD", `bridge ${build.bridgeVersion} · this branch · the bar says <b>${build.frames.at(-1).every}</b> beside ↻`, build, [
  `The crop the bridge sends: text from <b>${build.frames.at(-1).rect.left}</b> (same left edge), ${build.frames.at(-1).rect.width} wide (${sign(build.frames.at(-1).rect.width - today.frames.at(-1).rect.width)} px, on the right only)`,
  `<b>Text size change: <span class="${Math.abs(summary.textChangePct) <= 8 ? "ok" : "warn"}">${sign(summary.textChangePct)}%</span></b> (target 0, within 8%)`,
  `<b>Blank pixels: <span class="${summary.build.blank === 0 ? "ok" : "warn"}">${summary.build.blank}</span></b> (target 0) — today's pane kept a 4 px black margin each side (${summary.today.blank} px), invisible on a black X`,
  `In ${Math.round(build.frames.at(-1).at)} s the feed moved <b>${moved(build)} px</b> on the X page`,
])}
</div>
<p class="foot">Made ${new Date().toISOString().slice(0, 16).replace("T", " ")}Z by deliverables/20261012/x1/tools (x1-pictures.mjs, x1-compose.mjs). Nothing was installed anywhere.</p>
</body></html>`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1720, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "load" });
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log(JSON.stringify({ out: path.basename(OUT), textChangePct: summary.textChangePct, blank: [summary.today.blank, summary.build.blank], moved: [summary.today.movedPx, summary.build.movedPx], crops: [summary.today.crop, summary.build.crop] }));
