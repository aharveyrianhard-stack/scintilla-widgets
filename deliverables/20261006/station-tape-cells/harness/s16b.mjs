// S16b (6 Oct 2026): the hover's label count on XLI and ESUSD, and the tape cells, on the real deck in a hidden browser.
//   node s16b.mjs <live|s16|s16b> <repo root to serve>
// Same rig as S11-S16 (headless Chromium, every non-GET request aborted and counted, the chart API fetched by node with
// the scintillahub.ai origin - the cross-origin check is relaxed locally). 1680 x 1050.
// THE LABEL COUNT DOES NOT TRUST THE PAGE'S OWN BOOKKEEPING: every canvas text call in every frame is recorded (reset
// each time a canvas is wiped), so what a pane's hover layer actually drew is read back as text + position. A hover
// label is a text the hover ADDED - present with the pointer on the pane, absent with it away.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.resolve(HERE, "../shots");
const TAG = process.argv[2] || "s16b", ROOT = path.resolve(process.argv[3] || path.resolve(HERE, "../../../.."));
const W = 1680, H = 1050;
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
await context.addInitScript(() => {
  if (window.top === window) try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {}
  const P = CanvasRenderingContext2D.prototype, ft = P.fillText, cr = P.clearRect;
  P.fillText = function (text, x, y) { const c = this.canvas; (c.__txt || (c.__txt = [])).push({ text: String(text), x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, ink: String(this.fillStyle) }); return ft.apply(this, arguments); };
  P.clearRect = function (x, y, w) { const c = this.canvas; if (x === 0 && y === 0 && w * this.getTransform().a >= c.width - 1) c.__txt = []; return cr.apply(this, arguments); };
});
const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200)));
await page.goto(origin + URL_);
/* a pane: where its frame and its plot area are on the page, what its hover layer drew, and the page's own notes */
const pane = (t) => page.evaluate((t) => { for (const f of document.querySelectorAll("#rowTop > .pane.chart-pane iframe:not(.slot-spare)")) { try {
  const h = [...f.contentDocument.querySelectorAll("[data-t]")].find((n) => n.dataset.t === t && n._ov && n._series && n._series.length > 2); if (!h) continue;
  const fb = f.getBoundingClientRect(), a = h.querySelector(".sc-nchart__area").getBoundingClientRect(), ov = h.querySelector(".sc-nchart__ov");
  const vis = (n) => { const b = n.getBoundingClientRect(), c = f.contentWindow.getComputedStyle(n); return b.width > 0 && b.height > 0 && c.visibility !== "hidden" && c.display !== "none" && +c.opacity > 0; };
  const dom = [...f.contentDocument.querySelectorAll("body *")].filter((n) => !n.children.length && /%/.test(n.textContent || "") && vis(n)).map((n) => ({ cls: String(n.className).slice(0, 40), text: n.textContent.trim().slice(0, 40), y: Math.round(n.getBoundingClientRect().top) }));
  return { frame: { x: fb.x, y: fb.y, w: fb.width, h: fb.height }, area: { x: fb.x + a.x, y: fb.y + a.y, w: a.width, h: a.height }, g: { padT: h._ov.padT, ih: h._ov.ih },
    drawn: (ov.__txt || []).slice(), domPercentTexts: dom, notes: { corner: h._scrubLabel, pointer: h._levelTag, marker: h._liveTag, time: h._scrubTimeTag } };
} catch (_) {} } return null; }, t);
let t0 = Date.now(), ready = false;
while (Date.now() - t0 < 90000) { await page.waitForTimeout(2000);
  const tapesOk = await page.evaluate(() => { const s = document.getElementById("tapes"); return !!s && [...s.querySelectorAll('.cell:not([aria-hidden="true"]) .px')].filter((e) => e.textContent !== "—").length > 20; });
  if (tapesOk && await pane("XLI") && await pane("ESUSD")) { ready = true; break; } }
