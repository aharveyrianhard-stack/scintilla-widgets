/* Y9 (21 Oct 2026), Alan, on the MacBook: "it looks weird on MacBook Pro, the size of YouTube and stuff, and it's like
   changing. I think we should make it be the YouTube at the bottom and two charts that I change around manually …
   keep it a lot simpler." And: "the audio is not working."
   1. SIMPLE: a wall mode chosen and remembered per machine (WALL · SIMPLE on the dock): two charts set by hand on top,
      the YouTube pane across the bottom (60/40, a handle on the seam), X in its column top to bottom; nothing moves
      by itself on a window change; no rotation. The two symbols are remembered on this machine.
   2. The sound: the first tap on the pane turns the sound on at the session's last volume; a mute of the user's own
      stands; the bar says MUTED · TAP FOR SOUND while the browser holds the sound off.
   3. The headless measurements pinned: today's wall changes shape as the MacBook window narrows; SIMPLE does not. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const exists = (p) => fs.existsSync(new URL(p, import.meta.url));
const deck = read("../deck/index.html");
const SHELLS = ["personal-video-v1", "scintilla-video-v1"];
const shells = Object.fromEntries(SHELLS.map((n) => [n, read(`../station-shells/${n}/index.html`)]));
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fn = (src, name) => grab(src, new RegExp("\\nfunction " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"), name);

/* the deck's pure numbers, run as the deck runs them */
function deckApi() {
  const src = [
    grab(deck, /const FLOOR_COLUMN_SHARE = [\s\S]*?const FLOOR_COUNTS = \[[^\]]*\];/, "the floor plan constants"),
    grab(deck, /const VIDEO_CHROME_FALLBACK_PX = [^;]*;/, "the shell's bar fallback"),
    fn(deck, "floorGrid"), fn(deck, "floorPlan"),
    grab(deck, /const SIMPLE_KEY = [\s\S]*?const SIMPLE_SPLIT_DEFAULT = [^;]*;/, "the SIMPLE constants"),
    fn(deck, "simpleDefault"), fn(deck, "simpleChoice"), fn(deck, "simpleSplitOf"), fn(deck, "floorSimple"),
    "globalThis.out = { floorGrid, floorPlan, simpleDefault, simpleChoice, simpleSplitOf, floorSimple, SIMPLE_KEY, SIMPLE_SPLIT_KEY, SIMPLE_CHART_KEY, SIMPLE_MACHINE_PX, SIMPLE_CHARTS, SIMPLE_SPLIT_DEFAULT, SIMPLE_SPLIT_MIN, SIMPLE_SPLIT_MAX, FLOOR_SEAM_PX, VIDEO_CHROME_FALLBACK_PX };"
  ].join("\n");
  const ctx = {}; vm.runInNewContext(src, ctx); return ctx.out;
}
const plain = (v) => JSON.parse(JSON.stringify(v));
/* the MacBook windows the brief names, and the grid's height with the dock tucked away (the deck's auto-hide, measured) */
const MACBOOKS = [["1728x1117", 1728, 1117], ["1512x982", 1512, 982], ["1440x900", 1440, 900]];
const CHROME = 26;   /* the shell's one bar, as the pane reports it on the wall */

