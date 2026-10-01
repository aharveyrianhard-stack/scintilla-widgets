// Headless only. node crosshair.mjs <root> <out-prefix> [--w=1680] [--scene=targets3D] [--wait=16000]
// Desktop: hovers one pane, reads every visible pane's overlay, holds still, counts base vs overlay paints,
// leaves the chart area. Phone (--w<600): taps one pane, reads, waits past four seconds.
import fs from "node:fs";
import { serve, open } from "./rig.mjs";
const [root, out, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const W = +(opt.w || 1680), PHONE = W < 600;
const { server, origin } = await serve(root);
const { browser, context } = await open({ width: W });
const report = { w: W, scene: opt.scene || "targets3D", at: new Date().toISOString() };
try {
  const page = await context.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
  await page.goto(origin + "/deck/?scene=" + (opt.scene || "targets3D"));
  await page.waitForTimeout(+(opt.wait || 16000));
  /* count base and overlay paints in every chart frame (classic-script globals, so the wrap is what runs) */
  const charts = async () => {
    const hosts = [];
    for (const f of page.frames()) {
      try {
        const r = await f.evaluate(() => {
          const h = document.querySelector(".sc-nchart"); if (!h) return null;
          const fe = window.frameElement;
          if (fe) { const cs = getComputedStyle(fe); if (cs.opacity === "0" || cs.visibility === "hidden" || !fe.offsetWidth || fe.classList.contains("slot-next") || fe.classList.contains("slot-spare")) return null; }
          if (!window.__s5) {
            window.__s5 = { base: 0, ov: 0 };
            const b = window.scChartDraw, o = window.scChartOverlay;
            if (b && o) { window.scChartDraw = function () { window.__s5.base++; return b.apply(this, arguments); }; window.scChartOverlay = function () { window.__s5.ov++; return o.apply(this, arguments); }; }
          }
          const a = h.querySelector(".sc-nchart__area").getBoundingClientRect();
          const off = fe ? fe.getBoundingClientRect() : { left: 0, top: 0 };
          const pts = h._series || [];
          return { t: h.dataset.t, off: [off.left + a.left, off.top + a.top], area: [Math.round(a.width), Math.round(a.height)],
            plot: h._plot ? { padL: h._plot.padL, iw: h._plot.iw, padT: h._plot.padT, ih: h._plot.ih } : null,
            hoverLocal: !!h._hoverLocal, hoverAt: h._hoverAt == null ? null : new Date(h._hoverAt).toISOString(),
            label: h._scrubLabel, level: h._levelTag, timeTag: h._scrubTimeTag, paints: Object.assign({}, window.__s5),
            last: pts.length ? { d: pts[pts.length - 1].d, p: pts[pts.length - 1].p } : null,
            quote: window.liveQuote && liveQuote[h.dataset.t] ? liveQuote[h.dataset.t].price : null,
            ovCanvas: !!h.querySelector(".sc-nchart__ov") };
        });
        if (r) hosts.push(r);
      } catch (_) {}
    }
    return hosts.sort((a, b) => a.off[1] - b.off[1] || a.off[0] - b.off[0]);
  };
  let hosts = await charts();
  report.panes = hosts.length;
  const target = hosts.find((h) => h.plot) || hosts[0];
  const pt = (h, fx, fy) => [h.off[0] + h.plot.padL + h.plot.iw * fx, h.off[1] + h.plot.padT + h.plot.ih * fy];
  if (!PHONE) {
    const [x, y] = pt(target, .55, .35);
    await page.mouse.move(x - 30, y - 10); await page.mouse.move(x, y, { steps: 5 });
    await page.waitForTimeout(800);
    hosts = await charts();
    report.hover = hosts;
    await page.screenshot({ path: out + "-hover.png" });
    await page.screenshot({ path: out + "-hover-crop.png", clip: { x: Math.max(0, target.off[0] - 4), y: Math.max(0, target.off[1] - 4), width: Math.min(W, target.area[0] * 2 + 12), height: target.area[1] + 8 } });
    /* the pointer holds still for twelve seconds: quote ticks repaint the base, the crosshair must survive */
    const before = hosts.map((h) => h.paints);
    await page.waitForTimeout(12000);
    hosts = await charts();
    report.after12s = hosts.map((h, i) => ({ t: h.t, label: !!h.label, mode: h.label && h.label.mode, basePaints: h.paints.base - (before[i] ? before[i].base : 0) }));
    /* a sweep of 40 moves across the pane: overlay paints only */
    const p0 = hosts.map((h) => h.paints);
    for (let k = 0; k <= 40; k++) { const [xx, yy] = pt(target, .15 + .7 * k / 40, .3 + .3 * k / 40); await page.mouse.move(xx, yy); }
    await page.waitForTimeout(400);
    hosts = await charts();
    report.sweep = hosts.map((h, i) => ({ t: h.t, base: h.paints.base - p0[i].base, overlay: h.paints.ov - p0[i].ov }));
    /* onto the ticker badge, which sits on top of the canvas: the crosshair stays */
    const badge = await page.evaluate(() => null);
    /* then off the chart area altogether: every pane clears */
    await page.mouse.move(W / 2, 2);
    await page.waitForTimeout(600);
    hosts = await charts();
    report.left = hosts.map((h) => ({ t: h.t, label: !!h.label, hoverAt: h.hoverAt }));
    await page.screenshot({ path: out + "-left.png" });
  } else {
    const [x, y] = pt(target, .55, .35);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(700);
    hosts = await charts();
    report.tap = hosts;
    await page.screenshot({ path: out + "-tap.png" });
    await page.screenshot({ path: out + "-tap-crop.png", clip: { x: 0, y: Math.max(0, target.off[1] - 4), width: W, height: Math.min(844, target.area[1] * 2 + 12) } });
    await page.waitForTimeout(2500);
    report.at3s = (await charts()).map((h) => ({ t: h.t, label: !!h.label }));
    await page.waitForTimeout(2000);
    report.at5s = (await charts()).map((h) => ({ t: h.t, label: !!h.label }));
  }
  report.errs = errs;
} finally { await browser.close(); server.close(); }
fs.writeFileSync(out + ".json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, (k, v) => (k === "off" || k === "plot" || k === "timeTag" ? undefined : v)).slice(0, 6000));
