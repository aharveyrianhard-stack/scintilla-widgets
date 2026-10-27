/* Y8, 20 Oct: one trigger floats the Station's playing YouTube video in an always-on-top picture-in-picture window,
   and a way back. Alan: "Is there a way that we can have the YouTube that I have playing on the station have a
   trigger to go picture in picture type style? That would be pretty cool."
   1. the move and the return: float at the pane's second; the way back is a seek in the pane's own player
   2. the feature-detect fallback: a browser without Document Picture-in-Picture shows no button
   3. the keys, the session's size, the float page
   4. what was measured headless (deliverables/20261020/y8/measure), pinned */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html");
const pane = read("../station-shells/scintilla-video-v1/index.html");
const twin = read("../station-shells/personal-video-v1/index.html");
const pip2 = read("../station-shells/pip-v2/index.html");
const pip1 = read("../station-shells/pip-v1/index.html");
const measured = (name) => JSON.parse(read("../deliverables/20261020/y8/measure/" + name));
const liftFrom = (src, name) => {
  const start = src.search(new RegExp("(async )?function " + name + "\\("));
  assert.notEqual(start, -1, `declares ${name}`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (depth === 0) break; } }
  return src.slice(start, i + 1);
};
const FLOAT_FNS = ["floatHost", "canFloat", "floatSize", "floatPageUrl", "floatSecond", "notePip", "paintFloat", "loadIntoFloat",
  "floatVideo", "tickFloat", "bringBack", "floatClosed", "floatKey", "toggleFloat", "captureActiveVideoPosition"];

/* The pane's float, lifted out of the pane and run against a fake Station: a top window with (or without) Document
   PiP, a PiP window that fires pagehide when it closes, the float page's SC_FLOAT, and the pane's YouTube player. */
function station({ api = true, crossOrigin = false, stored = null, loadedId = "u1sbtiTQk1s", paneTime = 24.9 } = {}) {
  const calls = [], made = [], listeners = {}, storage = new Map(stored ? [["station.float", stored]] : []);
  const node = (id) => ({ id, hidden: id === "floatNote" || id === "floatHold", textContent: "", title: "", attrs: {},
    classList: { set: new Set(), toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }, contains(c) { return this.set.has(c); } },
    setAttribute(k, v) { this.attrs[k] = v; } });
  const nodes = {}; const el = (id) => (nodes[id] = nodes[id] || node(id));
  const body = { classList: node("body").classList, dataset: {} };
  /* sound: the window plays its own sound (true: a browser that let it start, or a click in it; false: the browser
     held it and the picture plays without it - 27 Oct). follows/aligns: what the pane asked of it */
  const floatPage = { t: 0, ended: false, blocked: false, sound: true, follows: [], aligns: [] };
  let pipWin = null;
  const makeWin = (o) => {
    const winListeners = {};
    const doc = { title: "", documentElement: { style: {} }, body: { style: {}, set textContent(v) { made.length = 0; }, appendChild: (n) => made.push(n) },
      createElement: () => ({ style: {}, src: "", allow: "", contentWindow: { SC_FLOAT: {
        at: () => floatPage.t, ended: () => floatPage.ended, blocked: () => floatPage.blocked,
        sound: () => floatPage.sound, muted: () => !floatPage.sound,
        follow: (t, playing) => { floatPage.follows.push([t, playing]); return true; }, align: (t) => floatPage.aligns.push(t) } } }),
      addEventListener: (t, fn) => { (winListeners["doc:" + t] = winListeners["doc:" + t] || []).push(fn); } };
    pipWin = { size: o, innerWidth: o.width, innerHeight: o.height, document: doc, closed: 0,
      addEventListener: (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); },
      close() { this.closed++; (winListeners.pagehide || []).forEach((fn) => fn()); winListeners.pagehide = []; },
      fire: (t) => (winListeners[t] || []).forEach((fn) => fn()), listeners: winListeners };
    return pipWin;
  };
  const dpip = { window: null, requests: [], requestWindow: async (o) => { dpip.requests.push(o); return makeWin(o); } };
  const top = crossOrigin ? { get location() { throw new Error("SecurityError: cross-origin"); } }
    : { location: { origin: "https://station.scintillahub.ai" }, documentPictureInPicture: api ? dpip : undefined };
  const player = { pauseVideo: () => calls.push("pause"), playVideo: () => calls.push("play"), seekTo: (t, a) => calls.push(["seek", t, a]),
    getVideoData: () => ({ video_id: loadedId }), getCurrentTime: () => paneTime, getDuration: () => 600, getPlayerState: () => 1 };
  const ctx = {
    window: { top }, location: { origin: "https://station.scintillahub.ai" }, document: { body },
    parent: { postMessage: (m) => calls.push(["parent", m.type]) },
    sessionStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    el, setMenuOpen: () => {}, setInterval: () => 7, clearInterval: () => {},
    CUR: { video_id: "u1sbtiTQk1s", title: "t" }, PLAYER_POSITION: { time: 0, duration: 0, savedAt: 0 },
    YT_PLAYER: player, YT_PLAYER_READY: true, PLAYER_TOKEN: 4, DECK_STAGE: 0,
    play: (...a) => calls.push(["play()", a[0].video_id, a[7]]), advanceQueue: () => calls.push("advanceQueue"),
    saveActiveVideoPosition: () => calls.push("save"), startPlayerPositionPoll: (t) => calls.push(["poll", t]),
    JSON, Math, Number, String, Object, Set
  };
  vm.createContext(ctx);
  vm.runInContext('let FLOAT = null; const FLOAT_KEY = "station.float";\n' + FLOAT_FNS.map((n) => liftFrom(pane, n)).join("\n") +
    "\nthis.api = { " + FLOAT_FNS.join(", ") + ", get FLOAT() { return FLOAT; } };", ctx);
  return { api: ctx.api, ctx, calls, made, el, body, dpip, floatPage, storage, win: () => pipWin };
}

