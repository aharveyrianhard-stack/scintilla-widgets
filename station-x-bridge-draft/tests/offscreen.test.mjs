import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../offscreen.js", import.meta.url), "utf8");

/* 24 Sep (M43): the relay asked for 1920x1080 while the in-tab path asked for
   2560x1440, so the same X window reached the pane at two different sizes
   depending on which path fed it. The pin is now the stronger property: ONE
   ceiling for both paths, still at 60fps. */
test("Station relays X video at the same ceiling as the in-tab capture", async () => {
  const inTab = await readFile(new URL("../content.js", import.meta.url), "utf8");
  const ceilingOf = (text) => {
    const match = text.match(/maxWidth: (\d+),\s*\n\s*maxHeight: (\d+),/);
    assert.ok(match, "a capture ceiling must be stated");
    return match[1] + "x" + match[2];
  };
  assert.equal(ceilingOf(source), ceilingOf(inTab));
  /* 0.7.21 (24 Sep): one ceiling still, now 1920x1080 at 15fps - the pane paints
     at 12.5fps, so anything faster was encoded and decoded for nothing. */
  assert.equal(ceilingOf(source), "1920x1080");
  assert.match(source, /maxWidth: 1920,[\s\S]{0,620}maxFrameRate: 15/);
  assert.match(inTab, /maxWidth: 1920,[\s\S]{0,200}maxFrameRate: 15/);
  assert.doesNotMatch(source, /maxFrameRate: 60/);
});

test("a scroll step is acknowledged even when the hidden decoder never calls back (Brave)", async () => {
  assert.match(source, /const CAPTURE_FRAME_FALLBACK_MS = 150;/);
  assert.match(source, /fallbackTimer = setTimeout\(\(\) => afterFrame\(true\), CAPTURE_FRAME_FALLBACK_MS\);/);
  assert.match(source, /if \(settled\) return;/, "one acknowledgement per step, never two");
  const inTab = await readFile(new URL("../content.js", import.meta.url), "utf8");
  assert.match(inTab, /if \(session\.stationRenderedOffset > STATION_MAX_RENDERED_OFFSET_PX\) \{/);
  assert.match(inTab, /const STATION_MAX_RENDERED_OFFSET_PX = 4;/);
});
