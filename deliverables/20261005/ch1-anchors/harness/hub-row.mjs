// Headless, GET only: what the live Hub board prints for one ticker, and what the served quote says.
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const t = process.argv[2] || "CBRS", out = process.argv[3];
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
const seen = [];
await context.route("**/*", (route) => { const r = route.request(); if (!["GET", "HEAD", "OPTIONS"].includes(r.method())) return route.abort();
  const u = r.url(); if (/quotes|live_quotes/.test(u)) seen.push(u.slice(0, 160)); return route.continue(); });
const page = await context.newPage();
await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
await page.waitForFunction((t) => document.querySelector('[data-act="row"][data-t="' + t + '"]'), t, { timeout: 90000 });
await new Promise((r) => setTimeout(r, 12000));
const row = await page.evaluate((t) => { const r = document.querySelector('[data-act="row"][data-t="' + t + '"]'); return { text: r.textContent.trim().replace(/\s+/g, " "), html: r.outerHTML.slice(0, 1200) }; }, t);
const pc = await page.evaluate((t) => ({ prevClose: typeof prevClose !== "undefined" ? prevClose[t] : null, S: typeof S !== "undefined" && S.quotes ? S.quotes[t] : null }), t);
console.log(JSON.stringify({ row: row.text, pc, seen: seen.slice(0, 8) }, null, 1));
if (out) { const r = await page.$('[data-act="row"][data-t="' + t + '"]'); await r.scrollIntoViewIfNeeded(); await page.screenshot({ path: out }); }
await browser.close();