test("the two video shells are still byte for byte the same pane; S5's float page is untouched", () => {
  assert.equal(twin, pane);
  assert.match(pip1, /S5 \(1 Oct\) — THE FLOATING PLAYER'S PAGE/);
  assert.match(pip1, /"\?playsinline=1&rel=0&modestbranding=1&autoplay=1&start=" \+ start \+/);
});

/* ---- 1. the move and the return ---- */
test("1: the float opens at the second the pane is at - 16:9, 480 wide - and the pane pauses and says where the video is", async () => {
  const s = station();
  assert.equal(await s.api.floatVideo(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(s.dpip.requests)), [{ width: 480, height: 270 }], "16:9, 480 px wide the first time");
  assert.equal(s.made.length, 1, "one player in the window");
  assert.equal(s.made[0].src, "https://station.scintillahub.ai/station-shells/pip-v2/?v=u1sbtiTQk1s&start=24&title=t", "the same video, the same second");
  assert.match(s.made[0].allow, /autoplay/);
  assert.ok(!s.calls.includes("pause"), "27 Oct: floating does not stop this pane - it keeps the sound until the window plays its own");
  s.api.tickFloat();
  assert.ok(s.calls.includes("pause"), "the window plays its own sound: the pane's player pauses - the two never play their sound over each other");
  assert.deepEqual(s.floatPage.aligns, [24.9], "and the window takes the second the pane had reached");
  assert.equal(s.api.FLOAT.id, "u1sbtiTQk1s");
  assert.equal(s.el("floatNote").hidden, false, "the pane says: playing in the floating window · bring it back");
  assert.ok(s.body.classList.contains("floating"));
  assert.ok(s.el("bPipBar").classList.contains("on"));
  assert.equal(s.el("bPipBar").title, "bring it back into the Station (P)");
  assert.match(pane, /<div id="floatNote" hidden><span class="line">playing in the floating window · <button class="btn" id="bBringBack" type="button"[^>]*>bring it back<\/button>/);
  assert.equal(await s.api.floatVideo(), false, "a second press while it floats does not open another window");
  assert.equal(s.dpip.requests.length, 1);
});

test("1: closing the window (its ✕) brings it back - the pane's own player, from the float's second", async () => {
  const s = station();
  await s.api.floatVideo();
  s.floatPage.t = 61.4; s.api.tickFloat();
  assert.equal(s.ctx.PLAYER_POSITION.time, 61.4, "while it floats, where the video is is the window's second");
  s.calls.length = 0;
  s.win().close();                          /* the browser closes it: pagehide */
  assert.equal(s.api.FLOAT, null);
  assert.deepEqual(s.calls.filter((c) => Array.isArray(c) && c[0] === "play()"), [["play()", "u1sbtiTQk1s", 61]], "the same video, from the float's second");
  assert.equal(s.calls.filter((c) => Array.isArray(c) && c[0] === "seek").length, 0, "no seek control of the Station's own (S-rule)");
  assert.doesNotMatch(pane, /seekTo\(/);
  assert.equal(s.el("floatNote").hidden, true);
  assert.equal(s.el("bPipBar").classList.contains("on"), false);
});

test("1: BRING IT BACK (or P again) closes the window and resumes once, though the window's pagehide also fires", async () => {
  const s = station();
  await s.api.floatVideo();
  s.api.tickFloat();                        /* the window has its own sound */
  s.floatPage.t = 90.2; s.calls.length = 0;
  assert.equal(s.api.toggleFloat(), true);
  assert.equal(s.win().closed, 1);
  assert.deepEqual(s.calls.filter((c) => Array.isArray(c) && c[0] === "play()"), [["play()", "u1sbtiTQk1s", 90]], "one resume");
  assert.equal(s.api.bringBack(), false, "nothing to bring back twice");
});

test("1: a video chosen while it floats goes to the window; closing then loads THAT video here, at the window's second", async () => {
  const s = station();
  await s.api.floatVideo();
  s.api.tickFloat();                        /* the window has its own sound */
  /* what play() does while FLOAT is set (asserted on the source below): the window gets the new choice */
  s.ctx.CUR = { video_id: "raZLuvMSX-c", title: "next" };
  vm.runInContext("loadIntoFloat(CUR, 0)", s.ctx);
  assert.equal(s.made[0].src, "https://station.scintillahub.ai/station-shells/pip-v2/?v=raZLuvMSX-c&start=0&title=next");
  s.floatPage.t = 33.7; s.calls.length = 0;
  s.win().close();
  assert.deepEqual(s.calls.find((c) => Array.isArray(c) && c[0] === "play()"), ["play()", "raZLuvMSX-c", 33], "loaded here at 33 s");
  const play = liftFrom(pane, "play");
  assert.match(play, /if \(FLOAT && FLOAT\.sound !== "station"\) \{ loadIntoFloat\(v, resumeAt\); PLAYER_POSITION\.time = resumeAt; paintFloat\(\); return null; \}/,
    "play() routes a new choice to the window before it touches this pane's player, once the window has the sound");
  assert.match(play, /if \(FLOAT\) \{ loadIntoFloat\(v, resumeAt\); paintFloat\(\); \}\n\s+if \(queued\) armPlayerFallback/,
    "while the sound is still here, this pane plays the new choice and the window shows it");
  assert.match(play, /const resumeAt = startAt != null \? Math\.max\(0, Math\.floor\(Number\(startAt\) \|\| 0\)\)/, "the way back can name the second");
});

test("1: back on the grid while it floats - closing the window resumes nothing; the float's end carries the queue on", async () => {
  const s = station();
  await s.api.floatVideo();
  s.floatPage.ended = true; s.api.tickFloat(); s.api.tickFloat();
  assert.equal(s.calls.filter((c) => c === "advanceQueue").length, 1, "the next video, once");
  s.floatPage.blocked = true; s.api.tickFloat();
  assert.equal(s.el("floatHold").hidden, false, "a held autoplay is said in the pane");
  s.ctx.CUR = null; s.calls.length = 0;
  s.win().close();
  assert.equal(s.calls.length, 0);
  assert.equal(s.el("floatHold").hidden, true);
});

/* ---- 2. the feature-detect fallback ---- */
test("2: a browser without Document Picture-in-Picture shows no button, no menu item, and P does nothing", async () => {
  for (const s of [station({ api: false }), station({ crossOrigin: true })]) {
    assert.equal(s.api.canFloat(), false);
    s.api.paintFloat();
    assert.equal(s.body.classList.contains("can-float"), false);
    assert.equal(await s.api.floatVideo(), false);
    assert.equal(s.dpip.requests.length, 0);
  }
  const yes = station(); yes.api.paintFloat();
  assert.equal(yes.body.classList.contains("can-float"), true);
  assert.match(pane, /#bPipBar\{ display:none; \}\nbody\.playing\.can-float #bPipBar\{ display:inline-flex; \}\nbody:not\(\.can-float\) #bPip\{ display:none !important; \}/);
  assert.doesNotMatch(pane, /id="bPip"[^>]*style="display:none"/, "the menu item's visibility is the rule above, not an inline style");
  assert.doesNotMatch(pane, /window\.open\(/, "no small-window stand-in: without the API there is simply no float");
  assert.match(liftFrom(pane, "start"), /paintFloat\(\);/, "decided when the pane starts");
});

/* ---- 3. keys, size, the page ---- */
test("3: P (either case) toggles it from the pane, the deck or the window; never while typing, never with ⌘/⌃/⌥, never on a held key", () => {
  const { api } = station();
  const k = (key, extra = {}) => api.floatKey(Object.assign({ key, target: { tagName: "BUTTON" } }, extra));
  assert.equal(k("p"), true); assert.equal(k("P"), true); assert.equal(k("w"), false);
  for (const m of ["metaKey", "ctrlKey", "altKey", "repeat", "defaultPrevented"]) assert.equal(k("p", { [m]: true }), false, m);
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) assert.equal(k("p", { target: { tagName } }), false, tagName);
  assert.equal(k("p", { target: { tagName: "DIV", isContentEditable: true } }), false);
  const fwd = liftFrom(deck, "floatVideoPane");
  const sent = [];
  const run = (panes) => vm.runInNewContext("(" + fwd + ")()", { PANES: panes, VIDEO_FEED: "fa", location: { origin: "o" } });
  assert.equal(run([{ def: { kind: "video", key: "fa" }, frame: { contentWindow: { postMessage: (m, o) => sent.push([m.type, o]) } } }]), true);
  assert.deepEqual(sent, [["SCINTILLA_VIDEO_PIP_TOGGLE", "o"]], "the deck hands the key to the video on the wall");
  assert.equal(run([{ def: { kind: "video", key: "fb" }, frame: null }]), false);
  assert.match(deck, /else if \(\(event\.key === "p" \|\| event\.key === "P"\) && !event\.repeat\) \{ if \(floatVideoPane\(\)\) event\.preventDefault\(\); \}/);
  assert.match(pane, /if \(event\.data\?\.type === "SCINTILLA_VIDEO_PIP_TOGGLE"\) \{ if \(FLOAT \|\| \(CUR && canFloat\(\)\)\) toggleFloat\(\); return; \}/);
});

test("3: the window opens at the width last given to it this session, always 16:9; a resize is remembered", async () => {
  assert.deepEqual(JSON.parse(JSON.stringify(station({ stored: '{"width":640}' }).api.floatSize())), { width: 640, height: 360 });
  assert.deepEqual(JSON.parse(JSON.stringify(station({ stored: '{"width":12}' }).api.floatSize())), { width: 480, height: 270 });
  assert.deepEqual(JSON.parse(JSON.stringify(station({ stored: "garbage" }).api.floatSize())), { width: 480, height: 270 });
  const s = station();
  await s.api.floatVideo();
  s.win().innerWidth = 720; s.win().fire("resize");
  assert.equal(s.storage.get("station.float"), '{"width":720}');
  assert.match(pane, /const FLOAT_KEY = "station\.float";\s+\/\* sessionStorage/, "per session: sessionStorage, not localStorage");
});

test("3: the float page (pip-v2) gives YouTube a real address, says its second, its end and a held autoplay, and holds nothing else", () => {
  assert.match(pip2, /<meta name="referrer" content="strict-origin-when-cross-origin">/);
  assert.match(pip2, /if \(!\/\^\[A-Za-z0-9_-\]\{6,20\}\$\/\.test\(id\)\)/);
  assert.match(pip2, /s\.src = "https:\/\/www\.youtube\.com\/iframe_api"/, "YouTube's official player, as the pane uses");
  assert.match(pip2, /playerVars: \{ autoplay: 1, start: start, playsinline: 1, rel: 0, modestbranding: 1, origin: location\.origin \}/);
  assert.match(pip2, /onAutoplayBlocked: function \(\) \{ state\.blocked = true; quiet\(\); \}/, "27 Oct: a held sound starts the picture without it");
  assert.match(pip2, /s\.onerror = plain;/, "if the API script cannot load, the plain embed still plays");
  assert.doesNotMatch(pip2, /fetch\(|localStorage|sessionStorage|supabase/i, "it reads nothing and writes nothing");
  /* run the page's script against a fake document: SC_FLOAT answers before the player exists, then from the player */
  const script = pip2.match(/<script>([\s\S]*?)<\/script>/)[1];
  const win = {}; const appended = [];
  const tapFns = {}, tap = { hidden: true, addEventListener: (t, fn) => { tapFns[t] = fn; } };
  const doc = { title: "", body: { appendChild: (n) => appended.push(n) }, head: { appendChild: (n) => appended.push(n) },
    createElement: (t) => ({ tag: t, style: {} }), querySelector: () => null, getElementById: (i) => (i === "tap" ? tap : null) };
  const ctx = { window: win, document: doc, location: { search: "?v=u1sbtiTQk1s&start=24&title=t", origin: "https://station.scintillahub.ai" },
    URLSearchParams, Number, Math, setTimeout: () => 0 };
  vm.runInNewContext(script, ctx);
  assert.equal(win.SC_FLOAT.at(), 24, "until the player has a second, the second it was asked to start from");
  assert.equal(appended[0].src, "https://www.youtube.com/iframe_api");
  let opts = null;
  ctx.YT = { Player: function (id, o) { opts = o; this.getCurrentTime = () => 31.5; } };
  win.onYouTubeIframeAPIReady();
  assert.equal(opts.videoId, "u1sbtiTQk1s");
  assert.equal(win.SC_FLOAT.at(), 24, "cued but not yet played (a held autoplay): still the asked second, not the keyframe the player reports");
  opts.events.onStateChange({ data: 1 });
  assert.equal(win.SC_FLOAT.at(), 31.5, "once it plays, the player's own second");
  assert.equal(win.SC_FLOAT.ended(), false);
  assert.equal(win.SC_FLOAT.sound(), true, "playing, not muted: the window has its own sound");
  opts.events.onAutoplayBlocked(); assert.equal(win.SC_FLOAT.blocked(), true);
  /* 27 Oct: held - the picture plays at once without its sound, and the first click here brings it */
  assert.equal(win.SC_FLOAT.muted(), true, "the picture plays without its sound - never a wait for ▶");
  assert.equal(win.SC_FLOAT.sound(), false, "so the pane keeps the sound");
  assert.equal(tap.hidden, false, "the layer that takes the first click is over the player");
  tapFns.pointerdown();
  assert.equal(tap.hidden, true); assert.equal(win.SC_FLOAT.muted(), false);
  opts.events.onStateChange({ data: 1 });
  assert.equal(win.SC_FLOAT.sound(), true, "the click brought the sound here: the pane hands over");
  opts.events.onStateChange({ data: 0 }); assert.equal(win.SC_FLOAT.ended(), true);
});

test("3b: 27 Oct - while the window holds no sound, the pane plays on with it; the window keeps to its second; nothing stops", async () => {
  const s = station();
  s.floatPage.sound = false;                /* the browser held the window's sound: the picture plays without it */
  await s.api.floatVideo();
  s.api.tickFloat(); s.api.tickFloat();
  assert.ok(!s.calls.includes("pause"), "the pane's player is never paused while the sound is still here");
  assert.deepEqual(s.floatPage.follows, [[24.9, true], [24.9, true]], "the window is handed the pane's second and its play state");
  assert.equal(s.ctx.PLAYER_POSITION.time, 24.9, "where the video is, is this pane's second");
  assert.equal(s.el("floatHold").hidden, true, "no 'waiting for ▶': nothing waits");
  /* a click in the window brings the sound there: from then on it is the window's, as before */
  s.floatPage.sound = true; s.floatPage.t = 30.1; s.api.tickFloat();
  assert.ok(s.calls.includes("pause"), "the hand-over pauses this pane");
  assert.deepEqual(s.floatPage.aligns, [24.9], "at the second the pane had reached");
  s.calls.length = 0; s.win().close();
  assert.deepEqual(s.calls.find((c) => Array.isArray(c) && c[0] === "play()"), ["play()", "u1sbtiTQk1s", 30], "closing then brings it back here at the window's second");
});

test("3b: 27 Oct - closing the window before it ever had the sound resumes nothing: the pane never stopped", async () => {
  const s = station();
  s.floatPage.sound = false;
  await s.api.floatVideo();
  s.api.tickFloat();
  s.floatPage.ended = true; s.api.tickFloat();
  assert.equal(s.calls.filter((c) => c === "advanceQueue").length, 0, "the window's end is not the queue's: this pane's own player carries it");
  s.calls.length = 0;
  s.win().close();
  assert.equal(s.api.FLOAT, null);
  assert.equal(s.calls.filter((c) => Array.isArray(c) && c[0] === "play()").length, 0, "no reload of this pane's player");
  assert.ok(!s.calls.includes("pause"));
  assert.equal(s.el("floatNote").hidden, true);
});

test("3: the new page is in the route inventory", () => {
  assert.match(read("../STATION_ROUTES.md"), /\| floating video, v2 \(Y8\) \| `\/station-shells\/pip-v2` \|/);
});

/* ---- 4. measured headless, 20 Oct (raw readings in deliverables/20261020/y8/measure) ---- */
test("4: measured - an iframe moved into the PiP window reloads (appended or adopted); moveBefore will not cross documents", () => {
  for (const name of ["move-chrome155.json", "move-brave154.json"]) {
    const m = measured(name), row = (s) => m.rows.find((r) => r.strat === s);
    for (const s of ["append", "adopt"]) {
      assert.equal(row(s).survivedMove, false, `${m.version} ${s}: a new page in the window`);
      assert.equal(row(s).survivedReturn, false, `${m.version} ${s}: and again on the way back`);
      assert.equal(row(s).childFetches, 3, `${m.version} ${s}: fetched at load, at the move, at the return`);
    }
    assert.match(row("moveBefore").log.join(" "), /HierarchyRequestError/, `${m.version}: moveBefore refuses to cross documents`);
    assert.equal(row("same-moveBefore").survivedMove, true, `${m.version}: (inside one document it does keep the frame - the test can tell)`);
  }
  const open = measured("child-open.json");
  for (const r of open.rows) for (const how of ["pane click", "pane key", "deck key -> pane"])
    assert.ok(r.log.some((l) => l.startsWith(how + ": ok")), `${r.label}: the pane can open the Station's window - ${how}`);
});

test("4: measured on the real deck - float, the pane's note, the way back in the same player, the fallback", () => {
  const m = measured("y8-measure.json");
  assert.match(m.browser, /^155\./);
  for (const s of m.screens) {
    assert.ok(!s.error, s.screen + ": " + (s.error || ""));
    assert.equal(s.playing.pipBar.shown, true, s.screen + ": the button is on the bar while the video plays");
    assert.deepEqual(s.floatOpen.top.requests[0], { width: 480, height: 270 });
    assert.equal(s.floatOpen.pane.note.shown, true);
    assert.match(s.floatOpen.pane.noteText, /^playing in the floating window · BRING IT BACK/i);
    assert.equal(s.floatOpen.pane.player.state, 2, "the pane's player paused");
    assert.match(s.floatOpen.pane.float.src, /^\/station-shells\/pip-v2\/\?v=/);
    for (const k of ["closed", "bringBack", "nextBack"]) {
      assert.equal(s[k].pane.float, null, s.screen + " " + k);
      assert.ok(s[k].timing && Number.isFinite(s[k].timing.playingAfterMs), s.screen + " " + k + ": the pane's player is playing again (and how long it took is recorded)");
      assert.equal(s[k].pane.player.state, 1, s.screen + " " + k + ": playing");
      assert.equal(s[k].pane.player.sameFrame, true, s.screen + " " + k + ": the same player element");
      assert.equal(s[k].pane.player.frameLoads, 0, s.screen + " " + k + ": which never loaded again");
    }
    /* a window that never played (a held autoplay) hands back exactly the second it was given - never the keyframe
       its cued player reports, which walked the video backwards on every float before pip-v2 waited for play */
    const given = Number(s.floatOpen.pane.float.src.match(/start=(\d+)/)[1]);
    if (s.floatLater.pane.float.page.state !== 1) assert.equal(s.closed.floatSecondAtClose, given, s.screen + ": the second handed back");
    /* YouTube starts on the keyframe at or before the second it is given: up to one keyframe gap earlier */
    for (const [k, from] of [["closed", s.closed.floatSecondAtClose], ["bringBack", Number(s.paneKey.pane.float.src.match(/start=(\d+)/)[1])]]) {
      const d = s[k].pane.player.at - from;
      assert.ok(d > -6 && d < 2, `${s.screen} ${k}: resumed at ${s[k].pane.player.at} for ${from}`);
    }
    assert.equal(s.closed.embedsDuringCycle, 1, s.screen + ": one new YouTube player per float - the window's");
    assert.equal(s.nextWhileFloating.pane.float.id, s.nextBack.pane.player.id, s.screen + ": the video chosen while floating came back with it");
    assert.ok(s.refused.every((r) => !/^GET /.test(r)), "only writes were refused");
  }
  const removed = m.noApi.find((n) => n.label === "chrome155-api-removed");
  assert.equal(removed.topApi.api, "undefined");
  assert.equal(removed.before.canFloat, false);
  assert.equal(removed.before.pipBar.shown, false, "no button");
  assert.equal(removed.before.menuItemDisplay, "none", "no menu item");
  assert.equal(removed.after.float, null, "P did nothing");
});
