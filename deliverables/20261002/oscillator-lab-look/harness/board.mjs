// S7 items 2+3 — the Hub board: which tab it opens on, and a lowest-first sort with the dashes at the bottom. HEADLESS ONLY.
// usage: node board.mjs <index.html> <width> <outdir> <tag>. The Hub document is answered from the local file; every other read
// goes to the live services as the page sends it; EVERY non-GET request is aborted (nothing can write a like, a list or a row).
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [file, W, OUT, TAG] = process.argv.slice(2);
const html = fs.readFileSync(file), width = +W || 1680, phone = width < 600;
const result = { tag: TAG, width, at: new Date().toISOString(), blocked: [], errors: [], steps: {} };
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 1050 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { result.blocked.push(req.method() + " " + u.host + u.pathname); return route.abort(); }
    if (u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html"))
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html, headers: { "cache-control": "no-store" } });
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => result.errors.push(String(e).slice(0, 240)));
  const seen = [];
  await page.exposeFunction("__coh", (c) => seen.push(c));
  await page.addInitScript(() => { const t = setInterval(() => { try { if (typeof S !== "undefined") window.__coh(S.coh + "|" + document.querySelectorAll("#boardPanel .sc-board__row[data-t]").length); } catch (_) {} }, 150); setTimeout(() => clearInterval(t), 30000); });
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof S !== "undefined" && window.SC_RANK_READY && document.querySelectorAll("#boardPanel .sc-board__row[data-t]").length > 3, null, { timeout: 90000 });
  await sleep(5000);
  const state = () => page.evaluate(() => ({ coh: S.coh, sort: S.sort,
    tabOn: [...document.querySelectorAll("[data-act='coh'].on, [data-act='coh'][aria-pressed='true'], [data-act='coh'].is-on")].map((b) => b.textContent.trim()),
    hdr: [...document.querySelectorAll("#boardPanel .ch.hdr > *")].map((c) => c.textContent.trim()).filter(Boolean),
    rows: [...document.querySelectorAll("#boardPanel .sc-board__row[data-t]")].map((r) => [r.dataset.t, (r.querySelector(".sc-fpe") || {}).textContent]) }));
  result.steps.open = await state();
  result.cohTimeline = [...new Set(seen)];
  await page.screenshot({ path: `${OUT}/${TAG}-board-open.png` });
  /* F P/E: first click highest first, second click lowest first */
  for (let i = 0; i < 2; i++) { await page.evaluate(() => document.querySelector('#boardPanel [data-act="sort"][data-key="fpe"]').click()); await sleep(700); }
  result.steps.fpeAsc = await state();
  await page.evaluate(() => { const rows = document.querySelectorAll("#boardPanel .sc-board__row[data-t]"); const last = rows[rows.length - 1]; if (last) last.scrollIntoView({ block: "end" }); });
  await sleep(500);
  await page.screenshot({ path: `${OUT}/${TAG}-board-fpe-lowest-first-bottom.png` });
} finally { await browser.close(); }
fs.writeFileSync(`${OUT}/${TAG}-board.json`, JSON.stringify(result, null, 1));
console.log(TAG, width, "coh", result.steps.open && result.steps.open.coh, "timeline", result.cohTimeline.slice(0, 8).join(","), "fpeAsc tail", JSON.stringify(result.steps.fpeAsc && result.steps.fpeAsc.rows.slice(-6)), "errs", result.errors.length, "blocked", result.blocked.length);
