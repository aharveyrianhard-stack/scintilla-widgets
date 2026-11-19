/* 19 Nov 2026 - BIG CANDLES on the lens rows. Alan (relayed by the Dot-com session): "on our rotations, we highlight the volume tickers ... can we
   do that for stocks that have had a big move ... a big candle ... rapid-fire switching between the ones that do this." The research session's
   rule (volume-pulse api/bigcandles.js) on the house's own 5-minute bars: the latest finished regular-hours candle's high-low range against the
   name's usual range over the prior 10 sessions (the first 30 minutes against the same clock slot), 3x = big, 2x-3x = large, green up, red down. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const lens = read("../station-shells/lens-v1/index.html");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const plain = (v) => JSON.parse(JSON.stringify(v));
const noT = (v) => { if (!v) return v; const o = plain(v); delete o.t; return o; };   /* the judgement also carries the candle's start time */
function api() {
  const src = [grab(lens, /const BC_OPEN = 570[^\n]*/, "BC constants"), grab(lens, /const NY_FMT = new Intl\.DateTimeFormat[^\n]*/, "NY_FMT"),
    grab(lens, /export function bcEligible[^\n]*/, "bcEligible").replace("export ", ""), grab(lens, /export function nyParts[^\n]*/, "nyParts").replace("export ", ""),
    grab(lens, /export function bcUsual\([\s\S]*?\n\}/, "bcUsual").replace("export ", ""), grab(lens, /export function bcJudge\([\s\S]*?\n\}/, "bcJudge").replace("export ", ""),
    grab(lens, /const BC_HOLD_MS = [^\n]*/, "hold"), grab(lens, /export function bcFade[^\n]*/, "bcFade").replace("export ", ""), grab(lens, /export function bcAdd\([\s\S]*?\n\}/, "bcAdd").replace("export ", ""),
    grab(lens, /export function bcShown[^\n]*/, "bcShown").replace("export ", ""),
    "globalThis.out = { bcEligible, nyParts, bcUsual, bcJudge, bcFade, bcAdd, bcShown, BC_HOLD_MS, BC_OPEN, BC_OPEN_END, BC_CLOSE };"].join("\n");
  const ctx = { Intl, Date, Math, Number, Set, Map, JSON }; vm.runInNewContext(src, ctx); return ctx.out;
}
/* November 2026 is Eastern Standard Time: New York = UTC-5 */
const at = (date, hhmm) => { const [y, mo, d] = date.split("-").map(Number), [h, mi] = hhmm.split(":").map(Number); return Date.UTC(y, mo - 1, d, h + 5, mi); };
const bar = (date, hhmm, range, up = true) => ({ t: at(date, hhmm), o: up ? 100 : 100 + range, c: up ? 100 + range : 100, h: 100 + range, l: 100 });
const DAYS = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-16", "2026-11-17", "2026-11-18"];
const TODAY = "2026-11-19";
function history() {
  const out = [];
  DAYS.forEach((d, i) => {
    const old = i < DAYS.length - 10;   /* the three oldest sessions are outside the last 10: wild ranges that must not count */
    out.push(bar(d, "07:00", 40));   /* pre-market: never counted */
    for (let m = 570; m < 960; m += 5) { const hh = String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); out.push(bar(d, hh, old ? 50 : m < 600 ? 2 : 1)); }
    out.push(bar(d, "16:30", 40));   /* after-hours: never counted */
  });
  out.push(bar(TODAY, "09:30", 30));   /* today: never part of the usual */
  return out;
}

test("big candles · which names: US stocks and ETFs; futures, crypto, rates, FX, VIX, put/call and breadth have no 09:30-16:00 day", () => {
  const A = api();
  for (const t of ["NVDA", "SPY", "QQQ", "MU", "SNDK", "AXTI"]) assert.equal(A.bcEligible(t), true, t);
  for (const t of ["ESUSD", "NQUSD", "CLUSD", "GCUSD", "BTCUSD", "DXUSD", "VIX", "PCC", "ADVDEC", "US10Y"]) assert.equal(A.bcEligible(t), false, t);
  assert.match(lens, /const bcNames = \(\) => names\(\)\.filter\(\(t\) => bcEligible\(t\) && !OFF_API\[t\]\);/, "a name without history (ANT, listed today) is never judged");
});

test("big candles · the usual range: the last 10 sessions before today, regular hours only, the first 30 minutes by clock slot", () => {
  const A = api(), u = plain(A.bcUsual(history(), TODAY));
  assert.equal(u.sessions, 10, "ten sessions, the three older ones dropped");
  assert.equal(u.all, 1, "the day after 10:00: range 1 (pre-market, after-hours, today and the older sessions left out)");
  assert.deepEqual(Object.keys(u.slot).map(Number), [570, 575, 580, 585, 590, 595], "six opening slots");
  for (const v of Object.values(u.slot)) assert.equal(v, 2, "each opening slot: range 2");
  const p = A.nyParts(at("2026-11-19", "09:35")); assert.equal(p.date, "2026-11-19"); assert.equal(p.m, 575, "New York clock minutes");
});

