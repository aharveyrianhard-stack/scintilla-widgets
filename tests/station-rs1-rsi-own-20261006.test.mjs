/* RS1 (6 Oct 2026) — the Station's daily RSI, read against each name's own last two years.
   Alan: "I see Netflix at 33 and I don't think that's green enough." The Hub board colours its RSI cell from a nightly
   table; the Station applies the SAME rule in the two places it shows a daily RSI number:
     /chart (+ shell mirror)  the "RSI D" chip in the oscillator pane — the scale is built in the browser from the daily bars
                              the pane already reads (this page holds no database client);
     /geiger                  the RSI · DAILY row, the one Station place that judged by the textbook 30 / 70 — it reads the
                              name's nightly row.
   The fixture (tests/fixtures/rs1-rsi-own.json) is the Hub loader's own output from the live chart API on 6 Oct plus SPY's
   finished daily closes, so these tests fail if the Station's rule ever drifts from the Hub's. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const context = { Intl, Date, Math, Number, JSON, Array, Object, Set, Map, isFinite, parseInt, console, String };
vm.runInNewContext(read("../station-shells/detail-v1/indicators.js"), context);
vm.runInNewContext(read("../_indicators/station-rsi-fan.js"), context);
vm.runInNewContext(read("../_indicators/station-osc-merge.js"), context);
vm.runInNewContext(read("../_indicators/station-rsi-own.js"), context);
const F = context.SC_RSI_FAN, O = context.SC_OSC_LAB, R = context.SC_RSI_OWN;
const plain = (v) => JSON.parse(JSON.stringify(v));
const chart = read("../chart/index.html"), twin = read("../station-shells/chart-v1/index.html"), geiger = read("../geiger/index.html");
const fx = JSON.parse(read("./fixtures/rs1-rsi-own.json"));
const spyBars = fx.spy.bars.map(([t, c]) => ({ t, c }));
const PINK = [255, 79, 173];

test("1 · the Station's maths is the Hub's: SPY's scale from the same bars is the row the Hub's loader wrote, number for number", () => {
  const judged = spyBars[spyBars.length - 1].t;                 // the 5 Oct 2026 close is the reading; the sessions before it are the sample
  const s = plain(R.scaleFrom("SPY", spyBars, judged)), row = fx.rows.SPY;
  assert.deepEqual(s.grid, row.grid);
  assert.equal(s.sessions, row.sessions); assert.equal(s.window_from, row.window_from); assert.equal(s.as_of, row.as_of);
  assert.equal(s.eligible, true);
  assert.deepEqual([s.p10, s.p20, s.p50, s.p80, s.p90], [row.p10, row.p20, row.p50, row.p80, row.p90]);
  assert.deepEqual(plain(R.scaleFrom("SPY", spyBars)), s, "with no reading named, the newest bar is the one judged");
  /* the ribbon's shape ({ d: ISO, p: close }) is read the same way */
  assert.deepEqual(plain(R.scaleFrom("SPY", spyBars.map((b) => ({ d:new Date(b.t).toISOString(), p:b.c })), judged)), s);
  const rsi = R.wilderRsi(spyBars.map((b) => b.c));
  assert.ok(Math.abs(rsi[rsi.length - 1] - fx.spy.fmp_rsi_14_at_2026_10_05) < 0.02, "and its RSI is the number FMP stored for that close");
  assert.equal(R.percentileOf(s.grid, row.rsi), row.pct, "the same percentile the Hub stored");
  /* the fan's own RSI (what the chip prints) is the same recurrence */
  const fan = F.lineSeries("1D", spyBars.slice(-900));
  assert.ok(Math.abs(fan[fan.length - 1].v - rsi[rsi.length - 1]) < 0.01, "the chip's number and the scale are one measure");
  /* intraday: today's forming bar is the reading, so every finished session is in the sample */
  const today = judged + 864e5;
  assert.equal(R.scaleFrom("SPY", spyBars, today).sessions, row.sessions + 1);
});

