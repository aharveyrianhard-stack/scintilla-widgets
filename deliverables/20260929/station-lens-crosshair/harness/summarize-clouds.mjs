// node summarize-clouds.mjs <before.json> <after.json> - per scene, the median of the runs:
// the worst pane's ribbon delay after its own price, the last ribbon's arrival, the daily reads, ribbon replacements.
import fs from "node:fs";
const [bf, af] = process.argv.slice(2);
const load = (f) => JSON.parse(fs.readFileSync(f, "utf8")).result;
const med = (xs) => { const v = xs.filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
const by = (rows) => { const m = new Map(); for (const r of rows) { if (!m.has(r.scene)) m.set(r.scene, []); m.get(r.scene).push(r); } return m; };
const B = by(load(bf)), A = by(load(af));
const out = [];
for (const [scene, rs] of A) {
  const b = B.get(scene) || [];
  const f = (runs) => ({ late: med(runs.map((r) => r.lateVsPrice)), last: med(runs.map((r) => r.cloudLastMs)), reads: med(runs.map((r) => r.dailyReads)),
    slow: med(runs.map((r) => r.slowestDailyMs)), swaps: runs.reduce((a, r) => a + r.swaps, 0), missing: [...new Set(runs.flatMap((r) => r.cloudMissing))], panes: med(runs.map((r) => r.panes.length)) });
  out.push({ scene, before: f(b), after: f(rs) });
}
const tot = (k, side) => out.reduce((a, r) => a + (r[side][k] || 0), 0);
console.log(JSON.stringify({ scenes: out, totals: { readsBefore: tot("reads", "before"), readsAfter: tot("reads", "after"), swapsBefore: tot("swaps", "before"), swapsAfter: tot("swaps", "after"),
  lateMedBefore: med(out.map((r) => r.before.late)), lateMedAfter: med(out.map((r) => r.after.late)),
  lateWorstBefore: Math.max(...out.map((r) => r.before.late || 0)), lateWorstAfter: Math.max(...out.map((r) => r.after.late || 0)),
  over1sBefore: out.filter((r) => r.before.late > 1000).map((r) => r.scene), over1sAfter: out.filter((r) => r.after.late > 1000).map((r) => r.scene) } }, null, 1));
