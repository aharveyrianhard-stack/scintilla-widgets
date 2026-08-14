import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../offscreen.js", import.meta.url), "utf8");

test("Station relays X video at the original Float capture ceiling", () => {
  assert.match(source, /maxWidth: 1920,[\s\S]{0,420}maxFrameRate: 60/);
  assert.doesNotMatch(source, /maxFrameRate: 30/);
});
