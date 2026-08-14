import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const deck = read("deck/index.html");
const testingRuntime = read("testing-surface.js");
const ipad = read("station-ipad/index.html");
const paneX = read("pane-x/index.html");
const paneXCore = read("pane-x/pane-x-presentation-core.js");
const stableXShell = read("station-shells/x-v2/index.html");
const personalVideo = read("station-shells/personal-video-v1/index.html");
const scintillaVideo = read("station-shells/scintilla-video-v1/index.html");

test("testing Station has a permanent unmistakable identity without changing the stable-host gate", () => {
  assert.match(deck, /TESTING SURFACE · NOT STABLE/);
  assert.match(deck, /html\[data-testing="1"\] #testingRibbon\{ display:flex; \}/);
  assert.match(deck, /isolated browser state · production writes blocked/);
  assert.match(testingRuntime, /const STABLE_HOST = "station\.scintillahub\.ai"/);
  assert.match(testingRuntime, /const active = location\.hostname !== STABLE_HOST/);
  assert.match(testingRuntime, /if \(!active\) return/,
    "stable Station exits before any storage, channel, or fetch wrapper is installed");
  assert.match(testingRuntime, /document\.title = "TESTING SURFACE · NOT STABLE — " \+ document\.title/);
});

test("testing browser state and channels are explicitly namespaced and production writes fail closed", () => {
  assert.match(testingRuntime, /const NAMESPACE = "scintilla\.testing\.station\.v1\."/);
  assert.match(testingRuntime, /NAMESPACE \+ "session\."/);
  assert.match(testingRuntime, /NAMESPACE \+ "local\."/);
  assert.match(testingRuntime, /NAMESPACE \+ "channel\."/);
  assert.match(testingRuntime, /TESTING SURFACE blocked a production data write/);
  assert.match(testingRuntime, /productionDataTarget && method !== "GET" && method !== "HEAD" && method !== "OPTIONS"/);
});

test("testing twin preserves component separation and uses only the isolated X candidate route", () => {
  assert.match(deck, /chart: "\/station-shells\/chart-v1"/);
  assert.match(deck, /personalVideo: "\/station-shells\/personal-video-v1"/);
  assert.match(deck, /scintillaVideo: "\/station-shells\/scintilla-video-v1"/);
  assert.match(deck, /x: "\/station-shells\/x-v2"/,
    "stable host retains the exact admitted X endpoint");
  assert.match(deck, /const STATION_X_SHELL = window\.ScintillaTestingSurface\?\.active \? "\/pane-x" : STATION_SHELL\.x/);
  assert.match(deck, /href="\/station-ipad\/">testing iPad/);
});

test("the testing wall keeps market freshness status live without the canonical scope error", () => {
  assert.match(deck, /function paintMarketStatus\(\) \{[\s\S]*?const delayed = visible\.filter/);
  assert.match(deck, /const fresh = ageSec < 90 && !delayed\.length/);
  assert.doesNotMatch(deck, /const delayed = summary\.mode === "delayed"/);
});

test("testing iPad route mounts the same iPad wall without reading or writing the durable pair", () => {
  assert.match(ipad, /if\(testing\)\{deck\.src="\/deck\/\?view=ipad"\}/);
  assert.match(ipad, /else\{let pairHash=/,
    "the durable pair logic remains isolated behind the non-testing branch");
  const testingBranch = ipad.slice(ipad.indexOf("if(testing)"), ipad.indexOf("else{let pairHash="));
  assert.doesNotMatch(testingBranch, /localStorage|ipadPair|ipadCode|pairHash/);
});

test("testing X exits visibly before Bridge, WebRTC, Realtime, pair, controller, or tick authority", () => {
  for (const source of [paneX, stableXShell]) {
    const branchStart = source.indexOf("if (TESTING_SURFACE) {");
    const authorityStart = source.indexOf("} else {", branchStart);
    assert.ok(branchStart >= 0 && authorityStart > branchStart);
    const testingBranch = source.slice(branchStart, authorityStart);
    assert.match(testingBranch, /TEST STREAM NOT CONNECTED/);
    assert.doesNotMatch(testingBranch, /XFF_STATION_|RTCPeerConnection|WebSocket|BroadcastChannel|trustedIpadPair|startStationClock|postXFloat/);
  }
});

test("the handed-off X presentation core is byte-exact and remains presentation-only", () => {
  const digest = crypto.createHash("sha256").update(paneXCore).digest("hex");
  assert.equal(digest, "e3863b888f74a2c81ba9fa3c5c2b1c44f05c72dc9d304b8dc38f775248c48fa3");
  assert.match(paneX, /<script src="\.\/pane-x-presentation-core\.js"><\/script>/);
  assert.match(paneX, /new PaneXViewerPresentationCandidate/);
  assert.doesNotMatch(paneXCore, /XFF_STATION_|RTCPeerConnection|WebSocket|BroadcastChannel|localStorage|sessionStorage|fetch\(/);
});

test("both YouTube endpoints keep real reads while making every testing action local-shadow only", () => {
  assert.equal(personalVideo, scintillaVideo);
  for (const source of [personalVideo, scintillaVideo]) {
    assert.match(source, /pg\("yt_watch_later\?select=video_id"\)/,
      "existing Watch Later data remains a read-only source");
    assert.match(source, /if \(TESTING_SURFACE\) return \{ ok:true, testing:true, action, payload \}/,
      "testing actions never reach yt-act");
    assert.match(source, /youtube\.watch-shadow\.v1/);
    assert.match(source, /youtube\.position-shadow\.v1/);
    assert.match(source, /youtube\.subscription-shadow\.v1/);
  }
});
