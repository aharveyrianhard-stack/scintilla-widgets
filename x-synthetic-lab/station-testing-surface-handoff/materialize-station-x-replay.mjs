import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildStationXReplayIndex, testingSurfaceFiles } from "./build-station-x-replay.mjs";

const outputRoot = process.argv[2];
assert.ok(outputRoot, "usage: node materialize-station-x-replay.mjs <empty-output-directory>");

const handoffRoot = path.dirname(fileURLToPath(import.meta.url));
const labRoot = path.resolve(handoffRoot, "..");
const workspaceRoot = path.resolve(labRoot, "..");
const stableIndex = await readFile(path.join(workspaceRoot, "pane-x/index.html"), "utf8");
const sources = new Map([
  ["pane-x/index.html", buildStationXReplayIndex(stableIndex)],
  ["pane-x/pane-x-presentation-core.js", await readFile(path.join(labRoot, "pane-x-presentation-core.js"), "utf8")],
  ["pane-x/fixtures/x-crop-motion.js", await readFile(path.join(handoffRoot, "fixtures/x-crop-motion.js"), "utf8")],
  ["pane-x/pane-x-test-replay.js", await readFile(path.join(handoffRoot, "pane-x-test-replay.js"), "utf8")],
  ["pane-x/fixtures/x-feed-static.svg", await readFile(path.join(handoffRoot, "fixtures/x-feed-static.svg"), "utf8")]
]);
assert.deepEqual([...sources.keys()], testingSurfaceFiles);

for (const [relativePath, contents] of sources) {
  const destination = path.resolve(outputRoot, relativePath);
  assert.ok(destination.startsWith(path.resolve(outputRoot) + path.sep), "replay path escaped output directory");
  await mkdir(path.dirname(destination), { recursive:true });
  await writeFile(destination, contents);
}

console.log([...sources.keys()].join("\n"));
