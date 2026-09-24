/* WHAT A BAR ON THE STATION CHART IS, AND WHETHER THE PANE SAYS SO.
   Alan, 24 Sep: "all of this is a three hour chart. I feel like I'm not seeing the same thing as on
   TradingView ... How are these lines measured?" Measured that day against the live chart API, the
   answer was: our 3-hour bars begin 03:00/06:00/09:00/12:00/15:00/18:00 Eastern and include
   pre- and post-market, TradingView's begin 09:30/12:30/15:30 and do not - and the pane said
   nothing about either. These tests pin the statement, not the bars: no candle, no average and no
   fetch is changed by the code they cover. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const chart = fs.readFileSync(new URL("../chart/index.html", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");

const lift = (name) => {
  const start = chart.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `chart/index.html declares ${name}`);
  let depth = 0, i = chart.indexOf("{", start);
  for (; i < chart.length; i++) {
    if (chart[i] === "{") depth++;
    else if (chart[i] === "}") { depth--; if (depth === 0) break; }
  }
  return chart.slice(start, i + 1);
};
const constant = (name) => {
  const m = chart.match(new RegExp(`const ${name} = [\\s\\S]*?\\n\\};`));
  assert.ok(m, `chart/index.html declares ${name}`);
  return m[0];
};
const api = runInNewContext(
  `${constant("CH_BAR_RULE")}\nconst CH_INTRADAY = ${JSON.stringify(["15m","30m","1h","2h","3h","4h","6h","12h"])};\n` +
  `${lift("chEtIso")}\nconst chEtCache = new Map();\nconst CH_ET_FMT = FMT;\n` +
  `${lift("chBarRuleText")}\n${lift("chLastCompletedPoint")}\n${lift("chLastBarClock")}\n` +
  `({ CH_BAR_RULE, chBarRuleText, chLastBarClock, chLastCompletedPoint })`,
  { Date, Map, isFinite, FMT: new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) });

const RANGES = JSON.parse(chart.match(/const CHART_DB_RANGE = (\{[^;]+\});/)[1]);

test("every range the Station offers can say what one of its bars is", () => {
  for (const range of Object.keys(RANGES)) {
    const text = api.chBarRuleText(range);
    assert.ok(text.startsWith("Bars: "), `${range} states its own bar rule`);
    assert.match(text, /TradingView:/, `${range} states TradingView's rule for the same width`);
  }
  assert.equal(api.chBarRuleText("nonsense"), "", "an unknown range invents no rule");
});

test("the 3-hour rule names both grids, and does not pretend they agree", () => {
  const text = api.chBarRuleText("3h");
  assert.match(text, /03:00, 06:00, 09:00, 12:00, 15:00, 18:00 Eastern/);
  assert.match(text, /pre- and post-market included/);
  assert.match(text, /completed bars only/);
  assert.match(text, /TradingView: 09:30, 12:30, 15:30 - three bars a session, regular hours only\./);
  assert.match(text, /The two do not line up\./);
});

test("the two widths whose grid really does match TradingView say so, and only those", () => {
  const agree = Object.keys(RANGES).filter((r) => api.CH_BAR_RULE[r].agrees);
  assert.deepEqual(agree, ["15m", "30m"], "09:30 sits on the 15- and 30-minute grid and on no other");
  for (const r of agree) assert.match(api.chBarRuleText(r), /Same grid\./);
  for (const r of Object.keys(RANGES).filter((x) => !agree.includes(x)))
    assert.match(api.chBarRuleText(r), /The two do not line up\./, `${r} must not claim agreement`);
});

test("a daily-or-wider bar says it is completed sessions only, and that TradingView adds today", () => {
  for (const range of ["1D", "3D", "1W"]) {
    assert.match(api.chBarRuleText(range), /completed sessions only/);
    assert.match(api.chBarRuleText(range), /unfinished/, `${range} states that TradingView shows the forming bar`);
    assert.doesNotMatch(api.chBarRuleText(range), /pre- and post-market/);
  }
});

test("an intraday line names the Eastern clock time of its last completed bar", () => {
  /* 2026-09-24T13:00:00Z is 09:00 ET: the 3-hour bar the live API actually served that lunchtime. */
  const pts = [{ d: "2026-09-24T10:00:00.000Z" }, { d: "2026-09-24T13:00:00.000Z" }];
  assert.equal(api.chLastBarClock(pts, "3h"), " · bars to 09:00");
  assert.equal(api.chLastBarClock(pts, "15m"), " · bars to 09:00");
});

test("the clock is Eastern, not the machine's zone and not UTC", () => {
  const pts = [{ d: "2026-09-24T20:00:00.000Z" }];
  assert.equal(api.chLastBarClock(pts, "1h"), " · bars to 16:00", "20:00 UTC is 16:00 in New York");
});

test("a daily or weekly line gets no clock, because its bar has no hour", () => {
  const pts = [{ d: "2026-09-23T04:00:00.000Z" }];
  for (const range of ["1D", "3D", "1W"]) assert.equal(api.chLastBarClock(pts, range), "");
});

test("a transient live point is not a completed bar, so the clock skips it", () => {
  const pts = [{ d: "2026-09-24T13:00:00.000Z" }, { d: "2026-09-24T17:26:00.000Z", live: true }];
  assert.equal(api.chLastBarClock(pts, "3h"), " · bars to 09:00",
    "the clock must name the last COMPLETED bar, never the live placeholder");
  assert.equal(api.chLastCompletedPoint([{ d: "x", live: true }]), null, "an all-live series names no completed bar");
  assert.equal(api.chLastBarClock([], "3h"), "", "no series, no claim");
});

test("the pane wires the rule into the label it already had, and changes no bar", () => {
  const paint = chart.slice(chart.indexOf("function paintChartHistoryWindow"),
    chart.indexOf("function acquireChartLoadPermit"));
  assert.match(paint, /chLastBarClock\(pts, host\._range \|\| S\.chartRange\)/,
    "the visible label carries the last completed bar's clock");
  assert.match(paint, /chBarRuleText\(host\._range \|\| S\.chartRange\)/,
    "the tooltip carries the bar rule in plain words");
  assert.doesNotMatch(paint, /fetch|CHART_DB_RANGE\s*\[/, "the label reads nothing and requests nothing");
  /* The provider's own widths and limits are untouched by this repair. */
  assert.match(chart, /"3h":\["180",240\]/, "the 3h range still asks the chart API for 180-minute bars");
  assert.match(chart, /if \(provider && provider\.isProviderOwned && provider\.isProviderOwned\(t\)\) return pts;/,
    "an equity line still never takes a live tick as a bar");
});

test("the independently versioned chart shell still mirrors the chart exactly", () => {
  assert.equal(shell, chart);
});
