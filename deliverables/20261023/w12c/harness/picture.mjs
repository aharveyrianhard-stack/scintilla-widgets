// W12C: the picture - the iPhone Station on one screen at the four sizes (idle; playing with the feed reloaded twice), the shares, the checks;
// one wall and one iPad picture (unchanged). Real pixels from ../shots.   node picture.mjs -> ../W12C-PHONE.png
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), W = path.resolve(HERE, "..");
const J = (n) => JSON.parse(fs.readFileSync(path.join(W, "measure", `w12c-${n}.json`), "utf8"));
const phone = J("phone").phone, wall = J("wall").wall[0], ipad = J("ipad").ipad[0];
const img = (f) => fs.existsSync(path.join(W, "shots", f)) ? "data:image/png;base64," + fs.readFileSync(path.join(W, "shots", f)).toString("base64") : "";
const panel = (file, Wd, Ht, cap, pw) => { if (!img(file)) return ""; const k = pw / Wd; return `<div class="p" style="max-width:${pw}px"><div class="cap">${cap}</div><div class="frame" style="width:${pw}px;height:${Math.round(Ht * k)}px;background:url(${img(file)}) no-repeat;background-size:${pw}px ${Math.round(Ht * k)}px"></div></div>`; };
const px = (b) => b ? b.w + " × " + b.h : "—";
const row = (p) => { const [Wd, Ht] = p.screen.split("x").map(Number); const s = p.oneScreen.shares; return `<div class="row">${panel(`w12c-phone-${p.screen}.png`, Wd, Ht, `<b>${p.screen}${Ht < 800 ? " (Safari with its bars)" : " (Home Screen)"}, idle</b> · one screen: no page scroll <b>${p.oneScreen.noPageScroll}</b>, every block inside <b>${p.oneScreen.allInside}</b> · head ${s.head} % · lenses ${s.lenses} % (${px(p.idle.lenses)}: one bar of ${p.lensShell.barRows} row, ${p.lensShell.barH} px - ${p.lensShell.chipsShown}; one running row ${p.lensShell.rows.join("")}, cells ${p.lensShell.firsts[0].cellW} × ${p.lensShell.firsts[0].cellH}, ticker ${p.lensShell.tk}, the set marks clear of the ticker: ${p.lensShell.firsts.every((f) => f.tagClearOfTicker)}) · volume ${s.volume} % (${px(p.idle.volume)}, the graph ${Math.round(p.vol.graphShare * 100)} %) · YouTube ${s.video} % (${px(p.idle.video)}: the player ${px(p.shell0.stage)}, the feed strip ${p.feed.gridH} px scrolling inside: ${p.feed.scrollsInside}, titles ${p.feed.titlePx})`, 400)}${panel(`w12c-phone-playing-${p.screen}.png`, Wd, Ht, `<b>playing, the feed reloaded twice</b> · every block in place: <b>${p.sameBoxesPlaying}</b> · the player's box the same through play and both reloads: <b>${p.stageSame}</b> · still no page scroll: ${p.noScrollPlaying} · same iframe ${p.reloads.map((r) => r.sameIframe).join("/")} · same video ${p.reloads.map((r) => r.cur === p.play.cur).join("/")}`, 400)}</div>`; };
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0A0A0F;color:#F2F2F8;font:16px "SF Mono",Menlo,monospace;width:2440px;padding:28px 34px;box-sizing:border-box}
h1{font-size:30px;margin:0 0 4px;letter-spacing:.02em} .sub{color:#9A9AB6;font-size:16px;margin-bottom:22px;line-height:1.4}
.row{display:flex;gap:30px;align-items:flex-start;margin-bottom:26px;flex-wrap:wrap} .cap{color:#00D4FF;font-size:14.5px;margin:0 0 8px;letter-spacing:.03em;line-height:1.4}
.cap b{color:#F2F2F8;font-weight:600} .frame{position:relative;border:1px solid #1A1A2A}
</style><body>
<h1>W12C · the iPhone Station on ONE screen - no scrolling, the lenses one row, the volume graph, YouTube visible</h1>
<div class="sub">measured headless on the real pages, ${J("phone").at.slice(0, 16).replace("T", " ")} UTC · branch station/w12c-phone-one-screen-20261023 on 600091b · the wall and the iPad unchanged (below)</div>
<div class="row">${phone.slice(0, 2).map((p) => row(p).replace(/^<div class="row">|<\/div>$/g, "")).join("")}</div>
<div class="row">${phone.slice(2).map((p) => row(p).replace(/^<div class="row">|<\/div>$/g, "")).join("")}</div>
<div class="row">${panel(`w12c-wall-1920x1080.png`, 1920, 1080, `<b>the wall 1920 × 1080, unchanged</b> · charts ${px(wall.idle.c1)} each · ${Object.entries(wall.shares).map(([k, v]) => k + " " + v + " %").join(" · ")} · the lenses ${wall.lens.sets.join(" + ")} on ${wall.lens.rows.length} rows · a video played and the grid reloaded twice: boxes in place ${wall.sameBoxesPlaying}`, 1150)}${panel(`w12c-ipad-1180x820.png`, 1180, 820, `<b>the iPad 1180 × 820 (no X), unchanged</b> · charts ${px(ipad.idle.c1)} each · ${Object.entries(ipad.shares).map(([k, v]) => k + " " + v + " %").join(" · ")} · boxes in place while playing ${ipad.sameBoxesPlaying}`, 1150)}</div>
</body>`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 2440, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html); await page.waitForTimeout(800);
await page.screenshot({ path: path.join(W, "W12C-PHONE.png"), fullPage: true });
await browser.close(); console.log("wrote W12C-PHONE.png"); process.exit(0);
