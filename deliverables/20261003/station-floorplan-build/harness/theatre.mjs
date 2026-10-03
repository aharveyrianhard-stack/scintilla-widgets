// S11b (3 Oct 2026): the video's one expand step (the theatre) and the YouTube control row, measured on the real deck.
//   node theatre.mjs [screen]     3 screens: the column at rest, a video playing, the theatre, back; the control row
//                                 for PERSONAL and SCINTILLA; the phone's ladder → theatre.json, shots/s11b-*.png
// Same rig as build.mjs (headless Chromium, every non-GET request aborted, the chart API fetched by node with the
// scintillahub.ai origin). The at-rest numbers use build.mjs's own measureInPage(), read from its source, so the
// rest rows are measured exactly the way S11 measured them. The video is started by a click on its first card and
// the theatre by a click on the shell's own expand button (and left again by that button, then by Esc).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../.."), OUT = path.resolve(HERE, "../shots");
const buildSrc = fs.readFileSync(path.join(HERE, "build.mjs"), "utf8");
const measureSrc = buildSrc.match(/function measureInPage\(\) \{[\s\S]*?\n\}/)[0];
const SCREENS = [["1680x1050", 1680, 1050, 2, "MacBook"], ["1920x1080", 1920, 1080, 1, "Apple TV"], ["2560x1440", 2560, 1440, 1, "External"]]
  .filter((s) => !process.argv[2] || process.argv[2] === "all" || s[0] === process.argv[2]);
const NINE = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT", "SPY"];
const WALL = "/deck/?scene=live&charts=9&range=3D&" + NINE.map((t, i) => "c" + (i + 1) + "=" + t).join("&");
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
const videoFrame = async (page) => (await page.$('#rowBot > .pane[data-key="fb"] iframe')).contentFrame();
/* THE THEATRE, measured: the video pane, its picture (the pane less the shell's bar), black inside the picture, the
   column (X alone, top to bottom: anything in the column that is not X is black), and the cover over the charts */
