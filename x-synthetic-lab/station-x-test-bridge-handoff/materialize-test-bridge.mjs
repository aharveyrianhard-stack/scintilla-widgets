import assert from "node:assert/strict";
import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outputRoot = process.argv[2];
assert.ok(outputRoot, "usage: node materialize-test-bridge.mjs <empty-output-directory>");

const handoffRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.join(handoffRoot, "package");
const resolvedOutput = path.resolve(outputRoot);
await mkdir(resolvedOutput, { recursive:true });
assert.deepEqual(await readdir(resolvedOutput), [], "output directory must be empty");
for (const entry of await readdir(sourceRoot)) {
  await cp(path.join(sourceRoot, entry), path.join(resolvedOutput, entry), {
    recursive:true,
    errorOnExist:true,
    force:false
  });
}
console.log("scintilla-station-x-test-bridge");
console.log("testing-receiver/pane-x");
