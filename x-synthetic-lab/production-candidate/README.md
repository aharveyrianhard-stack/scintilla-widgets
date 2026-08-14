# pane-X presentation candidate handoff

Status: isolated candidate only. Nothing in `pane-x/`, Station, Bridge, the X
source, crop/anchor logic, pairing, iPad, routing, capture, or receiver
lifecycle is modified by this directory.

The orange synthetic page is an engineering harness, not Alan's visual
approval surface. This handoff is intended for the separate Station testing
twin.

## Exact proposed production files

1. `pane-x/pane-x-presentation-core.js` — new file. Its bytes are identical to
   `x-synthetic-lab/pane-x-presentation-core.js` (SHA-256
   `e3863b888f74a2c81ba9fa3c5c2b1c44f05c72dc9d304b8dc38f775248c48fa3`).
2. `pane-x/index.html` — narrow presentation wiring only:
   - load the core;
   - replace `viewerCropMotion` state with the presentation candidate;
   - feed only `viewerCropState.confirmedCrop` visual positions into it;
   - map rendered scalar positions back to `fractionalScrollOffset` without
     changing delivered crop objects or endpoint values;
   - apply named hover, manual, and hidden holds;
   - use the existing display-rate paint branch only while the candidate is
     moving;
   - stop/restart only the presentation object alongside the existing viewer
     presentation reset.

`build-pane-x-candidate.mjs` is the exact diff specification. Every edit is an
asserted single-occurrence replacement against the current stable
`pane-x/index.html`; an anchor mismatch fails closed. The new production core
is taken directly from the tested canonical lab file, so the two cannot drift.

`materialize-pane-x-candidate.mjs` writes the two proposed files to an explicit
empty output directory for the testing twin. It never writes to stable
`pane-x/`.

## Explicit exclusions

The candidate does not change source scrolling, crop geometry, anchor logic,
capture constraints, source/delivery cadence, the 10Hz fallback, the 80ms
(12.5fps) idle paint cap, pairing, routing, Bridge, iPad, receiver lifecycle,
or endpoint values. It creates no transport or browser-control capability.

## Verification

- `npm --prefix x-synthetic-lab test`
- `node --test station-x-bridge-draft/tests/*.test.mjs`

Focused candidate checks cover exact endpoints, bidirectional no-overshoot,
newest-delivery replacement, hover/manual named holds, hidden/resume, inert
stop and clean restart, canonical-core byte identity, exact production-file
scope, and unchanged authority-bearing functions and cadence literals.