function measureTheatre() {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  const W = innerWidth, H = innerHeight, col = document.getElementById("rowBot"), top = document.getElementById("rowTop");
  const vp = col.querySelector(':scope > .pane[data-key="' + VIDEO_FEED + '"]'), xp = col.querySelector(':scope > .pane[data-key="x"]');
  const v = r(vp), c = r(col), x = r(xp), t = r(top), d = vp.querySelector("iframe").contentDocument, bar = d.getElementById("bar").getBoundingClientRect().height;
  const pic = { w: v.w, h: v.h - bar };
  const picBlack = Math.max(0, Math.floor(pic.w - pic.h * 16 / 9 - 0.5)) * pic.h + Math.max(0, Math.floor(pic.h - pic.w * 9 / 16 - 0.5)) * pic.w;
  /* the column: every pixel of it that X does not cover (X is the only pane left in it) */
  const inColumn = (b) => Math.max(0, Math.min(b.x + b.w, c.x + c.w) - Math.max(b.x, c.x)) * Math.max(0, Math.min(b.y + b.h, c.y + c.h) - Math.max(b.y, c.y));
  const columnBlack = Math.round(c.w * c.h - inColumn(x));
  const area = { x: t.x, w: W - t.x, h: H };
  const fits = Math.min(area.w, Math.floor((area.h - bar) * 16 / 9));
  return {
    screen: { w: W, h: H }, body: document.body.className, playing: d.body.classList.contains("playing"), stage: MEDIA_STAGE,
    pane: { x: Math.round(v.x), y: Math.round(v.y), w: Math.round(v.w), h: Math.round(v.h) }, bar, picture: { w: Math.round(pic.w), h: Math.round(pic.h) },
    picture169: +(pic.w / pic.h).toFixed(4), pictureBlack: picBlack, pictureShareOfChartArea: +((pic.w * pic.h) / (area.w * area.h) * 100).toFixed(1),
    largestThatFits: { w: fits, h: Math.round(fits * 9 / 16) }, centred: { dx: Math.round((v.x - area.x) - (area.x + area.w - (v.x + v.w))), dy: Math.round(v.y - (H - (v.y + v.h))) },
    inChartArea: v.x >= area.x - 0.5 && v.x + v.w <= W + 0.5 && v.y >= -0.5 && v.y + v.h <= H + 0.5,
    column: { x: Math.round(c.x), w: Math.round(c.w), h: Math.round(c.h), share: +(c.w / W * 100).toFixed(1) }, x: { w: Math.round(x.w), h: Math.round(x.h) }, columnBlack,
    chartsCovered: getComputedStyle(top, "::after").content !== "none", buttonSays: d.getElementById("bFull").textContent,
  };
}
/* THE CONTROL ROW: every visible control in the shell's bar, where it sits, and whether any is cut or wraps */
function measureRow(key) {
  const vp = document.querySelector('#rowBot > .pane[data-key="' + key + '"]'), d = vp.querySelector("iframe").contentDocument;
  const bar = d.getElementById("bar"), bb = bar.getBoundingClientRect(), chips = d.getElementById("chips"), cb = chips.getBoundingClientRect();
  const items = [...bar.querySelectorAll("#feedProfile, #chips > .btn, #bFull")].filter((e) => getComputedStyle(e).display !== "none").map((e) => {
    const b = e.getBoundingClientRect(), inChips = e.parentNode === chips;
    return { what: e.id === "feedProfile" ? e.options[e.selectedIndex].textContent : e.id === "bFull" ? "⛶" : e.textContent.trim(), x: Math.round(b.x), w: Math.round(b.width), y: Math.round(b.y), h: Math.round(b.height),
      cut: b.right > bb.right + 0.5 || b.left < bb.left - 0.5 || (inChips && (b.right > cb.right + 0.5 || b.left < cb.left - 0.5)) };
  });
  return { feed: key, width: Math.round(bb.width), height: Math.round(bb.height), mode: d.body.classList.contains("bar-scroll") ? "scrolling" : d.body.classList.contains("bar-tight") ? "compact" : "as drawn",
    items, cut: items.filter((i) => i.cut).map((i) => i.what), oneLine: bb.height < 32 && items.every((i) => i.y >= bb.top - 0.5 && i.y + i.h <= bb.bottom + 0.5), selectWidth: items[0]?.w, box: { x: bb.x + vp.getBoundingClientRect().x, y: bb.y + vp.getBoundingClientRect().y, w: bb.width, h: bb.height } };
}
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
const res = fs.existsSync(path.join(HERE, "theatre.json")) ? JSON.parse(fs.readFileSync(path.join(HERE, "theatre.json"), "utf8")) : {};
for (const [key, w, h, scale, name] of SCREENS) {
  const { context, page, errs, blocked } = await open(browser, w, h, scale);
  await page.goto(origin + WALL);
  let lit = [], t0 = Date.now();
  while (Date.now() - t0 < 90000) { await page.waitForTimeout(2000); lit = await drawn(page); if (lit.length && lit.every((v) => v > 200) && Date.now() - t0 > 8000) break; }
  await page.waitForTimeout(2500);
  const out = { name, chartsDrawn: lit.filter((v) => v > 200).length };
  out.rest = await page.evaluate(`(${measureSrc})()`);
  out.rowPersonal = await page.evaluate(measureRow, "fb");
  await page.screenshot({ path: path.join(OUT, `s11b-rest-${key}.png`) });
  const rb = out.rowPersonal.box; await page.screenshot({ path: path.join(OUT, `s11b-row-${key}-personal.png`), clip: { x: rb.x, y: rb.y - 6, width: rb.w + 12, height: rb.h + 12 } });
  /* a video playing: the first card, clicked */
  const vf = await videoFrame(page);
  await vf.click(".card"); await page.waitForTimeout(6000);
  out.restPlaying = await page.evaluate(`(${measureSrc})()`);
  /* the theatre: the shell's own expand button */
  await vf.click("#bFull"); await page.waitForTimeout(1500);
  out.theatre = await page.evaluate(measureTheatre);
  await page.screenshot({ path: path.join(OUT, `s11b-theatre-${key}.png`) });
  /* back: the same button, then the column's numbers again */
  await vf.click("#bFull"); await page.waitForTimeout(1200);
  out.backByButton = await page.evaluate(`(${measureSrc})()`); out.backByButton.stage = await page.evaluate(() => MEDIA_STAGE);
  /* again, and back by Esc: first with the focus in the video's own shell (where the press just was), then in the deck */
  await vf.click("#bFull"); await page.waitForTimeout(800);
  const inShell = await page.evaluate(() => MEDIA_STAGE);
  await page.keyboard.press("Escape"); await page.waitForTimeout(1000);
  const afterShell = await page.evaluate(() => MEDIA_STAGE);
  await vf.click("#bFull"); await page.waitForTimeout(800);
  const inDeck = await page.evaluate(() => MEDIA_STAGE);
  await page.evaluate(() => { document.activeElement?.blur?.(); window.focus(); });
  await page.keyboard.press("Escape"); await page.waitForTimeout(1000);
  out.backByEsc = { fromShell: [inShell, afterShell], fromDeck: [inDeck, await page.evaluate(() => MEDIA_STAGE)], theatreClass: await page.evaluate(() => document.body.classList.contains("media-theatre")) };
  /* the other feed's row (SCINTILLA carries the longer chip list) */
  await page.evaluate(() => setVideoFeed("fa")); await page.waitForTimeout(5000);
  out.rowScintilla = await page.evaluate(measureRow, "fa");
  const sb = out.rowScintilla.box; await page.screenshot({ path: path.join(OUT, `s11b-row-${key}-scintilla.png`), clip: { x: sb.x, y: sb.y - 6, width: sb.w + 12, height: sb.h + 12 } });
  out.errs = errs; out.blockedWrites = blocked();
  res[key] = out; fs.writeFileSync(path.join(HERE, "theatre.json"), JSON.stringify(res, null, 1));
  const T = out.theatre;
  console.log(key, name, "drawn", out.chartsDrawn, "| rest charts", out.rest.share.chartsArea + "%", "col", out.rest.widthShare.column + "%", "pic", JSON.stringify(out.rest.picture), "black", out.rest.px.black,
    "| theatre pane", T.pane.w + "×" + T.pane.h, "@", T.pane.x + "," + T.pane.y, "pic", T.picture.w + "×" + T.picture.h, "fits", JSON.stringify(T.largestThatFits), "picBlack", T.pictureBlack, "colBlack", T.columnBlack, "playing", T.playing, "btn", T.buttonSays,
    "| back black", out.backByButton.px.black, "stage", out.backByButton.stage, "| esc", JSON.stringify(out.backByEsc),
    "| row P", out.rowPersonal.mode, "cut", out.rowPersonal.cut, "1line", out.rowPersonal.oneLine, "| row S", out.rowScintilla.mode, "cut", out.rowScintilla.cut, "1line", out.rowScintilla.oneLine, "| errs", errs.length, "blocked", out.blockedWrites);
  await context.close();
}
/* the phone keeps its ladder: stage one inside the scrolling column, no theatre */
{ const { context, page, errs } = await open(browser, 390, 844, 2, true);
  await page.goto(origin + "/deck/?scene=otherIndexes1D"); await page.waitForTimeout(5000);
  await page.evaluate(() => toggleMediaStage(VIDEO_FEED)); await page.waitForTimeout(800);
  res.phone = await page.evaluate(() => ({ body: document.body.className, stage: MEDIA_STAGE, theatre: document.body.classList.contains("media-theatre"),
    videoPosition: getComputedStyle(document.querySelector('#rowBot > .pane[data-key="' + VIDEO_FEED + '"]')).position }));
  await page.evaluate(() => coverMediaX(VIDEO_FEED)); await page.waitForTimeout(500);
  res.phone.coverX = await page.evaluate(() => ({ stage: MEDIA_STAGE, xHidden: document.querySelector('#rowBot > .pane[data-key="x"]').classList.contains("media-hidden") }));
  res.phone.errs = errs; console.log("phone", JSON.stringify(res.phone)); await context.close(); }
fs.writeFileSync(path.join(HERE, "theatre.json"), JSON.stringify(res, null, 1));
await browser.close(); server.close(); process.exit(0);
