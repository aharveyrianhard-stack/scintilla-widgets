// S12 (5 Oct 2026): the X pane's right edge and the YouTube control row, measured on the real deck in a hidden browser.
//   node s12.mjs before|after [screen]
// Same rig as S11 (headless Chromium, every non-GET request aborted, the chart API fetched by node with the scintillahub.ai
// origin). The X capture is a STAND-IN: x-standin.html plays the x.com tab at 1792 × 1080 (the frame size the one live
// health row reports today), its picture is fed to the real X shell as a MediaStream through the shell's own
// attachXFloatStream(), and the crop rectangle is computed by the X Bridge's own calculateCropRect() run on the stand-in's
// DOM. So the pane draws exactly what it would draw on a real capture of that window; only the pixels are a stand-in.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = process.env.S12_ROOT || path.resolve(HERE, "../../../.."), OUT = path.resolve(HERE, "../shots");
/* S12_ROOT: serve another checkout (the live SHA, archived) so "before" is measured on the code that is live, not on this branch */
const TAG = process.argv[2] || "before", ONLY = process.argv[3];
const buildSrc = fs.readFileSync(path.join(ROOT, "deliverables/20261003/station-floorplan-build/harness/build.mjs"), "utf8");
const measureSrc = buildSrc.match(/function measureInPage\(\) \{[\s\S]*?\n\}/)[0];
/* the bridge's crop rectangle, lifted from its source so the stand-in is cropped by the real rule */
const bridge = fs.readFileSync(path.join(ROOT, "station-x-bridge-draft/content.js"), "utf8");
const lift = (name) => { const m = bridge.match(new RegExp("\\n  function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}")); if (!m) throw new Error("no " + name); return m[0]; };
const cropSrc = ["const session = { settings: { hideFeedTabs: true } };", lift("elementLabel"), lift("findPrimaryColumn"), lift("findFeedTabsBottom"), lift("findInnerContentLeft"), lift("calculateCropRect")].join("\n");
const SCREENS = [["1680x1050", 1680, 1050, 2, "MacBook"], ["1920x1080", 1920, 1080, 1, "Apple TV"], ["2560x1440", 2560, 1440, 1, "External"], ["1167x662", 1167, 662, 2, "iMac window (as reported)"]]
  .filter((s) => !ONLY || ONLY === "all" || s[0] === ONLY);
