// Builds STATION-ROTATION.html from the measured files next to it. node build-report.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const J = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
const live = J("live-1680-rows.json"), branch = J("branch-1680-rows.json");
const live1 = J("live-run1-1680-rows.json"), branch1 = J("branch-run1-1680-rows.json");
const slots = J("inslot-intraday4h-1680.json");
const SUITE = JSON.parse(process.env.SUITE || "{}");
const LABEL = { wkIndexes: "INDEXES · WEEK", wkMacro: "MACRO · WEEK", targets3D: "TARGETS", sectors3D: "SECTORS", mainIndexes3D: "SPY + QQQ",
  mag7: "MAG 7", ai1: "AI 1 · CHIPS", ai2: "AI 2 · MEMORY, RACKS", ai3: "AI 3 · POWER, CLOUDS", other3D: "OTHER", blueChip3D: "BLUE CHIP",
  spyQqq1D: "SPY + QQQ · DAY", otherIndexes1D: "OTHER INDEXES · DAY", otherIndexesOsc: "OTHER INDEXES · RSI", macro1D: "MACRO · DAY",
  targets1D: "TARGETS · DAY", targetsOsc: "TARGETS · RSI", macroIntraday: "MACRO · 4H", intraday4h: "INTRADAY · 4H", intraday1h: "INTRADAY · 1H", intraday30m: "INTRADAY · 30M" };
const s1 = (ms) => ms >= 1000 ? (ms / 1000).toFixed(1) + " s" : Math.round(ms) + " ms";
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const sum = (a) => a.reduce((x, y) => x + y, 0);
function lapStats(rows, lap) {
  const R = rows.filter((r) => r.lap === lap);
  return { n: R.length, blanked: R.filter((r) => r.maxBlankMs > 100).length, worst: Math.max(...R.map((r) => r.maxBlankMs)),
    oldBox: R.filter((r) => r.wrongBoxMs > 0).length, extra: sum(R.map((r) => r.unplannedMoves)),
    done: med(R.map((r) => r.doneMs)), doneMax: Math.max(...R.map((r) => r.doneMs)),
    arrived: sum(R.map((r) => r.arrived)), together: sum(R.map((r) => r.together)),
    cpu: sum(R.map((r) => r.cpuSec)), cpuMed: med(R.map((r) => r.cpuSec)), rssMax: Math.max(...R.map((r) => r.rssMB)), docs: [Math.min(...R.map((r) => r.frames)), Math.max(...R.map((r) => r.frames))] };
}
const L1 = lapStats(live, 1), L2 = lapStats(live, 2), B1 = lapStats(branch, 1), B2 = lapStats(branch, 2);
const R1 = { l1: lapStats(live1, 1), l2: lapStats(live1, 2), b1: lapStats(branch1, 1), b2: lapStats(branch1, 2) };
function perChange(lap) {
  const rows = live.filter((r) => r.lap === lap).map((l) => {
    const b = branch.find((x) => x.lap === lap && x.id === l.id);
    return `<tr><td>${LABEL[l.id] || l.id}</td><td class="num">${l.count}</td>
<td class="num">${l.maxBlankMs > 100 ? "<b>" + s1(l.maxBlankMs) + "</b>" : s1(l.maxBlankMs)}</td><td class="num">${l.wrongBoxMs ? s1(l.wrongBoxMs) : "—"}</td><td class="num">${l.arrived ? l.together + " of " + l.arrived : "—"}</td><td class="num">${s1(l.doneMs)}</td><td class="num">${l.cpuSec.toFixed(2)}</td>
<td class="num">${b.maxBlankMs > 100 ? "<b>" + s1(b.maxBlankMs) + "</b>" : s1(b.maxBlankMs)}</td><td class="num">${b.wrongBoxMs || b.unplannedMoves ? "<b>" + (b.unplannedMoves + " moves, " + s1(b.wrongBoxMs)) + "</b>" : "—"}</td><td class="num">${b.arrived ? b.together + " of " + b.arrived : "—"}</td><td class="num">${s1(b.doneMs)}</td><td class="num">${b.cpuSec.toFixed(2)}</td></tr>`;
  });
  return `<table><thead><tr><th rowspan="2">page (in rotation order)</th><th rowspan="2">charts</th><th colspan="5">LIVE today (bacb424)</th><th colspan="5">THIS BRANCH</th></tr>
<tr><th>longest blank pane</th><th>old chart shown in a new box</th><th>charts that arrived with price, clouds, lens and chip</th><th>whole page finished</th><th>CPU s</th>
<th>longest blank pane</th><th>box moves beyond the layout</th><th>charts that arrived with price, clouds, lens and chip</th><th>whole page finished</th><th>CPU s</th></tr></thead><tbody>${rows.join("\n")}</tbody></table>`;
}
const first = slots.slice(0, 13), last = slots.slice(-13);
const win = (a) => ({ fades: a[a.length - 1].fades - a[0].fades, cpu: (a[a.length - 1].cpuSec - a[0].cpuSec) / ((a[a.length - 1].t - a[0].t) / 1000),
  gap: Math.max(...a.map((x) => x.maxGapMs)), gaps: sum(a.map((x) => x.gapsOver50)), frames: sum(a.map((x) => x.frames)), blank: sum(a.map((x) => x.blankMs)),
  rss: [Math.min(...a.map((x) => x.rssMB)), Math.max(...a.map((x) => x.rssMB))], docs: [...new Set(a.map((x) => x.docs))], parked: [Math.min(...a.map((x) => x.parked)), Math.max(...a.map((x) => x.parked))] });
