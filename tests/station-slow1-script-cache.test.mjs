/* SLOW1 (6 Oct 2026) — a chart pane's scripts are checked, not downloaded again.
   Every chart pane is its own document. Under the catch-all "no-store" each one downloaded the same nine
   script files again (provider.js, the indicators, the lens) — measured: 80 downloads and 1.4 MB for a
   page of eight charts, on every page change and every slot rotation. "no-cache" keeps a copy and asks
   the server "has it changed?" each time (an ETag check that answers 304), so a new build is still
   picked up on the very next load, and pages themselves stay exactly as they were. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cfg = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const value = (rule) => rule.headers.find((h) => h.key === "Cache-Control").value;
const everything = cfg.headers.find((h) => h.source === "/(.*)");
const scripts = cfg.headers.find((h) => h.source === "/(.*)\\.(js|mjs)");
const vendor = cfg.headers.find((h) => h.source === "/_vendor/(.*)");

test("scripts are kept and revalidated on every use; never served blind from a stale copy", () => {
  assert.ok(scripts, "there is a rule for .js and .mjs");
  assert.equal(value(scripts), "no-cache");
  assert.doesNotMatch(value(scripts), /max-age=[1-9]|immutable|no-store/);
});

test("its neighbours are untouched: pages stay no-store, vendor stays immutable, and the order lets each win its own files", () => {
  assert.equal(value(everything), "no-store, max-age=0, must-revalidate");
  assert.equal(value(vendor), "public, max-age=31536000, immutable");
  const at = (r) => cfg.headers.indexOf(r);
  assert.equal(at(everything), 0, "the catch-all stays first");
  assert.ok(at(scripts) > at(everything), "the last matching rule wins, so the script rule follows the catch-all");
  assert.ok(at(vendor) > at(scripts), "a vendored .js file still ends on the vendor rule");
});

test("the self-update watch still asks the server directly, so a new build is seen whatever the cache holds", () => {
  const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
  assert.match(deck, /fetch\(path, \{ method:"HEAD", cache:"no-store" \}\)/);
});
