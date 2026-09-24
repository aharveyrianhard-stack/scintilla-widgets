/* M29 · the X pane has to stay alive on its own: resize, reload, self-update,
   overnight. These test the decision the pane makes about its own picture,
   with no browser, so every row of the failure table has a unit behind it. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../station-shells/x-v2/index.html", import.meta.url), "utf8");

function fnFromSource(name, context = {}) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") { depth -= 1; if (depth === 0) { end = i + 1; break; } }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, context);
}

const CONSTS = {
  STATION_STALL_MS: 6000, STATION_RELINK_COOLDOWN_MS: 12000, STATION_RELINK_GIVEUP: 3,
  STATION_BLACK_MS: 6000, STATION_CROP_BLIND_MS: 2000, STATION_WAIT_MS: 4000,
  STATION_ASK_GIVEUP: 6, STATION_INK_FLOOR: 0.01,
  STATION_GESTURE_LINE: "press Option+Shift+S on the x.com tab once",
};
const plan = fnFromSource("stationLinkPlan", { ...CONSTS });
/* the plan is built in its own realm, so compare its shape, not its prototype */
const QUIET = { state: "", relink: false, refit: false, stalled: false, gesture: false };
const plain = (value) => JSON.parse(JSON.stringify(value));
const NOW = 1_000_000;
const attached = (over = {}) => ({ attached: true, attachedAt: NOW - 1000, lastFrameAt: NOW - 100,
  lastCropAt: NOW - 100, videoInk: 0.4, cropInk: 0.4, blackSince: 0, blindSince: 0, tries: 0, ...over });

test("the pane's own constants are the ones these tests reason about", () => {
  for (const [name, value] of Object.entries(CONSTS)) {
    const literal = typeof value === "string" ? `"${value}"` : String(value);
    assert.ok(source.includes(`const ${name} = ${literal};`), `${name} must be ${literal} in the pane`);
  }
});

test("a healthy pane says nothing and does nothing", () => {
  assert.deepEqual(plain(plan(NOW, attached())), QUIET);
});

/* 1. NOBODY OFFERED - the reload Alan kept having to do by hand */
test("a pane with no stream asks for one instead of waiting for ever", () => {
  const waiting = { attached: false, bootAt: NOW - 10000, readyAt: NOW - 9000, tries: 0 };
  const r = plan(NOW, waiting);
  assert.equal(r.relink, true, "it asks");
  assert.match(r.state, /asking the X source/);
  assert.equal(plan(NOW, { ...waiting, bootAt: NOW - 1000, readyAt: 0 }).relink, false, "but not in the first seconds");
});

test("an asking pane respects the cooldown and then names the one gesture that works", () => {
  const waiting = { attached: false, bootAt: NOW - 30000, readyAt: NOW - 30000, tries: 1, lastRelinkAt: NOW - 3000 };
  assert.equal(plan(NOW, waiting).relink, false, "no retry storm");
  assert.match(plan(NOW, waiting).state, /asking the X source/);
  const exhausted = plan(NOW, { ...waiting, tries: 6, lastRelinkAt: NOW - 60000 });
  assert.equal(exhausted.relink, false);
  assert.equal(exhausted.gesture, true);
  assert.equal(exhausted.state, `no X source · ${CONSTS.STATION_GESTURE_LINE}`);
});

test("the iPad Companion is never told to press a Mac keyboard shortcut", () => {
  const r = plan(NOW, { attached: false, remote: true, bootAt: NOW - 60000, readyAt: NOW - 60000, tries: 0 });
  assert.deepEqual(plain(r), QUIET);
});

/* 2. THE CAPTURE WENT BLACK - frames keep arriving, all of them empty */
test("frames that carry nothing are a fault, not health", () => {
  const black = attached({ videoInk: 0, cropInk: 0, blackSince: NOW - 7000 });
  const r = plan(NOW, black);
  assert.equal(r.stalled, true);
  assert.equal(r.relink, true);
  assert.match(r.state, /the X capture went black/);
  assert.equal(plan(NOW, attached({ videoInk: 0, cropInk: 0, blackSince: NOW - 3000 })).stalled, false,
    "a three second blink is not a fault");
});

test("when relinking cannot fix a black capture the pane says the one thing that can", () => {
  const r = plan(NOW, attached({ videoInk: 0, cropInk: 0, blackSince: NOW - 40000, tries: 3, lastRelinkAt: NOW - 30000 }));
  assert.equal(r.gesture, true);
  assert.equal(r.relink, false);
  assert.equal(r.state, `the X capture is black · ${CONSTS.STATION_GESTURE_LINE}`);
});

