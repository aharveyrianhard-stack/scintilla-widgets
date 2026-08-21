/* H3 (chart / touch) and H4 (YouTube) — the parts that can be proved from the code.
   ==============================================================================
   These are backlog items, not reported defects, so this suite is deliberately narrow: it
   asserts only what is decidable without a browser. Anything that needs an eye on a real pane
   — how a two-finger gesture *feels*, whether fullscreen looks right on the wall — is left to
   the preview checklist in STATION_VISIBLE_TRUTH_RECEIPT.md rather than asserted here on the
   strength of a plausible-looking function.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const chart = read("../chart/index.html");
const deck = read("../deck/index.html");
const personal = read("../station-shells/personal-video-v1/index.html");
const scintilla = read("../station-shells/scintilla-video-v1/index.html");

function fnFrom(source, name, bindings = {}) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}

/* ---- H3: bounded initial history, and zoom that does not depend on the timeframe ---------- */

const RANGES = ["15m", "30m", "1h", "2h", "3h", "4h", "6h", "12h", "1D", "3D", "1W"];

test("every timeframe has a bounded initial history — none reads without a limit", () => {
  assert.match(chart, /const CHART_RANGES = \[([^\]]*)\]/);
  const declared = JSON.parse(chart.match(/const CHART_RANGES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.deepEqual(declared, RANGES, "the ladder is the eleven agreed timeframes");

  const map = chart.match(/const CHART_DB_RANGE = (\{[^}]*\})/)[1];
  for (const range of RANGES) {
    const entry = new RegExp(`"${range}":\\["([^"]+)",(\\d+)\\]`).exec(map);
    assert.ok(entry, `${range} has a database mapping`);
    const limit = Number(entry[2]);
    assert.ok(limit > 0 && limit <= 300, `${range} asks for a bounded ${limit} candles`);
  }
});

test("zoom is arithmetic over point indices, so every timeframe zooms identically", () => {
  /* The claim under test is structural: nothing in the zoom path consults the timeframe, so
     there is no timeframe that can fail to zoom. setChartView is the single entry point. */
  const setView = fnFrom(chart, "setChartView", {
    scChartDraw:() => {}, broadcastChartView:() => {}, Math, isFinite, Number,
  });
  const view = fnFrom(chart, "chartView", { Math, isFinite });

  for (const range of RANGES) {
    const pts = Array.from({ length:240 }, (_, i) => ({ d:"2026-08-19T00:00:00Z", p:i + 1 }));
    const host = { _series:pts, _range:range, _view:null };
    view(host, pts);
    assert.deepEqual({ ...host._view }, { start:0, end:239 }, `${range} starts fully fitted`);

    setView(host, 200, 239);                       // zoom in on the right edge
    assert.equal(host._view.end - host._view.start, 39, `${range} zooms in`);
    assert.equal(host._followLatest, true, `${range} keeps the newest point anchored`);

    setView(host, 0, 239);                          // zoom back out
    assert.equal(host._view.end - host._view.start, 239, `${range} zooms back out`);
  }

  /* A span can never collapse below the floor or exceed the data, on any timeframe. */
  const pts = Array.from({ length:20 }, (_, i) => ({ d:"2026-08-19T00:00:00Z", p:i + 1 }));
  const host = { _series:pts, _view:null };
  setView(host, 10, 11);
  assert.ok(host._view.end - host._view.start >= 8, "the minimum span floor holds");
  setView(host, -50, 500);
  assert.equal(host._view.start, 0);
  assert.equal(host._view.end, 19, "the view cannot run past the data");
});

