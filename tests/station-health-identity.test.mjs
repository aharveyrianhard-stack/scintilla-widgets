/* /health grades the equity universe on identity, and its probes on real ceilings.
   ===============================================================================
   Three claims this page used to make that it could not back:

   IDENTITY. The universe row compared the provider's symbol COUNT to 365. A count catches
   a swap only by luck: drop AAPL, add TICK, and 365 is still 365. The shim already holds
   ownership to exact set membership against the canonical tickers; the row that REPORTS
   ownership now holds itself to the same rule, and fails closed to "unverified" when the
   canonical set cannot be read — count alone is not identity.

   BOUNDS. The page said no stalled owner could hold a row, but only the provider reads
   were bounded; any Supabase socket that opened and said nothing held its row at
   "checking…" forever. The database probes now share the 20s hard ceiling, and a timeout
   is worded as its own outcome, distinct from a transport failure.

   STATE. PROVIDER_SLOW latched for the page's lifetime, so one slow probe stamped SLOW on
   every later re-check; and a re-check clicked mid-run raced two runs over the same rows.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const health = fs.readFileSync(new URL("../health/index.html", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");

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

test("universe identity is membership both ways, not a count", () => {
  const identity = fnFrom(health, "universeIdentity");
  const canon = ["AAPL", "MSFT", "NVDA"];

  /* The exact case a count cannot catch: same size, different members. */
  const swapped = identity(["TICK", "MSFT", "NVDA"], canon);
  assert.equal(swapped.state, "mismatch");
  assert.deepEqual(Array.from(swapped.missing), ["AAPL"]);
  assert.deepEqual(Array.from(swapped.extra), ["TICK"]);
  assert.equal(swapped.count, 3, "the count that would have graded this green");

  /* Exact membership agrees, whatever the order or case. */
  const agrees = identity(["nvda", "AAPL", "MSFT"], ["msft", "NVDA", "aapl"]);
  assert.equal(agrees.state, "agrees");
  assert.equal(agrees.canonical, 3);
  assert.deepEqual(Array.from(agrees.missing), []);
  assert.deepEqual(Array.from(agrees.extra), []);

  /* Both directions surface: a shortfall and a surplus are both named. */
  const shortfall = identity(["AAPL"], canon);
  assert.deepEqual(Array.from(shortfall.missing).sort(), ["MSFT", "NVDA"]);
  const surplus = identity(["AAPL", "MSFT", "NVDA", "VIX"], canon);
  assert.deepEqual(Array.from(surplus.extra), ["VIX"]);
});

test("no canonical set means unverified, never agreement from a count", () => {
  const identity = fnFrom(health, "universeIdentity");
  for (const missingCanon of [null, undefined, []]) {
    const r = identity(["AAPL", "MSFT"], missingCanon);
    assert.equal(r.state, "unverified", "count alone is not identity");
    assert.equal(r.count, 2, "the count is still reported, as a count");
  }
  /* And no provider universe at all is unknown, not unverified. */
  for (const nothing of [null, undefined, []])
    assert.equal(identity(nothing, ["AAPL"]).state, "unknown");
  /* The lane words the failure-closed states and grades them bad. */
  assert.match(health, /"identity unverified — canonical set unreadable; count alone is not identity"/);
  assert.match(health, /idy\.state === "unverified"[\s\S]{0,40}set\("equity", 2, "bad"/);
  assert.match(health, /idy\.state === "mismatch"[\s\S]{0,40}set\("equity", 2, "bad"/);
});

test("the canonical query is the shim's own, NULL branch included, and a full page is not a set", () => {
  const expected = "tickers?select=ticker&active=eq.true&or=(type.is.null,type.not.in.(crypto,future,index,rate))&order=ticker.asc&limit=1000";
  assert.ok(health.includes(expected), "/health asks the exact canonical question");
  assert.ok(provider.includes(expected), "and it is the same question the shim asks");
  /* A read that fills the 1000-row page cap may be truncated; a possibly-partial canonical
     set must refuse to verify identity rather than verify against what arrived. */
  assert.match(health, /if \(!set\.length \|\| set\.length >= 1000\) return null;/);
});

test("the digest is compared in full and every OK quote row must carry usable values", () => {
  assert.match(health,
    /"f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1"/);
  assert.match(health, /receipt\.toLowerCase\(\) === ACCEPTED_EQUALIZER_SHA256/,
    "full-digest equality, not a prefix");
  /* state:'OK' is a claim, not a value: price and previous close are validated on the raw
     value, positive and finite, because Number(null) and Number('') are 0. */
  assert.match(health, /if \(raw == null \|\| raw === "" \|\| raw === true \|\| raw === false\) return null;/);
  assert.match(health, /if \(px == null \|\| px <= 0 \|\| prev == null \|\| prev <= 0\) malformed\.push\(sym\);/);
  assert.match(health, /numeric\(v\.previous_close\)/, "the completed previous close is part of OK");
});

test("the database probes share the 20s hard ceiling and a timeout is its own word", () => {
  assert.match(health, /const DB_HEALTH_HARD_MS = 20000;/);
  assert.match(health, /method: head \? "HEAD" : "GET", signal: controller\?\.signal/,
    "the PostgREST read carries the abort signal");
  assert.match(health, /return await r\.json\(\);/,
    "awaited inside the try so the ceiling covers the body read too");
  const word = fnFrom(health, "failureWord");
  assert.equal(word({ scTimeout:true }), "no answer in 20s");
  assert.equal(word(new Error("pg 503")), "unreachable");
  assert.equal(word(null), "unreachable");
  /* Both the provider and database timeout paths mark the error as a timeout. */
  assert.equal((health.match(/t\.scTimeout = true;/g) || []).length, 2);
  /* And the rows print the distinction rather than flattening it. */
  for (const site of [/set\("feeders", i, "bad", "", failureWord\(e\)\)/,
                      /set\("stock", i, "bad", "", failureWord\(e\)\)/,
                      /set\("internals", 0, "bad", "", failureWord\(e\)\)/])
    assert.match(health, site);
});

test("SLOW is per run and a re-check cannot race a live run", () => {
  assert.match(health, /async function runEquity\(\) \{[\s\S]{0,400}PROVIDER_SLOW = false;/,
    "the slow latch resets when a run starts");
  assert.match(health, /let RUNNING = false;/);
  assert.match(health, /if \(RUNNING\) return;/);
  assert.match(health, /\} finally \{ RUNNING = false; \}/,
    "the guard releases even when a lane throws");
});

test("the unsupported internals stay an explicit lane that is BAD by construction", () => {
  assert.match(health, /const UNSUPPORTED_INTERNALS = \["ADD", "PCC", "CUMTICK", "TICK", "TRIN"\];/);
  assert.match(health, /BAD either way until an owner supports them/);
  assert.match(health, /set\("internals", 0, "bad", found\.length \+ "\/" \+ UNSUPPORTED_INTERNALS\.length/);
});
