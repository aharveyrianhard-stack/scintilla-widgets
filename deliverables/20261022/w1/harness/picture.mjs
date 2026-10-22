// W1: the summary picture. Real pixels only, from ../shots (the headless runs); the facts from ../measure.
//   node picture.mjs   -> ../W1-WIDGET-WALL.png
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), W1 = path.resolve(HERE, "..");
const J = (f) => { try { return JSON.parse(fs.readFileSync(path.join(W1, "measure", f), "utf8")); } catch (_) { return null; } };
const m = J("w1-measure.json"), tv = J("tv-probe.json"), mem = J("w1-memory.json");
const img = (f) => fs.existsSync(path.join(W1, "shots", f)) ? "data:image/png;base64," + fs.readFileSync(path.join(W1, "shots", f)).toString("base64") : "";
const PW = 1150;
const panel = (file, W, H, cap, pw = PW) => { const k = pw / W; return `<div class="p"><div class="cap">${cap}</div><div class="frame" style="width:${pw}px;height:${Math.round(H * k)}px;background:url(${img(file)}) no-repeat;background-size:${pw}px ${Math.round(H * k)}px"></div></div>`; };
const crop = (file, W, H, x, y, w, h, k, cap) => `<div class="p"><div class="cap">${cap}</div><div class="frame" style="width:${Math.round(w * k)}px;height:${Math.round(h * k)}px;background:url(${img(file)}) no-repeat;background-size:${Math.round(W * k)}px ${Math.round(H * k)}px;background-position:${-Math.round(x * k)}px ${-Math.round(y * k)}px"></div></div>`;
const S = (m && m.screens) || [];
const a2560 = S.find((s) => s.screen === "2560x1440" && s.arrangement === "a"), b2560 = S.find((s) => s.screen === "2560x1440" && s.arrangement === "b"), a1280 = S.find((s) => s.screen === "1280x800" && s.arrangement === "a");
const sh = (e) => e ? e.boot.shares : {};
const shareLine = (e) => { const s = sh(e); return `X ${s.x} % · chart 1 ${s.chart1} % · chart 2 ${s.chart2} % · YouTube ${s.video} % · meter ${s.meter} % · lenses ${s.lenses} % · tape ${s.tapes} % of the screen`; };
const spy = tv && tv.cases.spy, qqq = tv && tv.cases.qqq, clouds = tv && tv.cases["spy-clouds"];
const good = (c) => (c && c.matches || []).filter((x) => x.matched === 1);
const vw = (c) => { const g = good(c); if (!g.length) return "—"; const d = g.map((x) => x.vwapFrom0930 && x.vwapFrom0930.diff).filter((x) => x != null); return `${c.cfg.symbol}: widget ${g[0].hover.vwap} vs house (09:30 anchor, completed bars) ${g[0].vwapFrom0930.vwap} at ${g[0].bar.et} ET → ${(d[0] >= 0 ? "+" : "") + d[0].toFixed(2)} $ (range ${Math.min(...d).toFixed(3)} … ${Math.max(...d).toFixed(3)} over ${g.length} bars); vs the 04:00 anchor ${(g[0].vwapFrom0400.diff >= 0 ? "+" : "") + g[0].vwapFrom0400.diff.toFixed(2)} $`; };
const memLine = mem ? mem.runs.map((r) => `${r.label}: ${r.after5min.totalMb} MB in all after ${r.after5min.atMin} min (renderers ${r.after5min.byTypeMb.renderer || 0} · GPU ${r.after5min.byTypeMb["gpu-process"] || 0} · browser ${r.after5min.byTypeMb.browser || 0} · utility ${r.after5min.byTypeMb.utility || 0}; ${r.after5min.frames} frames)`).join(" — ") : "memory run not finished";
const facts = [
  ["the mode", `WALL · SIMPLE · WIDGETS on the dock, beside CHARTS ONLY; WIDGETS is on by itself on both Macs (nothing stored) and remembered per machine (localStorage station.widgets). Measured: ${a2560 ? `WIDGETS → WALL (stored ${a2560.wall.stored.widgets}) → SIMPLE (simpleOn ${a2560.simple.simpleOn}) → WIDGETS (${a2560.back.widgetsOn})` : "—"}; no rotation (the button is disabled and says so)`],
  ["the charts", `two TradingView Advanced Chart embeds (tv-v1), candles, VWAP on, drawing toolbar, dark, New York time, extended hours; chart 1 ${a2560 ? a2560.boot.tickers[0] : "SPY"} 5m, chart 2 ${a2560 ? a2560.boot.tickers[1] : "QQQ"} 30m (SIMPLE's last symbols). The badge → the box → Enter sets a chart and this machine remembers it (measured: NVDA typed, station.widgets.chart.1 = ${a2560 ? a2560.symbol.stored.c1 : "—"}, back after a reload: ${a2560 ? a2560.reload.tickers[0] : "—"}); the widget's own search is heard through its quoteUpdate messages and remembered the same way; an interval picked on the strip is remembered (station.widgets.tf.N), one picked inside the widget is not reported and lasts until the frame reloads`],
  ["the bars", spy ? `[VERIFIED] DELAYED and ONE VENUE: the legend's tooltip says "Market open · Data is delayed"; the feed is BATS_DLY:SPY, exchange "Cboe One" (Cboe's own exchanges, listing NYSE Arca). At ${spy.newestBar && spy.newestBar.probeEt} ET the bar forming on the widget was the tape's ${spy.newestBar && spy.newestBar.matchedHouseBar[0].et} bar (${spy.newestBar && spy.newestBar.minutesBehind} min behind the clock). Its volume is ${Math.round((spy.summary.medianVolumeShare || 0) * 100)} % of the tape's (QQQ ${qqq && qqq.summary ? Math.round(qqq.summary.medianVolumeShare * 100) : "—"} %) - ${good(spy).length + good(qqq).length} bars matched O H L C to the house 5-minute bars` : "—"],
  ["VWAP, in dollars", spy ? `${vw(spy)} · ${vw(qqq)}. The widget's "Session" VWAP is the regular-session (09:30) VWAP weighted by Cboe One volume; with extended_hours on it anchors at 04:00 (SPY read 764.39 against 764.27 at the same moment)` : "—"],
  ["clouds", clouds ? `(a) [VERIFIED] NO: a public community script in studies (${tv.community.name}, ${tv.community.id}) is refused - pine-facade answers 403 and the legend carries only Vol and VWAP. (b) [VERIFIED] NO: the widget's own Indicators menu lists TradingView's built-ins only; a search for "Squeeze Momentum" says "No indicators matched your criteria". What would work instead: his clouds stay where they already draw - chart-v1 (WALL · SIMPLE) and the custom chart; the free embed cannot show any Pine script that is not TradingView's own, published or not` : "—"],
  ["memory", memLine],
  ["layout A · B", `A (recommended): ${shareLine(a2560)}. B: ${shareLine(b2560)}. At 1280 × 800 (A): ${shareLine(a1280)}`],
];
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0A0A0F;color:#F2F2F8;font:16px "SF Mono",Menlo,monospace;width:2440px;padding:28px 34px;box-sizing:border-box}
h1{font-size:30px;margin:0 0 4px;letter-spacing:.02em} .sub{color:#9A9AB6;font-size:16px;margin-bottom:22px}
.row{display:flex;gap:34px;align-items:flex-start;margin-bottom:26px;flex-wrap:wrap} .cap{color:#00D4FF;font-size:15px;margin:0 0 8px;letter-spacing:.04em;max-width:${PW}px;line-height:1.35}
.cap b{color:#F2F2F8;font-weight:600} .frame{position:relative;border:1px solid #1A1A2A}
.facts{display:grid;grid-template-columns:190px 1fr;gap:10px 18px;font-size:14.5px;line-height:1.45;margin-top:6px;max-width:2360px} .facts .k{color:#00D4FF;letter-spacing:.06em;text-transform:uppercase;font-size:13px;padding-top:2px}
</style><body>
<h1>W1 · the WIDGETS wall</h1>
<div class="sub">two TradingView charts Alan sets (VWAP on both) · the volume meter · a lens set (RADAR · MACRO · MINE) · YouTube with its grid beside the player · one taller FAVORITES tape · X · no rotation — measured headless on the real deck, ${(m && m.at || "").slice(0, 16).replace("T", " ")} UTC · branch station/w1-widget-wall-20261022 on a4fae52</div>
<div class="row">${panel("w1-widgets-a-2560x1440.png", 2560, 1440, "<b>WIDGETS, arrangement A (recommended) at 2560 × 1440</b> · the MacBook's external display · the meter and the lenses in a column right of YouTube")}${panel("w1-today-2560x1440.png", 2560, 1440, "<b>today (@a4fae52, the WALL) at 2560 × 1440</b> · nine rotating charts, the YouTube pane in a block of the grid")}</div>
<div class="row">${panel("w1-widgets-b-2560x1440.png", 2560, 1440, "<b>WIDGETS, arrangement B at 2560 × 1440</b> · a band of widgets between the charts and YouTube across the whole width")}${panel("w1-widgets-a-1280x800.png", 2560, 1600, "<b>WIDGETS A at 1280 × 800 (dpr 2)</b> · the built-in display and the iMac")}</div>
<div class="row">${panel("w1-video-beside.png", 1206, 616, "<b>a video playing with the grid beside it</b> · the pane at the size the A arrangement gives it on the 2560 wall; a tap on another thumbnail switches, BACK gives the grid the pane", 760)}${panel("w1-lenses-radar.png", 740, 560, "<b>the lens set on RADAR</b> · sixty daily candles in chart-v1's oval, the edge and the head in the day's colour", 560)}${panel("w1-lenses-macro.png", 740, 560, "<b>the lens set on MACRO</b> · VIX DXUSD US10Y GCUSD CLUSD BTCUSD", 560)}</div>
<div class="row">${fs.existsSync(path.join(W1, "shots/w1-tape-2560x1440.png")) ? crop("w1-tape-2560x1440.png", 1400, 48, 0, 0, 1400, 48, 1.7, "<b>the tape, close up (1.7×)</b> · ticker and price, the percent under them, the line on the right; 48 px tall; no Geiger") : ""}</div>
<div class="row">${panel("tv-spy-hover.png", 1240, 760, "<b>the VWAP comparison</b> · the probe's pointer on a completed SPY bar: the legend's O H L C matched to the house bar, the widget's VWAP read beside it (tv-probe.json)", 760)}${panel("tv-spy-clouds-indicators-search.png", 1240, 760, "<b>the clouds test (b)</b> · the widget's own Indicators menu, searched for a public community script: none", 760)}${panel("tv-spy-ext.png", 1240, 760, "<b>extended hours on</b> · the embed honours extended_hours: true (the shaded pre- and after-market)", 760)}</div>
<div class="facts">${facts.map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`).join("")}</div>
</body>`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 2440, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html); await page.waitForTimeout(600);
await page.screenshot({ path: path.join(W1, "W1-WIDGET-WALL.png"), fullPage: true });
await browser.close(); console.log("wrote", path.join(W1, "W1-WIDGET-WALL.png"));
