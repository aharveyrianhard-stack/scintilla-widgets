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
  assert.equal(ceilingOf(source), "2560x1440");
  assert.match(source, /maxWidth: 2560,[\s\S]{0,620}maxFrameRate: 60/);
  assert.doesNotMatch(source, /maxFrameRate: 30/);
});
