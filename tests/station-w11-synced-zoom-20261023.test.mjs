/* W11 (23 Oct 2026). Alan, ~00:50 ET: "The zooming of the charts needs to be synced. The date range kind of thing."
   live-v1 &sync=1 posts its time window after his wheel / drag / double-click ({ type:"SCINTILLA_CHART_VIEW", n, view:{ span, end } },
   at most ten a second) and obeys { sc:"chart", view } on its own bars without posting back; pair-v1 forwards a view to the other chart
   only. A new timeframe keeps the clock window where ten or more of its bars fit it. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const live = read("../station-shells/live-v1/index.html");
const pair = read("../station-shells/pair-v1/index.html");
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, what + " must exist"); return m[0]; };
const fnOf = (src, name) => grab(src, new RegExp("\\n(?:async )?function " + name + "\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}\\n|\\nfunction " + name + "\\([^)]*\\) \\{[^\\n]*\\}\\n"), name);
const plain = (v) => JSON.parse(JSON.stringify(v));
function api() {
  const ctx = {}; vm.runInNewContext([fnOf(live, "viewOf"), fnOf(live, "windowBars"), fnOf(live, "visibleBars"), "globalThis.out = { viewOf, windowBars, visibleBars };"].join("\n"), ctx);
  return ctx.out;
}
const FIVE = 300000, at = (hhmm) => Date.parse("2026-10-22T" + hhmm + ":00-04:00");
const day = (from, to, step = FIVE) => { const out = []; for (let t = at(from); t <= at(to); t += step) out.push({ t }); return out; };

test("W11 · a view is clock time: from the first visible bar's open to the last's close; null end = pinned to now", () => {
  const A = api(), bars = day("09:30", "15:55");
  assert.deepEqual(plain(A.viewOf(bars, 12, 23, FIVE, false)), { span:12 * FIVE, end:at("11:30") }, "10:30 .. 11:25 is 12 bars, ending at the 11:30 close");
  assert.equal(A.viewOf(bars, 12, 23, FIVE, true).end, null);
  assert.equal(A.viewOf([], 0, 0, FIVE, false), null);
});

test("W11 · the same clock window on another chart's own bars - gaps and other sessions included", () => {
  const A = api();
  const stock = day("09:30", "15:55"), fut = day("04:00", "16:55");                 /* a futures session holds bars the stock does not */
  const view = { span:2 * 3600000, end:at("12:00") };
  const s = A.windowBars(stock, view, FIVE), f = A.windowBars(fut, view, FIVE);
  assert.equal(stock[s.first].t, at("10:00")); assert.equal(stock[s.last].t, at("11:55")); assert.equal(s.count, 24);
  assert.equal(fut[f.first].t, at("10:00")); assert.equal(fut[f.last].t, at("11:55"), "the same window on the futures' own bars");
  const gappy = stock.filter((b, i) => i % 3 !== 1);                                   /* a thin name: some bars missing */
  const g = A.windowBars(gappy, view, FIVE);
  assert.ok(gappy[g.first].t >= at("10:00") && gappy[g.last].t < at("12:00") && g.count < 24, "fewer bars, the same clock window");
  /* pinned: each chart ends at its own newest close */
  const p = A.windowBars(stock, { span:3600000, end:null }, FIVE);
  assert.equal(p.pinned, true); assert.equal(stock[p.last].t, at("15:55")); assert.equal(stock[p.first].t, at("15:00"));
  assert.equal(A.windowBars(stock, { span:3600000, end:at("08:00") }, FIVE), null, "no bars in the window: nothing to fit");
});

test("W11 · the visible bars are counted by their centres; a fitted view shows exactly its window", () => {
  const A = api();
  /* fitted unpinned: right = last, spacing = plotW / count -> first .. last exactly */
  assert.deepEqual(plain(A.visibleBars(200, 120, 1000, 1000 / 24)), { first:97, last:120 });
  assert.deepEqual(plain(A.visibleBars(200, 199 + 3, 1000, 1000 / (24 + 3))), { first:176, last:199 }, "pinned: the right margin's slots excluded");
  const fit = fnOf(live, "applyView");
  assert.match(fit, /else \{ S\.viewRight = w\.last; S\.spacing = Math\.max\(2, Math\.min\(SPACING_MAX, P\.plotW \/ w\.count\)\); \}/);
  assert.match(fit, /if \(w\.pinned\) \{ S\.viewRight = null; S\.spacing = Math\.max\(2, Math\.min\(SPACING_MAX, P\.plotW \/ \(w\.count \+ P\.rightPad\)\)\); \}/);
  assert.match(live, /const VIEW_MIN_BARS = 10, VIEW_POST_MS = 100, SPACING_MAX = 160;/);
});

test("W11 · posted only after his own wheel, drag or double-click, at most ten a second; a view it was given is never posted back", () => {
  assert.equal((live.match(/postViewSoon\(\)/g) || []).length, 4, "the definition aside, three gestures post: the drag, the wheel, the double-click");
  assert.match(live, /S\.hover = p; draw\(\); postViewSoon\(\); return;/, "drag");
  assert.match(live, /draw\(\); postViewSoon\(\);\n\}, \{ passive:false \}\);/, "wheel");
  assert.match(live, /area\.addEventListener\("dblclick", \(\) => \{ S\.viewRight = null; S\.spacing = TF\.daily \? 6 : 7; draw\(\); postViewSoon\(\); \}\);/, "back to now");
  const post = fnOf(live, "postViewSoon");
  assert.match(post, /if \(!SYNC \|\| window\.parent === window\) return;/);
  assert.match(post, /parent\.postMessage\(\{ type:"SCINTILLA_CHART_VIEW", n:N, view \}, location\.origin\)/);
  assert.match(post, /Math\.max\(0, VIEW_POST_MS - \(Date\.now\(\) - viewPostAt\)\)/, "one every 100 ms at most, the last one always sent");
  assert.doesNotMatch(fnOf(live, "applyView"), /postMessage|postViewSoon/, "an applied view is not posted");
  assert.match(live, /if \(SYNC && d\.view && typeof d\.view === "object" && d\.view\.span > 0 && \(d\.view\.end == null \|\| Number\.isFinite\(d\.view\.end\)\)\)/, "obeyed only in synced mode");
  assert.match(fnOf(live, "loadAll"), /if \(SYNC && S\.timeView\) applyView\(S\.timeView, true\);/, "a new symbol or timeframe keeps the window");
});

test("W11 · pair-v1 forwards a view to the other chart only", () => {
  assert.match(pair, /if \(e\.data\.type === "SCINTILLA_CHART_VIEW" && e\.data\.view && typeof e\.data\.view === "object"\) \{\n    const other = SIDES\.find\(\(x\) => x !== s\);/);
  assert.match(pair, /post\(other, \{ sc:"chart", view:e\.data\.view \}\);/);
  assert.doesNotMatch(pair, /post\(s, \{ sc:"chart", view/, "never back to the sender");
});
