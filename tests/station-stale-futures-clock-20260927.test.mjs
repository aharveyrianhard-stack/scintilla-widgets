/* 27 Sep 2026 night: futures and crypto keep their own clock in the STALE warning.
   Alan: "Futures, commodities and Bitcoin don't follow the stock calendar." The coordinator's run of
   the chart's own rule found it wrong both ways: an ES line stopped on Friday stayed quiet all Sunday
   evening, and ES 30m turned amber every weekday during CME's 17:00-18:00 pause. */
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
  ...["chEtIso", "chLastCompletedPoint", "chNy", "chTradingDay", "chPrevTradingDay", "chInSession",
    "chMarketOf", "chOpenAt", "chSessionMs", "chAgeText", "chDayMon", "chBarFreshness"].map(n => liftFrom(chart, n)),
  "({ chBarFreshness, chOpenAt })",
].join("\n");
const api = runInNewContext(code, { Date, Map, Set, Intl, Number, Math, String, isFinite });
const et = (iso) => Date.parse(iso + ":00Z") + 4 * 3600000;          /* EDT */
const bar = (etIso) => ({ d: new Date(et(etIso)).toISOString(), p: 100 });
const day = (date) => ({ d: date + "T04:00:00.000Z", p: 100 });

test("CME clock: open Sunday 18:00, paused 17:00-18:00 Mon-Thu, shut Friday 17:00 to Sunday 18:00", () => {
  assert.equal(api.chOpenAt(et("2026-09-27T17:59"), "CME"), false);
  assert.equal(api.chOpenAt(et("2026-09-27T18:05"), "CME"), true);
  assert.equal(api.chOpenAt(et("2026-09-30T17:30"), "CME"), false);
  assert.equal(api.chOpenAt(et("2026-09-30T18:30"), "CME"), true);
  assert.equal(api.chOpenAt(et("2026-10-02T16:59"), "CME"), true);
  assert.equal(api.chOpenAt(et("2026-10-02T17:05"), "CME"), false);
  assert.equal(api.chOpenAt(et("2026-10-03T12:00"), "CME"), false);
  assert.equal(api.chOpenAt(et("2026-10-03T12:00"), "CRYPTO"), true);
});

test("ES 30m stopped on Friday is STALE on Sunday evening once futures trade", () => {
  const pts = [bar("2026-09-25T16:00"), bar("2026-09-25T16:30")];
  assert.equal(api.chBarFreshness(pts, "30m", et("2026-09-27T21:30"), "ESUSD").stale, true);
  assert.equal(api.chBarFreshness(pts, "30m", et("2026-09-27T17:30"), "ESUSD").stale, false, "before the open");
  assert.equal(api.chBarFreshness(pts, "30m", et("2026-09-27T21:30"), "SPY").stale, false, "stocks unchanged: Sunday is not a session");
});

test("ES 30m is not STALE during the CME pause or after the Friday close", () => {
  const wed = [bar("2026-09-30T16:00"), bar("2026-09-30T16:30")];
  assert.equal(api.chBarFreshness(wed, "30m", et("2026-09-30T17:50"), "ESUSD").stale, false);
  assert.equal(api.chBarFreshness(wed, "30m", et("2026-09-30T18:20"), "ESUSD").stale, false, "pause time does not count");
  const fri = [bar("2026-10-02T16:00"), bar("2026-10-02T16:30")];
  assert.equal(api.chBarFreshness(fri, "30m", et("2026-10-02T19:30"), "ESUSD").stale, false);
});

test("ES 30m fresh on Sunday evening stays quiet", () => {
  const pts = [bar("2026-09-27T20:30"), bar("2026-09-27T21:00")];
  assert.equal(api.chBarFreshness(pts, "30m", et("2026-09-27T21:45"), "ESUSD").stale, false);
});

test("Bitcoin daily counts calendar days; weekend days are real bars", () => {
  assert.equal(api.chBarFreshness([day("2026-09-25")], "1D", et("2026-09-27T12:00"), "BTCUSD").stale, true, "Saturday's bar is missing");
  assert.equal(api.chBarFreshness([day("2026-09-26")], "1D", et("2026-09-27T12:00"), "BTCUSD").stale, false);
  assert.equal(api.chBarFreshness([day("2026-09-26")], "1D", et("2026-09-27T09:00"), "BTCUSD").stale, false, "before 09:45");
});
