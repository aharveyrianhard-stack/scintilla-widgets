import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPaneXCandidate } from "../production-candidate/build-pane-x-candidate.mjs";

export const TEST_HOST = "scintilla-station-testing-surface.vercel.app";
export const TEST_EXTENSION_ID = "jdefdcaphfolchojienigeeajfpinlfp";
export const TEST_EXTENSION_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3pzyY3ggOLmJBXKVmkzhiXtsJR+a/f6PmI2Y8iNyqPnutxqXid7/mYJylalPxyBaQOv4187HgyKZ+28hBzMHjjlnHcQWhhVOmFRhIccnh36nrj6AzAqe75GKS38DkJ3Qe/ICfV4TgymHGjUuUVpwdpdWrQcpkKegGAQjK64qD1DT7en3mZsz6Ye2j8U1p6HjHwzWnkBdOSyS+QrNibeNG1ZK1yDj8783Jd+eLWI4rMCp2aGymalGQIW5a7uF54V1j715oSjk3QhSyO0xrtMVr6w973a0Ws3bHGoHtvWMN29D4Vb+gcw4rY+hdqN5bE0jvZ9KhIH5dImSZ1oO01J/lQIDAQAB";

const handoffRoot = path.dirname(fileURLToPath(import.meta.url));
const labRoot = path.resolve(handoffRoot, "..");
const workspaceRoot = path.resolve(labRoot, "..");
const stableBridgeRoot = path.join(workspaceRoot, "station-x-bridge-draft");
const packageRoot = path.join(handoffRoot, "package");

function replaceExact(source, before, after, label) {
  const first = source.indexOf(before);
  assert.notEqual(first, -1, `test-bridge anchor missing: ${label}`);
  assert.equal(source.indexOf(before, first + before.length), -1, `test-bridge anchor repeated: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function bridgeNamespace(source) {
  return source
    .replaceAll("XFF_", "XTEST_")
    .replaceAll("station-x-offscreen", "scintilla-station-x-test-offscreen-v1")
    .replaceAll("SCINTILLA Station X Bridge", "SCINTILLA Station X TEST Bridge")
    .replaceAll("xFeedFloatSettings", "scintilla.testing.station.x-test.source.settings.v1")
    .replaceAll("window.__xFeedFloatLoaded", "window.__SCINTILLA_STATION_X_TEST_SOURCE_V1__");
}

function buildManifest() {
  return JSON.stringify({
    manifest_version: 3,
    name: "SCINTILLA Station X TEST Bridge",
    short_name: "X TEST Bridge",
    version: "0.1.0",
    description: "Isolated X capture bridge for the SCINTILLA Station testing surface only.",
    key: TEST_EXTENSION_KEY,
    icons: { 16:"icons/icon16.png", 32:"icons/icon32.png", 48:"icons/icon48.png", 128:"icons/icon128.png" },
    permissions: ["activeTab", "offscreen", "scripting", "storage", "tabCapture", "windows"],
    host_permissions: [
      "https://x.com/*",
      `https://${TEST_HOST}/pane-x/*`
    ],
    background: { service_worker:"background.js" },
    action: {
      default_title:"Connect this TEST-profile X tab to Station TESTING SURFACE",
      default_icon:{ 16:"icons/icon16.png", 32:"icons/icon32.png" }
    },
    content_scripts: [
      { matches:["https://x.com/*"], js:["content.js"], run_at:"document_idle" },
      {
        matches:[`https://${TEST_HOST}/pane-x/*`],
        js:["station-test-bridge.js"],
        all_frames:true,
        run_at:"document_idle"
      }
    ],
    commands: {
      _execute_action:{
        suggested_key:{ default:"Alt+Shift+T", mac:"Alt+Shift+T" },
        description:"Connect this TEST-profile X tab to Station TESTING SURFACE"
      }
    }
  }, null, 2) + "\n";
}

