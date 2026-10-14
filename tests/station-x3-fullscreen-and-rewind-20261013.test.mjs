/* X3 (13 Oct 2026) - two faults on the Station, Alan ~21:00 ET:
   "when I get out of full screen, it quits the Station app" and "this button for minus 60 seconds on the Twitter
   scrolling is not working. I don't think it even clicks."
   1. The rewind (bridge 0.7.27): a jump of thirty seconds of feed at the current pace, never above the top; the smooth
      glide of 0.7.26 is gone, because the Station tick's own scrollTop assignment cancelled it (measured headless with
      the deployed pane at 4x: 12-55 px of 360 moved; after: 358 of 360).
   2. The label: the pane's button says −30s and "rewind the feed 30 seconds", and asks the bridge for exactly that.
   3. Full screen: nothing of ours closes, replaces or navigates the Station window when full screen changes. These
      pins keep it that way; the fault's cause is outside this code (see RETURN-20261013-X3). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const bridge = read("station-x-bridge-draft/content.js");
const pane = read("station-shells/x-v2/index.html");
const deck = read("deck/index.html");
const video = read("station-shells/scintilla-video-v1/index.html");
const manifest = JSON.parse(read("station/manifest.json"));

const fn = (src, name) => src.match(new RegExp("\\n  function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}"))[0];

test("X3 · the rewind is a jump of thirty seconds at the current pace, never above the top of the page", () => {
  const src = fn(bridge, "rewindPlan") + fn(bridge, "rewindFeed");
  assert.doesNotMatch(src, /smooth/, "no smooth scroll: the tick's next scrollTop assignment would cancel it");
  assert.match(src, /root\.scrollTo\(\{ top: plan\.top, behavior: "auto" \}\)/);
  assert.match(src, /resetStationScrollComposite\(\);/, "the slow scroll's phase is reset, as every other jump of the source");
  assert.match(src, /scheduleCropTargetUpdate\(\);/, "and the pane is told");
  assert.match(src, /paintStationScrollCode\(\)/, "the scroll code is painted in the same frame, as the tick does");
  const ctx = vm.createContext({});
  vm.runInContext(fn(bridge, "rewindPlan"), ctx);
  const plan = (top, speed) => JSON.parse(JSON.stringify(vm.runInContext(`rewindPlan(${JSON.stringify(top)}, ${JSON.stringify(speed)})`, ctx)));
  assert.deepEqual(plan(2000, 12), { pixels: 360, top: 1640 }, "4x (12 px/s): 360 px");
  assert.deepEqual(plan(2000, 3), { pixels: 90, top: 1910 }, "1x (3 px/s): 90 px");
  assert.deepEqual(plan(2000, 24), { pixels: 720, top: 1280 }, "8x (24 px/s): 720 px");
  assert.deepEqual(plan(100, 12), { pixels: 360, top: 0 }, "never above the top");
  assert.deepEqual(plan(0, 12), { pixels: 360, top: 0 });
  assert.deepEqual(plan(50, 0), { pixels: 0, top: 49 }, "a pace of 0 still answers the press by a pixel");
  assert.deepEqual(plan(null, "x"), { pixels: 0, top: 0 });
});

test("X3 · the whole rewind runs on a stand-in page: one instant scroll, the composite reset, the crop re-sent", () => {
  const calls = [];
  const root = { scrollTop: 1000 };
  root.scrollTo = (o) => { calls.push(["scrollTo", o]); root.scrollTop = o.top; };
  const ctx = vm.createContext({
    document: { scrollingElement: root }, session: { settings: { speedPxPerSecond: 12 } },
    resetStationScrollComposite: () => calls.push(["reset"]), scheduleCropTargetUpdate: () => calls.push(["crop"]),
    paintStationScrollCode: () => calls.push(["code"]) });
  vm.runInContext(fn(bridge, "rewindPlan") + fn(bridge, "rewindFeed"), ctx);
  const out = vm.runInContext("rewindFeed()", ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), { pixels: 360, top: 640 });
  assert.equal(root.scrollTop, 640);
  assert.deepEqual(calls.map((c) => c[0]), ["reset", "scrollTo", "code", "crop"]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1][1])), { top: 640, behavior: "auto" });
});

test("X3 · the pane's button says what the bridge does: −30s, thirty seconds of feed, one request", () => {
  assert.match(pane, /<span class="btn x-sec" id="bXBack" style="display:none" title="rewind the feed 30 seconds">−30s<\/span>/);
  assert.match(pane, /el\("bXBack"\)\.addEventListener\("click", \(\) => postXFloat\("rewind"\)\);/);
  assert.match(bridge, /\} else if \(action === "rewind"\) \{\n\s+rewindFeed\(\);/, "the bridge answers that request with the jump");
  assert.match(fn(bridge, "rewindPlan"), /\* 30\)/, "thirty seconds: the pace times 30");
  /* the float's own button, same function, same words */
  assert.match(bridge, /class="xff-icon-button xff-rewind" type="button" title="Go back 30 seconds"/);
});

test("X3 · the bridge is 0.7.27 and says why", () => {
  assert.match(read("station-x-bridge-draft/manifest.json"), /"version": "0\.7\.27"/);
  assert.match(read("station-x-bridge-draft/README.md"), /## 0\.7\.27 \(X3, 13 Oct 2026\)/);
  assert.match(read("x-health/index.html"), /const TARGET = "0\.7\.27";/);
});

test("X3 · nothing of ours closes, replaces or navigates the Station window when full screen changes", () => {
  /* the deck's one fullscreenchange handler only repaints its button */
  const handler = deck.match(/document\.addEventListener\("fullscreenchange", \(\) => \{[\s\S]*?\n\}\);/)[0];
  assert.match(handler, /stationFullBtn/);
  assert.doesNotMatch(handler, /location\.|window\.close|close\(\)|reload|open\(|replace\(/);
  assert.equal((deck.match(/addEventListener\("fullscreenchange"/g) || []).length, 1);
  for (const [name, src] of [["deck", deck], ["video pane", video], ["x pane", pane]]) {
    assert.doesNotMatch(src, /window\.close\(|\bself\.close\(|\btop\.close\(/, name + " never closes a window");
    assert.doesNotMatch(src, /fullscreenchange[\s\S]{0,400}(location\.(replace|assign|href\s*=)|\.close\(\))/, name + ": no navigation follows a fullscreen change");
  }
  /* the video pane's only location.replace is the top-level feed switch, not the embedded one */
  assert.match(video, /if \(EMBEDDED\) \{[\s\S]*?return;\n\s+\}\n\s+const url = new URL\(location\.href\);\n\s+url\.searchParams\.set\("feed", next\);\n\s+location\.replace\(url\.href\);/);
  /* the night reload holds while the Station is full screen; the self-update reloads, never closes */
  assert.match(deck, /if \(s\.browserFull\) return "the Station is full screen";/);
  assert.doesNotMatch(deck, /window\.close/);
  /* the web app: one scope for everything, the plain standalone window, no launch or display overrides to re-open it */
  assert.equal(manifest.scope, "/"); assert.equal(manifest.start_url, "/"); assert.equal(manifest.id, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.display_override, undefined); assert.equal(manifest.launch_handler, undefined);
  /* the frames allow full screen as before: the player's own button is unchanged */
  assert.match(deck, /const FRAME_ALLOW = "autoplay; encrypted-media; picture-in-picture; fullscreen; display-capture";/);
  assert.match(video, /frame\.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";/);
});
