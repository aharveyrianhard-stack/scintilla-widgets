import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const vercel = JSON.parse(await readFile(new URL("vercel.json", root), "utf8"));

test("lab identity is unambiguous", () => {
  assert.match(html, /SCINTILLA X LAB/);
  assert.match(html, /Not production · Synthetic only/);
  assert.match(html, /SAFE MODE · REPLAY DATA/);
  assert.match(html, /LOCAL FIXTURE/);
});

test("lab exposes a continuous-versus-stepped smoothness comparison", () => {
  assert.match(html, /aria-label="Continuous frame progression"/);
  assert.match(html, /aria-label="Stepped delivery progression"/);
  assert.match(html, /id="continuousViewport"/);
  assert.match(html, /id="steppedViewport"/);
  assert.match(html, /SAME LOCAL FIXTURE · SAME AVERAGE SPEED/);
  assert.match(html, /left flows every frame · right holds between deliveries/);
});

test("lab exposes cadence control and live motion telemetry on screen", () => {
  for (const id of [
    "telemetryState",
    "telemetryContinuous",
    "telemetryStepped",
    "telemetryFrame",
    "telemetryDeliveries",
    "telemetryStepSize",
    "telemetryNextStep",
    "telemetryGap",
    "telemetryMaxStep",
    "telemetryMaxGap",
    "telemetryRunTime",
    "telemetryLoops",
    "telemetryFixture"
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));

  assert.match(html, /id="cadence" type="range" min="80" max="1000" step="20" value="280"/);
  assert.match(html, /aria-label="Motion readout"/);
  assert.match(html, /aria-live="off"/);
  assert.match(html, /renderState\("replaying"\)/);
  assert.match(html, /while \(stepAccumulator >= cadenceMs\)/);
});

test("lab explains the visual inspection protocol", () => {
  assert.match(html, /How to inspect with your eyes/);
  assert.match(html, /Fix your gaze on the same avatar or card edge/);
  assert.match(html, /LAB VISUAL TARGET: ≤ 6 PX/);
  assert.match(html, /synthetic viewing heuristic, not production acceptance/);
});

test("lab provides a fixed 60-second run with a pass-fail checklist", () => {
  assert.match(html, /id="fixedRun"/);
  assert.match(html, /Start fixed 60-second run/);
  assert.match(html, /const fixedRunDurationMs = 60000/);
  assert.match(html, /aria-label="60-second visual checklist"/);
  for (const id of [
    "checkReference",
    "checkDelivery",
    "checkStep",
    "checkGap",
    "checkDuration",
    "finalVerdict",
    "runClock",
    "runProgress"
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(html, /maximumStepObserved/);
  assert.match(html, /maximumGapObserved/);
});

test("deployable shell contains no live-source, pairing, or browser-control capability", () => {
  const forbidden = [
    "getDisplayMedia",
    "getUserMedia",
    "tabCapture",
    "RTCPeerConnection",
    "WebSocket",
    "BroadcastChannel",
    "chrome.",
    "x.com",
    "twitter.com",
    "station-ipad",
    "pair=",
    "<video",
    "<iframe"
  ];

  for (const token of forbidden) assert.equal(html.includes(token), false, `forbidden capability present: ${token}`);
});

test("preview is explicitly non-indexable and separately identified", () => {
  const headers = vercel.headers.flatMap(rule => rule.headers);
  assert.deepEqual(headers.find(header => header.key === "X-Robots-Tag"), {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive"
  });
  assert.deepEqual(headers.find(header => header.key === "X-SCINTILLA-Surface"), {
    key: "X-SCINTILLA-Surface",
    value: "x-synthetic-lab"
  });
  assert.match(headers.find(header => header.key === "Content-Security-Policy").value, /connect-src 'none'/);
  assert.match(headers.find(header => header.key === "Content-Security-Policy").value, /media-src 'none'/);
  assert.match(headers.find(header => header.key === "Permissions-Policy").value, /display-capture=\(\)/);
});
