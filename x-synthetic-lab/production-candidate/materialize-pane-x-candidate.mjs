import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPaneXCandidate } from "./build-pane-x-candidate.mjs";

const outputRoot = process.argv[2];
assert.ok(outputRoot, "usage: node materialize-pane-x-candidate.mjs <empty-output-directory>");

const candidateRoot = path.dirname(fileURLToPath(import.meta.url));
const labRoot = path.resolve(candidateRoot, "..");
const workspaceRoot = path.resolve(labRoot, "..");
const stableIndex = await readFile(path.join(workspaceRoot, "pane-x/index.html"), "utf8");
const canonicalCore = await readFile(path.join(labRoot, "pane-x-presentation-core.js"), "utf8");
const files = buildPaneXCandidate(stableIndex, canonicalCore);

for (const [relativePath, contents] of files) {
  const destination = path.resolve(outputRoot, relativePath);
  assert.ok(destination.startsWith(path.resolve(outputRoot) + path.sep), "candidate path escaped output directory");
  await mkdir(path.dirname(destination), { recursive:true });
  await writeFile(destination, contents);
}

console.log([...files.keys()].join("\n"));
