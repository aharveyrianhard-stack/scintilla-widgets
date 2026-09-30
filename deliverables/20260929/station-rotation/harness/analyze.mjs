// Reduces a rotation.mjs run to one row per page change.  node analyze.mjs <run.json> [--json=out]
import fs from "node:fs";
const [file, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const run = JSON.parse(fs.readFileSync(file, "utf8"));

export function reduceChange(c) {
  /* a chart is identified by its full address (name, timeframe, study, lens), so a page that shows the
     same names with another study is still a change; older runs without addresses fall back to names */
  const L = c.log, final = {}, byId = !!c.final.ids;
  (c.final.ids || c.final.charts).forEach((t, i) => { final["c" + (i + 1)] = t; });
  const who = (f) => (byId ? f.id : f.t);
  const keys = Object.keys(final).filter((k) => final[k]);
  const blank = {}, wrongInNewBox = {}, boxes = {}, arrive = {};
  const finalBox = {};
  const last = L[L.length - 1];
  for (const p of last.panes) finalBox[p.k] = p.box;
  const firstBox = {};
  for (const p of L[0].panes) firstBox[p.k] = p.box;
  let doneAt = null, priceAt = null, cloudsAt = null, lensAt = null, chipAt = null;
  const allOk = (s, fn) => keys.every((k) => { const p = s.panes.find((x) => x.k === k && !x.inc); if (!p) return false;
    const f = p.frames.filter((x) => x.op >= 0.99 && who(x) === final[k]).pop(); return !!f && fn(f); });
  for (let n = 0; n < L.length; n++) {
    const s = L[n], dt = n ? s.t - L[n - 1].t : 0;
    for (const p of s.panes) {
      if (p.inc) continue;
      (boxes[p.k] = boxes[p.k] || []);
      if (boxes[p.k][boxes[p.k].length - 1] !== p.box) boxes[p.k].push(p.box);
      if (!p.frames.some((f) => f.drawn)) blank[p.k] = (blank[p.k] || 0) + dt;
      /* an old chart shown in a box it did not have before this change */
      if (p.box !== firstBox[p.k] && p.frames.length && !p.frames.some((f) => who(f) === final[p.k] && f.drawn && f.op >= 0.99))
        wrongInNewBox[p.k] = (wrongInNewBox[p.k] || 0) + dt;
    }
    for (const k of keys) {
      if (arrive[k]) continue;
      for (const p of s.panes) {
        if (p.k !== k) continue;
        const f = p.frames.find((x) => who(x) === final[k] && x.op > 0 && x.drawn);
        /* a name that was already on screen in this slot before the change has not "arrived" */
        const before = L[0].panes.find((x) => x.k === k);
        const wasThere = before && before.frames.some((x) => who(x) === final[k] && x.op >= 0.99 && x.drawn) && before.box === finalBox[k];
        if (wasThere) { arrive[k] = { t: 0, stayed: true, price: true, clouds: true, lens: true, chip: true }; break; }
        if (f) arrive[k] = { t: s.t, price: f.price, clouds: f.clouds, lens: f.lens, chip: f.chip, op: f.op };
      }
    }
  }
  /* settled = the last moment something was still missing, plus one frame */
  const lastBad = (fn) => { let at = 0; for (const s of L) if (!allOk(s, fn)) at = s.t; return at; };
  doneAt = lastBad((f) => f.drawn && f.price && f.clouds && f.lens && f.chip);
  priceAt = lastBad((f) => f.drawn && f.price);
  cloudsAt = lastBad((f) => f.drawn && f.clouds);
  lensAt = lastBad((f) => f.drawn && f.lens);
  chipAt = lastBad((f) => f.drawn && f.chip);
  const moves = {}, unplanned = {};
  for (const k of Object.keys(boxes)) {
    moves[k] = boxes[k].length - 1;
    const planned = firstBox[k] && finalBox[k] && firstBox[k] !== finalBox[k] ? 1 : 0;
    if (moves[k] > planned) unplanned[k] = moves[k] - planned;
  }
  const arrivals = Object.entries(arrive).filter(([, a]) => !a.stayed);
  const together = arrivals.filter(([, a]) => a.price && a.clouds && a.lens && a.chip).length;
  const maxBlank = Math.max(0, ...Object.values(blank));
  return {
    lap: c.lap, id: c.id, count: c.final.count, charts: c.final.charts.join(" "),
    maxBlankMs: maxBlank, blankPanes: Object.keys(blank).length, blank,
    wrongBoxMs: Math.max(0, ...Object.values(wrongInNewBox)),
    layoutMoved: Object.values(moves).some((m) => m > 0), unplannedMoves: Object.values(unplanned).reduce((a, b) => a + b, 0), unplanned,
    doneMs: doneAt, priceMs: priceAt, cloudsMs: cloudsAt, lensMs: lensAt, chipMs: chipAt,
    windowMs: last.t, done: doneAt < last.t - 50,
    arrived: arrivals.length, together, late: arrivals.filter(([, a]) => !(a.price && a.clouds && a.lens && a.chip)).map(([k, a]) => k + ":" + ["price", "clouds", "lens", "chip"].filter((x) => !a[x]).join("+")),
    cpuSec: c.cpuSec, rssMB: c.rssMB, procs: c.procs, heapMB: c.final.heapMB, frames: c.final.frames, applyMs: c.applyMs,
  };
}
const rows = run.changes.map(reduceChange);
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(rows, null, 1));
const pad = (v, n) => String(v).padStart(n);
console.log("lap page              n  blank(max ms) panes  oldInNewBox  unplMoves  done(ms)  price  clouds  lens  chip  arrived/together  cpu(s)  rss");
for (const r of rows) console.log(`${r.lap}  ${r.id.padEnd(16)} ${pad(r.count, 2)} ${pad(r.maxBlankMs, 8)} ${pad(r.blankPanes, 6)} ${pad(r.wrongBoxMs, 10)} ${pad(r.unplannedMoves, 9)} ${pad(r.done ? r.doneMs : ">" + r.windowMs, 9)} ${pad(r.priceMs, 6)} ${pad(r.cloudsMs, 7)} ${pad(r.lensMs, 5)} ${pad(r.chipMs, 5)} ${pad(r.arrived + "/" + r.together, 10)} ${pad(r.cpuSec, 8)} ${pad(r.rssMB, 5)}`);
const byLap = (lap) => rows.filter((r) => r.lap === lap);
for (const lap of [1, 2]) {
  const R = byLap(lap); if (!R.length) continue;
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  console.log(`lap ${lap}: changes=${R.length} blank>100ms=${R.filter((r) => r.maxBlankMs > 100).length} maxBlank=${Math.max(...R.map((r) => r.maxBlankMs))} medBlank=${med(R.map((r) => r.maxBlankMs))} unplanned=${R.reduce((a, r) => a + r.unplannedMoves, 0)} oldInNewBox>0=${R.filter((r) => r.wrongBoxMs > 0).length} medDone=${med(R.map((r) => r.doneMs))} notDone=${R.filter((r) => !r.done).length} together=${R.reduce((a, r) => a + r.together, 0)}/${R.reduce((a, r) => a + r.arrived, 0)} cpu=${R.reduce((a, r) => a + r.cpuSec, 0).toFixed(1)}s medCpu=${med(R.map((r) => r.cpuSec))} rssEnd=${R[R.length - 1].rssMB}`);
}
