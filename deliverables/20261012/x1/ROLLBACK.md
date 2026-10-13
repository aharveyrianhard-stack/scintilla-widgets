# X1 — rollback (written 12 Oct 2026, before anything is installed)

Two separate things can be installed from branch `station/x1-pace-refresh-20261012`; each is undone on its own.

## 1 · The Station (the pane `station-shells/x-v2` and the health page `x-health`)

Live before X1: `release/station-20261007` @ `180d125` (the X pane served at
https://station.scintillahub.ai/station-shells/x-v2/ is byte-identical to that commit's file, sha256
`bd9cd9dc…1825e33`, checked 12 Oct 23:20 ET).

To undo a Station deploy of X1: deploy `release/station-20261007` @ `180d125` again (the same deploy step the
coordinator uses for a release), or revert the X1 merge commit on the release branch and deploy that. Nothing in the
database changes with X1; no table, no row, no setting. Alan's saved choices in the browser (`localStorage`):
`sc.x.refresh.seconds` — X1 writes 300 / 900 / 1800 / 0 there; the old pane reads any of those as its default 60 s, so
going back needs no cleanup. The pace is kept by the bridge, not the pane.

What the old pane shows with the NEW bridge (0.7.25), should the Station be rolled back but the bridge not: the crop
180, 54, 239 × 586 drawn 247 CSS px wide with the old 4 px margin — the text 4.2% smaller than today's, no black space.

## 2 · The bridge folder on the iMac (`~/Scintilla/SCINTILLA X Bridge`)

Installed today: 0.7.21, restored 12 Oct 23:16 ET from `~/Scintilla/_archive/SCINTILLA X Bridge-0.7.21-20261012-2300`.

To undo an install of 0.7.25: copy that archive folder's files over `~/Scintilla/SCINTILLA X Bridge` again
(manifest.json, background.js, content.js, station-bridge.js, offscreen.html, offscreen.js, launch.js, icons/).
The bridge checks its own folder once a minute and reloads itself only when the folder's version is NEWER than the one
loaded (and only while it feeds no pane) — so a downgrade does not load by itself. Two ways to make it load: press the
extension's reload in brave://extensions and then Option+Shift+S in the X window (Alan's hands, or the coordinator's
over screen sharing), or let the 04:00 night job restart Brave, which loads whatever is in the folder and presses
Option+Shift+S itself. The health page (`/x-health`) says which version each browser runs.

What the new pane shows with the OLD bridge (0.7.21), should the bridge be rolled back but the Station not: the crop
180, 54, 229 × 586 drawn edge to edge — the text 3.3% larger than today's, no black space, the pace row hidden
(1× only), the refresh choices 5 / 15 / 30 min / off still work (the page-up is answered by 0.7.21's plain refresh).

## 3 · The MacBook

Nothing on the MacBook was changed by this lane: no bridge folder, no browser, no job. The headless runs used throwaway
browser profiles in a temporary folder, removed at the end of each run.
