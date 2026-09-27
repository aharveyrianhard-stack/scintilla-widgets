// node perf.mjs <root> <label> <path> [runs] [--record]
// iMac-like profile: 1680x1050, CPU throttled 4x, cold browser (empty storage), API replayed from disk.
import { open } from "./rig.mjs";
const [root, label, p, runsArg, flag] = process.argv.slice(2);
const runs = +runsArg || 3, record = flag === "--record";
const results = [];
for (let k = 0; k < runs; k++) {
  const r = await open({ root, width: 1680, height: 1050, cpu: 4, replayOnly: !record });
  const cdp = r.page._cdp;
  await cdp.send("Performance.enable");
  const t0 = Date.now();
  await r.page.goto(r.origin + p, { waitUntil: "commit" });
  const marks = { plot: null, clouds: null, lens: null };
  let last = null;
  while (Date.now() - t0 < 45000) {
    const states = [];
    for (const f of r.page.frames()) {
      if (!/\/chart\/|chart-v1/.test(f.url())) continue;
      try {
        states.push(await f.evaluate(() => {
          const h = document.querySelector(".sc-nchart");
          if (!h) return null;
          const lens = h.querySelector(".sc-nchart__lens");
          return { t: h.dataset.t, plot: !!h._plot, clouds: !!h._cloudRows, lensWanted: /bubble=/.test(location.search) && !/bubble=(&|$)/.test(location.search),
                   lens: !!(lens && lens.style.display === "block"), why: h.dataset.lensWhy || "" };
        }));
      } catch (_) {}
    }
    const s = states.filter(Boolean);
    last = s;
    const el = Date.now() - t0;
    if (s.length >= 2) {
      if (!marks.plot && s.every((x) => x.plot)) marks.plot = el;
      if (!marks.clouds && s.every((x) => x.clouds)) marks.clouds = el;
      const lw = s.filter((x) => x.lensWanted);
      if (!marks.lens && lw.length && lw.every((x) => x.lens)) marks.lens = el;
      if (marks.plot && marks.clouds && (marks.lens || !lw.length)) break;
    }
    await new Promise((res) => setTimeout(res, 150));
  }
  await new Promise((res) => setTimeout(res, 3000));
  const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  results.push({ ...marks, taskS: +m.TaskDuration.toFixed(2), scriptS: +m.ScriptDuration.toFixed(2), layoutS: +m.LayoutDuration.toFixed(3),
                 heapMB: +(m.JSHeapUsedSize / 1e6).toFixed(1), panes: last ? last.length : 0, api: r.stats.api,
                 lensWhy: last ? [...new Set(last.map((x) => x.why))].slice(0, 3) : [] });
  await r.close();
}
const med = (k) => { const v = results.map((x) => x[k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
console.log(JSON.stringify({ label, path: p, runs: results, median: { plotMs: med("plot"), cloudsMs: med("clouds"), lensMs: med("lens"), taskS: med("taskS"), scriptS: med("scriptS") } }, null, 1));
