// O2 (5 Oct 2026) — the Indicator Lab's page on the Hub, photographed READ-ONLY and headless at 1680 x 1050.
// usage: node lab-page.mjs <hubRoot> <outDir>. The files are read from disk and answered to the browser; nothing is written
// under prototypes/indicator-lab/ or to lab.html, and every non-GET request is aborted.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const [hubRoot, outDir] = process.argv.slice(2);
const MIME = { html: "text/html; charset=utf-8", js: "text/javascript", css: "text/css", json: "application/json", png: "image/png", svg: "image/svg+xml" };
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (req.method() !== "GET") return route.abort();
    if (u.host !== "scintillahub.ai") return route.abort();
    let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
    const f = path.join(hubRoot, p);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(f) });
    return route.fulfill({ status: 404, body: "nf" });
  });
  const page = await context.newPage();
  for (const [name, url] of [["lab-page-index", "https://scintillahub.ai/prototypes/indicator-lab/"], ["lab-page-lab-html", "https://scintillahub.ai/lab.html"]]) {
    await page.goto(url, { waitUntil: "load" }); await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, name + "-1680.png") });
    const hit = await page.evaluate(() => { const el = [...document.querySelectorAll("a, h2, h3, p, div")].filter((e) => /Merged MTF|MTF review/i.test(e.textContent) && e.children.length < 3).pop(); if (el) el.scrollIntoView({ block: "center" }); return el ? el.textContent.trim().slice(0, 120) : null; });
    if (hit) { await page.waitForTimeout(400); await page.screenshot({ path: path.join(outDir, name + "-mtf-1680.png") }); }
    console.log(name, "| found:", hit);
  }
} finally { await browser.close(); }