test("2 · weekend prints are not sessions (except Bitcoin's), a reused ticker is cut at the join, and a young name has no own scale", () => {
  const b = spyBars.slice(-700), day = 864e5;
  const withWeekends = [];
  for (const x of b) { withWeekends.push(x); if (new Date(x.t).getUTCDay() === 5) withWeekends.push({ t:x.t + day, c:x.c * 1.001 }); }
  const judged = b[b.length - 1].t;
  assert.deepEqual(plain(R.scaleFrom("DXUSD", withWeekends, judged)), plain(R.scaleFrom("DXUSD", b, judged)));
  assert.ok(R.scaleFrom("BTCUSD", withWeekends, judged).sessions > R.scaleFrom("DXUSD", b, judged).sessions + 60);
  const joined = b.map((x, i) => (i < 400 ? { t:x.t - 60 * day, c:x.c * 3 } : x));
  assert.ok(R.scaleFrom("REUSED", joined, judged).sessions <= 300 - 14);
  assert.equal(R.scaleFrom("NEWCO", spyBars.slice(-150)).eligible, false, "150 sessions is not a year");
  assert.equal(R.scaleFrom("ONEYEAR", spyBars.slice(-300)).eligible, true);
  assert.equal(R.scaleFrom("TINY", spyBars.slice(-30)), null);
  assert.equal(R.scaleFrom("NONE", []), null);
  assert.equal(R.DAILY_NEED, 900, "two calendar years of a 7-day series (731) plus a run-in");
});

test("3 · the Hub's curve on this surface's own resting colour: untouched at the name's middle, full green at its 10th, full red at its 90th", () => {
  assert.equal(R.ownInk(50, PINK), null, "its own middle: the pane's pink, exactly as before");
  assert.equal(R.ownInk(49, PINK), null); assert.equal(R.ownInk(51.9, PINK), null);
  assert.equal(R.ownInk(10, PINK), "rgb(0,255,163)"); assert.equal(R.ownInk(0, PINK), "rgb(0,255,163)");
  assert.equal(R.ownInk(90, PINK), "rgb(255,45,85)"); assert.equal(R.ownInk(100, PINK), "rgb(255,45,85)");
  assert.equal(R.ownInk(10, [162, 75, 255]), "rgb(0,255,163)", "the end colours do not depend on the surface");
  const ch = (c) => c.match(/\d+/g).map(Number);
  let prev = ch(R.ownInk(47, PINK));
  for (let p = 46; p >= 10; p--) { const c = ch(R.ownInk(p, PINK)); assert.ok(c[0] <= prev[0] && c[1] >= prev[1], "greener as it falls: " + p); prev = c; }
  prev = ch(R.ownInk(53, PINK));
  for (let p = 54; p <= 90; p++) { const c = ch(R.ownInk(p, PINK)); assert.ok(c[1] <= prev[1], "redder as it rises: " + p); prev = c; }
  assert.equal(R.ownInk(null, PINK), null); assert.equal(R.ownInk(20, null), null);
  assert.deepEqual(plain(R.hexRgb("#FF4FAD")), PINK);
  assert.equal(R.ownExtreme(10), true); assert.equal(R.ownExtreme(90), true); assert.equal(R.ownExtreme(10.1), false); assert.equal(R.ownExtreme(89.9), false);
});

test("4 · what a surface is handed: Netflix at 33, the ends in words, a young name, and nothing at all", () => {
  const nflx = plain(R.read("NFLX", fx.rows.NFLX.rsi, fx.rows.NFLX, "#FF4FAD"));
  assert.equal(nflx.own, true); assert.equal(nflx.pct, fx.rows.NFLX.pct); assert.equal(nflx.extreme, false);
  assert.equal(nflx.title, "33 — lower than 86% of NFLX's last two years");
  const c = nflx.ink.match(/\d+/g).map(Number);
  assert.ok(c[1] > 220 && c[0] < 60, "nearly full green: " + nflx.ink);
  const tlt = R.read("TLT", fx.rows.TLT.rsi, fx.rows.TLT, PINK);
  assert.equal(tlt.extreme, true); assert.equal(tlt.ink, "rgb(0,255,163)"); assert.equal(tlt.title, "22 — the lowest reading of TLT's last two years");
  const tsm = R.read("TSM", fx.rows.TSM.rsi, fx.rows.TSM, PINK);
  assert.equal(tsm.extreme, true); assert.equal(tsm.ink, "rgb(255,45,85)"); assert.equal(tsm.title, "76 — higher than 99% of TSM's last two years");
  assert.equal(R.read("CRWV", fx.rows.CRWV.rsi, fx.rows.CRWV, PINK).title, "50 — higher than 52% of CRWV's last 18 months");
  const young = plain(R.read("CBRS", 72, fx.rows.CBRS, PINK));
  assert.deepEqual(young, { pct:null, own:false, ink:null, extreme:false, title:"72 — CBRS has under a year of its own history: no own scale yet" });
  assert.deepEqual(plain(R.read("ZZZ", 25, null, PINK)), { pct:null, own:false, ink:null, extreme:false, title:"" });
  assert.deepEqual(plain(R.read("NFLX", null, fx.rows.NFLX, PINK)), { pct:null, own:false, ink:null, extreme:false, title:"" });
  /* every row the Hub's loader wrote reads the same percentile here */
  for (const t of Object.keys(fx.rows)) if (fx.rows[t].eligible) assert.equal(R.read(t, fx.rows[t].rsi, fx.rows[t], PINK).pct, fx.rows[t].pct, t);
});

