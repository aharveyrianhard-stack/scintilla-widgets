// W1 (22 Oct 2026): the WIDGETS wall on the real deck, measured in a hidden browser.
//   node w1.mjs <root-of-this-branch> [smoke|all]
// Same rig as Y9: headless shell, the checkout served locally, the chart API fetched by node with the scintillahub.ai
// origin; every non-GET request is aborted (nothing is written anywhere). The TradingView embed, the volume meter and the
// Supabase reads (GET) are let through; YouTube's player is loaded only for the "video playing" picture. Charts: index ETFs.
// Output: ../shots/w1-*.png, ../measure/w1-measure.json.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2]), ONLY = process.argv[3] || "all";
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(MEASURE, { recursive: true });
/* his screens (station_x_health, 22 Oct): the MacBook on its 2560 × 1440 external display (dpr 1); the built-in and the iMac at 1280 × 800 (dpr 2) */
const SCREENS = [["2560x1440", 2560, 1440, 1], ["1280x800", 1280, 800, 2]];
const ETFS = ["SPY", "QQQ", "DIA", "IWM", "XLK", "XLF", "XLE", "SMH", "TLT"];
const WALL = (n) => "/deck/?scene=live&charts=" + n + "&range=3D&" + ETFS.slice(0, n).map((t, i) => "c" + (i + 1) + "=" + t).join("&");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);
async function open(browser, w, h, dpr, { widgets = null, arrangement = null, youtube = false, simpleSymbols = null } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, screen: { width: w, height: h }, timezoneId: "America/New_York" });
  const net = { refused: [], hosts: new Set() };
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host; net.hosts.add(host);
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { net.refused.push(req.method() + " " + host); return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") {
      try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
    }
    if (!youtube && /youtube\.com|googlevideo\.com|google\.com/.test(host)) return route.abort();
    return route.fallback();
  });
  await context.addInitScript(({ widgets, arrangement, simpleSymbols }) => {
    if (window.top !== window) return;
    try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.removeItem("station.chartsOnly");
      if (!sessionStorage.getItem("__w1")) { sessionStorage.setItem("__w1", "1");
        for (const k of ["station.widgets", "station.widgets.arrangement", "station.widgets.chart.1", "station.widgets.chart.2", "station.widgets.tf.1", "station.widgets.tf.2", "station.simple", "station.simple.chart.1", "station.simple.chart.2", "station.lenses.list", "station.lenses.mine"]) localStorage.removeItem(k);
        if (widgets === "1" || widgets === "0") localStorage.setItem("station.widgets", widgets);
        if (arrangement) localStorage.setItem("station.widgets.arrangement", arrangement);
        if (simpleSymbols) { localStorage.setItem("station.simple.chart.1", simpleSymbols[0]); localStorage.setItem("station.simple.chart.2", simpleSymbols[1]); } } } catch (_) {}
  }, { widgets, arrangement, simpleSymbols });
  const page = await context.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 240)));
  return { context, page, errs, net };
}
function readWall() {
  const R = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return cs.display === "none" || r.width === 0 ? null : { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const ls = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const charts = [...document.querySelectorAll("#rowTop > .pane")].map((p) => ({ key: p.dataset.key, box: R(p), off: p.classList.contains("slot-off") || p.classList.contains("chart-off"), src: p.querySelector("iframe") ? p.querySelector("iframe").getAttribute("src") : null })).filter((c) => c.box);
  const video = document.querySelector('.pane[data-key="' + VIDEO_FEED + '"]'), x = document.querySelector('.pane[data-key="x"]');
  const tape = document.querySelector("#tapes .tape"), cell = document.querySelector("#tapes .tape .cell");
  const A = innerWidth * innerHeight;
  const share = (b) => b ? +(b.w * b.h / A * 100).toFixed(1) : null;
  return { win: { w: innerWidth, h: innerHeight }, dpr: devicePixelRatio, body: document.body.className, widgetsOn: typeof widgetsOn === "function" ? widgetsOn() : null, simpleOn: typeof simpleOn === "function" ? simpleOn() : null,
    widgets: typeof WIDGETS_NOW !== "undefined" ? WIDGETS_NOW : undefined, count: CHART_COUNT, tickers: CHARTS.slice(0, 3),
    grid: R(document.getElementById("grid")), rowTop: R(document.getElementById("rowTop")), tapes: R(document.getElementById("tapes")), tape: R(tape), cell: R(cell), tapeRows: document.querySelectorAll("#tapes .tape").length, tapeTall: !!document.querySelector("#tapes .tape.tall"),
    cellText: cell ? cell.innerText.replace(/\n/g, " | ") : null, cellFont: cell ? getComputedStyle(cell).fontSize : null,
    video: video ? { cls: video.className, box: R(video), src: video.querySelector("iframe") ? video.querySelector("iframe").getAttribute("src") : null } : null, x: x ? R(x) : null,
    meter: R(document.getElementById("wgMeter")), lenses: R(document.getElementById("wgLenses")), meterSrc: document.querySelector("#wgMeter iframe")?.getAttribute("src") || null, lensSrc: document.querySelector("#wgLenses iframe")?.getAttribute("src") || null,
    charts, shares: { x: share(x && R(x)), chart1: share(charts[0] && charts[0].box), chart2: share(charts[1] && charts[1].box), video: share(video && R(video)), meter: share(R(document.getElementById("wgMeter"))), lenses: share(R(document.getElementById("wgLenses"))), tapes: share(R(document.getElementById("tapes"))) },
    buttons: { wall: (document.getElementById("wallBtn") || {}).className, simple: (document.getElementById("simpleBtn") || {}).className, widgets: (document.getElementById("widgetsBtn") || {}).className, arr: (document.getElementById("widgetsArrBtn") || {}).textContent, rotate: { text: document.getElementById("rotateToggle").textContent, disabled: document.getElementById("rotateToggle").disabled, title: document.getElementById("rotateToggle").title } },
    stored: { widgets: ls("station.widgets"), arr: ls("station.widgets.arrangement"), c1: ls("station.widgets.chart.1"), c2: ls("station.widgets.chart.2"), tf1: ls("station.widgets.tf.1"), tf2: ls("station.widgets.tf.2"), simple: ls("station.simple"), s1: ls("station.simple.chart.1") },
    rotateTimer: typeof rotateTimer !== "undefined" ? rotateTimer : null };
}
async function settle(page, ms = 700) { await sleep(ms); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }
const out = { at: new Date().toISOString(), root: ROOT, screens: [], today: [] };
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  /* 1. the wall at both screens, both arrangements (a fresh machine, SIMPLE's last symbols SPY and QQQ) */
  for (const [key, W, H, dpr] of SCREENS) {
    for (const arr of ONLY === "smoke" ? ["a"] : ["a", "b"]) {
      const { context, page, errs, net } = await open(browser, W, H, dpr, { arrangement: arr, simpleSymbols: ["SPY", "QQQ"] });
      await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" });
      await sleep(ONLY === "smoke" ? 9000 : 14000); await settle(page);
      const r = await page.evaluate(readWall);
      await page.screenshot({ path: path.join(SHOTS, `w1-widgets-${arr}-${key}.png`) });
      const entry = { screen: key, dpr, arrangement: arr, boot: r, errors: errs, refused: [...new Set(net.refused)] };
      log("widgets", arr, key, "on", r.widgetsOn, "charts", JSON.stringify(r.charts.filter((c) => !c.off).map((c) => [c.key, c.box.w, c.box.h])), "video", JSON.stringify(r.video && r.video.box), "meter", JSON.stringify(r.meter), "lenses", JSON.stringify(r.lenses), "tape", JSON.stringify(r.tape), "errs", errs.length);
      if (ONLY !== "smoke" && arr === "a") {
        /* the switch: WALL -> SIMPLE -> WIDGETS, remembered */
        await page.evaluate(() => document.getElementById("wallBtn").click()); await settle(page, 1200); entry.wall = await page.evaluate(readWall);
        await page.screenshot({ path: path.join(SHOTS, `w1-wall-after-switch-${key}.png`) });
        await page.evaluate(() => document.getElementById("simpleBtn").click()); await settle(page, 1200); entry.simple = await page.evaluate(readWall);
        await page.evaluate(() => document.getElementById("widgetsBtn").click()); await settle(page, 1200); entry.back = await page.evaluate(readWall);
        /* the symbol memory: chart 1's badge -> the box -> NVDA, Enter */
        await page.evaluate(() => focusTickerFor("c1")); await page.keyboard.type("NVDA"); await page.keyboard.press("Enter"); await settle(page, 1500);
        entry.symbol = await page.evaluate(readWall);
        /* the arrangement button */
        await page.evaluate(() => document.getElementById("widgetsArrBtn").click()); await settle(page, 1200); entry.arrB = await page.evaluate(readWall);
        await page.evaluate(() => document.getElementById("widgetsArrBtn").click()); await settle(page, 1200);
        /* the reload: everything comes back */
        await page.reload({ waitUntil: "domcontentloaded" }); await sleep(8000); await settle(page);
        entry.reload = await page.evaluate(readWall);
        log("  switch", "wall", entry.wall.widgetsOn, entry.wall.stored.widgets, "simple", entry.simple.simpleOn, "back", entry.back.widgetsOn, "symbol", entry.symbol.tickers[0], entry.symbol.stored.c1, "reload", entry.reload.tickers[0], entry.reload.stored.c1, entry.reload.stored.arr);
        /* the tape close up (2x) */
        if (entry.reload.tape) { const b = entry.reload.tape; await page.screenshot({ path: path.join(SHOTS, `w1-tape-${key}.png`), clip: { x: b.x, y: b.y, width: Math.min(b.w, 1400), height: b.h } }); }
      }
      await context.close(); out.screens.push(entry);
    }
    if (ONLY !== "smoke") {
      /* today's wall (@a4fae52's WALL mode) at the same screen, for the picture */
      const { context, page, errs } = await open(browser, W, H, dpr, { widgets: "0" });
      await page.goto(origin + WALL(9), { waitUntil: "domcontentloaded" }); await sleep(10000); await settle(page);
      const r = await page.evaluate(readWall); await page.screenshot({ path: path.join(SHOTS, `w1-today-${key}.png`) });
      out.today.push({ screen: key, reading: r, errors: errs }); await context.close();
      log("today", key, "widgets", r.widgetsOn, "simple", r.simpleOn, "video", JSON.stringify(r.video && r.video.box));
    }
  }
  if (ONLY !== "smoke") {
    /* 2. the lens set alone, RADAR and MACRO, at the column's size on the 2560 wall */
    for (const list of ["radar", "macro"]) {
      const { context, page, errs } = await open(browser, 740, 560, 1, {});
      await page.goto(origin + "/station-shells/lens-v1/?shell=v1&list=" + list, { waitUntil: "domcontentloaded" }); await sleep(12000); await settle(page);
      const r = await page.evaluate(() => ({ list: document.body.dataset.list, chips: [...document.querySelectorAll(".chip")].map((c) => c.innerText.replace(/\n/g, " ")), lenses: [...document.querySelectorAll(".lens")].map((l) => ({ t: l.dataset.t, day: l.dataset.day, head: l.querySelector(".head").innerText.replace(/\n/g, " "), why: l.querySelector(".why").textContent, box: (() => { const b = l.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; })(), font: getComputedStyle(l.querySelector(".tk")).fontSize })), stored: localStorage.getItem("station.lenses.list") }));
      await page.screenshot({ path: path.join(SHOTS, `w1-lenses-${list}.png`) });
      out["lenses_" + list] = { reading: r, errors: errs }; await context.close();
      log("lenses", list, r.lenses.length, "drawn", r.lenses.filter((l) => !l.why).length, "first", JSON.stringify(r.lenses[0]));
    }
    /* MINE: add two, remove one, reload */
    { const { context, page, errs } = await open(browser, 740, 560, 1, {});
      await page.goto(origin + "/station-shells/lens-v1/?shell=v1&list=mine", { waitUntil: "domcontentloaded" }); await sleep(2500);
      for (const t of ["NVDA", "AMD"]) { await page.fill("#add", t); await page.press("#add", "Enter"); await sleep(300); }
      await sleep(6000); const before = await page.evaluate(() => ({ mine: localStorage.getItem("station.lenses.mine"), n: document.querySelectorAll(".lens").length }));
      await page.click('.lens[data-t="AMD"] .rm'); await sleep(500);
      await page.reload({ waitUntil: "domcontentloaded" }); await sleep(6000);
      const after = await page.evaluate(() => ({ mine: localStorage.getItem("station.lenses.mine"), list: document.body.dataset.list, n: [...document.querySelectorAll(".lens")].map((l) => l.dataset.t) }));
      await page.screenshot({ path: path.join(SHOTS, `w1-lenses-mine.png`) });
      out.lenses_mine = { before, after, errors: errs }; await context.close(); log("mine", JSON.stringify(before), JSON.stringify(after)); }
    /* 3. the video pane with the grid beside the player (YouTube's player allowed for this one) */
    { const { context, page, errs } = await open(browser, 1206, 616, 1, { youtube: true });
      await page.goto(origin + "/station-shells/scintilla-video-v1/?shell=v1&feed=scintilla&cols=2&beside=1", { waitUntil: "domcontentloaded" }); await sleep(9000);
      const grid0 = await page.evaluate(() => ({ cards: document.querySelectorAll("#grid .card").length, cols: getComputedStyle(document.getElementById("grid")).gridTemplateColumns.split(" ").length, beside: document.body.classList.contains("beside") }));
      /* the first recorded card (not LIVE, not a premiere still to come - Y9 found those leave the player unstarted) */
      const picked = await page.evaluate(() => { const cards = [...document.querySelectorAll("#grid .card")]; const c = cards.find((k) => !/LIVE|live in|premier/i.test(k.innerText)) || cards[0]; if (!c) return null; c.scrollIntoView(); return c.dataset.v; });
      if (picked) { await page.click('#grid .card[data-v="' + picked + '"]'); await sleep(9000); }
      const playing = await page.evaluate(() => { const R = (n) => { const b = n.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
        return { playing: document.body.classList.contains("playing"), beside: document.body.classList.contains("beside"), stage: R(document.getElementById("stage")), grid: R(document.getElementById("grid")), gridDisplay: getComputedStyle(document.getElementById("grid")).display, cols: getComputedStyle(document.getElementById("grid")).gridTemplateColumns.split(" ").length, cards: document.querySelectorAll("#grid .card").length, on: document.querySelector("#grid .card.on")?.dataset.v || null, state: (typeof YT_PLAYER !== "undefined" && YT_PLAYER && YT_PLAYER.getPlayerState) ? YT_PLAYER.getPlayerState() : null }; });
      await page.screenshot({ path: path.join(SHOTS, `w1-video-beside.png`) });
      /* a tap on another thumbnail switches the video; BACK gives the grid the pane */
      const other = await page.evaluate((cur) => { const c = [...document.querySelectorAll("#grid .card")].find((k) => k.dataset.v !== cur && !/LIVE|live in|premier/i.test(k.innerText)); return c ? c.dataset.v : null; }, picked);
      let switched = null; if (other) { await page.click('#grid .card[data-v="' + other + '"]'); await sleep(5000); switched = await page.evaluate(() => ({ cur: typeof CUR !== "undefined" && CUR ? CUR.video_id : null, on: document.querySelector("#grid .card.on")?.dataset.v || null, playing: document.body.classList.contains("playing") })); }
      await page.click("#bBack"); await sleep(1500);
      const back = await page.evaluate(() => ({ playing: document.body.classList.contains("playing"), gridDisplay: getComputedStyle(document.getElementById("grid")).display, cols: getComputedStyle(document.getElementById("grid")).gridTemplateColumns.split(" ").length, gridW: Math.round(document.getElementById("grid").getBoundingClientRect().width) }));
      out.videoBeside = { grid0, picked, playing, other, switched, back, errors: errs }; await context.close();
      log("video beside", JSON.stringify(grid0), "playing", JSON.stringify(playing), "switched", JSON.stringify(switched), "back", JSON.stringify(back)); }
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(MEASURE, ONLY === "smoke" ? "w1-smoke.json" : "w1-measure.json"), JSON.stringify(out, null, 1));
log("wrote", ONLY);
