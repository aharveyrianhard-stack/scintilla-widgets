import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const chart = fs.readFileSync(new URL("../station-shells/chart-v1/index.html", import.meta.url), "utf8");
const axisLabel = new Function(chart.match(/function chAxisLabel\(parts, lastYear\) \{[\s\S]*?\n\}\n/)[0] + "return chAxisLabel;")();
const EV_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const timeParts = new Function("EV_MON", chart.match(/function chTimeLbl\(d, range, compact, spanMs\) \{[\s\S]*?\n\}\n/)[0] + chart.match(/function chTimeParts\(d, range, compact, spanMs\) \{[\s\S]*?\n\}\n/)[0] + "return chTimeParts;")(EV_MON);

/* what the axis prints for a run of ticks: [top line, bottom line] per tick */
const axis = (dates, range, spanDays) => { let y = ""; return dates.map((d) => { const l = axisLabel(timeParts(d, range, false, spanDays * 86400000), y); y = l.year; return [l.top, l.bottom]; }); };

test("a two-month 3H chart: the date leads on every tick, the year is printed once - not above every date (measured on the live Station 2026-09-18)", () => {
  const ticks = ["2026-07-23T13:00:00Z", "2026-07-30T13:00:00Z", "2026-08-05T13:00:00Z", "2026-09-18T13:00:00Z"];
  assert.deepEqual(ticks.map((d) => timeParts(d, "3h", false, 57 * 86400000)), [["2026", "07-23"], ["2026", "07-30"], ["2026", "08-05"], ["2026", "09-18"]], "what the shell computes is unchanged");
  assert.deepEqual(axis(ticks, "3h", 57), [["07-23", "2026"], ["07-30", ""], ["08-05", ""], ["09-18", ""]], "date on top; the year once, below");
});

test("the time context stays correct: the year returns on the tick where it turns, and the first tick always carries its year", () => {
  assert.deepEqual(axis(["2025-11-20", "2025-12-18", "2026-01-15", "2026-02-12"], "1D", 120), [["11-20", "2025"], ["12-18", ""], ["01-15", "2026"], ["02-12", ""]]);
  assert.deepEqual(axis(["2023-09-10", "2024-05-05", "2024-12-29", "2026-09-06"], "1W", 1100), [["09", "2023"], ["05", "2024"], ["12", ""], ["09", "2026"]]);
  assert.equal(axisLabel(["2026", "07-23"], "").bottomAlpha, .5, "the year is the quieter line");
});

test("labels that are not [year, something] are untouched", () => {
  assert.deepEqual(axisLabel(["09-18", "14:00"], "2026"), { top: "09-18", bottom: "14:00", bottomAlpha: .65, year: "2026" }, "intraday day + time, exactly as before");
  assert.deepEqual(axisLabel(["2019", ""], ""), { top: "2019", bottom: "", bottomAlpha: .65, year: "" }, "a bare year on a many-year chart stays the label");
  for (const bad of [null, undefined, [], [null, null], ["", "x"]]) assert.doesNotThrow(() => axisLabel(bad, ""));
  assert.match(chart, /const lbl = chAxisLabel\(parts, axisYear\); axisYear = lbl\.year;\n\s+ctx\.fillText\(lbl\.top, X\(ix\), h - padB \+ 8\);/, "the draw loop uses it");
  assert.match(chart, /const key = parts\.join\("\|"\);\n\s+if \(!parts\[0\] \|\| drawnTimes\.has\(key\)\) continue;/, "duplicate suppression still keys on the full year+date, so two years' 01-15 are both drawn");
});

test("the reference text is quieter, not different: same nodes, same words, only opacity and the box", () => {
  assert.match(chart, /\.sc-nchart__live-prev, \.sc-nchart__live-window\{ opacity:\.72; transition:opacity \.12s ease; \}/);
  assert.match(chart, /\.sc-nchart__live:hover \.sc-nchart__live-prev, \.sc-nchart__live:hover \.sc-nchart__live-window,\n\.sc-nchart__live:focus-within \.sc-nchart__live-prev, \.sc-nchart__live:focus-within \.sc-nchart__live-window\{ opacity:1; \}/, "pointing at the badge or focusing the ticker restores full strength");
  /* WORDING CHANGED 2026-09-21 at Alan's request: "Prev" and "≈N trading days · since X" are
     replaced by the dates themselves. Same nodes, same placement, same stale suffix - only the
     words. The count moved to the tooltip rather than being discarded. */
  assert.match(chart, /chartReferenceCloseLabel\(host\) \+ " " \+ chPx\(\+dayRef, host\.dataset\.t\)/,
    "the previous-close text names its session and keeps the same node");
  assert.match(chart, /chartWindowLabel\(pts\) \+ chartStaleSuffix\(pts\[pts\.length - 1\]\.d\)/,
    "the history window states its dates and keeps the stale suffix");
  assert.match(chart, /label\.title =\s*\n?\s*pts\.length\s*\n?\s*\? chartApproximateSpan/,
    "the approximate span is still available on hover");
});

test("intraday axis and hover print New York time; daily dates pass through (23 Sep: a 10:15 ET bar read 14:15)", () => {
  const src = chart.match(/const CH_INTRADAY = [\s\S]*?\nfunction chEtIso\(d, range\) \{[\s\S]*?\n\}\n/)[0];
  const chEtIso = new Function(src + "return chEtIso;")();
  assert.equal(chEtIso("2026-09-23T14:15:00.000Z", "3h"), "2026-09-23T10:15", "summer: UTC-4");
  assert.equal(chEtIso("2026-01-15T14:30:00.000Z", "1h"), "2026-01-15T09:30", "winter: UTC-5, the open reads 09:30");
  assert.equal(chEtIso("2026-09-23T02:00:00.000Z", "4h"), "2026-09-22T22:00", "the date follows New York too");
  assert.equal(chEtIso("2026-09-22T00:00:00.000Z", "1D"), "2026-09-22T00:00:00.000Z", "a daily stamp is never shifted a day back");
  assert.equal(chEtIso("2026-09-22", "3h"), "2026-09-22", "a bare date is untouched");
  assert.equal(timeParts(chEtIso("2026-09-23T14:15:00.000Z", "3h"), "3h", false, 86400000)[1], "10:15");
  assert.match(chart, /chTimeParts\(chEtIso\(pts\[ix\]\.d, host\._range \|\| S\.chartRange\)/, "the axis passes New York time");
  assert.match(chart, /chHoverTime\(chEtIso\(pts\[scrub\.ix\]\.d, host\._range \|\| S\.chartRange\)/, "the hover passes New York time");
});
