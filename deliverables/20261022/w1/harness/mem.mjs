// W1 (22 Oct 2026): memory - today's wall (WALL mode, nine charts, @a4fae52's layout) against the WIDGETS wall, headless,
// at 2560 x 1440, each in its own browser, sampled every 30 s for 5 minutes: the RSS of every process the browser owns,
// summed by type (renderer, gpu-process, utility, browser). All GET traffic allowed (TradingView, YouTube's thumbnails and
// player script, the meter, the chart API); every non-GET refused. Output: ../measure/w1-memory.json
//   node mem.mjs <root> [minutes]
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { execSync } from "node:child_process";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const MEASURE = path.resolve(HERE, "../measure"); fs.mkdirSync(MEASURE, { recursive: true });
const ROOT = path.resolve(process.argv[2]), MINUTES = +(process.argv[3] || 5);
const ETFS = ["SPY", "QQQ", "DIA", "IWM", "XLK", "XLF", "XLE", "SMH", "TLT"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s", ...a);
/* every process under the browser's pid: ps once, walk the parent links */
function tree(rootPid) {
  const rows = execSync("ps -axo pid=,ppid=,rss=,command=", { encoding: "utf8" }).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/); return m ? { pid: +m[1], ppid: +m[2], rssKb: +m[3], cmd: m[4] } : null; }).filter(Boolean);
  const kids = new Map(); for (const r of rows) { if (!kids.has(r.ppid)) kids.set(r.ppid, []); kids.get(r.ppid).push(r); }
  const out = []; const walk = (pid, depth) => { for (const k of kids.get(pid) || []) { out.push(k); if (depth < 6) walk(k.pid, depth + 1); } };
  const root = rows.find((r) => r.pid === rootPid); if (root) out.push(root); walk(rootPid, 0);
  const byType = {}; let total = 0;
  for (const r of out) { const m = r.cmd.match(/--type=([a-z-]+)/); const type = m ? m[1] : (r.pid === rootPid ? "browser" : "other"); byType[type] = (byType[type] || 0) + r.rssKb; total += r.rssKb; }
  return { processes: out.length, totalMb: +(total / 1024).toFixed(1), byTypeMb: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, +(v / 1024).toFixed(1)])) };
}
async function run(label, url, widgets) {
  /* the browser's own pid: the headless shell process that is new after the launch and carries no --type (the root) */
  const shells = () => execSync("ps -axo pid=,command=", { encoding: "utf8" }).split("\n").filter((l) => /chrome-headless-shell/.test(l) && !/--type=/.test(l)).map((l) => +l.trim().split(/\s+/)[0]);
  const before = new Set(shells());
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const pid = shells().find((p) => !before.has(p));
  if (!pid) throw new Error("the browser's pid was not found");
  const context = await browser.newContext({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1, screen: { width: 2560, height: 1440 }, timezoneId: "America/New_York" });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = req.url(), host = new URL(u).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
    if (host === "scintilla-massive-chart-api.fly.dev") { try { const r = await fetch(u, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); const body = await r.text(); return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); } }
    return route.fallback();
  });
  await context.addInitScript((widgets) => { if (window.top !== window) return; try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.setItem("station.widgets", widgets); localStorage.setItem("station.simple", "0"); localStorage.setItem("station.simple.chart.1", "SPY"); localStorage.setItem("station.simple.chart.2", "QQQ"); } catch (_) {} }, widgets);
  const page = await context.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 160)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const samples = []; const cdp = await context.newCDPSession(page); await cdp.send("Performance.enable");
  const start = Date.now();
  while (Date.now() - start < MINUTES * 60000 + 500) {
    await sleep(30000);
    const t = tree(pid); let heap = null; try { const m = await cdp.send("Performance.getMetrics"); heap = +(m.metrics.find((x) => x.name === "JSHeapUsedSize").value / 1048576).toFixed(1); } catch (_) {}
    const frames = page.frames().length;
    samples.push({ atMin: +((Date.now() - start) / 60000).toFixed(1), ...t, deckHeapMb: heap, frames });
    log(label, samples[samples.length - 1].atMin + "m", "total", t.totalMb, "MB", JSON.stringify(t.byTypeMb), "frames", frames);
  }
  const last = samples[samples.length - 1];
  const body = await page.evaluate(() => ({ body: document.body.className, widgets: typeof widgetsOn === "function" ? widgetsOn() : null, charts: document.querySelectorAll("#rowTop > .pane iframe").length }));
  await browser.close();
  return { label, url, samples, after5min: last, state: body, errors: errs };
}
const { server, origin } = await serve(ROOT);
const out = { at: new Date().toISOString(), minutes: MINUTES, screen: "2560x1440", runs: [] };
try {
  out.runs.push(await run("today (WALL, 9 charts)", origin + "/deck/?scene=live&charts=9&range=3h&" + ETFS.map((t, i) => "c" + (i + 1) + "=" + t).join("&"), "0"));
  out.runs.push(await run("WIDGETS", origin + "/deck/?scene=live&charts=9&range=3h", "1"));
} finally { server.close(); }
fs.writeFileSync(path.join(MEASURE, "w1-memory.json"), JSON.stringify(out, null, 1));
log("wrote", out.runs.map((r) => r.label + " " + JSON.stringify(r.after5min)).join(" | "));
