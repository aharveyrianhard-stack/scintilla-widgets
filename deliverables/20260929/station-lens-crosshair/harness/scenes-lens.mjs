// Headless only. node scenes-lens.mjs <root> <out.json> [--wait=15000] [--scenes=a,b]
// Opens every one of the 27 scenes on the deck (rotation paused) and reads each visible chart pane:
// its range, the lens it asked for, whether a lens is drawn, fresh/stale, why not, and the lens's newest
// price against the badge's live price.
import fs from "node:fs";
import { serve, open } from "./rig.mjs";
const [root, outFile, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
export const SCENES = ["wkIndexes","wkMacro","targets3D","sectors3D","mainIndexes3D","mag7","ai1","ai2","ai3","other3D","blueChip3D",
  "spyQqq1D","otherIndexes1D","otherIndexesOsc","macro1D","targets1D","targetsOsc","macroIntraday","intraday4h","intraday1h","intraday30m",
  "scintillas","companyLeadership","focus2","macroCrossAsset","internalsFast","todo"];
const list = opt.scenes ? opt.scenes.split(",") : SCENES;
const { server, origin } = await serve(root);
const { browser, context } = await open({ width: 1680 });
const out = [];
try {
  for (const scene of list) {
    const page = await context.newPage();
    const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
    await page.goto(`${origin}/deck/index.html?scene=${scene}`);
    await page.waitForTimeout(+(opt.wait || 15000));
    const panes = [];
    for (const f of page.frames()) {
      try {
        const r = await f.evaluate(() => {
          const h = document.querySelector(".sc-nchart"); if (!h) return null;
          const fe = window.frameElement;
          if (fe) { const cs = getComputedStyle(fe); if (cs.opacity === "0" || cs.visibility === "hidden" || !fe.offsetWidth || fe.classList.contains("slot-next") || fe.classList.contains("slot-spare")) return null; }
          const cv = h.querySelector(".sc-nchart__lens");
          const q = typeof liveQuote !== "undefined" ? liveQuote[h.dataset.t] : null;
          return { t: h.dataset.t, range: typeof S !== "undefined" ? S.chartRange : null, bubble: typeof BUBBLE_REQUEST !== "undefined" ? BUBBLE_REQUEST : null,
            drawn: !!(cv && cv.style.display === "block"), state: h.dataset.lensState || null, why: h.dataset.lensWhy || null,
            key: h._lens ? h._lens.key : null, last: h._lens && h._lens.last != null ? h._lens.last : null,
            quote: q ? q.price : null, forming: h._lens ? h._lens.forming || null : null };
        });
        if (r) panes.push(r);
      } catch (_) {}
    }
    const row = { scene, panes: panes.length, withLens: panes.filter((p) => p.drawn).length, stale: panes.filter((p) => p.state === "stale").map((p) => p.t),
      mismatched: panes.filter((p) => p.drawn && p.last != null && p.quote != null && Math.abs(p.last - p.quote) > 1e-9).map((p) => `${p.t} ${p.last} vs ${p.quote}`),
      detail: panes, errs };
    out.push(row);
    console.log(`${scene.padEnd(18)} panes ${row.panes}  lens ${row.withLens}  stale [${row.stale}]  mismatched [${row.mismatched}]  ${panes.filter((p) => !p.drawn).map((p) => p.t + ":" + (p.why || "no request")).join(" | ")}`);
    await page.close();
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), root, scenes: out }, null, 1));
