import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const candidate = await readFile(new URL("pane-x-viewer-candidate.mjs", root), "utf8");
const vercel = JSON.parse(await readFile(new URL("vercel.json", root), "utf8"));

test("lab identity is unambiguous", () => {
  assert.match(html, /SCINTILLA X LAB/);
  assert.match(html, /Not production · Synthetic only/);
  assert.match(html, /SAFE MODE · REPLAY DATA/);
  assert.match(html, /LOCAL FIXTURE/);
});

test("lab exposes continuous, raw stepped, and interpolated fixture columns", () => {
  assert.match(html, /aria-label="Continuous frame progression"/);
  assert.match(html, /aria-label="Raw stepped delivery progression"/);
  assert.match(html, /aria-label="Interpolated stepped delivery progression"/);
  assert.match(html, /id="continuousViewport"/);
  assert.match(html, /id="rawViewport"/);
  assert.match(html, /id="interpolatedViewport"/);
  assert.match(html, /PANE-X LAB COPY · SAME LOCAL FIXTURE · PRESENTATION ONLY/);
  assert.match(html, /reference flows · raw holds\/jumps · interpolated renders every frame/);
});

test("lab copy delegates presentation to the isolated candidate renderer", () => {
  assert.match(html, /import \{ PaneXViewerPresentationCandidate \}/);
  assert.match(html, /presentationCandidate\.receive\(\{/);
  assert.match(html, /position: rawPosition/);
  assert.match(html, /presentationCandidate\.frame\(time\)/);
  assert.match(candidate, /this\.position = this\.target/);
  assert.match(candidate, /nextSequence <= this\.latestSequence/);
  assert.match(candidate, /Math\.max\(low, Math\.min\(high, interpolated\)\)/);
  assert.match(html, /requestAnimationFrame\(tick\)/);
});

test("candidate exposes manual and hover presentation pauses without source authority", () => {
  assert.match(html, /id="candidatePause"/);
  assert.match(html, /id="candidateStatus"/);
  assert.match(html, /setPaused\("manual"/);
  assert.match(html, /setPaused\("hover"/);
  assert.match(candidate, /pauseReasons = new Set\(\)/);
  assert.match(candidate, /receivedWhilePaused/);
  assert.match(candidate, /source-scroll, capture, crop, transport/);
});

test("lab exposes cadence control and live motion telemetry on screen", () => {
  for (const id of [
    "telemetryState",
    "telemetryContinuous",
    "telemetryRaw",
    "telemetryInterpolated",
    "telemetryFrame",
    "telemetryDeliveries",
    "telemetryStepSize",
    "telemetryNextStep",
    "telemetryRawGap",
    "telemetryInterpolatedGap",
    "telemetryEndpointError",
    "telemetryEndpointChecks",
    "telemetryRunTime",
    "telemetryLoops",
    "telemetryFixture"
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));

  assert.match(html, /id="cadence" type="range" min="80" max="1000" step="20" value="80"/);
  assert.match(html, /id="cadence80"[^>]*data-cadence="80"/);
  assert.match(html, /id="cadence800"[^>]*data-cadence="800"/);
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
    "checkRawGap",
    "checkInterpolatedGap",
    "checkEndpoint",
    "checkDuration",
    "finalVerdict",
    "runClock",
    "runProgress"
  ]) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.match(html, /maximumRawGapObserved/);
  assert.match(html, /maximumInterpolatedGapObserved/);
  assert.match(html, /maximumEndpointError/);
});

test("deployable shell contains no live-source, pairing, or browser-control capability", () => {
  const deployableSource = `${html}\n${candidate}`;
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

  for (const token of forbidden) assert.equal(deployableSource.includes(token), false, `forbidden capability present: ${token}`);
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
  assert.match(headers.find(header => header.key === "Content-Security-Policy").value, /script-src 'self' 'unsafe-inline'/);
  assert.match(headers.find(header => header.key === "Permissions-Policy").value, /display-capture=\(\)/);
});
