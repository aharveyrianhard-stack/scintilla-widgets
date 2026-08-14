import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../content.js", import.meta.url), "utf8");

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

test("Station hover observer pauses only inside the capture crop", () => {
  const inside = functionFromSource("pointerIsInsideStationCrop");
  const rect = { left: 100, top: 200, right: 500, bottom: 600 };
  assert.equal(inside({ clientX: 101, clientY: 201 }, rect), true);
  assert.equal(inside({ clientX: 500, clientY: 600 }, rect), true);
  assert.equal(inside({ clientX: 99, clientY: 300 }, rect), false);
  assert.equal(inside({ clientX: 250, clientY: 601 }, rect), false);
  assert.equal(inside({ clientX: undefined, clientY: 300 }, rect), false);
});

test("Station hover shield hands a second click back to native X interaction", () => {
  assert.match(source, /function installStationHoverShield\(\)/);
  assert.match(source, /shield\.addEventListener\("pointerdown", beginNativeInteraction, \{ once: true \}\)/);
  assert.match(source, /shield\.remove\(\);/);
  assert.match(source, /document\.addEventListener\("pointermove", exitObserver, true\)/);
  assert.match(source, /session\.stationHoverShield = null;[\s\S]{0,180}setPointerPause\(false\)/);
  assert.doesNotMatch(source, /beginNativeInteraction[\s\S]{0,900}(preventDefault|stopPropagation|stopImmediatePropagation|dispatchEvent)/);
});

test("Station source maintains and removes the hover shield with its capture lifecycle", () => {
  const start = source.slice(source.indexOf("async function startStationSource"));
  const stop = source.slice(source.indexOf("function stopStationSource"));
  assert.match(start, /installStationHoverShield\(\)/);
  assert.match(stop, /removeStationHoverShield\(\)/);
  assert.match(source, /document\.removeEventListener\("pointermove", shield\.exitObserver, true\)/);
});

test("a Station viewer hover pause is a renewable lease, never an indefinite source freeze", () => {
  const deadline = functionFromSource("nextStationViewerPauseDeadline");
  assert.equal(deadline(true, 1_000, 500), 1_500);
  assert.equal(deadline(false, 1_000, 500), 0);
  assert.match(source, /function stationViewerPauseActive\(now = Date\.now\(\)\)/);
  assert.match(source, /session\.stationViewerPauseUntil = nextStationViewerPauseDeadline\(Boolean\(held\)\)/);
  assert.match(source, /session\.stationViewerPauseUntil = 0;[\s\S]{0,180}applyCaptureColumnLayout\(\)/,
    "a reattached Station pane clears a stale hover lease before the current pane can renew it");
  const control = source.slice(source.indexOf("async function stationControl"), source.indexOf("function showError"));
  assert.match(control, /action === "pause"[\s\S]{0,100}setStationViewerPause\(Boolean\(value\)\)/);
});

test("Station keeps the original Float fractional phase through an integer source scroll", () => {
  const advance = functionFromSource("nextStationScrollState");
  const beforeBoundary = {
    carryPx: 0.9,
    renderedOffset: 0.9,
    generation: 12
  };
  const afterBoundary = advance(beforeBoundary, 100, 3, 1);

  assert.equal(afterBoundary.requestedPixels, 1);
  assert.equal(afterBoundary.movedPixels, 1);
  assert.ok(Math.abs(afterBoundary.carryPx - 0.2) < 1e-9);
  assert.ok(Math.abs(afterBoundary.renderedOffset - 1.2) < 1e-9);
  assert.equal(afterBoundary.generation, 13);
  assert.equal(afterBoundary.needsSettle, true);
  assert.ok(
    afterBoundary.renderedOffset >= beforeBoundary.renderedOffset,
    "an integer scroll keeps advancing the old captured frame's fractional phase"
  );
});

test("Station keeps the local Float phase moving while a capture generation settles", () => {
  const advance = functionFromSource("nextStationScrollState");
  const pending = advance({
    carryPx: 0.2,
    renderedOffset: 1.2,
    generation: 13,
    keepVisualPhase: true
  }, 100, 3, 0);

  assert.ok(Math.abs(pending.carryPx - 0.5) < 1e-9);
  assert.ok(Math.abs(pending.renderedOffset - 1.5) < 1e-9,
    "the old captured video continues moving locally until the safe new frame arrives");
  assert.equal(pending.generation, 13);
  assert.equal(pending.needsSettle, false);
});

test("Station source scroll applies pixels against the numeric scrollTop and records the real movement", () => {
  const applyScroll = functionFromSource("applyStationSourceScroll");
  const root = { scrollTop: 100, scrollHeight: 1000 };
  const snapshot = (target) => ({
    scrollTop: target.scrollTop,
    scrollHeight: target.scrollHeight,
    geometryVersion: 4
  });
  const movement = applyScroll(root, 3, snapshot);

  assert.equal(root.scrollTop, 103);
  assert.equal(movement.before.scrollTop, 100);
  assert.equal(movement.after.scrollTop, 103);
  assert.equal(movement.appliedPixels, 3);
});

