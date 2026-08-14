# Station testing surface · pane-X replay handoff

This bundle gives **STATION — TESTING SURFACE** a human-verifiable X motion
comparison inside the real `pane-x` markup, styling, canvas, and responsive
geometry. It is not the orange synthetic engineering page.

The surface has a permanent **TEST REPLAY** label, a local static X-like feed
fixture with fictional accounts, visible **SMOOTHING OFF** and **SMOOTHING ON**
buttons, pause/restart controls, a fixed 60-second clock, motion-gap telemetry,
endpoint error, delivery count, and a final PASS/CHECK readout.

## Isolation

The generated testing pane removes the entire production `pane-x` runtime and
loads only:

- the byte-identical candidate presentation core;
- explicit read-only 100ms crop-motion metadata for the full 60 seconds;
- the local replay runtime;
- the local read-only SVG fixture.

It contains no Bridge, WebRTC, Realtime, pairing, controller/tick, capture,
live source, source scrolling, crop discovery, anchor logic, websocket,
cross-window messaging, or external asset request. Stable/public `pane-x` is
read only and is used solely as the markup/CSS source for the generated twin.

## Handoff

Run `materialize-station-x-replay.mjs` with an explicit empty output directory.
It emits exactly:

1. `pane-x/index.html`
2. `pane-x/pane-x-presentation-core.js`
3. `pane-x/fixtures/x-crop-motion.js`
4. `pane-x/pane-x-test-replay.js`
5. `pane-x/fixtures/x-feed-static.svg`

The testing surface should serve the emitted directory and open `/pane-x/`.
No production file is modified or required at runtime.

## What Alan should inspect

1. Watch one avatar edge or line of text with **SMOOTHING OFF**. The feed holds
   briefly, then advances by each delivered crop position.
2. Select **SMOOTHING ON**. The same static feed and exact delivered endpoints
   remain, but the presentation advances every animation frame.
3. Hover the pane or press **PAUSE** to confirm the visible position freezes;
   leave/resume to continue.
4. Let the fixed clock complete. Endpoint error must remain `0.000 PX`,
   overshoot must remain zero in the exposed test state, and the final readout
   should show `PASS` after both modes have been sampled.
