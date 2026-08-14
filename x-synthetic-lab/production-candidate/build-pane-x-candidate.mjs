import assert from "node:assert/strict";

export const productionFileSummary = Object.freeze([
  {
    file: "pane-x/pane-x-presentation-core.js",
    change: "Add the byte-identical, lab-proven scalar presentation core."
  },
  {
    file: "pane-x/index.html",
    change: "Route only confirmed crop presentation through the core; retain every source, crop, clock, capture, pairing, routing, and receiver path."
  }
]);

function replaceExact(source, before, after, label) {
  const first = source.indexOf(before);
  assert.notEqual(first, -1, `candidate anchor missing: ${label}`);
  assert.equal(source.indexOf(before, first + before.length), -1, `candidate anchor repeated: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function buildPaneXCandidate(stableIndex, canonicalCore) {
  let index = stableIndex;

  index = replaceExact(index,
    `<script>\n"use strict";`,
    `<script src="./pane-x-presentation-core.js"></script>\n<script>\n"use strict";`,
    "load presentation core"
  );

  index = replaceExact(index,
    `let viewerCropMotion = null;`,
    `let viewerCropPresentation = null;\nlet viewerCropPresentationCrop = null;\nlet viewerCropPresentationSequence = 0;`,
    "presentation state"
  );

  index = replaceExact(index,
    `function syncViewerConfirmedCrop(at) {\n  const next = viewerCropState.confirmedCrop;\n  if (!next) { xfloatCrop = null; viewerCropMotion = null; return null; }\n  if (!viewerCropMotion || viewerCropMotion.to !== next) viewerCropMotion = beginCropMotion(viewerCropMotion, next, at);\n  xfloatCrop = cropAtMotion(viewerCropMotion, at) || next;\n  return xfloatCrop;\n}`,
    `function stopViewerCropPresentation(at = performance.now()) {\n  viewerCropPresentation?.stop({ at });\n  viewerCropPresentation = null;\n  viewerCropPresentationCrop = null;\n  viewerCropPresentationSequence = 0;\n}\nfunction startViewerCropPresentation(crop, at) {\n  viewerCropPresentationCrop = crop;\n  viewerCropPresentation = new PaneXViewerPresentationCandidate({\n    render(position) {\n      if (!viewerCropPresentationCrop) return;\n      xfloatCrop = Object.assign({}, viewerCropPresentationCrop, {\n        fractionalScrollOffset:position - cropSourceScrollTop(viewerCropPresentationCrop)\n      });\n    }\n  });\n  viewerCropPresentation.start({ position:cropVisualPositionFor(crop), at });\n  viewerCropPresentation.setPaused("hidden", document.visibilityState !== "visible", at);\n  viewerCropPresentation.setPaused("hover", stationHoverInside, at);\n  viewerCropPresentation.setPaused("manual", Boolean(crop?.paused), at);\n  return xfloatCrop;\n}\nfunction setViewerPresentationPause(reason, held, at = performance.now()) {\n  viewerCropPresentation?.setPaused(reason, held, at);\n}\nfunction syncViewerConfirmedCrop(at) {\n  const next = viewerCropState.confirmedCrop;\n  if (!next) { stopViewerCropPresentation(at); xfloatCrop = null; return null; }\n  if (!viewerCropPresentation) return startViewerCropPresentation(next, at);\n  if (viewerCropPresentationCrop !== next) {\n    const visible = xfloatCrop || viewerCropPresentationCrop;\n    if (!cropsCanEase(visible, next)) return startViewerCropPresentation(next, at);\n    viewerCropPresentationCrop = next;\n    viewerCropPresentation.setPaused("manual", Boolean(next.paused), at);\n    viewerCropPresentation.receive({\n      position:cropVisualPositionFor(next),\n      sequence:++viewerCropPresentationSequence,\n      deliveredAt:at,\n      cadenceMs:VIEWER_CROP_EASE_MS\n    });\n  }\n  viewerCropPresentation.frame(at);\n  return xfloatCrop;\n}`,
    "confirmed crop presentation"
  );

  index = replaceExact(index,
    `function setStationHoverPause(held) {\n  stationHoverInside = Boolean(held);`,
    `function setStationHoverPause(held) {\n  stationHoverInside = Boolean(held);\n  setViewerPresentationPause("hover", stationHoverInside);`,
    "hover presentation hold"
  );

  index = replaceExact(index,
    `  viewerCropMotion = null;\n  xfloatCrop = null;`,
    `  stopViewerCropPresentation();\n  xfloatCrop = null;`,
    "presentation stop"
  );

  index = replaceExact(index,
    `  const motionActive = viewerCropMotion?.duration && paintAt - viewerCropMotion.startedAt < viewerCropMotion.duration;`,
    `  const presentation = viewerCropPresentation?.snapshot();\n  const motionActive = presentation?.running && !presentation.paused && presentation.position !== presentation.target;`,
    "display-rate presentation paint"
  );

  index = replaceExact(index,
    `window.addEventListener("visibilitychange", () => {\n  if (document.visibilityState !== "visible") setStationHoverPause(false);`,
    `window.addEventListener("visibilitychange", () => {\n  const pageVisible = document.visibilityState === "visible";\n  setViewerPresentationPause("hidden", !pageVisible);\n  if (!pageVisible) setStationHoverPause(false);`,
    "hidden presentation hold"
  );

  return new Map([
    ["pane-x/index.html", index],
    ["pane-x/pane-x-presentation-core.js", canonicalCore]
  ]);
}
