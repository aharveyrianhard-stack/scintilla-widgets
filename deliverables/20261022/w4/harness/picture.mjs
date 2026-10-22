// W4: the picture. The wall at 2560 x 1440 and 1280 x 800 (both charts LIVE, the tight lens tape, the volume panel), the lens tape on MINE and
// MACRO (live futures), the volume panel close up with the countdown (and its flash at a close), the embed zoomed out with the click proof,
// the two-close live measurement. Real pixels from ../shots; the facts from ../measure.
//   node picture.mjs -> ../W4-WALL.png
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), W4 = path.resolve(HERE, "..");
const J = (f) => { try { return JSON.parse(fs.readFileSync(path.join(W4, "measure", f), "utf8")); } catch (_) { return null; } };
const m = J("w4-measure.json"), live = J("w4-live.json");
const img = (f) => fs.existsSync(path.join(W4, "shots", f)) ? "data:image/png;base64," + fs.readFileSync(path.join(W4, "shots", f)).toString("base64") : "";
const PW = 1150;
const panel = (file, W, H, cap, pw = PW) => { const k = pw / W; return `<div class="p"><div class="cap">${cap}</div><div class="frame" style="width:${pw}px;height:${Math.round(H * k)}px;background:url(${img(file)}) no-repeat;background-size:${pw}px ${Math.round(H * k)}px"></div></div>`; };
const wall = (s) => m.walls.find((w) => w.screen === s);
const arr = (list) => (live && live.lists[list] && live.lists[list].arrivals) || [];
const arrLine = (list) => { const a = arr(list); if (!a.length) return "no close inside the run"; const byClose = {}; for (const x of a) (byClose[x.closedAt] = byClose[x.closedAt] || []).push(x); return Object.entries(byClose).map(([c, xs]) => `${c}: ${xs.map((x) => x.t + " +" + x.secondsAfterClose + " s").join(", ")}`).join(" · "); };
const v25 = wall("2560x1440").volume, l25 = wall("2560x1440").lens, l12 = wall("1280x800").lens;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0A0A0F;color:#F2F2F8;font:16px "SF Mono",Menlo,monospace;width:2440px;padding:28px 34px;box-sizing:border-box}
h1{font-size:30px;margin:0 0 4px;letter-spacing:.02em} .sub{color:#9A9AB6;font-size:16px;margin-bottom:22px;line-height:1.4}
.row{display:flex;gap:34px;align-items:flex-start;margin-bottom:26px;flex-wrap:wrap} .cap{color:#00D4FF;font-size:15px;margin:0 0 8px;letter-spacing:.04em;max-width:${PW}px;line-height:1.4}
.cap b{color:#F2F2F8;font-weight:600} .frame{position:relative;border:1px solid #1A1A2A}
.facts{display:grid;grid-template-columns:200px 1fr;gap:10px 18px;font-size:14.5px;line-height:1.45;margin-top:6px;max-width:2360px} .facts .k{color:#00D4FF;letter-spacing:.06em;text-transform:uppercase;font-size:13px;padding-top:2px}
</style><body>
<h1>W4 · tonight's WIDGETS fixes, for the Asia session</h1>
<div class="sub">tight fast lenses on the latest 5-minute bars, live · MINE from the database · MACRO = what trades overnight · the volume panel's important numbers big, a heartbeat and a candle-close countdown · the TradingView embed zoomed out · both charts LIVE · measured headless on the real deck, ${m.at.slice(0, 16).replace("T", " ")} UTC · branch station/w4-lenses-volume-20261022 on ebd94aa</div>
<div class="row">${panel("w4-wall-2560x1440.png", 2560, 1440, `<b>the wall at 2560 × 1440</b> · both charts LIVE (TV one click away) · the lens tape 120 px, 150 px cells, MINE's ${l25.names.length} names (${l25.names.join(" ")}) · the volume panel: buy ${v25.buy} / sell ${v25.sell} at 44 px, trade size ${v25.tsize.split("\\n")[0]}, the countdown ${v25.mmss}`)}${panel("w4-wall-1280x800.png", 2560, 1600, `<b>the wall at 1280 × 800 (dpr 2)</b> · the lens tape 100 px; ${l12.onScreen} of MINE's six on screen at once, the row running (${l12.duration} a lap at 90 px/s)`)}</div>
<div class="row">${panel("w4-lenstape-mine.png", 1945, 120, `<b>the lens tape on MINE</b> (alone, the 2560 wall's width) · ${(live && live.lists.mine && live.lists.mine.names || []).join(" · ")} from station_lists · mine · each cell 150 × 120: ticker, price, %, the latest 30 five-minute closes as a line in the day's colour, the live price as the last point (the ring) · the "+ ticker · Enter" box at the left`, 2360)}</div>
<div class="row">${panel("w4-lenstape-macro.png", 1945, 120, `<b>the lens tape on MACRO</b> · ${(live && live.lists.macro && live.lists.macro.names || []).join(" · ")} with their plain names (S&P FUT, NASDAQ FUT, OIL, GOLD, BITCOIN, DOLLAR, 10-YEAR, VIX) - the futures and oil live after the close`, 2360)}</div>
<div class="row">${panel("w4-volume-2560x1440.png", 738, 576, `<b>the volume panel close up</b> · BUY / SELL flow biggest · TRADE SIZE and the BLOCK with their side · ABOVE VWAP and DIRECTION the big lights · the heartbeat circle (the current multiple, sized and coloured by its level) with the last hour's trace · the 5-minute countdown top right`, 738)}${panel("w4-volume-flash.png", 738, 576, `<b>the countdown at a close</b> · measured: ${m.volumeAlone && m.volumeAlone.flash ? "flashed at the " + m.volumeAlone.flash.closedAt + " close, then " + m.volumeAlone.flash.mmss + " to the next" : "no close inside the run"}`, 738)}${panel("w4-tv-zoom-click.png", 1074, 756, `<b>the embed zoomed out (125 % scaled to 0.8)</b> · a real pointer click at page (${m.tvZoom.click.clickedAtPage.x}, ${m.tvZoom.click.clickedAtPage.y}) on the Indicators button mapped through the transform → the dialog opened (${m.tvZoom.click.dialogOpened}) - the drawing tools land where the pointer is`, 760)}</div>
<div class="facts">
<div class="k">live, measured</div><div>${live ? `${live.startedEt}–${live.endedEt} ET, the lens tape alone on MINE and MACRO, polled every second (${live.network.candles} /candles and ${live.network.quotes} /quotes reads by the two pages in ${live.minutes} min): a bar that just closed on screen, seconds after its close - MINE: ${arrLine("mine")} · MACRO: ${arrLine("macro")} · the live price moved the last point ${live.lists.mine.priceMoves} times on MINE and ${live.lists.macro.priceMoves} on MACRO.` : "the live run is not finished"}</div>
<div class="k">the bars</div><div>the chart API's tf=5m through the provider client, a fresh read (forming:true, max-age 15) 4 s after every 5-minute close and again at +8 +12 +16 +25 +40 s while the new bar is not in; the quote every 10 s. The provider hands its rows newest first - sorted oldest first (the first run drew them backwards; fixed and re-measured).</div>
<div class="k">what did not change</div><div>live-v1 (W5's), X and the bridge, the two chart slots' plumbing; TV is one click on either strip.</div>
</div>
</body>`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 2440, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html); await page.waitForTimeout(600);
await page.screenshot({ path: path.join(W4, "W4-WALL.png"), fullPage: true });
await browser.close(); console.log("wrote", path.join(W4, "W4-WALL.png"));