/* 3. THE CROP MISSED THE FRAME - what a resize opens */
test("a picture in the frame but none in the crop re-derives the crop, it does not relink", () => {
  const r = plan(NOW, attached({ videoInk: 0.5, cropInk: 0, blindSince: NOW - 2500 }));
  assert.equal(r.refit, true, "re-derive");
  assert.equal(r.relink, false, "the stream is fine; do not tear it down");
  assert.equal(r.state, "re-deriving the crop");
  assert.equal(plan(NOW, attached({ videoInk: 0.5, cropInk: 0, blindSince: NOW - 900 })).refit, false,
    "a single bad frame during a drag is not a fault");
});

test("no frames at all still relinks, with the message it always had", () => {
  const r = plan(NOW, attached({ lastFrameAt: NOW - 9000, lastCropAt: NOW - 9000, attachedAt: NOW - 20000 }));
  assert.equal(r.relink, true);
  assert.match(r.state, /relinking · 9s without a frame/);
  const gone = plan(NOW, attached({ lastFrameAt: NOW - 9000, lastCropAt: NOW - 9000, attachedAt: NOW - 20000, tries: 3 }));
  assert.match(gone.state, /the X window may be closed/);
  assert.equal(gone.relink, false);
});

/* the wiring the browser run exercises */
test("the watcher runs for the life of the document, not only while attached", () => {
  assert.match(source, /function startStationWatch\(\) \{\n\s*if \(stationHealthTimer\) return;/);
  assert.match(source, /\nstartStationWatch\(\);/, "started at boot");
  assert.match(source, /stopStationHealth[\s\S]{0,700}startStationWatch\(\);/, "and kept running after a stop");
});

test("the relink ladder survives the relink itself, and only a picture clears it", () => {
  /* A relink ends in startStationHealth() and passes through stopStationHealth();
     resetting the counter in either place meant the pane relinked a dead capture
     for ever instead of reaching the sentence Alan can act on. */
  assert.doesNotMatch(source, /stationLastCropAt = 0; stationRelinkAt = 0; stationRelinkTries = 0;/);
  assert.match(source, /stationRelinkTries = 0; stationRelinkAt = 0;\n\s*\}/);
  assert.match(source, /if \(stationRelinkTries && xfloatStream && stationCanvasInk !== null && stationCanvasInk > STATION_INK_FLOOR\) \{/);
});

test("the pane measures what it is actually painting", () => {
  assert.match(source, /function stationInkOf\(source, width, height, region\)/);
  assert.match(source, /stationCropInk = region\.usable \? stationInkOf\(video, video\.videoWidth, video\.videoHeight, region\) : 0;/);
  assert.match(source, /function sampleStationInk\(\)/);
  assert.match(source, /stationInkScratch\.width = 24; stationInkScratch\.height = 16;/);
});

test("a crop that misses the frame shows the whole frame instead of black", () => {
  assert.match(source, /if \(!region\.usable \|\| stationFullFrame\) \{/);
  assert.match(source, /ctx\.drawImage\(video, 0, 0, video\.videoWidth, video\.videoHeight,/);
  assert.match(source, /if \(stationFullFrame && !blind && stationCropInk !== null && stationCropInk > STATION_INK_FLOOR\) stationFullFrame = false;/);
});

/* The half of the fix a person actually sees. */
test("a fault sentence outranks the 'live' the crop handler writes ten times a second", () => {
  /* M43 (24 Sep): the whole-window last resort also owns the line while it stands. */
  assert.match(source, /if \(!stationFault && !stationWholeFrameWhy\) showStationState\(paused \? "paused" : "live", "on"\);/);
  assert.match(source, /stationFault = plan\.state;\n\s*showStationState\(plan\.state, "warn"\);/);
  assert.match(source, /if \(stationFault\) \{ stationFault = ""; showStationState\(xfloatStream \? "live" : "waiting"/,
    "and it is released the moment the fault clears");
});

test("the pane tells the deck whether it is live, so an update cannot cut it off", () => {
  assert.match(source, /function tellDeckAboutX\(\)/);
  assert.match(source, /type:"SCINTILLA_X_LIVE", live, picture/);
});

test("the pane publishes its own diagnosis", () => {
  assert.match(source, /window\.__SCINTILLA_X_LINK = \{/);
  assert.match(source, /videoInk: stationVideoInk, cropInk: stationCropInk, canvasInk: stationCanvasInk,/);
});

test("a stream with no crop yet shows the frame instead of nothing", () => {
  assert.match(source, /function drawXFloat\(at = 0\) \{\n\s*if \(!xfloatStream\) \{/);
  assert.doesNotMatch(source, /if \(!xfloatStream \|\| !xfloatCrop\) \{/);
});

test("iOS and the Companion are kept out of the asking branch at the call site", () => {
  assert.match(source, /remote: REMOTE_MODE \|\| IOS,/);
});

test("a pane that comes back into view checks at once", () => {
  assert.match(source, /if \(document\.visibilityState === "visible"\) runStationHealth\(\);/);
});