/* ---- the chip, drawn by the page's own painter against a canvas that records what it is told ------------------------ */
const drawSrc = chart.slice(chart.indexOf("function drawRsiOnly(ctx, o) {"), chart.indexOf("const cloudSpecOptions"));
function recorder() {
  const ops = [];
  const ctx = new Proxy({ measureText:(t) => ({ width:String(t).length * 6 }) }, {
    get(target, k) {
      if (k in target) return target[k];
      if (k === "fillText") return (t, x, y) => ops.push({ op:"text", t, style:target.fillStyle, shadow:target.shadowBlur || 0, shadowColor:target.shadowColor });
      if (k === "strokeRect") return (x, y, w, h) => ops.push({ op:"strokeRect", style:target.strokeStyle });
      return () => {};
    },
    set(target, k, v) { target[k] = v; return true; }
  });
  return { ctx, ops };
}
const KEYS = ["3h", "4h", "6h", "8h", "12h", "1D"], N = 40, T_BAR = Date.UTC(2026, 9, 5, 4);
const lineOf = (key, last) => ({ key, values:Array.from({ length:N }, (_, i) => (i === N - 1 ? last : 50)),
  status:{ value:last, t:T_BAR, stale:false }, approx:false, from:"served", tip:null });
function fanFixture(dailyRsi) {
  const cloud = { band:Array.from({ length:N }, () => ({ lo:44, hi:58 })),
    parts:F.CONTEXT.map((c, k) => ({ key:c.key, values:Array(N).fill([44, 50, 58, 52][k]), absence:null, from:"served" })) };
  const rsi = { lines:KEYS.map((k) => lineOf(k, k === "1D" ? dailyRsi : 55)), cloud };
  const williams = { lines:KEYS.map((k) => lineOf(k, 60)), cloud:null };
  return { lines:rsi.lines, cloud, sets:{ rsi, williams } };
}
const opts = (dailyRsi, extra) => Object.assign({ fan:fanFixture(dailyRsi), X:(i) => 10 + i * 10, start:0, end:N - 1, last:N - 1, left:6, width:400,
  top:300, height:120, gap:6, hairline:"#556", font:9, chipFont:10, gutterRight:460, scrubIx:null, oscReadout:"compact", dateAt:() => null }, extra);
const draw = (win, o) => {
  const sandbox = { window:win, rsiAsOf:() => "5 OCT", isFinite, Math, Number, Object, Array, Date, String };
  vm.runInNewContext(drawSrc + "\nthis.drawOsc = drawOsc;", sandbox);
  const rec = recorder(); const r = sandbox.drawOsc(rec.ctx, o);
  return { r, chipText:rec.ops.find((x) => x.op === "text" && /^RSI D /.test(x.t)), edges:rec.ops.filter((x) => x.op === "strokeRect") };
};
const ownOf = (t) => { const asked = []; return { asked, ticker:t, scaleAt:(ms) => { asked.push(ms); return fx.rows[t]; } }; };
const pinkText = F.rgba("#FF4FAD", O.LOOK.chipLook.text);

