// Y4 pictures — headless only, 1680 × 1050 (plus the deck's pane width and a phone). Every non-GET request is
// blocked and counted; the pages are served from a checkout on a local port; the feed is the live one, read-only.
//   node deliverables/20261006/y4-youtube-grid/tools/shots.mjs <label> [--root <dir>] [--only deck,grid,pane,phone,watch]
//        [--write before|after]   the answer the blocked Watch Later write is given (see WRITE_ANSWERS)
//        [--fixture <json>]       rows merged into the first page of the feed (SIMULATED — the file says so)
//        [--find "<channel>"]     scroll the grid to that channel's newest tile before the picture
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../..");
const arg = (name, fallback) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : fallback; };
const label = process.argv[2] || "shot";
const ROOT = path.resolve(arg("root", REPO));
const OUT = path.join(HERE, "../screens");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  let file = path.join(ROOT, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ headless: true });
const report = { label, root: ROOT === REPO ? "this branch" : "the live branch (origin/station/merge-20260923), exported", at: new Date().toISOString(), blocked_writes: 0, shots: [] };
const fixture = arg("fixture", "") ? JSON.parse(fs.readFileSync(arg("fixture"), "utf8")) : null;
if (fixture) report.simulated = fixture.note || "rows merged into the feed's first page";
const WRITE_ANSWERS = {
  /* what the live function answered on 6 Oct 13:22Z to a save with no video id (nothing was written) — replayed */
  before: { error: "personal YouTube authorization unavailable", account: "personal", status: 400, code: "invalid_grant" },
  /* what the new function answers while the sign-in is down (tests/station-y4-youtube-grid-20261006.test.mjs) */
  after: { ok: true, saved: true, account: "personal", youtube: "waiting", waiting: 1, why: "personal YouTube authorization unavailable", code: "invalid_grant" },
};
async function open(width, height, url, name, after, opts = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await context.route("**/*", async (route) => {
    const req = route.request();
    if (req.method() !== "GET" && req.method() !== "HEAD" && req.method() !== "OPTIONS") {
      report.blocked_writes++;
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(WRITE_ANSWERS[arg("write", "")] || { error: "blocked by the test browser" }) });
    }
    const u = req.url();
    const inject = fixture && fixture.inject && u.includes("/rest/v1/youtube_feed?") && !u.includes("offset=") &&
      !u.includes("live_state=eq.live") && !u.includes("limit=1") ? fixture.inject.youtube_feed : null;
    if (inject) {
      const real = await route.fetch(); let rows = [];
      try { rows = await real.json(); } catch (_) {}
      if (!Array.isArray(rows)) return route.fulfill({ response: real });
      const have = new Set(rows.map((r) => r.video_id));
      const merged = rows.concat(inject.filter((r) => !have.has(r.video_id))).sort((a, b) => Date.parse(b.feed_at) - Date.parse(a.feed_at));
      return route.fulfill({ response: real, body: JSON.stringify(merged) });
    }
    return route.continue();
  });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  await page.goto(base + url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(+arg("wait", 9000));
  /* --find "<channel>": scroll the grid until that channel's newest tile is in the first row shown (nothing is drawn on the page) */
  let found = null;
  if (arg("find", "")) found = await page.evaluate((name) => {
    const card = [...document.querySelectorAll("#grid .card")].find((c) => (c.querySelector(".ch")?.textContent || "").includes(name));
    if (!card) return { channel: name, tile: null };
    const grid = document.getElementById("grid"); grid.scrollTop = Math.max(0, card.offsetTop - 4);
    return { channel: name, tile: [...grid.querySelectorAll(".card")].indexOf(card) + 1, title: card.querySelector(".t")?.textContent || "", age: card.querySelector(".age")?.textContent || "" };
  }, arg("find", ""));
  if (found) await page.waitForTimeout(2500);
  const acted = opts.act ? await opts.act(page) : found;
  const facts = after ? await after(page) : null;
  const file = path.join(OUT, label + "-" + name + ".png");   /* converted to .jpg afterwards (sips, quality 78) to keep the branch light */
  await page.screenshot({ path: file });
  report.shots.push({ name, url, width, height, file: path.relative(REPO, file), errors: errors.slice(0, 5), acted, facts });
  await context.close();
}
const NAMED = ["Tyler Wilson", "Verified Investing", "Market Signal", "WOLF Trading"];
const tileFacts = async (page) => {
  const frame = page.frames().find((f) => /video-v1/.test(f.url()) && /feed=scintilla/.test(f.url())) ||
    page.frames().find((f) => /scintilla-video-v1|personal-video-v1/.test(f.url())) || page.mainFrame();
  return frame.evaluate((NAMED) => {
    const cards = [...document.querySelectorAll("#grid .card")];
    const vis = (n) => { if (!n) return false; const s = getComputedStyle(n), r = n.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0; };
    const star = document.querySelector("#grid .star"); const cs = star ? getComputedStyle(star) : null;
    const tile = (c, i) => ({ n: i + 1, id: c.dataset.v, ch: c.querySelector(".ch")?.textContent || "", age: c.querySelector(".age")?.textContent || "",
      live: !!c.querySelector(".age[data-live]"), badge: c.querySelector(".dur")?.textContent || "", not_started: !!c.querySelector(".dur.soon"),
      src: c.querySelector(".src")?.dataset.src || "", star: c.querySelector(".star")?.textContent || "", t: (c.querySelector(".t")?.textContent || "").slice(0, 52) });
    const all = cards.map(tile);
    const flash = document.getElementById("wlFlash");
    const a = document.querySelector("#grid .age"), as = a ? getComputedStyle(a) : null;
    return { url: location.pathname + location.search, pane: [innerWidth, innerHeight], tiny: document.body.classList.contains("tiny"),
      cols: getComputedStyle(document.getElementById("grid")).gridTemplateColumns.split(" ").length, tiles: cards.length,
      not_started_tiles: all.filter((t) => t.not_started).length, not_started_among_first_12: all.slice(0, 12).filter((t) => t.not_started).length,
      age_visible: cards.filter((c) => vis(c.querySelector(".age"))).length, age_style: as ? as.fontSize + " " + as.fontWeight + " " + as.color : null,
      star_style: cs ? { color: cs.color, background: cs.backgroundColor, border: cs.borderTopWidth + " " + cs.borderTopColor, width: Math.round(star.getBoundingClientRect().width) } : null,
      saved_tiles: cards.filter((c) => c.querySelector(".star.on")).length, flash: flash && flash.classList.contains("show") ? flash.textContent : "",
      sources: { subscribed: all.filter((t) => t.src === "sub").length, search: all.filter((t) => t.src === "search").length },
      named: Object.fromEntries(NAMED.map((name) => [name, all.filter((t) => t.ch.includes(name)).slice(0, 4)])),
      first: all.slice(0, 12) };
  }, NAMED);
};
const clickStar = async (page) => {
  const star = page.locator("#grid .card .star").nth(2);
  const id = await star.getAttribute("data-star");
  await star.click(); await page.waitForTimeout(1500);
  return { clicked_watch_later_on: id };
};
const only = arg("only", "");
const GRID = "/station-shells/scintilla-video-v1/index.html?shell=v1&feed=scintilla&limit=200";
const want = (name) => !only || only.split(",").includes(name);
if (want("deck")) await open(1680, 1050, "/deck/", "deck-1680x1050", tileFacts);
if (want("grid")) await open(1680, 1050, GRID, "grid-1680x1050", tileFacts);
if (want("pane")) await open(403, 760, GRID + "&cols=2", "pane-403x760", tileFacts);
if (want("phone")) await open(390, 844, GRID, "phone-390", tileFacts);
if (want("watch")) await open(1680, 1050, GRID, "watch-1680x1050", tileFacts, { act: clickStar });
await browser.close(); server.close();
fs.writeFileSync(path.join(OUT, label + ".json"), JSON.stringify(report, null, 1));
console.log(label + ": " + report.shots.map((s) => s.name).join(", ") + " · blocked writes " + report.blocked_writes);
