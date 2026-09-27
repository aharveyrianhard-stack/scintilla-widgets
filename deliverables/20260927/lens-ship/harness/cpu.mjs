/* SCINTILLA · CL4 lens ship · what the bubble costs on one real 8-up 3-day page (the deck's MAG 7 page).
   WITHOUT = the c8deb69 tree (the live code), WITH = this branch; the same page, the same wait, runs
   alternating. CPU time of the whole headless browser process tree (browser, renderers, GPU) is summed
   from `ps` at launch, 45 s after the page was asked for (loading), and 60 s after that (the steady
   minute, which includes the pane's own 60-second history refresh). Chart-API reads are counted by the
   disclosed proxy, by timeframe, so the 30-minute reads are the bubble's alone.
   usage: node cpu.mjs <before-tree> [--runs 4]   → ../cpu-runs.json */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, proxyApi, refuseOutside, newTally } from "./serve.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AFTER_ROOT = path.resolve(HERE, "../../../..");
const BEFORE_ROOT = process.argv[2];
const args = process.argv.slice(3);
const RUNS = +(args[args.indexOf("--runs") + 1] || 4) || 4;
const LOAD_S = 45, STEADY_S = 60;
const URL_ = "/deck/index.html?scene=mag7";

function cpuOfTree(rootPid) {
  const rows = execFileSync("ps", ["-axo", "pid=,ppid=,time="], { encoding: "utf8" }).trim().split("\n")
    .map((l) => l.trim().split(/\s+/)).filter((r) => r.length >= 3);
  const kids = new Map();
  for (const [pid, ppid] of rows) { if (!kids.has(ppid)) kids.set(ppid, []); kids.get(ppid).push(pid); }
  const timeOf = new Map(rows.map(([pid, , t]) => [pid, t]));
  const parse = (t) => { let d = 0; if (t.includes("-")) { d = +t.split("-")[0]; t = t.split("-")[1]; }
    const p = t.split(":").map(Number); let s = 0; for (const x of p) s = s * 60 + x; return d * 86400 + s; };
  let total = 0, n = 0; const stack = [String(rootPid)];
  while (stack.length) { const pid = stack.pop(); if (timeOf.has(pid)) { total += parse(timeOf.get(pid)); n++; } for (const k of kids.get(pid) || []) stack.push(k); }
  return { cpuS: total, processes: n };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const runs = [];

async function one(label, root, run) {
  const { server, base } = await serve(root);
  const serverProc = await playwright.chromium.launchServer({ headless: true });
  const pid = serverProc.process().pid;
  const browser = await playwright.chromium.connect(serverProc.wsEndpoint());
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
  const tally = newTally();
  await proxyApi(ctx, tally); await refuseOutside(ctx, base);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  const c0 = cpuOfTree(pid), t0 = Date.now();
  await page.goto(base + URL_, { waitUntil: "load", timeout: 60000 }).catch((e) => errors.push("goto: " + String(e).slice(0, 120)));
  await sleep(Math.max(0, LOAD_S * 1000 - (Date.now() - t0)));
  const c1 = cpuOfTree(pid), atLoad = JSON.parse(JSON.stringify(tally));
  await sleep(STEADY_S * 1000);
  const c2 = cpuOfTree(pid);
  let lenses = 0;
  for (const f of page.frames()) if (/chart-v1/.test(f.url()))
    lenses += await f.evaluate(() => { const c = document.querySelector(".sc-nchart__lens"); return c && c.style.display !== "none" ? 1 : 0; }).catch(() => 0);
  const row = { label, run, loadCpuS: +(c1.cpuS - c0.cpuS).toFixed(2), steadyCpuSPerMin: +((c2.cpuS - c1.cpuS) * 60 / STEADY_S).toFixed(2),
    apiCallsLoad: atLoad.calls, apiCallsSteady: tally.calls - atLoad.calls, reads30mLoad: atLoad.byTf["30"] || 0,
    reads30mSteady: (tally.byTf["30"] || 0) - (atLoad.byTf["30"] || 0), lensesShown: lenses, processes: c2.processes,
    errors: errors.slice(0, 3), at: new Date().toISOString() };
  console.log(JSON.stringify(row));
  runs.push(row);
  await browser.close(); await serverProc.close(); server.close();
}
for (let i = 1; i <= RUNS; i++) {
  const withLens = i % 2 === 0;
  await one(withLens ? "MAG 7 · WITH the lens (this branch)" : "MAG 7 · without (c8deb69, live)", withLens ? AFTER_ROOT : BEFORE_ROOT, i);
}
const off = runs.filter((r) => r.label.includes("without")), on = runs.filter((r) => r.label.includes("WITH"));
const mean = (a, k) => a.length ? a.reduce((s, r) => s + r[k], 0) / a.length : NaN;
const spread = (a, k) => a.length ? Math.max(...a.map((r) => r[k])) - Math.min(...a.map((r) => r[k])) : 0;
const summary = { loadWithout: +mean(off, "loadCpuS").toFixed(2), loadWith: +mean(on, "loadCpuS").toFixed(2),
  steadyWithout: +mean(off, "steadyCpuSPerMin").toFixed(2), steadyWith: +mean(on, "steadyCpuSPerMin").toFixed(2),
  noise: +Math.max(spread(off, "steadyCpuSPerMin"), spread(on, "steadyCpuSPerMin")).toFixed(2),
  reads30mLoadWith: mean(on, "reads30mLoad"), reads30mSteadyWith: mean(on, "reads30mSteady"), reads30mWithout: mean(off, "reads30mLoad") + mean(off, "reads30mSteady") };
fs.writeFileSync(path.join(HERE, "..", "cpu-runs.json"), JSON.stringify({ measured_utc: new Date().toISOString(),
  method: "headless Chromium on this MacBook, 1680x1050; CPU of the whole browser process tree from ps; 45 s loading then a 60 s steady minute; chart API proxied GET-only with the accepted origin; rotation paused",
  page: URL_, runs, summary }, null, 1));
console.log(JSON.stringify(summary));
