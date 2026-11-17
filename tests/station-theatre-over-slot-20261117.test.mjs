/* 17 Nov 2026 — the video's ⛶ shows the whole video again.
   Alan: "Something's wrong with the station YouTube. I'm clicking the full screen and it only does like a portion of it."
   Measured on the live Station (headless, 1416 × 883 and 2560 × 1351): ⛶ on the video pane's bar put the pane over the
   charts (the theatre, S11b), but the pane still carried `in-slot` from the wall it left. The slot's rule (z-index 3) and
   the theatre's rule (z-index 24) weigh the same and the slot's comes later in the sheet, so the slot won and the theatre's
   cover over the charts (z-index 23) was drawn over the video: only the strip below the chart row showed.
   The contract this file holds:
     1. the theatre's cover sits between the slot and the theatre (3 < 23 < 24), so a pane may carry only one of the two;
     2. the floor plan takes `in-slot` off the pane it puts in the theatre (the branch `continue`s past the slot's toggle).
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const SRC = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
const zOf = (re, what) => {
  const m = SRC.match(re);
  assert.ok(m, `${what} must exist`);
  const z = m[0].match(/z-index:\s*(\d+)/);
  assert.ok(z, `${what} names a z-index`);
  return Number(z[1]);
};

test("the theatre's cover sits above the slot and under the theatre", () => {
  const cover = zOf(/body\.media-theatre:not\(\.stack\) #grid > #rowTop::after\{[^}]*\}/, "the theatre's cover");
  const theatre = zOf(/body\.media-theatre:not\(\.stack\) #grid > #rowBot > \.pane\.theatre\{[^}]*\}/, "the theatre's pane rule");
  const slot = zOf(/body\.video-slot:not\(\.stack\) #grid > #rowBot > \.pane\.in-slot\{[^}]*\}/, "the slot's pane rule");
  assert.ok(slot < cover && cover < theatre, `slot ${slot} < cover ${cover} < theatre ${theatre}`);
});

test("a pane put in the theatre is no longer in the slot", () => {
  const start = SRC.indexOf("if (inTheatre) {");
  assert.notEqual(start, -1, "the floor plan's theatre branch must exist");
  const end = SRC.indexOf("continue;", start);
  assert.notEqual(end, -1, "the theatre branch ends in continue");
  const branch = SRC.slice(start, end);
  assert.match(branch, /classList\.remove\([^)]*"in-slot"[^)]*\)/, "the theatre branch takes in-slot off");
  assert.match(branch, /classList\.remove\([^)]*"video-fit"[^)]*\)/, "and still takes video-fit off");
  /* the slot's own toggle stays where it was: only a pane with no media stage goes in the slot */
  assert.match(SRC, /const inSlot = !!slot && o\.def\.key === VIDEO_FEED && MEDIA_STAGE === 0;\s*o\.node\.classList\.toggle\("in-slot", inSlot\);/);
});
