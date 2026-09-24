/* SCINTILLA · M51 · "nothing reloads under Alan's hand" — headless proof.
 *
 * Two measurements, each run against the SAME real pages, once with the bytes that shipped
 * (ed02f99) and once with this branch:
 *   A  reloads under his hand : the deck is scrolled continuously inside the YouTube pane while a
 *                               new version of the deck appears on the server. How many times does
 *                               the page reload while his hand is on it? And does it still update
 *                               once he stops?
 *   B  the feed's own refresh : the grid is scrolled down with the pointer in the list while newer
 *                               videos arrive. Does the list stay where he left it?
 *
 * Disclosed harness facts (nothing here is a claim about production timing):
 *  - the clock is scaled so a three-minute check and a two-minute quiet window fit in a test run.
 *    The server rewrites SELF_UPDATE_MS / SELF_UPDATE_IDLE_MS / the feed's 120 s pass, and prints
 *    the numbers it used. The LOGIC under test is untouched.
 *  - every off-machine request is intercepted: the YouTube feed rows are synthetic, and the chart
 *    API, YouTube and fonts are never called. Nothing leaves this Mac.
 *  - headless always (Alan's screen is never taken).
 *
 * usage: node station-calm-harness.mjs --label before|after [--out <dir>]
 */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const { chromium } = playwright;
/* fileURLToPath, not .pathname: this repo lives under a path with a space in it. */
const ROOT = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const BASE_SHA = "ed02f99";
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LABEL = opt("--label", "after");
const OUT = opt("--out", path.join(ROOT, "deliverables/20260924/station-calm/harness/out"));
fs.mkdirSync(OUT, { recursive: true });

/* ---- the clock, scaled and disclosed ---------------------------------------------------------- */
const CLOCK = { selfUpdateMs: 1000, idleMs: 2500, firstCheckMs: 700, feedPassMs: 1500 };

const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8", ".css":"text/css", ".json":"application/json",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon" };

let DECK_VERSION = 1;                       // bumped to simulate a deploy
const fromDisk = (rel) => fs.readFileSync(path.join(ROOT, rel));
const fromBase = (rel) => execFileSync("git", ["show", `${BASE_SHA}:${rel}`], { cwd: ROOT, maxBuffer: 64e6 });
const source = (rel) => (LABEL === "before" ? fromBase(rel) : fromDisk(rel));

