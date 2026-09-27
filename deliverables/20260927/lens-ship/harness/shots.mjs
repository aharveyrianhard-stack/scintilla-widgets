/* SCINTILLA · CL4 lens ship · the real deck photographed headless, BEFORE (c8deb69, the live code) and
   AFTER (this branch). Alan's screen is never used: headless Chromium only, closed at the end.
   usage: node shots.mjs <before-tree> [--only after]
   Writes screens/*.png and screens/shots.json. */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, proxyApi, refuseOutside, newTally } from "./serve.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AFTER_ROOT = path.resolve(HERE, "../../../..");
const BEFORE_ROOT = process.argv[2];
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const OUT = path.join(HERE, "..", "screens");
fs.mkdirSync(OUT, { recursive: true });
const PAGES = [["mag7", "MAG 7"], ["ai1", "AI 1 · CHIPS"], ["blueChip3D", "BLUE CHIP"], ["mainIndexes3D", "SPY + QQQ"]];
const FOUR = ["NVDA", "MU", "WMT", "PLTR"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* the 4-up harness page: four real chart panes at the deck's own 4-up pane size, nothing else */
const GRID = `<!doctype html><meta charset="utf-8"><title>4-up</title><style>html,body{margin:0;background:#0A0A0F}
#g{display:grid;gap:6px;padding:6px}iframe{border:0;display:block;background:#0A0A0F}</style><div id="g"></div><script>
const q=new URLSearchParams(location.search),w=+q.get("w"),h=+q.get("h"),b=q.get("bubble");
const g=document.getElementById("g");g.style.gridTemplateColumns="repeat(2,"+w+"px)";
for(const t of ${JSON.stringify(FOUR)}){const f=document.createElement("iframe");f.width=w;f.height=h;
f.src="/station-shells/chart-v1?shell=v1&bare=1&t="+t+"&range=3D&view=auto"+(b?"&bubble="+encodeURIComponent(b):"");g.appendChild(f);}
</script>`;

const browser = await playwright.chromium.launch({ headless: true });
const results = [];

async function paneStates(page) {
  const out = [];
  for (const f of page.frames()) {
    if (!/chart-v1/.test(f.url())) continue;
    const s = await f.evaluate(() => {
      const host = document.querySelector("#chartSlot .sc-nchart"), area = host && host.querySelector(".sc-nchart__area");
      const cv = host && host.querySelector(".sc-nchart__lens");
      const shown = cv && cv.style.display !== "none";
      return host ? { t: host.dataset.t, range: host._range, series: host._series ? host._series.length : 0,
        pane: area ? [area.clientWidth, area.clientHeight] : null,
        lens: shown ? { x: parseFloat(cv.style.left), y: parseFloat(cv.style.top), w: parseFloat(cv.style.width), h: parseFloat(cv.style.height),
          state: host.dataset.lensState, why: host.dataset.lensWhy, label: cv.getAttribute("aria-label"),
          fallback: host._lens && host._lens.fallback, through: host._lens && host._lens.through, bars: host._lens && host._lens.bars } : null,
        lensWhy: shown ? null : host.dataset.lensWhy || null, bubbleParam: new URLSearchParams(location.search).get("bubble") } : null;
    }).catch(() => null);
    if (s && f.isDetached && !f.isDetached()) {
      const el = await f.frameElement().catch(() => null);
      const box = el ? await el.boundingBox() : null;
      if (box && box.width > 20) out.push({ ...s, frame: box });
    }
  }
  return out;
}
async function waitCharts(page, want, withLens, maxMs = 80000) {
  const t0 = Date.now();
  let st = [];
  while (Date.now() - t0 < maxMs) {
    st = await paneStates(page);
    const drawn = st.filter((s) => s.series >= 2).length;
    const lensDone = st.filter((s) => s.lens || s.lensWhy).length;
    if (drawn >= want && (!withLens || lensDone >= drawn)) break;
    await sleep(2000);
  }
  await sleep(2500);
  return { states: await paneStates(page), waitedS: Math.round((Date.now() - t0) / 1000) };
}

async function shoot(tree, root, width, height, url, name, want, withLens) {
  const { server, base } = await serve(root);
  if (url.startsWith("GRID")) fs.writeFileSync(path.join(root, "__grid4.html"), GRID);
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  const tally = newTally();
  await proxyApi(ctx, tally); await refuseOutside(ctx, base);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const target = url.startsWith("GRID") ? "/__grid4.html" + url.slice(4) : url;
  await page.goto(base + target, { waitUntil: "load", timeout: 60000 });
  const { states, waitedS } = await waitCharts(page, want, withLens);
  const file = `${name}-${tree}.png`;
  await page.screenshot({ path: path.join(OUT, file) });
  /* a big close-up of the first pane, where the bubble sits */
  const first = states.slice().sort((a, b) => a.frame.y - b.frame.y || a.frame.x - b.frame.x)[0];
  let crop = null;
  if (first) {
    crop = `${name}-${tree}-pane1.png`;
    await page.screenshot({ path: path.join(OUT, crop), clip: { x: first.frame.x, y: first.frame.y, width: first.frame.width, height: first.frame.height } });
  }
  const row = { tree, name, url: target, viewport: `${width}x${height}`, file, crop, waitedS, api: tally, errors: errors.slice(0, 4),
    panes: states.map(({ frame, ...s }) => ({ ...s, frame: [Math.round(frame.width), Math.round(frame.height)] })) };
  results.push(row);
  const withBubble = row.panes.filter((p) => p.lens).length;
  console.log(`${tree.padEnd(6)} ${name.padEnd(22)} panes ${row.panes.length} drawn ${row.panes.filter((p) => p.series >= 2).length} lens ${withBubble} · api ${tally.calls} (30m reads ${tally.byTf["30"] || 0}) · ${waitedS}s${errors.length ? " · ERR " + errors[0] : ""}`);
  for (const p of row.panes) if (p.lens || p.lensWhy) console.log(`        ${String(p.t).padEnd(6)} pane ${p.pane} lens ${p.lens ? `${p.lens.w}x${p.lens.h} @${p.lens.x},${p.lens.y} ${p.lens.state} ${p.lens.why} thru ${p.lens.through}` : "none: " + p.lensWhy}`);
  await ctx.close();
  if (url.startsWith("GRID")) fs.rmSync(path.join(root, "__grid4.html"), { force: true });
  server.close();
  return row;
}

/* the deck's own 4-up pane size, measured on a four-slot page (MACRO · 4H) of the AFTER tree */
let four = { w: 834, h: 470 };
{
  const { server, base } = await serve(AFTER_ROOT);
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  await refuseOutside(ctx, base);
  await ctx.route("**://scintilla-massive-chart-api.fly.dev/**", (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(base + "/deck/index.html?scene=macroIntraday", { waitUntil: "load" });
  await sleep(4000);
  const boxes = [];
  for (const f of page.frames()) if (/chart-v1/.test(f.url())) { const el = await f.frameElement().catch(() => null); const b = el && await el.boundingBox(); if (b && b.width > 20) boxes.push(b); }
  if (boxes.length >= 4) four = { w: Math.round(boxes[0].width), h: Math.round(boxes[0].height) };
  console.log(`deck 4-up pane measured: ${four.w} x ${four.h} (from ${boxes.length} frames)`);
  await ctx.close(); server.close();
}

const trees = [["before", BEFORE_ROOT], ["after", AFTER_ROOT]].filter(([t]) => !ONLY || t === ONLY);
for (const [tree, root] of trees) {
  for (const [id, label] of PAGES)
    await shoot(tree, root, 1680, 1050, `/deck/index.html?scene=${id}`, `deck-${id}-1680`, id === "mainIndexes3D" ? 2 : 8, tree === "after");
  await shoot(tree, root, 1680, 1050, `GRID?w=${four.w}&h=${four.h}${tree === "after" ? "&bubble=30m:3" : ""}`, "grid-4up-1680", 4, tree === "after");
  await shoot(tree, root, 390, 844, `/deck/index.html?scene=mag7`, "deck-mag7-390", 2, tree === "after");
}
await browser.close();
fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify({ taken_utc: new Date().toISOString(), four_up_pane: four,
  method: "headless Chromium (playwright-core), deviceScaleFactor 2; chart API proxied GET-only with Origin https://scintillahub.ai; every other outside request refused; deck rotation paused in the test browser's own storage",
  results }, null, 1));
console.log("done");
