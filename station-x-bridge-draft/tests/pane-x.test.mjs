import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../../pane-x/index.html", import.meta.url), "utf8");

function functionFromSource(name, context = {}) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  let end = -1;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) { end = index + 1; break; }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, context);
}

test("a paired viewer keeps its identity through a browser-session reload", () => {
  const stableViewerId = functionFromSource("stableRemoteViewerId");
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  let creates = 0;
  const pair = "a".repeat(32);
  const first = stableViewerId(pair, storage, () => { creates += 1; return "b".repeat(24); });
  const afterReload = stableViewerId(pair, storage, () => { creates += 1; return "c".repeat(24); });
  assert.equal(first, "b".repeat(24));
  assert.equal(afterReload, first);
  assert.equal(creates, 1);
});

test("visible direct viewers elect exactly one stable scroll-clock owner", () => {
  const clockOwnerFor = functionFromSource("clockOwnerFor", { VIEWER_CLOCK_STALE_MS:2600 });
  const now = 50_000;
  const peers = new Map([
    ["b".repeat(24), { visible:true, seenAt:now }],
    ["c".repeat(24), { visible:false, seenAt:now }],
    ["d".repeat(24), { visible:true, seenAt:now - 2601 }]
  ]);
  const self = "a".repeat(24);
  assert.equal(clockOwnerFor(self, peers, now), self, "the deterministic first visible viewer owns the tick");
  peers.set(self, { visible:false, seenAt:now });
  assert.equal(clockOwnerFor(self, peers, now, false), "b".repeat(24), "a hidden viewer yields to a live mirror");
});

