/* node sheet.mjs <out.jpg> <title> <beforeDir> <beforeResults> <afterDir> <afterResults> <to> <index-of-transition-with-that-name-in-lap-2>
   Renders a before/after contact sheet (frames every 100 ms) in headless Chromium. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [OUT, TITLE, BDIR, BRES, ADIR, ARES, TO, IDX] = process.argv.slice(2);
const pick = (file) => JSON.parse(fs.readFileSync(file, "utf8")).results.filter((r) => r.pass === 2 && r.to === TO)[+IDX || 0];
const row = (label, dir, r) => {
  const tiles = r.marks.map((m) => {
    const img = fs.readFileSync(path.join(dir, String(m.ms).padStart(4, "0") + ".jpg")).toString("base64");
    const bad = m.empty > 0;
    return `<figure><img src="data:image/jpeg;base64,${img}"><figcaption><b>+${m.ms} ms</b><span class="${bad ? "bad" : ""}">${m.empty} empty · ${m.ok} drawn</span></figcaption></figure>`;
  }).join("");
  return `<section><h2>${label}<small>${r.emptyPaneFrames} empty pane-frames in 1.6 s · last empty at +${r.emptyUntilMs} ms · ${r.paints} paints</small></h2><div class="grid">${tiles}</div></section>`;
};
const html = `<!doctype html><html><head><style>
body{margin:0;background:#0c0c10;color:#c8c8cc;font:12px Menlo,monospace;padding:14px;width:1652px}
h1{font-size:15px;margin:0 0 10px;color:#d2d2d2;letter-spacing:.04em}
h2{font-size:13px;margin:12px 0 6px;color:#d2d2d2} h2 small{margin-left:12px;color:#8a8a90;font-weight:400}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
figure{margin:0;background:#15151a;border:1px solid #26262c} img{width:100%;display:block}
figcaption{display:flex;justify-content:space-between;padding:3px 5px;font-size:11px} .bad{color:#c8953a}
</style></head><body><h1>${TITLE}</h1>${row("BEFORE (e9b4768, live code)", BDIR, pick(BRES))}${row("AFTER (this branch)", ADIR, pick(ARES))}</body></html>`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 900 } });
await page.setContent(html);
await page.screenshot({ path: OUT, fullPage: true, type: "jpeg", quality: 82 });
await browser.close();
console.log("wrote", OUT);
