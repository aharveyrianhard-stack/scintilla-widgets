/* X4 · one picture to compare by eye: the X bar TODAY (the deployed pane) above THE BUILD, at the iMac's pane size and
 * shown three times larger, with ⋯ open today to show where −30s lives now; then one press of −30s on the build, the
 * pane at the press and three seconds later, with the X page's scroll position before → after from the raw runs.
 * Headless: the layout is an HTML page photographed at 2x.
 * usage: node x4-compose.mjs --today today-4x --build build-4x --data <dir> --out <png> [--note "<what the eye sees>"] */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../..");
const SUPERVISOR = [process.env.X4_PLAYWRIGHT_FROM, path.resolve(REPO, "../visual-supervisor/package.json"), path.resolve(REPO, "../../visual-supervisor/package.json")]
  .find((p) => p && fs.existsSync(p));
const { chromium } = createRequire(SUPERVISOR)("playwright-core");
const DATA = path.resolve(args.get("data") || path.join(HERE, "../data"));
const OUT = path.resolve(args.get("out"));
const raw = (label) => JSON.parse(fs.readFileSync(path.join(DATA, label + "-raw.json"), "utf8"));
const today = raw(args.get("today") || "today-4x"), build = raw(args.get("build") || "build-4x");
const png = (file) => "data:image/png;base64," + fs.readFileSync(path.join(DATA, file)).toString("base64");
const box = (run, id) => run.bar.items.find((i) => i.id === id)?.box;
const px = (n) => Math.round(n * 100) / 100;
const r = build.rewind, k = build.keyboard, back = box(build, "bXBack"), refresh = box(build, "bXRefresh");
const moreEnd = (run) => px(box(run, "bXMore")[0] + box(run, "bXMore")[2]), fullAt = px(box(build, "bFull")[0]);
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#0a0a0f;color:#e8e8ee;font:14px/1.45 -apple-system,Helvetica,Arial,sans-serif;width:1180px;padding:24px}
  h1{font-size:20px;margin:0 0 4px} .lede{color:#9a9aa6;margin:0 0 18px}
  section{background:#111118;border:1px solid #26262f;border-radius:10px;padding:16px;margin-bottom:18px}
  h2{font-size:16px;margin:0 0 10px} h3{font-size:13px;margin:0 0 6px;letter-spacing:.06em;text-transform:uppercase;color:#9a9aa6}
  .bar{display:flex;gap:22px;align-items:flex-start;margin-bottom:16px} .bar img{width:765px;display:block;border:1px solid #333}
  .bar .t{width:340px;font-size:13px;color:#c6c8de} b{color:#00d4ff;font-weight:600}
  .press{display:flex;gap:16px;align-items:flex-start} figure{margin:0} .press img{width:255px;display:block;border:1px solid #333;background:#000}
  figcaption{color:#9a9aa6;font-size:12px;margin-top:6px} .num{flex:1;font-size:13px;color:#c6c8de} .num p{margin:0 0 9px} .dim{color:#9a9aa6;font-size:12px}
</style><h1>X4 · −30s on the X bar, where “60s” sat — today vs the build</h1>
<p class="lede">Headless on the MacBook: the real X bridge ${build.bridgeVersion} (the one on the iMac), a stand-in X feed, the pane at the iMac's size (${build.pane[0]} × ${build.pane[1]} under a ${build.bar.barBox[3]} px bar, 2×). The bars are shown three times larger.</p>
<section><h2>The bar</h2>
  <h3>Today — the deployed pane</h3>
  <div class="bar"><img src="${png(today.label + "-bar.png")}"><div class="t">↻ then <b>60s</b>: a label, not a button. It names a refresh every 60 seconds that the bridge has not done since 0.7.26. −30s is behind ⋯:</div></div>
  <div class="bar"><img src="${png(today.label + "-panel.png")}"><div class="t">⋯ open: <b>−30S</b> on the third row — two clicks to go back thirty seconds.</div></div>
  <h3>The build</h3>
  <div class="bar"><img src="${png(build.label + "-bar.png")}"><div class="t">↻ then <b>−30s</b>: a button, the same box and frame as ↻ (${back[2]} × ${back[3]}; ↻ is ${refresh[2]} × ${refresh[3]}); tooltip “back 30 seconds”. Tab from ↻ lands on it${k?.focusVisible ? " (with the focus ring)" : ""}; Enter presses it. “60s” is gone; the refresh choices (30 s / 60 s / 90 s) stay behind ⋯, unchanged. ⋯ sits where it did (its right edge at ${moreEnd(build)} px; today ${moreEnd(today)}; ⛶ starts at ${fullAt}).</div></div>
</section>
<section><h2>One press of −30s on the build — 4× (${build.pace.pxPerSecond} px/s measured)</h2>
  <div class="press">
    <figure><img src="${png(build.label + "-before.png")}"><figcaption>the moment −30s is pressed (the pointer on it)</figcaption></figure>
    <figure><img src="${png(build.label + "-after.png")}"><figcaption>three seconds later</figcaption></figure>
    <div class="num">
      <p>The X page's scroll position: <b>${r.scrollAtClick} px</b> at the press → <b>${r.minScrollTop} px</b> ${r.minAtMs} ms later: back <b>${r.movedBackPx} of the ${r.expectedPx} px</b> asked (thirty seconds at this pace), in one jump. Three seconds later the feed is ${r.netAfter3sPx} px above where it was pressed and carrying on at its pace.</p>
      ${args.get("note") ? `<p>${args.get("note")}</p>` : ""}
      <p>One click. The press left the pane ${r.leftThePane}× and reached the bridge ${r.reachedTheBridge}×. From the keyboard (Tab, Enter): ${k ? k.enterLeftThePane + "× and " + k.enterReachedTheBridge + "×" : "not measured"}.</p>
      <p>Today the same rewind takes two clicks (⋯, then −30S): back ${today.rewind.movedBackPx} of ${today.rewind.expectedPx} px.</p>
      <p class="dim">Unchanged: the crop the bridge sends, ${build.crop.join(", ").replace(/, (\d+), (\d+)$/, ", $1 × $2")} (today ${today.crop.join(", ").replace(/, (\d+), (\d+)$/, ", $1 × $2")}); the pace; the bridge. Pane today sha256 ${today.shellSha256}…, build ${build.shellSha256}…; bridge content.js ${build.bridgeContentSha256}….</p>
    </div>
  </div>
</section>`;
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1228, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html); await page.waitForTimeout(300);
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log("wrote", OUT);
