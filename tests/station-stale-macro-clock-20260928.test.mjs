/* 28 Sep 2026, 18:45 ET: Alan saw the DXUSD and US10Y panes say "STALE 3 d". The chart API now
   refreshes VIX, the dollar and the yields all session; the Station's STALE rule counts only the hours
   FMP publishes their bars (the same clocks the chart API uses): VIX 09:30-16:15 ET, the dollar
   00:00-17:00 ET (Friday to 16:00), the yields 07:20-14:00 ET. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");
const liftFrom = (src, name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `declares ${name}`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (depth === 0) break; } }
  return src.slice(start, i + 1);
};
const line = (src, re) => { const m = src.match(re); assert.ok(m, String(re)); return m[0]; };
const code = [
  line(provider, /var GS_NYSE_HOLIDAYS = \[[\s\S]*?\];/), liftFrom(provider, "gsIsTradingDay"),
  line(chart, /const EV_MON = \[[^\]]*\];/), line(chart, /const CH_INTRADAY = \[[^\]]*\];/),
  line(chart, /const CH_ET_FMT = new Intl\.DateTimeFormat\([\s\S]*?\}\);/), "const chEtCache = new Map();",
  line(chart, /const CH_RANGE_MS = \{[\s\S]*?\};/), line(chart, /const CH_STALE_TF = \{[\s\S]*?\};/),
  line(chart, /const CH_SESSION_FROM_ET = [^\n]*;/), line(chart, /const CH_SESSIONS_ALLOWED = [^\n]*;/),
  line(chart, /const CH_CRYPTO_DAYS_ALLOWED = [^\n]*;/),
  'const cryptoSet = new Set(["BTCUSD","ETHUSD","SOLUSD"]);', line(chart, /const futureSet = [^\n]*;/),
  line(chart, /const CH_MACRO_CLOCK = \{[\s\S]*?\};/), line(chart, /const CH_EARLY_CLOSE_ET = [^\n]*;/),
  ...["chEtIso", "chLastCompletedPoint", "chNy", "chTradingDay", "chPrevTradingDay", "chInSession",
    "chMarketOf", "chClockOpenAt", "chOpenAt", "chSessionMs", "chAgeText", "chDayMon", "chBarFreshness"].map(n => liftFrom(chart, n)),
  "({ chBarFreshness, chOpenAt, chMarketOf })",
].join("\n");
const api = runInNewContext(code, { Date, Map, Set, Intl, Number, Math, String, isFinite });
const et = (iso) => Date.parse(iso + ":00Z") + 4 * 3600000;          /* EDT */
const bar = (etIso) => ({ d: new Date(et(etIso)).toISOString(), p: 100 });

test("VIX, the dollar and the yields each have their own clock; futures keep CME", () => {
  assert.equal(api.chMarketOf("VIX"), "CBOE_VIX");
  assert.equal(api.chMarketOf("DXUSD"), "ICE_DOLLAR");
  assert.equal(api.chMarketOf("US10Y"), "TREASURY_YIELD");
  assert.equal(api.chMarketOf("ESUSD"), "CME");
  assert.equal(api.chMarketOf("SPY"), "NYSE");
});

test("THE 28 SEP SCREEN: DXUSD 1h ending Friday 15:00 is STALE on Monday; ending Monday 16:00 it is quiet all evening", () => {
  const friday = [bar("2026-09-25T14:00"), bar("2026-09-25T15:00")];
  assert.equal(api.chBarFreshness(friday, "1h", et("2026-09-28T12:00"), "DXUSD").stale, true);
  const today = [bar("2026-09-28T15:00"), bar("2026-09-28T16:00")];
  for (const t of ["2026-09-28T17:30", "2026-09-28T18:50", "2026-09-28T23:30", "2026-09-29T01:00"])
    assert.equal(api.chBarFreshness(today, "1h", et(t), "DXUSD").stale, false, t);
  // ...but Tuesday 03:00 with Monday's 16:00 bar is 3 hours of dollar time behind: amber.
  assert.equal(api.chBarFreshness(today, "1h", et("2026-09-29T03:00"), "DXUSD").stale, true);
});

test("THE 28 SEP SCREEN: US10Y 1h ending 13:00 is quiet all afternoon and the next early morning", () => {
  const today = [bar("2026-09-28T12:00"), bar("2026-09-28T13:00")];
  for (const t of ["2026-09-28T15:30", "2026-09-28T18:50", "2026-09-29T06:00", "2026-09-29T08:30"])
    assert.equal(api.chBarFreshness(today, "1h", et(t), "US10Y").stale, false, t);
  assert.equal(api.chBarFreshness(today, "1h", et("2026-09-29T10:00"), "US10Y").stale, true, "2h40 of yield time behind");
  const friday = [bar("2026-09-25T13:00")];
  assert.equal(api.chBarFreshness(friday, "1h", et("2026-09-28T12:00"), "US10Y").stale, true, "the old symptom");
});

test("VIX 1h: FMP's :30 bars; the 15:30 bar keeps the line quiet until the next session is 2h15 in", () => {
  const today = [bar("2026-09-28T14:30"), bar("2026-09-28T15:30")];
  assert.equal(api.chBarFreshness(today, "1h", et("2026-09-29T09:00"), "VIX").stale, false);
  assert.equal(api.chBarFreshness(today, "1h", et("2026-09-29T11:00"), "VIX").stale, false);
  assert.equal(api.chBarFreshness(today, "1h", et("2026-09-29T12:30"), "VIX").stale, true);
});

test("holidays count nothing; the daily rule is unchanged", () => {
  const wed = [bar("2026-11-25T15:00"), bar("2026-11-25T16:00")];
  assert.equal(api.chBarFreshness(wed, "1h", et("2026-11-26T12:00"), "DXUSD").stale, false, "Thanksgiving");
  const d = [{ d: "2026-09-24T04:00:00.000Z", p: 1 }];
  assert.equal(api.chBarFreshness(d, "1D", et("2026-09-28T12:00"), "US10Y").stale, true, "missing Friday's session");
});
