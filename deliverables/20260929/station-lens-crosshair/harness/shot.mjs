// Headless only. node shot.mjs <root> <path> <out.png> [--w=1680] [--wait=15000] [--hover=0.62,0.35] [--pane=0] [--clip=pane]
// Screenshots a deck page; with --hover, moves the mouse onto one pane's plot (crosshair up) first.
import { serve, open } from "./rig.mjs";
const [root, p, outPng, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const W = +(opt.w || 1680);
const { server, origin } = await serve(root);
const { browser, context } = await open({ width: W });
try {
  const page = await context.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  await page.goto(origin + p);
  await page.waitForTimeout(+(opt.wait || 15000));
  const hosts = [];
  for (const f of page.frames()) {
    try {
      const r = await f.evaluate(() => {
        const h = document.querySelector(".sc-nchart"); if (!h) return null;
        const fe = window.frameElement;
        if (fe) { const cs = getComputedStyle(fe); if (cs.opacity === "0" || cs.visibility === "hidden" || !fe.offsetWidth || fe.classList.contains("slot-next") || fe.classList.contains("slot-spare")) return null; }
        const a = h.querySelector(".sc-nchart__area").getBoundingClientRect();
        const off = fe ? fe.getBoundingClientRect() : { left: 0, top: 0 };
        const lens = h.querySelector(".sc-nchart__lens");
        return { t: h.dataset.t, range: S.chartRange, off: [off.left + a.left, off.top + a.top], area: [a.width, a.height],
          plot: h._plot ? { padL: h._plot.padL, iw: h._plot.iw, padT: h._plot.padT, ih: h._plot.ih } : null,
          lens: lens && lens.style.display === "block" ? { key: h._lens && h._lens.key, state: h.dataset.lensState, last: h._lens && h._lens.last, box: [lens.style.left, lens.style.top, lens.style.width, lens.style.height].join(" ") } : { why: h.dataset.lensWhy || null },
          quote: liveQuote[h.dataset.t] ? liveQuote[h.dataset.t].price : null, readoutSpot: h._readoutSpot || null };
      });
      if (r) hosts.push(r);
    } catch (_) {}
  }
  hosts.sort((a, b) => a.off[1] - b.off[1] || a.off[0] - b.off[0]);
  let scrub = null;
  if (opt.hover) {
    const [fx, fy] = opt.hover.split(",").map(Number);
    const h = hosts[+(opt.pane || 0)];
    if (h && h.plot) {
      const x = h.off[0] + h.plot.padL + h.plot.iw * fx, y = h.off[1] + h.plot.padT + h.plot.ih * fy;
      await page.mouse.move(x - 20, y - 10); await page.mouse.move(x, y, { steps: 4 });
      await page.waitForTimeout(700);
      for (const f of page.frames()) { try { const r = await f.evaluate((t) => { const hh = document.querySelector(".sc-nchart"); return hh && hh._scrubLabel ? Object.assign({ t: hh.dataset.t }, hh._scrubLabel) : null; }); if (r) scrub = r; } catch (_) {} }
    }
  }
  await page.screenshot({ path: outPng });
  console.log(JSON.stringify({ path: p, w: W, hosts, scrub, errs }));
} finally { await browser.close(); server.close(); }
