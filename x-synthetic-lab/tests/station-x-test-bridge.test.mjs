import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  TEST_EXTENSION_ID,
  TEST_EXTENSION_KEY,
  TEST_HOST,
  buildBackground,
  buildContent,
  buildManifest,
  buildStationBridge
} from "../station-x-test-bridge-handoff/build-test-bridge.mjs";

const labRoot = new URL("../", import.meta.url);
const workspaceRoot = new URL("../../", import.meta.url);
const handoff = new URL("station-x-test-bridge-handoff/", labRoot);
const extension = new URL("package/scintilla-station-x-test-bridge/", handoff);
const receiver = new URL("package/testing-receiver/pane-x/", handoff);
const read = (base, file) => readFile(new URL(file, base), "utf8");
const sha256 = (source) => crypto.createHash("sha256").update(source).digest("hex");

const manifestSource = await read(extension, "manifest.json");
const manifest = JSON.parse(manifestSource);
const background = await read(extension, "background.js");
const content = await read(extension, "content.js");
const stationBridge = await read(extension, "station-test-bridge.js");
const offscreen = await read(extension, "offscreen.js");
const launch = await read(extension, "launch.js");
const receiverIndex = await read(receiver, "index.html");
const receiverCore = await read(receiver, "pane-x-presentation-core.js");
const canonicalCore = await read(labRoot, "pane-x-presentation-core.js");
const stableBackground = await read(new URL("station-x-bridge-draft/", workspaceRoot), "background.js");
const stableContent = await read(new URL("station-x-bridge-draft/", workspaceRoot), "content.js");
const stableStationBridge = await read(new URL("station-x-bridge-draft/", workspaceRoot), "station-bridge.js");

function extensionIdFromKey(base64Key) {
  const der = Buffer.from(base64Key, "base64");
  const digest = crypto.createHash("sha256").update(der).digest().subarray(0, 16);
  return [...digest].map((byte) =>
    String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))
  ).join("");
}

function withoutComments(source) {
  return source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("test extension has a fixed identity distinct from known stable extensions", () => {
  assert.equal(manifest.name, "SCINTILLA Station X TEST Bridge");
  assert.equal(manifest.short_name, "X TEST Bridge");
  assert.equal(manifest.key, TEST_EXTENSION_KEY);
  assert.equal(extensionIdFromKey(manifest.key), TEST_EXTENSION_ID);
  assert.equal(TEST_EXTENSION_ID, "jdefdcaphfolchojienigeeajfpinlfp");
  assert.notEqual(TEST_EXTENSION_ID, "niobhomgbnonikgnjlndjchkdacfkdei");
  assert.notEqual(TEST_EXTENSION_ID, "pbpgkcfiefokoeobomnlfdndadchkpll");
});

test("manifest admits only exact test pane and x.com source paths", () => {
  assert.deepEqual(manifest.host_permissions, [
    "https://x.com/*",
    `https://${TEST_HOST}/pane-x/*`
  ]);
  assert.deepEqual(manifest.content_scripts.map((entry) => entry.matches), [
    ["https://x.com/*"],
    [`https://${TEST_HOST}/pane-x/*`]
  ]);
  assert.deepEqual(manifest.permissions,
    ["activeTab", "offscreen", "scripting", "storage", "tabCapture", "windows"]);
  assert.equal(manifest.commands._execute_action.suggested_key.mac, "Alt+Shift+T");
  for (const forbidden of ["twitter.com", "localhost", "127.0.0.1", "station.scintillahub.ai", "*.vercel.app"])
    assert.equal(manifestSource.includes(forbidden), false, `manifest authority widened to ${forbidden}`);
});

test("checked-in extension is the exact fail-closed mechanical build", () => {
  assert.equal(background, buildBackground(stableBackground));
  assert.equal(content, buildContent(stableContent));
  assert.equal(stationBridge, buildStationBridge(stableStationBridge));
  assert.equal(manifestSource, buildManifest());
});

test("runtime protocol, storage, page global, and offscreen target are test-only", () => {
  const executable = withoutComments([background, content, stationBridge, offscreen, launch, receiverIndex].join("\n"));
  for (const required of [
    "XTEST_",
    "scintilla.testing.station.x-test.bridge.session.v1",
    "scintilla.testing.station.x-test.source.settings.v1",
    "__SCINTILLA_STATION_X_TEST_SOURCE_V1__",
    "__SCINTILLA_STATION_X_TEST_BRIDGE_V1__",
    "scintilla-station-x-test-offscreen-v1"
  ]) assert.match(executable, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const forbidden of [
    "XFF_", "stationXSessionV1", "xFeedFloatSettings", "station-x-offscreen",
    "station.scintillahub.ai", "scintilla-widgets.vercel.app", "localhost", "127.0.0.1"
  ]) assert.equal(executable.includes(forbidden), false, `stable authority leaked: ${forbidden}`);
});

test("background independently validates every sender role and exact viewer host", () => {
  assert.match(background, /function senderMayUseTestProtocol\(message, sender\)/);
  assert.match(background, /type\.startsWith\(XTEST_PROTOCOL_PREFIX\)/);
  assert.match(background, /type === "XTEST_STATION_CAPTURE_FRAME"\) return isTestOffscreenSender/);
  assert.match(background, /parsed\.hostname === "x\.com"/);
  assert.match(background, /parsed\.hostname === TEST_VIEWER_HOST/);
  assert.match(background, /SCINTILLA X TEST Bridge rejected a non-test sender/);
  assert.match(background, /files: \["station-test-bridge\.js"\]/);
  assert.doesNotMatch(background, /endsWith\("\.vercel\.app"\)/);
});