function buildBackground(stableSource) {
  let source = bridgeNamespace(stableSource);
  source = source.replaceAll('"station-bridge.js"', '"station-test-bridge.js"');
  source = replaceExact(source,
    `const SUPPORTED_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);`,
    `const TEST_VIEWER_HOST = "${TEST_HOST}";\nconst SUPPORTED_HOSTS = new Set(["x.com"]);\nconst XTEST_PROTOCOL_PREFIX = "XTEST_";`,
    "hard host constants"
  );
  source = source.replace(`const STATION_SESSION_KEY = "stationXSessionV1";`,
    `const STATION_SESSION_KEY = "scintilla.testing.station.x-test.bridge.session.v1";`);
  source = source.replace(
    `url: ["https://station.scintillahub.ai/*"]`,
    `url: ["https://${TEST_HOST}/pane-x/*"]`
  );
  source = replaceExact(source,
    `function isStationPageUrl(url) {\n  try {\n    const parsed = new URL(url);\n    return parsed.protocol === "https:" &&\n      (parsed.hostname === "station.scintillahub.ai" || parsed.hostname.endsWith(".vercel.app"));\n  } catch {\n    return false;\n  }\n}`,
    `function isStationPageUrl(url) {\n  try {\n    const parsed = new URL(url);\n    return parsed.protocol === "https:" && parsed.hostname === TEST_VIEWER_HOST &&\n      (parsed.pathname === "/pane-x" || parsed.pathname.startsWith("/pane-x/"));\n  } catch {\n    return false;\n  }\n}\n\nfunction isTestSourceSender(sender) {\n  try {\n    const parsed = new URL(sender?.url || sender?.tab?.url || "");\n    return parsed.protocol === "https:" && parsed.hostname === "x.com";\n  } catch { return false; }\n}\n\nfunction isTestViewerSender(sender) {\n  return isStationPageUrl(sender?.url || sender?.tab?.url || "");\n}\n\nfunction isTestOffscreenSender(sender) {\n  return sender?.url === chrome.runtime.getURL("offscreen.html");\n}\n\nfunction senderMayUseTestProtocol(message, sender) {\n  const type = String(message?.type || "");\n  if (!type.startsWith(XTEST_PROTOCOL_PREFIX)) return false;\n  if (type === "XTEST_STATION_CAPTURE_FRAME") return isTestOffscreenSender(sender);\n  if (["XTEST_STATION_CROP", "XTEST_STATION_SCROLL_GENERATION", "XTEST_GET_TAB_ZOOM",\n       "XTEST_SET_TAB_ZOOM", "XTEST_GET_STREAM_ID", "XTEST_MINIMIZE_SOURCE_WINDOW",\n       "XTEST_SHOW_SOURCE_WINDOW", "XTEST_BADGE"].includes(type)) return isTestSourceSender(sender);\n  return isTestViewerSender(sender) || isTestSourceSender(sender);\n}`,
    "fail-closed sender authority"
  );
  source = source.replace(
    `      "https://x.com/*",\n      "https://www.x.com/*",\n      "https://twitter.com/*",\n      "https://www.twitter.com/*"`,
    `      "https://x.com/*"`
  );
  source = replaceExact(source,
    `chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {\n  if (message?.type === "XTEST_STATION_READY") {`,
    `chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {\n  if (!senderMayUseTestProtocol(message, sender)) {\n    sendResponse({ ok:false, error:"SCINTILLA X TEST Bridge rejected a non-test sender." });\n    return;\n  }\n  if (message?.type === "XTEST_STATION_READY") {`,
    "runtime sender gate"
  );
  return source.replaceAll("\n+", "\n");
}

function buildContent(stableSource) {
  let source = bridgeNamespace(stableSource);
  source = replaceExact(source,
    `  const STORAGE_KEY = "scintilla.testing.station.x-test.source.settings.v1";`,
    `  const STORAGE_KEY = "scintilla.testing.station.x-test.source.settings.v1";\n  const XTEST_SOURCE_ID = "xtest-source-" + crypto.randomUUID();`,
    "test source identity"
  );
  source = replaceExact(source,
    `    return {\n      rect: refreshStationCropGeometry(),`,
    `    return {\n      sourceIdentity: XTEST_SOURCE_ID,\n      rect: refreshStationCropGeometry(),`,
    "source identity telemetry"
  );
  return source.replaceAll("\n+", "\n");
}

function buildStationBridge(stableSource) {
  let source = bridgeNamespace(stableSource);
  source = source
    .replaceAll("__XTEST_STATION_BRIDGE_V080__", "__SCINTILLA_STATION_X_TEST_BRIDGE_V1__");
  source = replaceExact(source,
    `  const ORIGIN = window.location.origin;\n  const isPane = /\\/pane-x\\/?$/.test(window.location.pathname);\n  if (!isPane) return;`,
    `  const ORIGIN = window.location.origin;\n  const TEST_VIEWER_HOST = "${TEST_HOST}";\n  const isPane = /\\/pane-x\\/?$/.test(window.location.pathname);\n  if (location.protocol !== "https:" || location.hostname !== TEST_VIEWER_HOST || !isPane) return;`,
    "receiver host gate"
  );
  return source;
}

