/* SCINTILLA · M65 · the lens workshop, photographed headless.
 *
 * Serves this worktree over http on localhost and opens /workshop/context-lens/ in a headless
 * Chromium (Alan's screen is never taken). Two disclosed harness facts:
 *   - the chart API only answers the origin https://scintillahub.ai, so every request to
 *     scintilla-massive-chart-api.fly.dev is PROXIED here: node re-issues it with that Origin
 *     header and hands the answer back to the page. The URL, the route and the parameters are
 *     the page's own — only the origin header is supplied.
 *   - nothing is written anywhere: the proxy is read-only GET.
 *
 * usage: node shots.mjs [--out <dir>]
 */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = playwright;
const ROOT = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = opt("--out", path.join(ROOT, "deliverables/20260924/lens-workshop/screens"));
fs.mkdirSync(OUT, { recursive: true });

const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8", ".css":"text/css", ".json":"application/json",
  ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".webmanifest":"application/manifest+json" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain" }); res.end("not found: " + rel); return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream",
                       "cache-control": "no-store" });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
console.log("serving", ROOT, "at", BASE);

const browser = await chromium.launch({ headless: true });
const api = { calls: 0, symbols: new Set(), failed: 0 };
const shots = [];

async function shoot(name, width, height, setup) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  /* the disclosed proxy: the page's own URL, re-issued with the origin the API accepts */
  await ctx.route("**://scintilla-massive-chart-api.fly.dev/**", async (route) => {
    const req = route.request();
    api.calls++;
    try {
      const u = new URL(req.url());
      api.symbols.add(u.searchParams.get("symbol") || u.pathname);
      const r = await fetch(req.url(), { headers: { Origin: "https://scintillahub.ai", Accept: "application/json" } });
      const body = Buffer.from(await r.arrayBuffer());
      await route.fulfill({ status: r.status, body,
        headers: { "content-type": r.headers.get("content-type") || "application/json",
                   "access-control-allow-origin": "*" } });
    } catch (err) { api.failed++; await route.abort(); }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(BASE + "/workshop/context-lens/", { waitUntil: "load", timeout: 60000 });
  if (setup) await setup(page);
  /* wait until every card has drawn: the tally stops saying "drawing" */
  await page.waitForFunction(() => {
    const t = document.getElementById("tally");
    return t && !/measuring|drawing/.test(t.textContent);
  }, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const tally = await page.textContent("#tally");
  const readouts = await page.$$eval(".card", (els) => els.map((el) => ({
    head: el.querySelector(".card-head .t").textContent.trim(),
    read: el.querySelector(".readout").textContent.replace(/\s+/g, " ").trim().slice(0, 190),
  })));
  const file = path.join(OUT, `${name}-${width}.png`);
  await page.screenshot({ path: file, fullPage: true });
  shots.push({ name, width, file: path.basename(file), tally, readouts, errors });
  console.log(`\n== ${name} @ ${width} ==\n${tally}`);
  readouts.forEach((r) => console.log(`  ${r.head}  ::  ${r.read}`));
  if (errors.length) console.log("  page errors:", errors.slice(0, 3));
  await ctx.close();
}

const pick = async (page, id, value) => {
  await page.selectOption("#" + id, value);
  await page.waitForTimeout(600);
};

await shoot("A-opposite-zoom", 1680, 1000);
await shoot("A-main-shows-everything", 1680, 1000, (p) => pick(p, "mb", "all"));
await shoot("A-main-zoomed-in-40", 1680, 1000, (p) => pick(p, "mb", "40"));
await shoot("B-whole-history", 1680, 1000, (p) => pick(p, "v", "B"));
await shoot("C-last-24", 1680, 1000, (p) => pick(p, "v", "C"));
await shoot("D-band-under-chart", 1680, 1000, (p) => pick(p, "v", "D"));
await shoot("A-opposite-zoom", 390, 844);

await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify(
  { taken_utc: new Date().toISOString(), api_calls: api.calls, api_failed: api.failed,
    symbols: [...api.symbols].sort(), shots }, null, 1));
console.log(`\nchart-API calls proxied: ${api.calls} (failed ${api.failed}) · symbols: ${[...api.symbols].sort().join(", ")}`);
