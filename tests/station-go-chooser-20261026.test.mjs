/* Coordinator, 26 Oct 2026: the device chooser the Hub's STATION tab opens (/go/). Alan: "you clicked for the station and it says what device". */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page = readFileSync(new URL("../go/index.html", import.meta.url), "utf8");
test("the chooser: four ways in - the wall, the iPad, the iPhone, the floating volume - and the device in hand is lit", () => {
  for (const href of ['href="/?widgets=1"', 'href="/ipad/"', 'href="/phone/"', 'href="/pip/"']) assert.ok(page.includes(href), href);
  assert.match(page, /\/iPhone\|iPod\|Android\.\+Mobile\/\.test\(ua\)/); assert.match(page, /\/Macintosh\/\.test\(ua\) && touch/);
  assert.doesNotMatch(page, /fetch\(/, "it reads nothing");
});
