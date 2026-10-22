// W3: the picture. The wall with chart 1 LIVE and chart 2 TV at 2560 x 1440 and 1280 x 800, the two strips close up, the wall after a
// switch both ways, and the URL's one-load choice. Real pixels from ../shots; the facts from ../measure/w3-measure.json.
//   node picture.mjs -> ../W3-SWITCH.png
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), W3 = path.resolve(HERE, "..");
const m = JSON.parse(fs.readFileSync(path.join(W3, "measure", "w3-measure.json"), "utf8"));
const img = (f) => fs.existsSync(path.join(W3, "shots", f)) ? "data:image/png;base64," + fs.readFileSync(path.join(W3, "shots", f)).toString("base64") : "";
const PW = 1150;
const panel = (file, W, H, cap, pw = PW) => { const k = pw / W; return `<div class="p"><div class="cap">${cap}</div><div class="frame" style="width:${pw}px;height:${Math.round(H * k)}px;background:url(${img(file)}) no-repeat;background-size:${pw}px ${Math.round(H * k)}px"></div></div>`; };
const S = (k) => m.screens.find((s) => s.screen === k);
const slot = (c) => `${c.shell === "live" ? "LIVE" : "TV"} ${c.t} ${c.tf}${/^\d+$/.test(c.tf || "") ? (c.tf === "60" ? "m→1h" : "m") : ""}`;
const row = (key, W, H, imgH) => { const s = S(key); return `<div class="row">${panel(`w3-wall-${key}.png`, W, imgH, `<b>the wall at ${key}, as it boots with nothing stored</b> · chart 1 <b>${slot(s.boot.c1)}</b> (live-v1: the whole tape, VWAP 09:30 and 04:00, his clouds) · chart 2 <b>${slot(s.boot.c2)}</b> (TradingView's embed) · the strips say LIVE · TV, the live one green`)}
  ${panel(`w3-switched-${key}.png`, W, imgH, `<b>after a switch both ways</b> · chart 1 ${slot(s.afterSwitch.c1)} (15m was chosen on the live chart first - carried) · chart 2 ${slot(s.afterSwitch.c2)} (QQQ 30m carried) · stored src.1 = ${s.afterSwitch.stored.s1}, src.2 = ${s.afterSwitch.stored.s2}, tf.1 = ${s.afterSwitch.stored.tf1} · then NVDA typed through the badge → chart 1 (${s.symbol.c1.shell}) shows ${s.symbol.c1.t} · a reload: chart 1 ${slot(s.reload.c1)}, chart 2 ${slot(s.reload.c2)}`)}</div>`; };
const s25 = S("2560x1440");
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0A0A0F;color:#F2F2F8;font:16px "SF Mono",Menlo,monospace;width:2440px;padding:28px 34px;box-sizing:border-box}
h1{font-size:30px;margin:0 0 4px;letter-spacing:.02em} .sub{color:#9A9AB6;font-size:16px;margin-bottom:22px;line-height:1.4}
.row{display:flex;gap:34px;align-items:flex-start;margin-bottom:26px;flex-wrap:wrap} .cap{color:#00D4FF;font-size:15px;margin:0 0 8px;letter-spacing:.04em;max-width:${PW}px;line-height:1.4}
.cap b{color:#F2F2F8;font-weight:600} .frame{position:relative;border:1px solid #1A1A2A}
.facts{display:grid;grid-template-columns:200px 1fr;gap:10px 18px;font-size:14.5px;line-height:1.45;margin-top:6px;max-width:2360px} .facts .k{color:#00D4FF;letter-spacing:.06em;text-transform:uppercase;font-size:13px;padding-top:2px}
</style><body>
<h1>W3 · LIVE or TV on each WIDGETS chart</h1>
<div class="sub">W2's live-v1 on the wall beside the TradingView embed, one switch per chart on its strip, remembered per chart per machine; the symbol and the interval carried across a switch · measured headless on the real deck, ${m.at.slice(0, 16).replace("T", " ")} UTC · branch station/w3-live-tv-switch-20261022 on d9bf923 + W2</div>
${row("2560x1440", 2560, 1440, 1440)}
${row("1280x800", 1280, 800, 1600)}
<div class="row">${panel("w3-strip-live-2560x1440.png", 700, 48, "<b>the switch close up · chart 1's strip (live-v1)</b> · 1m 5m 15m 30m 1h 1D · LIVE (green) · TV · CLOUDS · the price · the age of the last bar", 1150)}${panel("w3-strip-tv-2560x1440.png", 700, 48, "<b>chart 2's strip (tv-v1)</b> · 1m 5m 15m 30m 1h 1D · LIVE · TV (green) · TradingView · VWAP · D delayed bars, Cboe One volume", 1150)}</div>
<div class="row">${panel("w3-back-2560x1440.png", 2560, 1440, `<b>?chart1=live&chart2=tv on the URL</b>, with tv / live stored from the switch · for this load chart 1 is ${slot(s25.url.c1)} and chart 2 ${slot(s25.url.c2)}; the stored choice stays src.1 = ${s25.url.stored.s1}, src.2 = ${s25.url.stored.s2}`)}
<div class="facts">
<div class="k">the defaults</div><div>nothing stored: chart 1 LIVE, chart 2 TV, so he sees both side by side and flips either. The choice is this machine's (localStorage station.widgets.src.1 / .2); ?chart1= and ?chart2= win for one load and are not remembered.</div>
<div class="k">a switch</div><div>the strip asks the deck (SCINTILLA_CHART_SRC with the slot, the shell wanted, the symbol and the interval); the deck remembers the source and the interval and re-points the slot to the other shell on the same address (?t= &tf= &n= &bare=1). Measured both ways at both screens: the symbol and the interval carried, 0 page errors.</div>
<div class="k">the door</div><div>the badge → the box → Enter sets whichever shell the slot carries (NVDA into chart 1 while TV: TradingView shows NVDA, station.widgets.chart.1 = NVDA); the widget's own search is heard on TV as before; the interval chosen on either strip is one memory (tv-v1's codes).</div>
</div></div>
</body>`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 2440, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html); await page.waitForTimeout(600);
await page.screenshot({ path: path.join(W3, "W3-SWITCH.png"), fullPage: true });
await browser.close(); console.log("wrote", path.join(W3, "W3-SWITCH.png"));
