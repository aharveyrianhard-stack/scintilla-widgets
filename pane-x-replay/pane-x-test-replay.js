/* Station testing twin only — local, read-only pane-X replay. */
"use strict";

const el = id => document.getElementById(id);
const CROP_MOTION = globalThis.SCINTILLA_X_CROP_MOTION;
const DELIVERY_MS = CROP_MOTION.deliveryMs;
const PRESENTATION_MS = 120;
const RUN_MS = CROP_MOTION.durationMs;
const FIXTURE_WIDTH = 600;

const host = el("body");
const canvas = el("cv");
const context = canvas.getContext("2d", { alpha:false });
const fixture = new Image();
fixture.decoding = "async";
fixture.src = "./fixtures/x-feed-static.svg";

let smoothing = false;
let running = false;
let manualPaused = false;
let hoverPaused = false;
let hiddenPaused = document.visibilityState !== "visible";
let runStartedAt = 0;
let lastFrameAt = 0;
let deliveryAccumulator = 0;
let rawPosition = 0;
let visiblePosition = 0;
let lastVisiblePosition = 0;
let deliveries = 0;
let frames = 0;
let rawSamples = 0;
let smoothSamples = 0;
let maximumRawFrameGap = 0;
let maximumSmoothFrameGap = 0;
let maximumEndpointError = 0;
let overshootCount = 0;
let presentation = null;
let animationFrame = 0;

const replayBadge = document.createElement("div");
replayBadge.id = "testReplayBadge";
replayBadge.innerHTML = `<b>TEST REPLAY</b><span>STATIC X FIXTURE · NO LIVE CONNECTION</span>`;
host.append(replayBadge);

const telemetry = document.createElement("div");
telemetry.id = "testReplayTelemetry";
telemetry.innerHTML = `
  <span id="testReplayMode">SMOOTHING OFF</span>
  <span id="testReplayClock">60.0S</span>
  <span id="testReplayMotion">RAW MAX 0.0 · ON MAX 0.0 PX</span>
  <span id="testReplayEndpoint">ENDPOINT 0.000 PX</span>
  <b id="testReplayVerdict">RUNNING</b>`;
host.append(telemetry);

const offButton = el("bXList");
const onButton = el("bXNotify");
const restartButton = el("bXBack");
const pauseButton = el("bXRefresh");

document.querySelector(".k").textContent = "X · TEST REPLAY";
el("xfState").hidden = false;
el("xfState").textContent = "STATIC FIXTURE";
for (const button of [offButton, onButton]) {
  button.classList.remove("icon");
  button.innerHTML = "";
  button.style.display = "";
}
offButton.textContent = "SMOOTHING OFF";
onButton.textContent = "SMOOTHING ON";
restartButton.style.display = "";
restartButton.textContent = "RESTART 60S";
pauseButton.style.display = "";
pauseButton.textContent = "PAUSE";
el("bFull").textContent = "⛶";
document.body.classList.add("xfloat", "test-replay");

function paused() {
  return manualPaused || hoverPaused || hiddenPaused;
}

function createPresentation(at, position = rawPosition) {
  presentation?.stop({ at });
  presentation = new PaneXViewerPresentationCandidate({
    render(nextPosition) { visiblePosition = nextPosition; }
  });
  presentation.start({ position, at });
  presentation.setPaused("manual", manualPaused, at);
  presentation.setPaused("hover", hoverPaused, at);
  presentation.setPaused("hidden", hiddenPaused, at);
}

function setPresentationPause(reason, held, at = performance.now()) {
  if (reason === "manual") manualPaused = held;
  if (reason === "hover") hoverPaused = held;
  if (reason === "hidden") hiddenPaused = held;
  presentation?.setPaused(reason, held, at);
  pauseButton.textContent = manualPaused ? "RESUME" : "PAUSE";
}

function setSmoothing(next, at = performance.now()) {
  smoothing = Boolean(next);
  if (smoothing) createPresentation(at, rawPosition);
  else {
    presentation?.stop({ at });
    presentation = null;
    visiblePosition = rawPosition;
  }
  offButton.classList.toggle("on", !smoothing);
  onButton.classList.toggle("on", smoothing);
  el("testReplayMode").textContent = smoothing ? "SMOOTHING ON" : "SMOOTHING OFF";
}

function resetRun(at = performance.now()) {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  running = true;
  runStartedAt = at;
  lastFrameAt = at;
  deliveryAccumulator = 0;
  rawPosition = 0;
  visiblePosition = 0;
  lastVisiblePosition = 0;
  deliveries = 0;
  frames = 0;
  rawSamples = 0;
  smoothSamples = 0;
  maximumRawFrameGap = 0;
  maximumSmoothFrameGap = 0;
  maximumEndpointError = 0;
  overshootCount = 0;
  createPresentation(at, 0);
  setSmoothing(false, at);
  animationFrame = requestAnimationFrame(tick);
}