const W1 = win(first), W2 = win(last), steps = Math.round(slots[slots.length - 1].fades / 4);
const shot = (f, cap) => `<figure><img src="shots/${f}" alt="${cap.replace(/"/g, "")}"><figcaption>${cap}</figcaption></figure>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Station page changes · 29 Sep 2026</title>
<style>
:root{--bg:#0A0A0F;--panel:#0F0F16;--line:#1C1C26;--ink:#C8C8D2;--body:#A8A8B6;--dim:#8C8C9A}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--body);font:17px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1500px}
h1{font-size:32px;margin:0 0 6px;color:var(--ink)} h2{font-size:25px;margin:44px 0 8px;color:var(--ink)} h3{font-size:19px;margin:26px 0 6px;color:var(--ink)}
p,ul,ol{max-width:1100px} li{margin:6px 0} .lead{font-size:21px;color:var(--ink)} .note{color:var(--dim);font-size:14px}
blockquote{margin:10px 0 18px;padding:8px 16px;border-left:3px solid #33333D;color:var(--ink);max-width:1000px}
table{border-collapse:collapse;font-size:14px;margin:10px 0 6px;max-width:100%} th,td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}
th{color:var(--dim);font-weight:600} td.num{font:13px ui-monospace,Menlo,monospace;text-align:right}
code{font:14px ui-monospace,Menlo,monospace;background:var(--panel);padding:2px 6px;border-radius:4px;color:var(--ink)}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;margin:12px 0 26px}
figure{margin:0} img{width:100%;height:auto;border:1px solid var(--line);display:block}
figcaption{font:13px ui-monospace,Menlo,monospace;color:var(--dim);margin-top:5px}
.box{border:1px solid var(--line);background:var(--panel);padding:12px 16px;margin:10px 0 16px;max-width:1100px}
b{color:var(--ink)}
.wide{overflow-x:auto;max-width:100%}
@media (max-width:760px){body{padding:18px 16px 60px;font-size:16px}.pair{grid-template-columns:1fr}h1{font-size:26px}
  table{display:block;overflow-x:auto;max-width:100%} code{word-break:break-all}}
</style></head><body>

<h1>Station · page changes now dissolve the way the in-slot rotation does, checked across the whole rotation</h1>
<p class="lead">Branch <code>station/rotation-20260929</code>, made from today's live Station (bacb424). <b>Not pushed and not deployed.</b> On this branch, a page change works like the smooth in-slot rotation: the next page is drawn out of sight, then the whole page fades in over the old one. I drove every page in the rotation, in order, twice, headlessly, on today's live code and on this branch, and measured each change frame by frame.</p>

<blockquote>Alan, 29 Sep evening: "THIS METHOD HOW IT LOOKS WHEN THE SAME CHART ROTATIONS HAPPEN — CAN IT BE TESTED TO SEE IF IT WORKS FOR THE WHOLE ENTIRE ROTATION SOMEHOW? ITS VERY SMOOTH AND THE PAGE CHANGES ARE VERY ROUGH."</blockquote>

<div class="box">
<b>In one minute</b>
<ul>
<li><b>Yes, it can be tested, and it now is.</b> A headless test browser (invisible, never on your screen) opens the Station and steps through all ${B1.n} rotation pages in order, twice. The first lap starts with nothing saved in the browser (cold), and the second lap has the charts already saved (warm). For every change it records, frame by frame, whether any chart pane is empty, whether any pane jumps, and when every chart has its price, clouds, lens and Geiger chip.</li>
<li><b>Live today:</b> ${L1.blanked} of ${L1.n} changes on the cold lap and ${L2.blanked} of ${L2.n} on the warm lap left at least one pane empty for more than a tenth of a second (worst ${s1(Math.max(L1.worst, L2.worst))}). On ${L1.oldBox + L2.oldBox} changes the old chart was stretched into the new layout before the new one drew. Only ${L1.together + L2.together} of ${L1.arrived + L2.arrived} incoming charts arrived with everything on them; in the rest, the clouds, lens or chip popped in afterwards.</li>
<li><b>This branch:</b> across all ${B1.n + B2.n} changes, <b>no pane was empty in any frame</b>, <b>no pane moved except the one move the next page's layout needs</b> (done under the fade, never with an old chart in it), and <b>${B1.together + B2.together} of ${B1.arrived + B2.arrived}</b> incoming charts arrived with the price, clouds, lens and chip already on them.</li>
<li><b>The cost:</b> the old page stays on screen a little longer while the next one draws out of sight. The typical change finishes in ${s1(B2.done)} warm (${s1(B1.done)} cold), and the slowest took ${s1(Math.max(B1.doneMax, B2.doneMax))}. Every page still gets its full 33 seconds once it is up. Each slot also keeps one parked chart for reuse, so ${B2.docs[0]}–${B2.docs[1]} chart documents stay open instead of 10, and the warm lap used ${B2.cpu.toFixed(1)} s of CPU instead of ${L2.cpu.toFixed(1)} s (details below).</li>
<li><b>The in-slot rotation stays smooth.</b> I left INTRADAY · 4H rotating for ${steps} steps. Steps 45–57 behaved like steps 1–12: no empty frame, the same CPU, the same memory, and the same number of open charts.</li>
</ul>
</div>

<h2>What you will see</h2>
<ul>
<li>When the page changes, nothing goes dark. The page you are looking at stays exactly as it is, and then the next page fades in over it in 0.9 seconds. This is the same soft fade, in the same 8 steps, as a single slot changing names.</li>
<li>When the next page has a different number of charts (for example 8 → 2 → 8), the new charts fade in already in their new places. The grid switches to the new layout only when the fade has finished, underneath charts that are already there. You never see an old chart stretched into a new box.</li>
<li>Each new chart arrives with its price, clouds, lens box and Geiger chip already on it. Before, these could appear one after another.</li>
<li>A chart that stays exactly the same (the same name, timeframe, study and lens, in the same box) is left completely alone. It no longer flashes "loading" because it was told its timeframe again.</li>
<li>The page name and the timeframe tag change at the moment the new page is fully in.</li>
<li>Nothing changes on the phone. A phone stacks the charts and only keeps two live, so it keeps today's behaviour. An expanded (full-size) pane, SCRATCH and CUSTOM also keep today's behaviour.</li>
</ul>

<h2>How it works, in plain words</h2>
<ol>
<li><b>Measure.</b> The Station works out where every chart box will be on the next page, without drawing anything.</li>
<li><b>Draw out of sight.</b> Every slot whose chart changes gets its next chart, invisible, standing exactly where it will be on the next page, over the page on screen. Where possible it reuses a chart document the slot already has: the one it faded away from last time, or the one it was keeping hidden. That chart is simply told its new name, so the browser doesn't have to build a whole new page for it. A slot already showing exactly the next chart is not touched.</li>
<li><b>Wait until each chart is fully dressed:</b> line, price, clouds, lens and Geiger chip. The wait is capped at 8 seconds on the rotation, and at 3 seconds when you click a page yourself. On this run no page came close to the cap.</li>
<li><b>Fade the whole page in:</b> 0.9 seconds, in 8 steps. This is the cheaper method measured on 28 Sep for the in-slot rotation.</li>
<li><b>Switch over.</b> In one step, the grid takes the next layout under the new charts, the old charts are parked out of sight for the next change, and the page name follows.</li>
</ol>

<h2>The whole rotation, before and after</h2>
<p>These are the ${B1.n} workflow pages in their rotation order from <code>deck/scenes.js</code>. <b>Note:</b> the brief says 19 pages, but the code has ${B1.n}: the two weekly pages were added to the workflow on 25 Sep. I drove all ${B1.n} of them, so that nothing was left out. Headless browser at 1680 × 1050, 12 seconds per change, measured on every painted frame (about 60 a second).</p>
<table><thead><tr><th></th><th>changes</th><th>a pane empty for more than 0.1 s</th><th>worst empty pane</th><th>old chart shown in a new box</th><th>box moves beyond the layout</th><th>charts that arrived fully dressed</th><th>typical time until the page is finished</th><th>CPU for the lap</th><th>chart documents open</th></tr></thead>
<tbody>
<tr><td>Live · cold lap</td><td class="num">${L1.n}</td><td class="num"><b>${L1.blanked}</b></td><td class="num">${s1(L1.worst)}</td><td class="num">${L1.oldBox}</td><td class="num">${L1.extra}</td><td class="num">${L1.together} of ${L1.arrived}</td><td class="num">${s1(L1.done)}</td><td class="num">${L1.cpu.toFixed(1)} s</td><td class="num">${L1.docs[0]}–${L1.docs[1]}</td></tr>
<tr><td>Branch · cold lap</td><td class="num">${B1.n}</td><td class="num"><b>${B1.blanked}</b></td><td class="num">${s1(B1.worst)}</td><td class="num">${B1.oldBox}</td><td class="num">${B1.extra}</td><td class="num">${B1.together} of ${B1.arrived}</td><td class="num">${s1(B1.done)}</td><td class="num">${B1.cpu.toFixed(1)} s</td><td class="num">${B1.docs[0]}–${B1.docs[1]}</td></tr>
<tr><td>Live · warm lap</td><td class="num">${L2.n}</td><td class="num"><b>${L2.blanked}</b></td><td class="num">${s1(L2.worst)}</td><td class="num">${L2.oldBox}</td><td class="num">${L2.extra}</td><td class="num">${L2.together} of ${L2.arrived}</td><td class="num">${s1(L2.done)}</td><td class="num">${L2.cpu.toFixed(1)} s</td><td class="num">${L2.docs[0]}–${L2.docs[1]}</td></tr>
<tr><td>Branch · warm lap</td><td class="num">${B2.n}</td><td class="num"><b>${B2.blanked}</b></td><td class="num">${s1(B2.worst)}</td><td class="num">${B2.oldBox}</td><td class="num">${B2.extra}</td><td class="num">${B2.together} of ${B2.arrived}</td><td class="num">${s1(B2.done)}</td><td class="num">${B2.cpu.toFixed(1)} s</td><td class="num">${B2.docs[0]}–${B2.docs[1]}</td></tr>
</tbody></table>
<p class="note">"Chart documents open" counts every frame on the Station, including the two video panes and the X pane. This table is the third full run. <b>Run 1</b> matched charts by name only, so it could not tell a chart from the same name with another study (the two RSI pages). Its numbers: live had a pane empty for more than 0.1 s on ${R1.l1.blanked} + ${R1.l2.blanked} changes, the branch on ${R1.b1.blanked} + ${R1.b2.blanked}. Lap CPU was live ${R1.l1.cpu.toFixed(1)} / ${R1.l2.cpu.toFixed(1)} s and branch ${R1.b1.cpu.toFixed(1)} / ${R1.b2.cpu.toFixed(1)} s. <b>Run 2</b> matched charts by their full address. It turned up two things, both fixed before run 3. First, the put/call pane on MACRO · 4H has no 4-hour history tonight and shows its reason instead. The branch waited its full 8 s for it, and the rig wrongly counted that pane as empty on both live and branch. Second, the switch-over sometimes ran one frame (16 ms) before the fade's last step was painted. The <code>*-run1-*</code> and <code>*-run2-*</code> files keep those runs.</p>

<h3>Cold lap, change by change</h3>
<div class="wide">${perChange(1)}</div>
<h3>Warm lap, change by change</h3>
<div class="wide">${perChange(2)}</div>
<p class="note">"Longest blank pane" is the longest total time, in this change, that any one chart pane had nothing drawn in it. "Whole page finished" is the moment from which every chart on the new page shows its line, price, clouds, lens (or its settled reason for having none) and Geiger chip (when the name has a reading). On the branch this includes the time the old page stays up while the new one draws, plus the 0.9 s fade. "Arrived fully dressed" counts, for every chart that newly appeared, whether all of those were already on it in the first frame it could be seen. A dash means no chart newly appeared.</p>

<h2>Three consecutive page changes, caught mid-dissolve (1680 wide)</h2>
<p>These were captured on the warm lap of the first full run of this branch (build 09a189c; the later fixes do not change what a fade looks like), at the moment the page fade was between 30% and 80% through.</p>
<div class="pair">
${shot("branch-1680-sectors3D-mid.png", "TARGETS → SECTORS (8 → 8), mid-fade")}
${shot("branch-1680-mainIndexes3D-mid.png", "SECTORS → SPY + QQQ (8 → 2), mid-fade")}
${shot("branch-1680-mag7-mid.png", "SPY + QQQ → MAG 7 (2 → 8), mid-fade")}
</div>
<p><b>What is visible:</b></p>
<ul>
<li><b>TARGETS → SECTORS:</b> all eight TARGETS charts are fully drawn (GOOGL, NBIS, AVGO, BE, AMZN, VST, MU, WMT), and the sector charts are showing through them. Where two badges overlap you can read both names at once, for example GOOGL and XLK in the first box. The two rotating sector slots already carry their "↻ XLU · XLB +3" and "↻ XLRE +4" marks. No box is empty.</li>
<li><b>SECTORS → SPY + QQQ</b> (eight charts becoming two): the eight sector charts are still in their eight boxes. The two big futures charts are fading in over them, each already half the width of the wall. Their RSI fan labels ("3H/6H from 9 SEP", "4H/8H/12H from 19 AUG") show through low in the left and right halves. No sector chart was stretched.</li>
<li><b>SPY + QQQ → MAG 7</b> (two becoming eight): the two big ES and NQ charts are underneath. The eight MAG 7 charts are fading in, each in its own eighth of the wall, with their badges (MSFT, AMZN, META, TSLA) already readable. No box is empty.</li>
</ul>
<p>For comparison, here is today's live Station at 0.25 s into the same three changes, on the warm lap. By then the live code had already swapped the charts. On SECTORS, the two rotating slots (XLU and XLRE) show a bare line with no clouds, no lens box and no Geiger chip; those arrive later. That is the "pop-in" the table counts.</p>
<div class="pair">
${shot("live-1680-sectors3D-t+250ms.png", "live · SECTORS at +0.25 s: XLU and XLRE bare, no clouds, lens or chip yet")}
${shot("live-1680-mainIndexes3D-t+250ms.png", "live · SPY + QQQ at +0.25 s")}
${shot("live-1680-mag7-t+250ms.png", "live · MAG 7 at +0.25 s")}
</div>
<p class="note">The cold lap is where live is roughest (SPY + QQQ · DAY left both big charts dark for ${s1((live.find((r) => r.lap === 1 && r.id === "spyQqq1D") || {}).maxBlankMs || 0)} while ES and NQ loaded their daily bars and RSI fan; MACRO · WEEK left panes dark for up to ${s1((live.find((r) => r.lap === 1 && r.id === "wkMacro") || {}).maxBlankMs || 0)}). On the branch, those same changes kept the previous page on screen until the new charts were drawn. I did not screenshot the live cold lap, because those panes are simply dark.</p>

<h2>Phone (390 wide)</h2>
<div class="pair">${shot("branch-390-targets3D-t+4000ms.png", "branch · phone · TARGETS, 4 s after the change")}<div>
<p>This branch deliberately keeps today's page change on the phone. A phone stacks the charts and only keeps two of them live, so there is no wall to dissolve. The screenshot shows TARGETS on a 390-wide phone after a page change: GOOGL and NBIS, each with its price, clouds, lens box and Geiger chip.</p>
<p>A short 4-change check on the phone behaved like live does today. The panes are briefly empty during a change (up to ${s1(Math.max(...J("phone-390-rows.json").map((r) => r.maxBlankMs)))} on a cold MACRO · WEEK). Making the phone dissolve too would be a separate piece of work.</p></div></div>

<h2>The in-slot rotation over a long run</h2>
<p>You also asked (no fix needed) whether the in-slot rotation stays as smooth at step 50 as at step 1. I left INTRADAY · 4H rotating by itself for ${Math.round(slots[slots.length - 1].t / 60000)} minutes: ${slots[slots.length - 1].fades} slot fades, which is ${steps} steps of its four rotating slots. I compared the first two minutes with the last two.</p>
<table><thead><tr><th></th><th>slot fades</th><th>empty pane time</th><th>longest frame gap</th><th>frames slower than 50 ms</th><th>CPU (share of one core)</th><th>memory (whole browser)</th><th>chart documents open</th><th>parked frames</th></tr></thead><tbody>
<tr><td>steps 1–12</td><td class="num">${W1.fades}</td><td class="num">${W1.blank} ms</td><td class="num">${W1.gap} ms</td><td class="num">${W1.gaps} of ${W1.frames}</td><td class="num">${(W1.cpu * 100).toFixed(0)}%</td><td class="num">${W1.rss[0]}–${W1.rss[1]} MB</td><td class="num">${W1.docs.join(" / ")}</td><td class="num">${W1.parked[0]}–${W1.parked[1]}</td></tr>
<tr><td>steps ${steps - 11}–${steps}</td><td class="num">${W2.fades}</td><td class="num">${W2.blank} ms</td><td class="num">${W2.gap} ms</td><td class="num">${W2.gaps} of ${W2.frames}</td><td class="num">${(W2.cpu * 100).toFixed(0)}%</td><td class="num">${W2.rss[0]}–${W2.rss[1]} MB</td><td class="num">${W2.docs.join(" / ")}</td><td class="num">${W2.parked[0]}–${W2.parked[1]}</td></tr>
</tbody></table>
<p><b>Answer: yes, it holds.</b> Nothing grows: the same number of chart documents stays open (16 once the rotation has filled its parked frames, including the video and X panes), memory stays in the same band, CPU is the same or slightly lower, and no pane is ever empty. The first two minutes show slightly more slow frames and one 116 ms gap. That is when the parked frames are first being built; after that the frames are reused. This was measured on the first build of this branch (09a189c). The two fixes made after that only affect page changes, and the in-slot code itself is the same as live. The only related change is that the two fixed slots (ES, NQ) may now also keep a parked frame for the next page change. The full 10-second log is in <code>inslot-intraday4h-1680.json</code>.</p>

<h2>The test</h2>
<ul>
<li><code>tests/station-page-dissolve-20260929.test.mjs</code> (7 checks, plus 1 that is off by default).</li>
<li>It checks that a rotation step or a page button goes through the dissolve, and that the phone, an expanded pane, SCRATCH and CUSTOM do not.</li>
<li>It checks that nothing on screen is re-pointed or removed while the next page is being prepared.</li>
<li>It checks that the fade is the 0.9 s, 8-step one, and that the wait covers the line, price, clouds, lens and chip.</li>
<li>It checks that the measured run of the whole rotation on this branch (<code>branch-1680-rows.json</code>: every page, in order, cold and warm) has <b>no change with a pane empty for over 100 ms, no box move beyond the layout, and no old chart in a new box</b>.</li>
<li>The same check is run on today's live measurements and must find failures there. This proves the check really catches the problem.</li>
<li><b>The live browser check.</b> <code>STATION_BROWSER_GATE=1 node --test tests/station-page-dissolve-20260929.test.mjs</code> reruns the whole rotation, twice, in a headless browser against the live chart API. It takes about 10 minutes. It fails if any change leaves a pane empty for longer than 100 ms or moves a pane's box. It is off in the normal test run because it needs the network and takes minutes.</li>
<li><b>Whole suite:</b> ${SUITE.tests} tests, ${SUITE.pass} pass, ${SUITE.fail} fail, ${SUITE.skipped} skipped. The ${SUITE.fail} failures are exactly the ones that fail on live today (baseline: 834 of 852 pass, 18 fail). The new file adds 8 tests: 7 pass, and the eighth is the live browser check, which is skipped by default.</li>
</ul>

<h2>Where each number comes from</h2>
<ul>
<li><b>The pages and their order:</b> <code>deck/scenes.js</code> (WORKFLOW_IDS), unchanged. No page, ticker or range was changed.</li>
<li><b>The test browser:</b> a headless Chromium (never visible, killed at the end of every run). It serves the Station files from this Mac: live = an exact copy of bacb424, which I checked byte for byte against what station.scintillahub.ai serves today (<code>deck/index.html</code>, <code>deck/scenes.js</code> and the chart shell). The branch = this worktree.</li>
<li><b>Prices and bars</b> come from the real chart API (<code>scintilla-massive-chart-api.fly.dev</code>). The API only accepts scintillahub.ai as the origin, so the rig fetches it from node with that origin and hands the answer to the page (a proxy). Supabase reads went through as normal. Every write the page tried (YouTube and Google logging posts) was refused by the rig, so nothing was written anywhere.</li>
<li><b>Empty, moved and dressed</b> are read inside the page on every painted frame. They come from what each chart frame actually has drawn: its line, its badge price, its cloud rows, its lens box and its Geiger chip.</li>
<li><b>CPU and memory</b> are the whole headless browser's process tree, read from the Mac's process list before and after each 12-second change.</li>
<li>Files: the <code>harness/</code> folder has the rig (<code>rotation.mjs</code>), the reducer (<code>analyze.mjs</code>) and this page's builder. The <code>*-rows.json</code> files have one row per change. The raw frame-by-frame logs (about 37 MB each) are not committed.</li>
</ul>

<h2>What could be wrong</h2>
<ul>
<li><b>The old page stays up a little longer.</b> On a cold change the next page can take 1–4 s to draw out of sight (MACRO · WEEK and MAG 7 were the slowest). During that time you are still looking at the previous page, fully drawn. The lap as a whole gets about ${Math.round((sum(branch.filter((r) => r.lap === 2).map((r) => r.applyMs)) - sum(live.filter((r) => r.lap === 2).map((r) => r.applyMs))) / 1000)} s longer on a warm lap (${Math.round((sum(branch.filter((r) => r.lap === 1).map((r) => r.applyMs)) - sum(live.filter((r) => r.lap === 1).map((r) => r.applyMs))) / 1000)} s cold), because each page still gets its full 33 seconds once it is up.</li>
<li><b>Clicking a page yourself</b> now waits up to 3 s (typically 0.3 s warm) for the next page before the fade starts. If that feels sluggish, see decision 1.</li>
<li><b>More open chart documents and a little more CPU.</b> Each visible slot keeps the chart it faded away from, parked for reuse. That means ${B2.docs[0]}–${B2.docs[1]} frames instead of 10, and ${B2.cpu.toFixed(1)} s instead of ${L2.cpu.toFixed(1)} s of CPU per warm lap, which is about ${((B2.cpu - L2.cpu) / B2.n).toFixed(2)} s more per change. Browser memory did not grow in these runs; it peaked at ${B1.rssMax} MB on the branch against ${L1.rssMax} MB on live. On a much weaker machine (the iMac) this has not been measured.</li>
<li><b>The readiness check reads inside the chart frames</b> (same origin, read only). If the chart pane's internals are renamed later, the wait would simply run to its cap and the page would still fade in. It would not break the page, but it would be slower. The test file pins those names.</li>
<li><b>Headless is not your screen.</b> These measurements were made in a headless browser on this MacBook, at 60 frames a second. Your display, GPU and the iMac will differ in absolute speed, but not in whether a pane goes empty.</li>
<li><b>MACRO · 4H's put/call pane</b> has no 4-hour put/call history tonight, so it shows its reason instead of a line. The branch treats that reason as the pane's finished state. Live leaves the pane dark for about 3–4 s before the reason appears.</li>
<li><b>Already there before this work:</b> ES and NQ have no 8-hour bars from the API (404). The RSI fan's 8H line is missing for them on the RSI pages. This is not caused by this change and not fixed here.</li>
</ul>

<h2>What I did not do</h2>
<ul>
<li>I did not push, deploy, or touch Fly, Vercel or Supabase. Nothing was shown on your screen.</li>
<li>I did not change any page, ticker, range or order. I did not touch <code>_indicators/</code> or the chart pane (<code>chart/</code>, <code>station-shells/chart-v1/</code>).</li>
<li>I did not change the phone: stacked walls keep today's page change.</li>
<li>I did not measure on the iMac (not allowed) or on your real display.</li>
<li>I did not measure the market-hours lap. Runs were at about 20:30–21:30 ET, when the leaders are ES/NQ. The code path is the same by day.</li>
</ul>

<h2>Decisions for you</h2>
<ol>
<li><b>Hand-picked pages: fade (as built) or instant?</b> As built, clicking a page waits for it to be drawn (typically 0.3 s, at most 3 s), then fades. <i>Recommendation: keep the fade.</i> It is the same smoothness you liked, and the wait is short once charts are saved in the browser.</li>
<li><b>Keep a parked chart per slot for reuse?</b> It makes warm changes quick (the charts are re-pointed, not rebuilt), but it keeps more documents open and costs about ${((B2.cpu - L2.cpu) / B2.n).toFixed(2)} s of CPU per change. <i>Recommendation: keep it. If the iMac shows strain, the fallback is to park frames only for rotating slots, as on 28 Sep.</i></li>
<li><b>The 8-second cap on a rotation page change.</b> If a page is still not fully drawn after 8 s, it fades in anyway, showing whatever is ready. <i>Recommendation: keep 8 s. The slowest cold change here was ${s1(Math.max(B1.doneMax, B2.doneMax) - 900)}.</i></li>
</ol>
<p class="note">Built 29 Sep 2026 by the Urth lane (Opus). Branch station/rotation-20260929 from bacb424.</p>
</body></html>`;
fs.writeFileSync(path.join(DIR, "STATION-ROTATION.html"), html);
console.log("wrote", path.join(DIR, "STATION-ROTATION.html"), html.length);
