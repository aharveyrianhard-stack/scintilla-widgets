// S12 Part B: the tapes proposal page, pictured and measured at 1920 × 1080 and 1680 × 1050, three variants. Headless; real quotes.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../.."), OUT = path.resolve(HERE, "../shots");
const { server, origin } = await serve(ROOT);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const res = {};
for (const [w, h, scale, name] of [[1920, 1080, 1, "Apple TV"], [1680, 1050, 2, "MacBook"]]) for (const v of ["top", "between", "foot"]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale }); let blocked = 0;
  await context.route("**/*", async (route) => { const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback(); if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { blocked++; return route.abort(); }
    if (host === "scintilla-massive-chart-api.fly.dev") { try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text();
      return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); } }
    return route.fallback(); });
  const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(origin + "/deliverables/20261005/station-controls/tapes/?v=" + v);
  let t0 = Date.now(); while (Date.now() - t0 < 60000) { await page.waitForTimeout(1500); if (await page.evaluate(() => !!window.__TAPES && [...document.querySelectorAll(".cell .px")].filter((e) => e.textContent !== "—").length > 20)) break; }
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => Object.assign({}, window.__TAPES, { quoted: [...document.querySelectorAll('[data-tape="LIKED"] .cell .px')].filter((e) => e.textContent !== "—").length / 2, counts: document.getElementById("counts").textContent, geigerLit: document.querySelectorAll(".g i.on").length }));
  m.errs = errs; m.blocked = blocked; res[`${w}x${h}-${v}`] = m;
  await page.screenshot({ path: path.join(OUT, `tapes-${v}-${w}x${h}.png`) });
  const tb = await page.evaluate(() => { const b = document.querySelector('[data-tape="LIKED"]').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await page.screenshot({ path: path.join(OUT, `tapes-${v}-${w}x${h}-close.png`), clip: { x: tb.x, y: Math.max(0, tb.y - 30), width: Math.min(tb.w, 900), height: tb.h * 2 + 60 } });
  console.log(w + "x" + h, name, v, JSON.stringify(m)); await context.close();
}
fs.writeFileSync(path.join(HERE, "tapes.json"), JSON.stringify(res, null, 1));
await browser.close(); server.close(); process.exit(0);
