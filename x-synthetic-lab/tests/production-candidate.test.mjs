import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { PaneXViewerPresentationCandidate } from "../pane-x-viewer-candidate.mjs";
import { buildPaneXCandidate, productionFileSummary } from "../production-candidate/build-pane-x-candidate.mjs";

const labRoot = new URL("../", import.meta.url);
const stableIndex = await readFile(new URL("../pane-x/index.html", labRoot), "utf8");
const canonicalCore = await readFile(new URL("pane-x-presentation-core.js", labRoot), "utf8");
const candidateFiles = buildPaneXCandidate(stableIndex, canonicalCore);
const candidateIndex = candidateFiles.get("pane-x/index.html");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} must have a closing brace`);
}

function count(source, token) {
  return source.split(token).length - 1;
}

function crop(offset, { generation = 4, sequence = 1, scrollTop = 100, paused = false } = {}) {
  return {
    captureGeneration:generation,
    sequence,
    paused,
    sourceScroll:{ scrollTop },
    fractionalScrollOffset:offset,
    rect:{ left:1, top:2, width:300, height:500 }
  };
}

function realPaneHarness(initialCrop = null) {
  const sandbox = {
    Boolean,
    Math,
    Object,
    PaneXViewerPresentationCandidate,
    VIEWER_CROP_EASE_MS:120,
    document:{ visibilityState:"visible" },
    performance:{ now:() => 0 },
    stationHoverInside:false,
    viewerCropPresentation:null,
    viewerCropPresentationCrop:null,
    viewerCropPresentationSequence:0,
    viewerCropState:{ confirmedCrop:initialCrop },
    xfloatCrop:null
  };
  const names = [
    "cropGenerationFor",
    "cropOffsetFor",
    "cropSourceScrollTop",
    "cropVisualPositionFor",
    "cropsCanEase",
    "stopViewerCropPresentation",
    "startViewerCropPresentation",
    "setViewerPresentationPause",
    "syncViewerConfirmedCrop"
  ];
  const declarations = names.map(name => functionSource(candidateIndex, name)).join("\n");
  vm.runInNewContext(`${declarations}\nglobalThis.realPane = { stopViewerCropPresentation, setViewerPresentationPause, syncViewerConfirmedCrop };`, sandbox);
  return sandbox;
}

test("candidate names exactly two production files and leaves stable files unapplied", () => {
  assert.deepEqual([...candidateFiles.keys()], [
    "pane-x/index.html",
    "pane-x/pane-x-presentation-core.js"
  ]);
  assert.deepEqual(productionFileSummary.map(item => item.file), [...candidateFiles.keys()].reverse());
  assert.notEqual(candidateIndex, stableIndex, "the proposed index differs only in the generated candidate");
  assert.equal(candidateFiles.get("pane-x/pane-x-presentation-core.js"), canonicalCore,
    "the proposed production core is byte-identical to the tested lab core");
});

test("real-pane candidate commits delivered endpoints exactly and never overshoots", () => {
  const first = crop(.1);
  const pane = realPaneHarness(first);
  pane.realPane.syncViewerConfirmedCrop(0);
  assert.ok(Math.abs(pane.xfloatCrop.fractionalScrollOffset - .1) < 1e-9);

  pane.viewerCropState.confirmedCrop = crop(.4, { sequence:2 });
  pane.realPane.syncViewerConfirmedCrop(100);
  assert.ok(Math.abs(pane.xfloatCrop.fractionalScrollOffset - .1) < 1e-9,
    "the prior delivered endpoint is rendered exactly at replacement");
  pane.realPane.syncViewerConfirmedCrop(10_000);
  assert.ok(Math.abs(pane.xfloatCrop.fractionalScrollOffset - .4) < 1e-9,
    "the newest delivered endpoint is exact at completion");

  pane.viewerCropState.confirmedCrop = crop(.7, { sequence:3 });
  pane.realPane.syncViewerConfirmedCrop(10_100);
  assert.ok(Math.abs(pane.xfloatCrop.fractionalScrollOffset - .4) < 1e-9);
  pane.realPane.syncViewerConfirmedCrop(10_160);
  assert.ok(pane.xfloatCrop.fractionalScrollOffset >= .4 && pane.xfloatCrop.fractionalScrollOffset <= .7,
    "every presentation frame stays between delivered positions");
  assert.equal(pane.viewerCropPresentation.snapshot().maximumEndpointError, 0);
});

test("real-pane hidden, hover, and manual holds freeze presentation and newest delivery wins", () => {
  const pane = realPaneHarness(crop(.1));
  pane.realPane.syncViewerConfirmedCrop(0);
  pane.realPane.setViewerPresentationPause("hidden", true, 10);
  const frozen = pane.xfloatCrop.fractionalScrollOffset;
  pane.viewerCropState.confirmedCrop = crop(.4, { sequence:2 });
  pane.realPane.syncViewerConfirmedCrop(100);
  pane.viewerCropState.confirmedCrop = crop(.8, { sequence:3 });
  pane.realPane.syncViewerConfirmedCrop(200);
  assert.equal(pane.xfloatCrop.fractionalScrollOffset, frozen);
  assert.ok(Math.abs(pane.viewerCropPresentation.snapshot().target - 100.8) < 1e-9,
    "only the newest hidden delivery remains pending");

  pane.realPane.setViewerPresentationPause("hover", true, 210);
  pane.realPane.setViewerPresentationPause("hidden", false, 220);
  pane.realPane.syncViewerConfirmedCrop(260);
  assert.equal(pane.xfloatCrop.fractionalScrollOffset, frozen,
    "a second named hold prevents premature resume");
  pane.realPane.setViewerPresentationPause("hover", false, 280);
  pane.realPane.syncViewerConfirmedCrop(340);
  assert.ok(pane.xfloatCrop.fractionalScrollOffset > frozen && pane.xfloatCrop.fractionalScrollOffset < .8);

  pane.viewerCropState.confirmedCrop = crop(.9, { sequence:4, paused:true });
  pane.realPane.syncViewerConfirmedCrop(400);
  const manualFrozen = pane.xfloatCrop.fractionalScrollOffset;
  pane.realPane.syncViewerConfirmedCrop(460);
  assert.equal(pane.xfloatCrop.fractionalScrollOffset, manualFrozen);
  pane.viewerCropState.confirmedCrop = crop(1, { sequence:5, paused:false });
  pane.realPane.syncViewerConfirmedCrop(520);
  assert.equal(pane.viewerCropPresentation.snapshot().paused, false);
});

test("real-pane presentation stops inertly and restarts cleanly", () => {
  const pane = realPaneHarness(crop(.2));
  pane.realPane.syncViewerConfirmedCrop(0);
  const firstPresentation = pane.viewerCropPresentation;
  pane.realPane.stopViewerCropPresentation(20);
  assert.equal(pane.viewerCropPresentation, null);
  assert.equal(firstPresentation.snapshot().running, false);

  pane.viewerCropState.confirmedCrop = crop(.6, { generation:5, sequence:2, scrollTop:101 });
  pane.realPane.syncViewerConfirmedCrop(100);
  assert.notEqual(pane.viewerCropPresentation, firstPresentation);
  assert.equal(pane.viewerCropPresentation.snapshot().running, true);
  assert.ok(Math.abs(pane.xfloatCrop.fractionalScrollOffset - .6) < 1e-9);
  assert.equal(pane.viewerCropPresentation.snapshot().latestSequence, -1);
});

test("candidate preserves existing 10Hz fallback, 12.5fps idle paint, and all authority paths", () => {
  for (const literal of [
    "const VIEWER_PAINT_INTERVAL_MS = 80;",
    "const VIEWER_MOTION_PAINT_INTERVAL_MS = 16;",
    "const STATION_TICK_INTERVAL_MS = 16;",
    "const VIEWER_CROP_EASE_MS = 120;",
    "minFrameRate: 10, maxFrameRate: 60"
  ]) {
    assert.equal(count(candidateIndex, literal), count(stableIndex, literal), `${literal} remains unchanged`);
  }

  for (const name of [
    "receiveViewerCropState",
    "advanceViewerCropState",
    "boundedViewerCropY",
    "startStationClock",
    "startXFloat",
    "needsDirectStationReconnect",
    "scheduleDirectStationReconnect"
  ]) assert.equal(functionSource(candidateIndex, name), functionSource(stableIndex, name), `${name} is byte-for-byte unchanged`);

  for (const authorityToken of [
    `postXFloat("tick"`,
    `postXFloat("pause"`,
    "getUserMedia",
    "getDisplayMedia",
    "RTCPeerConnection",
    "BroadcastChannel",
    "stationRealtimeRoom",
    "boundedViewerCropY"
  ]) assert.equal(count(candidateIndex, authorityToken), count(stableIndex, authorityToken), `${authorityToken} authority count is unchanged`);
});
