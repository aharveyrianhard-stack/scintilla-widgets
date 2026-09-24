import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestPath = new URL("../manifest.json", import.meta.url);
const knownV0717Blob = "189a20bdcf5a34f1cdf8a172015b9d09c2cad491";

function gitBlobHash(source) {
  const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source);
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

test("Bridge package is v0.7.19 with one added permission and the Station X shells matched", async () => {
  const source = await readFile(manifestPath);
  const manifest = JSON.parse(source.toString("utf8"));

  /* 0.7.18 (23 Sep): the relay must attach where the Station actually mounts its X pane.
     0.7.19 (24 Sep, M43): one folder for Chrome and Brave on both Macs, so the
     bridge watches its own folder version and reloads itself - which needs the
     "alarms" permission and nothing else. */
  assert.equal(manifest.version, "0.7.19");
  const relay = manifest.content_scripts.find((c) => (c.js || []).includes("station-bridge.js"));
  assert.ok(relay.matches.includes("https://station.scintillahub.ai/station-shells/x-v*"), "the deck mounts /station-shells/x-v2");
  assert.ok(relay.matches.includes("https://station.scintillahub.ai/pane-x*"));
  assert.deepEqual(manifest.permissions,
    ["activeTab", "alarms", "offscreen", "scripting", "storage", "tabCapture", "windows"]);
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