test("source identity is separate while crop, anchor, capture, and cadence baseline stay derived", () => {
  assert.match(content, /const XTEST_SOURCE_ID = "xtest-source-" \+ crypto\.randomUUID\(\)/);
  assert.match(content, /sourceIdentity: XTEST_SOURCE_ID/);
  for (const authority of [
    "function refreshStationCropGeometry", "function nextStationScrollState",
    "function confirmStationCaptureFrame", "function observeStationPostAckAnchor",
    "STATION_VIEWER_HOVER_LEASE_MS = 500"
  ]) assert.equal(content.includes(authority), true, `missing stable source authority: ${authority}`);
  assert.equal(content.includes("crop experiment"), false);
});

test("receiver identities, controller, pair, room, and iPad route are lab-only", () => {
  for (const required of [
    "scintilla.testing.station.x-test.remote-viewer.v1.",
    "scintilla.testing.station.x-test.controller.v1",
    "scintilla.testing.station.x-test.trusted-ipad.v1",
    "realtime:station-x-test-ipad:",
    "xtest-viewer-", "xtest-controller-",
    "/pane-x/?x-test=1&remote=1&view=ipad&pair="
  ]) assert.equal(receiverIndex.includes(required), true, `missing isolated receiver identity: ${required}`);
  for (const forbidden of [
    "scintilla.station.remote-viewer.v1.", "scintilla.station.x-clock.v1",
    "scintilla.station.trusted-ipad.v1", "realtime:station-ipad:",
    "/station-ipad/#pair="
  ]) assert.equal(receiverIndex.includes(forbidden), false, `stable receiver identity leaked: ${forbidden}`);
});

test("candidate smoothing exists only in testing receiver and preserves canonical bytes", () => {
  assert.equal(sha256(receiverCore), "e3863b888f74a2c81ba9fa3c5c2b1c44f05c72dc9d304b8dc38f775248c48fa3");
  assert.equal(receiverCore, canonicalCore);
  assert.match(receiverIndex, /new PaneXViewerPresentationCandidate/);
  assert.match(receiverIndex, /viewerCropState\.confirmedCrop/);
  assert.match(receiverIndex, /setViewerPresentationPause\("hover"/);
  assert.match(receiverIndex, /setViewerPresentationPause\("hidden"/);
  for (const bridgeFile of [background, content, stationBridge, offscreen, launch])
    assert.equal(bridgeFile.includes("PaneXViewerPresentationCandidate"), false);
});

test("visible diagnostics expose every requested end-to-end discriminator", () => {
  for (const id of [
    "xTestSource", "xTestSourceId", "xTestGeneration", "xTestFrameAge",
    "xTestReconnects", "xTestController", "xTestOfflineCause"
  ]) assert.match(receiverIndex, new RegExp(`id="${id}"`));
  for (const field of [
    "sourceAttached", "sourceIdentity", "viewerGeneration", "frameAgeMs",
    "reconnectCount", "reconnectReason", "controllerOwner", "controllerIdentity", "offlineCause"
  ]) assert.equal(receiverIndex.includes(field), true, `diagnostic field missing: ${field}`);
  assert.match(receiverIndex, /DIRECT_VIEWER_MEDIA_ENDED_OR_STALE/);
  assert.match(receiverIndex, /REMOTE_REALTIME_OR_MEDIA_STALE/);
  assert.match(receiverIndex, /RECEIVER_ERROR/);
});

test("receiver and injected bridge both fail closed outside the canonical testing pane", () => {
  assert.match(receiverIndex, new RegExp(`XTEST_ALLOWED_HOST = "${TEST_HOST.replaceAll(".", "\\.")}"`));
  assert.match(receiverIndex, /throw new Error\("X TEST receiver refused a non-testing host\."\)/);
  assert.match(stationBridge, new RegExp(`TEST_VIEWER_HOST = "${TEST_HOST.replaceAll(".", "\\.")}"`));
  assert.match(stationBridge, /location\.protocol !== "https:" \|\| location\.hostname !== TEST_VIEWER_HOST/);
});

test("recorded stable files and candidate core remain byte-exact", async () => {
  const baseline = JSON.parse(await read(handoff, "isolation-baseline.json"));
  for (const [relativePath, expected] of Object.entries(baseline)) {
    const source = await readFile(new URL(relativePath, workspaceRoot));
    assert.equal(sha256(source), expected, `stable isolation baseline changed: ${relativePath}`);
  }
});

test("published package checksums cover and match every emitted file", async () => {
  const sums = await read(handoff, "PACKAGE_SHA256SUMS");
  const entries = sums.trim().split("\n").map((line) => {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert.ok(match, `invalid checksum line: ${line}`);
    return [match[2], match[1]];
  });
  assert.equal(entries.length, 13);
  for (const [relativePath, expected] of entries) {
    const file = await readFile(new URL(relativePath, handoff));
    assert.equal(sha256(file), expected, `package checksum changed: ${relativePath}`);
  }
});

test("handoff contains explicit no-install runbook, prerequisites, and static review", async () => {
  const [readme, runbook, prerequisites, review] = await Promise.all([
    read(handoff, "README.md"), read(handoff, "RUNBOOK.md"),
    read(handoff, "PHYSICAL_PREREQUISITES.md"), read(handoff, "SECURITY_REVIEW.md")
  ]);
  assert.match(readme, /has not been installed, loaded\s+unpacked, activated/);
  assert.match(runbook, /future manual runbook/);
  assert.match(runbook, /TESTING SURFACE · NOT STABLE/);
  assert.match(prerequisites, /brand-new Chrome profile/);
  assert.match(prerequisites, /do not activate the\s+capture/);
  assert.match(review, /Static verdict/);
  assert.match(review, /do\s+not widen to `\*\.vercel\.app`/);
});
