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
const paneXReplay = read("pane-x/pane-x-test-replay.js");
const paneXMotion = read("pane-x/fixtures/x-crop-motion.js");
const paneXFixture = read("pane-x/fixtures/x-feed-static.svg");
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
  assert.match(deck, /const STATION_X_SHELL = window\.ScintillaTestingSurface\?\.active \? "\/pane-x\/" : STATION_SHELL\.x/,
    "the testing pane uses a directory route so its five local relative assets stay pane-scoped");
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

test("testing X is a local static replay with no Bridge, transport, pair, controller, or tick authority", () => {
  const branchStart = stableXShell.indexOf("if (TESTING_SURFACE) {");
  const authorityStart = stableXShell.indexOf("} else {", branchStart);
  assert.ok(branchStart >= 0 && authorityStart > branchStart);
  const stableTestingBranch = stableXShell.slice(branchStart, authorityStart);
  assert.match(stableTestingBranch, /TEST STREAM NOT CONNECTED/,
    "the unused stable shell retains its original fail-closed testing boundary");

  assert.match(paneX, /SCINTILLA · X pane · TEST REPLAY/);
  assert.match(paneX, /<script src="\.\/fixtures\/x-crop-motion\.js"><\/script>/);
  assert.match(paneX, /<script src="\.\/pane-x-test-replay\.js"><\/script>/);
  assert.match(paneXReplay, /STATIC X FIXTURE · NO LIVE CONNECTION/);
  assert.match(paneXReplay, /authority:"NONE"/);
  assert.match(paneXReplay, /fixture\.src = "\.\/fixtures\/x-feed-static\.svg"/);
  const executableSurface = `${paneX}\n${paneXReplay}\n${paneXMotion}`;
  for (const forbidden of [
    "getUserMedia", "getDisplayMedia", "RTCPeerConnection", "WebSocket", "BroadcastChannel",
    "EventSource", "XMLHttpRequest", "navigator.mediaDevices", "postMessage", "stationRealtimeRoom",
    "supabase", "chrome.", "x.com", "twitter.com", "pair=", "XFF_STATION", "fetch("
  ]) assert.equal(executableSurface.includes(forbidden), false, `forbidden replay capability: ${forbidden}`);
});

test("the handed-off X presentation core is byte-exact and remains presentation-only", () => {
  const digest = (source) => crypto.createHash("sha256").update(source).digest("hex");
  assert.equal(digest(paneX), "e14de84ef515e07045fcd0238fd638af8580da3dce75de8c6dd2685deb4db9c3");
  assert.equal(digest(paneXCore), "e3863b888f74a2c81ba9fa3c5c2b1c44f05c72dc9d304b8dc38f775248c48fa3");
  assert.equal(digest(paneXMotion), "119b4291cc9e3d23c487d2c5e7227e15b264c411befc9b79f77d0c0be8a44c29");
  assert.equal(digest(paneXReplay), "05919eb4f5b3d8031421d2de2dfc570aec93386455b071a50bc765d45e5b8064");
  assert.equal(digest(paneXFixture), "231f7f30e77b2d7bcd7fe63c852c000a85a0e5095f40c55edd14a565d5573ee1");
  assert.match(paneX, /<script src="\.\/pane-x-presentation-core\.js"><\/script>/);
  assert.match(paneXReplay, /new PaneXViewerPresentationCandidate/);
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
