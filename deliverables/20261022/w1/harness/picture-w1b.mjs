// W1B: the picture. Today's playing video (@a4fae52, the WALL with nine charts - the larger of WALL and SIMPLE) beside WIDGETS' playing
// video at 2560 x 1440 and 1280 x 800, the numbers on the picture. Real pixels from ../shots; the facts from ../measure.
//   node picture-w1b.mjs -> ../W1B-YOUTUBE-SIZE.png
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), W1 = path.resolve(HERE, "..");
const J = (f) => JSON.parse(fs.readFileSync(path.join(W1, "measure", f), "utf8"));
const today = J("w1b-today.json"), widgets = J("w1b-widgets.json");
const img = (f) => "data:image/png;base64," + fs.readFileSync(path.join(W1, "shots", f)).toString("base64");
const PW = 1150;
const panel = (file, W, H, cap, pw = PW) => { const k = pw / W; return `<div class="p"><div class="cap">${cap}</div><div class="frame" style="width:${pw}px;height:${Math.round(H * k)}px;background:url(${img(file)}) no-repeat;background-size:${pw}px ${Math.round(H * k)}px"></div></div>`; };
const T = (screen, name) => today.runs.find((r) => r.screen === screen && r.name === name), Wd = (screen) => widgets.runs.find((r) => r.screen === screen && r.name === "widgets-a");
const pic = (r) => r && r.play && r.play.picture ? r.play.picture.w + " × " + r.play.picture.h : "—";
const share = (r, b) => { const a = r.after; return b ? (b.w * b.h / (a.win.w * a.win.h) * 100).toFixed(1) + " %" : "—"; };
const row = (screen, W, H, imgH) => { const tw = T(screen, "wall-9"), ts = T(screen, "simple"), td = T(screen, "wall-default"), w = Wd(screen); const a = w.after;
  return `<div class="row">${panel(`w1b-today-wall-9-${screen}.png`, W, imgH, `<b>today (@a4fae52) at ${screen}, the WALL with nine charts, a video playing</b> · picture <b>${pic(tw)}</b> (SIMPLE's at this size: ${pic(ts)}; the WALL as it boots, two charts: ${pic(td)}) - the larger is the floor`)}
  ${panel(`w1b-widgets-widgets-a-${screen}.png`, W, imgH, `<b>WIDGETS at ${screen}, the same video playing</b> · picture <b>${pic(w)}</b> - the floor, not a pixel less; the grid in a ${w.play.grid.w} px column beside it; X ${a.x.w} px (${share(w, a.x)}); charts ${a.charts.map((c) => c.box.w + " × " + c.box.h).join(" and ")} (${share(w, a.charts[0].box)} each); the pane ${a.video.w} × ${a.video.h} (${share(w, a.video)}); meter ${a.meter ? a.meter.w + " × " + a.meter.h + " (" + share(w, a.meter) + ")" : "—"}; lenses ${a.lenses ? a.lenses.w + " × " + a.lenses.h + " (" + share(w, a.lenses) + ")" : "stood down (no room beside the picture)"}; tape ${share(w, a.tapes)}`)}</div>`; };
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0A0A0F;color:#F2F2F8;font:16px "SF Mono",Menlo,monospace;width:2440px;padding:28px 34px;box-sizing:border-box}
h1{font-size:30px;margin:0 0 4px;letter-spacing:.02em} .sub{color:#9A9AB6;font-size:16px;margin-bottom:22px;line-height:1.4}
.row{display:flex;gap:34px;align-items:flex-start;margin-bottom:26px} .cap{color:#00D4FF;font-size:15px;margin:0 0 8px;letter-spacing:.04em;max-width:${PW}px;line-height:1.4}
.cap b{color:#F2F2F8;font-weight:600} .frame{position:relative;border:1px solid #1A1A2A}
.facts{display:grid;grid-template-columns:200px 1fr;gap:10px 18px;font-size:14.5px;line-height:1.45;margin-top:6px;max-width:2360px} .facts .k{color:#00D4FF;letter-spacing:.06em;text-transform:uppercase;font-size:13px;padding-top:2px}
</style><body>
<h1>W1B · the playing video keeps its size</h1>
<div class="sub">Alan, 22 Oct 14:10 ET: "don't shrink my YouTube size, please … shift it to the side, keep the grid to the side of it … if the Twitter has to be a little slimmer, that's fine." Measured headless on the real deck, ${widgets.at.slice(0, 16).replace("T", " ")} UTC · branch station/w1-widget-wall-20261022 on a4fae52</div>
${row("2560x1440", 2560, 1440, 1440)}
${row("1280x800", 1280, 800, 1600)}
<div class="facts">
<div class="k">the floor</div><div>today's playing picture, the larger of the WALL's (nine charts, the 2 × 2 block) and SIMPLE's (the 60/40 band): 2560 × 1440 → <b>1296 × 729</b> (WALL; SIMPLE 972 × 547); 1280 × 800 → <b>648 × 365</b> (WALL; SIMPLE 517 × 291). The deck computes it from its own numbers (widgetsFloorPicture), so it follows the screen.</div>
<div class="k">while a video plays</div><div>X's column goes from 24 % to 16 % of the width (its width only); the pane becomes the floor picture plus a fixed grid column (300 px on a wall 1800 px wide or more, 220 below), at the bottom left of the chart area; the meter and the lens set take the column to its right; the two charts above give up the height (2560: 756 → 631 px tall, 972 → 1074 wide). BACK, Esc or the end of the video: X back to 24 %, the A or B arrangement as before.</div>
<div class="k">at 1280 × 800</div><div>beside a 648 px picture and its 220 px column there are 205 px left: the lens set stands down while the video plays and the meter scales to the column; both come back when it stops.</div>
<div class="k">untouched</div><div>the two chart slots (tv-v1 exactly as W1 built it), the X pane's bridge, crop and zoom, Y7 · Y8 · Y10, the theatre (⛶) and a chart solo keep their own layouts.</div>
</div>
</body>`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 2440, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html); await page.waitForTimeout(600);
await page.screenshot({ path: path.join(W1, "W1B-YOUTUBE-SIZE.png"), fullPage: true });
await browser.close(); console.log("wrote", path.join(W1, "W1B-YOUTUBE-SIZE.png"));