test("big candles · the judgement: the latest FINISHED regular-hours candle, 3x big, 2x large, green up, red down, held 10 minutes at most", () => {
  const A = api(), u = A.bcUsual(history(), TODAY);
  const day = [bar(TODAY, "10:25", 1), bar(TODAY, "10:30", 3.2)];
  assert.deepEqual(noT(A.bcJudge(day, u, TODAY, 636)), { level: "big", dir: "up", mult: 3.2, m: 630 }, "10:30 candle finished at 10:35: 3.2x the day's usual");
  assert.equal(A.bcJudge(day, u, TODAY, 634).level, null, "10:30 not finished yet: the 10:25 candle (1x) is the one judged");
  assert.equal(A.bcJudge(day, u, TODAY, 646), null, "more than 10 minutes after its end: no box");
  assert.deepEqual(noT(A.bcJudge([bar(TODAY, "10:30", 2.4, false)], u, TODAY, 637)), { level: "large", dir: "down", mult: 2.4, m: 630 }, "2.4x, closed down: the faint red box");
  assert.deepEqual(noT(A.bcJudge([bar(TODAY, "09:35", 4.5)], u, TODAY, 581)), { level: "large", dir: "up", mult: 2.25, m: 575 }, "an opening candle against its own slot (2), not the day (1)");
  assert.equal(A.bcJudge([bar(TODAY, "15:55", 3.5), bar(TODAY, "16:00", 9)], u, TODAY, 965).level, "big", "after the close the 16:00 bar is extended hours: the 15:55 candle is judged");
  assert.equal(A.bcJudge([bar(TODAY, "15:55", 3.5)], u, TODAY, 971), null, "and gone by 16:11");
  assert.equal(A.bcJudge([bar("2026-11-18", "15:55", 9)], u, TODAY, 600), null, "yesterday's candle never shows today");
  assert.equal(A.bcJudge(day, { all: null, slot: {} }, TODAY, 636), null, "no usual range: no judgement");
});

test("big candles · wired: one label per cell, the box classes, read every minute and after each 5-minute close, painted on every copy, never in a loop", () => {
  assert.match(lens, /<span class="why"><\/span><span class="un"><\/span><span class="bc"><\/span>/, "the label beside the volume words");
  for (const c of [".lens.bigc.bc-big.bc-up::before", ".lens.bigc.bc-big.bc-down::before", ".lens.bigc.bc-large.bc-up::before", ".lens.bigc.bc-large.bc-down::before", ".lens.glow.bigc::before"]) assert.ok(lens.includes(c + "{"), c);
  assert.match(lens, /\.lens\.bigc::before\{ content:""; position:absolute; inset:0; pointer-events:none; z-index:2; opacity:var\(--bcf, 1\); \}/, "the ring fades on its own layer and never blocks a click");
  assert.match(lens, /if \(!S\.bcU\.busy && \(now \|\| Date\.now\(\) - S\.bcAt > BC_MS\)\) readBc\(\);/, "once a minute, never on half the names while the usual ranges load");
  assert.match(lens, /finally \{ S\.bcU\.busy = false; S\.bcAt = 0; \}/, "and at once when they are in");
  assert.match(lens, /readBars\(true\); readOff\(true\); readBc\(\); return; \}/, "and just after a 5-minute close");
  assert.match(lens, /if \(S\.bc\) paintBc\(\);/, "repainted with the cells, so a rebuilt tape keeps its boxes");
  assert.match(lens, /&tf=5m&limit=2400&authority=provider/, "ten sessions of 5-minute bars, once a day");
  assert.match(lens, /&tf=5m&limit=3&authority=provider/, "the live read: the last three bars");
  assert.match(lens, /Date\.now\(\) - \(S\.bcU\.tried\.get\(t\) \|\| 0\) > 600000/, "a name with no usual range is retried after 10 minutes, never every tick");
  assert.match(lens, /remember\(BC_KEY, JSON\.stringify\(\{ date: now\.date, u: Object\.fromEntries\(S\.bcU\.map\) \}\)\)/, "the day's usual ranges kept on this machine");
});