function deliver(at) {
  const previousRaw = rawPosition;
  const delivered = CROP_MOTION.samples[deliveries + 1];
  if (!delivered) return;
  rawPosition = delivered.visualPosition;
  deliveries += 1;
  if (smoothing) {
    presentation.receive({
      position:rawPosition,
      sequence:deliveries,
      deliveredAt:at,
      cadenceMs:PRESENTATION_MS
    });
    maximumEndpointError = Math.max(maximumEndpointError, presentation.snapshot().maximumEndpointError);
  } else {
    visiblePosition = rawPosition;
  }
  const low = Math.min(previousRaw, rawPosition);
  const high = Math.max(previousRaw, rawPosition);
  if (visiblePosition < low - 1e-9 || visiblePosition > high + 1e-9) overshootCount += 1;
}

function resizeCanvas() {
  const ratio = Math.min(1.25, devicePixelRatio || 1);
  const width = Math.max(280, Math.round(host.clientWidth * ratio));
  const height = Math.max(220, Math.round(host.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawFixture() {
  resizeCanvas();
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (!fixture.complete || !fixture.naturalWidth) return;
  const sourceHeight = Math.min(fixture.naturalHeight, canvas.height * FIXTURE_WIDTH / canvas.width);
  const maximumSourceY = Math.max(0, fixture.naturalHeight - sourceHeight);
  const sourceY = Math.max(0, Math.min(maximumSourceY, visiblePosition));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(fixture, 0, sourceY, FIXTURE_WIDTH, sourceHeight, 0, 0, canvas.width, canvas.height);
}

function paintTelemetry(at, complete = false) {
  const elapsed = Math.min(RUN_MS, Math.max(0, at - runStartedAt));
  el("testReplayClock").textContent = complete ? "60.0S COMPLETE" : `${((RUN_MS - elapsed) / 1000).toFixed(1)}S`;
  el("testReplayMotion").textContent = `RAW MAX ${maximumRawFrameGap.toFixed(1)} · ON MAX ${maximumSmoothFrameGap.toFixed(1)} PX`;
  el("testReplayEndpoint").textContent = `ENDPOINT ${maximumEndpointError.toFixed(3)} PX · ${deliveries} DELIVERIES`;
  const proofReady = rawSamples > 0 && smoothSamples > 0 && maximumEndpointError <= .01 && overshootCount === 0;
  el("testReplayVerdict").textContent = complete ? (proofReady ? "PASS" : "CHECK") : (paused() ? "PAUSED" : "RUNNING");
  el("testReplayVerdict").className = complete && proofReady ? "pass" : complete ? "check" : "";
  window.__SCINTILLA_X_TEST_REPLAY = Object.freeze({
    authority:"NONE",
    fixture:"LOCAL STATIC SVG",
    cropMetadata:CROP_MOTION.source,
    smoothing,
    running,
    paused:paused(),
    elapsedMs:elapsed,
    frames,
    deliveries,
    rawPosition,
    visiblePosition,
    rawSamples,
    smoothSamples,
    maximumRawFrameGap,
    maximumSmoothFrameGap,
    maximumEndpointError,
    overshootCount,
    verdict:complete ? (proofReady ? "PASS" : "CHECK") : "RUNNING"
  });
}

function tick(at) {
  if (!running) return;
  const delta = Math.min(100, Math.max(0, at - lastFrameAt));
  lastFrameAt = at;
  if (!paused()) {
    deliveryAccumulator += delta;
    while (deliveryAccumulator >= DELIVERY_MS) {
      deliver(at);
      deliveryAccumulator -= DELIVERY_MS;
    }
    if (smoothing) presentation.frame(at);
  }

  const frameGap = Math.abs(visiblePosition - lastVisiblePosition);
  if (smoothing) {
    smoothSamples += 1;
    maximumSmoothFrameGap = Math.max(maximumSmoothFrameGap, frameGap);
  } else {
    rawSamples += 1;
    maximumRawFrameGap = Math.max(maximumRawFrameGap, frameGap);
  }
  lastVisiblePosition = visiblePosition;
  frames += 1;
  drawFixture();

  if (at - runStartedAt >= RUN_MS) {
    running = false;
    presentation?.stop({ at });
    paintTelemetry(at, true);
    return;
  }
  paintTelemetry(at);
  animationFrame = requestAnimationFrame(tick);
}

offButton.addEventListener("click", () => setSmoothing(false));
onButton.addEventListener("click", () => setSmoothing(true));
restartButton.addEventListener("click", () => resetRun());
pauseButton.addEventListener("click", () => setPresentationPause("manual", !manualPaused));
host.addEventListener("pointerenter", () => setPresentationPause("hover", true));
host.addEventListener("pointerleave", () => setPresentationPause("hover", false));
window.addEventListener("blur", () => setPresentationPause("hover", false));
document.addEventListener("visibilitychange", () => setPresentationPause("hidden", document.visibilityState !== "visible"));
window.addEventListener("resize", drawFixture);

fixture.addEventListener("load", () => {
  drawFixture();
  resetRun();
}, { once:true });
