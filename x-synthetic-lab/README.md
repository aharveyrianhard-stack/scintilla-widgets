# SCINTILLA X Synthetic Lab

This directory is a deliberately separate, synthetic-only X motion laboratory.

Isolation contract:

- It renders a deterministic local fixture only.
- It has no live account, capture, WebRTC, websocket, extension, Station, or iPad pairing integration.
- It cannot attach to or control an existing browser tab.
- Its on-screen telemetry reports only local replay state, frame, scroll,
  progress, cadence, loop count, and fixture size.
- It is deployed only as a non-production Vercel preview under a separately named project.
- Any future live-source capability requires separate authorization.

Run the bounded checks with `npm test`.
