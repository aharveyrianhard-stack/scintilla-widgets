/* S1-STATION-FOLLOWUPS item 4 (SCI-11), 25 Sep 2026: A STALE CHART MUST LOOK STALE.
   Alan: "it's not very easy for me to tell that something is not current… you have to be really,
   really careful." Every chart pane says when its newest completed bar began, and during a session
   the stamp turns amber with its age when the line has stopped. These tests run the chart's own
   functions against fixed clocks: summer (EDT) and winter (EST), weekends, pre-market, the 09:45
   daily boundary and an NYSE holiday. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const provider = fs.readFileSync(new URL("../_provider/provider.js", import.meta.url), "utf8");

const liftFrom = (src, name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `declares ${name}`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
};
const line = (src, re) => { const m = src.match(re); assert.ok(m, String(re)); return m[0]; };
const lift = (name) => liftFrom(chart, name);

const code = [
  line(provider, /var GS_NYSE_HOLIDAYS = \[[\s\S]*?\];/), liftFrom(provider, "gsIsTradingDay"),
  line(chart, /const EV_MON = \[[^\]]*\];/),
  line(chart, /const CH_INTRADAY = \[[^\]]*\];/),
  line(chart, /const CH_ET_FMT = new Intl\.DateTimeFormat\([\s\S]*?\}\);/),
  "const chEtCache = new Map();",
  line(chart, /const CH_RANGE_MS = \{[\s\S]*?\};/),
  line(chart, /const CH_STALE_TF = \{[\s\S]*?\};/),
  line(chart, /const CH_SESSION_FROM_ET = [^\n]*;/),
  line(chart, /const CH_SESSIONS_ALLOWED = [^\n]*;/),
  line(chart, /const CH_CRYPTO_DAYS_ALLOWED = [^\n]*;/),
  line(chart, /const cryptoSet = [^\n]*;/).replace("Object.values(CB)", '["BTCUSD","ETHUSD","SOLUSD"]'),
  line(chart, /const futureSet = [^\n]*;/),
  line(chart, /const CH_MACRO_CLOCK = \{[\s\S]*?\};/), line(chart, /const CH_EARLY_CLOSE_ET = [^\n]*;/),
  ...["chEtIso", "chLastCompletedPoint", "chNy", "chTradingDay", "chPrevTradingDay", "chInSession",
    "chMarketOf", "chClockOpenAt", "chOpenAt", "chSessionMs", "chAgeText", "chDayMon", "chBarFreshness"].map(lift),
  "({ chBarFreshness, chInSession, chPrevTradingDay })",
].join("\n");
const api = runInNewContext(code, { Date, Map, Intl, Number, Math, String, isFinite });

/* ET wall time -> UTC instant, for the fixtures (EDT until 1 Nov 2026, EST after) */
const et = (iso, offsetHours) => Date.parse(iso + ":00Z") + offsetHours * 3600000;
const EDT = 4, EST = 5;
const bar = (etIso, offset = EDT) => ({ d: new Date(et(etIso, offset)).toISOString(), p: 100 });
const day = (date) => ({ d: date + "T04:00:00.000Z", p: 100 });   /* the provider's daily stamp: ET midnight */

test("intraday, EDT, inside the limit: grey stamp with the bar's Eastern time", () => {
  const f = api.chBarFreshness([bar("2026-09-24T04:00"), bar("2026-09-24T08:00")], "4h", et("2026-09-24T14:30", EDT));
  assert.equal(f.text, "last bar 08:00 ET");
  assert.equal(f.stale, false);
  assert.equal(f.age, "");
});

test("intraday, EDT: a 4H line that stopped Thursday is amber on Monday morning, with its age", () => {
  const f = api.chBarFreshness([bar("2026-09-24T16:00")], "4h", et("2026-09-28T10:00", EDT));
  assert.equal(f.text, "last bar 24 Sep 16:00 ET", "an old bar names its day");
  assert.equal(f.stale, true);
  assert.equal(f.age, "4H · 3 d old", "age from the bar's close, Thu 20:00 ET, to Mon 10:00 ET");
});

