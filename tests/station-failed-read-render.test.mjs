/* A failed read renders as a failure on every panel that used to flatten it.
   =========================================================================
   catch(() => null) on /ranks, /reflow, /events and /cohorts made a dead read
   indistinguishable from a table with no rows:

   - /ranks rendered a failed board_rsi/composite/ratios/profile read as a whole column of
     per-ticker "no data" — a DATA claim about fifty tickers the read never saw — and, with
     company_profile down, silently kept ETFs in a wall asked to drop them.
   - /reflow drew the same failure as a field of unranked grey.
   - /events declared "nothing scheduled in the next N days" off a dead calendar read.
   - /cohorts' FAV chip lost its count with no sign whether that was labels=0 or a failure.

   The failure is now a kept, named state; every panel says the READ failed, distinctly from
   emptiness, and retries. Browser receipts: browser-proof/proofs/failed-reads.mjs.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import vm from "node:vm";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
function fnFromSource(source, name, bindings = {}) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}
const ranks = read("../ranks/index.html");
const reflow = read("../reflow/index.html");
const events = read("../events/index.html");
const cohorts = read("../cohorts/index.html");

test("/ranks keeps failures as failures and fails the right column, not the tickers", () => {
  assert.match(ranks, /const READ_FAILED = \{ failed: true \};/);
  assert.ok(!ranks.includes(".catch(() => null)"), "the flattening catch is gone");
  assert.match(ranks, /did not answer — this ranking is unavailable, not empty · retrying/);
  /* Each dependent column names its own source. */
  for (const src of ["ratios_history", "company_profile", "board_rsi", "composite_staged"])
    assert.match(ranks, new RegExp('down: failed\\(\\w+\\) && "' + src + '"'));
  assert.match(ranks, /d\.down \? failedColumn\(d, d\.down\) : column\(d, d\.rows\(\)\)/);
  /* The sector rollup needs company_profile and says so when it is down. */
  assert.match(ranks, /WANT\.indexOf\("sector"\) >= 0 && failed\(cp\)/);
  /* A filter that cannot read is_etf never silently keeps the ETFs. */
  assert.match(ranks, /const etfFilterDown = DROP_ETF && failed\(cp\);/);
  assert.match(ranks, /ETF filter unavailable — company_profile read failed, ETFs are still in the set/);
});

test("/reflow refuses to draw grey non-answers over a failure", () => {
  assert.match(reflow, /const READ_FAILED = \{ failed: true \};/);
  assert.ok(!reflow.includes(".catch(() => null)"));
  assert.match(reflow, /failure\(rank\) \{ return DOWN\[rank\] \|\| null; \}/);
  assert.match(reflow, /if \(DATA\.failure && DATA\.failure\(RANK\)\) \{/);
  assert.match(reflow, /did not answer — this ranking is unavailable, not empty/);
  for (const pair of ['pe: failed(ratios) && "ratios_history"', 'rsi: failed(rsi) && "board_rsi"',
                      'geiger: failed(comp) && "composite_staged"', 'sector: failed(cp) && "company_profile"'])
    assert.ok(reflow.includes(pair), pair);
});

test("/events tells a dead read apart from a clear calendar", () => {
  assert.match(events, /const READ_FAILED = \{ failed: true \};/);
  assert.ok(!events.includes(".catch(() => null)"));
  assert.match(events, /up === READ_FAILED \? '<div class="empty">the earnings read failed — the calendar is unavailable, not clear · retrying<\/div>'/);
  assert.match(events, /res === READ_FAILED \? '<div class="empty">the earnings read failed — results are unavailable, not absent · retrying<\/div>'/);
  /* The honest empty states survive for genuinely empty windows. */
  assert.match(events, /nothing scheduled in the next/);
  assert.match(events, /no reported results in the last/);
});

test("/cohorts names the FAV count failure instead of quietly dropping the number", () => {
  assert.match(cohorts, /favorites count unavailable — the hub_favorites read failed; the chip still navigates/);
  assert.match(cohorts, /' title="' \+ fav\.length \+ ' favorites"'/);
});

/* ---- the template DB readers share /health's 20s ceiling, with timeout words ---- */

test("fundamentals/dcf/allocation readers are bounded and word a timeout as its own kind", () => {
  const fundamentals = read("../templates/fundamentals.html");
  const dcf = read("../templates/dcf.html");
  const allocation = read("../templates/allocation-module.html");

  for (const [name, src] of [["fundamentals", fundamentals], ["dcf", dcf], ["allocation", allocation]]) {
    assert.match(src, /const SB_HARD_MS = 20000;/, name + " carries the ceiling");
    assert.match(src, /signal:\s?controller\?\.signal/, name + " wires the abort signal");
    assert.match(src, /return await r(?:es)?\.json\(\);/, name + " keeps the body read inside the ceiling");
  }
  /* dcf/allocation throw a marked error whose message carries the words. */
  assert.match(dcf, /t\.scTimeout = true;/);
  assert.match(allocation, /t\.scTimeout = true;/);
  assert.match(dcf, /no answer in ' \+ \(SB_HARD_MS\/1000\) \+ 's'/);

  /* fundamentals keeps its error-array convention and marks the timeout kind. */
  assert.match(fundamentals, /empty\._sbError = true; empty\._sbTimeout = true; return empty;/);
  const sbFailWord = fnFromSource(fundamentals, "sbFailWord", { SB_HARD_MS: 20000 });
  assert.equal(sbFailWord({ _sbTimeout: true, _sbError: true }), "no answer in 20s");
  assert.equal(sbFailWord({ _sbError: true, _sbStatus: 503 }), "HTTP 503");
  assert.equal(sbFailWord({ _sbError: true }), "HTTP error");
  /* No banner prints a raw status concatenation any more — a timeout has no status to wear. */
  assert.ok(!fundamentals.includes("'HTTP '+((ev._sbError?ev._sbStatus:tr._sbStatus))"));
  assert.ok(!fundamentals.includes("(HTTP '+TX._sbStatus+')"));
});
