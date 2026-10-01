// Headless only. node chartsonly.mjs <root> <out-prefix> [--w=1680]
// Shows the dock, finds the CHARTS ONLY button, presses it, measures the wall, reloads (remembered),
// lets rotation run 20 s seconds while charts-only is on, presses it again (media back). Also the W key.
import fs from "node:fs";
import { serve, open } from "./rig.mjs";
const [root, out, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const W = +(opt.w || 1680);
const { server, origin } = await serve(root);
const { browser, context } = await open({ width: W });
const R = { w: W };
const state = (page) => page.evaluate(() => {
  const r = (id) => { const n = document.getElementById(id); if (!n) return null; const b = n.getBoundingClientRect(), cs = getComputedStyle(n); return { top: Math.round(b.top), h: Math.round(b.height), opacity: cs.opacity, display: cs.display, position: cs.position }; };
  const b = document.getElementById("chartsOnlyBtn"), bb = b && b.getBoundingClientRect(), bcs = b && getComputedStyle(b);
  const xFrame = Array.from(document.querySelectorAll("#rowBot iframe")).map((f) => ({ src: (f.getAttribute("src") || "").split("?")[0], live: !!f.contentWindow, w: Math.round(f.getBoundingClientRect().width) }));
  return { on: document.body.classList.contains("charts-only"), stored: localStorage.getItem("station.chartsOnly"),
    button: b ? { text: b.textContent, pressed: b.getAttribute("aria-pressed"), display: bcs.display, visible: bb.width > 0 && bb.height > 0, w: Math.round(bb.width), h: Math.round(bb.height), x: Math.round(bb.left), y: Math.round(bb.top) } : null,
    rowTop: r("rowTop"), rowBot: r("rowBot"), grid: r("grid"), media: xFrame, scene: typeof SCENE !== "undefined" ? SCENE : null };
});
try {
  const page = await context.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  await page.goto(origin + "/deck/?scene=targets3D");
  await page.waitForTimeout(14000);
  /* bring the tucked dock down the way a pointer does: move to the top edge */
  await page.mouse.move(W / 2, 3); await page.waitForTimeout(900);
  R.before = await state(page);
  await page.screenshot({ path: out + "-dock.png", clip: { x: 0, y: 0, width: W, height: 90 } });
  await page.click("#chartsOnlyBtn");
  await page.mouse.move(W / 2, 500); await page.waitForTimeout(2500);
  R.on = await state(page);
  await page.screenshot({ path: out + "-on.png" });
  await page.reload(); await page.waitForTimeout(14000);
  R.afterReload = await state(page);
  /* rotation keeps running while the media is hidden: unpause, shortest interval, watch the page change */
  const s0 = (await state(page)).scene;
  await page.evaluate(() => { setRotationInterval(20); setRotationPaused(false); });
  await page.waitForTimeout(24000);
  R.rotation = { from: s0, to: (await state(page)).scene, chartsOnlyStill: (await state(page)).on };
  await page.evaluate(() => setRotationPaused(true));
  await page.screenshot({ path: out + "-on-rotated.png" });
  await page.mouse.move(W / 2, 3); await page.waitForTimeout(900);
  await page.click("#chartsOnlyBtn"); await page.mouse.move(W / 2, 500); await page.waitForTimeout(2000);
  R.off = await state(page);
  await page.screenshot({ path: out + "-off.png" });
  await page.keyboard.press("w"); await page.waitForTimeout(800);
  R.keyW = { on: (await state(page)).on };
  await page.keyboard.press("w"); await page.waitForTimeout(800);
  R.keyW.offAgain = !(await state(page)).on;
  R.errs = errs;
} finally { await browser.close(); server.close(); }
fs.writeFileSync(out + ".json", JSON.stringify(R, null, 1));
console.log(JSON.stringify(R));
