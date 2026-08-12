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
