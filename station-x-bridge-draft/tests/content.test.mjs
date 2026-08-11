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
