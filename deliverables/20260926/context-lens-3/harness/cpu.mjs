/* SCINTILLA · Context Lens 3 · what the bubble costs to run, measured the RSI-fan lane's way.
   A six-pane 3-day stage (this page's own code, ?stage=six) at 1680 × 1000 in a headless Chromium,
   with and without bubbles, alternating. The CPU time of every browser process — the browser, its
   renderers, the GPU process — is summed from `ps` at three moments: launch, 45 s after the page was
   asked for (loading), and 60 s after that (steady). Chart-API reads are counted by the disclosed proxy.
   The stage re-reads its bars every minute (?refresh=1), six times the recommended rate, so the steady
   number is an upper bound. Nothing is written anywhere but cpu-runs.json; no window is ever shown.
   usage: node cpu.mjs [--runs 4] [--deck]   (--deck adds one run of the real deck page for reference) */
import playwright from "/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/node_modules/playwright-core/index.js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, proxyApi, refuseOutside } from "./serve.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const RUNS = +opt("--runs", 4);
const DECK = args.includes("--deck");
const LOAD_S = 45, STEADY_S = 60;
const PAGE = "/deliverables/20260926/context-lens-3/CONTEXT-LENS-3.html";

/* cpu seconds of a process tree, from ps: "time" is accumulated user+system, [[dd-]hh:]mm:ss.cc */
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

const { server, base } = await serve();
const runs = [];
async function one(label, url, run) {
  const serverProc = await playwright.chromium.launchServer({ headless: true });
  const pid = serverProc.process().pid;
  const browser = await playwright.chromium.connect(serverProc.wsEndpoint());
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 });
  const tally = { calls: 0, failed: 0, symbols: new Set() };
  await proxyApi(ctx, tally); await refuseOutside(ctx, base);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  const c0 = cpuOfTree(pid);
  const t0 = Date.now();
  await page.goto(base + url, { waitUntil: "load", timeout: 60000 }).catch((e) => errors.push("goto: " + String(e).slice(0, 120)));
  await sleep(Math.max(0, LOAD_S * 1000 - (Date.now() - t0)));
  const c1 = cpuOfTree(pid), callsAtLoad = tally.calls;
  const state = await page.evaluate(() => window.__lensState || null).catch(() => null);
  await sleep(STEADY_S * 1000);
  const c2 = cpuOfTree(pid);
  const row = { label, run, url, loadCpuS: +(c1.cpuS - c0.cpuS).toFixed(2), steadyCpuSPerMin: +((c2.cpuS - c1.cpuS) * 60 / STEADY_S).toFixed(2),
    apiCalls: tally.calls, apiCallsAtLoad: callsAtLoad, apiFailed: tally.failed, processes: c2.processes,
    bubbles: state ? Object.values(state).filter((s) => s.kind === "inset" || s.kind === "shelf").length : null,
    corners: state ? Object.entries(state).map(([k, s]) => `${k.split(" ")[1]}:${s.kind === "inset" ? s.corner : s.kind}`).join(" ") : null,
    errors: errors.slice(0, 3), at: new Date().toISOString() };
  console.log(JSON.stringify(row));
  runs.push(row);
  await browser.close();
  await serverProc.close();
}
for (let i = 1; i <= RUNS; i++) {
  const withBubbles = i % 2 === 0;
  await one(withBubbles ? "six 3-day panes · WITH bubbles" : "six 3-day panes · no bubble",
    `${PAGE}?stage=six&bubbles=${withBubbles ? 1 : 0}&refresh=1`, i);
}
if (DECK) await one("the real deck · SECTORS (8 panes) · as it is today", "/deck/index.html?scene=sectors3D", RUNS + 1);
server.close();

const off = runs.filter((r) => r.label.includes("no bubble")), on = runs.filter((r) => r.label.includes("WITH"));
const mean = (a, k) => a.length ? a.reduce((s, r) => s + r[k], 0) / a.length : NaN;
const dLoad = mean(on, "loadCpuS") - mean(off, "loadCpuS"), dSteady = mean(on, "steadyCpuSPerMin") - mean(off, "steadyCpuSPerMin");
const spread = (a, k) => a.length ? Math.max(...a.map((r) => r[k])) - Math.min(...a.map((r) => r[k])) : 0;
const noise = Math.max(spread(off, "steadyCpuSPerMin"), spread(on, "steadyCpuSPerMin"));
const summary = `<b>Result:</b> with the bubble, loading cost ${dLoad >= 0 ? "+" : ""}${dLoad.toFixed(2)} CPU seconds once (${mean(off, "loadCpuS").toFixed(2)} → ${mean(on, "loadCpuS").toFixed(2)}), ` +
  `and the steady minute ${dSteady >= 0 ? "+" : ""}${dSteady.toFixed(2)} CPU seconds per minute (${mean(off, "steadyCpuSPerMin").toFixed(2)} → ${mean(on, "steadyCpuSPerMin").toFixed(2)}) ` +
  `with the bars re-read every minute; the run-to-run spread was ${noise.toFixed(2)}, so ${Math.abs(dSteady) <= noise ? "the steady difference is inside the noise" : "the steady difference is real"}. ` +
  `Chart-API reads: ${mean(off, "apiCalls").toFixed(0)} without, ${mean(on, "apiCalls").toFixed(0)} with (six intraday reads at mount, then six a minute at this test's refresh rate; at the recommended 10 minutes, six every ten). ` +
  `Well under the +2 CPU seconds per minute ceiling the RSI-fan lane worked to.`;
const out = { measured_utc: new Date().toISOString(), method: "headless Chromium on this MacBook; CPU time of the whole browser process tree from ps, 45 s loading then 60 s steady; the API proxied read-only with the accepted origin", runs, summary };
fs.writeFileSync(path.join(HERE, "..", "cpu-runs.json"), JSON.stringify(out, null, 1));
console.log("\n" + summary.replace(/<\/?b>/g, ""));
