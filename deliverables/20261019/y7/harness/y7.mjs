// Y7 (19 Oct 2026): the YouTube pane's box on the real deck, before and after, measured in a hidden browser.
//   node y7.mjs <tag> <root> [screen|all]
// Same rig as S11/S12 (headless Chromium from the Visual Supervisor's Playwright, every non-GET request aborted,
// the chart API fetched by node with the scintillahub.ai origin). <root> is the checkout to serve: the archived
// live SHA for "today", this branch for "build". The database reads are the pane's own (GET, the public anon key).
// Nothing is deployed, nothing is written anywhere but ../shots and ../measure.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TAG = process.argv[2] || "today", ROOT = path.resolve(process.argv[3] || path.resolve(HERE, "../../../..")), ONLY = process.argv[4] || "all";
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(MEASURE, { recursive: true });
const SCREENS = [["2560x1440", 2560, 1440, "iMac, native full screen"], ["1680x1050", 1680, 1050, "MacBook"], ["1062x685", 1062, 685, "iMac, the Station's Brave window (16 Oct reading)"]]
  .filter((s) => ONLY === "all" || s[0] === ONLY);
const NINE = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT", "SPY"];
const WALL = "/deck/?scene=live&charts=9&range=3D&" + NINE.map((t, i) => "c" + (i + 1) + "=" + t).join("&");
async function open(browser, w, h) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
    if (host === "scintilla-massive-chart-api.fly.dev") {
      try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
    }
    return route.fallback();
  });
  /* the wall as Alan leaves it: SCINTILLA on the wall, the rotation paused for the measurement, the tapes on */
  await context.addInitScript(() => { if (window.top === window) try {
    localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.removeItem("station.tapes"); localStorage.removeItem("station.chartsOnly");
  } catch (_) {} });
  const page = await context.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
  return { context, page, errs };
}
const rect = (r) => r ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null;
/* what the deck shows: every pane's box, which charts are on the wall, the column, the tapes */
function measureDeck() {
  const R = (n) => n ? (function (r) { return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })(n.getBoundingClientRect()) : null;
  const grid = document.getElementById("grid"), top = document.getElementById("rowTop"), bot = document.getElementById("rowBot");
  const charts = [...document.querySelectorAll('#rowTop > .pane')].map((n) => ({ key: n.dataset.key, shown: getComputedStyle(n).display !== "none", box: getComputedStyle(n).display !== "none" ? R(n) : null,
    cell: (n.style.gridColumn || "") + "/" + (n.style.gridRow || ""), classes: n.className }));
  const video = [...document.querySelectorAll('#rowBot > .pane')].find((n) => n.dataset.key === "fa");
  const x = document.querySelector('#rowBot > .pane[data-key="x"]');
  return { viewport: { w: innerWidth, h: innerHeight }, body: document.body.className, grid: R(grid), chartArea: R(top), column: R(bot),
    x: x ? R(x.querySelector(".body") || x) : null, video: video ? R(video) : null, videoClasses: video ? video.className : "",
    charts, chartsShown: charts.filter((c) => c.shown).length, tapes: R(document.getElementById("tapes")),
    fpCol: grid ? grid.style.getPropertyValue("--fp-col") : "", count: typeof CHART_COUNT === "number" ? CHART_COUNT : null };
}
/* inside the YouTube pane: the bar, the tiles (and which are search clips), the player */
function measurePane() {
  const R = (n) => n ? (function (r) { return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })(n.getBoundingClientRect()) : null;
  const cards = [...document.querySelectorAll("#grid .card")];
  const byId = typeof BYID === "object" ? BYID : {};
  const scoped = (id) => { const v = byId[id]; const a = Array.isArray(v && v.subscription_accounts) ? v.subscription_accounts.map((s) => String(s).toLowerCase()) : []; return a.includes("scintilla"); };
  const search = cards.filter((c) => !scoped(c.dataset.v));
  const visible = cards.filter((c) => { const r = c.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  return { pane: { w: innerWidth, h: innerHeight }, bar: R(document.getElementById("bar")), grid: R(document.getElementById("grid")),
    cols: getComputedStyle(document.getElementById("grid")).getPropertyValue("--cols").trim(), tiles: cards.length, tilesVisible: visible.length,
    tile: cards[0] ? R(cards[0].querySelector(".thumb")) : null, searchTiles: search.length, searchVisible: visible.filter((c) => !scoped(c.dataset.v)).length,
    lists: [...document.querySelectorAll("#chips .btn:not(.mode)")].map((b) => b.textContent.trim()), feedLabel: (document.getElementById("kk") || {}).textContent,
    listNow: typeof LIST === "string" ? LIST : null, mode: typeof MODE === "string" ? MODE : null, playing: document.body.classList.contains("playing"),
    player: R(document.getElementById("video")), menuHasMarket: [...document.querySelectorAll("#more *, #feedProfile option")].some((n) => /market/i.test(n.textContent || "")) };
}
/* the search clips, marked on the picture: an orange frame and the word SEARCH on every tile with no SCINTILLA account */
function markSearch() {
  const byId = typeof BYID === "object" ? BYID : {}; let n = 0;
  for (const c of document.querySelectorAll("#grid .card")) {
    const v = byId[c.dataset.v]; const a = Array.isArray(v && v.subscription_accounts) ? v.subscription_accounts.map((s) => String(s).toLowerCase()) : [];
    if (a.includes("scintilla")) continue; n++;
    c.style.outline = "3px solid #FF8A00"; c.style.outlineOffset = "-3px";
    const t = document.createElement("div"); t.textContent = "SEARCH" + (v && v.tickers ? " · " + String(v.tickers).split(",")[0] : "");
    t.style.cssText = "position:absolute;left:6px;top:6px;z-index:3;background:#FF8A00;color:#000;font:700 11px/1.4 ui-monospace,Menlo,monospace;padding:1px 6px;letter-spacing:.08em";
    const th = c.querySelector(".thumb"); if (th) th.appendChild(t);
  }
  return n;
}
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
const out = { tag: TAG, root: ROOT, at: new Date().toISOString(), screens: {} };
for (const [key, w, h, note] of SCREENS) {
  const { context, page, errs } = await open(browser, w, h);
  const res = { note, errs };
  try {
    await page.goto(origin + WALL, { waitUntil: "domcontentloaded", timeout: 60000 });
    const paneFrame = async () => { const el = await page.waitForSelector('#rowBot > .pane[data-key="fa"] iframe', { timeout: 60000 }); return el.contentFrame(); };
    let pf = await paneFrame();
    await pf.waitForSelector("#grid .card", { timeout: 90000 }).catch(() => {});
    /* give the charts a moment to draw (the picture, not the numbers, needs them) */
    await page.waitForTimeout(12000);
    pf = await paneFrame();
    res.deck = await page.evaluate(measureDeck);
    res.pane = await pf.evaluate(measurePane);
    res.pane.searchMarked = await pf.evaluate(markSearch);
    await page.screenshot({ path: path.join(SHOTS, TAG + "-" + key + "-grid.png") });
    /* then a video playing in the pane: the first tile */
    const first = await pf.$("#grid .card");
    if (first) {
      await first.click(); await pf.waitForSelector("body.playing", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(5000);
      res.playing = await pf.evaluate(measurePane);
      res.deckPlaying = await page.evaluate(measureDeck);
      await page.screenshot({ path: path.join(SHOTS, TAG + "-" + key + "-playing.png") });
    }
  } catch (e) { res.error = String(e && e.message || e).slice(0, 300); }
  out.screens[key] = res;
  console.log(key, JSON.stringify({ video: res.deck && res.deck.video, picture: res.playing && res.playing.player, tile: res.pane && res.pane.tile, charts: res.deck && res.deck.chartsShown, search: res.pane && res.pane.searchTiles, err: res.error }));
  await context.close();
}
fs.writeFileSync(path.join(MEASURE, TAG + ".json"), JSON.stringify(out, null, 2));
await browser.close(); server.close(); process.exit(0);
