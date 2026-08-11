import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestPath = new URL("../manifest.json", import.meta.url);
const knownV0715Blob = "f762e3ea520c7adab5fcacb029d9bb9bea48771d";

function gitBlobHash(source) {
  const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source);
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

test("Bridge package is the exact reviewed v0.7.15 manifest with unchanged permanent permissions", async () => {
  const source = await readFile(manifestPath);
  const manifest = JSON.parse(source.toString("utf8"));

  assert.equal(gitBlobHash(source), knownV0715Blob);
  assert.equal(manifest.version, "0.7.15");
  assert.deepEqual(manifest.permissions, ["activeTab", "offscreen", "scripting", "storage", "tabCapture", "windows"]);
  assert.deepEqual(manifest.host_permissions, [
    "https://x.com/*",
    "https://twitter.com/*",
    "https://station.scintillahub.ai/*",
    "https://scintilla-widgets.vercel.app/*",
    "http://127.0.0.1/*",
    "http://localhost/*"
  ]);
  assert.deepEqual(manifest.commands?._execute_action?.suggested_key, {
    default: "Alt+Shift+S", mac: "Alt+Shift+S"
  });
});
