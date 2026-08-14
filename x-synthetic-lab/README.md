# SCINTILLA X Synthetic Lab

This directory is a deliberately separate, synthetic-only X motion laboratory.
It is an engineering harness, not Alan's user-facing visual approval surface.

Isolation contract:

- It renders a deterministic local fixture only.
- It has no live account, capture, WebRTC, websocket, extension, Station, or iPad pairing integration.
- It cannot attach to or control an existing browser tab.
- Its on-screen telemetry reports only local replay state, reference/raw/
  interpolated positions, frame and delivery counts, cadence, current and
  maximum gaps, endpoint error, loop counts, and fixture size.
- Its smoothness bench renders the same fixture three ways at the same average
  speed: continuous reference, raw stepped delivery, and one-cadence-buffered
  interpolation that renders every animation frame and targets the exact raw
  delivered endpoints.
- `pane-x-viewer-candidate.mjs` is a lab-only, production-shaped copy of the
  pane-X presentation contract. It accepts already-delivered endpoints,
  replaces pending state with the newest delivery, clamps every rendered frame
  between delivered bounds, supports named manual/hover pauses, and stops or
  restarts cleanly. It has no source-scroll, capture, crop, transport, pairing,
  routing, receiver, or lifecycle authority and is not imported by stable X.
- `pane-x-presentation-core.js` is now the canonical implementation used by
  that adapter. `production-candidate/` provides an exact, fail-closed handoff
  that can materialize the same tested core plus narrow real-pane presentation
  wiring into a separate Station testing twin without writing stable `pane-x/`.
- `station-testing-surface-handoff/` is the human-verifiable twin artifact. It
  keeps the real pane-X markup and canvas geometry, removes the production
  runtime entirely, and replays a local static X-like feed plus explicit
  read-only crop-motion metadata behind visible smoothing OFF/ON controls.
- A fixed 60-second visual run uses 80ms as the proven case and keeps 800ms as
  the coarse failure preset. It applies explicitly lab-only six-pixel motion-
  gap and 0.01-pixel endpoint-correctness checks. The on-screen guide makes
  clear that these heuristics are not production acceptance.
- It is deployed only as a non-production Vercel preview under a separately named project.
- Any future live-source capability requires separate authorization.

Run the bounded checks with `npm test`.
