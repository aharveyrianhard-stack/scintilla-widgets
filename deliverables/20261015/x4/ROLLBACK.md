# X4 — the file to deploy, and the rollback (written 15 Oct 2026, before anything is deployed)

One file changes what anyone sees: the X pane, `station-shells/x-v2/index.html`. Nothing else is deployed or installed.

## The file

| | sha256 |
|---|---|
| Live today (`release/station-20261007` @ `180d125`; the X pane served at https://station.scintillahub.ai/station-shells/x-v2/, fetched 15 Oct 11:41Z, byte-identical) | `bd9cd9dc186770c144bd1f60ab56f4cddcb853237ace40b302a8845cc1825e33` |
| The build (`station/x4-rewind-on-the-bar-20261015`) | `c980f8fa688cf0165b555b5f4c8ead471698ab30cc4d98b52f7bb8c90525fa46` |

To deploy (Alan's word first, after the picture): merge the branch into the release line, or take that one file onto
it, and deploy the release the way the coordinator deploys a release. After the deploy, the served file's sha256 must
be `c980f8fa…25fa46`. The tests and the `deliverables/` folder do not change what anyone sees.

## To undo

Deploy `release/station-20261007` @ `180d125` again (or revert the X4 commit on the release line and deploy that); the
served X pane must hash to `bd9cd9dc…1825e33` again. Nothing else to clean up:

- no database table, row or setting changes with X4;
- the browser's saved choices are untouched: `sc.x.refresh.seconds` (the 30 / 60 / 90 s choice behind ⋯) is read and
  written exactly as before; the pace lives in the bridge;
- the X bridge is not touched (the iMac runs 0.7.27; X4 asks it for the same `rewind` it already answers).

## With the other bridge versions

The −30s button asks for the same thing as before (`rewind`), from the bar instead of the ⋯ panel. With 0.7.27 it moves
the feed back thirty seconds of its scrolling in one jump (measured: 358–359 of 360 px at 4×). With 0.7.26 or older it
would do what X3 measured for those (a glide the bridge's own scroll cuts short) — the place of the button changes
nothing there.

## The MacBook and the iMac

Nothing on either Mac was changed by this lane: no bridge folder, no browser, no job. The headless runs used throwaway
browser profiles in a temporary folder, removed at the end of each run.
