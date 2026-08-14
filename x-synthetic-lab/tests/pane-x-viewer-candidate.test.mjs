import assert from "node:assert/strict";
import test from "node:test";

import { PaneXViewerPresentationCandidate } from "../pane-x-viewer-candidate.mjs";

function candidate() {
  const paints = [];
  const viewer = new PaneXViewerPresentationCandidate({
    render: (position, meta) => paints.push({ position, ...meta })
  });
  return { viewer, paints };
}

test("candidate preserves every accepted endpoint exactly", () => {
  const { viewer, paints } = candidate();
  viewer.start({ position: 0, at: 0 });
  assert.equal(viewer.receive({ position: 10, sequence: 1, deliveredAt: 80, cadenceMs: 80 }), true);
  assert.equal(viewer.frame(120), 5);
  assert.equal(viewer.receive({ position: 20, sequence: 2, deliveredAt: 160, cadenceMs: 80 }), true);
  assert.equal(viewer.snapshot().position, 10);
  assert.equal(viewer.frame(240), 20);
  assert.equal(viewer.snapshot().maximumEndpointError, 0);
  assert.equal(paints.some(paint => paint.kind === "endpoint" && paint.position === 10), true);
});

test("manual and hover pause reasons freeze presentation without losing the newest target", () => {
  const { viewer } = candidate();
  viewer.start({ position: 0, at: 0 });
  viewer.receive({ position: 8, sequence: 1, deliveredAt: 80, cadenceMs: 80 });
  assert.equal(viewer.frame(100), 2);
  viewer.setPaused("hover", true, 100);
  viewer.setPaused("manual", true, 100);
  assert.equal(viewer.frame(150), 2);
  viewer.receive({ position: 16, sequence: 2, deliveredAt: 160, cadenceMs: 80 });
  assert.equal(viewer.snapshot().target, 16);
  viewer.setPaused("hover", false, 200);
  assert.equal(viewer.snapshot().paused, true);
  viewer.setPaused("manual", false, 220);
  assert.equal(viewer.frame(260), 9);
});

test("newest delivery replaces pending state and stale delivery is ignored", () => {
  const { viewer } = candidate();
  viewer.start({ position: 0, at: 0 });
  viewer.setPaused("hover", true, 0);
  assert.equal(viewer.receive({ position: 5, sequence: 1, deliveredAt: 80, cadenceMs: 80 }), true);
  assert.equal(viewer.receive({ position: 9, sequence: 2, deliveredAt: 100, cadenceMs: 80 }), true);
  assert.equal(viewer.receive({ position: 7, sequence: 1, deliveredAt: 110, cadenceMs: 80 }), false);
  assert.deepEqual(viewer.snapshot().pauseReasons, ["hover"]);
  assert.equal(viewer.snapshot().latestSequence, 2);
  assert.equal(viewer.snapshot().target, 9);
});

test("candidate never overshoots upward or downward endpoints", () => {
  const { viewer } = candidate();
  viewer.start({ position: 0, at: 0 });
  viewer.receive({ position: 10, sequence: 1, deliveredAt: 80, cadenceMs: 80 });
  assert.equal(viewer.frame(1000), 10);
  viewer.receive({ position: 0, sequence: 2, deliveredAt: 160, cadenceMs: 80 });
  assert.equal(viewer.frame(1000), 0);
  assert.equal(viewer.frame(-1000), 10);
});

test("candidate stops inertly and restarts from a clean presentation state", () => {
  const { viewer } = candidate();
  viewer.start({ position: 0, at: 0 });
  viewer.receive({ position: 8, sequence: 1, deliveredAt: 80, cadenceMs: 80 });
  viewer.frame(120);
  viewer.stop({ at: 120 });
  const stopped = viewer.snapshot();
  viewer.frame(200);
  assert.equal(viewer.snapshot().renderCount, stopped.renderCount);
  assert.equal(viewer.receive({ position: 12, sequence: 2, deliveredAt: 220, cadenceMs: 80 }), false);

  viewer.start({ position: 4, at: 300 });
  assert.deepEqual(viewer.snapshot(), {
    running: true,
    position: 4,
    from: 4,
    target: 4,
    latestSequence: -1,
    endpointChecks: 0,
    maximumEndpointError: 0,
    paused: false,
    pauseReasons: [],
    renderCount: 1
  });
});
