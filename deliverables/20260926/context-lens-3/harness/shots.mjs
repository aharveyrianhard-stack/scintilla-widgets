/* SCINTILLA · Context Lens 3 · the workshop page photographed headless (Alan's screen is never taken).
   usage: node shots.mjs */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, proxyApi, refuseOutside } from "./serve.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "screens");
fs.mkdirSync(OUT, { recursive: true });
const PAGE = "/deliverables/20260926/context-lens-3/CONTEXT-LENS-3.html";
const { server, base } = await serve();
const browser = await playwright.chromium.launch({ headless: true });
const tally = { calls: 0, failed: 0, symbols: new Set() };
const shots = [];

async function open(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await proxyApi(ctx, tally); await refuseOutside(ctx, base);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
  await page.goto(base + PAGE, { waitUntil: "load", timeout: 60000 });
  await settle(page);
  return { ctx, page, errors };
}
async function settle(page) {
  await page.waitForFunction(() => window.__lensDone === true, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(800);
}
async function state(page) { return page.evaluate(() => window.__lensState); }
async function snap(page, name, opts = {}) {
  const file = path.join(OUT, name);
  if (opts.clip) await page.screenshot({ path: file, clip: opts.clip, fullPage: true });
  else await page.screenshot({ path: file, fullPage: true, type: name.endsWith(".jpg") ? "jpeg" : "png", quality: name.endsWith(".jpg") ? 82 : undefined });
  return file;
}
async function cardClip(page, id) {
  return page.evaluate((id) => {
    const el = [...document.querySelectorAll(".case")].find((c) => c.querySelector(".case-head .k").textContent.startsWith(id.replace(/-\d$/, "").replace("side", "sideways")) && c.querySelector(".case-head .t").textContent.includes(window.__lensCaseSymbol ? "" : ""));
    return null;
  }, id);
}
function log(label, st, errors) {
  console.log(`\n== ${label} ==`);
  for (const [k, v] of Object.entries(st || {})) console.log(`  ${k.padEnd(14)} ${v.kind === "off" ? "no bubble" : v.kind === "shelf" ? "SHELF · " + v.why : `${v.size} ${v.corner} · ${v.trend} · ${v.why}`}${v.bars != null ? ` · ${v.bars} bars/${v.sessions} sess · last ${v.last} · day ${v.day} · gap ${v.gap}%` : ""}`);
  if (errors.length) console.log("  page errors:", errors.slice(0, 4));
}

/* 1680 — the recommended dials */
{
  const { ctx, page, errors } = await open(1680, 1000);
  const st = await state(page); log("1680 recommended", st, errors);
  shots.push({ name: "gallery-1680.jpg", width: 1680, state: st, errors });
  await snap(page, "gallery-1680.jpg");
  /* each case card on its own */
  const boxes = await page.$$eval(".case", (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { k: el.querySelector(".case-head .k").textContent, t: el.querySelector(".case-head .t").textContent, x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }; }));
  const ids = ["up-1", "up-2", "down-1", "down-2", "side-1", "side-2", "gap-1", "gap-2"];
  boxes.forEach((b, i) => shots.push({ name: `case-${ids[i]}-1680.png`, card: b.t }));
  for (let i = 0; i < boxes.length; i++) await snap(page, `case-${ids[i]}-1680.png`, { clip: { x: boxes[i].x, y: boxes[i].y, width: boxes[i].w, height: boxes[i].h } });
  /* the same eight at the 2-up pane size (SPY + QQQ's size) */
  await page.selectOption("#k-pane", "2up"); await page.waitForTimeout(1400);
  const stB = await state(page); log("1680 · 2-up pane", stB, errors);
  shots.push({ name: "pane-2up-1680.png", dials: "2-up pane, recommended dials", state: stB });
  const boxesB = await page.$$eval(".case", (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }; }));
  await snap(page, "pane-2up-1680.png", { clip: { x: boxesB[0].x, y: boxesB[0].y, width: boxesB[0].w * 2 + 18, height: boxesB[0].h * 2 + 18 } });
  await page.selectOption("#k-pane", "8up"); await page.waitForTimeout(1400);
  /* the dials moved: 1h, Large, volume on */
  await page.selectOption("#k-tf", "1h"); await page.selectOption("#k-size", "L"); await page.click("#k-vol");
  await page.waitForTimeout(900);
  const st2 = await state(page); log("1680 · 1h · Large · volume", st2, errors);
  shots.push({ name: "dial-1h-L-volume-1680.png", dials: "1h, Large, volume on", state: st2 });
  await snap(page, "dial-1h-L-volume-1680.png", { clip: { x: boxes[0].x, y: boxes[0].y, width: boxes[0].w * 2 + 18, height: boxes[0].h * 2 + 18 } });
  /* 15m, five sessions, extended hours, Small */
  await page.selectOption("#k-tf", "15m"); await page.selectOption("#k-size", "S"); await page.click("#k-vol");
  await page.selectOption("#k-hours", "extended"); await page.$eval("#k-sessions", (el) => { el.value = 5; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForTimeout(900);
  const st3 = await state(page); log("1680 · 15m · Small · 5 sessions · extended", st3, errors);
  shots.push({ name: "dial-15m-S-5-extended-1680.png", dials: "15m, Small, 5 sessions, extended hours", state: st3 });
  await snap(page, "dial-15m-S-5-extended-1680.png", { clip: { x: boxes[0].x, y: boxes[0].y, width: boxes[0].w * 2 + 18, height: boxes[0].h * 2 + 18 } });
  /* bubble off: the page as it is today */
  await page.click("#k-reset"); await page.click("#k-bubble"); await page.waitForTimeout(900);
  await snap(page, "bubble-off-1680.png", { clip: { x: boxes[0].x, y: boxes[0].y, width: boxes[0].w * 2 + 18, height: boxes[0].h } });
  shots.push({ name: "bubble-off-1680.png", dials: "bubble off" });
  await ctx.close();
}
/* 390 — the phone */
{
  const { ctx, page, errors } = await open(390, 844);
  const st = await state(page); log("390 recommended", st, errors);
  shots.push({ name: "gallery-390.jpg", width: 390, state: st, errors });
  await snap(page, "gallery-390.jpg");
  const boxes = await page.$$eval(".case", (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }; }));
  await snap(page, "case-up-1-390.png", { clip: { x: boxes[0].x, y: boxes[0].y, width: boxes[0].w, height: boxes[0].h } });
  await snap(page, "case-gap-1-390.png", { clip: { x: boxes[6].x, y: boxes[6].y, width: boxes[6].w, height: boxes[6].h } });
  shots.push({ name: "case-up-1-390.png" }, { name: "case-gap-1-390.png" });
  await ctx.close();
}
await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify({ taken_utc: new Date().toISOString(), api_calls: tally.calls, api_failed: tally.failed, symbols: [...tally.symbols].sort(), shots }, null, 1));
console.log(`\nchart-API calls proxied: ${tally.calls} (failed ${tally.failed}) — the page draws from its saved cases, so this should be 0`);