test("Station crop geometry is cached outside bounded observer-driven refreshes", () => {
  const payload = source.slice(
    source.indexOf("function stationCropPayload"),
    source.indexOf("function stopStationRelay")
  );
  assert.match(payload, /rect: refreshStationCropGeometry\(\)/);
  assert.match(payload, /captureGeneration: session\.stationConfirmedCaptureGeneration/);
  assert.match(payload, /sequence: \+\+session\.stationCropSequence/);
  assert.doesNotMatch(payload, /calculateCropRect\(\)/);
  assert.match(source, /new ResizeObserver\(scheduleCropTargetUpdate\)/);
  assert.match(source, /new MutationObserver\(observeCurrentColumn\)/);
  assert.match(source, /setTimeout\([\s\S]{0,700}\}, 120\)/);
  assert.match(source, /requestAnimationFrame\(\(\) => \{[\s\S]{0,500}applyCropTargetGeometry/,
    "geometry invalidation remains coalesced independently of capture-frame acknowledgement");
});

test("Station keeps one source tick path while waiting for a captured video frame", () => {
  const control = source.slice(
    source.indexOf("async function stationControl"),
    source.indexOf("function showError")
  );
  assert.match(control, /session\.stationPendingScrollGeneration = next\.generation/);
  assert.match(control, /requestStationCaptureFrame\(next\.generation\)/);
  assert.match(control, /keepVisualPhase: Boolean\([\s\S]*?stationPendingScrollGeneration/);
  assert.match(control, /else if \(session\.stationPendingScrollGeneration \|\| session\.stationPostAckAnchor\)[\s\S]{0,120}stationRenderedOffset = next\.renderedOffset/);
  assert.match(control, /else if \(!session\.stationPendingScrollGeneration && !session\.stationPostAckAnchor\)/);
  assert.match(control, /Math\.min\(timestamp - session\.lastScrollTimestamp, 100\)/);
});

test("a post-scroll crop is released only by the current captured-frame generation after late-anchor settling", () => {
  assert.match(source, /function confirmStationCaptureFrame\(generation\)/);
  assert.match(source, /confirmed !== session\.stationPendingScrollGeneration/,
    "late capture acknowledgements must be ignored");
  assert.match(source, /session\.stationPostAckAnchor = \{ generation:confirmed, anchor, checks:0 \}/);
  assert.match(source, /function observeStationPostAckAnchor\(generation\)/);
  assert.match(source, /session\.stationConfirmedCaptureGeneration = generation/);
  assert.match(source, /type: "XFF_STATION_CROP", crop: stationCropPayload\(\)/,
    "the next offset is broadcast only after the matching decoded frame");
  assert.match(source, /message\?\.type === "XFF_STATION_CAPTURE_FRAME"/);
});

test("a virtualized X anchor correction is held rather than emitted as a backwards crop", () => {
  const disposition = functionFromSource("stationAnchorDisposition");
  const anchor = {
    appliedScrollTop: 1201,
    scrollHeight: 48000,
    geometryVersion: 17
  };

  const pulledBack = disposition(anchor, { scrollTop: 1199, scrollHeight: 48036, geometryVersion: 18 });
  assert.equal(pulledBack.hold, true, "a post-scroll virtualized-anchor pullback must retain the prior confirmed crop");
  assert.equal(pulledBack.reflowed, true);
  const expected = disposition(anchor, { scrollTop: 1201, scrollHeight: 48000, geometryVersion: 17 });
  assert.equal(expected.hold, false, "the expected decoded scroll position is still eligible for promotion");
  assert.equal(expected.reflowed, false);
});

test("Station records source scroll/height/geometry at capture confirmation and suppresses anchor pullbacks", () => {
  const payload = source.slice(
    source.indexOf("function stationCropPayload"),
    source.indexOf("function stopStationRelay")
  );
  assert.match(payload, /sourceScroll: session\.stationLastConfirmedScroll \|\| stationScrollSnapshot\(\)/);
  assert.match(payload, /sourceMetrics:[\s\S]{0,420}lateAnchorCorrections/);
  assert.match(source, /function applyStationSourceScroll\(root, pixels, snapshot = stationScrollSnapshot\)/);
  assert.match(source, /root\.scrollTop = before\.scrollTop \+ requestedPixels/);
  assert.match(source, /const movement = applyStationSourceScroll\(root, wholePixels\)/);
  assert.match(source, /appliedScrollTop: after\.scrollTop/);
  assert.match(source, /session\.stationPendingScrollAnchor = scrollAnchor/);
  assert.match(source, /const disposition = stationAnchorDisposition\(pending\.anchor, snapshot\)/);
  assert.match(source, /session\.stationMetrics\.lateAnchorChecks \+= 1/);
  assert.match(source, /if \(disposition\.hold\) return holdStationAnchor\(pending\.anchor, disposition, \{ late:true \}\)/);
  assert.match(source, /session\.stationLastConfirmedScroll = snapshot/);
});
