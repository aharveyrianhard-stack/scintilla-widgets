import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const deck = read("deck/index.html");
const testingRuntime = read("testing-surface.js");
const ipad = read("station-ipad/index.html");
const liveTestRoute = read("station-live-test/index.html");
const ipadLiveTestRoute = read("station-ipad-live-test/index.html");
const paneX = read("pane-x-replay/index.html");
const paneXCore = read("pane-x-replay/pane-x-presentation-core.js");
const paneXReplay = read("pane-x-replay/pane-x-test-replay.js");
const paneXMotion = read("pane-x-replay/fixtures/x-crop-motion.js");
const paneXFixture = read("pane-x-replay/fixtures/x-feed-static.svg");
const paneXLiveTest = read("pane-x-live-test/index.html");
const paneXLiveTestCore = read("pane-x-live-test/pane-x-presentation-core.js");
const vercel = read("vercel.json");
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
  assert.match(deck, /id="testingXReplay" href="\/deck\/\?x=replay">REJECTED ENGINEERING REPLAY/);
  assert.match(deck, /id="testingXLive" href="\/deck\/" aria-current="page">LIVE TEST/);
  assert.match(deck, /id="testingXState" class="testing-disconnected">LIVE TEST · DISCONNECTED/);
  assert.match(deck, /id="testingIpadLink" href="\/station-ipad\/">testing iPad · live-test/);
});

test("the testing wall keeps market freshness status live without the canonical scope error", () => {
  assert.match(deck, /function paintMarketStatus\(\) \{[\s\S]*?const delayed = visible\.filter/);
  assert.match(deck, /const fresh = ageSec < 90 && !delayed\.length/);
  assert.doesNotMatch(deck, /const delayed = summary\.mode === "delayed"/);
});

test("testing iPad route mounts the same iPad wall without reading or writing the durable pair", () => {
  assert.match(ipad, /if\(testing\)\{const replay=new URLSearchParams\(location\.search\)\.get\("x"\)==="replay"/);
  assert.match(ipad, /"TESTING iPad LIVE TEST · NOT STABLE"/);
  assert.match(ipad, /deck\.src="\/deck\/\?view=ipad&x="\+\(replay\?"replay":"live-test"\)/);
  assert.match(ipad, /else\{let pairHash=/,
    "the durable pair logic remains isolated behind the non-testing branch");
  const testingBranch = ipad.slice(ipad.indexOf("if(testing)"), ipad.indexOf("else{let pairHash="));
  assert.doesNotMatch(testingBranch, /localStorage|ipadPair|ipadCode|pairHash/);
});

test("LIVE TEST is the canonical testing default while rejected replay stays explicit and byte-unchanged", () => {
  assert.match(deck, /window\.ScintillaTestingSurface\?\.active\s*\? \(QS\.get\("x"\) === "replay" \? "replay" : "live-test"\)\s*: "replay"/);
  assert.match(deck, /const TEST_X_LIVE = TEST_X_MODE === "live-test"/);
  assert.match(deck, /"TESTING STATION LIVE TEST · NOT STABLE"/);
  assert.match(deck, /el\(TEST_X_LIVE \? "testingXLive" : "testingXReplay"\)\.setAttribute\("aria-current", "page"\)/);
  assert.match(deck, /el\("testingXState"\)\.hidden = false/);
  assert.match(deck, /\? "LIVE TEST · DISCONNECTED"\s*: "ENGINEERING REPLAY · NOT HUMAN-APPROVED"/);
  assert.match(deck, /"X · ENGINEERING REPLAY · NOT HUMAN-APPROVED"/);
  assert.match(deck, /"ZERO APPROVED · AWAIT TEST BRIDGE"/);
  assert.match(deck, /verdict\.textContent = "ENGINEERING REPLAY · NOT HUMAN-APPROVED"/);
  assert.match(deck, /\.testing-x-review-verdict\{ position:absolute; z-index:20;[\s\S]*?bottom:8px/,
    "the testing shell covers the fixture's engineering PASS token with the human verdict");
  assert.match(deck, /const STATION_X_MODE_QUERY = [^;]+\? "&mode=live-test&x-test=1" : ""/);
  assert.match(deck, /X · LIVE TEST · DISCONNECTED/);
  assert.match(deck, /TEST BRIDGE NOT INSTALLED/);
  assert.match(deck, /TEST_X_LIVE \? "\/station-ipad\/" : "\/station-ipad\/\?x=replay"/);
  assert.match(liveTestRoute, /<iframe src="\/deck\/\?x=live-test"/);
  assert.match(ipadLiveTestRoute, /<iframe src="\/deck\/\?view=ipad&amp;x=live-test"/);
  assert.doesNotMatch(liveTestRoute, /localStorage|sessionStorage|ipadPair|ipadCode|pairHash/);
  assert.doesNotMatch(ipadLiveTestRoute, /localStorage|sessionStorage|ipadPair|ipadCode|pairHash/);
  assert.match(vercel, /"source": "\/pane-x\/"[\s\S]*?"type": "query"[\s\S]*?"key": "mode"[\s\S]*?"value": "live-test"[\s\S]*?"destination": "\/pane-x-live-test\/index\.html"/);
  assert.match(vercel, /"source": "\/pane-x\/",\s*"destination": "\/pane-x-replay\/index\.html"/);
  assert.match(vercel, /"source": "\/pane-x\/:path\*",\s*"destination": "\/pane-x-replay\/:path\*"/);
  assert.equal(fs.existsSync(new URL("../pane-x/", import.meta.url)), false,
    "the public pane path must stay virtual so conditional rewrites run before the filesystem");
});

test("the rejected testing X replay remains static with no Bridge, transport, pair, controller, or tick authority", () => {
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

test("the real LIVE TEST receiver is byte-exact, test-namespaced, and fail-closed until isolated lab frames arrive", () => {
  const digest = (source) => crypto.createHash("sha256").update(source).digest("hex");
  assert.equal(digest(paneXLiveTest), "b316cee0be1dc75d514cac0fb87cab18f224f07640650f73f6b3d8c96e2f78d2");
  assert.equal(digest(paneXLiveTestCore), "e3863b888f74a2c81ba9fa3c5c2b1c44f05c72dc9d304b8dc38f775248c48fa3");
  assert.match(paneXLiveTest, /SCINTILLA · X TEST receiver/);
  assert.match(paneXLiveTest, /source <b id="xTestSource" data-state="offline">NOT ATTACHED<\/b>/);
  assert.match(paneXLiveTest, /NO_TEST_SOURCE_APPROVED/);
  assert.match(paneXLiveTest, /const XTEST_ALLOWED_HOST = "scintilla-station-testing-surface\.vercel\.app"/);
  assert.match(paneXLiveTest, /XTEST_STATION_BRIDGE_READY/);
  assert.match(paneXLiveTest, /scintilla\.testing\.station\.x-test\.controller\.v1/);
  assert.match(paneXLiveTest, /scintilla\.testing\.station\.x-test\.trusted-ipad\.v1/);
  assert.match(paneXLiveTest, /realtime:station-x-test-ipad:/);
  for (const forbidden of [
    "XFF_", "station.scintillahub.ai", "scintilla.station.remote-viewer.v1.",
    "scintilla.station.x-clock.v1", "scintilla.station.trusted-ipad.v1", "realtime:station-ipad:"
  ]) assert.equal(paneXLiveTest.includes(forbidden), false, `forbidden stable receiver identity: ${forbidden}`);
  assert.equal(fs.existsSync(new URL("../scintilla-station-x-test-bridge/", import.meta.url)), false,
    "the extension package must not be copied into the Station testing project");
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