test("Y9 · SIMPLE is chosen per machine: the stored choice wins, then the URL, then the screen (1800 px and under is SIMPLE)", () => {
  const D = deckApi();
  assert.equal(D.SIMPLE_MACHINE_PX, 1800);
  for (const w of [1728, 1512, 1440, 1800]) assert.equal(D.simpleDefault(w), true, w + " is a MacBook screen: SIMPLE by itself");
  for (const w of [1801, 1920, 2560, 3840]) assert.equal(D.simpleDefault(w), false, w + " is the iMac or wider: the WALL by itself");
  assert.equal(D.simpleDefault(0), false, "no screen reading: the WALL, never a guess");
  assert.equal(D.simpleChoice("", "", 1728), true); assert.equal(D.simpleChoice("", "", 2560), false);
  assert.equal(D.simpleChoice("0", "", 1728), false, "the machine's stored WALL stands on a MacBook");
  assert.equal(D.simpleChoice("1", "", 2560), true, "the machine's stored SIMPLE stands on the iMac");
  assert.equal(D.simpleChoice("1", "0", 1728), false, "?simple=0 wins for that load"); assert.equal(D.simpleChoice("0", "1", 2560), true, "?simple=1 wins for that load");
  assert.equal(D.simpleChoice("junk", "junk", 1512), true, "anything else is no choice at all");
  /* the deck reads the SCREEN, not the window: the iMac's Station window is 1062 px wide (Y7) and would read as a MacBook */
  assert.match(fn(deck, "simpleOn"), /screen\.width/, "the machine is its screen");
  assert.match(fn(deck, "simpleOn"), /QS\.get\("simple"\)/, "the URL's one-shot override");
  assert.ok(!/remember\(SIMPLE_KEY, QS/.test(deck), "the URL's override is not remembered");
});

test("Y9 · the dock carries WALL · SIMPLE, and the switch remembers station.simple on this machine", () => {
  assert.match(deck, /<button type="button" class="btn" id="wallBtn"[\s\S]{0,400}>wall<\/button>/, "WALL on the dock");
  assert.match(deck, /<button type="button" class="btn" id="simpleBtn"[\s\S]{0,400}>simple<\/button>/, "SIMPLE on the dock");
  const station = grab(deck, /<span class="dsec" data-sec="station"[\s\S]*?<\/span>\n  <span class="dsec" data-sec="scenes"/, "the station section");
  assert.ok(station.includes('id="chartsOnlyBtn"') && station.includes('id="wallMode"'), "beside CHARTS ONLY, in the one section the dock always shows");
  const set = fn(deck, "setSimple");
  assert.match(set, /localStorage\.setItem\(SIMPLE_KEY, on \? "1" : "0"\)/, "the choice is this machine's (localStorage), like CHARTS ONLY");
  assert.match(set, /if \(on\) placeSimpleSymbols\(\)/, "SIMPLE puts its two symbols back");
  assert.match(set, /scheduleRotation\(\)/, "the rotation is re-decided");
  assert.match(set, /relayout\(\)/);
  const wire = fn(deck, "wireSimple");
  assert.match(wire, /wallBtn[\s\S]*setSimple\(false\)/); assert.match(wire, /simpleBtn[\s\S]*setSimple\(true\)/);
  assert.match(deck, /\nwireChartsOnly\(\);\nwireSimple\(\);/, "wired where CHARTS ONLY is wired");
  const paint = fn(deck, "paintSimple");
  assert.match(paint, /classList\.toggle\("simple", on\)/); assert.match(paint, /aria-pressed/);
});

test("Y9 · SIMPLE's numbers at the MacBook sizes: two charts on top, the YouTube pane across the bottom at 40 %, X's column untouched", () => {
  const D = deckApi();
  assert.equal(D.SIMPLE_SPLIT_DEFAULT, 0.6); assert.equal(D.SIMPLE_CHARTS, 2);
  for (const [key, W, H] of MACBOOKS) {
    const plan = D.floorPlan(W, H, CHROME);
    assert.equal(plan.col, Math.round(W * 0.24), key + ": X's column is 24 % of the wall, as S11 set it");
    const s = D.floorSimple(plan.charts.w, plan.charts.h, 46, 0.6, 9, CHROME);
    assert.equal(s.simple, true);
    assert.deepEqual(plain(s.cells), [{ col: 1, row: 1 }, { col: 2, row: 1 }], key + ": c1 and c2, side by side, one row");
    assert.equal(s.cols, 2); assert.equal(s.rows, 1); assert.equal(s.charts, 2); assert.equal(s.hidden, 7, key + ": the page's other seven slots are hidden, not unmounted");
    assert.equal(s.box.w, plan.charts.w, key + ": the pane takes the whole width right of the column");
    assert.equal(s.box.left, 0);
    assert.equal(s.box.h, Math.round((plan.charts.h - 1) * 0.4), key + ": 40 % of the height less the seam");
    assert.equal(s.box.top + s.box.h, plan.charts.h, key + ": flush with the bottom");
    assert.equal(s.chartsH, plan.charts.h - s.box.h - 1 - 46, key + ": the charts get the rest, less the seam and the tapes");
    assert.equal(s.picture.w, Math.min(s.box.w, Math.floor((s.box.h - CHROME) * 16 / 9)), key + ": the picture is 16:9 under the shell's bar");
    assert.ok(s.picture.w >= 580 && s.picture.h >= 325, key + ": the picture is " + s.picture.w + " × " + s.picture.h);
  }
  /* the numbers the pictures show (deliverables/20261021/y9), with the dock tucked away */
  const p1728 = D.floorPlan(1728, 1117, CHROME), s1728 = D.floorSimple(p1728.charts.w, p1728.charts.h, 46, 0.6, 9, CHROME);
  assert.deepEqual(plain(s1728.box), { left: 0, top: 671, w: 1312, h: 446 });
  assert.deepEqual(plain(s1728.picture), { w: 746, h: 420 });
  /* a count of one or two: the same band, the charts it has */
  assert.deepEqual(plain(D.floorSimple(1312, 1117, 0, 0.6, 1, CHROME).cells), [{ col: 1, row: 1 }]);
  assert.equal(D.floorSimple(1312, 1117, 0, 0.6, 2, CHROME).hidden, 0);
  /* the handle's range: a split is clamped and read back the same */
  assert.equal(D.simpleSplitOf("0.6"), 0.6); assert.equal(D.simpleSplitOf(""), 0.6); assert.equal(D.simpleSplitOf("junk"), 0.6);
  assert.equal(D.simpleSplitOf("0.1"), D.SIMPLE_SPLIT_MIN); assert.equal(D.simpleSplitOf("0.95"), D.SIMPLE_SPLIT_MAX);
  assert.equal(D.floorSimple(1312, 1117, 0, 0.5, 9, CHROME).box.h, Math.round(1116 * 0.5), "the handle moves the split");
});

test("Y9 · the no-reflow rule: 1728 → 1440 keeps the same layout, only scaled; nothing in SIMPLE reads the window's width", () => {
  const D = deckApi();
  const shape = (W, H) => { const p = D.floorPlan(W, H, CHROME); const s = D.floorSimple(p.charts.w, p.charts.h, 46, 0.6, 9, CHROME);
    return { cells: plain(s.cells), cols: s.cols, rows: s.rows, hidden: s.hidden, colShare: Math.round(p.col / W * 100), bandShare: Math.round(s.box.h / (p.charts.h - 1) * 100), fullWidth: s.box.w === p.charts.w, flush: s.box.top + s.box.h === p.charts.h }; };
  const ref = shape(1728, 1117);
  for (let W = 1728; W >= 1000; W -= 8) assert.deepEqual(shape(W, 1117), ref, "at " + W + " px the layout is the same as at 1728");
  for (const [, W, H] of MACBOOKS) assert.deepEqual(shape(W, H), ref);
  /* the slot (Y7) is what changed shape under him: the same sweep through floorSlot gives more than one block */
  const slotSrc = fn(deck, "floorSlot");
  const ctx = {}; vm.runInNewContext(grab(deck, /const FLOOR_COLUMN_SHARE = [\s\S]*?const FLOOR_COUNTS = \[[^\]]*\];/, "c") + "\nconst VIDEO_CHROME_FALLBACK_PX = 26; const SLOT_SPAN = 2;\n" + fn(deck, "floorGrid") + fn(deck, "floorPlan") + slotSrc + "\nglobalThis.out = { floorGrid, floorPlan, floorSlot };", ctx);
  const blocks = new Set();
  for (let W = 1728; W >= 1000; W -= 8) { const p = ctx.out.floorPlan(W, 1117, CHROME); const a = { w: p.charts.w, h: p.charts.h - 46 }; const s = ctx.out.floorSlot(ctx.out.floorGrid(6, a.w, a.h), a.w, a.h, CHROME, 6); blocks.add(JSON.stringify([s.cols, s.rows, s.block])); }
  assert.ok(blocks.size > 1, "today's six-chart wall takes " + blocks.size + " shapes over the same sweep (the 'changing')");
  /* in the deck: SIMPLE is a slot, so fitVideoPane lifts the pane as Y7 does, and the grid is told 2 × 1 for every count */
  const fit = fn(deck, "fitVideoPane");
  assert.match(fit, /const simple = !!slot && !!slot\.simple;/);
  assert.match(fit, /simple \? \{ cols:slot\.cols, rows:slot\.rows \}/, "every count's grid is SIMPLE's grid");
  assert.match(fit, /--simple-video-px/, "the band's height is handed to the CSS");
  assert.match(fit, /classList\.toggle\("simple", simpleOn\(\)\)/);
  assert.match(deck, /body\.simple\.video-slot:not\(\.stack\) #grid > #rowTop\{ margin-bottom:calc\(var\(--simple-video-px, 0px\) \+ 1px \+ var\(--tapes-px, 0px\)\); \}/, "the chart row gives up the band and the tapes");
  assert.match(deck, /body\.simple\.video-slot\.tapes:not\(\.stack\) #tapes\{ bottom:calc\(var\(--simple-video-px, 0px\) \+ 1px\); \}/, "the tapes sit above the pane");
  const slotFor = fn(deck, "slotFor");
  assert.match(slotFor, /if \(simpleOn\(\)\) return floorSimple\(plan\.charts\.w, plan\.charts\.h, tapePx, simpleSplit\(\), count, chromePx\);/);
  assert.ok(slotFor.indexOf("charts-only") < slotFor.indexOf("simpleOn()") && slotFor.indexOf("simpleOn()") < slotFor.indexOf("if (SOLO) return null"), "CHARTS ONLY and a phone keep their layouts; a chart solo keeps SIMPLE's band");
  assert.match(fn(deck, "placeChartsAroundSlot"), /solo \? "1 \/ -1"/, "the solo chart takes the whole charts' row");
});

test("Y9 · the two symbols are typed into the panes' own boxes, remembered on this machine, and come back with SIMPLE", () => {
  const commit = fn(deck, "commitTicker");
  assert.match(commit, /retargetSlot\(index, ticker\)/, "the pane follows the symbol through one function");
  assert.match(commit, /if \(simpleOn\(\) && index < SIMPLE_CHARTS\) remember\(SIMPLE_CHART_KEY \+ \(index \+ 1\), ticker\)/, "Enter in slot 1 or 2 is remembered under station.simple.chart.N");
  assert.match(deck, /if \(simpleOn\(\)\) simpleSymbols\(\)\.forEach\(\(t, i\) => \{ if \(t && !\(URL_STATEFUL && QS\.has\("c" \+ \(i \+ 1\)\)\)\) CHARTS\[i\] = t; \}\);/, "at boot the remembered pair goes into slots 1 and 2 (a URL that names the slot wins)");
  const place = fn(deck, "placeSimpleSymbols");
  assert.match(place, /retargetSlot\(i, t\)/); assert.match(place, /rememberEditableState\(\)/);
  assert.match(fn(deck, "retargetSlot"), /syncChartFrame\(o\.frame, o\.def\.src, \{ sc:"chart", ticker, range:RANGE \}\)/, "a mounted chart is re-pointed in place, never reloaded for nothing");
  /* the symbol box is the one the deck already had: the pane's own input (t1, t2), reached from the chart's badge */
  assert.match(deck, /n\.className = "tkin"; n\.id = "t" \+ \(i \+ 1\);/);
  assert.match(deck, /if \(event\.data\?\.sc === "chart-focus-ticker"\)/);
  /* a tape tap in SIMPLE lands in one of the two charts on the wall */
  assert.match(fn(deck, "openTapeTicker"), /simpleOn\(\) \? Math\.min\(CHART_COUNT, SIMPLE_CHARTS\) : CHART_COUNT/);
});

test("Y9 · no rotation in SIMPLE; the rotation, the slot and CHARTS ONLY are untouched for the WALL", () => {
  assert.match(fn(deck, "scheduleRotation"), /if \(ROTATE_PAUSED \|\| simpleOn\(\)\) return;/);
  const paint = fn(deck, "paintRotateControls");
  assert.match(paint, /toggle\.disabled = simpleOn\(\);/); assert.match(paint, /no rotation in SIMPLE/);
  assert.match(deck, /const SLOT_SPAN = 2;/); assert.match(deck, /function floorSlot\(grid, areaWidth, areaHeight, chromePx, count\)/);
  assert.match(deck, /const CHARTS_ONLY_KEY = "station\.chartsOnly";/);
  assert.match(fn(deck, "setChartsOnly"), /dispatchEvent\(new Event\("resize"\)\)/);
  /* the handle: made with the tapes, on the seam, the split remembered */
  assert.match(fn(deck, "wireTapes"), /wireSimpleHandle\(grid\)/);
  const handle = fn(deck, "wireSimpleHandle");
  assert.match(handle, /h\.id = "simpleHandle"/); assert.match(handle, /setPointerCapture/); assert.match(handle, /remember\(SIMPLE_SPLIT_KEY, drag\.split\.toFixed\(3\)\)/);
  assert.match(deck, /#simpleHandle\{ display:none; \}/); assert.match(deck, /body\.simple\.video-slot:not\(\.stack\):not\(\.media-theatre\) #simpleHandle\{ display:block;/, "shown in SIMPLE, not over the theatre");
});

/* the pane's sound rule, run as the pane runs it, against a fake player */
function soundApi(src, { muted = true, volume = 100, session = null } = {}) {
  const block = grab(src, /const SOUND_KEY = "station\.sound";[\s\S]*?\nel\("bSound"\)\.addEventListener\("click", \(\) => \{[\s\S]*?\n\}\);/, "the sound block");
  const calls = [];
  const player = { _muted: muted, _volume: volume,
    isMuted() { return this._muted; }, getVolume() { return this._volume; },
    unMute() { calls.push(["unMute"]); this._muted = false; }, setVolume(v) { calls.push(["setVolume", v]); this._volume = v; } };
  const store = new Map(); if (session) store.set("station.sound", JSON.stringify(session));
  const listeners = {};
  const ctx = { YT_PLAYER: player, YT_PLAYER_READY: true, CUR: { video_id: "x" }, calls, console, listeners,
    sessionStorage: { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    document: { body: { dataset: {} }, addEventListener: (t, f) => { listeners[t] = f; } },
    el: () => ({ addEventListener: (t, f) => { listeners["bSound:" + t] = f; } }),
    setTimeout: (f) => { f(); return 1; } };
  vm.runInNewContext(block + "\nglobalThis.out = { rememberedSound, rememberSound, soundOnFirstTap, soundOnPlayerReady, soundOnPlaying, paintSound, tap: () => listeners.pointerdown(), key: () => listeners.keydown(), button: () => listeners['bSound:click'](), state: () => ({ gesture: SOUND_GESTURE, done: SOUND_DONE }), setReady: (v) => { YT_PLAYER_READY = v; } };", ctx);
  return Object.assign(ctx.out, { player, calls, store, body: ctx.document.body });
}
test("Y9 · the sound: the first tap on the pane turns it on at the session's last volume; a mute of the user's own stands", () => {
  for (const name of SHELLS) {
    const src = shells[name];
    /* a fresh session, the browser started the embed with its sound off: the first tap unmutes at 100 */
    let S = soundApi(src, { muted: true, volume: 100 });
    S.soundOnPlaying(); assert.deepEqual(S.calls, [], name + ": playing before any tap touches nothing");
    assert.equal(S.body.dataset.muted, "true", name + ": and the bar says muted");
    S.tap();
    assert.deepEqual(plain(S.calls), [["unMute"]], name + ": the first tap unmutes (the volume is already 100)");
    assert.equal(S.player.isMuted(), false); assert.equal(S.body.dataset.muted, "false");
    S.tap(); S.soundOnPlaying(); assert.equal(S.calls.length, 1, name + ": a second tap, a next video: nothing more is forced");
    /* the session remembered 37: the first tap unmutes at 37 */
    S = soundApi(src, { muted: true, volume: 100, session: { volume: 37, muted: false } });
    S.tap(); assert.deepEqual(plain(S.calls), [["unMute"], ["setVolume", 37]], name + ": the session's last volume comes back");
    /* the player already had the sound: the tap only sets the remembered volume */
    S = soundApi(src, { muted: false, volume: 60, session: { volume: 37, muted: false } });
    S.tap(); assert.deepEqual(plain(S.calls), [["setVolume", 37]], name + ": no unMute when it was not muted");
    /* the user muted it themselves this session: the first tap leaves it */
    S = soundApi(src, { muted: true, volume: 50, session: { volume: 50, muted: true } });
    S.tap(); assert.deepEqual(S.calls, [], name + ": a mute of the user's own stands"); assert.equal(S.state().done, true);
    /* a volume of 0 remembered is not a volume: 100 */
    S = soundApi(src, { muted: true, volume: 0, session: { volume: 0, muted: false } });
    S.tap(); assert.deepEqual(plain(S.calls), [["unMute"], ["setVolume", 100]], name + ": a zero is not kept");
    /* the player's volume and mute are the user's after the first tap and are remembered; before it, nothing is written */
    S = soundApi(src, { muted: true, volume: 100 });
    S.rememberSound(); assert.equal(S.store.has("station.sound"), false, name + ": nothing remembered before the first tap (the browser's mute is not the user's)");
    S.tap(); S.player._volume = 22; S.player._muted = true; S.rememberSound();
    assert.deepEqual(JSON.parse(S.store.get("station.sound")), { volume: 22, muted: true }, name + ": after it, the user's own setting is kept");
    /* the player made ready after the tap (the first tap is the card click that creates it): ready applies it */
    S = soundApi(src, { muted: true, volume: 100, session: { volume: 55, muted: false } });
    S.setReady(false); S.key(); assert.equal(S.state().gesture, true); assert.deepEqual(S.calls, [], name + ": the tap before the player exists waits");
    S.setReady(true); S.soundOnPlayerReady(S.player); assert.deepEqual(plain(S.calls), [["setVolume", 55], ["unMute"]], name + ": ready: the remembered volume, then the unmute the tap asked for");
    /* MUTED · TAP FOR SOUND is itself the tap, and forgets a remembered mute */
    S = soundApi(src, { muted: true, volume: 50, session: { volume: 50, muted: true } });
    S.button(); assert.deepEqual(plain(S.calls), [["unMute"]], name + ": the button turns it on even after a remembered mute, at the volume the player has");
    /* wired where the pane already works: ready, playing, the poll, the way out */
    assert.match(src, /try \{ soundOnPlayerReady\(event\.target\); \} catch \(_\) \{\}\n\s+resolve\(event\.target\);/, name + ": onReady");
    assert.match(src, /if \(Number\(event\.data\) === 1\) \{ setAutoplayBlockedState\(false, request\); soundOnPlaying\(\); \}/, name + ": playing");
    assert.match(src, /saveActiveVideoPosition\(false\);\n\s+rememberSound\(\);/, name + ": the five-second poll");
    assert.match(src, /"pagehide", \(\) => \{ captureActiveVideoPosition\(\); saveActiveVideoPosition\(true\); rememberSound\(\); \}/, name + ": the way out");
    assert.match(src, /document\.addEventListener\("pointerdown", \(\) => \{ SOUND_GESTURE = true; soundOnFirstTap\(\); \}, \{ capture:true \}\);/, name + ": the first tap, anywhere on the pane");
  }
});

test("Y9 · the pane says MUTED · TAP FOR SOUND while the browser holds the sound off; the twins stay byte-identical", () => {
  assert.equal(shells["personal-video-v1"], shells["scintilla-video-v1"]);
  const src = shells["scintilla-video-v1"];
  assert.match(src, /<button class="btn" id="bSound" type="button" title="[^"]*">muted · tap for sound<\/button>/);
  assert.match(src, /#bSound\{ display:none; color:var\(--vol\);/); assert.match(src, /body\.playing\[data-muted="true"\] #bSound\{ display:inline-block; \}/);
  assert.match(src, /<button class="btn" id="bContinue" type="button">tap to continue<\/button>\n\s+<button class="btn" id="bSound"/, "beside TAP TO CONTINUE, on the transport");
  assert.match(fn(src, "paintSound"), /document\.body\.dataset\.muted = muted \? "true" : "false"/);
  /* the pane's own autoplay-blocked state and CONTINUE are untouched */
  assert.match(src, /body\[data-autoplay-blocked="true"\] #bContinue\{ display:inline-block; \}/);
  assert.match(fn(src, "setAutoplayBlockedState"), /document\.body\.dataset\.autoplayBlocked = blocked \? "true" : "false"/);
});

test("Y9 · measured headless: today's wall changes shape as the MacBook window narrows; SIMPLE keeps one layout from 1728 to 1440", { skip: !exists("../deliverables/20261021/y9/measure/today-wall.json") || !exists("../deliverables/20261021/y9/measure/y9-measure.json") }, () => {
  const today = JSON.parse(read("../deliverables/20261021/y9/measure/today-wall.json"));
  const six = today.sweeps.find((s) => s.count === 6), two = today.sweeps.find((s) => s.count === 2);
  const blocksOf = (sw) => [...new Set(sw.down.map((c) => JSON.stringify([c.reading.rowTop.fpc, c.reading.rowTop.fpr, c.reading.video && c.reading.video.box && [c.reading.video.box.w, c.reading.video.box.h]])))];
  assert.ok(blocksOf(six).length > 2, "six charts: the grid flips (3 × 2 → 2 × 3) and the pane's box with it");
  const sixFlip = six.down.find((c) => c.reading.rowTop.fpc === "2" && c.reading.rowTop.fpr === "3");
  assert.ok(sixFlip && sixFlip.atWidth <= 1416 && sixFlip.atWidth >= 1400, "the flip is between 1416 and 1408 px wide at 1117 tall (measured " + (sixFlip && sixFlip.atWidth) + ")");
  const twoWide = two.down[0].reading, twoFlip = two.down.find((c) => c.reading.rowTop.fpc === "1");
  assert.equal(twoWide.video.box.h, twoWide.grid.h - 46, "two charts (the Station's default count): the pane is a strip the full height of the chart grid (less the tapes), one chart beside it");
  assert.ok(twoFlip && twoFlip.atWidth <= 1416, "and it flips to a stacked pair narrower than 1416 px (measured " + (twoFlip && twoFlip.atWidth) + ")");
  const y9 = JSON.parse(read("../deliverables/20261021/y9/measure/y9-measure.json"));
  for (const s of y9.screens) {
    assert.ok(!s.error, s.screen + ": " + s.error);
    assert.equal(s.boot.simpleOn, true, s.screen + ": a fresh profile on a MacBook screen is SIMPLE by itself");
    assert.equal(s.boot.stored.simple, null, s.screen + ": without storing anything");
    assert.deepEqual(s.boot.charts.filter((c) => !c.off).map((c) => c.key), ["c1", "c2"], s.screen + ": two charts on the wall");
    assert.equal(s.boot.video.box.w, s.boot.rowTop.w, s.screen + ": the pane is the charts' width");
    assert.equal(s.boot.video.box.y + s.boot.video.box.h, s.boot.grid.y + s.boot.grid.h, s.screen + ": flush with the bottom");
    assert.equal(s.boot.x.h, s.boot.grid.h, s.screen + ": X has the column top to bottom");
    assert.equal(s.boot.buttons.rotate.disabled, true, s.screen + ": no rotation");
    assert.equal(s.resize.distinctLayouts, 1, s.screen + ": 1728 → 1440 → 1728, one layout (" + s.resize.steps.length + " steps)");
    assert.equal(s.symbol.after.tickers[0], "NVDA", s.screen + ": Enter in the box set chart 1");
    assert.equal(s.symbol.after.stored.c1, "NVDA", s.screen + ": and the machine remembers it");
    assert.equal(s.wall.simpleOn, false); assert.equal(s.wall.stored.simple, "0"); assert.deepEqual(plain(s.wall.slotBlock), { cols: 2, rows: 2 }, s.screen + ": WALL brings Y7's block back");
    assert.equal(s.simpleAgain.simpleOn, true); assert.equal(s.simpleAgain.stored.simple, "1");
    assert.equal(s.reload.simpleOn, true); assert.equal(s.reload.tickers[0], "NVDA", s.screen + ": a reload brings the mode and the symbol back");
    if (s.handle) assert.ok(s.handle.video.box.h < s.simpleAgain.video.box.h, s.screen + ": the handle dragged down made the pane shorter and was remembered (" + s.handle.stored.split + ")");
  }
  assert.equal(y9.imacDefault.reading.simpleOn, false, "a 2560-wide screen with nothing stored is the WALL");
});