await page.waitForTimeout(6000);
const res = { tag: TAG, root: ROOT, at: new Date().toISOString(), ready, viewport: { w: W, h: H }, hover: {}, tapes: null };
const PCT = /[+\-−]?\d[\d,.]*%/;
const key = (d) => d.x + "@" + d.ink + "," + d.y;
for (const t of ["XLI", "ESUSD"]) {
  await page.mouse.move(200, 500); await page.waitForTimeout(900);   /* the X column: off every chart, so no pane holds a pointer or a synced date */
  const rest = await pane(t); if (!rest) { res.hover[t] = null; continue; }
  const restKeys = new Set(rest.drawn.map(key)), restTexts = new Set(rest.drawn.map((d) => d.x + "@" + d.ink));   /* the marker keeps its right edge and its ink when it steps or ticks */
  res.hover[t + "-rest"] = { drawn: rest.drawn, notes: rest.notes };
  const a = rest.area, plotTop = a.y + rest.g.padT, plotH = rest.g.ih;
  /* three heights in the plot, and a fourth exactly on the current-price marker (where S16's label stepped off the line) */
  const heights = [["high", plotTop + plotH * 0.2], ["mid", plotTop + plotH * 0.47], ["low", plotTop + plotH * 0.8]];
  if (rest.notes.marker) heights.push(["at-price", a.y + rest.notes.marker.y + 6]);
  for (const [name, py] of heights) {
    const px = a.x + a.w * 0.42;
    await page.mouse.move(px - 20, py - 8); await page.mouse.move(px, py, { steps: 5 }); await page.waitForTimeout(800);
    const p = await pane(t), cursorY = Math.round((py - a.y) * 10) / 10;
    /* what the hover added: texts on the hover layer that were not there with the pointer away (the marker may have moved: matched by text) */
    const added = p.drawn.filter((d) => !restKeys.has(key(d)) && !restTexts.has(d.x + "@" + d.ink));
    const pct = added.filter((d) => PCT.test(d.text));
    const pctAll = p.drawn.filter((d) => PCT.test(d.text));
    const priceRows = added.filter((d) => !PCT.test(d.text) && /^[\d,.]+$/.test(d.text));
    /* a price/% label = a percent text plus the price text within 20 px above or below it (or beside it) */
    const labels = pct.map((q) => { const pr = priceRows.filter((r) => Math.abs(r.y - q.y) <= 22).sort((m, n) => Math.abs(m.y - q.y) - Math.abs(n.y - q.y))[0] || null;
      const top = Math.min(q.y, pr ? pr.y : q.y), bottom = Math.max(q.y, pr ? pr.y : q.y);
      return { price: pr ? pr.text : null, pct: q.text, priceY: pr ? pr.y : null, pctY: q.y, offCursorPx: Math.round(Math.min(Math.abs((pr ? pr.y : q.y) - cursorY), Math.abs(q.y - cursorY)) * 10) / 10,
        onCursorLevel: cursorY >= top - 8 && cursorY <= bottom + 8 }; });
    const others = {};
    for (const o of NINE) if (o !== t) { const q = await pane(o); if (q) others[o] = q.drawn.filter((d) => PCT.test(d.text)).length; }
    res.hover[t + "-" + name] = { cursorY, plot: { top: rest.g.padT, bottom: rest.g.padT + rest.g.ih }, labelCount: labels.length, labels, percentTextsOnHoverLayer: pctAll.length,
      hoverAdded: added, marker: p.drawn.filter((d) => restTexts.has(d.x + "@" + d.ink)).map((d) => ({ text: d.text, y: d.y })), notes: p.notes, domPercentTexts: p.domPercentTexts, percentTextsOnOtherPanes: others };
    await page.screenshot({ path: path.join(OUT, `${TAG}-hover-${t}-${name}.png`), clip: { x: p.frame.x, y: p.frame.y, width: p.frame.w, height: p.frame.h } });
    if (name === "mid") await page.screenshot({ path: path.join(OUT, `${TAG}-hover-${t}-deck.png`) });
  }
}
await page.mouse.move(200, 500); await page.waitForTimeout(800);
/* the tapes: give the lines' reads time, then read every real cell and picture the strip */
await page.waitForTimeout(12000);
res.tapes = await page.evaluate(() => { const s = document.getElementById("tapes");
  const real = (sel) => [...s.querySelectorAll('[data-tape="' + sel + '"] .cell:not([aria-hidden="true"])')];
  const R = (n) => { if (!n) return null; const b = n.getBoundingClientRect(); return { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; };
  const mark = (c) => { const g = c.querySelector(".gb"), i = g && g.querySelector("i"), v = c.querySelector(".spark"), paths = v ? [...v.querySelectorAll("path")].filter((p) => (p.getAttribute("d") || "").length > 4) : [];
    const pc = c.querySelector(".pc"), stroke = paths.length ? getComputedStyle(paths[0]).stroke : null;
    return { t: c.dataset.t, cell: R(c), pct: pc ? pc.textContent : "", pctSide: pc ? (pc.classList.contains("up") ? "up" : pc.classList.contains("dn") ? "dn" : "") : "", rungs: c.querySelectorAll(".g i").length,
      bar: g ? Object.assign(R(g), { side: g.classList.contains("up") ? "up" : g.classList.contains("down") ? "down" : "", fillW: i ? Math.round(i.getBoundingClientRect().width * 10) / 10 : 0, color: i ? getComputedStyle(i).backgroundColor : null, title: g.title.split("\n")[0] }) : null,
      line: v ? Object.assign(R(v), { drawn: paths.length > 0, colours: [...new Set(paths.map((p) => getComputedStyle(p).stroke))], stroke }) : null }; };
  const sum = (cells) => { const m = cells.map(mark), withLine = m.filter((x) => x.line && x.line.drawn), both = m.filter((x) => x.line && x.bar);
    return { n: m.length, withBar: m.filter((x) => x.bar).length, barsFilled: m.filter((x) => x.bar && x.bar.fillW > 0).length, withLineBox: m.filter((x) => x.line).length, withLine: withLine.length, withRungs: m.filter((x) => x.rungs).length,
      barUnderLine: both.filter((x) => x.bar.y >= x.line.y + x.line.h - .5).length, sameLeftRight: both.filter((x) => Math.abs(x.bar.x - x.line.x) < .6 && Math.abs(x.bar.w - x.line.w) < .6).length, both: both.length,
      lineOneColour: withLine.filter((x) => x.line.colours.length === 1).length,
      lineFollowsDay: withLine.filter((x) => x.pctSide && x.line.colours.length === 1 && x.line.stroke === (x.pctSide === "up" ? "rgb(0, 255, 163)" : "rgb(255, 45, 85)")).length, lineWithDaySign: withLine.filter((x) => x.pctSide).length,
      barTrueGreenRed: m.filter((x) => x.bar && x.bar.side && x.bar.color === (x.bar.side === "up" ? "rgb(0, 255, 163)" : "rgb(255, 45, 85)")).length, barWithSide: m.filter((x) => x.bar && x.bar.side).length,
      tallest: Math.max(...m.map((x) => x.cell.h)), widest: Math.max(...m.map((x) => x.cell.w)), meanWidth: Math.round(m.reduce((q, x) => q + x.cell.w, 0) / (m.length || 1)), sample: m.slice(0, 4) }; };
  const b = s.getBoundingClientRect(), fs = getComputedStyle(s.querySelector(".cell"));
  return { favorites: sum(real("FAVORITES")), liked: sum(real("LIKED")), box: { x: b.x, y: b.y, w: b.width, h: b.height }, rowPx: s.querySelector(".tape").getBoundingClientRect().height,
    stripPx: Math.round(innerHeight - document.getElementById("rowTop").getBoundingClientRect().bottom), font: { family: fs.fontFamily, size: fs.fontSize } };
});
const tb = res.tapes.box;
await page.screenshot({ path: path.join(OUT, `${TAG}-tapes.png`), clip: { x: tb.x, y: tb.y - 40, width: Math.min(900, tb.w), height: tb.h + 40 } });
await page.screenshot({ path: path.join(OUT, `${TAG}-tapes-wide.png`), clip: { x: tb.x, y: tb.y - 4, width: tb.w, height: tb.h + 4 } });
res.blockedWrites = blocked; res.pageErrors = errs;
fs.writeFileSync(path.join(HERE, `${TAG}.json`), JSON.stringify(res, null, 1));
const brief = { tag: TAG, ready, hover: Object.fromEntries(Object.entries(res.hover).filter(([k]) => !/-rest$/.test(k)).map(([k, v]) => [k, v && { labelCount: v.labelCount, onCursorLevel: v.labels.map((l) => l.onCursorLevel), labels: v.labels.map((l) => l.price + " / " + l.pct + " off " + l.offCursorPx), pctOnLayer: v.percentTextsOnHoverLayer, dom: v.domPercentTexts.map((d) => d.text) }])),
  tapes: { favorites: Object.assign({}, res.tapes.favorites, { sample: undefined }), liked: Object.assign({}, res.tapes.liked, { sample: undefined }), rowPx: res.tapes.rowPx, stripPx: res.tapes.stripPx }, blocked, errs };
console.log(JSON.stringify(brief, null, 1));
await browser.close(); server.close();
