/* 1 Nov 2026 — Alan: "a vault with my pushes and full reads. I like it. But we should have a way of visualizing tickers and classifications of things." and "Visuals, why make me read so much?" */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (p) => fs.readFileSync(new URL("../notify/" + p, import.meta.url), "utf8");
test("the map reads the full reads and the Hub's classes, and draws bars", () => {
  const m = read("map.html");
  assert.match(m, /youtube_reads\?select=video_id,channel,title,published_at,tickers&tier=eq\.deep/);
  assert.match(m, /cohorts\?select=ticker,cohort/);
  assert.match(m, /class="up" style="width:/); assert.match(m, /class="dn" style="width:/); assert.match(m, /class="fl" style="width:/);
  assert.match(m, /\/notify\/read\.html\?v=/, "a tap reaches what the read said");
  assert.match(m, /toUpperCase\(\); if \(!name\) continue/, "Gold and GOLD are one name");
});
test("no coloured stripe down a card's left edge", () => {
  assert.doesNotMatch(read("map.html"), /border-left/);
});
test("the map carries the same public key as the read page, and the list links to it", () => {
  const key = (s) => s.match(/ANON = "([^"]+)"/)[1];
  assert.equal(key(read("map.html")), key(read("read.html")));
  assert.match(read("index.html"), /href="\/notify\/map\.html">MAP</);
});
