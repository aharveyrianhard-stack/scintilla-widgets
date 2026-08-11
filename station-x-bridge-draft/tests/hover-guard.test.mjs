import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../content.js", import.meta.url), "utf8");
const guard = source.match(/function setStationHoverGuard\(enabled\) \{[\s\S]*?\n  \}\n\n  function pauseLabel/);

test("Station auto-scroll suppresses hover-only events without intercepting clicks", () => {
  assert.ok(guard, "the Station hover guard must exist");
  const types = [...guard[0].matchAll(/for \(const type of \[([^\]]+)\]\)/g)]
    .flatMap((match) => [...match[1].matchAll(/"([^"]+)"/g)].map((event) => event[1]));
  assert.deepEqual([...new Set(types)].sort(), ["mousemove", "mouseover", "pointermove", "pointerover"]);
  assert.ok(!types.some((type) => ["click", "pointerdown", "pointerup", "touchstart", "touchend"].includes(type)));
  assert.match(source, /session\.stationMode = true;\s+setStationHoverGuard\(true\)/);
  assert.match(source, /session\.stationMode = false;\s+setStationHoverGuard\(false\)/);
});
