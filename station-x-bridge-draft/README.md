# SCINTILLA Station X Bridge — local unadmitted draft

Status: local development evidence only. Alan explicitly loaded this unpacked
draft in his normal Chrome for same-device proof. It is not merged, pushed, or
deployed.

## Product boundary

This is a purpose-built helper for the X box inside SCINTILLA Station. It borrows the useful behavior recovered from X Feed Float—timeline crop, smooth scrolling, pause, refresh, rewind, and source switching—but it is a separate extension with a separate identity and shortcut.

The installed **X Feed Float 0.6.7** remains untouched and can continue running on another screen. The Station helper is **SCINTILLA Station X Bridge 0.7.3** and uses `Option+Shift+S`, not X Feed Float's `Option+Shift+P`.

## Visible behavior

1. Station keeps its existing five-box layout.
2. A dedicated signed-in `x.com` tab is the Station source.
3. One `Option+Shift+S` invocation connects that tab after Chrome starts. A
   normal Station reload reattaches that approved capture during a short grace
   period instead of requiring another invocation.
4. The live feed is cropped and fitted inside the existing fifth box. Alan does not drag, float, or resize it.
5. Station controls rewind 30 seconds and refresh.
6. Hovering the Station pane temporarily pauses scrolling; leaving it resumes.
7. Crop metadata relays at about 30 Hz instead of the former stepped 10 Hz.

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