function scaleClock(text) {
  return text
    .replace(/const SELF_UPDATE_MS = \d+;/, `const SELF_UPDATE_MS = ${CLOCK.selfUpdateMs};`)
    .replace(/const SELF_UPDATE_IDLE_MS = \d+;/, `const SELF_UPDATE_IDLE_MS = ${CLOCK.idleMs};`)
    .replace(/setTimeout\(selfUpdateCheck, \d+\)/, `setTimeout(selfUpdateCheck, ${CLOCK.firstCheckMs})`)
    .replace(/\}, 120000\);/g, `}, ${CLOCK.feedPassMs});`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (rel === "" || rel === "deck/") rel = "deck/index.html";
  if (rel.endsWith("/")) rel += "index.html";
  /* the deck mounts its panes without a trailing slash (/station-shells/personal-video-v1?…),
     which a naive static server answers with a 404 — and then the harness measures a 404. */
  try { if (fs.statSync(path.join(ROOT, rel)).isDirectory()) rel += "/index.html"; } catch (_) {}
  let body;
  try { body = source(rel); } catch (_) { res.writeHead(404); res.end("no"); return; }
  const ext = path.extname(rel);
  if (ext === ".html" || ext === ".js") body = Buffer.from(scaleClock(body.toString("utf8")), "utf8");
  const etag = rel === "deck/index.html" ? `W/"deck-${DECK_VERSION}"` : `W/"${rel}-1"`;
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream", etag,
    "cache-control": "no-store", "access-control-allow-origin": "*" });
  res.end(req.method === "HEAD" ? undefined : body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/* ---- synthetic feed rows (never YouTube, never Supabase) -------------------------------------- */
let FEED_EXTRA = 0;                        // newer videos that arrive mid-run
const feedRows = () => {
  const rows = [];
  for (let i = 0; i < 60 + FEED_EXTRA; i++) {
    const n = 60 + FEED_EXTRA - i;         // newest first
    rows.push({ video_id: `vid${String(n).padStart(3, "0")}`, title: `synthetic clip ${n}`,
      channel: "harness", published_at: new Date(Date.UTC(2026, 8, 24, 0, 0, 0) - n * 3600e3).toISOString(),
      feed_at: new Date(Date.UTC(2026, 8, 24, 0, 0, 0) - n * 3600e3).toISOString(),
      thumb_url: "", duration: "PT5M", live_state: "none", subscription_accounts: ["personal"] });
  }
  return rows;
};

const record = { label: LABEL, clock: CLOCK, origin: ORIGIN, steps: [] };
const say = (k, v) => { record.steps.push({ [k]: v }); console.log(`  ${k}: ${JSON.stringify(v)}`); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
await ctx.route("**/*", async (route) => {
  const u = route.request().url();
  if (u.startsWith(ORIGIN)) return route.continue();
  if (u.includes("/rest/v1/youtube_feed")) {
    return route.fulfill({ status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(feedRows()) });
  }
  if (u.includes("/rest/v1/")) {
    return route.fulfill({ status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*" }, body: "[]" });
  }
  return route.abort();                    // chart API, YouTube, fonts: never called
});

const page = await ctx.newPage();
let LOADS = 0;
page.on("load", () => { LOADS++; });
await page.goto(`${ORIGIN}/deck/index.html?scene=live`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

/* find the YouTube pane frame and its box on the page */
const frames = page.frames().map((f) => f.url()).filter((u) => u.includes("video-v1"));
say("video frames mounted", frames.length);
const box = await page.evaluate(() => {
  const f = [...document.querySelectorAll("iframe")].find((el) => (el.src || "").includes("video-v1"));
  if (!f) return null;
  const r = f.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
say("video pane box", box);
if (!box) { console.log("UNABLE — no video pane mounted"); }

const videoFrame = page.frames().find((f) => f.url().includes("video-v1"));
if (videoFrame) {
  await videoFrame.waitForSelector(".card", { timeout: 8000 }).catch(() => {});
  say("tiles in the feed", await videoFrame.evaluate(() => document.querySelectorAll(".card").length));
}

/* ---- A · reloads under his hand ---------------------------------------------------------------- */
const wheelFor = async (ms) => {
  const end = Date.now() + ms;
  await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2);
  while (Date.now() < end) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(120);
  }
};
LOADS = 0;
DECK_VERSION++;                                  // a deploy lands
const underHandStart = Date.now();
await wheelFor(7000);                            // Alan scrolls the feed for seven scaled seconds
const reloadsUnderHand = LOADS;
say("A · reloads while his hand was on the feed", reloadsUnderHand);
say("A · scrolling seconds", Math.round((Date.now() - underHandStart) / 1000));
await page.waitForTimeout(6000);                 // he stops
const reloadsAfterQuiet = LOADS - reloadsUnderHand;
say("A · reloads after he stopped (the update still happens)", reloadsAfterQuiet);

/* ---- B · the feed's own refresh ---------------------------------------------------------------- */
const frame = page.frames().find((f) => f.url().includes("video-v1"));
let before = null, after = null, released = null;
if (frame) {
  await frame.evaluate(() => { const g = document.getElementById("grid"); if (g) g.scrollTop = 900; });
  await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2);   // the pointer stays in the list
  await page.mouse.move(box.x + box.w / 2 + 4, box.y + box.h / 2 + 4);
  const topTile = () => frame.evaluate(() => {
    const g = document.getElementById("grid"); if (!g) return null;
    const card = [...g.querySelectorAll(".card")].find((c) => c.offsetTop + c.offsetHeight > g.scrollTop);
    return { scrollTop: Math.round(g.scrollTop), tile: card ? card.dataset.v : null, tiles: g.querySelectorAll(".card").length };
  });
  before = await topTile();
  FEED_EXTRA = 2;                                 // two newer videos arrive
  await page.waitForTimeout(CLOCK.feedPassMs * 3);
  after = await topTile();
  say("B · before the refresh", before);
  say("B · after the refresh", after);
  say("B · the video under the top edge stayed", before && after ? before.tile === after.tile : null);
  say("B · pixels jumped", before && after ? after.scrollTop - before.scrollTop : null);
  /* and the held refresh is not a lost refresh: his hand leaves, the new videos land. */
  await page.mouse.move(box.x + box.w / 2, 40);
  await page.waitForTimeout(CLOCK.feedPassMs * 3);
  released = await topTile();
  say("B · after his hand left the list", released);
}

record.result = { reloadsUnderHand, reloadsAfterQuiet,
  feedKeptItsPlace: before && after ? before.tile === after.tile : null,
  feedPixelJump: before && after ? after.scrollTop - before.scrollTop : null,
  heldRefreshLanded: before && released ? released.tiles > before.tiles : null,
  keptPlaceAfterRelease: before && released ? released.tile === before.tile : null };
fs.writeFileSync(path.join(OUT, `station-calm-${LABEL}.json`), JSON.stringify(record, null, 1));
await page.screenshot({ path: path.join(OUT, `station-calm-${LABEL}-1680.png`) });
await browser.close();
server.close();
console.log(`\n${LABEL}: reloads under hand ${reloadsUnderHand} · after he stopped ${reloadsAfterQuiet} · feed kept its place ${record.result.feedKeptItsPlace}`);
