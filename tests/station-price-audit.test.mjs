/* The silent-alternate-price audit, recorded as tests.
   ===================================================
   Every served template that touches an equity price was audited for a number standing in
   for the provider's without saying so. Findings and dispositions:

   - allocation-module: cohort-feed prices/day-changes and the client geiger — REMOVED
     (station-allocation-authority.test.mjs pins it).
   - fundamentals: fundamentals.price as a current price; the un-gated disable — FIXED
     (station-fundamentals-price.test.mjs pins it).
   - dcf: Jul-24 static prices at cold load and after failed reads; the market price drawn
     as a fair-value bar — FIXED (station-dcf-cold-load.test.mjs pins it).
   - sector-rotation: the last YAHOO DAILY CLOSE stood in for a missing live_quotes price
     inside a read whose banner said "LIVE, DB-sourced … no in-browser math" — FIXED here:
     the substitution is kept (it keeps the read alive) but named at every surface.
   - dcf-methodology: a static captured quote labelled "(FMP, live)" — RELABELLED.
   - company-full: hardcoded prices, but the page is an explicitly labelled STATIC MOCK
     ("baked, no network · nothing deployed") — a declared fixture, NOT a silent
     substitute. Pinned so the label cannot quietly disappear while the fixture stays.
   - sector-rotation-older: retained previous version; its own header already names its
     price-path caveat. Pinned so the warning survives retention.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const sector = read("../templates/sector-rotation.html");
const sectorOlder = read("../templates/sector-rotation-older.html");
const methodology = read("../templates/dcf-methodology.html");
const companyFull = read("../templates/company-full.html");

function fnFrom(source, name, bindings = {}) {
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

function technicalHarness(quote) {
  const closes = Array.from({ length: 60 }, (_, i) => 90 + i * 0.2);
  return fnFrom(sector, "technicalRead", {
    DERIVED_LIVE: { XLK: { rsi_raw:60, wpr_raw:-30, macd_raw:1.2, macd_signed:0.5, cci_raw:50,
      roc_raw:2, stoch_raw:70, fan_ema21:100, fan_sma50:95, updated_ts:"2026-08-19T13:00:00Z" } },
    QUOTES_LIVE: quote ? { XLK: { price: quote } } : {},
    DS: { daily: { XLK: { closes } } },
  });
}

test("a DB-sourced read carries the live quote when it exists, and says so", () => {
  const r = technicalHarness(102.5)("XLK");
  assert.equal(r.source, "db");
  assert.equal(r.priceSource, "live_quotes");
  assert.equal(r.last, 102.5);
});

test("a missing live quote is a NAMED substitution, not a silent Yahoo close", () => {
  const r = technicalHarness(null)("XLK");
  assert.equal(r.source, "db", "the indicators are still the database's");
  assert.equal(r.priceSource, "yahoo-close", "the price is not, and the read says which");
  assert.ok(Math.abs(r.last - (90 + 59 * 0.2)) < 1e-9, "the stand-in is the last Yahoo close");
  /* And every surface that shows the price names the exception. */
  assert.match(sector, /PRICE EXCEPTION: the live quote is unavailable, so the price in the conditions below is the last Yahoo daily close/);
  assert.match(sector, /\(last Yahoo close — live quote unavailable\)/);
  assert.match(sector, /DB indicators · price from last Yahoo close — live quote unavailable/);
});

test("the methodology write-up no longer labels a captured static quote as live", () => {
  assert.ok(!methodology.includes("NVDA price (FMP, live)"));
  assert.match(methodology, /FMP quote captured for this write-up — static, not live/);
});

test("the company mock stays a declared fixture — the label may not outlive the honesty", () => {
  assert.match(companyFull, /<title>SCINTILLA · Company · CRWD · full-wire mock<\/title>/);
  assert.match(companyFull, /STATIC MOCK · CRWD · every company tab wired to real DB data \(baked, no network\)/);
  assert.match(companyFull, /nothing deployed/);
});

test("the retained older sector page keeps naming its own price-path caveat", () => {
  assert.match(sectorOlder, /unreviewed party in the middle of the price path/);
});
