/* 27 Sep night: a futures lens reads the whole CME session (18:00-17:00 ET, named by the NEXT day),
   crypto the whole calendar day; stocks keep regular / extended hours. On Sunday evening the ES lens
   showed Friday's 09:30-16:00 candles while ES had traded since 18:00. */
import assert from "node:assert/strict";
import test from "node:test";
import { sessionsOf, lastSessions, barsToRequest } from "../_indicators/lens-bars.mjs";
import { hoursOf } from "../_indicators/station-lens.mjs";

const et = (iso) => Date.parse(iso + ":00Z") + 4 * 3600000;   /* EDT */
const bar = (iso) => ({ t: et(iso), o: 1, h: 1, l: 1, c: 1 });

test("futures and crypto pick their own hours; stocks unchanged", () => {
  assert.equal(hoursOf("30m", "ESUSD"), "globex");
  assert.equal(hoursOf("4h", "NQUSD"), "globex");
  assert.equal(hoursOf("30m", "BTCUSD"), "allday");
  assert.equal(hoursOf("30m", "SPY"), "extended", "28 Sep: pre-market candles included");
  assert.equal(hoursOf("4h", "MU"), "extended");
});

test("Sunday 18:00 ET onward is Monday's CME session; Friday's bars stay Friday's", () => {
  const bars = [bar("2026-09-25T09:30"), bar("2026-09-25T16:30"), bar("2026-09-27T18:00"), bar("2026-09-27T21:30")];
  const s = sessionsOf(bars, "globex");
  assert.deepEqual(s.map(x => [x.day, x.bars.length]), [["2026-09-25", 2], ["2026-09-28", 2]]);
  assert.equal(lastSessions(bars, 1, "globex")[0].day, "2026-09-28", "the newest session is Sunday evening's");
  assert.equal(sessionsOf(bars, "regular").length, 1, "the stock view would have shown only Friday");
});

test("a 24-hour lens asks for enough bars", () => {
  assert.equal(barsToRequest("30m", 3, "globex"), 192);
  assert.equal(barsToRequest("4h", 12, "globex"), 78);
  assert.equal(barsToRequest("30m", 3), 128, "stocks unchanged");
});