function receiverNamespace(source) {
  return source
    .replaceAll("XFF_", "XTEST_")
    .replaceAll("scintilla.station.remote-viewer.v1.", "scintilla.testing.station.x-test.remote-viewer.v1.")
    .replaceAll("scintilla.station.x-clock.v1", "scintilla.testing.station.x-test.controller.v1")
    .replaceAll("scintilla.station.trusted-ipad.v1", "scintilla.testing.station.x-test.trusted-ipad.v1")
    .replaceAll("realtime:station-ipad:", "realtime:station-x-test-ipad:")
    .replaceAll("SCINTILLA · X pane", "SCINTILLA · X TEST receiver")
    .replaceAll("X · XFLOAT", "X · TEST BRIDGE")
    .replaceAll("Option+Shift+S", "Option+Shift+T")
    .replaceAll("twitter.com", "legacy X host (not admitted)")
    .replaceAll("Alt+Shift+P", "stable shortcut (not admitted)")
    .replaceAll("SCINTILLA Station X Bridge", "SCINTILLA Station X TEST Bridge");
}

function addReceiverDiagnostics(candidateSource) {
  let source = receiverNamespace(candidateSource);
  source = replaceExact(source,
    `</style>`,
    `#xTestDiagnostics{ flex:none; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:2px 8px;\n+  padding:4px 7px; border-bottom:1px solid rgba(255,138,0,.32); background:#120d08; color:#b6a48d;\n+  font:7.5px/1.35 var(--mono); letter-spacing:.04em; }\n+#xTestDiagnostics b{ color:var(--vol); font-weight:500; }\n+#xTestDiagnostics [data-state="online"]{ color:var(--bull); }\n+#xTestDiagnostics [data-state="offline"]{ color:var(--bear); }\n+@media(max-width:520px){ #xTestDiagnostics{ grid-template-columns:repeat(2,minmax(0,1fr)); font-size:7px; } }\n+</style>`,
    "diagnostics styles"
  );
  source = replaceExact(source,
    `<div id="body">`,
    `<div id="xTestDiagnostics" aria-label="X TEST Bridge diagnostics">\n+  <span><b>TEST RECEIVER</b> candidate smoothing ON</span>\n+  <span>source <b id="xTestSource" data-state="offline">NOT ATTACHED</b></span>\n+  <span>source id <b id="xTestSourceId">none</b></span>\n+  <span>viewer generation <b id="xTestGeneration">starting</b></span>\n+  <span>frame age <b id="xTestFrameAge">no frame</b></span>\n+  <span>reconnects <b id="xTestReconnects">0 · none</b></span>\n+  <span>controller <b id="xTestController">electing</b></span>\n+  <span>offline cause <b id="xTestOfflineCause">NO_TEST_SOURCE_APPROVED</b></span>\n+  <span>room <b>station-x-test-ipad</b></span>\n+</div>\n+\n+<div id="body">`,
    "visible diagnostics panel"
  );
  source = replaceExact(source,
    `const QS = new URLSearchParams(location.search);`,
    `const QS = new URLSearchParams(location.search);\nconst XTEST_ALLOWED_HOST = "${TEST_HOST}";\nif (location.protocol !== "https:" || location.hostname !== XTEST_ALLOWED_HOST) {\n  throw new Error("X TEST receiver refused a non-testing host.");\n}`,
    "receiver host gate"
  );
  source = replaceExact(source,
    `const REMOTE_RECEIVER_GENERATION = createRemoteViewerId();`,
    `const REMOTE_RECEIVER_GENERATION = "xtest-viewer-" + createRemoteViewerId();`,
    "test viewer generation"
  );
  source = source.replace(
    `const VIEWER_CLOCK_ID = createRemoteViewerId();`,
    `const VIEWER_CLOCK_ID = "xtest-controller-" + createRemoteViewerId();`
  );
  source = source.replace(
    `const link = location.origin + "/station-ipad/#pair=" + encodeURIComponent(token) + "&code=" + encodeURIComponent(stationPair.code);`,
    `const link = location.origin + "/pane-x/?x-test=1&remote=1&view=ipad&pair=" + encodeURIComponent(token) + "&code=" + encodeURIComponent(stationPair.code);`
  );
  source = replaceExact(source,
    `let directPeerWatchdog = null;`,
    `let directPeerWatchdog = null;\n+let xTestReconnectCount = 0;\n+let xTestReconnectReason = "none";\n+let xTestOfflineCause = "NO_TEST_SOURCE_APPROVED";\n+function setXTestOfflineCause(code, detail = "") {\n+  xTestOfflineCause = String(code || "UNKNOWN") + (detail ? ": " + String(detail) : "");\n+}\n+function noteXTestReconnect(reason) {\n+  xTestReconnectCount += 1;\n+  xTestReconnectReason = String(reason || "unknown");\n+}\n+function publishXTestDiagnostics() {\n+  const attached = Boolean(xfloatStream?.active);\n+  const age = remoteFrameAt ? Math.max(0, performance.now() - remoteFrameAt) : Infinity;\n+  const source = el("xTestSource");\n+  if (!source) return;\n+  source.textContent = attached ? "ATTACHED" : "NOT ATTACHED";\n+  source.dataset.state = attached ? "online" : "offline";\n+  el("xTestSourceId").textContent = String(xfloatCrop?.sourceIdentity || "none").slice(0, 28);\n+  el("xTestGeneration").textContent = REMOTE_RECEIVER_GENERATION.slice(0, 30);\n+  el("xTestFrameAge").textContent = Number.isFinite(age) ? Math.round(age) + " ms" : "no frame";\n+  el("xTestReconnects").textContent = xTestReconnectCount + " · " + xTestReconnectReason;\n+  el("xTestController").textContent = REMOTE_MODE ? "REMOTE · NO TICK" :\n+    (viewerClockOwner ? "OWNER · " : "MIRROR · ") + String(viewerCadence.ownerId || VIEWER_CLOCK_ID).slice(0, 18);\n+  el("xTestOfflineCause").textContent = attached ? "NONE" : xTestOfflineCause;\n+  window.__SCINTILLA_X_TEST_DIAGNOSTICS = Object.freeze({\n+    sourceAttached:attached, sourceIdentity:xfloatCrop?.sourceIdentity || null,\n+    viewerGeneration:REMOTE_RECEIVER_GENERATION, frameAgeMs:Number.isFinite(age) ? age : null,\n+    reconnectCount:xTestReconnectCount, reconnectReason:xTestReconnectReason,\n+    controllerOwner:Boolean(viewerClockOwner), controllerIdentity:viewerCadence.ownerId || VIEWER_CLOCK_ID,\n+    offlineCause:attached ? "NONE" : xTestOfflineCause\n+  });\n+}\n+setInterval(publishXTestDiagnostics, 250);`,
    "diagnostics runtime"
  );
  source = replaceExact(source,
    `function scheduleRemoteStationReconnect() {\n  if (!REMOTE_MODE || document.visibilityState === "hidden" || remoteReconnect) return;`,
    `function scheduleRemoteStationReconnect() {\n  if (!REMOTE_MODE || document.visibilityState === "hidden" || remoteReconnect) return;\n  noteXTestReconnect("REMOTE_REALTIME_OR_MEDIA_STALE");\n  setXTestOfflineCause("REMOTE_REALTIME_OR_MEDIA_STALE");`,
    "remote reconnect diagnostics"
  );
  source = replaceExact(source,
    `function scheduleDirectStationReconnect() {`,
    `function scheduleDirectStationReconnect() {\n  noteXTestReconnect("DIRECT_VIEWER_MEDIA_ENDED_OR_STALE");\n  setXTestOfflineCause("DIRECT_VIEWER_MEDIA_ENDED_OR_STALE");`,
    "direct reconnect diagnostics"
  );
  source = replaceExact(source,
    `function showErr(m) { const e = el("err"); e.textContent = m; e.style.display = "block"; }`,
    `function showErr(m) { setXTestOfflineCause("RECEIVER_ERROR", m); const e = el("err"); e.textContent = m; e.style.display = "block"; }`,
    "offline error diagnostics"
  );
  source = replaceExact(source,
    `  xfloatStream = mediaStream;\n  clearDirectPeerWatchdog();`,
    `  xfloatStream = mediaStream;\n  xTestOfflineCause = "NONE";\n  clearDirectPeerWatchdog();`,
    "source attached diagnostics"
  );
  source = replaceExact(source,
    `    if (!xfloatStream) el("xfState").textContent = "ready";`,
    `    if (!xfloatStream) {\n      setXTestOfflineCause("TEST_BRIDGE_READY_NO_SOURCE");\n      el("xfState").textContent = "ready";\n    }`,
    "bridge ready offline cause"
  );
  source = replaceExact(source,
    `  if (event.data?.type === "XTEST_STATION_STATUS") {\n    if (event.data.status === "stopped") stopXFloat({ notify: false });\n    else if (event.data.status === "error") showErr(event.data.detail || "Station X could not connect.");\n    else if (!xfloatStream) el("xfState").textContent = event.data.status || "waiting";\n  }`,
    `  if (event.data?.type === "XTEST_STATION_STATUS") {\n    if (event.data.status === "stopped") {\n      setXTestOfflineCause("TEST_SOURCE_STOPPED", event.data.detail || "stopped");\n      stopXFloat({ notify: false });\n    } else if (event.data.status === "error") showErr(event.data.detail || "Station X could not connect.");\n    else if (!xfloatStream) {\n      setXTestOfflineCause("TEST_BRIDGE_STATUS_" + String(event.data.status || "WAITING").toUpperCase(), event.data.detail || "");\n      el("xfState").textContent = event.data.status || "waiting";\n    }\n  }`,
    "status offline cause"
  );
  return source.replaceAll("\n+", "\n");
}

