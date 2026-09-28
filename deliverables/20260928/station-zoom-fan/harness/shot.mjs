// node shot.mjs <root> <outPng> <deckPath> [--clock=ISO|real] [--settle=ms] [--zoomout=N] [--w=1680]
// Headless only. Chart API proxied from Node with Origin https://scintillahub.ai (read-only GETs,
// cached on disk under ./apicache so before/after see the same bars). Rotation paused.
import { open } from "./rig.mjs";
const [root, out, p, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const W = +(opt.w || 1680), H = W < 600 ? 844 : 1050;
const r = await open({ root, width: W, height: H, replayOnly: opt.replay === "1" });
await r.context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
/* count the chart canvases' pixel read-backs (what the lens placement costs) */
await r.context.addInitScript(() => { const g = CanvasRenderingContext2D.prototype.getImageData; window.__gid = 0;
  CanvasRenderingContext2D.prototype.getImageData = function (...a) { window.__gid++; return g.apply(this, a); }; });
if (opt.clock && opt.clock !== "real") await r.context.clock.setFixedTime(new Date(opt.clock));
await r.page.goto(r.origin + p);
await r.page.waitForTimeout(+(opt.settle || 16000));
const frames = () => r.page.frames().filter((f) => /chart/.test(f.url()));
const gid = async () => { let n = 0; for (const f of frames()) { try { n += await f.evaluate(() => window.__gid || 0); } catch (_) {} } return n; };
let gidBefore = null, gidAfter = null;
if (opt.zoomin) { opt.zoomout = opt.zoomin; opt.dir = -1; }
if (opt.zoomout) {
  gidBefore = await gid();
  // wheel-zoom OUT on the first chart pane, N notches, then let it settle
  const f = frames()[0];
  const el = await (f ? f.frameElement() : null);
  if (el) { const b = await el.boundingBox(); await r.page.mouse.move(b.x + b.width * .5, b.y + b.height * .4);
    for (let i = 0; i < +opt.zoomout; i++) { await r.page.mouse.wheel(0, 120 * (opt.dir || 1)); await r.page.waitForTimeout(60); } }
  await r.page.waitForTimeout(2500);
  gidAfter = await gid();
}
await r.page.screenshot({ path: out });
const info = [];
for (const f of frames()) {
  try { const x = await f.evaluate(async () => { const h = document.querySelector("#chartSlot .sc-nchart") || document.querySelector(".sc-nchart"); if (!h || !h._series) return null;
    /* proof of the lens rule: does the drawn lens touch the newest fifth, the badge, the chip, the price line? */
    let check = "-";
    if (h._lens && h._lens.spot && h._plot) {
      const P = await import("/_indicators/lens-placement.mjs");
      const pts = P.pathPoints(h._plot, h._series), L = h._lens.spot, tail = P.lineTailBox ? P.lineTailBox(h._plot, pts) : P.tailBox(h._plot);
      const a = h.querySelector(".sc-nchart__area").getBoundingClientRect();
      const rel = (el) => { if (!el || !el.offsetWidth || el.hidden) return null; const b = el.getBoundingClientRect(); return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height }; };
      const hit = (p, q) => !!q && !(p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y);
      const g = h.querySelector(".sc-nchart__live-geiger");
      check = `tail:${L.x + L.w <= tail.x + 0.5 ? "clear" : "HIT"} badge:${hit(L, rel(h.querySelector(".sc-nchart__live"))) ? "HIT" : "clear"} chip:${g && !g.hidden && g.style.visibility !== "hidden" && hit(L, rel(g)) ? "HIT" : "clear"} price:${P.clearsPrice(L, pts, 0) ? "clear" : "crossed"}`;
    }
    const q = new URLSearchParams(location.search), pl = h._plot || {}, s = h._series;
    const g = h.querySelector(".sc-nchart__live-geiger"), gs = g && !g.hidden ? g.getBoundingClientRect() : null;
    const rs = h._rsiDrawn ? h._rsiDrawn.lines.map((l) => l.key + ":" + (l.value == null ? "-" : l.value)).join(" ") : "-";
    return { t: h.dataset.t, range: q.get("range"), rsi: q.get("rsi") || "-", bars: s.length, view: pl.start + "-" + pl.end,
      from: s[pl.start] ? s[pl.start].d.slice(0, 10) : "-", to: s[pl.end] ? s[pl.end].d.slice(0, 16) : "-",
      lens: (h.dataset.lensWhy || "-") + (h._lens && h._lens.spot ? " @" + Math.round(h._lens.spot.x) + "," + Math.round(h._lens.spot.y) : ""),
      geiger: gs ? Math.round(gs.x) + "," + Math.round(gs.y) + " " + (g.dataset.why || "") : "none", plotW: Math.round(pl.iw), rsiLines: rs,
      cloud: h._rsiDrawn && h._rsiDrawn.cloud ? h._rsiDrawn.cloud.lo + "-" + h._rsiDrawn.cloud.hi : "-", tags: h._rsiDrawn ? (h._rsiDrawn.tags || []).map((t) => t.key).join(",") : "-",
      lateStart: h._rsiDrawn && h._rsiDrawn.late ? h._rsiDrawn.late.map((l) => l.text).join(" | ") : "-", lensCheck: check }; });
    if (x) info.push(x); } catch (_) {}
}
const label = await r.page.evaluate(() => (document.querySelector("#sceneMode") || {}).value || document.title);
console.log(JSON.stringify({ out: out.split("/").pop(), scene: label, clock: opt.clock || "real",
  zoom: opt.zoomout ? { notches: +opt.zoomout, pixelReadsDuringZoom: gidAfter - gidBefore } : null, panes: info }, null, 1));
if (r.logs.some((l) => /PAGEERROR/.test(l))) console.log(r.logs.filter((l) => /PAGEERROR/.test(l)).slice(0, 5).join("\n"));
await r.close();