test("big candles · kept 30 minutes after the candle, fading to a quarter; the newest per name; the day's list kept on the machine for the tapes box", () => {
  const A = api(), t0 = at(TODAY, "10:30"), v = { level: "big", dir: "up", mult: 3.2, m: 630, t: t0 }, end = t0 + 300000;
  let list = A.bcAdd([], "MU", v);
  assert.deepEqual(plain(list), [{ s: "MU", m: 630, end, dir: "up", mult: 3.2, level: "big" }]);
  assert.equal(A.bcAdd(list, "MU", v), list, "the same candle is kept once");
  assert.equal(A.bcAdd(list, "MU", { ...v, level: null }), list, "an ordinary candle is not kept");
  list = A.bcAdd(list, "MU", { level: "large", dir: "down", mult: 2.2, m: 640, t: at(TODAY, "10:40") });
  list = A.bcAdd(list, "WMT", { level: "large", dir: "down", mult: 2.6, m: 635, t: at(TODAY, "10:35") });
  assert.deepEqual(plain(list).map((e) => e.s + "@" + e.m), ["MU@640", "WMT@635", "MU@630"], "newest first");
  const shown = A.bcShown(list, at(TODAY, "10:50"));
  assert.deepEqual([...shown.keys()].sort(), ["MU", "WMT"]); assert.equal(shown.get("MU").m, 640, "a name shows its newest candle");
  assert.equal(A.bcShown(list, at(TODAY, "11:11")).has("WMT"), false, "gone 30 minutes after its candle finished (10:35 candle, finished 10:40, gone after 11:10)");
  assert.equal(A.bcShown(list, at(TODAY, "11:09")).has("WMT"), true, "still there at 29 minutes");
  assert.equal(A.bcFade(0), 1); assert.equal(A.bcFade(15 * 60000), 0.63); assert.equal(A.bcFade(30 * 60000), 0.25); assert.equal(A.bcFade(99 * 60000), 0.25);
  assert.equal(A.BC_HOLD_MS, 30 * 60000);
  for (let i = 0; i < 30; i++) list = A.bcAdd(list, "X" + i, { level: "big", dir: "up", mult: 3, m: 650 + i, t: at(TODAY, "10:50") + i * 60000 });
  assert.equal(list.length, 20, "twenty at most");
  assert.match(lens, /remember\(BC_RECENT_KEY, JSON\.stringify\(S\.bcRecent\)\);/, "kept on this machine, so a reload keeps the boxes and the tapes can list them");
  assert.match(lens, /if \(Date\.now\(\) - \(S\.bcPaintAt \|\| 0\) > 30000\) \{ S\.bcPaintAt = Date\.now\(\); paintBc\(\); \}/, "the fade moves even when nothing new is read");
  assert.match(lens, /"\\u00D7 5-min \\u00B7 " \+ hh/, "the words carry the candle's time");
});

test("big candles · the tapes' '5-min candles' box: two of the last hour, 3x first, fixed at the right of the SCINTILLAS row", () => {
  const tapes = read("../station-shells/tapes-v1/index.html");
  assert.match(tapes, /<div class="head bcbox" id="bcBox"><span class="k">5-min candles<\/span><\/div><\/div>/, "the box sits after the SCINTILLAS tape, in the same row");
  const src = [grab(tapes, /const esc = [^\n]*/, "esc"), grab(tapes, /const BC_RECENT_KEY = [^\n]*/, "keys"), grab(tapes, /function bcBoxHTML\([\s\S]*?\n\}/, "bcBoxHTML"), "globalThis.out = { bcBoxHTML };"].join("\n");
  const ctx = { String, Number, Math }; vm.runInNewContext(src, ctx);
  const now = at(TODAY, "11:30"), mk = (s, hhmm, dir, mult, level) => ({ s, m: +hhmm.slice(0, 2) * 60 + +hhmm.slice(3), end: at(TODAY, hhmm) + 300000, dir, mult, level });
  const html = ctx.out.bcBoxHTML([mk("SPY", "11:20", "up", 2.3, "large"), mk("WMT", "11:15", "down", 2.6, "large"), mk("AMD", "11:10", "up", 3.1, "big"), mk("NVDA", "10:45", "up", 3.4, "big"), mk("OLD", "10:10", "up", 5, "big")], now);
  assert.match(html, /bci up">AMD \u25B23\.1\u00D7 <span class="sub">11:10<\/span>/, "3x first, newest first");
  assert.match(html, /bci up old">NVDA \u25B23\.4\u00D7/, "then the older 3x one, dimmed past 30 minutes");
  assert.ok(!html.includes("SPY") && !html.includes("WMT") && !html.includes("OLD"), "two at most; 2-3x only when no 3x fills the box; the last hour only");
  assert.match(ctx.out.bcBoxHTML([mk("WMT", "11:15", "down", 2.6, "large")], now), /bci dn">WMT \u25BC2\.6\u00D7/, "a 2-3x one when there is room");
  assert.match(ctx.out.bcBoxHTML([], now), /none in the last hour/);
  assert.match(tapes, /if \(ROWS > 1\) \{ paintScintHead\(now\); paintBcBox\(now\); \}/, "painted every second with the SCINTILLAS head");
});
