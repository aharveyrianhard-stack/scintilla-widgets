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

test("Station keeps the rendered fractional crop through an integer source scroll", () => {
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
  assert.equal(afterBoundary.renderedOffset, 0.9);
  assert.equal(afterBoundary.generation, 13);
  assert.equal(afterBoundary.needsSettle, true);
  assert.ok(
    afterBoundary.renderedOffset >= beforeBoundary.renderedOffset,
    "an integer scroll must not publish a backwards composite crop move"
  );
});

test("Station crop geometry is cached outside bounded observer-driven refreshes", () => {
  const payload = source.slice(
    source.indexOf("function stationCropPayload"),
    source.indexOf("function stopStationRelay")
  );
  assert.match(payload, /rect: refreshStationCropGeometry\(\)/);
  assert.doesNotMatch(payload, /calculateCropRect\(\)/);
  assert.match(source, /new ResizeObserver\(scheduleCropTargetUpdate\)/);
  assert.match(source, /new MutationObserver\(observeCurrentColumn\)/);
  assert.match(source, /setTimeout\([\s\S]{0,700}\}, 120\)/);
  assert.match(source, /requestAnimationFrame\(\(\) => \{[\s\S]{0,500}applyCropTargetGeometry/,
    "geometry invalidation remains coalesced independently of capture-frame acknowledgement");
});

test("Station retains one 10 Hz source tick path while waiting for a captured video frame", () => {
  const control = source.slice(
    source.indexOf("async function stationControl"),
    source.indexOf("function showError")
  );
  assert.match(control, /session\.stationPendingScrollGeneration = next\.generation/);
  assert.match(control, /requestStationCaptureFrame\(next\.generation\)/);
  assert.match(control, /else if \(!session\.stationPendingScrollGeneration\)/);
  assert.match(control, /Math\.min\(timestamp - session\.lastScrollTimestamp, 100\)/);
});

test("a post-scroll crop is released only by the current captured-frame generation", () => {
  assert.match(source, /function confirmStationCaptureFrame\(generation\)/);
  assert.match(source, /confirmed !== session\.stationPendingScrollGeneration/,
    "late capture acknowledgements must be ignored");
  assert.match(source, /session\.stationRenderedOffset = session\.scrollCarryPx/);
  assert.match(source, /type: "XFF_STATION_CROP", crop: stationCropPayload\(\)/,
    "the next offset is broadcast only after the matching decoded frame");
  assert.match(source, /message\?\.type === "XFF_STATION_CAPTURE_FRAME"/);
});
