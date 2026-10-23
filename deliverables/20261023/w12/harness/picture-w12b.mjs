// W12B: the phone's first screen (the lenses as two running rows + the volume graph), scrolled to YouTube, playing; the volume panel at the five
// sizes with the graph's share measured. Real pixels from ../shots.   node picture-w12b.mjs -> ../W12B-PHONE.png
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), W12 = path.resolve(HERE, "..");
const J = (n) => JSON.parse(fs.readFileSync(path.join(W12, "measure", `w12-${n}.json`), "utf8"));
const phone = J("phone").phone, vs = J("volshare").volshare;
const img = (f) => fs.existsSync(path.join(W12, "shots", f)) ? "data:image/png;base64," + fs.readFileSync(path.join(W12, "shots", f)).toString("base64") : "";
const panel = (file, W, H, cap, pw) => { if (!img(file)) return ""; const k = pw / W; return `<div class="p" style="max-width:${pw}px"><div class="cap">${cap}</div><div class="frame" style="width:${pw}px;height:${Math.round(H * k)}px;background:url(${img(file)}) no-repeat;background-size:${pw}px ${Math.round(H * k)}px"></div></div>`; };
const px = (b) => b ? b.w + " × " + b.h : "—";
const phoneRow = (p) => { const [W, H] = p.screen.split("x").map(Number); return `<div class="row">${panel(`w12-phone-${p.screen}.png`, W, H, `<b>the phone ${p.screen}, the first screen</b> · head ${p.firstScreen.shares.head} % · lenses ${p.firstScreen.shares.lenses} % (${px(p.idle.lenses)}: RADAR a row, MACRO a row - ${p.lensShell.rows.join(", ")}, cells ${p.lensShell.cellW} × ${p.lensShell.cellH}, ticker ${p.lensShell.tk}) · volume ${p.firstScreen.shares.volume} % (${px(p.idle.volume)}, the graph ${Math.round(p.vol.graphShare * 100)} % of it) · YouTube below the fold: ${p.firstScreen.videoBelow} · flashing now: ${Object.entries(p.lens.unusual).map(([k, v]) => k + " " + v).join(" · ")}`, 420)}${panel(`w12-phone-youtube-${p.screen}.png`, W, H, `<b>scrolled down to YouTube</b> · the player ${px(p.shell0.stage)} at 16:9, the feed under it · the empty line: "${p.idleNote}"`, 420)}${panel(`w12-phone-playing-${p.screen}.png`, W, H, `<b>playing, the feed reloaded twice</b> · the first screen and every block in place: <b>${p.sameBoxesPlaying}</b> · the player's box the same through play and both reloads: <b>${p.stageSame}</b> · same iframe ${p.reloads.map((r) => r.sameIframe).join("/")} · same video ${p.reloads.map((r) => r.cur === p.play.cur).join("/")}`, 420)}</div>`; };
const volRow = `<div class="row">${vs.map((v) => v.box ? panel(`w12b-volume-${v.screen.replace(" ", "-")}.png`, v.box.width, v.box.height, `<b>${v.screen}</b> · the panel ${Math.round(v.box.width)} × ${Math.round(v.box.height)} · the graph <b>${Math.round(v.vol.graphShare * 100)} %</b> of it · badges in ${v.more.iconRows} row, ${v.more.iconsShown} shown${v.more.narrow ? " (the day and last-hour chips dropped on this narrow panel)" : ""}${v.more.short ? " · short panel: the top line compact" : ""} · the multiple ${v.more.numPx}, the countdown ${v.more.mmssPx} · clipped: ${v.more.chartClipped}`, Math.min(435, Math.round(v.box.width))) : "").join("")}</div>`;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0A0A0F;color:#F2F2F8;font:16px "SF Mono",Menlo,monospace;width:2440px;padding:28px 34px;box-sizing:border-box}
h1{font-size:30px;margin:0 0 4px;letter-spacing:.02em} .sub{color:#9A9AB6;font-size:16px;margin-bottom:22px;line-height:1.4}
.row{display:flex;gap:30px;align-items:flex-start;margin-bottom:26px;flex-wrap:wrap} .cap{color:#00D4FF;font-size:14.5px;margin:0 0 8px;letter-spacing:.03em;line-height:1.4}
.cap b{color:#F2F2F8;font-weight:600} .frame{position:relative;border:1px solid #1A1A2A}
</style><body>
<h1>W12B · the phone's first screen is the lenses (RADAR + MACRO together) and the volume graph · YouTube under them · the volume graph ≥ 70 % of its panel on every screen</h1>
<div class="sub">measured headless on the real pages, ${J("phone").at.slice(0, 16).replace("T", " ")} UTC · branch station/w12-phone-lenses-volume-20261023 on 81ec44b</div>
${phone.map(phoneRow).join("")}${volRow}
</body>`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 2440, height: 1200 }, deviceScaleFactor: 1 });
await page.setContent(html); await page.waitForTimeout(800);
await page.screenshot({ path: path.join(W12, "W12B-PHONE.png"), fullPage: true });
await browser.close(); console.log("wrote W12B-PHONE.png"); process.exit(0);
