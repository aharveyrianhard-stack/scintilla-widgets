/* Coordinator, 26 Oct 2026: the floating volume window for the iPhone and iPad (/pip/). Alan: "I need, like, something that floats on the
   mobile devices … similar to the one that we have here." iOS floats only video, so the page draws the meter on a canvas, plays the canvas as
   a muted video and asks for picture-in-picture. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page = readFileSync(new URL("../pip/index.html", import.meta.url), "utf8");

test("the float page: the canvas becomes a muted inline video, and FLOAT asks for picture-in-picture both ways (standard and Safari's)", () => {
  assert.match(page, /<video id="v" muted playsinline autoplay/);
  assert.match(page, /C\.captureStream\(8\)/); assert.match(page, /v\.srcObject = stream/);
  assert.match(page, /v\.requestPictureInPicture\(\)/); assert.match(page, /v\.webkitSetPresentationMode\("picture-in-picture"\)/);
  assert.match(page, /setInterval\(draw, 250\)/, "timers, not animation frames, so it keeps drawing behind other apps");
});
test("the float page reads like the wall: the PIP's rule for the number, the three ratio lights without percentages, nothing written", () => {
  assert.match(page, /var usePace = !!hb\.live && LIVE_STATES\.indexOf\(st\) >= 0 && F && F\.pace != null;/);
  assert.match(page, /\["SPY\/QQQ", "RSP\/SPY", "SMH\/QQQ"\]/);
  assert.doesNotMatch(page, /method:\s*"POST"|method:\s*'POST'/);
  assert.match(page, /https:\/\/volume-pulse-pied\.vercel\.app/);
});
