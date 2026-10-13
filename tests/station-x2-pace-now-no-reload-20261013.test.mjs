/* X2 (13 Oct 2026) - bridge 0.7.26, installed on the iMac WITHOUT a Station deploy.
   Alan: "I would prefer the speed control to go on there ... quite a bit faster ... Forget about the page updates ... No reload for now."
   1. The picture is the one he has: the crop rule is 0.7.21's, letter for letter where it matters.
   2. The first session starts at 12 px/s, once; his own choice afterwards is kept.
   3. The pane's timed "page up" is declined: nothing moves, the pane is told at once; the refresh button still refreshes. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const bridge = read("station-x-bridge-draft/content.js");

test("X2 · the crop rule is 0.7.21's: 18 px short of the border, by the same formula", () => {
  assert.match(bridge, /^\s*const STATION_CROP_RIGHT_TRIM_PX = 18;/m);
  assert.match(bridge, /const rightTrim = Math\.min\(STATION_CROP_RIGHT_TRIM_PX, baseWidth \* 0\.06\);/);
  assert.match(bridge, /const fallbackContentLeft = baseLeft \+ Math\.min\(64, baseWidth \* 0\.19\);/);
  assert.match(bridge, /const minimumContentWidth = Math\.max\(160, baseWidth \* 0\.68\);/);
  /* the iMac's column 115..427: min(18, 312 * 0.06 = 18.72) = 18, so the right edge is 409 and the width from 180 is 229 */
  assert.equal(427 - Math.min(18, 312 * 0.06) - 180, 229);
});

test("X2 · the first session starts at four times the calm pace, once", () => {
  assert.match(bridge, /const STATION_FIRST_PACE_PX_PER_SECOND = 12;/);
  assert.match(bridge, /if \(\(saved\.settingsVersion \|\| 0\) < 10\) \{\n\s+session\.settings\.speedPxPerSecond = STATION_FIRST_PACE_PX_PER_SECOND;\n\s+\}/);
  assert.equal((bridge.match(/settingsVersion: 10,/g) || []).length, 2, "the default and the saved copy both say 10, so the step runs once");
  assert.match(bridge, /chrome\.storage\.local\.set\(\{ \[STORAGE_KEY\]: session\.settings \}\);\n\s+resolve\(session\.settings\);/, "and it is saved at load");
  /* the same step, run: a saved 3 px/s at version 9 becomes 12; a saved 6 px/s at version 10 stays 6 */
  const step = (saved) => { const s = { speedPxPerSecond: 3, ...saved, settingsVersion: 10 }; if ((saved.settingsVersion || 0) < 10) s.speedPxPerSecond = 12; return s.speedPxPerSecond; };
  assert.equal(step({ settingsVersion: 9, speedPxPerSecond: 3 }), 12);
  assert.equal(step({ settingsVersion: 10, speedPxPerSecond: 6 }), 6);
  assert.equal(step({}), 12);
});

test("X2 · the timed page-up is declined: nothing moves and the pane is told at once; the refresh button still refreshes", () => {
  assert.match(bridge, /const STATION_TIMED_PAGE_UP_ON = false;/);
  const src = bridge.match(/function declineTimedPageUp\(\) \{[\s\S]*?\n  \}/)[0];
  assert.doesNotMatch(src, /activateView|scrollTo|refreshCurrentView/, "it touches neither the feed nor the scroll");
  let scheduled = 0;
  const ctx = vm.createContext({ session: { pageUp: { seq: 4, busy: false, at: 0, result: "top", readingOnScreen: true, newPosts: 2 } }, scheduleCropTargetUpdate: () => { scheduled++; }, Date });
  const out = vm.runInContext(src + "; declineTimedPageUp()", ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), { run: false, why: "the timed refresh is switched off" });
  assert.equal(ctx.session.pageUp.seq, 5, "the sequence number moves: the pane's hold ends");
  assert.equal(ctx.session.pageUp.busy, false);
  assert.equal(ctx.session.pageUp.result, "off");
  assert.equal(scheduled, 1, "and the next crop message carries it");
  assert.match(bridge, /\} else await refreshCurrentView\(\);/, "a refresh asked by hand is still a refresh");
});

test("X2 · the bridge is 0.7.26", () => {
  assert.match(read("station-x-bridge-draft/manifest.json"), /"version": "0\.7\.26"/);
  assert.match(read("station-x-bridge-draft/README.md"), /## 0\.7\.26 \(X2, 13 Oct 2026\)/);
});
