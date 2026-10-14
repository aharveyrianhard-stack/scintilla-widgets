# SCINTILLA Station X Bridge — local unadmitted draft

Status: local development evidence only. Alan explicitly loaded this unpacked
draft in his normal Chrome for same-device proof. It is not merged, pushed, or
deployed.

## Product boundary

This is a purpose-built helper for the X box inside SCINTILLA Station. It borrows the useful behavior recovered from X Feed Float—timeline crop, smooth scrolling, pause, refresh, rewind, and source switching—but it is a separate extension with a separate identity and shortcut.

The installed **X Feed Float 0.6.7** remains untouched and can continue running on another screen. The Station helper is **SCINTILLA Station X Bridge 0.7.8** and uses `Option+Shift+S`, not X Feed Float's `Option+Shift+P`. Version 0.7.8 keeps the approved X source capture alive across Station reloads, duplicate display tabs, and Chrome extension-worker sleep; treats same-pane `READY` messages as heartbeats rather than reconnects; and clocks the scroll from the visible Station pane so Chrome cannot throttle it as a hidden-tab animation. Repeating the shortcut reconnects instead of toggling the capture off.

## Visible behavior

1. Station keeps its existing five-box layout.
2. A dedicated signed-in `x.com` tab is the Station source.
3. One `Option+Shift+S` invocation connects that tab after Chrome starts. A
   normal Station reload reattaches that approved capture during a short grace
   period instead of requiring another invocation.
4. The live feed is cropped and fitted inside the existing fifth box. Alan does not drag, float, or resize it.
5. Station controls rewind 30 seconds and refresh.
6. Hovering the Station pane temporarily pauses scrolling; leaving it resumes.
7. The visible Station pane supplies a 30 Hz wall clock to both source scrolling and crop metadata. This matches the original float's visible-window clock and avoids background-tab animation throttling.

Chrome requires a user invocation before `chrome.tabCapture` may start. That one invocation after a browser restart is the remaining browser-security boundary; the pane itself is otherwise hands-off.

## Architecture

- `background.js`: binds the user-invoked dedicated X tab to the current Station pane.
- `content.js`: applies the recovered X timeline crop and scrolling behavior to the dedicated source tab.
- `offscreen.html` / `offscreen.js`: consumes Chrome's privileged tab stream inside the extension origin.
- `station-bridge.js`: relays crop metadata, controls, and the local WebRTC negotiation.
- `../pane-x/index.html`: renders the received video into the exact Station box and crops it on canvas.

The private extension media context is necessary because Chrome does not permit an ordinary webpage to consume a privileged extension stream directly. No X pixels are uploaded to a server.

## Verification

- Four background routing tests pass.
- Manifest and all JavaScript files pass syntax checks.
- A fresh temporary Chrome profile loaded both extensions simultaneously with distinct IDs:
  - X Feed Float 0.6.7: `pbpgkcfiefokoeobomnlfdndadchkpll`
  - SCINTILLA Station X Bridge 0.7.2: `niobhomgbnonikgnjlndjchkdacfkdei` in the isolated proof profile
- Real Chrome proved extension action -> offscreen tab capture -> local WebRTC -> Station iframe -> fitted canvas.
- The visible fixture produced a 459.6 × 599 source crop fitted into the fifth box.
- Auto-scroll moved; pause held scroll position exactly; resume restarted it.
- Proof screenshot: `../station-x-visible-crop-proof.png`.

The visible proof used a synthetic X-origin feed because the temporary Chrome profile intentionally had none of Alan's cookies or accounts. The transport, crop, controls, and simultaneous-extension separation are real; the final signed-in proof belongs in Alan's normal Chrome only after the helper and Station change are admitted and installed.

## Current untouched state

- Alan's installed X Feed Float: unchanged.
- Alan's normal Chrome profile: locally loaded with this unpacked draft by
  explicit request; no packaged or store installation.
- Production Station: unchanged.
- GitHub and Vercel: unchanged.
- Google/YouTube authorization: unrelated to this X pane and unchanged.

## 0.7.24 (ST3, 6 Oct 2026) — the picture says how far it has scrolled; the pace is a choice

- While it feeds a Station pane, the source paints a row of fifteen black and white squares (120 × 8 px) in the
  top-left corner of the X window: its scroll position, repainted in the same frame as every scroll. The corner
  is in the captured picture and outside the column the viewers show. The pane (`station-shells/x-v2`) reads it
  from the frame it is about to paint, so the crop and the picture can no longer be one step apart (measured
  headlessly: about one backward hop a second before, none after). No square row when the source crops its own
  track or when the column sits in that corner; a pane that cannot read it behaves as with 0.7.23.