test("5 · the RSI D chip: the number takes the name's own colour, glows steadily at its own extremes, and carries the line", () => {
  /* Netflix at 33: nearly full green, not yet an extreme */
  let own = ownOf("NFLX"), d = draw({ SC_RSI_FAN:F, SC_OSC_LAB:O, SC_RSI_OWN:R }, opts(fx.rows.NFLX.rsi, { own }));
  assert.equal(d.chipText.t, "RSI D 32.8", "the text is exactly what it was");
  assert.equal(d.chipText.style, R.read("NFLX", fx.rows.NFLX.rsi, fx.rows.NFLX, "#FF4FAD").ink);
  assert.equal(d.chipText.shadow, 0); assert.equal(d.edges.length, 0, "no glow, no edge: 33 is not NFLX's own bottom tenth");
  assert.deepEqual(own.asked, [T_BAR], "judged against the sessions before the reading's own daily bar");
  assert.equal(d.r.chip.title, "33 — lower than 86% of NFLX's last two years · RSI(14) 32.79, source 1D, confirmed");
  assert.equal(d.r.chip.own.pct, fx.rows.NFLX.pct); assert.equal(d.r.chip.own.extreme, false);
  /* TLT at 22, the lowest of its two years: full green, a steady glow and an edge */
  d = draw({ SC_RSI_FAN:F, SC_OSC_LAB:O, SC_RSI_OWN:R }, opts(fx.rows.TLT.rsi, { own:ownOf("TLT") }));
  assert.equal(d.chipText.style, "rgb(0,255,163)"); assert.equal(d.chipText.shadow, 6); assert.equal(d.chipText.shadowColor, "rgb(0,255,163)");
  assert.equal(d.edges.length, 1); assert.equal(d.edges[0].style, "rgb(0,255,163)");
  assert.equal(d.r.chip.own.extreme, true);
  /* TSM at 76, higher than 99% of its days: full red */
  d = draw({ SC_RSI_FAN:F, SC_OSC_LAB:O, SC_RSI_OWN:R }, opts(fx.rows.TSM.rsi, { own:ownOf("TSM") }));
  assert.equal(d.chipText.style, "rgb(255,45,85)"); assert.equal(d.edges.length, 1);
  /* SPY at 59 is the middle of ITS range: still tinted, never an extreme; a reading at its exact middle stays pink */
  d = draw({ SC_RSI_FAN:F, SC_OSC_LAB:O, SC_RSI_OWN:R }, opts(fx.rows.SPY.p50, { own:ownOf("SPY") }));
  assert.equal(d.chipText.style, pinkText, "its own middle: the pane's pink"); assert.equal(d.edges.length, 0);
  assert.match(d.r.chip.title, /^\d+ — (higher|lower) than 5\d% of SPY's last two years · RSI\(14\)/);
  /* the developing bar is the reading: its own time is the one asked for */
  own = ownOf("NFLX"); const o = opts(33, { own }); const dl = o.fan.lines.find((l) => l.key === "1D");
  dl.tip = { ix:N - 1, t:T_BAR + 864e5, developing:true };
  draw({ SC_RSI_FAN:F, SC_OSC_LAB:O, SC_RSI_OWN:R }, o);
  assert.deepEqual(own.asked, [T_BAR + 864e5]);
});

test("6 · with no own scale the chip is exactly the chip it was: a young name, no scale yet, or the module not loaded", () => {
  const base = draw({ SC_RSI_FAN:F, SC_OSC_LAB:O }, opts(90));
  assert.equal(base.chipText.style, pinkText); assert.equal(base.chipText.shadow, 0); assert.equal(base.edges.length, 0);
  assert.equal(base.r.chip.title, "RSI(14) 90.00, source 1D, confirmed"); assert.equal(base.r.chip.own, undefined);
  for (const [win, own] of [
    [{ SC_RSI_FAN:F, SC_OSC_LAB:O, SC_RSI_OWN:R }, null],                                   // the scale has not landed
    [{ SC_RSI_FAN:F, SC_OSC_LAB:O, SC_RSI_OWN:R }, { ticker:"ZZZ", scaleAt:() => null }],   // too few bars for any scale
    [{ SC_RSI_FAN:F, SC_OSC_LAB:O }, ownOf("TLT")],                                         // the module did not load
  ]) {
    const d = draw(win, opts(90, { own }));
    assert.equal(d.chipText.style, pinkText); assert.equal(d.chipText.shadow, 0); assert.equal(d.edges.length, 0);
    assert.equal(d.r.chip.title, base.r.chip.title); assert.equal(d.r.chip.own, undefined);
  }
  /* a young name keeps the pink and says why */
  const y = draw({ SC_RSI_FAN:F, SC_OSC_LAB:O, SC_RSI_OWN:R }, opts(72, { own:ownOf("CBRS") }));
  assert.equal(y.chipText.style, pinkText); assert.equal(y.edges.length, 0);
  assert.equal(y.r.chip.title, "72 — CBRS has under a year of its own history: no own scale yet · RSI(14) 72.00, source 1D, confirmed");
});

test("7 · the wiring: one source kept, one daily read kept, twins identical, and /geiger's 30 / 70 row follows the name", () => {
  assert.equal(chart, twin, "chart/index.html and station-shells/chart-v1/index.html are the same file");
  /* ONE SOURCE (22 Sep): the chart pane still holds no database client - it builds the scale from its own daily bars */
  assert.doesNotMatch(chart, /rsi_own_percentiles|\/rest\/v1\//);
  assert.match(chart, /<script src="\/_indicators\/station-osc-merge\.js"><\/script>\n<!-- RS1[^\n]*-->\n<script src="\/_indicators\/station-rsi-own\.js"><\/script>/);
  /* ONE DAILY READ PER TICKER (S1): the same shared read, asked for the longer length - never a second request */
  assert.match(chart, /function dailyNeedFor\(host\) \{[\s\S]*?return Math\.max\(cloudDailyNeed\(range, host && host\._historyLimit\), fanDailyNeed\(host\)\);/);
  assert.match(chart, /return own \? plan\.map\(\(\[tf, need\]\) => \(tf === "1D" \? \[tf, Math\.max\(need, own\)\] : \[tf, need\]\)\) : plan;/);
  assert.match(chart, /const due = rsiFanPlan\(host\)\n/);
  assert.match(chart, /const entry = R && t \? cloudDailyCache\.get\(t\) : null;/, "the scale is built from the ribbon's own cached daily read");
  assert.equal((chart.match(/fetchProviderCandles\(t, CLOUD_DAILY_TF, asked, 2\)/g) || []).length, 1, "still the one daily request");
  assert.match(chart, /own:rsiOwnSource\(host\) \};/);
  assert.match(chart, /if \(area\.title !== ownTip\) area\.title = ownTip;/, "the hover is the browser's own, only while the pointer is on the chip");
  /* no breath: the pane is never repainted on a timer for this */
  assert.doesNotMatch(drawSrc, /requestAnimationFrame|setInterval|setTimeout/);
  /* /geiger: reads the nightly row once, three weeks at most, and keeps 30 / 70 without it */
  assert.match(geiger, /<script src="\/_indicators\/station-rsi-own\.js"><\/script>/);
  assert.match(geiger, /pg\("rsi_own_percentiles\?ticker=eq\." \+ enc \+ "&as_of=gte\." \+ ownSince \+ "&select=ticker,as_of,window_from,sessions,eligible,grid", 1\)\.catch\(\(\) => \[\]\)/);
  assert.match(geiger, /const ownSince = new Date\(Date\.now\(\) - 21 \* 86400e3\)/);
  assert.match(geiger, /const rsiOwn = d\.rsiOwn && d\.rsiOwn\.eligible && typeof SC_RSI_OWN !== "undefined" \? d\.rsiOwn : null;/);
  assert.match(geiger, /: \{ mn:0, mx:100, lo:30, hi:70, loL:"30", hiL:"70" \},\n\s+rsiOwn \? \(v\) => \{ const rd = rsiOwnRead\(v\); return rd\.own \? \(rd\.ink \|\| GS_PUR\) : gsTipR\(v\); \} : gsTipR,/);
  assert.match(geiger, /const gsTipR = \(v\) => v <= 30 \? "var\(--gs-bull\)" : v >= 70 \? "var\(--gs-bear\)" : GS_PUR;/, "the textbook rule is still there for a name with no own scale");
  /* the row builder with an own scale: marks at the name's own 10th / 90th, the hover in words */
  const src = geiger.slice(geiger.indexOf("const GS_PUR ="), geiger.indexOf("/* THE PROVIDER SERVES ONE MACD SNAPSHOT"));
  const api = vm.runInNewContext(src + "\n({ gsMtf, gsTipR, GS_PUR })", {});
  const node = { innerHTML:"" }, row = fx.rows.NFLX;
  const rd = (v) => R.read("NFLX", v, row, [162, 75, 255]);
  api.gsMtf(node, [["1D", row.rsi]], { mn:0, mx:100, lo:row.grid[10], hi:row.grid[90], loL:String(Math.round(row.grid[10])), hiL:String(Math.round(row.grid[90])) },
    (v) => rd(v).ink || api.GS_PUR, (v) => Math.round(v), (v) => rd(v).title);
  assert.match(node.innerHTML, /<span style="left:31\.16%">31<\/span><span style="left:71\.23%">71<\/span>/, "the marks sit at NFLX's own 10th and 90th");
  assert.match(node.innerHTML, /title="33 — lower than 86% of NFLX's last two years"/);
  assert.ok(node.innerHTML.includes('<span class="gs-mv" style="color:' + rd(row.rsi).ink + '">33</span>'));
  const plainNode = { innerHTML:"" };
  api.gsMtf(plainNode, [["1D", 29]], { mn:0, mx:100, lo:30, hi:70, loL:"30", hiL:"70" }, api.gsTipR, (v) => Math.round(v));
  assert.doesNotMatch(plainNode.innerHTML, /title=/); assert.match(plainNode.innerHTML, /color:var\(--gs-bull\)">29</, "without a scale the row is the row it was");
});
