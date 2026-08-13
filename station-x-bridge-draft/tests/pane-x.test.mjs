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
  assert.match(source, /const STATION_TICK_INTERVAL_MS = 100;/);
  assert.match(source, /if \(REMOTE_MODE \|\| stationTickFrame \|\| document\.visibilityState !== "visible"\) return;/);
  assert.match(source, /if \(viewerClockOwner\) \{/);
  assert.match(source, /window\.__SCINTILLA_X_CADENCE/);
});

test("a newer crop waits for two decoded viewer frames and stale crops cannot win", () => {
  const cropGenerationFor = functionFromSource("cropGenerationFor");
  const cropSequenceFor = functionFromSource("cropSequenceFor");
  const receive = functionFromSource("receiveViewerCropState", { cropGenerationFor, cropSequenceFor, Object });
  const advance = functionFromSource("advanceViewerCropState", { Object });
  let state = { confirmedCrop:null, confirmedGeneration:0, confirmedSequence:0,
    pendingCrop:null, videoFrames:0, receivedGeneration:0, pendingDrops:0, staleDrops:0 };
  const initial = { sequence:1, rect:{ top:10 }, fractionalScrollOffset:.9 };
  state = receive(state, initial);
  assert.equal(state.confirmedCrop, initial, "initial ungated crop is available for first paint");

  const firstBoundary = { captureGeneration:1, sequence:2, rect:{ top:10 }, fractionalScrollOffset:.2 };
  state = receive(state, firstBoundary);
  assert.equal(state.confirmedCrop, initial, "old video continues using the old crop before the frame barrier");
  state = advance(state);
  assert.equal(state.confirmedCrop, initial, "one decoded frame is not enough to advance the crop");

  const newerBoundary = { captureGeneration:2, sequence:3, rect:{ top:10 }, fractionalScrollOffset:.5 };
  state = receive(state, newerBoundary);
  assert.equal(state.pendingDrops, 1, "a superseded pending generation is dropped");
  state = advance(state);
  assert.equal(state.confirmedCrop, initial, "a new generation resets the two-frame barrier");
  state = advance(state);
  assert.equal(state.confirmedGeneration, 2);
  assert.equal(state.confirmedCrop, newerBoundary, "only the newest generation is promoted");

  const sameGenerationReflow = { captureGeneration:2, sequence:4, rect:{ top:11 }, fractionalScrollOffset:.3 };
  state = receive(state, sameGenerationReflow);
  assert.equal(state.confirmedCrop, newerBoundary,
    "a newer geometry crop inside an already confirmed generation stays behind the viewer-frame barrier");
  state = advance(state);
  assert.equal(state.confirmedCrop, newerBoundary, "one decoded frame still holds the prior crop");
  state = advance(state);
  assert.equal(state.confirmedCrop, sameGenerationReflow,
    "two decoded frames promote the newer same-generation crop safely");

  state = receive(state, { captureGeneration:1, sequence:99, rect:{ top:10 } });
  assert.equal(state.confirmedGeneration, 2);
  assert.equal(state.staleDrops, 1, "a late old generation cannot replace the visible crop");
});

test("only same-capture fractional crop motion eases between confirmed viewer frames", () => {
  const generation = functionFromSource("cropGenerationFor");
  const offset = functionFromSource("cropOffsetFor");
  const canEase = functionFromSource("cropsCanEase", { cropGenerationFor:generation, cropOffsetFor:offset, Math });
  const atMotion = functionFromSource("cropAtMotion", { cropOffsetFor:offset, Math, Object });
  const begin = functionFromSource("beginCropMotion", { cropAtMotion:atMotion, cropsCanEase:canEase, VIEWER_CROP_EASE_MS:72 });
  const prior = { captureGeneration:7, rect:{ left:1, top:2, width:3, height:4 }, fractionalScrollOffset:.1 };
  const next = { captureGeneration:7, rect:{ left:1, top:2, width:3, height:4 }, fractionalScrollOffset:.4 };
  const motion = begin(null, prior, 0);
  const eased = begin(motion, next, 10);
  assert.equal(atMotion(eased, 10).fractionalScrollOffset, .1, "easing starts from the exact visible crop");
  assert.ok(atMotion(eased, 46).fractionalScrollOffset > .1 && atMotion(eased, 46).fractionalScrollOffset < .4,
    "a confirmed sub-pixel move has an in-between visual position");
  assert.equal(atMotion(eased, 82).fractionalScrollOffset, .4);
  const boundary = Object.assign({}, next, { captureGeneration:8, fractionalScrollOffset:.05 });
  assert.equal(begin(eased, boundary, 20).duration, 0,
    "a capture-generation boundary is never interpolated across frames");
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
  assert.match(source, /const STATION_TICK_INTERVAL_MS = 100;/);
  assert.match(source, /const VIEWER_PAINT_INTERVAL_MS = 80;/);
  assert.match(source, /const VIEWER_MOTION_PAINT_INTERVAL_MS = 40;/,
    "only already-confirmed sub-pixel crop motion gets a lighter temporary paint cadence");
  assert.match(source, /function receiveViewerCrop\(crop\)/);
  assert.match(source, /function noteViewerVideoFrame\(\)/);
  assert.match(source, /function observeViewerVideoFrames\(video, mediaStream, onFrame\)/);
  assert.match(source, /typeof video\?\.requestVideoFrameCallback === "function"/,
    "rVFC remains the preferred decoded-frame path");
  assert.match(source, /video\.addEventListener\("timeupdate", onTimeUpdate\)/,
    "only unsupported rVFC gets the conservative media-time fallback");
  assert.match(source, /if \(stopViewerFrameObserver\) stopViewerFrameObserver\(\);/,
    "direct and remote stream teardown clean up the observer");
  assert.match(source, /promoteAtVideoFrame:\(current\.videoFrames \|\| 0\) \+ 2/);
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
