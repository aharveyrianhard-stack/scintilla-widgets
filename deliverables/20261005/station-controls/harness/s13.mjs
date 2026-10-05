// S13 (5 Oct 2026): the YouTube bar by use, the X bar in icons, the X refresh cadence and its "page up" — measured on the
// real deck in a hidden browser.   node s13.mjs [screen]
// Same rig as S12 (headless Chromium; every non-GET request aborted and counted; the chart API fetched by node with the
// scintillahub.ai origin). Two things are stand-ins, and are said to be wherever they are shown:
//   · the X capture: x-standin.html plays the x.com tab at 1792 × 1080 and its picture is fed to the real X shell as a
//     stream through the shell's own attachXFloatStream(); the page-up is the X Bridge's own pageUpRefresh() lifted from
//     its source and run on the stand-in's DOM, with "X refreshed" played by the stand-in (the timeline goes empty for
//     0.6 s, then comes back with two new posts on top);
//   · the watch-later write: the one POST to yt-act is answered locally with { ok:true } (nothing reaches the database).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../.."), OUT = path.resolve(HERE, "../shots");
const ONLY = process.argv[2];
const buildSrc = fs.readFileSync(path.join(ROOT, "deliverables/20261003/station-floorplan-build/harness/build.mjs"), "utf8");
const measureSrc = buildSrc.match(/function measureInPage\(\) \{[\s\S]*?\n\}/)[0];
const bridge = fs.readFileSync(path.join(ROOT, "station-x-bridge-draft/content.js"), "utf8");
const lift = (name) => { const m = bridge.match(new RegExp("\\n  (?:async )?function " + name + "\\(.*\\) \\{[\\s\\S]*?\\n  \\}")); if (!m) throw new Error("no " + name); return m[0]; };
const bridgeSrc = ["const session = { settings: { hideFeedTabs: true }, stationMode: true, switchingView: false, pointerPause: false, activeView: 'trading', pageUp: { seq: 0, busy: false, at: 0, result: '', readingOnScreen: null, newPosts: null } };",
  "const PAGE_UP_MIN_GAP_MS = 20000, PAGE_UP_PAINT_WAIT_MS = 3500; const stationViewerPauseActive = () => !!window.__hover; const resetStationScrollComposite = () => { window.__resets = (window.__resets || 0) + 1; }; const scheduleCropTargetUpdate = () => {};",
  "const activateView = async () => { window.__xRefreshes = (window.__xRefreshes || 0) + 1; window.__standinRefresh(); await wait(420); };",
  ...["wait", "waitFor", "elementLabel", "findPrimaryColumn", "findFeedTabsBottom", "findInnerContentLeft", "calculateCropRect", "alignCaptureToFirstVisiblePost", "visibleFeedPosts", "feedPostKey", "pageUpPlan", "pageUpOutcome", "pageUpRefresh"].map(lift)].join("\n");
const SCREENS = [["1680x1050", 1680, 1050, "MacBook"], ["1920x1080", 1920, 1080, "Apple TV"], ["2560x1440", 2560, 1440, "External"]].filter((s) => !ONLY || ONLY === "all" || s[0] === ONLY);
const NINE = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT", "SPY"];
const WALL = "/deck/?scene=live&charts=9&range=3D&" + NINE.map((t, i) => "c" + (i + 1) + "=" + t).join("&");
const STANDIN = { w: 1792, h: 1080 }, SHOTS = "/deliverables/20261005/station-controls/shots/";
async function open(browser, w, h, scale) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  let blocked = 0, stubbed = 0;
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (req.method() === "POST" && /\/functions\/v1\/yt-act$/.test(new URL(url).pathname)) { stubbed++; return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}', headers: { "access-control-allow-origin": "*" } }); }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { blocked++; return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") {
      try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
    }
    return route.fallback();
  });
  await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs, blocked: () => blocked, stubbed: () => stubbed };
}
const drawn = (page) => page.evaluate(() => [...document.querySelectorAll("#rowTop > .pane.chart-pane:not(.chart-off) iframe:not(.slot-spare)")]
  .filter((f) => getComputedStyle(f.closest(".pane")).display !== "none").map((f) => { try { const cv = f.contentDocument.querySelector("canvas.sc-nchart__cv"); if (!cv || !cv.width) return 0;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let lit = 0; for (let i = 0; i < d.length; i += 64) if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; return lit; } catch (e) { return -1; } }));