const NINE = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT", "SPY"];
const WALL = "/deck/?scene=live&charts=9&range=3D&" + NINE.map((t, i) => "c" + (i + 1) + "=" + t).join("&");
const STANDIN = { w: 1792, h: 1080 };
async function open(browser, w, h, scale, mobile = false) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile });
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
const frameOf = async (page, key) => (await page.$('#rowBot > .pane[data-key="' + key + '"] iframe')).contentFrame();
/* THE STAND-IN, fed to the real X shell: the picture as a stream, the crop as the bridge would post it */
async function feedStandIn(xf, pngUrl, crop) {
  return xf.evaluate(async ({ pngUrl, crop, w, h }) => {
    const img = new Image(); img.src = pngUrl; await img.decode();
    const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d");
    const paint = () => { ctx.drawImage(img, 0, 0, w, h); };
    paint(); const ms = c.captureStream(10); window.__standin = setInterval(paint, 100);
    await attachXFloatStream(ms);
    window.postMessage({ type: "XFF_STATION_CROP", crop: Object.assign({ fractionalScrollOffset: 0, captureGeneration: 1, sequence: 1, activeView: "trading", paused: false,
      sourceCropped: false, sourceCropSupported: false, elementCaptureSupported: false, viewportDpr: 1, source: { browser: "stand-in", machine: "headless" } }, crop) }, location.origin);
    await new Promise((r) => setTimeout(r, 1500));
    return { video: el("v").videoWidth + "×" + el("v").videoHeight, xfloat: document.body.classList.contains("xfloat") };
  }, { pngUrl, crop, w: STANDIN.w, h: STANDIN.h });
}
/* WHAT THE X PANE SHOWS: the source region the shell chose, how it is drawn, and what of the stand-in's post lands in it */
function measureX(mock) {
  const video = el("v"), host = el("body"), canvas = el("cv"), crop = xfloatCrop;
  const region = stationSourceRegion(video, crop), fit = region.fit;
  const ratio = Math.min(1.25, devicePixelRatio || 1);
  const tw = Math.max(280, Math.round(host.clientWidth * ratio)), th = Math.max(220, Math.round(host.clientHeight * ratio));
  const padCss = Math.max(4, Math.min(8, host.clientWidth * .015)), pad = Math.round(padCss * ratio);
  const readable = xfloatExpanded ? Math.max(1, Math.min(host.clientWidth - padCss * 2, Math.max(420, host.clientHeight * 2.15), 540)) : Math.max(1, host.clientWidth - padCss * 2);
  const dw = Math.max(1, Math.round(readable * ratio)), dx = Math.max(pad, Math.round((tw - dw) / 2)), s2d = dw / region.sw;
  /* the lit span of the canvas, read back: black padding left and right, in css px */
  let litL = -1, litR = -1; try { const d = canvas.getContext("2d").getImageData(0, 0, tw, th).data; for (let y = 0; y < th; y += 6) for (let x = 0; x < tw; x++) { const i = (y * tw + x) * 4; if (d[i] + d[i + 1] + d[i + 2] > 30) { if (litL < 0 || x < litL) litL = x; if (x > litR) litR = x; } } } catch (_) {}
  /* the stand-in's post geometry, mapped the same way: which of it lands in the pane */
  const srcCssLeft = (region.sx - fit.offsetX) / fit.scale, srcCssRight = (region.sx + region.sw - fit.offsetX) / fit.scale;
  const cssPerPanePx = (region.sw / fit.scale) / (dw / ratio);
  return {
    pane: { w: host.clientWidth, h: host.clientHeight }, canvas: { w: tw, h: th }, video: { w: video.videoWidth, h: video.videoHeight }, expanded: xfloatExpanded, wholeFrame: !!stationFullFrame, wholeFrameWhy: stationWholeFrameWhy,
    crop: crop && { left: +crop.rect.left.toFixed(1), top: +crop.rect.top.toFixed(1), width: +crop.rect.width.toFixed(1), height: +crop.rect.height.toFixed(1), viewport: crop.viewport },
    fit: fit && { scale: +fit.scale.toFixed(4), offsetX: Math.round(fit.offsetX), offsetY: Math.round(fit.offsetY) },
    region: { sx: Math.round(region.sx), sy: Math.round(region.sy), sw: Math.round(region.sw), shAvailable: Math.round(region.shAvailable), usable: region.usable },
    draw: { padCss: +padCss.toFixed(1), dx, dw, dxCss: +(dx / ratio).toFixed(1), dwCss: +(dw / ratio).toFixed(1), rightPadCss: +((tw - dx - dw) / ratio).toFixed(1), scaleSourceToPane: +(1 / cssPerPanePx).toFixed(4), sourceCssPerPanePx: +cssPerPanePx.toFixed(3) },
    lit: { leftCss: litL < 0 ? null : +(litL / ratio).toFixed(1), rightGapCss: litR < 0 ? null : +((tw - 1 - litR) / ratio).toFixed(1) },
    shown: { sourceCssLeft: Math.round(srcCssLeft), sourceCssRight: Math.round(srcCssRight), sourceCssWidth: Math.round(srcCssRight - srcCssLeft) },
    post: mock && { column: mock.column, avatarLeft: mock.avatarLeft, textLeft: mock.textLeft, textRight: mock.textRight, dotsRight: mock.dotsRight, shareRight: mock.shareRight,
      cut: { avatarRail: Math.max(0, Math.round(srcCssLeft - mock.avatarLeft)), textLeft: Math.max(0, Math.round(srcCssLeft - mock.textLeft)), textRight: Math.max(0, Math.round(mock.textRight - srcCssRight)), dots: Math.max(0, Math.round(mock.dotsRight - srcCssRight)), share: Math.max(0, Math.round(mock.shareRight - srcCssRight)) } },
    textPx: mock && +((15 / cssPerPanePx)).toFixed(1),
  };
}
/* THE CONTROL ROW of a shell: every visible control in its bar, and whether any is cut by the bar's box */
function measureBar(sel) {
  const d = document;
  const bar = d.getElementById("bar"), bb = bar.getBoundingClientRect(), chips = d.getElementById("chips"), cb = chips ? chips.getBoundingClientRect() : null;
  const rightEdge = bb.right - (parseFloat(getComputedStyle(bar).paddingRight) || 0);
  const items = [...bar.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== "none" && !e.hidden && e.getBoundingClientRect().width > 0).map((e) => {
    const b = e.getBoundingClientRect(), inChips = chips && e.parentNode === chips, abs = getComputedStyle(e).position === "absolute";
    const what = e.tagName === "SELECT" ? e.options[e.selectedIndex]?.textContent : e.id === "bFull" ? (e.textContent.trim() || "⛶") : (e.getAttribute("aria-label") && !e.textContent.trim() ? e.getAttribute("aria-label") : e.textContent.trim());
    return { what, id: e.id || e.className, x: Math.round(b.x), w: Math.round(b.width), y: Math.round(b.y), h: Math.round(b.height), squeezed: e.scrollWidth > e.clientWidth + 1 ? e.scrollWidth - e.clientWidth : 0,
      cut: !abs && (b.right > rightEdge + 0.5 || b.left < bb.left - 0.5 || (inChips && (b.right > cb.right + 0.5 || b.left < cb.left - 0.5))) };
  });
  /* two controls on top of each other: boxes that intersect by more than a hairline */
  const overlaps = []; for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i], b = items[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ox > 1 && oy > 1 && !/bFull/.test(a.id + b.id)) overlaps.push(a.what + " × " + b.what + " (" + ox + " px)"); }
  return { width: Math.round(bb.width), height: Math.round(bb.height), scrollWidth: bar.scrollWidth, clientWidth: bar.clientWidth, overflow: Math.max(0, bar.scrollWidth - bar.clientWidth), body: d.body.className,
    items, cut: items.filter((i) => i.cut).map((i) => i.what), overlaps, squeezed: items.filter((i) => i.squeezed).map((i) => i.what + " (" + i.squeezed + " px)"), oneLine: items.every((i) => i.y >= bb.top - 0.5 && i.y + i.h <= bb.bottom + 0.5), box: { x: bb.x, y: bb.y, w: bb.width, h: bb.height } };
}
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
const file = path.join(HERE, "s12-" + TAG + ".json");
const res = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
/* 1. the stand-in: its picture at 1792 × 1080 (the captured frame), and the bridge's crop of it */
const pngPath = path.join(OUT, "x-standin-frame.png"), pngUrl = "/deliverables/20261005/station-controls/shots/x-standin-frame.png";
{ const { context, page } = await open(browser, STANDIN.w, STANDIN.h, 1);
  await page.goto(origin + "/deliverables/20261005/station-controls/harness/x-standin.html"); await page.waitForTimeout(500);
  await page.screenshot({ path: pngPath });
  res.standin = await page.evaluate(cropSrc + `
    const rect = calculateCropRect(); const col = findPrimaryColumn().getBoundingClientRect();
    const t = document.querySelector('[data-testid="tweet"]'), tx = t.querySelector('[data-testid="tweetText"]').getBoundingClientRect();
    const av = t.querySelector(".av").getBoundingClientRect(), dots = t.querySelector(".dots").getBoundingClientRect(), share = t.querySelector(".act .share").getBoundingClientRect();
    ({ viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
       mock: { column: { left: Math.round(col.left), right: Math.round(col.right), width: Math.round(col.width) }, avatarLeft: Math.round(av.left), textLeft: Math.round(tx.left), textRight: Math.round(tx.right), dotsRight: Math.round(dots.right), shareRight: Math.round(share.right) } })`);
  console.log("stand-in", JSON.stringify(res.standin)); await context.close(); }
