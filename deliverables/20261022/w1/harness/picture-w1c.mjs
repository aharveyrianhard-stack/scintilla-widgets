// W1C: the picture. The wall idle and with a video playing at 2560 x 1440 and 1280 x 800; the lens tape close up on RADAR and MACRO; the
// FAVORITES tape close up; the volume column close up with live numbers. Real pixels from ../shots; the facts from ../measure.
//   node picture-w1c.mjs -> ../W1C-WALL.png
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), W1 = path.resolve(HERE, "..");
const m = JSON.parse(fs.readFileSync(path.join(W1, "measure", "w1c-measure.json"), "utf8"));
const img = (f) => fs.existsSync(path.join(W1, "shots", f)) ? "data:image/png;base64," + fs.readFileSync(path.join(W1, "shots", f)).toString("base64") : "";
const PW = 1150;
const panel = (file, W, H, cap, pw = PW) => { const k = pw / W; return `<div class="p"><div class="cap">${cap}</div><div class="frame" style="width:${pw}px;height:${Math.round(H * k)}px;background:url(${img(file)}) no-repeat;background-size:${pw}px ${Math.round(H * k)}px"></div></div>`; };
const wall = (s) => m.walls.find((w) => w.screen === s);
const shares = (r) => { const s = r.shares; return `X ${s.x} % · charts ${s.chart1} % each · lens tape ${s.lensTape == null ? "—" : s.lensTape + " %"} · YouTube ${s.video} % · volume ${s.volume} % · tape ${s.tapes} %`; };
const px = (b) => b ? b.w + " × " + b.h : "—";
const row = (screen, W, H, imgH) => { const w = wall(screen), i = w.idle, p = w.playing;
  return `<div class="row">${panel(`w1c-idle-${screen}.png`, W, imgH, `<b>WIDGETS at ${screen}, idle</b> · charts ${px(i.charts[0].box)} each · lens tape ${px(i.lensTape)} · YouTube ${px(i.video)} · volume ${px(i.volume)} · FAVORITES tape ${px(i.tapes)} at the bottom · ${shares(i)}`)}
  ${panel(`w1c-playing-${screen}.png`, W, imgH, `<b>the same, a video playing</b> · picture <b>${w.play && w.play.picture ? px(w.play.picture) : "—"}</b> (W1B's floor, kept) with the grid beside it · X ${px(p.x)} · lens tape ${p.lensTape ? px(p.lensTape) : "stood down (no room on this wall while a video plays)"} · volume ${px(p.volume)} · ${shares(p)}`)}</div>`; };
const lt = (list) => m.lensTape[list].reading;
const vol = m.volume.reading;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0A0A0F;color:#F2F2F8;font:16px "SF Mono",Menlo,monospace;width:2440px;padding:28px 34px;box-sizing:border-box}
h1{font-size:30px;margin:0 0 4px;letter-spacing:.02em} .sub{color:#9A9AB6;font-size:16px;margin-bottom:22px;line-height:1.4}
.row{display:flex;gap:34px;align-items:flex-start;margin-bottom:26px;flex-wrap:wrap} .cap{color:#00D4FF;font-size:15px;margin:0 0 8px;letter-spacing:.04em;max-width:${PW}px;line-height:1.4}
.cap b{color:#F2F2F8;font-weight:600} .frame{position:relative;border:1px solid #1A1A2A}
.facts{display:grid;grid-template-columns:200px 1fr;gap:10px 18px;font-size:14.5px;line-height:1.45;margin-top:6px;max-width:2360px} .facts .k{color:#00D4FF;letter-spacing:.06em;text-transform:uppercase;font-size:13px;padding-top:2px}
</style><body>
<h1>W1C · the WIDGETS wall as Alan placed it</h1>
<div class="sub">a lens tape where the ticker tape was (5-minute bars) · FAVORITES at the very bottom, stacked cells · the volume graph in the right column · the video keeps its size with the grid beside it · the two TradingView charts untouched · measured headless on the real deck, ${m.at.slice(0, 16).replace("T", " ")} UTC · branch station/w1-widget-wall-20261022 on a4fae52</div>
${row("2560x1440", 2560, 1440, 1440)}
${row("1280x800", 1280, 800, 1600)}
<div class="row">${panel("w1c-lenstape-radar.png", 1945, 160, `<b>the lens tape on RADAR</b> (alone, at the 2560 wall's width) · ${lt("radar").lenses.length} lenses, each 290 × 160, the last 120 completed 5-minute bars in chart-v1's oval, the edge and the head in the day's colour; the row runs at 45 px/s (${lt("radar").duration} a lap), the pointer holds it`, 2360)}</div>
<div class="row">${panel("w1c-lenstape-macro.png", 1945, 160, `<b>the lens tape on MACRO</b> · ${lt("macro").lenses.length} lenses: ${lt("macro").lenses.map((l) => l.head).join(" · ")} - shorter than the window, so it stands`, 2360)}</div>
<div class="row">${panel("w1c-tape-2560x1440.png", 1400, 66, `<b>the FAVORITES tape, close up</b> · each cell 156 px wide, 66 tall: the ticker, the day's percent under it, the price under that, the line on the right across the three; tabular numbers, one baseline; no Geiger; the price flashes, the line is the day's colour`, 2360)}</div>
<div class="row">${panel("w1c-volume-2560x1440.png", 738, 576, `<b>the volume column, close up</b> (${vol.state}, live numbers) · <b>${vol.num}</b> ${vol.of} · lights: ${vol.lights.join(", ")} · ${vol.facts} · the graph: the line blue under 1.5×, amber to 2×, hot over; the normal and 2× lines; the block dots green up / red down; 04:00–20:00`, 760)}${panel("w1c-volume-alone.png", 739, 576, "<b>the same column at 739 × 576</b> (the 2560 wall's column), alone", 760)}</div>
<div class="facts">
<div class="k">top to bottom</div><div>the two TradingView charts (as W1 built them) · the LENS TAPE: the RADAR · MACRO · MINE chips in a rail at its left (the choice remembered), one row of lenses on the last 120 completed 5-minute bars (ten hours of extended trading), moving like the other tapes, 160 px tall on the 2560 wall, 130 on the 1280 · the band, 40 % of the height: YouTube on the left (62 % of the width; a playing video takes W1B's size with the grid beside it), the VOLUME GRAPH in the column right of it (volume-v1: the research session's graph from its public feed, 8 s in session) · the FAVORITES tape at the very bottom (66 px, stacked cells).</div>
<div class="k">while a video plays</div><div>W1B's layout, with the tapes in their new places: X 16 %, the pane at the floor picture plus the grid's column, the volume column right of it, the lens tape over the pane at 110 px on the 2560 wall; on the 1280 wall the lens tape stands down while the video plays (the charts would be under 200 px otherwise), and comes back when it stops.</div>
<div class="k">left the wall</div><div>the pill meter (it stays his PiP), the lens column, the A · B button.</div>
</div>
</body>`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 2440, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html); await page.waitForTimeout(600);
await page.screenshot({ path: path.join(W1, "W1C-WALL.png"), fullPage: true });
await browser.close(); console.log("wrote", path.join(W1, "W1C-WALL.png"));