test("two bars of SESSION time: the stamp turns amber only after the limit, not one bar late", () => {
  const pts = [bar("2026-09-24T12:00")];                               /* 3h bar 12:00–15:00 */
  assert.equal(api.chBarFreshness(pts, "3h", et("2026-09-24T17:59", EDT)).stale, false, "just under 2 bars");
  assert.equal(api.chBarFreshness(pts, "3h", et("2026-09-24T18:10", EDT)).stale, false, "inside the 15-minute serving grace");
  const late = api.chBarFreshness(pts, "3h", et("2026-09-24T18:20", EDT));
  assert.equal(late.stale, true);
  assert.equal(late.age, "3H · 3 h old");
});

test("weekends and nights judge nothing: the stamp stays quiet", () => {
  const friday = [bar("2026-09-25T16:00")];
  assert.equal(api.chBarFreshness(friday, "4h", et("2026-09-26T12:00", EDT)).stale, false, "Saturday");
  assert.equal(api.chBarFreshness(friday, "4h", et("2026-09-27T23:00", EDT)).stale, false, "Sunday night");
  assert.equal(api.chBarFreshness([bar("2026-09-24T08:00")], "1h", et("2026-09-24T22:30", EDT)).stale, false, "a weekday after 20:00");
});

test("pre-market: the overnight and weekend gap is not counted, a missing pre-market bar is", () => {
  const fri = [bar("2026-09-25T19:00")];                               /* the last 1h bar of Friday's session */
  const early = api.chBarFreshness(fri, "1h", et("2026-09-28T04:30", EDT));
  assert.equal(early.stale, false, "Mon 04:30: 1 h Friday + 30 min Monday of session time");
  const late = api.chBarFreshness(fri, "1h", et("2026-09-28T06:30", EDT));
  assert.equal(late.stale, true, "Mon 06:30: the 04:00 and 05:00 bars should be there");
  assert.equal(late.age, "1H · 2 d old");
});

test("EST (winter): Eastern clock is UTC-5, and a 15M line older than two bars is amber in minutes", () => {
  const ok = api.chBarFreshness([bar("2026-12-15T08:00", EST)], "1h", et("2026-12-15T10:00", EST));
  assert.equal(ok.text, "last bar 08:00 ET", "13:00Z is 08:00 in New York in December");
  assert.equal(ok.stale, false);
  const f = api.chBarFreshness([bar("2026-12-15T09:00", EST)], "15m", et("2026-12-15T10:00", EST));
  assert.equal(f.stale, true);
  assert.equal(f.age, "15M · 45 min old");
});

test("1D: judged from 09:45 ET; the line must reach the previous session (today's bar is not built until the close)", () => {
  const thu = [day("2026-09-23"), day("2026-09-24")];
  assert.equal(api.chBarFreshness(thu, "1D", et("2026-09-28T08:00", EDT)).stale, false, "pre-market: not judged");
  assert.equal(api.chBarFreshness(thu, "1D", et("2026-09-28T09:44", EDT)).stale, false, "09:44: not yet");
  const f = api.chBarFreshness(thu, "1D", et("2026-09-28T09:46", EDT));
  assert.equal(f.stale, true, "Monday 09:46 without Friday's bar");
  assert.equal(f.text, "last bar 24 Sep");
  assert.equal(f.age, "1D · 4 d old");
  assert.equal(api.chBarFreshness([day("2026-09-25")], "1D", et("2026-09-28T09:46", EDT)).stale, false, "Friday's bar on Monday");
  assert.equal(api.chBarFreshness([day("2026-09-28")], "1D", et("2026-09-29T15:00", EDT)).stale, false, "Monday's bar on Tuesday");
  assert.equal(api.chBarFreshness([day("2026-12-14")], "1D", et("2026-12-15T10:00", EST)).stale, false, "EST");
  assert.equal(api.chBarFreshness([day("2026-12-11")], "1D", et("2026-12-15T10:00", EST)).stale, true, "EST, Monday missing");
});