for (const [key, w, h, scale, name] of SCREENS) {
  const { context, page, errs, blocked } = await open(browser, w, h, scale);
  await page.goto(origin + WALL);
  let lit = [], t0 = Date.now();
  while (Date.now() - t0 < 90000) { await page.waitForTimeout(2000); lit = await drawn(page); if (lit.length && lit.every((v) => v > 200) && Date.now() - t0 > 8000) break; }
  await page.waitForTimeout(2000);
  const out = { name, chartsDrawn: lit.filter((v) => v > 200).length };
  out.rest = await page.evaluate(`(${measureSrc})()`);
  /* the X pane, offline (as S11 pictured it) then on the stand-in */
  const xf = await frameOf(page, "x");
  out.xBarOffline = await xf.evaluate(measureBar, "#bar > *");
  out.fed = await feedStandIn(xf, pngUrl, { rect: res.standin.rect, viewport: res.standin.viewport });
  out.x = await xf.evaluate(measureX, res.standin.mock);
  out.xBar = await xf.evaluate(measureBar, "#bar > *");
  await page.screenshot({ path: path.join(OUT, `${TAG}-deck-${key}.png`) });
  const xb = out.rest.x; await page.screenshot({ path: path.join(OUT, `${TAG}-x-${key}.png`), clip: { x: xb.x, y: xb.y, width: xb.w, height: xb.h } });
  const bx = out.xBar.box; await page.screenshot({ path: path.join(OUT, `${TAG}-xbar-${key}.png`), clip: { x: xb.x + bx.x, y: xb.y + bx.y - 4, width: bx.w, height: bx.h + 8 } });
  /* the YouTube control row: PERSONAL at rest, then SCINTILLA */
  const vf = await frameOf(page, "fb");
  const VSEL = "#feedProfile, #chips > .btn, #transport .btn, #bPipBar, #bFull, #bMore, #bRefresh";
  out.rowPersonal = await vf.evaluate(measureBar, VSEL);
  const vb = out.rest.video, rb = out.rowPersonal.box;
  await page.screenshot({ path: path.join(OUT, `${TAG}-ytbar-${key}-personal.png`), clip: { x: vb.x + rb.x, y: vb.y + rb.y - 4, width: rb.w, height: rb.h + 8 } });
  await page.screenshot({ path: path.join(OUT, `${TAG}-column-${key}.png`), clip: { x: xb.x, y: 0, width: xb.w, height: h } });
  await page.evaluate(() => setVideoFeed("fa")); await page.waitForTimeout(5000);
  const sf = await frameOf(page, "fa");
  out.rowScintilla = await sf.evaluate(measureBar, VSEL);
  const sb = out.rowScintilla.box, vb2 = await page.evaluate(() => { const b = document.querySelector('#rowBot > .pane[data-key="fa"]').getBoundingClientRect(); return { x: b.x, y: b.y }; });
  await page.screenshot({ path: path.join(OUT, `${TAG}-ytbar-${key}-scintilla.png`), clip: { x: vb2.x + sb.x, y: vb2.y + sb.y - 4, width: sb.w, height: sb.h + 8 } });
  /* the menu open, if the shell has one (after) */
  if (await sf.$("#bFilters")) { await sf.click("#bFilters"); await page.waitForTimeout(400); out.menuOpen = await sf.evaluate(() => { const m = document.getElementById("filters"); if (!m || m.hidden) return null; const b = m.getBoundingClientRect(), host = document.documentElement.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), inside: b.right <= host.right + .5 && b.left >= -.5 && b.bottom <= host.bottom + .5, overPlayer: !!document.querySelector("body.playing"), items: [...m.querySelectorAll(".btn")].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.textContent.trim()) }; });
    await page.screenshot({ path: path.join(OUT, `${TAG}-ytmenu-${key}.png`), clip: { x: vb2.x, y: vb2.y, width: xb.w, height: Math.min(h - vb2.y, 140) } });
    await sf.click("#chips .btn.mode:nth-child(2)"); await page.waitForTimeout(300); out.menuAfterChoice = await sf.evaluate(() => ({ closed: document.getElementById("filters").hidden, chip: document.getElementById("bFilters").textContent })); }
  out.errs = errs; out.blockedWrites = blocked();
  res[key] = out; fs.writeFileSync(file, JSON.stringify(res, null, 1));
  const X = out.x;
  console.log(key, name, "drawn", out.chartsDrawn, "| col", out.rest.column.w, "| X pane", X.pane.w + "×" + X.pane.h, "fed", JSON.stringify(out.fed), "whole", X.wholeFrame, "| crop", JSON.stringify(X.crop && [X.crop.left, X.crop.width]), "shown css", X.shown.sourceCssLeft + "→" + X.shown.sourceCssRight, "cut", JSON.stringify(X.post?.cut), "pad", X.draw.dxCss + "/" + X.draw.rightPadCss, "lit", JSON.stringify(X.lit), "text px", X.textPx,
    "| xbar overflow", out.xBar.overflow, "cut", JSON.stringify(out.xBar.cut), "overlap", JSON.stringify(out.xBar.overlaps), "squeezed", JSON.stringify(out.xBar.squeezed), "| yt P", out.rowPersonal.body, "cut", JSON.stringify(out.rowPersonal.cut), "1line", out.rowPersonal.oneLine, "| yt S", out.rowScintilla.body, "cut", JSON.stringify(out.rowScintilla.cut), "| errs", errs.length, "blocked", out.blockedWrites);
  await context.close();
}
fs.writeFileSync(file, JSON.stringify(res, null, 1));
await browser.close(); server.close(); process.exit(0);
