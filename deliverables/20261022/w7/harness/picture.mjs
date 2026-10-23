// W7: the picture. The wall idle and playing at 2560 x 1440, 1920 x 1080 (the Apple TV) and 1280 x 800; the lens grid in BARS and LINE with
// RVol; the volume panel close up; the synced timeframe and the typed ticker. Real pixels from ../shots; the facts from ../measure.
//   node picture.mjs -> ../W7-WALL.png
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), W7 = path.resolve(HERE, "..");
const m = JSON.parse(fs.readFileSync(path.join(W7, "measure", "w7-measure.json"), "utf8"));
const img = (f) => fs.existsSync(path.join(W7, "shots", f)) ? "data:image/png;base64," + fs.readFileSync(path.join(W7, "shots", f)).toString("base64") : "";
const PW = 1150;
const panel = (file, W, H, cap, pw = PW) => { const k = pw / W; return `<div class="p"><div class="cap">${cap}</div><div class="frame" style="width:${pw}px;height:${Math.round(H * k)}px;background:url(${img(file)}) no-repeat;background-size:${pw}px ${Math.round(H * k)}px"></div></div>`; };
const wall = (s) => m.walls.find((w) => w.screen === s);
const px = (b) => b ? b.w + " × " + b.h : "—";
const shares = (r) => `X ${r.shares.x} % · charts ${r.shares.chart1} % each · YouTube ${r.shares.video} % · lenses ${r.shares.lens} % · volume ${r.shares.volume} % · tape ${r.shares.tapes} %`;
const row = (key, W, H, imgH, note) => { const w = wall(key), i = w.idle, p = w.playing;
  return `<div class="row">${panel(`w7-idle-${key}.png`, W, imgH, `<b>${key}${note}, idle</b> · X ${px(i.x)} · charts ${px(i.c1.box)} each · YouTube ${px(i.video)} bottom-left · lens grid ${px(i.lens)}, ${i.rows} row${i.rows === 1 ? "" : "s"} · volume ${px(i.volume)} · FAVORITES tape ${px(i.tapes)} from YouTube's right edge · ${shares(i)}`)}
  ${panel(`w7-playing-${key}.png`, W, imgH, `<b>the same, a video playing</b> · picture <b>${w.play && w.play.picture ? px(w.play.picture) : "—"}</b> (W1B's floor, kept) from the screen's left edge · charts ${px(p.c1.box)} each · lens grid ${px(p.lens)}, ${p.rows} rows · volume ${px(p.volume)} · ${shares(p)}`)}</div>`; };
const s25 = wall("2560x1440");
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0A0A0F;color:#F2F2F8;font:16px "SF Mono",Menlo,monospace;width:2440px;padding:28px 34px;box-sizing:border-box}
h1{font-size:30px;margin:0 0 4px;letter-spacing:.02em} .sub{color:#9A9AB6;font-size:16px;margin-bottom:22px;line-height:1.4}
.row{display:flex;gap:34px;align-items:flex-start;margin-bottom:26px;flex-wrap:wrap} .cap{color:#00D4FF;font-size:15px;margin:0 0 8px;letter-spacing:.04em;max-width:${PW}px;line-height:1.4}
.cap b{color:#F2F2F8;font-weight:600} .frame{position:relative;border:1px solid #1A1A2A}
.facts{display:grid;grid-template-columns:200px 1fr;gap:10px 18px;font-size:14.5px;line-height:1.45;margin-top:6px;max-width:2360px} .facts .k{color:#00D4FF;letter-spacing:.06em;text-transform:uppercase;font-size:13px;padding-top:2px}
</style><body>
<h1>W7 · the WIDGETS wall, round 3</h1>
<div class="sub">bigger charts synced on everything but the ticker · YouTube in the bottom-left corner under a slimmer X · the lens tape in bars with bigger text and each name's RVol · the volume panel redone · MACRO = SPY QQQ, the futures beside them, VIX, put/call, advance/decline, oil, the 10-year, bitcoin, gold, the dollar · measured headless on the real deck, ${m.at.slice(0, 16).replace("T", " ")} UTC · branch station/w7-wall-round3-20261022 on 52b730d</div>
${row("2560x1440", 2560, 1440, 1440, "")}
${row("1920x1080", 1920, 1080, 1080, " · his Apple TV")}
${row("1280x800", 1280, 800, 1600, " (dpr 2)")}
<div class="row">${panel("w7-synced-2560x1440.png", 2560, 1440, `<b>one click on the control row: 15m on both charts</b> · tf = ${s25.synced.tfOne}: chart 1 ${s25.synced.c1.shell} tf=${s25.synced.c1.tf}, chart 2 ${s25.synced.c2.shell} tf=${s25.synced.c2.tf} · then NVDA typed into chart 2's box → ${s25.typed.tickers.join(" · ")}`)}${panel("w7-lensgrid-macro-bars.png", 1255, 515, `<b>the lens grid on MACRO, BARS</b> (alone, the 2560 band's size, three rows) · ${(m.lens_macro_bars.reading.lenses || []).map((l) => l.t === "ADVDEC" ? "ADV/DEC" : l.t).join(" · ")} · each lens: ticker, price, %, its RVol battery and multiple, the name, the latest 30 five-minute candles (150 minutes); PUT/CALL its daily bars; ADVANCE/DECLINE a number`)}</div>
<div class="row">${panel("w7-lensgrid-macro-line.png", 1255, 515, "<b>the same on LINE</b> · the switch on the rail, remembered")}${panel("w7-lensgrid-mine-bars.png", 1255, 515, `<b>MINE, BARS</b> · ${(m.lens_mine_bars.reading.lenses || []).map((l) => l.t).join(" · ")} (station_lists · mine)`)}</div>
<div class="row">${panel("w7-volume-2560x1440.png", s25.idle.volume.w, s25.idle.volume.h, "<b>the volume panel close up</b> · ONE pulsing dot, the multiple, the thermometer (1× and 2× ticks, 3× the top) · 2-MIN FLOW buy / sell (who is in control now) · 5-MIN multiple (does it sustain) · VWAP and DIRECTION badges · trade size · last block · the 5-minute close countdown", 435)}${panel("w7-tape-2560x1440.png", 1400, 66, "<b>the FAVORITES tape</b> · each cell: ticker, %, price, the line, and now its RVol battery and multiple", 1600)}</div>
<div class="facts">
<div class="k">the layout</div><div>X's column 18 % of the wall (16 % while a video plays), its capture scaled down with it; YouTube from the screen's left edge, 34 % of the wall wide, over the foot of X's column - the band is its picture plus the bar; the two charts have everything above the band; right of YouTube in the band: the lens grid (rows of ~150 px lenses, as many as the band holds) and the volume panel (17 %), both over the FAVORITES tape, which runs from YouTube's right edge to the screen's right edge at the very bottom. A playing video keeps W1B's size and the grid beside it, from the screen's left edge.</div>
<div class="k">synced</div><div>one control row above both charts: 1m 5m 15m 30m 1h 1D and CLOUDS for both, remembered on this machine (station.widgets.tf, station.widgets.clouds); the live frames get &sync=1 and { sc:"chart", tf, clouds } by message (the contract W8 implements in live-v1); the TV frames their address; a ticker typed on either chart (tv-v1's box now; live-v1's with W8) is that chart's alone (SCINTILLA_CHART_TICKER).</div>
<div class="k">the volume panel</div><div>the second flashing point at 2.2× was the trace's beating last dot, pulsing beside the heartbeat circle; the trace is gone and the one pulsing thing is the meter's dot.</div>
</div>
</body>`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 2440, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html); await page.waitForTimeout(600);
await page.screenshot({ path: path.join(W7, "W7-WALL.png"), fullPage: true });
await browser.close(); console.log("wrote", path.join(W7, "W7-WALL.png"));
