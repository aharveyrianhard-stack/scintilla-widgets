// Y8: the picture. Real pixels only, laid out and labelled: the pane cropped at its measured box (playing, then
// floating), and the PiP window's own capture; the "another desktop" behind the window is DRAWN and says so -
// headless has no desktops, and always-on-top is the one thing proven on the iMac.
//   node picture.mjs            (reads ../measure/y8-measure.json and ../shots, writes ../Y8-PIP.png)
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), Y8 = path.resolve(HERE, "..");
const m = JSON.parse(fs.readFileSync(path.join(Y8, "measure/y8-measure.json"), "utf8"));
const s = m.screens.find((x) => x.screen === "2560x1440" && !x.error) || m.screens.find((x) => !x.error);
const KEY = s.screen, [SW, SH] = KEY.split("x").map(Number);
const img = (f) => "data:image/png;base64," + fs.readFileSync(path.join(Y8, "shots", f)).toString("base64");
/* the pane panels from the iMac's Station window (1062 x 685, NR5) where the bar reads at this scale; the desktop panel at the full screen */
const sp = m.screens.find((x) => x.screen === "1062x685" && !x.error) || s, PKEY = sp.screen, [PW, PH] = PKEY.split("x").map(Number);
const playing = img(`y8-playing-${PKEY}.png`), floating = img(`y8-floating-${PKEY}.png`);
/* the "clicked" capture only if the click measurably started it (state 1); otherwise the window as it opened */
const clickedPlayed = s.floatAfterClick?.pane?.float?.page?.state === 1;
const pipFile = clickedPlayed ? `y8-pip-window-clicked-${KEY}.png` : `y8-pip-window-${KEY}.png`;
const pip = img(pipFile);
const box = sp.paneBox, bar = sp.playing.pipBar, full = sp.playing.full;
const PANE_W = 1060, k = PANE_W / box.w, PANE_H = Math.round(box.h * k);
const crop = (src) => `width:${PANE_W}px;height:${PANE_H}px;background:url(${src}) no-repeat;background-size:${Math.round(PW * k)}px ${Math.round(PH * k)}px;background-position:${-Math.round(box.x * k)}px ${-Math.round(box.y * k)}px`;
const ring = (r, label) => `<div class="ring" style="left:${Math.round(r.x * k) - 6}px;top:${Math.round(r.y * k) - 6}px;width:${Math.round(r.w * k) + 12}px;height:${Math.round(r.h * k) + 12}px"></div>`;
const DESK = 0.5, DW = SW * DESK, DH = SH * DESK, FW = 480 * DESK, FH = 270 * DESK;
const fl = s.floatLater?.pane?.float, after = s.floatAfterClick?.pane?.float, back = s.closed?.pane?.player;
const facts = [
  ["the trigger", "the float button on the pane's bar, beside ⛶ · “picture in picture” in the ⋯ · P on the pane, on the deck, or in the window"],
  ["the window", `Document Picture-in-Picture, asked for ${JSON.stringify(s.floatOpen.top.requests[0]).replace(/"/g, "")} (16:9, 480 wide; then the width last given to it, this session)`],
  ["in the pane", `“${s.floatOpen.pane.noteText.slice(0, 60)}…” · the pane's player paused (state ${s.floatOpen.pane.player.state})`],
  ["the way back", `the window's ✕ → the pane's own player playing again ${(s.closed.timing?.playingAfterMs / 1000).toFixed(1)} s later at ${back?.at}s (window handed back ${s.closed.floatSecondAtClose}s) · same element, ${back?.frameLoads} reloads · BRING IT BACK and P: ${(s.bringBack.timing?.playingAfterMs / 1000).toFixed(1)} s · YouTube starts on the keyframe at or before the second (a few seconds' replay at most)`],
  ["moving the player", "not possible without a reload: moved into the window (appended or adoptNode) it loads again - Chrome 155 and Brave 154 measured; moveBefore refuses to cross documents. So the float plays from the second, and the way back asks the pane's own player (never reloaded) for the video from the window's second"],
  ["autoplay in the window", `headless, fresh profile: the window waited on ▶ (YouTube's “autoplay blocked”, state ${fl?.page?.state}) and the pane said so; a video chosen WHILE it floated played by itself (state ${s.nextWhileFloating?.pane?.float?.page?.state}). A synthetic click sent into the headless window did not start it (state ${after?.page?.state ?? "n/a"}) - not a faithful test of a real click. Whether it starts by itself on the iMac is part of the iMac proof`],
  ["no API", "Chrome 155 with Document PiP removed: no button, no menu item, P does nothing (measured)"],
];
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0A0A0F;color:#F2F2F8;font:16px "SF Mono",Menlo,monospace;width:2260px;padding:28px 34px;box-sizing:border-box}
h1{font-size:30px;margin:0 0 4px;color:#F2F2F8;letter-spacing:.02em} .sub{color:#9A9AB6;font-size:16px;margin-bottom:22px}
.row{display:flex;gap:34px;align-items:flex-start;margin-bottom:26px} .cap{color:#00D4FF;font-size:17px;margin:0 0 8px;letter-spacing:.04em}
.cap b{color:#F2F2F8;font-weight:600} .frame{position:relative;border:1px solid #1A1A2A}
.ring{position:absolute;border:3px solid #FF8A00;border-radius:3px;box-shadow:0 0 0 2px rgba(0,0,0,.6)}
.desk{position:relative;width:${DW}px;height:${DH}px;background:linear-gradient(135deg,#1b2433,#2b2140 55%,#14141f);border:1px solid #1A1A2A;overflow:hidden}
.desk .app{position:absolute;left:60px;top:70px;width:${DW - 200}px;height:${DH - 160}px;background:#ECEDEF;border-radius:10px;color:#3a3a46;font:600 18px -apple-system,Helvetica;padding:18px;box-sizing:border-box}
.desk .app i{display:block;height:12px;background:#cfd2d8;border-radius:6px;margin:14px 0;width:70%} .desk .app i:nth-child(3){width:52%} .desk .app i:nth-child(4){width:64%}
.desk .tag{position:absolute;left:14px;top:12px;color:#c9cbe0;font-size:14px;background:rgba(0,0,0,.45);padding:4px 8px}
.float{position:absolute;right:${Math.round(16 * DESK * 2)}px;bottom:${Math.round(16 * DESK * 2)}px;width:${FW}px;height:${FH}px;background:url(${pip}) center/cover;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.6);outline:2px solid #00D4FF}
.big{width:480px;height:270px;background:url(${pip}) center/cover;border:1px solid #1A1A2A}
table{border-collapse:collapse;width:100%;font-size:15px} td{border-top:1px solid #1A1A2A;padding:7px 10px;vertical-align:top} td:first-child{color:#868AAA;width:230px;white-space:nowrap}
.warn{color:#FF8A00} .note{color:#868AAA;font-size:13px;margin-top:6px;max-width:${DW}px}
</style>
<h1>Y8 · the Station's YouTube floats on top of everything — and comes back</h1>
<div class="sub">measured headless ${m.at.slice(0, 16).replace("T", " ")} UTC · Chrome ${m.browser} · the real deck at ${PKEY} (${sp.note}) and ${KEY} (${s.note}) · branch station/y8-youtube-pip-20261020</div>
<div class="row">
 <div><div class="cap">1 · <b>playing</b> — the float button, beside ⛶ (orange ring) · or press <b>P</b> · the pane in the iMac's Station window (${PKEY})</div>
  <div class="frame" style="${crop(playing)}">${ring(bar)}</div></div>
 <div><div class="cap">2 · <b>floating</b> — the pane says where the video is; BRING IT BACK · P · the window's ✕</div>
  <div class="frame" style="${crop(floating)}"></div></div>
</div>
<div class="row">
 <div><div class="cap">3 · <b>the window over another desktop / app</b> — the iMac's screen, ${SW} × ${SH} at ½ scale</div>
  <div class="desk"><div class="tag">DRAWN: another desktop and another app — a headless browser has no desktops</div>
   <div class="app">another app<i></i><i></i><i></i><i></i></div><div class="float"></div></div>
  <div class="note">The window (cyan outline) is the PiP window's <b>own capture</b> from the run, placed where macOS puts a new one (bottom-right) at its default 480 × 270. <span class="warn">Always on top, across desktops, is by the browser's design and is NOT provable headless — it is the one thing the coordinator proves on the iMac (see the return).</span></div></div>
 <div><div class="cap">4 · <b>the window itself</b>, 480 × 270 (${clickedPlayed ? "after one click on ▶" : "as it opened: YouTube waits on ▶ — the browser held the autoplay"})</div>
  <div class="big"></div>
  <div class="note" style="max-width:480px">Its own pixels, captured headless (the headless window is ${s.floatOpen.top.size ? s.floatOpen.top.size.w + " × " + s.floatOpen.top.size.h : "?"}: headless ignores the requested size; the request was 480 × 270).</div></div>
</div>
<table>${facts.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>`;
const out = path.join(Y8, "Y8-PIP.png");
fs.writeFileSync(path.join(Y8, "measure/picture.html"), html.replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, "(png)"));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 2260, height: 800 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("wrote", out, "from", KEY, pipFile);
process.exit(0);
