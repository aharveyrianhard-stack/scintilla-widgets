# SCINTILLA X Synthetic Lab

This directory is a deliberately separate, synthetic-only X motion laboratory.

Isolation contract:

- It renders a deterministic local fixture only.
- It has no live account, capture, WebRTC, websocket, extension, Station, or iPad pairing integration.
- It cannot attach to or control an existing browser tab.
- Its on-screen telemetry reports only local replay state, continuous and
  stepped position, frame and delivery counts, step size, next-step timing,
  motion gap, loop counts, and fixture size.
- Its smoothness bench renders the same fixture twice at the same average speed:
  one view progresses every animation frame while the other holds and advances
  only at the selected 80–1000ms synthetic delivery cadence.
- A fixed 60-second visual run records maximum observed step and motion gap,
  then applies an explicitly lab-only six-pixel checklist. The on-screen guide
  explains where to look and makes clear that the heuristic is not production
  acceptance.
- It is deployed only as a non-production Vercel preview under a separately named project.
- Any future live-source capability requires separate authorization.

Run the bounded checks with `npm test`.
