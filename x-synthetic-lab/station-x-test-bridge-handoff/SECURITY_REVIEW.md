# Static manifest and security review

Review target: `package/scintilla-station-x-test-bridge/manifest.json` and the
paired testing receiver. No extension was loaded and no network connection was
made during this review.

## Manifest boundary

| Item | Admitted | Rejected |
| --- | --- | --- |
| Package identity | `SCINTILLA Station X TEST Bridge`, fixed ID `jdef…nlfp` | Stable Bridge name/ID/path |
| Source host | `https://x.com/*` | `twitter.com`, localhost, other sites |
| Viewer host | canonical testing project `/pane-x/*` only | stable Station, preview aliases, other Vercel projects |
| Privileges | active gesture, offscreen capture, scripting, extension storage, tab capture, window handoff | cookies, history, downloads, clipboard, broad web access |
| Shortcut | `Option+Shift+T` | stable shortcut |

The permission set matches the known capture behavior, but the web authority is
narrower. Manifest matching is backed by runtime sender validation: every
`XTEST_*` message must originate from exact `x.com`, the exact testing pane, or
the extension's own offscreen URL according to message role.

Chrome evaluates host permissions at origin granularity even when a path is
written in the match pattern. The package therefore repeats the `/pane-x/`
restriction in both the content-script match and runtime URL validation; no
other route on the admitted testing origin can register as a receiver.

## Namespace and lifecycle boundary

- Chrome extension storage is physically separated by the fixed test extension
  ID, then logically separated again by `scintilla.testing.station.x-test.*`
  keys.
- Runtime/page messages use `XTEST_*`; no `XFF_*` message is accepted or sent.
- Dynamic reinjection uses `station-test-bridge.js` and a test-only page global.
- The offscreen document lives under the test extension origin and accepts only
  target `scintilla-station-x-test-offscreen-v1`.
- Desktop clock election, lab pair, remote viewer, receiver generation, source
  identity, and Realtime topic all have test-only identities.
- The iPad link targets the testing pane receiver directly; it neither reads
  nor writes the stable durable pair route.

## Presentation and source authority

The testing receiver loads the canonical presentation core with SHA-256
`e3863b888f74a2c81ba9fa3c5c2b1c44f05c72dc9d304b8dc38f775248c48fa3`.
It smooths presentation only between confirmed crop positions and retains the
existing hover/manual/hidden holds. The source content script is mechanically
derived from the known Bridge baseline; its crop geometry, anchor correction,
scroll cadence, capture-generation barrier, and pause logic are unchanged.

## Residual risks and controls

1. An unpacked extension retains powerful tab-capture and scripting privileges.
   Control: load it only in the disposable test profile and remove that profile
   after the run.
2. X credentials exist in the test profile after manual sign-in. Control: use a
   deliberate test session and never copy the stable profile directory.
3. The publishable Realtime endpoint is shared infrastructure. Control: topic,
   pair, code, viewer, and receiver generation are all lab-only; media remains
   peer-to-peer and no X pixels are uploaded to Realtime.
4. A canonical public-host change makes the package stop working. Control:
   update and re-review both manifest and runtime host constants together; do
   not widen to `*.vercel.app`.

Static verdict: suitable for isolated testing-surface evaluation after manual
review and explicit activation. Not suitable for production or stable-profile
installation.
