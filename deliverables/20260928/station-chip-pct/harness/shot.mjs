// Headless only. node shot.mjs <root> <path> <out.png> [--w=1680] [--wait=14000] [--hover=0.35,0.55] [--pane=0]
// Serves <root> locally; the chart API is fetched by node with the scintillahub.ai origin (the API only admits that origin).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const [root, p, outPng, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const W = +(opt.w || 1680), H = W < 600 ? 844 : 1050, MOBILE = W < 600;
const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.normalize(path.join(root, clean));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: MOBILE, hasTouch: MOBILE });
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
    if (host === "scintilla-massive-chart-api.fly.dev") {
      try {
        const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
        return route.fulfill({ status: r.status, contentType: "application/json", body: await r.text(), headers: { "access-control-allow-origin": "*" } });
      } catch (e) { return route.abort(); }
    }
    return route.fallback();
  });
  await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message.slice(0, 200)));
  await page.goto(origin + p);
  await page.waitForTimeout(+(opt.wait || 14000));
  // every chart host, in the top page or in a visible pane frame
  const hosts = async () => {
    const out = [];
    for (const f of page.frames()) {
      try {
        const r = await f.evaluate(() => {
          const h = document.querySelector(".sc-nchart"); if (!h) return null;
          const fe = window.frameElement;
          if (fe) { const cs = getComputedStyle(fe); if (cs.opacity === "0" || cs.visibility === "hidden" || !fe.offsetWidth || fe.classList.contains("slot-next") || fe.classList.contains("slot-spare")) return null; }
          const area = h.querySelector(".sc-nchart__area"), a = area.getBoundingClientRect();
          const off = fe ? fe.getBoundingClientRect() : { left: 0, top: 0 };
          const badge = h.querySelector(".sc-nchart__live"), g = h.querySelector(".sc-nchart__live-geiger");
          const bar = g && g.querySelector(".sc-gbar"), v = g && g.querySelector(".sc-gbar__v");
          const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.left - a.left, r.top - a.top, r.width, r.height].map((x) => +x.toFixed(1)); };
          return { t: h.dataset.t, area: [a.width, a.height].map(Math.round), off: [off.left + a.left, off.top + a.top],
            badgeFont: badge ? getComputedStyle(badge).fontSize : null, plot: h._plot ? { padL: h._plot.padL, iw: h._plot.iw, padT: h._plot.padT, ih: h._plot.ih } : null,
            chip: g ? { vis: g.hidden ? "hidden" : g.style.visibility, why: g.dataset.why, size: g.dataset.size || "", box: box(g), bar: box(bar), vFont: v ? getComputedStyle(v).fontSize : null, text: v ? v.textContent : "", capH: v ? (() => { const c = document.createElement("canvas").getContext("2d"); c.font = getComputedStyle(v).font; const m = c.measureText("H"); return +m.actualBoundingBoxAscent.toFixed(2); })() : null, digitH: v ? (() => { const c = document.createElement("canvas").getContext("2d"); c.font = getComputedStyle(v).font; const m = c.measureText("0"); return +(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent).toFixed(2); })() : null } : null };
        });
        if (r) out.push(r);
      } catch (_) {}
    }
    return out;
  };
  let hs = await hosts();
  if (opt.hover) {
    const [fx, fy] = opt.hover.split(",").map(Number);
    const h = hs[+(opt.pane || 0)];
    if (h && h.plot) {
      const x = h.off[0] + h.plot.padL + h.plot.iw * fx, y = h.off[1] + h.plot.padT + h.plot.ih * fy;
      await page.mouse.move(x - 20, y - 10); await page.mouse.move(x, y, { steps: 4 });
      await page.waitForTimeout(600);
    }
  }
  await page.screenshot({ path: outPng });
  console.log(JSON.stringify({ path: p, w: W, hosts: hs, errs, scrub: await (async () => { const o = []; for (const f of page.frames()) { try { const r = await f.evaluate(() => { const h = document.querySelector(".sc-nchart"); return h && h._scrubLabel ? Object.assign({ t: h.dataset.t }, h._scrubLabel) : null; }); if (r) o.push(r); } catch (_) {} } return o; })() }, null, 0));
} finally {
  await browser.close();
  server.close();
}
