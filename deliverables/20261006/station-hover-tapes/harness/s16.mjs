// S16 (6 Oct 2026): the chart hover on XLI and ESUSD, and the tape marks, on the real deck in a hidden browser.
//   node s16.mjs <before|after>
// Same rig as S11-S15 (headless Chromium, every non-GET request aborted and counted, the chart API fetched by node with
// the scintillahub.ai origin). 1680 x 1050. It hovers the XLI pane and the ESUSD pane, reads what the pane says it drew
// (the labels' boxes and texts), pictures the pane and the deck, then pictures the two tapes and reads their type.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../.."), OUT = path.resolve(HERE, "../shots");
const TAG = process.argv[2] || "after", W = 1680, H = 1050;
const NINE = ["XLI", "ESUSD", "AVGO", "BE", "AMZN", "VST", "MU", "WMT", "SPY"];
const URL_ = "/deck/?scene=live&charts=9&range=3D&" + NINE.map((t, i) => "c" + (i + 1) + "=" + t).join("&");
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
let blocked = 0;
await context.route("**/*", async (route) => {
  const req = route.request(), url = req.url(), host = new URL(url).host;
  if (host.startsWith("127.0.0.1")) return route.fallback();
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { blocked++; return route.abort(); }
  if (host === "scintilla-massive-chart-api.fly.dev") {
    try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
      return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); }
  }
  return route.fallback();
});
await context.addInitScript(() => { if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
await page.goto(origin + URL_);
const paneOf = (t) => page.evaluate((t) => { for (const f of document.querySelectorAll("#rowTop > .pane.chart-pane iframe:not(.slot-spare)")) { try { const h = f.contentDocument.querySelector('.sc-nchart[data-t="' + t + '"], [data-t="' + t + '"]');
  if (h && h._series && h._series.length > 2 && h._ov) { const b = f.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; } } catch (_) {} } return null; }, t);
let t0 = Date.now(), ready = false;
while (Date.now() - t0 < 90000) { await page.waitForTimeout(2000);
  const tapesOk = await page.evaluate(() => { const s = document.getElementById("tapes"); return !!s && [...s.querySelectorAll('.cell:not([aria-hidden="true"]) .px')].filter((e) => e.textContent !== "—").length > 20; });
  if (tapesOk && await paneOf("XLI") && await paneOf("ESUSD")) { ready = true; break; } }
await page.waitForTimeout(6000);
const res = { tag: TAG, ready, hover: {}, tapes: null };
const read = (t) => page.evaluate((t) => { for (const f of document.querySelectorAll("#rowTop > .pane.chart-pane iframe:not(.slot-spare)")) { try { const h = [...f.contentDocument.querySelectorAll("[data-t]")].find((n) => n.dataset.t === t && n._ov);
  if (h) return { readout: h._scrubLabel, level: h._levelTag, live: h._liveTag, time: h._scrubTimeTag, area: (() => { const a = h.querySelector(".sc-nchart__area").getBoundingClientRect(); return { w: a.width, h: a.height }; })() }; } catch (_) {} } return null; }, t);
for (const t of ["XLI", "ESUSD"]) {
  const b = await paneOf(t); if (!b) { res.hover[t] = null; continue; }
  /* three pointer heights: the middle of the plot, and low enough that the pointer's label meets the corner */
  for (const [name, fx, fy] of [["mid", 0.42, 0.42], ["low", 0.5, 0.72]]) {
    await page.mouse.move(b.x + b.w * fx - 20, b.y + b.h * fy - 10); await page.mouse.move(b.x + b.w * fx, b.y + b.h * fy, { steps: 4 }); await page.waitForTimeout(700);
    res.hover[t + "-" + name] = Object.assign({ pane: b }, await read(t), { otherPane: await read(t === "XLI" ? "ESUSD" : "XLI") });
    await page.screenshot({ path: path.join(OUT, `s16-${TAG}-hover-${t}-${name}.png`), clip: { x: b.x, y: b.y, width: b.w, height: b.h } });
    if (name === "mid") await page.screenshot({ path: path.join(OUT, `s16-${TAG}-hover-${t}-deck.png`) });
  }
}
await page.mouse.move(W - 5, 300); await page.waitForTimeout(800);
/* the tapes: wait for the marks, then picture them still (the pointer away, the animation held for the picture) */
await page.waitForTimeout(TAG === "after" ? 8000 : 2000);
res.tapes = await page.evaluate(() => { const s = document.getElementById("tapes"); const fs = (n) => { if (!n) return null; const c = getComputedStyle(n); return { family: c.fontFamily, size: c.fontSize, weight: c.fontWeight, spacing: c.letterSpacing }; };
  const real = (sel) => [...s.querySelectorAll('[data-tape="' + sel + '"] .cell:not([aria-hidden="true"])')];
  const mark = (c) => ({ t: c.dataset.t, rungs: c.querySelectorAll(".g i").length, bar: (() => { const g = c.querySelector(".gb"); if (!g) return null; const b = g.getBoundingClientRect(), i = g.querySelector("i"); return { w: b.width, h: b.height, side: g.classList.contains("up") ? "up" : g.classList.contains("down") ? "down" : null, fill: i ? i.getBoundingClientRect().width : 0, color: i ? getComputedStyle(i).backgroundColor : null, title: g.title.split("\n")[0] }; })(),
    spark: (() => { const v = c.querySelector("svg.spark, canvas.spark, .spark"); if (!v) return null; const b = v.getBoundingClientRect(); return { w: b.width, h: b.height, drawn: [...v.querySelectorAll("path")].some((p) => (p.getAttribute("d") || "").length > 4), upColor: getComputedStyle(v.children[0]).stroke, dnColor: getComputedStyle(v.children[1]).stroke }; })(), h: c.getBoundingClientRect().height, w: c.getBoundingClientRect().width });
  const fav = real("FAVORITES").map(mark), liked = real("LIKED").map(mark);
  return { font: { cell: fs(s.querySelector(".cell")), ticker: fs(s.querySelector(".cell .tk")), price: fs(s.querySelector(".cell .px")), label: fs(s.querySelector(".lbl")), body: fs(document.body), topbarButton: fs(document.querySelector("button.btn")), symbolInput: fs(document.querySelector("#t1")) ,
      loaded: [...document.fonts].map((f) => f.family + ":" + f.status) },
    favorites: { n: fav.length, withBar: fav.filter((m) => m.bar).length, barsFilled: fav.filter((m) => m.bar && m.bar.fill > 0).length, withSpark: fav.filter((m) => m.spark && m.spark.drawn).length, withRungs: fav.filter((m) => m.rungs).length, sample: fav.slice(0, 4) },
    liked: { n: liked.length, withBar: liked.filter((m) => m.bar).length, barsFilled: liked.filter((m) => m.bar && m.bar.fill > 0).length, withSpark: liked.filter((m) => m.spark).length, withRungs: liked.filter((m) => m.rungs).length, sample: liked.slice(0, 3) },
    tallest: Math.max(...fav.concat(liked).map((m) => m.h)), box: (() => { const b = s.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })(), stripPx: Math.round(innerHeight - document.getElementById("rowTop").getBoundingClientRect().bottom) };
});
/* which font the browser actually used for the tape and for a chart badge (the first available face of the stack) */
const tb = res.tapes.box;
await page.screenshot({ path: path.join(OUT, `s16-${TAG}-tapes.png`), clip: { x: tb.x, y: tb.y - 40, width: Math.min(900, tb.w), height: tb.h + 40 } });
await page.screenshot({ path: path.join(OUT, `s16-${TAG}-tapes-wide.png`), clip: { x: tb.x, y: tb.y - 4, width: tb.w, height: tb.h + 4 } });
await page.screenshot({ path: path.join(OUT, `s16-${TAG}-deck.png`) });
res.blockedWrites = blocked; res.pageErrors = errs;
fs.writeFileSync(path.join(HERE, `s16-${TAG}.json`), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
await browser.close(); server.close();