const frameOf = async (page, key) => (await page.$('#rowBot > .pane[data-key="' + key + '"] iframe')).contentFrame();
const paneBox = (page, key) => page.evaluate((key) => { const b = document.querySelector('#rowBot > .pane[data-key="' + key + '"]').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }, key);
/* every visible thing on a shell's bar: cut by the bar's box? squeezed? on one line? on top of a neighbour? */
function measureBar() {
  const d = document, bar = d.getElementById("bar"), bb = bar.getBoundingClientRect();
  const rightEdge = bb.right - (getComputedStyle(d.getElementById("bFull")).position === "absolute" ? 0 : (parseFloat(getComputedStyle(bar).paddingRight) || 0));
  const items = [...bar.querySelectorAll("#bar > *, #transport > *")].filter((e) => e.id !== "transport" && e.id !== "barGap" && getComputedStyle(e).display !== "none" && !e.hidden && e.getBoundingClientRect().width > 0).map((e) => {
    const b = e.getBoundingClientRect(), words = e.textContent.trim();
    return { id: e.id || e.className, kind: e.querySelector("svg") ? "icon" : /^[⛶⋯↙]/.test(words) && words.length <= 2 ? "icon" : "words", words: e.querySelector("svg") ? "" : words, tooltip: e.getAttribute("title") || "",
      x: Math.round(b.x), w: Math.round(b.width), y: Math.round(b.y), h: Math.round(b.height), squeezed: e.scrollWidth > e.clientWidth + 1 ? e.scrollWidth - e.clientWidth : 0, cut: b.right > rightEdge + 0.5 || b.left < bb.left - 0.5 };
  });
  const overlaps = []; for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i], b = items[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ox > 1 && oy > 1) overlaps.push(a.id + " × " + b.id + " (" + ox + " px)"); }
  const last = items.reduce((m, i) => Math.max(m, i.x + i.w), 0);
  return { width: Math.round(bb.width), height: Math.round(bb.height), overflow: Math.max(0, bar.scrollWidth - bar.clientWidth), order: items.slice().sort((a, b) => a.x - b.x).map((i) => i.id), items,
    used: Math.round(items.reduce((s, i) => s + i.w, 0)), spare: Math.round(bb.width - items.reduce((s, i) => s + i.w, 0) - 4 * (items.length - 1) - 12), rightmost: last,
    cut: items.filter((i) => i.cut).map((i) => i.id), squeezed: items.filter((i) => i.squeezed).map((i) => i.id + " (" + i.squeezed + " px)"), overlaps, noTooltip: items.filter((i) => i.kind === "icon" && !i.tooltip).map((i) => i.id),
    oneLine: items.every((i) => i.y >= bb.top - 0.5 && i.y + i.h <= bb.bottom + 0.5), box: { x: bb.x, y: bb.y, w: bb.width, h: bb.height } };
}
function measurePanel(id) {
  const m = document.getElementById(id); if (!m || m.hidden || getComputedStyle(m).display === "none") return null;
  const b = m.getBoundingClientRect(), host = document.documentElement.getBoundingClientRect();
  const kids = [...m.querySelectorAll(".btn, select, .lab")].filter((e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0);
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), inside: b.right <= host.right + .5 && b.left >= -.5 && b.bottom <= host.bottom + .5,
    cutInside: kids.filter((e) => { const k = e.getBoundingClientRect(); return k.right > b.right + .5 || k.left < b.left - .5 || e.scrollWidth > e.clientWidth + 1; }).map((e) => e.id || e.textContent.trim()),
    items: kids.map((e) => e.tagName === "SELECT" ? "select:" + [...e.options].map((o) => o.textContent).join("|") : e.textContent.trim()) };
}
/* the X shell's canvas: how much of it is lit, and a fingerprint of the top band (so "the picture changed" is a number) */
function inkOf() {
  const c = el("cv"), ctx = c.getContext("2d"), d = ctx.getImageData(0, 0, c.width, c.height).data; let lit = 0, n = 0, sum = 0;
  for (let i = 0; i < d.length; i += 16) { n++; if (d[i] + d[i + 1] + d[i + 2] > 60) lit++; }
  const band = ctx.getImageData(0, 0, c.width, Math.min(c.height, 260)).data; for (let i = 0; i < band.length; i += 4) sum = (sum + (band[i] + band[i + 1] + band[i + 2]) * ((i >> 2) % 251 + 1)) % 1000000007;
  return { litPct: +(100 * lit / n).toFixed(2), top: sum };
}
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
const file = path.join(HERE, "s13.json");
const res = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};

