/* 1 Nov 2026. Alan: "I unsubscribed from the Bloomberg channels, the Yahoo Finance channels and the CNBC channels because they post too much like short shit. On my station, I would like to be
   able to see a feed of those separately ... I should be able to add them to the watch later too, but I don't want to subscribe to them." */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const deck = read("../deck/index.html"), a = read("../station-shells/scintilla-video-v1/index.html"), b = read("../station-shells/personal-video-v1/index.html");
test("NEWS TV: its own tab, its own feed, the twins stay identical", () => {
  assert.equal(a, b, "the twin shells stay byte-identical");
  assert.match(a, /\{ key: "networks",\s+account: "networks",\s+label: "NEWS TV" \}/);
  assert.match(a, /\["networks", "NEWS TV", "TV"\]/, "a tab beside SCINTILLA and PERSONAL, short on a phone");
  assert.match(deck, /\["fn", "NEWS TV",\s+"networks"\]/, "the deck can put it on the wall");
});
