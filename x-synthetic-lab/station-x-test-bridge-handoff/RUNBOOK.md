# Separate-profile install and activation runbook

This is a future manual runbook. The package build did not execute any step.

## A. Admit only the testing receiver

1. Materialize the handoff into an empty review directory.
2. Verify every emitted file against `PACKAGE_SHA256SUMS`, then review the two
   receiver files under `testing-receiver/pane-x/`.
3. In the `scintilla-station-testing-surface` project only, replace its replay
   pane with those two files and deploy that testing project. Do not deploy the
   stable Station project.
4. Confirm the public receiver URL is exactly
   `https://scintilla-station-testing-surface.vercel.app/pane-x/` and its title
   is `SCINTILLA · X TEST receiver`.

## B. Create the isolated Chrome profile

1. Quit any accidental test-profile Chrome process, then create a new profile
   named `SCINTILLA X TEST LAB` through Chrome's profile picker.
2. Confirm the stable Station X Bridge is not installed in this profile and no
   stable Station or stable X source tab is open.
3. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
   and select only `package/scintilla-station-x-test-bridge/`.
4. Confirm the visible extension name is `SCINTILLA Station X TEST Bridge`,
   version `0.1.0`, ID `jdefdcaphfolchojienigeeajfpinlfp`, and shortcut
   `Option+Shift+T`. Stop if any value differs.

## C. Create the test-only source and desktop receiver

1. In this profile only, open one dedicated `https://x.com/home` tab and sign
   in manually to the intended test account/session.
2. Open `https://scintilla-station-testing-surface.vercel.app/` in a second tab.
3. Confirm the Station page says `TESTING SURFACE · NOT STABLE` and the X pane
   shows the orange-brown `TEST RECEIVER · candidate smoothing ON` diagnostic
   strip.
4. Return to the dedicated X tab and invoke `Option+Shift+T` once. Do not click
   the installed stable Bridge and do not reuse any stable source tab.
5. Return to the testing Station tab. Require:
   - source `ATTACHED`;
   - source identity begins `xtest-source-`;
   - viewer generation begins `xtest-viewer-`;
   - frame age updates continuously;
   - controller is `OWNER` or `MIRROR` with an `xtest-controller-` identity;
   - offline cause is `NONE`.

## D. Add the testing iPad through the lab pair

1. In the testing X pane, choose `pair iPad` and copy the generated link.
2. Confirm the link begins with
   `https://scintilla-station-testing-surface.vercel.app/pane-x/?x-test=1&remote=1&view=ipad`.
3. Open only that link on the testing iPad. Do not open or overwrite the stable
   `station-ipad` pair.
4. Require `REMOTE · NO TICK` on the iPad receiver; only desktop testing panes
   participate in the separate controller election.
5. Confirm both desktop and iPad show the same lab source and crop endpoints.

## E. End-to-end flash diagnosis

1. Watch source attachment, frame age, reconnect counter/reason, controller,
   and offline cause while refreshing the desktop testing surface once.
2. Refresh the testing iPad once. Its viewer generation must change without
   restarting the desktop source.
3. If a flash occurs, record the exact diagnostic strip before and after it:
   source identity, viewer generation, frame age, reconnect count/reason,
   controller identity, and offline cause.
4. A source identity change means source capture restarted. An unchanged source
   identity with a new viewer generation means receiver-only renewal. A rising
   frame age without generation change isolates a stalled media path. The exact
   offline cause distinguishes media end/stale, Realtime loss, and receiver
   error.

## F. Teardown

1. Stop the test capture from the testing pane.
2. Close the dedicated test X source and testing Station tabs.
3. Remove the unpacked TEST Bridge or delete the entire test Chrome profile.
4. Clear only the testing iPad site data if desired. Never clear or replace the
   stable durable pair as part of this test.
