// Headless only. node hold.mjs <root> : hovers the first TARGETS pane and samples whether its crosshair is
// still drawn every second for 15 s while the pointer does not move.
import { serve, open } from "./rig.mjs";
const root = process.argv[2];
const { server, origin } = await serve(root);
const { browser, context } = await open({ width: 1680 });
const out = [];
try {
  const page = await context.newPage();
  await page.goto(origin + "/deck/?scene=targets3D");
  await page.waitForTimeout(16000);
  let fr = null, box = null;
  for (const f of page.frames()) {
    const r = await f.evaluate(() => { const h = document.querySelector(".sc-nchart"), fe = window.frameElement; if (!h || !h._plot || !fe || !fe.offsetWidth || getComputedStyle(fe).opacity === "0") return null; const a = h.querySelector(".sc-nchart__area").getBoundingClientRect(), o = fe.getBoundingClientRect(); return { x: o.left + a.left + h._plot.padL + h._plot.iw * .55, y: o.top + a.top + h._plot.padT + h._plot.ih * .35, top: o.top }; }).catch(() => null);
    if (r && (!box || r.top < box.top)) { box = r; fr = f; }
  }
  await page.mouse.move(box.x - 20, box.y); await page.mouse.move(box.x, box.y, { steps: 3 });
  for (let s = 0; s <= 15; s++) {
    out.push(await fr.evaluate(() => !!document.querySelector(".sc-nchart")._scrubLabel));
    await page.waitForTimeout(1000);
  }
} finally { await browser.close(); server.close(); }
console.log(JSON.stringify({ root, drawnEachSecond: out.map((b) => (b ? 1 : 0)).join("") }));
