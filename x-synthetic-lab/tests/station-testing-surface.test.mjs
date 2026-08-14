import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildStationXReplayIndex, testingSurfaceFiles } from "../station-testing-surface-handoff/build-station-x-replay.mjs";

const labRoot = new URL("../", import.meta.url);
const stableIndex = await readFile(new URL("../pane-x/index.html", labRoot), "utf8");
const core = await readFile(new URL("pane-x-presentation-core.js", labRoot), "utf8");
const runtime = await readFile(new URL("station-testing-surface-handoff/pane-x-test-replay.js", labRoot), "utf8");
const cropMotion = await readFile(new URL("station-testing-surface-handoff/fixtures/x-crop-motion.js", labRoot), "utf8");
const fixture = await readFile(new URL("station-testing-surface-handoff/fixtures/x-feed-static.svg", labRoot), "utf8");
const replayIndex = buildStationXReplayIndex(stableIndex);

test("testing twin preserves real pane-X markup, canvas, and responsive geometry", () => {
  for (const exact of [
    'id="bar"',
    'id="body"',
    '<canvas id="cv"></canvas>',
    '#body{ flex:1 1 0; min-height:0; position:relative; background:#000; overflow:hidden; }',
    '#cv{ position:absolute; inset:0; width:100%; height:100%; display:none; background:#000; }',
    'html[data-view="desk"] .btn',
    'html[data-view="ipad"] .btn',
    'html[data-view="compact"] .btn'
  ]) {
    assert.match(stableIndex, new RegExp(exact.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(replayIndex, new RegExp(exact.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(replayIndex, /SCINTILLA · X pane · TEST REPLAY/);
  assert.match(replayIndex, /#testReplayBadge/);
  assert.match(replayIndex, /#testReplayTelemetry/);
});

test("testing twin replaces the complete production runtime with three local scripts", () => {
  assert.equal((replayIndex.match(/<script/g) || []).length, 3);
  assert.match(replayIndex, /<script src="\.\/pane-x-presentation-core\.js"><\/script>/);
  assert.match(replayIndex, /<script src="\.\/fixtures\/x-crop-motion\.js"><\/script>/);
  assert.match(replayIndex, /<script src="\.\/pane-x-test-replay\.js"><\/script>/);
  assert.doesNotMatch(replayIndex, /<script>\s*"use strict"/);
  assert.match(replayIndex, /local, read-only fixture/);
});

test("testing surface has no live-source, transport, controller, pairing, or external network capability", () => {
  const executableSurface = `${replayIndex}\n${runtime}\n${cropMotion}`;
  const forbidden = [
    "getUserMedia",
    "getDisplayMedia",
    "RTCPeerConnection",
    "WebSocket",
    "BroadcastChannel",
    "EventSource",
    "XMLHttpRequest",
    "navigator.mediaDevices",
    "postMessage",
    "stationRealtimeRoom",
    "supabase",
    "chrome.",
    "x.com",
    "twitter.com",
    "pair=",
    "XFF_STATION",
    "fetch("
  ];
  for (const token of forbidden) assert.equal(executableSurface.includes(token), false, `forbidden testing-surface capability: ${token}`);
  assert.match(runtime, /authority:"NONE"/);
  assert.match(runtime, /fixture\.src = "\.\/fixtures\/x-feed-static\.svg"/);
});

test("testing surface exposes an obvious OFF/ON comparison and fixed 60-second proof", () => {
  assert.match(runtime, /offButton\.textContent = "SMOOTHING OFF"/);
  assert.match(runtime, /onButton\.textContent = "SMOOTHING ON"/);
  assert.match(runtime, /const RUN_MS = CROP_MOTION\.durationMs/);
  assert.match(runtime, /const DELIVERY_MS = CROP_MOTION\.deliveryMs/);
  assert.match(runtime, /const PRESENTATION_MS = 120/);
  assert.match(runtime, /const delivered = CROP_MOTION\.samples\[deliveries \+ 1\]/);
  assert.match(cropMotion, /const deliveryMs = 100/);
  assert.match(cropMotion, /const durationMs = 60_000/);
  assert.match(cropMotion, /visualPosition:index \* deliveredStepPx/);
  assert.match(runtime, /maximumRawFrameGap/);
  assert.match(runtime, /maximumSmoothFrameGap/);
  assert.match(runtime, /maximumEndpointError/);
  assert.match(runtime, /overshootCount/);
  assert.match(runtime, /verdict:complete \? \(proofReady \? "PASS" : "CHECK"\)/);
});

test("testing surface preserves named manual, hover, and hidden presentation pauses", () => {
  assert.match(runtime, /setPaused\("manual"/);
  assert.match(runtime, /setPaused\("hover"/);
  assert.match(runtime, /setPaused\("hidden"/);
  assert.match(runtime, /host\.addEventListener\("pointerenter"/);
  assert.match(runtime, /host\.addEventListener\("pointerleave"/);
  assert.match(runtime, /document\.addEventListener\("visibilitychange"/);
  assert.match(runtime, /pauseButton\.addEventListener\("click"/);
});

test("testing surface reuses the canonical tested core and packages only the declared files", () => {
  assert.deepEqual(testingSurfaceFiles, [
    "pane-x/index.html",
    "pane-x/pane-x-presentation-core.js",
    "pane-x/fixtures/x-crop-motion.js",
    "pane-x/pane-x-test-replay.js",
    "pane-x/fixtures/x-feed-static.svg"
  ]);
  assert.match(core, /Commit the prior delivered target exactly before replacing it/);
  assert.match(core, /Math\.max\(low, Math\.min\(high, interpolated\)\)/);
  assert.equal((fixture.match(/class="name"/g) || []).length >= 20, true);
  assert.match(fixture, /STATIC REPLAY FIXTURE/);
  assert.match(fixture, /FICTIONAL ACCOUNTS/);
  assert.doesNotMatch(fixture, /(?:href|src)=["']https?:\/\//,
    "the SVG namespace is allowed, but the fixture loads no external asset");
});
