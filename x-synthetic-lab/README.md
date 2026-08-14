# SCINTILLA X Synthetic Lab

This directory is a deliberately separate, synthetic-only X motion laboratory.

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
- A fixed 60-second visual run uses 80ms as the proven case and keeps 800ms as
  the coarse failure preset. It applies explicitly lab-only six-pixel motion-
  gap and 0.01-pixel endpoint-correctness checks. The on-screen guide makes
  clear that these heuristics are not production acceptance.
- It is deployed only as a non-production Vercel preview under a separately named project.
- Any future live-source capability requires separate authorization.

Run the bounded checks with `npm test`.
