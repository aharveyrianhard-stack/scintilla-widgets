/* Read-only crop-motion metadata for the Station pane-X testing twin. */
(function installStaticCropReplay(root) {
  const deliveryMs = 100;
  const durationMs = 60_000;
  const deliveredStepPx = 5;
  const samples = Array.from(
    { length:durationMs / deliveryMs + 1 },
    (_, index) => Object.freeze({
      sequence:index,
      deliveredAtMs:index * deliveryMs,
      visualPosition:index * deliveredStepPx
    })
  );
  root.SCINTILLA_X_CROP_MOTION = Object.freeze({
    source:"LOCAL READ-ONLY CAPTURE METADATA",
    deliveryMs,
    durationMs,
    deliveredStepPx,
    samples:Object.freeze(samples)
  });
})(globalThis);
