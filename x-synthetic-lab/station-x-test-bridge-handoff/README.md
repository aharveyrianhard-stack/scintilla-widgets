# SCINTILLA Station X TEST Bridge — isolated handoff

Status: package and review evidence only. It has not been installed, loaded
unpacked, activated, connected to X, paired, deployed, pushed, or merged.

This handoff turns the accepted presentation candidate into an end-to-end test
path for the public `scintilla-station-testing-surface` project. It deliberately
does not use the orange synthetic replay as evidence.

## Exact deliverables

- `package/scintilla-station-x-test-bridge/` — separately named Manifest V3
  extension package.
- `package/testing-receiver/pane-x/` — testing-host-only real pane-X receiver
  with the byte-identical presentation smoother and visible diagnostics.
- `RUNBOOK.md` — future install/activation sequence for an entirely separate
  Chrome profile.
- `PHYSICAL_PREREQUISITES.md` — exact devices, profile, tabs, sign-in, and
  receiver prerequisites.
- `SECURITY_REVIEW.md` — static manifest and authority-boundary review.
- `PACKAGE_SHA256SUMS` — review hashes for every emitted package file.
- `isolation-baseline.json` — hashes proving the stable Bridge draft, stable
  pane-X, and canonical smoother were not edited while this package was built.

Run `node build-test-bridge.mjs` to reproduce the checked-in package from the
known stable Bridge behavior and accepted presentation candidate. The builder
uses asserted single-occurrence anchors and fails closed if the source baseline
changes. `materialize-test-bridge.mjs` copies the two handoff directories only
to an explicit empty destination.

## Hard identities

- Extension name: `SCINTILLA Station X TEST Bridge`
- Extension ID fixed by the manifest public key:
  `jdefdcaphfolchojienigeeajfpinlfp`
- Allowed web origins: `https://x.com/*` and
  `https://scintilla-station-testing-surface.vercel.app/pane-x/*`
- Shortcut: `Option+Shift+T`
- Runtime protocol: `XTEST_*`
- Bridge session storage: `scintilla.testing.station.x-test.bridge.session.v1`
- Source settings storage: `scintilla.testing.station.x-test.source.settings.v1`
- Controller channel: `scintilla.testing.station.x-test.controller.v1`
- Trusted lab pair: `scintilla.testing.station.x-test.trusted-ipad.v1`
- Remote viewer identity:
  `scintilla.testing.station.x-test.remote-viewer.v1.<lab-pair>`
- Realtime room: `realtime:station-x-test-ipad:<lab-pair>`
- Offscreen message target: `scintilla-station-x-test-offscreen-v1`
- Source identity: fresh `xtest-source-*` identity in the dedicated test X
  document.
- Viewer/controller generations: fresh `xtest-viewer-*` and
  `xtest-controller-*` identities in the testing receiver.

## Preserved behavior

The extension derives source capture, stable crop/anchor baseline, pause,
capture-generation barrier, controller selection, multi-viewer fanout, and
viewer-only refresh from the existing Bridge draft. Only protocol, storage,
host, package, and diagnostic identities are changed. The presentation
smoother is present only in the testing receiver and consumes already-confirmed
crop endpoints; it does not modify source scrolling, capture cadence, crop
geometry, anchor behavior, pairing transport, or endpoint values.

The visible diagnostic strip reports source attachment and source identity,
viewer generation, last-frame age, reconnect count and reason, controller
ownership, exact offline cause, and the isolated room family.