/* ---- 1. THE PAGE UP, by the bridge's own code, on the stand-in ---- */
{ const { context, page, errs } = await open(browser, STANDIN.w, STANDIN.h, 1);
  await page.goto(origin + "/deliverables/20261005/station-controls/harness/x-standin.html"); await page.waitForTimeout(500);
  await page.evaluate(() => {
    /* give every post the link the bridge keys on, and play X's refresh: empty for 0.6 s, then two new posts on top */
    const col = document.querySelector('[data-testid="primaryColumn"]'); let n = 100;
    for (const a of col.querySelectorAll('article[data-testid="tweet"]')) { const l = document.createElement("a"); l.href = "/standin/status/" + (n--); l.style.display = "none"; a.appendChild(l); }
    window.__standinRefresh = () => {
      const posts = [...col.querySelectorAll('article[data-testid="tweet"]')]; for (const p of posts) p.remove();
      window.__blankAt = performance.now();
      setTimeout(() => {
        const mk = (id, who, handle, text) => { const a = posts[0].cloneNode(true); a.querySelector("b").textContent = who; a.querySelector(".h").textContent = handle + " · now"; a.querySelector('[data-testid="tweetText"]').textContent = text;
          a.querySelector('a[href*="/status/"]').href = "/standin/status/" + id; a.dataset.fresh = "1"; return a; };
        const fresh = [mk(102, "Tape Reader", "@tapereader", "NEW · Breadth turned: 68% of the S&P above the open, semis leading. $SPY $SMH"), mk(101, "Rates Desk", "@ratesdesk", "NEW · 2s10s steeper by 3 bp into the auction; dollar gives back the morning.")];
        for (const p of [...fresh, ...posts]) col.appendChild(p); window.scrollTo(0, 0);
      }, 600);
    };
  });
  /* a minute of the slow scroll: 60 s × 3 px/s = 180 px down */
  await page.evaluate(() => window.scrollTo(0, 180)); await page.waitForTimeout(300);
  const facts = () => page.evaluate(bridgeSrc + `
    const posts = visibleFeedPosts(); const rect = calculateCropRect();
    ({ scrollTop: Math.round((document.scrollingElement || document.documentElement).scrollTop), rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
       viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
       onScreen: posts.map((p) => ({ key: feedPostKey(p), who: p.querySelector("b").textContent, top: Math.round(p.getBoundingClientRect().top), fresh: p.dataset.fresh === "1" })) })`);
  const before = await facts();
  await page.screenshot({ path: path.join(OUT, "s13-x-standin-before.png") });
  /* the page-up, timed, with the emptiest moment sampled while it runs */
  const run = await page.evaluate(bridgeSrc + `
    (async () => { let minPosts = 99, samples = 0; const t0 = performance.now();
      const probe = setInterval(() => { samples++; minPosts = Math.min(minPosts, visibleFeedPosts().length); }, 50);
      const held = (window.__hover = true, await pageUpRefresh()); window.__hover = false;
      const out = await pageUpRefresh(); const again = await pageUpRefresh(); clearInterval(probe);
      return { heldUnderHover: held, out, secondAskInside20s: again, ms: Math.round(performance.now() - t0), xRefreshes: window.__xRefreshes, phaseResets: window.__resets, emptiestMomentPosts: minPosts, samples, state: session.pageUp }; })()`);
  await page.waitForTimeout(300);
  const after = await facts();
  await page.screenshot({ path: path.join(OUT, "s13-x-standin-after.png") });
  /* the emptiest moment, as a picture, for the pane's hold test */
  await page.evaluate(() => { for (const p of document.querySelectorAll('article[data-testid="tweet"]')) p.style.visibility = "hidden"; }); await page.screenshot({ path: path.join(OUT, "s13-x-standin-empty.png") });
  const reading = before.onScreen[0];
  res.pageUp = { before, run, after, reading, newestOnTop: after.onScreen.slice(0, 2).every((p) => p.fresh), readingStillOnScreen: after.onScreen.some((p) => p.key === reading.key),
    readingMovedDownPx: (after.onScreen.find((p) => p.key === reading.key) || {}).top - reading.top, errs };
  console.log("page-up", JSON.stringify({ before: before.onScreen.map((p) => p.who + "@" + p.top), run, after: after.onScreen.map((p) => (p.fresh ? "NEW " : "") + p.who + "@" + p.top), newestOnTop: res.pageUp.newestOnTop, readingStillOnScreen: res.pageUp.readingStillOnScreen }));
  await context.close(); }