test("a gesture never asks for more history — the window moves, the read does not", () => {
  /* H3: no gesture-triggered history fetch. The zoom/pan handlers call setChartView, which
     redraws; only a deliberate load calls the fetch path. */
  const zoomPath = chart.slice(chart.indexOf("const applyLatestSpan"), chart.indexOf("host._applyTrackpadInput"));
  assert.doesNotMatch(zoomPath, /fetchChartSeries|scChartLoad|_historyLimit\s*=/,
    "no gesture handler reaches the history reader or grows the history window");
  assert.match(zoomPath, /setChartView\(/, "gestures move the view and nothing else");
});

test("a live quote never rewrites a completed candle", () => {
  /* H3: completed candles only. The cached series is the provider's; the live point is applied
     to a COPY and is never persisted, so nothing a quote does can change a stored bar. */
  assert.match(chart, /CACHE THE PURE PROVIDER SERIES FIRST/);
  assert.match(chart, /chartCache\.set\(key, \{ ts: Date\.now\(\), pts: pts, limit:limit \}\);\n\s*try \{ cacheSet/,
    "the pure series is what is cached");
  const cacheIndex = chart.indexOf("chartCache.set(key, { ts: Date.now(), pts: pts, limit:limit });");
  const liveIndex = chart.indexOf("return chApplyLivePoint(t, pts, liveQuote[t], range);", cacheIndex);
  assert.ok(liveIndex > cacheIndex, "the live point is applied after caching, never before");
  /* And the provider is asked for completed periods only. */
  assert.match(read("../_provider/provider.js"), /authority=provider/);
  assert.match(read("../_provider/provider.js"), /completed candles come from Massive/i);
});

/* ---- H4: the subscribed feed, transport, subscribe, and the fullscreen ladder ------------- */

test("both video shells keep a subscribed feed, correctly scoped", () => {
  for (const [name, source] of Object.entries({ personal, scintilla })) {
    assert.match(source, /const SUBSCRIBED = \{/, `${name} keeps the subscribed feed`);
    assert.match(source, /const SUBSCRIPTION_ACCOUNT = FEED === "scintilla" \? "scintilla" : "personal";/,
      `${name} scopes subscriptions to the right account`);
  }
  /* Personal is its own subscribed feed; SCINTILLA is the shared discovery grid and carries
     its own separate subscribed list. They must not collapse into one. */
  assert.match(personal, /SCINTILLA_SUBSCRIBED/);
  assert.match(personal, /\] : \[SUBSCRIBED\];/, "a personal feed offers only its own subscribed list");
});

test("previous and next are real, and are disabled when there is nowhere to go", () => {
  assert.match(personal, /id="bPrev"[^>]*aria-label="previous video"/);
  assert.match(personal, /id="bNext"[^>]*aria-label="next video"/);
  assert.match(personal, /el\("bPrev"\)\.disabled = !CUR \|\| !previousQueuedVideo\(rows, currentId\);/,
    "prev is disabled honestly rather than dead");
  assert.match(personal, /el\("bNext"\)\.disabled = !CUR \|\| !nextQueuedVideo\(rows, currentId\);/);

  /* An unavailable embed is skipped as well as an explicitly skipped one; the page keeps
     that set at module scope, so the test supplies it. */
  const queued = fnFrom(personal, "queuedVideo", { Set, Array, Math, Number, String,
    UNAVAILABLE_VIDEO_IDS:new Set() });
  const rows = [{ video_id:"a" }, { video_id:"b" }, { video_id:"c" }];
  assert.equal(queued(rows, "a", 1)?.video_id, "b", "next steps forward");
  assert.equal(queued(rows, "b", -1)?.video_id, "a", "previous steps back");
  assert.equal(queued(rows, "c", 1), null, "the end of the queue is the end");
  assert.equal(queued(rows, "a", -1), null, "and so is the start");
  /* An unplayable item is stepped over in BOTH directions, not just forward. */
  assert.equal(queued(rows, "a", 1, new Set(["b"]))?.video_id, "c");
  assert.equal(queued(rows, "c", -1, new Set(["b"]))?.video_id, "a");
  /* And an embed the player found unavailable is skipped in both directions too. */
  const withUnavailable = fnFrom(personal, "queuedVideo", { Set, Array, Math, Number, String,
    UNAVAILABLE_VIDEO_IDS:new Set(["b"]) });
  assert.equal(withUnavailable(rows, "a", 1)?.video_id, "c");
  assert.equal(withUnavailable(rows, "c", -1)?.video_id, "a");
});

test("subscribe is one action per channel, account-scoped, and cannot double-fire", () => {
  assert.match(personal, /async function subscribeToChannel\(v\)/);
  assert.match(personal, /if \(!channelId \|\| channelSubscribed\(v\) \|\| SUBSCRIBE_PENDING\.has\(channelId\)\) return;/,
    "an in-flight or already-subscribed channel is not asked twice");
  assert.match(personal, /ytAct\("sub", \{ channelId, channelTitle: v\.channel \|\| "", account:SUBSCRIPTION_ACCOUNT \}\)/,
    "the account travels with the action");
  assert.match(personal, /if \(!d\.ok\) throw new Error\("YouTube subscribe failed"\)/,
    "a failed subscribe is not reported as a success");
  assert.match(personal, /SUBSCRIBE_PENDING\.delete\(channelId\); refreshSubscribeButton\(\);/,
    "and the button recovers either way");
});

test("the fullscreen ladder gives one video both video panes, then X's space too", () => {
  /* H4's geometry, as the two-stage ladder expresses it:
       stage 1 — the target video takes the other video pane's room; X is untouched.
       stage 2 — the target takes every other row-1 pane, X's space included. */
  const apply = fnFrom(deck, "applyMediaStage", {
    document:{ body:{ classList:{ toggle:() => {} } } },
    measure:() => {}, paintChips:() => {}, postMediaStage:() => {},
  });
  const pane = (key, kind, row) => {
    const classes = new Set();
    return { def:{ key, kind, row },
      node:{ classList:{ toggle:(c, on) => { on ? classes.add(c) : classes.delete(c); }, remove:() => {} } },
      classes };
  };

  for (const [stage, expectation] of [[1, "X survives"], [2, "X's space is used"]]) {
    const panes = [pane("v1", "video", 1), pane("v2", "video", 1), pane("x", "x", 1), pane("c1", "chart", 0)];
    vm.runInNewContext("f()", { f:() => {} });   // no-op; keeps the sandbox honest
    const ctx = { MEDIA_STAGE:stage, MEDIA_TARGET:"v1", PANES:panes,
      document:{ body:{ classList:{ toggle:() => {} } } },
      measure:() => {}, paintChips:() => {}, postMediaStage:() => {} };
    const staged = fnFrom(deck, "applyMediaStage", ctx);
    staged();
    const hidden = panes.filter((p) => p.classes.has("media-hidden")).map((p) => p.def.key);
    if (stage === 1) assert.deepEqual(hidden, ["v2"], expectation);
    else assert.deepEqual(hidden, ["v2", "x"], expectation);
    assert.ok(panes[0].classes.has("media-stage-target"), "the target is marked at both stages");
    assert.ok(!panes[3].classes.has("media-hidden"), "the chart row is never touched by the ladder");
  }
  assert.ok(typeof apply === "function");
  /* And the frames can actually go fullscreen. */
  assert.match(deck, /allowfullscreen/);
  assert.match(deck, /FRAME_ALLOW = "[^"]*fullscreen[^"]*"/);
});

test("a live tick reaches the drawn series, and keeps reaching it", () => {
  /* THE REGRESSION THIS CATCHES. chApplyLivePoint returns a COPY - it must, so that nothing a
     live quote does can reach a cached completed bar. But scChartLive called it and threw the
     return away, so after the change to copying, no realtime tick reached host._series at all:
     futures and crypto panes stopped moving after their first load.

     And the second tick had its own bug. Once a transient point was appended, the same-day
     guard caught every later tick - the day now matched the TRANSIENT point rather than a
     completed bar - so the price froze at whatever the first tick after load happened to be. */
  const CH_RANGE_MS = vm.runInNewContext("(" + /const CH_RANGE_MS = (\{[^}]*\})/.exec(chart)[1] + ")", {});
  /* The fixture's timestamps are historical, so `now` is pinned well past them — the clock
     guard is about ticks in the FUTURE, not about how old the last bar is. */
  const PINNED_NOW = Date.parse("2026-08-20T00:00:00.000Z");
  const FixedDate = new Proxy(Date, { get:(t, k) => (k === "now" ? () => PINNED_NOW : t[k]) });
  const apply = fnFrom(chart, "chApplyLivePoint", {
    window:{ SC_PROVIDER:{ isProviderOwned:() => false } },
    futureSet:new Set(["ESUSD"]), cryptoSet:new Set(["BTCUSD"]),
    quoteInstant:fnFrom(chart, "quoteInstant", { Number, Date }),
    quotePrice:fnFrom(chart, "quotePrice", { Number }),
    CH_RANGE_MS, Array, isFinite, Number, Date:FixedDate,
  });

  const completed = [
    { d:"2026-08-18T20:00:00.000Z", p:100 },
    { d:"2026-08-18T21:00:00.000Z", p:101 },
  ];
  const frozen = JSON.stringify(completed);

  /* First tick, a new day: one transient point is appended and the input is untouched. */
  const first = apply("BTCUSD", completed, { price:60000, updated_ts:"2026-08-19T10:00:00.000Z" });
  assert.equal(JSON.stringify(completed), frozen, "the completed series is never mutated");
  assert.equal(first.length, 3);
  assert.equal(first[2].p, 60000);
  assert.equal(first[2].live, true, "and it is flagged transient, not a bar");

  /* Second tick, same day as the transient point: it REPLACES it, and does not stack. */
  const second = apply("BTCUSD", first, { price:60500, updated_ts:"2026-08-19T10:00:30.000Z" });
  assert.equal(second.length, 3, "the transient point is replaced, never appended twice");
  assert.equal(second[2].p, 60500, "the price actually moves on the second tick");
  assert.equal(second[2].d, "2026-08-19T10:00:30.000Z");
  assert.equal(first[2].p, 60000, "and the previous copy is left alone");

  /* A third tick keeps moving it. */
  const third = apply("BTCUSD", second, { price:61000, updated_ts:"2026-08-19T10:01:00.000Z" });
  assert.equal(third.length, 3);
  assert.equal(third[2].p, 61000);

  /* THE DATE WAS THE WRONG QUESTION. On a 15m or 1h chart the last completed bar and the tick
     routinely share a UTC date, and the old date-only guard refused every intraday tick after
     load — a futures pane sat on its 08:00 bar all session. The rule is the timestamp. */
  for (const [range, bar, tick] of [
    ["15m", "2026-08-19T08:00:00.000Z", "2026-08-19T08:12:00.000Z"],
    ["1h",  "2026-08-19T08:00:00.000Z", "2026-08-19T08:49:00.000Z"],
    ["1D",  "2026-08-18T21:00:00.000Z", "2026-08-19T10:00:00.000Z"],
  ]) {
    const series = [{ d:"2026-08-19T07:00:00.000Z", p:100 }, { d:bar, p:101 }];
    const out = apply("BTCUSD", series, { price:777, updated_ts:tick }, range);
    assert.equal(out.length, 3, `${range}: a tick later than the completed bar is appended`);
    assert.equal(out[1].p, 101, `${range}: the completed bar is untouched`);
    assert.equal(out[2].live, true, `${range}: and the new point is flagged transient`);
  }

  /* A tick NOT later than the last completed bar adds nothing, whatever the date. */
  const stale = apply("BTCUSD", completed, { price:99999, updated_ts:"2026-08-18T20:30:00.000Z" }, "1h");
  assert.equal(stale.length, 2, "a tick behind the completed bar is not a new point");
  assert.equal(stale[1].p, 101, "and the bar still owns its place");

  /* An out-of-order tick must not drag an existing transient point backwards. */
  const withTransient = apply("BTCUSD", completed, { price:60000, updated_ts:"2026-08-19T10:00:00.000Z" }, "1h");
  const backwards = apply("BTCUSD", withTransient, { price:1, updated_ts:"2026-08-19T09:00:00.000Z" }, "1h");
  assert.equal(backwards.length, 3);
  assert.equal(backwards[2].p, 60000, "the newer transient point stands");

  /* A provider-owned equity is never touched at all, on any timeframe. */
  const equityApply = fnFrom(chart, "chApplyLivePoint", {
    window:{ SC_PROVIDER:{ isProviderOwned:(sym) => sym === "AAPL" } },
    futureSet:new Set(), cryptoSet:new Set(),
    quoteInstant:fnFrom(chart, "quoteInstant", { Number, Date }),
    quotePrice:fnFrom(chart, "quotePrice", { Number }),
    CH_RANGE_MS, Array, isFinite, Number, Date:FixedDate,
  });
  const equitySeries = [{ d:"2026-08-19T08:00:00.000Z", p:100 }];
  const equityOut = equityApply("AAPL", equitySeries, { price:999, updated_ts:"2026-08-19T08:49:00.000Z" }, "1h");
  assert.equal(equityOut, equitySeries, "the equity series is returned untouched, not even copied");
  assert.equal(equityOut.length, 1);

  /* And the caller must assign what it gets back. */
  assert.match(chart, /const next = chApplyLivePoint\(t, s, liveQuote\[t\], host\._range \|\| S\.chartRange\);\n\s*host\._series = next;/);
  assert.match(chart, /host\._view = \{ start:Math\.max\(0, next\.length - 1 - span\), end:next\.length - 1 \};/,
    "and the view follows the new length, not the old one");
});

test("the versioned chart shell carries the live-tick fix too", () => {
  assert.equal(read("../station-shells/chart-v1/index.html"), chart);
});

test("a transient point survives an overnight gap, and a future clock does not", () => {
  /* The first sanity bound compared the tick against the LAST BAR, which is wrong: a 1h chart
     legitimately carries a bar many hours old across an overnight or weekend gap, so clamping
     to a few buckets blanked the transient point exactly when the market reopened. The
     implausible case is a tick in the FUTURE. */
  const CH_RANGE_MS = vm.runInNewContext("(" + /const CH_RANGE_MS = (\{[^}]*\})/.exec(chart)[1] + ")", {});
  const PINNED_NOW = Date.parse("2026-08-19T13:00:00.000Z");
  const FixedDate = new Proxy(Date, { get:(t, k) => (k === "now" ? () => PINNED_NOW : t[k]) });
  const apply = fnFrom(chart, "chApplyLivePoint", {
    window:{ SC_PROVIDER:{ isProviderOwned:() => false } },
    futureSet:new Set(["ESUSD"]), cryptoSet:new Set(["BTCUSD"]),
    quoteInstant:fnFrom(chart, "quoteInstant", { Number, Date }),
    quotePrice:fnFrom(chart, "quotePrice", { Number }),
    CH_RANGE_MS, Array, isFinite, Number, Date:FixedDate,
  });

  /* Friday 21:00 close, Monday 12:00 tick, on an hourly chart. */
  const acrossWeekend = [{ d:"2026-08-14T20:00:00.000Z", p:100 }, { d:"2026-08-14T21:00:00.000Z", p:101 }];
  const reopened = apply("ESUSD", acrossWeekend, { price:105, updated_ts:"2026-08-19T12:00:00.000Z" }, "1h");
  assert.equal(reopened.length, 3, "a gap of days does not disqualify a live tick");
  assert.equal(reopened[2].p, 105);
  assert.equal(reopened[1].p, 101, "and the completed bar is untouched");

  /* A tick well ahead of the clock is refused. */
  const future = apply("ESUSD", acrossWeekend, { price:999, updated_ts:"2026-08-20T12:00:00.000Z" }, "1h");
  assert.equal(future.length, 2, "a timestamp in the future is a clock problem, not a price");
  assert.match(chart, /if \(observedAt > Date\.now\(\) \+ bucket\) return out;/);
});
