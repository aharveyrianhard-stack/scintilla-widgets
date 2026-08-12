import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../../pane-x/index.html", import.meta.url), "utf8");

function functionFromSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  let end = -1;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) { end = index + 1; break; }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`);
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
  assert.match(source, /event:"drop", payload:\{ code:REMOTE_CODE, viewerId:REMOTE_VIEWER \}/);
});

test("the iMac pane buffers offers until one exact Bridge generation accepts them", () => {
  assert.match(source, /const stationPendingRemoteOffers = new Map\(\);/);
  assert.match(source, /function queueStationRemoteOffer\(pairId, viewerId, offer\)/);
  assert.match(source, /function flushStationRemoteOffers\(\)/);
  assert.match(source, /type === "XFF_STATION_BRIDGE_READY" && event\.data\.instanceId/);
  assert.match(source, /type === "XFF_STATION_BRIDGE_REANNOUNCING"/);
  assert.match(source, /String\(event\.data\.instanceId \|\| ""\) === stationBridgeInstanceId/);
  assert.match(source, /clearStationRemoteOffer\(event\.data\.pairId, event\.data\.viewerId\)/);
});