test("viewer cadence is capped locally while remote iPad viewers never drive source ticks", () => {
  assert.match(source, /const VIEWER_PAINT_INTERVAL_MS = 80;/);
  assert.match(source, /const STATION_TICK_INTERVAL_MS = 16;/);
  assert.match(source, /if \(REMOTE_MODE \|\| stationTickFrame \|\| document\.visibilityState !== "visible"\) return;/);
  assert.match(source, /if \(viewerClockOwner\) \{/);
  assert.match(source, /window\.__SCINTILLA_X_CADENCE/);
});

test("Station pane hover renews a short pause lease and releases it on leave or focus loss", () => {
  assert.match(source, /function setStationHoverPause\(held\)/);
  assert.match(source, /postXFloat\("pause", stationHoverInside\)/);
  assert.match(source, /stationHoverPausePulse = setInterval\([\s\S]{0,220}postXFloat\("pause", true\)/);
  assert.match(source, /pointerleave[\s\S]{0,120}setStationHoverPause\(false\)/);
  assert.match(source, /window\.addEventListener\("blur", \(\) => setStationHoverPause\(false\)\)/);
  assert.match(source, /document\.visibilityState !== "visible"\) setStationHoverPause\(false\)/);
  assert.match(source, /function stopXFloat\(\{ notify = true \} = \{\}\) \{[\s\S]{0,100}setStationHoverPause\(false\)/);
});

test("a direct viewer whose media stream ends re-requests only its own peer", () => {
  const reconnectNeeded = functionFromSource("needsDirectStationReconnect");
  assert.equal(reconnectNeeded({ remoteMode:false, pageVisible:true, streamActive:false, alreadyScheduled:false }), true);
  assert.equal(reconnectNeeded({ remoteMode:true, pageVisible:true, streamActive:false, alreadyScheduled:false }), false,
    "the paired iPad keeps its independent receiver lifecycle");
  assert.equal(reconnectNeeded({ remoteMode:false, pageVisible:false, streamActive:false, alreadyScheduled:false }), false);
  assert.equal(reconnectNeeded({ remoteMode:false, pageVisible:true, streamActive:true, alreadyScheduled:false }), false);
  assert.equal(reconnectNeeded({ remoteMode:false, pageVisible:true, streamActive:false, alreadyScheduled:true }), false,
    "one loss schedules one recovery rather than a reconnect storm");
  assert.match(source, /type:"XFF_STATION_RECONNECT_VIEWER"/);
  assert.match(source, /connectionstatechange[\s\S]{0,260}scheduleDirectStationReconnect/);
  assert.match(source, /getVideoTracks\(\)\[0\][\s\S]{0,340}scheduleDirectStationReconnect/);
  assert.match(source, /if \(xfloatStream\?\.active\) el\("xfState"\)\.textContent = paused \? "paused" : "live";/,
    "crop heartbeats cannot falsely mark a dead receiver as live");
});

test("crop broadcasts preserve one canvas animation loop", () => {
  const context = { xfloatFrame:0, drawXFloat:() => {}, requestVideoFrameCallback:undefined };
  let scheduled = 0;
  context.requestAnimationFrame = () => { scheduled += 1; return 91; };
  const ensure = functionFromSource("ensureXFloatDraw", context);
  ensure(); ensure(); ensure();
  assert.equal(scheduled, 1, "several crop arrivals share one scheduled canvas draw");
  assert.equal(context.xfloatFrame, 91);
});

test("viewer crop never leaves a black lower block when the requested crop reaches the capture edge", () => {
  const boundedCropY = functionFromSource("boundedViewerCropY");
  assert.equal(boundedCropY(540, 200, 600), 400,
    "the source window slides up just enough to keep all 200 pixels inside the decoded frame");
  assert.equal(boundedCropY(42, 200, 600), 42,
    "a normal in-frame crop is unchanged");
  assert.equal(boundedCropY(-5, 200, 600), 0,
    "a negative requested crop is held at the first decoded row");
  assert.match(source, /const sy = boundedViewerCropY\(requestedY, requiredSourceHeight, video\.videoHeight\);/);
  const availableBeforeGuard = source.indexOf("const availableAtRequestedY = Math.max(0, video.videoHeight - requestedY);");
  const drawGuard = source.indexOf("if (sw > 1 && availableAtRequestedY > 1)");
  assert.ok(availableBeforeGuard >= 0 && availableBeforeGuard < drawGuard,
    "the draw guard cannot reference a crop-height value before it is initialized");
});

test("a newer crop waits for one decoded viewer frame and stale crops cannot win", () => {
  const cropGenerationFor = functionFromSource("cropGenerationFor");
  const cropSequenceFor = functionFromSource("cropSequenceFor");
  const cropSourceScrollTop = functionFromSource("cropSourceScrollTop");
  const cropsShareSourceFrame = functionFromSource("cropsShareSourceFrame", { cropSourceScrollTop });
  const receive = functionFromSource("receiveViewerCropState", { cropGenerationFor, cropSequenceFor, cropsShareSourceFrame, Object });
  const advance = functionFromSource("advanceViewerCropState", { Object });
  let state = { confirmedCrop:null, confirmedGeneration:0, confirmedSequence:0,
    pendingCrop:null, videoFrames:0, receivedGeneration:0, pendingDrops:0, staleDrops:0 };
  const initial = { sequence:1, rect:{ top:10 }, fractionalScrollOffset:.9 };
  state = receive(state, initial);
  assert.equal(state.confirmedCrop, initial, "initial ungated crop is available for first paint");

  const firstBoundary = { captureGeneration:1, sequence:2, rect:{ top:10 }, fractionalScrollOffset:.2 };
  state = receive(state, firstBoundary);
  assert.equal(state.confirmedCrop, initial, "old video continues using the old crop before the frame barrier");

  const newerBoundary = { captureGeneration:2, sequence:3, rect:{ top:10 }, fractionalScrollOffset:.5 };
  state = receive(state, newerBoundary);
  assert.equal(state.pendingDrops, 1, "a superseded pending generation is dropped");
  state = advance(state);
  assert.equal(state.confirmedGeneration, 2);
  assert.equal(state.confirmedCrop, newerBoundary, "only the newest generation is promoted");

  const sameFrameFraction = { captureGeneration:2, sequence:4, rect:{ top:10 }, sourceScroll:{ scrollTop:0 }, fractionalScrollOffset:.6 };
  state = receive(state, sameFrameFraction);
  assert.equal(state.confirmedCrop, sameFrameFraction,
    "a pure fractional carry on the identical captured frame is immediately available for smooth interpolation");
  assert.equal(state.pendingCrop, null,
    "fractional motion does not wait behind an unnecessary decoded-frame gate");

  const sameGenerationReflow = { captureGeneration:2, sequence:5, rect:{ top:11 }, fractionalScrollOffset:.3 };
  state = receive(state, sameGenerationReflow);
  assert.equal(state.confirmedCrop, sameFrameFraction,
    "a newer geometry crop inside an already confirmed generation stays behind the viewer-frame barrier");
  state = advance(state);
  assert.equal(state.confirmedCrop, sameGenerationReflow,
    "one decoded frame promotes the newer same-generation crop safely");

  state = receive(state, { captureGeneration:1, sequence:99, rect:{ top:10 } });
  assert.equal(state.confirmedGeneration, 2);
  assert.equal(state.staleDrops, 1, "a late old generation cannot replace the visible crop");
});

test("phase-aligned crop motion eases through an adjacent capture generation", () => {
  const generation = functionFromSource("cropGenerationFor");
  const offset = functionFromSource("cropOffsetFor");
  const sourceScroll = functionFromSource("cropSourceScrollTop");
  const visualPosition = functionFromSource("cropVisualPositionFor", { cropSourceScrollTop:sourceScroll, cropOffsetFor:offset });
  const phaseAligned = functionFromSource("cropPhaseAlignedFrom", { cropVisualPositionFor:visualPosition, cropSourceScrollTop:sourceScroll, Object });
  const canEase = functionFromSource("cropsCanEase", { cropGenerationFor:generation, cropVisualPositionFor:visualPosition, Math });
  const atMotion = functionFromSource("cropAtMotion", { cropOffsetFor:offset, Math, Object });
  const begin = functionFromSource("beginCropMotion", { cropAtMotion:atMotion, cropsCanEase:canEase, cropPhaseAlignedFrom:phaseAligned, VIEWER_CROP_EASE_MS:120 });
  const prior = { captureGeneration:7, rect:{ left:1, top:2, width:3, height:4 }, sourceScroll:{ scrollTop:100 }, fractionalScrollOffset:.1 };
  const next = { captureGeneration:7, rect:{ left:1, top:2, width:3, height:4 }, sourceScroll:{ scrollTop:100 }, fractionalScrollOffset:.4 };
  const motion = begin(null, prior, 0);
  const eased = begin(motion, next, 10);
  assert.ok(Math.abs(atMotion(eased, 10).fractionalScrollOffset - .1) < 1e-9,
    "easing starts from the exact visible crop");
  assert.ok(atMotion(eased, 18).fractionalScrollOffset > .1 && atMotion(eased, 18).fractionalScrollOffset < .4,
    "a confirmed sub-pixel move has an in-between visual position");
  assert.ok(atMotion(eased, 30).fractionalScrollOffset > .1 && atMotion(eased, 30).fractionalScrollOffset < .4,
    "the blend remains in motion through the following source tick");
  assert.ok(atMotion(eased, 40).fractionalScrollOffset > .1 && atMotion(eased, 40).fractionalScrollOffset < .4,
    "the blend stays at display cadence through a 10Hz source-crop gap");
  assert.equal(atMotion(eased, 130).fractionalScrollOffset, .4);
  const continual = begin(eased, Object.assign({}, next, { fractionalScrollOffset:.7 }), 30);
  const beforeRetarget = atMotion(eased, 30).fractionalScrollOffset;
  assert.ok(atMotion(continual, 35).fractionalScrollOffset > beforeRetarget && atMotion(continual, 35).fractionalScrollOffset < .7,
    "the next source crop starts from the still-moving visual position without a display-frame hold");
  const boundary = Object.assign({}, next, { captureGeneration:8, sourceScroll:{ scrollTop:101 }, fractionalScrollOffset:.05 });
  const boundaryMotion = begin(null, Object.assign({}, prior, { fractionalScrollOffset:.9 }), 0);
  const handoff = begin(boundaryMotion, boundary, 10);
  assert.ok(Math.abs(atMotion(handoff, 10).fractionalScrollOffset + .1) < 1e-9,
    "the new source frame starts at the prior visual position instead of jumping one physical source pixel");
  assert.ok(Math.abs(visualPosition(atMotion(handoff, 10)) - 100.9) < 1e-9,
    "the phase-aligned handoff preserves the exact visible coordinate");
  assert.ok(atMotion(handoff, 40).fractionalScrollOffset > -.1 && atMotion(handoff, 40).fractionalScrollOffset < .05,
    "the handoff remains smooth instead of collapsing to an idle-frame step");
  assert.equal(canEase(next, Object.assign({}, next, { rect:{ left:2, top:2, width:3, height:4 } })), false,
    "a reflowing crop rectangle remains exact rather than being blurred");
});

test("a viewer without rVFC advances the crop barrier on two real media-time updates", () => {
  const observe = functionFromSource("observeViewerVideoFrames", { Number });
  const listeners = new Map();
  const video = {
    srcObject:{ id:"stream" }, currentTime:0,
    addEventListener:(type, listener) => listeners.set(type, listener),
    removeEventListener:(type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); }
  };
  let frames = 0;
  const stop = observe(video, video.srcObject, () => { frames += 1; });
  assert.equal(listeners.size, 1, "unsupported rVFC installs one timeupdate fallback listener");
  listeners.get("timeupdate")();
  assert.equal(frames, 0, "unchanged currentTime is not a decoded-frame signal");
  video.currentTime = .08; listeners.get("timeupdate")();
  assert.equal(frames, 1);
  video.currentTime = .16; listeners.get("timeupdate")();
  assert.equal(frames, 2, "two true media-time advances satisfy the same barrier");
  stop();
  assert.equal(listeners.size, 0, "disconnect removes the single fallback listener");
});

test("viewer crop barrier retains the existing one-owner clock and paint caps", () => {
  assert.match(source, /const STATION_TICK_INTERVAL_MS = 16;/);
  assert.match(source, /const VIEWER_PAINT_INTERVAL_MS = 80;/);
  assert.match(source, /const VIEWER_MOTION_PAINT_INTERVAL_MS = 16;/,
    "only already-confirmed sub-pixel crop motion uses display-rate canvas painting");
  assert.match(source, /const VIEWER_CROP_EASE_MS = 120;/,
    "a blend spans the 10Hz fallback crop gap instead of dropping to idle paint");
  assert.match(source, /function receiveViewerCrop\(crop\)/);
  assert.match(source, /function ensureXFloatDraw\(\)/,
    "crop messages schedule the existing canvas loop instead of spawning another one");
  assert.doesNotMatch(source, /payload\.event === "crop"[^\n]*drawXFloat\(\)/,
    "a remote crop cannot create a duplicate requestAnimationFrame chain");
  assert.match(source, /function noteViewerVideoFrame\(\)/);
  assert.match(source, /function observeViewerVideoFrames\(video, mediaStream, onFrame\)/);
  assert.match(source, /typeof video\?\.requestVideoFrameCallback === "function"/,
    "rVFC remains the preferred decoded-frame path");
  assert.match(source, /video\.addEventListener\("timeupdate", onTimeUpdate\)/,
    "only unsupported rVFC gets the conservative media-time fallback");
  assert.match(source, /if \(stopViewerFrameObserver\) stopViewerFrameObserver\(\);/,
    "direct and remote stream teardown clean up the observer");
  assert.match(source, /promoteAtVideoFrame:\(current\.videoFrames \|\| 0\) \+ 1/);
  assert.match(source, /function cropPhaseAlignedFrom\(from, to\)/,
    "the source-pixel handoff is phase-aligned rather than held as a visible jump");
});

test("the current paired-viewer path sends its stable viewer identity with offers", () => {
  assert.match(source, /viewerId:REMOTE_VIEWER/);
  assert.match(source, /const REMOTE_RECEIVER_GENERATION = createRemoteViewerId\(\)/);
  assert.match(source, /receiverGeneration:REMOTE_RECEIVER_GENERATION/);
  assert.match(source, /payload\.payload\?\.receiverGeneration === REMOTE_RECEIVER_GENERATION/);
  assert.match(source, /event:"drop", payload:\{ code:REMOTE_CODE, viewerId:REMOTE_VIEWER,\s*receiverGeneration:REMOTE_RECEIVER_GENERATION \}/);
});

test("the iMac pane buffers offers until one exact Bridge generation accepts them", () => {
  assert.match(source, /const stationPendingRemoteOffers = new Map\(\);/);
  assert.match(source, /function queueStationRemoteOffer\(pairId, viewerId, receiverGeneration, offer\)/);
  assert.match(source, /function flushStationRemoteOffers\(\)/);
  assert.match(source, /type === "XFF_STATION_BRIDGE_READY" && event\.data\.instanceId/);
  assert.match(source, /type === "XFF_STATION_BRIDGE_REANNOUNCING"/);
  assert.match(source, /String\(event\.data\.instanceId \|\| ""\) === stationBridgeInstanceId/);
  assert.match(source, /clearStationRemoteOffer\(event\.data\.pairId, event\.data\.viewerId, event\.data\.receiverGeneration\)/);
  assert.match(source, /flushStationRemoteOffers\(\);/);
});

test("the iMac pairing room renews its existing trusted pair after a Realtime disconnect", () => {
  assert.match(source, /let stationPairReconnect = null;/);
  assert.match(source, /function reconnectStationPairRoom\(pair\)/);
  assert.match(source, /socket\.addEventListener\("error", \(\) =>/);
  assert.match(source, /socket\.addEventListener\("close", disconnect\)/);
  assert.match(source, /pair\.room = stationRealtimeRoom\(pair, \(\) => reconnectStationPairRoom\(pair\)\)/);
  assert.match(source, /clearTimeout\(stationPairReconnect\); stationPairReconnect = null;/);
});

test("a silent open join times out, reconnects, and lets the next offer reach Bridge", () => {
  const sockets = [], timers = [], offers = [];
  class FakeWebSocket {
    static OPEN = 1;
    constructor(url) { this.url = url; this.readyState = FakeWebSocket.OPEN; this.sent = []; this.listeners = new Map(); sockets.push(this); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    send(message) { this.sent.push(JSON.parse(message)); }
    close() { this.closed = true; this.readyState = 3; }
    emit(type, event = {}) { this.listeners.get(type)?.(event); }
  }
  const pair = { token:"a".repeat(32), code:"123456" };
  let disconnects = 0;
  const room = functionFromSource("stationRealtimeRoom", {
    STATION_REALTIME_URL:"wss://station.test/socket/websocket",
    STATION_REALTIME_KEY:"test-key",
    STATION_JOIN_TIMEOUT_MS:5000,
    WebSocket:FakeWebSocket,
    stationPair:pair,
    el:() => ({ textContent:"" }),
    queueStationRemoteOffer:(pairId, viewerId, receiverGeneration, offer) => offers.push({ pairId, viewerId, receiverGeneration, offer }),
    clearStationRemoteOffer:() => {},
    window:{ postMessage:() => {} },
    location:{ origin:"https://station.test" },
    setTimeout:(fn, ms) => { const timer = { fn, ms, cleared:false }; timers.push(timer); return timer; },
    clearTimeout:(timer) => { if (timer) timer.cleared = true; }
  });
  room(pair, () => { disconnects += 1; });
  const first = sockets[0];
  first.emit("open");
  assert.equal(first.sent[0].event, "phx_join");
  assert.equal(timers[0].ms, 5000);
  timers[0].fn();
  assert.equal(first.closed, true, "an OPEN socket without phx_join acknowledgement is closed");
  assert.equal(disconnects, 1, "caller is told to rejoin the trusted room");

  room(pair, () => { disconnects += 1; });
  const second = sockets[1];
  second.emit("open");
  second.emit("message", { data:JSON.stringify({ event:"phx_reply", ref:"1", payload:{ status:"ok" } }) });
  second.emit("message", { data:JSON.stringify({ event:"broadcast", payload:{ event:"offer", payload:{
    code:pair.code, viewerId:"b".repeat(24), receiverGeneration:"c".repeat(24), offer:{ type:"offer", sdp:"test" }
  } } }) });
  assert.deepEqual(JSON.parse(JSON.stringify(offers)), [{ pairId:pair.token, viewerId:"b".repeat(24), receiverGeneration:"c".repeat(24), offer:{ type:"offer", sdp:"test" } }]);
});
