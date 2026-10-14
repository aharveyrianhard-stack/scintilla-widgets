# X3 — rollback (written 13 Oct 2026, before anything is installed)

Branch `station/x3-fullscreen-and-rewind-20261013` changes **one thing that reaches a Mac**: the bridge folder, 0.7.26 → 0.7.27
(`station-x-bridge-draft/content.js` — the rewind; `manifest.json` — the version; `README.md`). Nothing on the Station page
changes for Alan: the X pane he has (`release/station-20261007` @ `180d125`) is untouched and nothing needs a deploy.
`x-health/index.html` on the branch names 0.7.27 as its target, as X2 named 0.7.26: it matters only if the Station is deployed
from this branch, and then it only changes which version the health page calls current.

## 1 · The bridge folder on the iMac (`~/Scintilla/SCINTILLA X Bridge`)

Installed now: 0.7.26 (X2, 13 Oct 00:41 ET).

**Before installing 0.7.27**, archive the loaded folder: copy `~/Scintilla/SCINTILLA X Bridge` to
`~/Scintilla/_archive/SCINTILLA X Bridge-0.7.26-<date>`.

To install 0.7.27: copy these files over the folder — `manifest.json`, `content.js`, `README.md` (the others are byte-identical to
0.7.26: `background.js`, `station-bridge.js`, `offscreen.html`, `offscreen.js`, `launch.js`, `icons/`). The bridge checks its
own folder once a minute and reloads itself at the first moment it feeds no pane; the 04:00 night job restarts Brave, which
loads whatever is in the folder, and presses Option+Shift+S. `/x-health` reports which version each browser runs.

To undo: copy the 0.7.26 archive folder back (or `git show 5bd4fa4:station-x-bridge-draft/content.js` and the same for
`manifest.json`), and restart Brave or reload the extension in brave://extensions — a downgrade does not load by itself.
What comes back is exactly tonight's behaviour: the rewind glides and is cut off by the next scroll step (12–55 px of 360 at 4×).

Nothing in the database changes. No saved choice of Alan's changes: the pace (`xFeedFloatSettings.speedPxPerSecond`,
settingsVersion 10) is read as it is; 0.7.27 writes nothing new.

## 2 · The Station

Nothing to roll back: no pane file, no deck file, no manifest, no service worker changes on this branch. The X pane and
the video pane are the files of X2 (which are X1's, waiting for Alan's eye) — unchanged by X3.

## 3 · The MacBook

Nothing on the MacBook was changed by this lane: no bridge folder, no browser, no job. The headless runs used throwaway
browser profiles in a temporary folder, removed at the end of each run.