/* ---- 2. THE DECK at the three screens ---- */
for (const [key, w, h, name] of SCREENS) {
  const { context, page, errs, blocked, stubbed } = await open(browser, w, h, 2);
  await page.goto(origin + WALL);
  let lit = [], t0 = Date.now();
  while (Date.now() - t0 < 90000) { await page.waitForTimeout(2000); lit = await drawn(page); if (lit.length && lit.every((v) => v > 200) && Date.now() - t0 > 8000) break; }
  await page.waitForTimeout(2000);
  const out = { name, chartsDrawn: lit.filter((v) => v > 200).length };
  out.rest = await page.evaluate(`(${measureSrc})()`);
  const shot = (file, box, pad = 0) => page.screenshot({ path: path.join(OUT, file), clip: { x: box.x, y: Math.max(0, box.y - pad), width: box.w, height: box.h + pad * 2 } });
  const barShot = (file, pane, bar) => shot(file, { x: pane.x + bar.box.x, y: pane.y + bar.box.y, w: bar.box.w, h: bar.box.h }, 4);

  /* --- the YouTube pane (PERSONAL) --- */
  const vb = await paneBox(page, "fb"), vf = await frameOf(page, "fb");
  await vf.waitForSelector("#grid .card", { timeout: 30000 }).catch(() => {});
  const yt = {};
  yt.grid = await vf.evaluate(measureBar);
  yt.cards = await vf.evaluate(() => document.querySelectorAll("#grid .card").length);
  await barShot(`s13-ytbar-${key}-grid.png`, vb, yt.grid);
  /* + WATCH LATER from the grid: point at the second thumbnail, travel to the bar, tap */
  const card = await vf.$("#grid .card:nth-child(2)");
  if (card) {
    await card.hover(); await page.waitForTimeout(200);
    const wb = await vf.$("#bWatchBar"); await wb.hover(); await page.waitForTimeout(150);
    yt.pointed = await vf.evaluate(() => ({ sel: SEL, outlined: document.querySelector("#grid .card.sel")?.dataset.v || "", second: document.querySelector("#grid .card:nth-child(2)").dataset.v, tooltip: el("bWatchBar").title, watchReady: WATCH_READY }));
    await wb.click(); await page.waitForTimeout(700);
    yt.addedFromGrid = await vf.evaluate(() => ({ on: el("bWatchBar").classList.contains("on"), inList: WATCH.has(SEL), flash: el("wlFlash").textContent, tooltip: el("bWatchBar").title }));
    await shot(`s13-yt-${key}-watch-grid.png`, { x: vb.x, y: vb.y, w: vb.w, h: Math.min(vb.h, 200) });
  }
  /* NEXT from the grid starts the queue */
  await vf.click("#bNext"); await page.waitForTimeout(2500);
  yt.nextFromGrid = await vf.evaluate(() => ({ playing: document.body.classList.contains("playing"), cur: CUR?.video_id || "", first: visibleQueue()[0]?.video_id || "", nowq: el("nowq").textContent }));
  yt.playing = await vf.evaluate(measureBar);
  await barShot(`s13-ytbar-${key}-playing.png`, vb, yt.playing);
  /* + WATCH LATER on the playing video, then NEXT: the + is for the next video now */
  await vf.click("#bWatchBar"); await page.waitForTimeout(700);
  yt.addedPlaying = await vf.evaluate(() => ({ on: el("bWatchBar").classList.contains("on"), cur: CUR?.video_id, inList: WATCH.has(CUR?.video_id) }));
  await vf.click("#bNext"); await page.waitForTimeout(2500);
  yt.afterNext = await vf.evaluate(() => ({ cur: CUR?.video_id || "", second: visibleQueue()[1]?.video_id || "", nowq: el("nowq").textContent, plusIsForNew: !el("bWatchBar").classList.contains("on") || WATCH.has(CUR?.video_id), target: watchTarget()?.video_id }));
  /* the ⋯ over the player: the channel and the player's other actions */
  await vf.click("#bMenu"); await page.waitForTimeout(300);
  yt.menuPlaying = await vf.evaluate(measurePanel, "more");
  await shot(`s13-ytmenu-${key}-playing.png`, { x: vb.x, y: vb.y, w: vb.w, h: Math.min(vb.h, 190) });
  await vf.click("#bMenu"); await page.waitForTimeout(200);
  /* GRID: back to the thumbnails */
  await vf.click("#bBack"); await page.waitForTimeout(600);
  yt.backToGrid = await vf.evaluate(() => ({ playing: document.body.classList.contains("playing"), gridShown: getComputedStyle(el("grid")).display !== "none", cards: document.querySelectorAll("#grid .card").length, gridLit: el("bBack").classList.contains("on"), lastPlayed: LAST_PLAYED, nextWillPlay: gridNextVideo()?.video_id || "", third: visibleQueue()[2]?.video_id || "" }));
  /* the ⋯ on the grid: the channel switch and the filters; a choice folds it */
  await vf.click("#bMenu"); await page.waitForTimeout(300);
  yt.menuGrid = await vf.evaluate(measurePanel, "more");
  await shot(`s13-ytmenu-${key}-grid.png`, { x: vb.x, y: vb.y, w: vb.w, h: Math.min(vb.h, 150) });
  await vf.click("#chips .btn.mode:nth-child(1)"); await page.waitForTimeout(500);
  yt.menuAfterChoice = await vf.evaluate(() => ({ closed: el("more").hidden, mode: MODE, tooltip: el("bMenu").title }));
  await vf.evaluate(() => setMode("videos")); await page.waitForTimeout(400);
  out.youtube = yt;

  /* --- the X pane --- */
  const xb = await paneBox(page, "x"), xf = await frameOf(page, "x");
  const X = {};
  const std = res.pageUp;
  X.fed = await xf.evaluate(async ({ shots, w, h, crop }) => {
    const load = async (name) => { const img = new Image(); img.src = shots + name; await img.decode(); return img; };
    const imgs = { before: await load("s13-x-standin-before.png"), after: await load("s13-x-standin-after.png"), empty: await load("s13-x-standin-empty.png") };
    const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d"); let cur = "before";
    const paint = () => ctx.drawImage(imgs[cur], 0, 0, w, h); paint(); window.__standinShow = (k) => { cur = k; paint(); }; setInterval(paint, 100);
    window.__asks = []; window.addEventListener("message", (e) => { if (e.data?.type === "XFF_STATION_CONTROL" && e.data.action === "refresh") window.__asks.push({ action: e.data.action, value: e.data.value || null }); });
    let seq = 1; window.__crop = (pageUp) => window.postMessage({ type: "XFF_STATION_CROP", crop: Object.assign({ fractionalScrollOffset: 0, captureGeneration: 1, sequence: ++seq, activeView: "trading", paused: false, pageUp,
      sourceCropped: false, sourceCropSupported: false, elementCaptureSupported: false, viewportDpr: 1, source: { browser: "stand-in", machine: "headless" } }, crop) }, location.origin);
    await attachXFloatStream(c.captureStream(10)); window.__crop({ seq: 0, busy: false });
    await new Promise((r) => setTimeout(r, 1500));
    return { video: el("v").videoWidth + "×" + el("v").videoHeight, xfloat: document.body.classList.contains("xfloat") };
  }, { shots: SHOTS, w: STANDIN.w, h: STANDIN.h, crop: { rect: std.before.rect, viewport: std.before.viewport } });
  X.bar = await xf.evaluate(measureBar);
  X.every = await xf.evaluate(() => ({ text: el("xfEvery").textContent, seconds: xRefreshSeconds, saved: localStorage.getItem(X_REFRESH_KEY), refreshTooltip: el("bXRefresh").title }));
  await barShot(`s13-xbar-${key}.png`, xb, X.bar);
  /* the ⋯ panel: the cadence setting */
  await xf.click("#bXMore"); await page.waitForTimeout(300);
  X.panel = await xf.evaluate(measurePanel, "xMore");
  X.panelChoices = await xf.evaluate(() => [...document.querySelectorAll("#xMore .xr")].map((b) => ({ s: b.textContent, on: b.classList.contains("on") })));
  await shot(`s13-xmore-${key}.png`, { x: xb.x, y: xb.y, w: xb.w, h: Math.min(xb.h, 150) });
  await xf.click('#xMore .xr[data-s="90"]'); await page.waitForTimeout(300);
  X.chose90 = await xf.evaluate(() => ({ text: el("xfEvery").textContent, seconds: xRefreshSeconds, saved: localStorage.getItem(X_REFRESH_KEY), panelClosed: !document.body.classList.contains("x-more") }));
  await xf.evaluate(() => { setXRefreshSeconds(60); try { localStorage.removeItem(X_REFRESH_KEY); } catch (_) {} });
  await page.mouse.move(xb.x + xb.w + 300, xb.y + 300); await page.waitForTimeout(700);
  /* the clock: nothing early; held under the pointer; fires when it leaves; the ask is a page up */
  X.clock = {};
  X.clock.early = await xf.evaluate(async () => { window.__asks.length = 0; xRefreshAt = Date.now() - 50000; await new Promise((r) => setTimeout(r, 2300)); return window.__asks.length; });
  await page.mouse.move(xb.x + xb.w / 2, xb.y + xb.h / 2); await page.waitForTimeout(400);
  X.clock.underPointer = await xf.evaluate(async () => { window.__asks.length = 0; xRefreshAt = Date.now() - 61000; await new Promise((r) => setTimeout(r, 2300)); return { asks: window.__asks.length, hover: stationHoverInside, waiting: xRefreshWaiting }; });
  await shot(`s13-x-${key}-1-reading.png`, xb);
  X.ink = { reading: await xf.evaluate(inkOf) };
  await page.mouse.move(xb.x + xb.w + 300, xb.y + 300);
  X.clock.afterLeaving = await xf.evaluate(async () => { const t0 = Date.now(); while (!window.__asks.length && Date.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 100)); return { asks: window.__asks.slice(), holding: xHoldUntil > Date.now(), afterMs: Date.now() - t0 }; });
  /* the source turns the page: its picture goes EMPTY for a moment — the pane must keep the last one */
  await xf.evaluate(() => { window.__standinShow("empty"); window.__crop({ seq: 1, busy: true }); }); await page.waitForTimeout(900);
  X.ink.whileTurning = await xf.evaluate(inkOf);
  X.heldWhileTurning = await xf.evaluate(() => xHoldUntil > Date.now());
  await shot(`s13-x-${key}-2-turning.png`, xb);
  /* the page lands: new picture, new crop, sequence done */
  await xf.evaluate((crop) => { window.__standinShow("after"); xfloatCrop && (window.__cropAfter = crop); window.postMessage({ type: "XFF_STATION_CROP", crop: Object.assign({}, xfloatCrop, { rect: crop.rect, viewport: crop.viewport, sequence: 999, pageUp: { seq: 1, busy: false, result: "top", readingOnScreen: true, newPosts: 2 } }) }, location.origin); }, { rect: std.after.rect, viewport: std.after.viewport });
  await page.waitForTimeout(1500);
  X.ink.landed = await xf.evaluate(inkOf);
  X.released = await xf.evaluate(() => !xHoldUntil || xHoldUntil <= Date.now());
  await shot(`s13-x-${key}-3-landed.png`, xb);
  X.clock.nextCount = await xf.evaluate(async () => { window.__asks.length = 0; await new Promise((r) => setTimeout(r, 2300)); return { asks: window.__asks.length, secondsSinceLast: Math.round((Date.now() - xRefreshAt) / 1000) }; });
  /* ↻ by hand is the plain refresh, and starts the count again */
  X.byHand = await xf.evaluate(async () => { window.__asks.length = 0; xRefreshAt = Date.now() - 40000; el("bXRefresh").click(); await new Promise((r) => setTimeout(r, 200)); return { asks: window.__asks.slice(), restarted: Date.now() - xRefreshAt < 1000 }; });
  out.x = X;
  await shot(`s13-column-${key}.png`, { x: xb.x, y: 0, w: xb.w, h });
  await page.screenshot({ path: path.join(OUT, `s13-deck-${key}.png`) });
  out.after = await page.evaluate(`(${measureSrc})()`);
  /* the SCINTILLA channel's bar */
  await page.evaluate(() => setVideoFeed("fa")); await page.waitForTimeout(5000);
  const sf = await frameOf(page, "fa"), sbx = await paneBox(page, "fa");
  out.scintilla = await sf.evaluate(measureBar);
  await barShot(`s13-ytbar-${key}-scintilla.png`, sbx, out.scintilla);
  out.errs = errs; out.blockedWrites = blocked(); out.stubbedWatchLaterWrites = stubbed();
  res[key] = out; fs.writeFileSync(file, JSON.stringify(res, null, 1));
  console.log(key, name, "charts", out.chartsDrawn, "| col", out.rest.column.w, "| YT grid", yt.grid.order.join(" "), "cut", JSON.stringify(yt.grid.cut), "sq", JSON.stringify(yt.grid.squeezed), "1line", yt.grid.oneLine, "spare", yt.grid.spare,
    "| playing", yt.playing.order.join(" "), "cut", JSON.stringify(yt.playing.cut), "1line", yt.playing.oneLine, "spare", yt.playing.spare, "| pointed", JSON.stringify(yt.pointed), "added", JSON.stringify(yt.addedFromGrid), "| next", JSON.stringify(yt.nextFromGrid), JSON.stringify(yt.addedPlaying), JSON.stringify(yt.afterNext),
    "| back", JSON.stringify(yt.backToGrid), "| menu", JSON.stringify(yt.menuGrid), JSON.stringify(yt.menuPlaying), JSON.stringify(yt.menuAfterChoice),
    "\n   X bar", X.bar.order.join(" "), "cut", JSON.stringify(X.bar.cut), "sq", JSON.stringify(X.bar.squeezed), "ov", JSON.stringify(X.bar.overlaps), "1line", X.bar.oneLine, "| every", JSON.stringify(X.every), "| panel", JSON.stringify(X.panel), JSON.stringify(X.panelChoices), JSON.stringify(X.chose90),
    "| clock", JSON.stringify(X.clock), "| ink", JSON.stringify(X.ink), "held", X.heldWhileTurning, "released", X.released, "| byHand", JSON.stringify(X.byHand), "| scintilla", out.scintilla.order.join(" "), JSON.stringify(out.scintilla.cut), "| floor", out.after.share.chartsArea, out.after.px.black, "| errs", JSON.stringify(errs), "blocked", out.blockedWrites, "stubbed", out.stubbedWatchLaterWrites);
  await context.close();
}
fs.writeFileSync(file, JSON.stringify(res, null, 1));
await browser.close(); server.close(); process.exit(0);