async function build() {
  await rm(packageRoot, { recursive:true, force:true });
  const extensionRoot = path.join(packageRoot, "scintilla-station-x-test-bridge");
  const receiverRoot = path.join(packageRoot, "testing-receiver", "pane-x");
  await mkdir(path.join(extensionRoot, "icons"), { recursive:true });
  await mkdir(receiverRoot, { recursive:true });

  const [background, content, offscreen, stationBridge, launch, offscreenHtml, stablePane, core] = await Promise.all([
    readFile(path.join(stableBridgeRoot, "background.js"), "utf8"),
    readFile(path.join(stableBridgeRoot, "content.js"), "utf8"),
    readFile(path.join(stableBridgeRoot, "offscreen.js"), "utf8"),
    readFile(path.join(stableBridgeRoot, "station-bridge.js"), "utf8"),
    readFile(path.join(stableBridgeRoot, "launch.js"), "utf8"),
    readFile(path.join(stableBridgeRoot, "offscreen.html"), "utf8"),
    readFile(path.join(workspaceRoot, "pane-x", "index.html"), "utf8"),
    readFile(path.join(labRoot, "pane-x-presentation-core.js"), "utf8")
  ]);

  const candidate = buildPaneXCandidate(stablePane, core);
  const files = new Map([
    [path.join(extensionRoot, "manifest.json"), buildManifest()],
    [path.join(extensionRoot, "background.js"), buildBackground(background)],
    [path.join(extensionRoot, "content.js"), buildContent(content)],
    [path.join(extensionRoot, "offscreen.js"), bridgeNamespace(offscreen)],
    [path.join(extensionRoot, "offscreen.html"), bridgeNamespace(offscreenHtml).replace("Station X Capture", "Station X TEST Capture")],
    [path.join(extensionRoot, "station-test-bridge.js"), buildStationBridge(stationBridge)],
    [path.join(extensionRoot, "launch.js"), bridgeNamespace(launch)],
    [path.join(receiverRoot, "index.html"), addReceiverDiagnostics(candidate.get("pane-x/index.html"))],
    [path.join(receiverRoot, "pane-x-presentation-core.js"), core]
  ]);
  for (const [destination, contents] of files) {
    await mkdir(path.dirname(destination), { recursive:true });
    await writeFile(destination, contents);
  }
  for (const size of [16, 32, 48, 128]) {
    await copyFile(path.join(stableBridgeRoot, "icons", `icon${size}.png`), path.join(extensionRoot, "icons", `icon${size}.png`));
  }
  console.log([...files.keys()].map((file) => path.relative(handoffRoot, file)).join("\n"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();

export { addReceiverDiagnostics, bridgeNamespace, buildBackground, buildContent, buildManifest, buildStationBridge, receiverNamespace };
