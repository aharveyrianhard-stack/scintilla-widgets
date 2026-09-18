import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
// Shared vectors for the session-freshness rule (run against the Hub copy and the Station copy).
function runVectors(api) {
  const at = (s) => Date.parse(s);
  const F = (sd, st, now) => api.gsDailySessionFreshness(sd, st, at(now));
  // Fri 2026-09-18 01:04 ET (05:04Z): the expected settled session is Thu Sep 17.
  assert.equal(api.gsExpectedSettledSession(at("2026-09-18T05:04:00Z")), "2026-09-17");
  let r = F("2026-09-17 00:00:00", "SETTLED", "2026-09-18T05:04:00Z");
  assert.equal(r.stale, false); assert.equal(r.current, true); assert.equal(r.sessionsBehind, 0); assert.equal(r.settled, true); assert.equal(r.reason, "expected session");
  r = F("2026-09-16", "SETTLED", "2026-09-18T05:04:00Z");
  assert.equal(r.stale, true); assert.equal(r.sessionsBehind, 1); assert.match(r.reason, /1 session behind the expected 2026-09-17 session/);
  // recently fetched old value stays stale: fetched_at is not an input at all
  assert.equal(api.gsDailySessionFreshness.length, 3);
  // Aug 20 FORMING seen on Sep 18: 19 sessions behind (Labor Day Sep 7 skipped), never settled
  r = F("2026-08-20 00:00:00", "FORMING", "2026-09-18T05:04:00Z");
  assert.equal(r.stale, true); assert.equal(r.sessionsBehind, 19); assert.equal(r.settled, false);
  // the settlement window: Thu Sep 17 at 19:59 ET still expects Wed Sep 16; at 20:00 ET it expects Thu Sep 17
  assert.equal(api.gsExpectedSettledSession(at("2026-09-17T23:59:00Z")), "2026-09-16");
  assert.equal(api.gsExpectedSettledSession(at("2026-09-18T00:00:00Z")), "2026-09-17");
  assert.equal(F("2026-09-16", "SETTLED", "2026-09-17T23:59:00Z").stale, false, "one session back is current until the newer one is expected");
  assert.equal(F("2026-09-16", "SETTLED", "2026-09-18T00:00:00Z").stale, true, "and stale the minute the newer session is expected");
  // today's forming session during market hours is current but not settled
  r = F("2026-09-18", "FORMING", "2026-09-18T15:00:00Z");
  assert.equal(r.stale, false); assert.equal(r.settled, false); assert.match(r.reason, /today's session, forming/);
  // ET midnight boundary: 00:30 ET Sep 18 expects Sep 17; 23:30 ET Sep 17 (03:30Z Sep 18) also expects Sep 17
  assert.equal(api.gsExpectedSettledSession(at("2026-09-18T04:30:00Z")), "2026-09-17");
  assert.equal(api.gsExpectedSettledSession(at("2026-09-18T03:30:00Z")), "2026-09-17");
  // weekend: Sat Sep 19 10:00 ET and Sun Sep 20 both expect Fri Sep 18; Mon Sep 21 08:00 ET still expects Fri
  assert.equal(api.gsExpectedSettledSession(at("2026-09-19T14:00:00Z")), "2026-09-18");
  assert.equal(api.gsExpectedSettledSession(at("2026-09-20T14:00:00Z")), "2026-09-18");
  assert.equal(api.gsExpectedSettledSession(at("2026-09-21T12:00:00Z")), "2026-09-18");
  assert.equal(F("2026-09-18", "SETTLED", "2026-09-20T14:00:00Z").stale, false, "Friday's close is current all weekend");
  assert.equal(F("2026-09-17", "SETTLED", "2026-09-20T14:00:00Z").sessionsBehind, 1, "Thursday's close is one session behind on Sunday");
  // Mon Sep 21 20:01 ET expects Mon Sep 21; Friday's close is then stale by one session
  assert.equal(F("2026-09-18", "SETTLED", "2026-09-22T00:01:00Z").stale, true);
  // Labor Day: Mon 2026-09-07 21:00 ET expects Fri Sep 4
  assert.equal(api.gsExpectedSettledSession(at("2026-09-08T01:00:00Z")), "2026-09-04");
  assert.equal(F("2026-09-04", "SETTLED", "2026-09-08T01:00:00Z").stale, false, "Friday's close is current through the holiday Monday");
  // fail closed: missing, unparseable, weekend-dated and future-dated sessions are STALE and say why
  for (const bad of [null, "", "not a date", "2026-13-40"]) { r = F(bad, "SETTLED", "2026-09-18T05:04:00Z"); assert.equal(r.stale, true); assert.equal(r.known, false); assert.equal(r.reason, "no session date"); }
  r = F("2026-09-19", "SETTLED", "2026-09-18T05:04:00Z"); assert.equal(r.stale, true); assert.match(r.reason, /after today/);
  r = F("2026-09-13", "SETTLED", "2026-09-18T05:04:00Z"); assert.equal(r.stale, true); assert.match(r.reason, /not a trading session/);
  // a very old reading counts sessions, bounded (the holiday table starts at 2026, so 2025 holidays count as weekdays: 261 weekdays minus the 8 listed 2026 holidays)
  assert.equal(F("2025-09-17", "SETTLED", "2026-09-18T05:04:00Z").sessionsBehind, 253);
  // SESSION STATE IS PART OF THE CONTRACT: only exactly FORMING or SETTLED is admitted (root review 02:03, 2026-09-18)
  for (const bad of [null, undefined, "", "settled", "Settled", "DONE", "FORMING "]) { r = F("2026-09-17", bad, "2026-09-18T05:04:00Z");
    if (bad === "FORMING ") { assert.equal(r.state, "FORMING", "surrounding whitespace is trimmed, the word itself must be exact"); continue; }
    assert.equal(r.stale, true, String(bad) + " must fail closed"); assert.equal(r.current, false); assert.equal(r.settled, false); assert.equal(r.known, true);
    assert.equal(r.state, bad == null || bad === "" ? "UNSTATED" : "INVALID"); assert.equal(r.sessionsBehind, null); assert.match(r.reason, /^not admitted: session state (missing|'.*' is not FORMING or SETTLED)$/); }
  // FORMING AFTER ITS SETTLEMENT WINDOW: yesterday's intraday snapshot is not yesterday's close
  r = F("2026-09-17", "FORMING", "2026-09-18T05:04:00Z");
  assert.equal(r.stale, true); assert.equal(r.current, false); assert.equal(r.settled, false); assert.equal(r.sessionsBehind, null);
  assert.match(r.reason, /a forming snapshot of 2026-09-17, whose session has since closed — not the settled value/);
  // today's session: FORMING is current until the exporter's 16:15 ET boundary, and not after it
  assert.equal(F("2026-09-18", "FORMING", "2026-09-18T20:14:00Z").stale, false, "16:14 ET: still forming");
  r = F("2026-09-18", "FORMING", "2026-09-18T20:15:00Z"); assert.equal(r.stale, true, "16:15 ET: the session has closed; a forming snapshot is no longer current"); assert.match(r.reason, /has since closed/);
  assert.equal(F("2026-09-18", "FORMING", "2026-09-18T22:00:00Z").stale, true, "18:00 ET forming snapshot stays unpromoted");
  // today's session SETTLED: valid from 16:15 ET (before the 20:00 ET expectation flips), invalid before the close
  r = F("2026-09-18", "SETTLED", "2026-09-18T21:00:00Z"); assert.equal(r.stale, false); assert.equal(r.settled, true); assert.match(r.reason, /today's session, settled/);
  r = F("2026-09-18", "SETTLED", "2026-09-18T15:00:00Z"); assert.equal(r.stale, true, "11:00 ET: a session cannot be settled before it closes"); assert.match(r.reason, /marked SETTLED before the 2026-09-18 session reached its settlement boundary/);
  // after 20:00 ET the same SETTLED row is simply the expected session
  r = F("2026-09-18", "SETTLED", "2026-09-19T00:30:00Z"); assert.equal(r.stale, false); assert.equal(r.reason, "expected session");
  // an older session keeps its distance whatever its state, and an invalid state never outranks the date checks
  r = F("2026-09-16", "FORMING", "2026-09-18T05:04:00Z"); assert.equal(r.stale, true); assert.equal(r.sessionsBehind, 1); assert.equal(r.settled, false);
  assert.match(F("2026-09-19", null, "2026-09-18T05:04:00Z").reason, /after today/);
  return true;
}

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const provider = read("../_provider/provider.js"), geiger = read("../geiger/index.html"), sector = read("../templates/sector-rotation.html");
const block = provider.slice(provider.indexOf("/* SESSION-FRESHNESS BEGIN"), provider.indexOf("/* SESSION-FRESHNESS END */") + "/* SESSION-FRESHNESS END */".length);
test("daily indicator freshness is judged by the expected settled New York session, fail closed", () => {
  const c = vm.createContext({ Intl, Date, Number, String, isFinite });
  vm.runInContext(block + "\nthis.api = { gsDailySessionFreshness, gsExpectedSettledSession };", c);
  assert.equal(runVectors(c.api), true);
  assert.match(provider, /S\.dailySessionFreshness = gsDailySessionFreshness;/);
  assert.match(provider, /S\.expectedSettledSession = gsExpectedSettledSession;/);
});
test("/geiger reference stamp ages a daily reference in sessions, not hours since midnight", () => {
  const start = geiger.indexOf("function gsReferenceSummary("), end = geiger.indexOf("function gsContractMeta(", start);
  const summarize = vm.runInNewContext("(" + geiger.slice(start, end).trim() + ")", { Array, String, Number, Math, Date });
  const full = Array.from({ length: 16 }, () => ({ state: "AVAILABLE" }));
  const now = Date.parse("2026-09-18T05:05:00Z");
  const current = summarize("FMP", "AVAILABLE", full, "2026-09-17 00:00:00", 16, now, { known: true, stale: false, sourceDate: "2026-09-17", sessionsBehind: 0 });
  assert.equal(current.age, "SESSION 2026-09-17 · CURRENT");
  assert.match(current.label, /FMP REFERENCE AVAILABLE 16\/16 · SESSION 2026-09-17 · CURRENT · NOT SCORED/);
  const behind = summarize("FMP", "AVAILABLE", full, "2026-08-20 00:00:00", 16, now, { known: true, stale: true, sourceDate: "2026-08-20", sessionsBehind: 19 });
  assert.equal(behind.age, "SESSION 2026-08-20 · 19 BEHIND");
  assert.equal(summarize("FMP", "AVAILABLE", full, null, 16, now, { known: false, stale: true }).age, "SESSION UNKNOWN");
  assert.equal(summarize("FMP", "AVAILABLE", full, "2026-09-04", 16, Date.parse("2026-09-06T00:00:00Z")).age, "AGE 2D", "without a session the clock rule is unchanged (Massive minute lane)");
});
test("sector rotation withholds the extension/caution read together with the score when inputs are session-stale", () => {
  assert.match(sector, /SC_PROVIDER\.dailySessionFreshness\(dl\.timestamp, dl\.session_state\)/);
  assert.doesNotMatch(sector, /\(Date\.now\(\)\/1000-_es\) <= 26\*3600/);
  assert.match(sector, /const extended = t\.stale \? null : /);
  assert.match(sector, /const withExt=rows\.filter\(r=>!r\.stale&&r\.rsi!=null&&r\.stretchPct!=null\)/);
  assert.match(sector, /behind\?'STALE':'LIVE'/);
  assert.match(sector, /extension read withheld with the score/);
  assert.match(sector, /else if\(nVotes>=2 && votes>0\)\{ verdict='ALIGNED BULLISH'/, "ALIGNED needs two voters");
  assert.match(sector, /verdict='GEIGER ONLY — BULLISH \(technicals withheld\)'/);
  assert.doesNotMatch(sector, /nVotes>0 && votes>0/);
});