- New control `speed` (the pane's ⋯ → scroll 1× · 2× · 4× = 3 · 6 · 12 px/s), saved with the other settings,
  bounded 0.5–30 px/s like the float's own slider. Every crop reports `speedPxPerSecond` and `scrollCode`.
- Install: copy this folder over the loaded one and reload the extension once in each browser that feeds a
  Station; `/x-health` shows which browsers still run an older bridge.
- Measured with `deliverables/20261006/st3/tools/xscroll.mjs` (headless; a stand-in X page). Not yet seen on real X.


## 0.7.25 (X1, 12 Oct 2026) — the crop is the post column again, not the whole timeline column

- Alan, 12 Oct 23:10 ET, on 0.7.24 installed on the iMac: "now there's a bunch of black space to the left. There can
  never be the black space. It needs to be sized properly for the screen. I never asked to change any of that. Now it
  looks tiny." The iMac was put back to 0.7.21 at 23:16.
- `calculateCropRect` starts the crop where the post text starts (0.7.21's left edge: the avatar rail, hidden in
  capture mode and black on a black X, is out) and stops 8 px short of the column's right border (0.7.21 stopped 18 px
  short and cut the ··· menu and the end of a long line). At the iMac's parameters (X window 1062 × 640, the column
  115..427, text from 180): 0.7.21 = 180, 54, 229 × 586 · 0.7.24 = 115, 54, 312 × 586 · 0.7.25 = 180, 54, 239 × 586.
- Nothing else changes: the scroll code, the page-up refresh and the pace control of 0.7.23/0.7.24 stay. The pane's
  pace row now offers 8× (24 px/s) as well; the bridge's bound (0.5–30 px/s) already allowed it.
- Install (the iMac): copy this folder's files over `~/Scintilla/SCINTILLA X Bridge` — manifest.json, background.js,
  content.js, station-bridge.js, offscreen.html, offscreen.js, launch.js, icons/ (README.md is harmless; tests/ is not
  needed). The bridge watches its own folder once a minute and reloads itself at the first moment it feeds no pane
  (a Station reload is such a moment); the 04:00 night job restarts Brave, which loads whatever is in the folder, and
  presses Option+Shift+S. Back out: copy `~/Scintilla/_archive/SCINTILLA X Bridge-0.7.21-20261012-2300` over the folder.

## 0.7.26 (X2, 13 Oct 2026) — the pace now, no timed reload, and not one pixel of the picture changed

- Alan, 13 Oct ~00:15 ET: "I would prefer the speed control to go on there ... I need this to be faster than it is right now,
  quite a bit faster ... Forget about the page updates. Let's leave it without page updates ... No reload for now."
  So this build goes on the iMac by itself: the Station page stays exactly as deployed.
- **The picture is 0.7.21's, exactly.** `calculateCropRect` uses 0.7.21's own rule again (`Math.min(18, baseWidth * 0.06)`):
  at the iMac's parameters 180, 54, 229 x 586. X1's 239-wide crop (0.7.25) waits for his eye together with X1's pane.
- **The pace.** The first session of this build starts at 12 px/s (four times the calm pace); `settingsVersion` 10 is saved,
  so whatever he then picks on the pane's row (the deployed pane offers 1x 2x 4x) is kept.
- **No timed reload.** The deployed pane asks for "a page up" every 60 seconds. `STATION_TIMED_PAGE_UP_ON = false`: the source
  declines it (`declineTimedPageUp` moves the sequence number, so the pane's short hold ends at once) and nothing moves.
  The pane's refresh button is a different request and still refreshes. Turn the switch on only with his word on how often.
- Install: the same files as 0.7.25 (only `manifest.json`, `content.js` and this file differ). Back-out: copy
  `~/Scintilla/_archive/SCINTILLA X Bridge-0.7.21-20261012-2300` back and restart Brave.

## 0.7.27 (X3, 13 Oct 2026) — the rewind is a jump, not a glide

- Alan, 13 Oct ~21:00 ET, on 0.7.26: "this button for minus 60 seconds on the Twitter scrolling is not working. I don't think it
  even clicks." The button is the pane's −30s (⋯ panel); its request did leave the pane and did reach this bridge every time.
- **The cause.** `rewindFeed` was a *smooth* `scrollBy` of pace × 30 px. A smooth scroll is cancelled by the next assignment to
  `scrollTop`, and the Station tick makes one every whole pixel: every 83 ms at 12 px/s. Measured headless with the deployed pane
  (`deliverables/20261013/x3`): at 4× the feed went back 12–55 px of the 360 asked and carried on; at 1× 89 of 90, because the
  whole glide fits between two ticks. So at the pace he runs it looked like nothing.
- **The fix.** The rewind is now the same kind of move as the page-up: an instant scroll of pace × 30 px (360 at 4×, 90 at 1×,
  720 at 8×), never above the top, the slow scroll's phase reset, the scroll code repainted in the same frame, the crop re-sent.
  Measured after: 358 of 360 at 4×, 89–90 of 90 at 1×, pointer on the pane or off it. The float's own −30s is the same function.
- Nothing else changes: the crop (180, 54, 229 × 586 at the iMac), the pace and the declined timed page-up of 0.7.26 are as they were.
- Install: the same files as 0.7.25 (only `manifest.json`, `content.js` and this file differ from 0.7.26). Archive the loaded
  0.7.26 folder first (`~/Scintilla/_archive/SCINTILLA X Bridge-0.7.26-<date>`); back-out is that folder copied back, or
  `git show 5bd4fa4:station-x-bridge-draft/<file>`, and a Brave restart (a downgrade does not load by itself).
