/* X3 · one picture a non-technical person can compare by eye: the X column the moment −30s is pressed and three
 * seconds later, TODAY (bridge 0.7.26) beside THE BUILD (0.7.27), with the numbers from the raw runs under each.
 * Headless: the layout is an HTML page photographed at 2x.
 * usage: node x3-compose.mjs --pace 4x --today <label> --build <label> --data <dir> --out <png> */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(args.get("data") || path.join(HERE, "../data"));
const OUT = path.resolve(args.get("out"));
const PACE = args.get("pace") || "4x";
const raw = (label) => JSON.parse(fs.readFileSync(path.join(DATA, label + "-raw.json"), "utf8"));
const today = raw(args.get("today")), build = raw(args.get("build"));
const png = (file) => "data:image/png;base64," + fs.readFileSync(path.join(DATA, file)).toString("base64");
const side = (run, title, note) => `
  <section><h2>${title}</h2><p class="sub">bridge ${run.bridgeVersion} · the deployed pane · ${PACE} (${run.pace.pxPerSecond} px/s measured)</p>
    <div class="row"><figure><img src="${png(run.label + "-before.png")}"><figcaption>the moment −30s is pressed</figcaption></figure>
    <figure><img src="${png(run.label + "-after.png")}"><figcaption>three seconds later</figcaption></figure></div>
    <p class="num">asked for <b>${run.rewind.expectedPx} px</b> back (30 s at this pace) · went back <b>${run.rewind.movedBackPx} px</b> · three seconds later the feed is <b>${run.rewind.netAfter3sPx} px</b> above where it was pressed</p>
    <p class="note">${note}</p></section>`;
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#0a0a0f;color:#e8e8ee;font:14px/1.45 -apple-system,Helvetica,Arial,sans-serif;width:1180px;padding:24px}
  h1{font-size:20px;margin:0 0 4px} .lede{color:#9a9aa6;margin:0 0 18px}
  .two{display:flex;gap:24px} section{flex:1;background:#111118;border:1px solid #26262f;border-radius:10px;padding:16px}
  h2{font-size:16px;margin:0 0 2px} .sub{color:#9a9aa6;margin:0 0 12px;font-size:12px}
  .row{display:flex;gap:16px} figure{margin:0;flex:1} img{width:255px;display:block;border:1px solid #333;background:#000}
  figcaption{color:#9a9aa6;font-size:12px;margin-top:6px} .num{margin:14px 0 6px} b{color:#00d4ff} .note{color:#9a9aa6;font-size:12px;margin:0}
</style><h1>X3 · the −30s button on the X column, before and after</h1>
<p class="lede">Headless on the MacBook with the real bridge and the pane that is deployed, a stand-in X feed, at the iMac's sizes. The pointer is on the button both times.</p>
<div class="two">${side(today, "Today (0.7.26)", "the glide back is cut off by the bridge's own next scroll step, so the feed barely moves and then carries on down")}${side(build, "The build (0.7.27)", "an instant jump of thirty seconds of feed; then the slow scroll carries on from there")}</div>`;
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1228, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html); await page.waitForTimeout(300);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log("wrote", OUT);