test("an NYSE holiday is not a missing session (the calendar comes from provider.js)", () => {
  /* Labor Day, Mon 7 Sep 2026: on Tuesday the previous session is Friday 4 Sep */
  assert.equal(api.chPrevTradingDay("2026-09-08"), "2026-09-04");
  assert.equal(api.chBarFreshness([day("2026-09-04")], "1D", et("2026-09-08T10:00", EDT)).stale, false);
  assert.equal(api.chInSession(et("2026-09-07T11:00", EDT)), false, "no session on the holiday itself");
  assert.equal(api.chBarFreshness([bar("2026-09-04T16:00")], "4h", et("2026-09-07T11:00", EDT)).stale, false);
});

test("3D and 1W: amber only when more than two bars of sessions are missing", () => {
  const now = et("2026-09-24T10:00", EDT);                             /* Thursday; previous session Wed 23 Sep */
  assert.equal(api.chBarFreshness([day("2026-09-14")], "1W", now).stale, false, "last week's bar");
  const wk = api.chBarFreshness([day("2026-09-07")], "1W", now);
  assert.equal(wk.stale, true, "12 sessions since (Labor Day skipped) > 10");
  assert.equal(wk.age, "1W · 17 d old");
  assert.equal(api.chBarFreshness([day("2026-09-16")], "3D", now).stale, false, "5 sessions since");
  assert.equal(api.chBarFreshness([day("2026-09-14")], "3D", now).stale, true, "7 sessions since > 6");
});

test("a transient live point is not a completed bar, and no series makes no claim", () => {
  const pts = [bar("2026-09-24T08:00"), { ...bar("2026-09-24T14:29"), live: true }];
  assert.equal(api.chBarFreshness(pts, "4h", et("2026-09-24T14:30", EDT)).text, "last bar 08:00 ET");
  assert.equal(api.chBarFreshness([], "4h", Date.now()), null);
  assert.equal(api.chBarFreshness(pts, "9x", Date.now()), null, "an unknown timeframe makes no claim");
});

/* 27 Sep (O1), Alan: "REMOVE the grey 'last bar 25 Sep 18:00 ET' stamp… show nothing when fine; only a
   clear warning when a chart is actually stale during a session." The judgement above is unchanged; only
   what the badge shows changed: nothing while current, an amber STALE line when not. */
test("the stamp says nothing while the line is current, and an amber STALE warning when it has stopped; both chart copies identical", () => {
  assert.equal(chart, shell, "chart/index.html and station-shells/chart-v1/index.html stay identical");
  assert.match(chart, /badge\.append\(ticker, change, lastBar, previous, historyWindow\);/);
  assert.match(chart, /paintLastBarStamp\(host, pcPane \? null : pts\);/, "a put/call pane keeps its own session label");
  assert.match(chart, /const text = fresh && fresh\.stale \? "STALE \\u00b7 " \+ fresh\.text \+ " \\u00b7 " \+ String\(fresh\.age\)\.split\(" \\u00b7 "\)\.pop\(\) : "";/,
    "empty when fresh; STALE, the last bar and its age when not");
  assert.match(chart, /\.sc-nchart__live-lastbar:empty\{ display:none; \}/);
  assert.doesNotMatch(chart, /"When the newest completed bar on this chart began/, "no quiet always-on stamp any more");
  const amber = chart.match(/\.sc-nchart__live-lastbar\{ color:#([0-9a-f]{6}); font:700 11px var\(--mono\);/)[1];
  const ch = [0, 2, 4].map((i) => parseInt(amber.slice(i, i + 2), 16));
  assert.ok(Math.max(...ch) <= 210, "no channel above 210");
  assert.ok(ch[0] > ch[2] + 60, "amber, the colour Alan asked for, not a grey");
  assert.doesNotMatch(chart, /\.sc-nchart__live-lastbar\{[^}]*display:none/, "a stale warning is never hidden like the window line");
});

test("a same-symbol page-change message keeps the drawn line (no blank, no refetch of the symbol)", () => {
  assert.match(chart, /if \(d\.ticker && \(retarget \|\| !host\)\) setChartTicker\(d\.ticker\);/);
  assert.doesNotMatch(chart, /\n  if \(d\.ticker\) setChartTicker\(d\.ticker\);/);
});
