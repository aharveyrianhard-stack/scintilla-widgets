// W12 (23 Oct 2026): the phone Station, the lenses with a timeframe switch and RADAR + MACRO together, the volume panel as a graph with icon
// badges, the unusual flashes, the dock cleaned up - measured headless on the real pages (the chart API fetched by node with the Station's
// origin, every non-GET aborted, YouTube aborted where it is not the subject).
//   node w12.mjs <repo root> <mode>   modes: smoke | wall | ipad | phone | flash | tapes | sweep | all
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, EXE, serve } from "../../../20261001/station-layout-workshop/harness/rig.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] || path.resolve(HERE, "../../../.."), ONLY = process.argv[3] || "all";
const SHOTS = path.resolve(HERE, "../shots"), MEASURE = path.resolve(HERE, "../measure");
const RECORDED = JSON.parse(fs.readFileSync(path.join(MEASURE, "heartbeat-20261022-1801ET.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + "s", ...a);
const T0 = Date.now();
/* a context: the Station's own localStorage defaults, the chart API through node, the recorded heartbeat when asked, a quote edited to an
   unusual day when asked ({ flashName, flashPct }) */
async function open(browser, w, h, dpr, { youtube = true, recorded = false, flashName = "", flashPct = 0, hotHeartbeat = false, init = null, mobile = false, clock = null } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, screen: { width: w, height: h }, timezoneId: "America/New_York", isMobile: mobile, hasTouch: mobile, userAgent: mobile ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" : undefined });
  const net = { refused: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), host = new URL(url).host;
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { net.refused.push(req.method() + " " + host); return route.abort(); }
    if ((recorded || hotHeartbeat) && /volume-pulse-pied\.vercel\.app\/api\/heartbeat/.test(url)) { const j = JSON.parse(JSON.stringify(RECORDED)); if (hotHeartbeat) { /* the recorded heartbeat with its last bar at 2.4x and a block two minutes ago - the panel's own rules then flash */ const done = j.slots.filter((s) => s.ratio != null); done[done.length - 1].ratio = 2.4; j.latest = { ...j.latest, ratio: 2.4 }; j.size = { now: { x: 2.3, dir: "up", t: "18:00" }, last: { x: 2.3, dir: "up", t: "18:00", block: { sym: "IWM", x: 3.91, dir: "up", t: "17:59" } } }; j.nyClock = "18:01:30"; } return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(j), headers: { "access-control-allow-origin": "*" } }); }
    if (host === "scintilla-massive-chart-api.fly.dev") {
      try { const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } }); let body = await r.text();
        if (flashName && /\/quotes\?/.test(url)) { try { const j = JSON.parse(body); for (const q of j.quotes || []) if (String(q.ticker || q.symbol).toUpperCase() === flashName && q.price != null) { q.prev_close = +(q.price / (1 + flashPct / 100)).toFixed(4); q.chg_pct = flashPct; } body = JSON.stringify(j); } catch (_) {} }
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } }); } catch (e) { return route.abort(); } }
    if (!youtube && /youtube\.com|googlevideo\.com|google\.com/.test(host)) return route.abort();
    return route.fallback();
  });
  await context.addInitScript(() => { if (window.top !== window) return; try { localStorage.setItem("station.rotate.paused", "1"); localStorage.setItem("station.videoFeed", "fa"); localStorage.removeItem("station.chartsOnly");
    for (const k of ["station.widgets", "station.widgets.src.1", "station.widgets.src.2", "station.widgets.chart.1", "station.widgets.chart.2", "station.widgets.tf", "station.widgets.tf.1", "station.widgets.tf.2", "station.simple", "station.lenses.list", "station.lenses.style", "station.lenses.tf", "station.lenses.mineOn", "station.nox"]) localStorage.removeItem(k);
    localStorage.setItem("station.simple.chart.1", "SPY"); localStorage.setItem("station.simple.chart.2", "QQQ"); } catch (_) {} });
  if (init) await context.addInitScript(init);
  const page = await context.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 200))); page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  if (clock) { await page.clock.install({ time: clock }); }
  return { context, page, errs, net };
}
const readBoxes = () => { const r = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  return { win: { w: innerWidth, h: innerHeight }, x: r('.pane[data-key="x"]'), c1: r('.pane[data-key="c1"]'), c2: r('.pane[data-key="c2"]'), video: r('.pane[data-key="video"], #videoPane, .pane[data-key="v"]'), lens: r("#wgLensTape"), volume: r("#wgVolume"), tapes: r("#tapes"), ctl: r("#wgCtl"), dock: r("#dock") }; };
const shares = (b) => { const A = b.win.w * b.win.h, s = {}; for (const k of ["x", "c1", "c2", "video", "lens", "volume", "tapes"]) if (b[k]) s[k] = +(100 * b[k].w * b[k].h / A).toFixed(1); return s; };
const dockList = () => [...document.querySelectorAll("#dock button, #dock select, #dock a")].map((e) => { const cs = getComputedStyle(e); let p = e, shown = cs.display !== "none" && cs.visibility !== "hidden"; while (shown && p && p !== document.body) { const c = getComputedStyle(p); if (c.display === "none" || p.hidden) shown = false; p = p.parentElement; } return { id: e.id || e.className, text: (e.textContent || "").trim().slice(0, 24), shown }; });
const out = { at: new Date().toISOString(), root: ROOT };
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const srv = await serve(ROOT); const origin = srv.origin || ("http://127.0.0.1:" + srv.port);
try {
  if (ONLY === "all" || ONLY === "smoke") {
    /* the shells alone: the lens tape (3 rows), the lens grid for a phone, the volume panel in session and closed, the countdown's last minute */
    const S = [];
    for (const [name, url, w, h, opts] of [
      ["lens-tape", "/station-shells/lens-v1/?shell=v1&mode=tape&rows=3", 1402, 465, {}],
      ["lens-tape-15m", "/station-shells/lens-v1/?shell=v1&mode=tape&rows=3&tf=15m", 1402, 465, {}],
      ["lens-grid-phone", "/station-shells/lens-v1/?shell=v1&touch=1", 390, 380, { mobile: true }],
      ["volume-recorded", "/station-shells/volume-v1/?shell=v1", 435, 460, { recorded: true }],
      ["volume-hot", "/station-shells/volume-v1/?shell=v1", 435, 460, { hotHeartbeat: true }],
      ["volume-live", "/station-shells/volume-v1/?shell=v1", 435, 460, {}],
      ["volume-phone", "/station-shells/volume-v1/?shell=v1&touch=1", 390, 200, { recorded: true, mobile: true }],
      ["volume-lastminute", "/station-shells/volume-v1/?shell=v1", 435, 460, { recorded: true, clock: new Date("2026-10-23T14:04:20-04:00") }],
    ].filter(([name]) => !process.argv[4] || name.includes(process.argv[4]))) {
      const { context, page, errs } = await open(browser, w, h, 1, opts);
      log("open", name); await page.goto(origin + url, { waitUntil: "domcontentloaded" }); await sleep(opts.clock ? 2500 : 12000);
      if (opts.clock) { await page.clock.runFor(1500); }
      const st = await page.evaluate(() => ({ lens: window.__lens12 ? { tf: window.__lens12.tf(), sets: window.__lens12.sets(), mineOn: window.__lens12.mineOn(), unusual: window.__lens12.unusual(), usualN: Object.keys(window.__lens12.usual()).length, cells: document.querySelectorAll(".lens").length, rows: [...document.querySelectorAll(".trackwin")].map((t) => t.dataset.set), heads: [...document.querySelectorAll(".sethead")].map((h) => h.textContent), tfChips: [...document.querySelectorAll("#tf .chip")].map((b) => b.textContent + (b.classList.contains("on") ? "*" : "")), chips: [...document.querySelectorAll("#chips .chip")].map((b) => b.textContent + (b.classList.contains("on") ? "*" : "")), rm: document.querySelectorAll(".rm:not([hidden])").length } : null,
        vol: window.__vol ? { unusual: window.__vol.unusual(), last: window.__vol.last(), mmss: window.__vol.mmss(), chartH: window.__vol.chartH(), bodyH: window.__vol.bodyH(), num: document.getElementById("num").textContent, icons: [...document.querySelectorAll(".ib")].map((e) => e.id + ":" + e.className.replace("ib", "").trim() + ":" + e.textContent.trim().replace(/\s+/g, " ")), descriptions: /who is in control|does it sustain|of a usual/.test(document.body.innerText) } : null })).catch((e) => ({ err: String(e) }));
      await page.screenshot({ path: path.join(SHOTS, `w12-${name}.png`) });
      S.push({ name, w, h, state: st, errors: errs }); log(name, JSON.stringify(st).slice(0, 700), "errs", errs.length ? errs.slice(0, 3) : 0);
      await context.close();
    }
    out.smoke = S;
  }

  /* the shared readers */
  const lensState = (page) => { const lf = page.frames().find((f) => /lens-v1\//.test(f.url())); return lf ? lf.evaluate(() => ({ tf: window.__lens12.tf(), sets: window.__lens12.sets(), mineOn: window.__lens12.mineOn(), unusual: window.__lens12.unusual(), cells: document.querySelectorAll(".lens").length, rows: [...document.querySelectorAll(".trackwin")].map((t) => t.dataset.set), heads: [...document.querySelectorAll(".sethead")].map((h) => h.textContent), tfChips: [...document.querySelectorAll("#tf .chip.on")].map((b) => b.textContent), chips: [...document.querySelectorAll("#chips .chip")].map((b) => b.textContent + (b.classList.contains("on") ? "*" : "")) })).catch((e) => ({ err: String(e).slice(0, 80) })) : null; };
  const volState = (page) => { const vf = page.frames().find((f) => /volume-v1\//.test(f.url())); return vf ? vf.evaluate(() => ({ unusual: window.__vol.unusual(), last: window.__vol.last(), mmss: window.__vol.mmss(), chartH: window.__vol.chartH(), bodyH: window.__vol.bodyH(), graphShare: +(window.__vol.chartH() / window.__vol.bodyH()).toFixed(2), num: document.getElementById("num").textContent, icons: document.querySelectorAll(".ib").length, descriptions: /who is in control|does it sustain|of a usual/.test(document.body.innerText) })).catch((e) => ({ err: String(e).slice(0, 80) })) : null; };
  const tapeFlash = (page) => page.evaluate(() => ({ cells: document.querySelectorAll("#tapes .cell").length, glow: [...document.querySelectorAll("#tapes .cell.glow")].map((c) => c.dataset.t + ": " + c.title), usualN: typeof TAPES !== "undefined" ? TAPES.usual.size : null })).catch(() => null);
  const videoFrame = (page) => page.frames().find((f) => /station-shells\/(scintilla|personal)-video-v1/.test(f.url()));
  const snapShell = (vf) => vf.evaluate(() => { const f = document.querySelector("#video iframe"); const R = (n) => { const b = n.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
    window.__pf = window.__pf || f; return { mode: ["fixed", "stack", "beside"].filter((c) => document.body.classList.contains(c)).join(","), playing: document.body.classList.contains("playing"), sameIframe: window.__pf === f, player: typeof YT_PLAYER !== "undefined" && YT_PLAYER ? { state: YT_PLAYER.getPlayerState ? YT_PLAYER.getPlayerState() : null } : null, stage: R(document.getElementById("stage")), grid: R(document.getElementById("grid")), cards: document.querySelectorAll("#grid .card").length, cur: typeof CUR !== "undefined" && CUR ? CUR.video_id : null }; }).catch((e) => ({ err: String(e).slice(0, 80) }));
  const playAndReload = async (vf) => { let play = null; const reloads = [];
    const picked = await vf.evaluate(() => { const c = [...document.querySelectorAll("#grid .card")].find((k) => !/LIVE|live in|premier/i.test(k.innerText)); if (!c) return null; c.scrollIntoView(); return c.dataset.v; }).catch(() => null);
    if (picked) { await vf.click('#grid .card[data-v="' + picked + '"]').catch(() => {}); await sleep(8000); }
    play = await snapShell(vf);
    for (let i = 0; i < 2; i++) { await vf.evaluate(() => document.getElementById("bRefresh").click()).catch(() => {}); await sleep(6000); reloads.push(await snapShell(vf)); }
    return { play, reloads }; };
  const sameBoxes = (a, b) => JSON.stringify([a.x, a.c1, a.c2, a.video, a.lens, a.volume, a.tapes]) === JSON.stringify([b.x, b.c1, b.c2, b.video, b.lens, b.volume, b.tapes]);
  /* a flash caught mid-pulse: the real pulse re-run on a lens that IS unusual right now (its class removed and put back), the shot 200 ms in */
  const midPulse = async (page, file) => { const lf = page.frames().find((f) => /lens-v1\//.test(f.url())); if (!lf) return null;
    const box = await lf.evaluate(() => { const d = [...document.querySelectorAll(".lens.glow")].find((e) => { const b = e.getBoundingClientRect(); return b.x >= 0 && b.right <= innerWidth && b.y >= 0 && b.bottom <= innerHeight; }); if (!d) return null; d.classList.remove("pulse"); void d.offsetWidth; d.classList.add("pulse"); const b = d.getBoundingClientRect(); return { t: d.dataset.t, words: d.querySelector(".un").textContent, x: b.x, y: b.y, w: b.width, h: b.height }; });
    if (!box) return null; await sleep(200);
    const fb = await page.evaluate(() => { const f = document.querySelector('iframe[src*="lens-v1"]'); const b = f.getBoundingClientRect(); return { x: b.x, y: b.y }; });
    await page.screenshot({ path: path.join(SHOTS, file), clip: { x: fb.x + box.x - 6, y: fb.y + box.y - 6, width: box.w + 12, height: box.h + 12 } }).catch(() => {}); return box; };
  if (ONLY === "all" || ONLY === "wall") {
    out.wall = [];
    for (const [key, W, H, tf] of [["2560x1440", 2560, 1440, ""], ["1920x1080", 1920, 1080, "15m"]]) {
      const { context, page, errs } = await open(browser, W, H, 1, { init: tf ? () => { try { localStorage.setItem("station.lenses.tf", "15m"); } catch (_) {} } : null });
      await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(16000);
      const idle = await page.evaluate(readBoxes); await page.screenshot({ path: path.join(SHOTS, `w12-wall-${key}.png`) });
      if (idle.tapes) await page.screenshot({ path: path.join(SHOTS, `w12-wall-tape-${key}.png`), clip: { x: idle.tapes.x, y: idle.tapes.y, width: Math.min(idle.tapes.w, 1400), height: idle.tapes.h } });
      if (idle.lens) await page.screenshot({ path: path.join(SHOTS, `w12-wall-lens-${key}.png`), clip: { x: idle.lens.x, y: idle.lens.y, width: idle.lens.w, height: idle.lens.h } });
      if (idle.volume) await page.screenshot({ path: path.join(SHOTS, `w12-wall-volume-${key}.png`), clip: { x: idle.volume.x, y: idle.volume.y, width: idle.volume.w, height: idle.volume.h } });
      await page.evaluate(() => { document.getElementById("dock").classList.remove("hidden", "tucked"); document.body.classList.add("dock-show"); }).catch(() => {});
      const dock = await page.evaluate(dockList); if (idle.dock) await page.screenshot({ path: path.join(SHOTS, `w12-wall-dock-${key}.png`), clip: { x: 0, y: 0, width: Math.min(W, 1800), height: Math.max(40, idle.dock.h + 4) } });
      const lens = await lensState(page), vol = await volState(page), flash = await tapeFlash(page), pulse = await midPulse(page, `w12-wall-pulse-${key}.png`);
      const vf = videoFrame(page); const shell0 = vf ? await snapShell(vf) : null; const pr = vf ? await playAndReload(vf) : null;
      const playing = await page.evaluate(readBoxes); await page.screenshot({ path: path.join(SHOTS, `w12-wall-playing-${key}.png`) });
      out.wall.push({ screen: key, idle, shares: shares(idle), lens, vol, flash, pulse, dock, shell0, ...pr, playing, sameBoxesPlaying: sameBoxes(idle, playing), errors: errs });
      log("wall", key, "shares", JSON.stringify(shares(idle)), "lens", JSON.stringify(lens).slice(0, 260), "| vol", JSON.stringify(vol).slice(0, 200), "| tape flash", JSON.stringify(flash).slice(0, 200), "| pulse", JSON.stringify(pulse), "| dock shown", dock.filter((d) => d.shown).map((d) => d.id).join(","), "| hidden", dock.filter((d) => !d.shown).map((d) => d.id).join(","), "| reloads", JSON.stringify((pr && pr.reloads || []).map((r) => [r.sameIframe, r.cur, r.cards])), "| same boxes", sameBoxes(idle, playing), "errs", errs.length ? errs.slice(0, 2) : 0);
      await context.close();
    }
  }
  if (ONLY === "all" || ONLY === "ipad") {
    out.ipad = [];
    for (const [key, W, H] of [["1180x820", 1180, 820], ["1366x1024", 1366, 1024]]) {
      const { context, page, errs } = await open(browser, W, H, 2, { mobile: false });
      await page.goto(origin + "/deck/?nox=1&widgets=1&scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(16000);
      const idle = await page.evaluate(readBoxes); await page.screenshot({ path: path.join(SHOTS, `w12-ipad-${key}.png`) });
      const lens = await lensState(page), vol = await volState(page), flash = await tapeFlash(page), nox = await page.evaluate(() => ({ nox: document.documentElement.classList.contains("nox"), remembered: localStorage.getItem("station.nox"), xShown: !!document.querySelector('.pane[data-key="x"]') && getComputedStyle(document.querySelector('.pane[data-key="x"]')).display !== "none" }));
      const vf = videoFrame(page); const pr = vf ? await playAndReload(vf) : null; const playing = await page.evaluate(readBoxes); await page.screenshot({ path: path.join(SHOTS, `w12-ipad-playing-${key}.png`) });
      out.ipad.push({ screen: key, idle, shares: shares(idle), lens, vol, flash, nox, ...pr, playing, sameBoxesPlaying: sameBoxes(idle, playing), errors: errs });
      log("ipad", key, JSON.stringify(nox), "shares", JSON.stringify(shares(idle)), "lens", JSON.stringify(lens).slice(0, 200), "| vol", JSON.stringify(vol).slice(0, 160), "| reloads", JSON.stringify((pr && pr.reloads || []).map((r) => [r.sameIframe, r.cur])), "| same boxes", sameBoxes(idle, playing), "errs", errs.length ? errs.slice(0, 2) : 0);
      await context.close();
    }
  }
  if (ONLY === "all" || ONLY === "phone") {
    out.phone = [];
    const phoneBoxes = () => { const R = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; }; return { win: { w: innerWidth, h: innerHeight }, head: R("#head"), first: R("#first"), lenses: R("#lenses"), volume: R("#volume"), video: R("#video"), scrollH: document.documentElement.scrollHeight, scrollY: Math.round(scrollY) }; };
    for (const [key, W, H] of [["390x844", 390, 844], ["430x932", 430, 932]]) {
      const { context, page, errs } = await open(browser, W, H, 3, { mobile: true });
      await page.goto(origin + "/phone/", { waitUntil: "domcontentloaded" }); await sleep(16000);
      const idle = await page.evaluate(phoneBoxes); await page.screenshot({ path: path.join(SHOTS, `w12-phone-${key}.png`) });
      /* W12B: the first screen holds the lenses (two running rows) and the volume panel; YouTube is under it - scrolled to for its picture */
      const firstScreen = { lensesOnFirst: idle.lenses && idle.lenses.y + idle.lenses.h <= H, volumeOnFirst: idle.volume && idle.volume.y + idle.volume.h <= H, videoBelow: idle.video && idle.video.y >= H - 1, shares: { head: +(100 * idle.head.h / H).toFixed(1), lenses: +(100 * idle.lenses.h / H).toFixed(1), volume: +(100 * idle.volume.h / H).toFixed(1) } };
      await page.evaluate(() => document.getElementById("video").scrollIntoView()); await sleep(600); await page.screenshot({ path: path.join(SHOTS, `w12-phone-youtube-${key}.png`) });
      const lensShell = await page.frames().find((f) => /lens-v1\//.test(f.url())).evaluate(() => ({ tape: document.body.classList.contains("tape"), touch: document.body.classList.contains("touch"), rows: [...document.querySelectorAll(".trackwin")].map((t) => t.dataset.set + ":" + (t.querySelector(".track").classList.contains("run") ? "runs" : "still")), cellW: document.querySelector(".lens") && Math.round(document.querySelector(".lens").getBoundingClientRect().width), cellH: document.querySelector(".lens") && Math.round(document.querySelector(".lens").getBoundingClientRect().height), tk: document.querySelector(".lens .tk") && getComputedStyle(document.querySelector(".lens .tk")).fontSize })).catch((e) => ({ err: String(e).slice(0, 80) }));
      const meta = await page.evaluate(() => ({ title: document.title, icon: !!document.querySelector('link[rel="apple-touch-icon"]'), manifest: !!document.querySelector('link[rel="manifest"]'), capable: !!document.querySelector('meta[name="apple-mobile-web-app-capable"][content="yes"]'), viewport: document.querySelector('meta[name="viewport"]').content }));
      const lens = await lensState(page), vol = await volState(page), pulse = await midPulse(page, `w12-phone-pulse-${key}.png`);
      const vf = videoFrame(page); const shell0 = vf ? await snapShell(vf) : null; const pr = vf ? await playAndReload(vf) : null;
      const playing = await page.evaluate(phoneBoxes); await page.screenshot({ path: path.join(SHOTS, `w12-phone-playing-${key}.png`) });
      const same = JSON.stringify([idle.first, idle.lenses, idle.volume, idle.video]) === JSON.stringify([playing.first, playing.lenses, playing.volume, playing.video]);
      const stageSame = pr && pr.play && shell0 && JSON.stringify(pr.play.stage) === JSON.stringify(shell0.stage) && pr.reloads.every((r) => JSON.stringify(r.stage) === JSON.stringify(shell0.stage));
      const idleNote = vf ? await vf.evaluate(() => document.getElementById("idleNote").textContent).catch(() => null) : null;
      out.phone.push({ screen: key, idle, firstScreen, lensShell, idleNote, meta, lens, vol, pulse, shell0, ...pr, playing, sameBoxesPlaying: same, stageSame, errors: errs });
      log("phone", key, JSON.stringify(idle), "first screen", JSON.stringify(firstScreen), "lens shell", JSON.stringify(lensShell), "idle note", idleNote, JSON.stringify(meta), "lens", JSON.stringify(lens).slice(0, 240), "| vol", JSON.stringify(vol).slice(0, 200), "| shell", JSON.stringify(shell0), "| reloads", JSON.stringify((pr && pr.reloads || []).map((r) => [r.sameIframe, r.cur, r.cards, r.stage])), "| same boxes", same, "stage same", stageSame, "errs", errs.length ? errs.slice(0, 2) : 0);
      await context.close();
    }
  }
  if (ONLY === "all" || ONLY === "volshare") {
    /* W12B: the graph's share of the volume panel at every screen */
    out.volshare = [];
    for (const [key, W, H, url, mobile] of [["wall 2560x1440", 2560, 1440, "/deck/?scene=live&charts=9&range=3h", false], ["wall 1920x1080", 1920, 1080, "/deck/?scene=live&charts=9&range=3h", false], ["ipad 1366x1024", 1366, 1024, "/deck/?nox=1&widgets=1&scene=live&charts=9&range=3h", false], ["ipad 1180x820", 1180, 820, "/deck/?nox=1&widgets=1&scene=live&charts=9&range=3h", false], ["phone 430x932", 430, 932, "/phone/", true], ["phone 390x844", 390, 844, "/phone/", true]]) {
      const { context, page, errs } = await open(browser, W, H, mobile ? 3 : 1, { youtube: false, mobile });
      await page.goto(origin + url, { waitUntil: "domcontentloaded" }); await sleep(12000);
      const v = await volState(page); const vf = page.frames().find((f) => /volume-v1\//.test(f.url()));
      const more = vf ? await vf.evaluate(() => ({ iconRows: new Set([...document.querySelectorAll(".ib")].filter((e) => getComputedStyle(e).display !== "none").map((e) => Math.round(e.getBoundingClientRect().top))).size, iconsShown: [...document.querySelectorAll(".ib")].filter((e) => getComputedStyle(e).display !== "none").length, short: document.body.classList.contains("short"), narrow: document.body.classList.contains("narrow"), numPx: getComputedStyle(document.getElementById("num")).fontSize, mmssPx: getComputedStyle(document.getElementById("mmss")).fontSize, chartClipped: document.getElementById("chart").getBoundingClientRect().bottom > innerHeight + 1 })).catch((e) => ({ err: String(e).slice(0, 60) })) : null;
      const fb = await page.evaluate(() => { const f = document.querySelector('iframe[src*="volume-v1"]'); if (!f) return null; const b = f.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
      if (fb) await page.screenshot({ path: path.join(SHOTS, `w12b-volume-${key.replace(" ", "-")}.png`), clip: fb }).catch(() => {});
      out.volshare.push({ screen: key, vol: v, more, box: fb, errors: errs }); log("volshare", key, JSON.stringify(v), JSON.stringify(more), "errs", errs.length);
      await context.close();
    }
  }
  if (ONLY === "pulse") {
    /* the mid-pulse shots alone: a visible unusual lens on the 2560 wall and on the phone */
    const { context, page, errs } = await open(browser, 2560, 1440, 1, { youtube: false });
    await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(16000);
    out.wallPulse = await midPulse(page, "w12-wall-pulse-2560x1440.png"); log("wall pulse", JSON.stringify(out.wallPulse)); await context.close();
    const ph = await open(browser, 390, 844, 3, { mobile: true }); await ph.page.goto(origin + "/phone/", { waitUntil: "domcontentloaded" }); await sleep(16000);
    out.phonePulse = await midPulse(ph.page, "w12-phone-pulse-390x844.png"); log("phone pulse", JSON.stringify(out.phonePulse)); await ph.context.close();
  }
  if (ONLY === "all" || ONLY === "sweep") {
    const { context, page, errs } = await open(browser, 1280, 720, 1, { youtube: false });
    await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(14000);
    const samples = [];
    for (let i = 0; i <= 12; i++) { const w = 1280 + Math.round((2560 - 1280) * i / 12), h = Math.round(w * 9 / 16); await page.setViewportSize({ width: w, height: h }); await sleep(900); samples.push({ w, h, boxes: await page.evaluate(readBoxes) }); }
    await page.setViewportSize({ width: 1920, height: 1080 }); await sleep(900); const tv = await page.evaluate(readBoxes);
    const order = samples.map((s) => Object.entries(s.boxes).filter(([k, v]) => v && typeof v === "object" && "x" in v && k !== "win" && k !== "dock" && k !== "ctl").sort((a, b) => a[1].x - b[1].x || a[1].y - b[1].y).map(([k]) => k).join(">"));
    const lin = {}; for (const k of ["x", "c1", "c2", "video", "lens", "volume", "tapes"]) for (const e of ["x", "y", "w", "h"]) { const pts = samples.filter((s) => s.boxes[k]).map((s) => [s.w, s.boxes[k][e]]); if (pts.length < 3) continue; const n = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0), sxx = pts.reduce((a, p) => a + p[0] * p[0], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0); const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), b = (sy - slope * sx) / n; lin[k + "." + e] = { slope: +slope.toFixed(4), maxResidualPx: Math.max(...pts.map((p) => Math.abs(p[1] - (slope * p[0] + b)))).toFixed(1) * 1 }; }
    out.sweep = { samples, linearity: lin, sameOrder: order.every((o) => o === order[0]), appleTv: tv, errors: errs };
    log("sweep", "sameOrder", out.sweep.sameOrder, "worst", JSON.stringify(Object.entries(lin).sort((a, b) => b[1].maxResidualPx - a[1].maxResidualPx).slice(0, 3)), "errs", errs.length);
    await context.close();
  }
  if (ONLY === "all" || ONLY === "tapes") {
    const { context, page, errs } = await open(browser, 2560, 1440, 1, { youtube: false });
    await page.goto(origin + "/deck/?scene=live&charts=9&range=3h", { waitUntil: "domcontentloaded" }); await sleep(14000);
    const sample2 = (frame, sel) => frame.evaluate((sel) => new Promise((resolve) => { const t = document.querySelector(sel); if (!t) return resolve(null); const xs = []; const start = performance.now();
      const step = () => { const m = new DOMMatrixReadOnly(getComputedStyle(t).transform); xs.push([performance.now() - start, -m.m41, t.getBoundingClientRect().width]); if (performance.now() - start < 20000) requestAnimationFrame(step); else {
        const steps = [], dts = []; for (let i = 1; i < xs.length; i++) { let d = xs[i][1] - xs[i - 1][1]; if (d < -xs[i][2] / 4) d += xs[i][2] / 2; steps.push(+d.toFixed(2)); dts.push(+(xs[i][0] - xs[i - 1][0]).toFixed(1)); }
        const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }; const mS = med(steps), mT = med(dts);
        const merged = []; for (let i = 0; i < steps.length; i++) { if (dts[i] < 4 && merged.length) { merged[merged.length - 1][0] += steps[i]; merged[merged.length - 1][1] += dts[i]; } else merged.push([steps[i], dts[i]]); }
        const sp = merged.map((x) => x[0] / x[1]), mV = med(sp);
        resolve({ frames: xs.length, stepMedian: mS, stepMax: Math.max(...steps), over2x: steps.filter((s) => s > 2 * mS + 0.05).length, negative: steps.filter((s) => s < -0.05).length, stalls: dts.filter((d) => d > 2 * mT).length, speedMedian: +mV.toFixed(4), speedOver2x: sp.filter((v) => v > 2 * mV).length, speedUnderHalf: sp.filter((v) => v < mV / 2).length, running: getComputedStyle(t).animationName }); } }; requestAnimationFrame(step); }), sel);
    const lf = page.frames().find((f) => /lens-v1\/.*mode=tape/.test(f.url()));
    const [fav, lens] = await Promise.all([sample2(page.mainFrame(), '#tapes .tape[data-tape="FAVORITES"] .track'), lf ? sample2(lf, ".track.run") : Promise.resolve(null)]);
    out.tapes = { favorites: fav, lens, errors: errs }; log("tapes", JSON.stringify(fav), JSON.stringify(lens));
    await context.close();
  }
  fs.writeFileSync(path.join(MEASURE, `w12-${ONLY}${ONLY === "smoke" && process.argv[4] ? "-" + process.argv[4] : ""}.json`), JSON.stringify(out, null, 1));
  log("wrote", ONLY);
} finally { await browser.close(); try { srv.server.close(); } catch (_) {} process.exit(0); }
