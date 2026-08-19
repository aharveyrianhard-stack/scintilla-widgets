/* A failed read renders as a failure on every panel that used to flatten it.
   =========================================================================
   catch(() => null) on /ranks, /reflow, /events and /cohorts made a dead read
   indistinguishable from a table with no rows:

   - /ranks rendered a failed board_rsi/composite/ratios/profile read as a whole column of
     per-ticker "no data" — a DATA claim about fifty tickers the read never saw — and, with
     company_profile down, silently kept ETFs in a wall asked to drop them.
   - /reflow drew the same failure as a field of unranked grey.
   - /events declared "nothing scheduled in the next N days" off a dead calendar read.
   - /cohorts' FAV chip lost its count with no sign whether that was labels=0 or a failure.

   The failure is now a kept, named state; every panel says the READ failed, distinctly from
   emptiness, and retries. Browser receipts: browser-proof/proofs/failed-reads.mjs.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import vm from "node:vm";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
function fnFromSource(source, name, bindings = {}) {
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
const ranks = read("../ranks/index.html");
const reflow = read("../reflow/index.html");
const events = read("../events/index.html");
const cohorts = read("../cohorts/index.html");

test("/ranks keeps failures as failures and fails the right column, not the tickers", () => {
  assert.match(ranks, /const READ_FAILED = \{ failed: true \};/);
  assert.ok(!ranks.includes(".catch(() => null)"), "the flattening catch is gone");
  assert.match(ranks, /did not answer — this ranking is unavailable, not empty · retrying/);
  /* Each dependent column names its own source. */
  for (const src of ["ratios_history", "company_profile", "board_rsi", "composite_staged"])
    assert.match(ranks, new RegExp('down: failed\\(\\w+\\) && "' + src + '"'));
  assert.match(ranks, /d\.down \? failedColumn\(d, d\.down\) : column\(d, d\.rows\(\)\)/);
  /* The sector rollup needs company_profile and says so when it is down. */
  assert.match(ranks, /WANT\.indexOf\("sector"\) >= 0 && failed\(cp\)/);
  /* A filter that cannot read is_etf never silently keeps the ETFs. */
  assert.match(ranks, /const etfFilterDown = DROP_ETF && failed\(cp\);/);
  assert.match(ranks, /ETF filter unavailable — company_profile read failed, ETFs are still in the set/);
});

test("/reflow refuses to draw grey non-answers over a failure", () => {
  assert.match(reflow, /const READ_FAILED = \{ failed: true \};/);
  assert.ok(!reflow.includes(".catch(() => null)"));
  assert.match(reflow, /failure\(rank\) \{ return DOWN\[rank\] \|\| null; \}/);
  assert.match(reflow, /if \(DATA\.failure && DATA\.failure\(RANK\)\) \{/);
  assert.match(reflow, /did not answer — this ranking is unavailable, not empty/);
  for (const pair of ['pe: failed(ratios) && "ratios_history"', 'rsi: failed(rsi) && "board_rsi"',
                      'geiger: failed(comp) && "composite_staged"', 'sector: failed(cp) && "company_profile"'])
    assert.ok(reflow.includes(pair), pair);
});

test("/events tells a dead read apart from a clear calendar", () => {
  assert.match(events, /const READ_FAILED = \{ failed: true \};/);
  assert.ok(!events.includes(".catch(() => null)"));
  assert.match(events, /up === READ_FAILED \? '<div class="empty">the earnings read failed — the calendar is unavailable, not clear · retrying<\/div>'/);
  assert.match(events, /res === READ_FAILED \? '<div class="empty">the earnings read failed — results are unavailable, not absent · retrying<\/div>'/);
  /* The honest empty states survive for genuinely empty windows. */
  assert.match(events, /nothing scheduled in the next/);
  assert.match(events, /no reported results in the last/);
});

test("/cohorts names the FAV count failure instead of quietly dropping the number", () => {
  assert.match(cohorts, /favorites count unavailable — the hub_favorites read failed; the chip still navigates/);
  assert.match(cohorts, /' title="' \+ fav\.length \+ ' favorites"'/);
});

/* ---- the template DB readers share /health's 20s ceiling, with timeout words ---- */

test("fundamentals/dcf/allocation readers are bounded and word a timeout as its own kind", () => {
  const fundamentals = read("../templates/fundamentals.html");
  const dcf = read("../templates/dcf.html");
  const allocation = read("../templates/allocation-module.html");

  for (const [name, src] of [["fundamentals", fundamentals], ["dcf", dcf], ["allocation", allocation]]) {
    assert.match(src, /const SB_HARD_MS = 20000;/, name + " carries the ceiling");
    assert.match(src, /signal:\s?controller\?\.signal/, name + " wires the abort signal");
    assert.match(src, /return await r(?:es)?\.json\(\);/, name + " keeps the body read inside the ceiling");
  }
  /* dcf/allocation throw a marked error whose message carries the words. */
  assert.match(dcf, /t\.scTimeout = true;/);
  assert.match(allocation, /t\.scTimeout = true;/);
  assert.match(dcf, /no answer in ' \+ \(SB_HARD_MS\/1000\) \+ 's'/);

  /* fundamentals keeps its error-array convention and marks the timeout kind. */
  assert.match(fundamentals, /empty\._sbError = true; empty\._sbTimeout = true; return empty;/);
  const sbFailWord = fnFromSource(fundamentals, "sbFailWord", { SB_HARD_MS: 20000 });
  assert.equal(sbFailWord({ _sbTimeout: true, _sbError: true }), "no answer in 20s");
  assert.equal(sbFailWord({ _sbError: true, _sbStatus: 503 }), "HTTP 503");
  assert.equal(sbFailWord({ _sbError: true }), "HTTP error");
  /* No banner prints a raw status concatenation any more — a timeout has no status to wear. */
  assert.ok(!fundamentals.includes("'HTTP '+((ev._sbError?ev._sbStatus:tr._sbStatus))"));
  assert.ok(!fundamentals.includes("(HTTP '+TX._sbStatus+')"));
});

test("/pulse keeps a dead read distinct from an empty table, per section", () => {
  const pulse = read("../pulse/index.html");
  assert.match(pulse, /const READ_FAILED = \{ failed: true \};/);
  assert.ok(!pulse.includes(".catch(() => null)"), "the flattening catch is gone");
  for (const dead of ['pg("composite_staged?tf=eq.D&select=composite").catch(() => READ_FAILED)',
                      '&select=ticker,price,chg_pct").catch(() => READ_FAILED)',
                      'order=date.desc&limit=1").catch(() => READ_FAILED)'])
    assert.ok(pulse.includes(dead), dead);
  /* The VIX section receives the markers, not nulls flattened from them. */
  assert.match(pulse, /const vq = quotes === READ_FAILED \? READ_FAILED/);
  assert.match(pulse, /const vterm = term === READ_FAILED \? READ_FAILED/);

  const READ_FAILED = { failed: true };
  const num = (x) => (x == null ? null : Number(x));
  const secGeiger = fnFromSource(pulse, "secGeiger", { READ_FAILED, num });
  assert.match(secGeiger(READ_FAILED), /composite_staged did not answer — unavailable, not empty · retrying/);
  assert.match(secGeiger(READ_FAILED), /class="dead"/, "a failure does not wear the empty style");
  assert.match(secGeiger([]), /no composite_staged rows/, "true emptiness keeps its own words");
  assert.match(secGeiger([{ composite: 0.5 }]), /1↑/, "a healthy read still counts");

  const MACRO_SET = ["SPY","QQQ","IWM","SMH","GLD","TLT","NVDA","COIN"];
  const secMacro = fnFromSource(pulse, "secMacro", { READ_FAILED, num, MACRO_SET });
  assert.match(secMacro(READ_FAILED), /live_quotes did not answer — unavailable, not empty · retrying/);
  assert.match(secMacro([]), /no macro rows in live_quotes/);

  /* VIX: each half fails alone; both dead is one named failure, not "no vix source". */
  assert.match(pulse, /vix_term did not answer · retrying/);
  assert.match(pulse, /live_quotes and vix_term did not answer — unavailable, not empty · retrying/);
  assert.match(pulse, /no vix source/, "the honest empty state survives for readable-but-bare sources");
});

test("/econ, /alerts and /news keep dead reads distinct from empty tables", () => {
  const econ = read("../econ/index.html");
  const alerts = read("../alerts/index.html");
  const news = read("../news/index.html");
  for (const [name, src] of [["econ", econ], ["alerts", alerts]]) {
    assert.match(src, /const READ_FAILED = \{ failed: true \};/, name);
    assert.ok(!src.includes(".catch(() => null)"), name + ": the flattening catch is gone");
  }
  /* A dead read names its source; the honest empty wordings survive beside it. */
  assert.match(econ, /the econ_dashboard read failed — the tiles are unavailable, not empty · retrying at the next refresh/);
  assert.match(econ, /the econ_calendar read failed — the calendar is unavailable, not clear · retrying at the next refresh/);
  assert.match(econ, /econ_dashboard has no rows/);
  assert.match(econ, /no calendar rows for this filter/);
  assert.match(alerts, /the feed_alerts read failed — feed health is unavailable, not quiet · retrying at the next refresh/);
  assert.match(alerts, /the alert_log read failed — ticker alerts are unavailable, not quiet · retrying at the next refresh/);
  assert.match(alerts, /no feed_alerts rows/);
  assert.match(alerts, /no alert_log rows/);
  /* The sentiment chip names its failure instead of vanishing like a ticker with no row. */
  assert.match(news, /const SENT_FAILED = \{ failed: true \};/);
  assert.ok(!news.includes(".catch(() => null)"), "news: the flattening catch is gone");
  assert.match(news, /sentiment read failed — unavailable, not neutral · retrying/);
  /* youtube's ytAct catch-null is a WRITE lane (star/unstar) — a silently lost shared
     write, recorded as its own audit finding; fixing it must respect the shell mirrors. */
});

test("/youtube: a lost watch-later write reverts the star and says why", async () => {
  /* WRITE-lane sibling of the read-lane rules above: ytAct's failure used to be swallowed
     whole — the star stayed painted "saved", the shared table never changed, and the lie
     stood until the next reconcile read. */
  const yt = read("../youtube/index.html");
  /* Success is only a landed write: non-2xx and error bodies resolve null. */
  assert.match(yt, /r\.ok && !\(d && d\.error\) \? d : null/);
  /* Both callers repaint from the settle, not only from the optimistic return. */
  assert.match(yt, /ytWLToggle\(r\.video_id, \(saved\) => \{ r\.watch_later = saved; renderYT\(\); \}\)/);
  assert.match(yt, /if \(YT_CUR === cur\) el\("ytpStar"\)\.classList\.toggle\("is-on", saved\);/);

  const YT_WATCH_LATER = new Set();
  const flashes = [], settles = [];
  let fail = true;
  const ytWLToggle = fnFromSource(yt, "ytWLToggle", {
    YT_WATCH_LATER,
    ytAct: () => Promise.resolve(fail ? null : { ok: true }),
    ytFlash: (t, ms) => flashes.push([t, ms]),
  });
  const settle = () => new Promise((r) => setImmediate(r));

  assert.equal(ytWLToggle("vid1", (saved) => settles.push(saved)), true, "the optimistic return is ON");
  assert.ok(YT_WATCH_LATER.has("vid1"), "optimistically saved");
  await settle();
  assert.ok(!YT_WATCH_LATER.has("vid1"), "the lost write reverted the flip");
  assert.deepEqual(settles, [false], "the caller was told the truth");
  assert.equal(flashes.length, 1);
  assert.match(flashes[0][0], /★ not saved — the shared watch-later write failed · try again/);
  assert.equal(flashes[0][1], 2600, "a failure lingers long enough to read");

  fail = false;
  ytWLToggle("vid2", (saved) => settles.push(saved));
  await settle();
  assert.ok(YT_WATCH_LATER.has("vid2"), "a landed write stays");
  assert.deepEqual(settles, [false], "no settle call on success — nothing to correct");
  assert.equal(flashes.length, 1, "no failure flash on success");

  fail = true;
  ytWLToggle("vid2", (saved) => settles.push(saved));
  assert.ok(!YT_WATCH_LATER.has("vid2"), "optimistically removed");
  await settle();
  assert.ok(YT_WATCH_LATER.has("vid2"), "the lost removal reverted too");
  assert.match(flashes[1][0], /★ not removed — the shared watch-later write failed/);
});

test("main reads on /news and /cohorts: never-loaded names the failure; loaded keeps knowledge and wears STALE", () => {
  const news = read("../news/index.html");
  const cohorts = read("../cohorts/index.html");
  /* /news: the boot catch painted an unworded "news unavailable" and the interval catch was
     silent — a wire that died after a healthy load kept a frozen "newest Xm ago" stamp that
     became false as time passed. */
  assert.match(news, /const MAIN_FAILED = \{ failed: true \};/);
  assert.match(news, /pg\(q\)\.catch\(\(\) => MAIN_FAILED\)/);
  assert.match(news, /the news read failed — the wire is unavailable, not empty · retrying at the next refresh/);
  assert.match(news, /REFRESH FAILED<\/span> showing the read from/);
  assert.match(news, /the news read is failing, the list below is stale · retrying/);
  assert.ok(!news.includes(">news unavailable<"), "the unworded boot state is gone");
  /* /cohorts: same shape on the strip's two main reads. */
  assert.match(cohorts, /const READ_FAILED = \{ failed: true \};/);
  assert.match(cohorts, /SC_COHORT_AXIS\.loadMemberships\(pg\)\.catch\(\(\) => READ_FAILED\)/);
  assert.match(cohorts, /read failed — the strip is unavailable, not empty · retrying at the next refresh/);
  assert.ok(cohorts.includes("these chips are stale · retrying"));
  assert.ok(!cohorts.includes("cohort data unavailable</span>"), "the unworded boot state is gone");
  /* The outer catches remain as render-bug last resorts and say so. */
  assert.match(news, /this is a page bug, not a data gap/);
  assert.match(cohorts, /this is a page bug, not a data gap/);
});

test("/youtube: the saved-set read failing (or not yet landed) never zeroes the stars", () => {
  const yt = read("../youtube/index.html");
  /* The feed rows arrive with a server-side watch_later flag — landed data. The page cache
     is seeded from it, so the boot overwrite is a no-op until the AUTHORITATIVE read
     replaces it; before this, boot cleared every saved star until (unless) the second read
     landed, and that read's failure was an unhandled rejection that left the lie standing. */
  assert.match(yt, /let YT_WL_READY = false, YT_WL_READ_FAILED = false;/);
  assert.match(yt, /rows\.length && !YT_WL_READY\) rows\.forEach\(\(r\) => \{ if \(r && r\.watch_later && r\.video_id\) YT_WATCH_LATER\.add\(r\.video_id\); \}\);/);
  assert.match(yt, /YT_WL_READY = true; YT_WL_READ_FAILED = false;/);
  /* The failure is a SAID state — flash plus a persistent marker on the Watch Later chip. */
  assert.match(yt, /YT_WL_READ_FAILED = true;/);
  assert.match(yt, /the watch-later read failed — ★ rides the feed snapshot, not the saved list/);
  assert.match(yt, /class="wlbad" title="the saved-list read failed — ★ rides the feed snapshot, not the saved list · retried with the feed pass"/);
});

test("the mounted video shells and /pane-video: saved-or-not is only claimed from a LANDED read, and every lost write says why", async () => {
  const pane = read("../pane-video/index.html");
  const shellP = read("../station-shells/personal-video-v1/index.html");
  const shellS = read("../station-shells/scintilla-video-v1/index.html");
  /* The deck mounts both shells: one reviewed surface in two independently rollable
     copies, which must stay byte-identical until deliberately diverged. */
  assert.equal(shellP, shellS, "personal-video-v1 and scintilla-video-v1 are byte-identical");

  for (const [name, src] of [["pane-video", pane], ["shell", shellP]]) {
    /* starHTML: unknown is a said state, never painted as "unsaved". */
    const mk = (bind) => fnFromSource(src, "starHTML", Object.assign({ esc: (s) => String(s) }, bind));
    const v = { video_id: "vidX" };
    assert.equal(mk({ FEED: "personal" })(v), "", name + ": no star lane outside the scintilla feed");
    const unknownFailed = mk({ FEED: "scintilla", WATCH_READY: false, WATCH_ERROR: "x", WATCH: new Set() })(v);
    assert.match(unknownFailed, /star unk/, name);
    assert.match(unknownFailed, /watch-later state unknown — the saved-list read failed · a click retries the read/, name);
    assert.ok(!unknownFailed.includes("☆") && !unknownFailed.includes("★"), name + ": the unknown state paints neither claim glyph");
    assert.match(mk({ FEED: "scintilla", WATCH_READY: false, WATCH_ERROR: "", WATCH: new Set() })(v), /has not landed yet/, name);
    const savedHtml = mk({ FEED: "scintilla", WATCH_READY: true, WATCH: new Set(["vidX"]) })(v);
    assert.match(savedHtml, /★/, name); assert.match(savedHtml, /remove from/, name);
    const unsavedHtml = mk({ FEED: "scintilla", WATCH_READY: true, WATCH: new Set() })(v);
    assert.match(unsavedHtml, /☆/, name); assert.match(unsavedHtml, /save to/, name);

    /* The old cause-naming lie is gone: a failed Supabase table read is not a YouTube
       auth state, and it may not paint as one. */
    assert.ok(!src.includes("YouTube reconnect required"), name + ": the mislabeled cause is gone");
    assert.match(src, /the watch-later read failed — the saved list is unavailable, not empty · retrying at the next refresh/, name);
    assert.match(src, /WATCH_ERROR = WATCH_ERROR \|\| "the saved-list read failed"/, name + ": the boot failure names itself");
    assert.match(src, /wlFlash\(\(will \? "★ not saved" : "★ not removed"\) \+ " — the shared watch-later write failed · try again"\);/, name);
    assert.match(src, /wlFlash\("subscribe failed — the shared write did not land · try again"\)/, name);
    assert.match(src, /<div id="wlFlash" role="status" aria-live="polite"><\/div>/, name + ": the flash element exists");
  }

  /* video-v1 is the retained rollback: exempt by the same ruling as sector-rotation-older,
     untouched wording and all — so a rollback is still a pointer change, not a rebuild. */
  const rollback = read("../station-shells/video-v1/index.html");
  assert.ok(rollback.includes("YouTube reconnect required"), "the rollback copy is exempt and untouched");

  /* toggleWatch (shell variant, async): an unknown state REFUSES the flip — it retries the
     read instead, and only a KNOWN state toggles. */
  const asyncFnFrom = (source, name, bindings) => {
    const sig = "async function " + name + "(";
    const start = source.indexOf(sig);
    assert.notEqual(start, -1, name + " must exist as async");
    let depth = 0, end = -1;
    for (let i = source.indexOf("{", start); i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      if (source[i] === "}") depth -= 1;
      if (depth === 0) { end = i + 1; break; }
    }
    return vm.runInNewContext("(" + source.slice(start, end) + ")", bindings);
  };
  const shell = shellP;
  const v = { video_id: "vidZ" };

  { /* read still dead: no flip, no write, the refusal is said */
    const WATCH = new Set(); const flashes = []; let acted = 0;
    const fn = asyncFnFrom(shell, "toggleWatch", { WATCH, WATCH_READY: false, WATCH_ERROR: "",
      syncWatch: async () => { throw new Error("pg 503"); },
      ytAct: async () => { acted += 1; return {}; },
      wlFlash: (t) => flashes.push(t), paint: () => {}, refreshWatchButton: () => {}, YOUTUBE_ACCOUNT: "personal" });
    await fn(v);
    assert.equal(acted, 0, "no write against an unknown state");
    assert.equal(WATCH.size, 0, "no flip against an unknown state");
    assert.match(flashes[0], /★ unavailable — the saved-list read failed · nothing was changed/);
  }
  { /* read recovers on the click: still no auto-toggle — the truth paints first */
    const WATCH = new Set(); const flashes = []; let acted = 0;
    const fn = asyncFnFrom(shell, "toggleWatch", { WATCH, WATCH_READY: false, WATCH_ERROR: "",
      syncWatch: async () => WATCH, ytAct: async () => { acted += 1; return {}; },
      wlFlash: (t) => flashes.push(t), paint: () => {}, refreshWatchButton: () => {}, YOUTUBE_ACCOUNT: "personal" });
    await fn(v);
    assert.equal(acted, 0, "recovery paints the truth; it does not act on the stale gesture");
    assert.match(flashes[0], /saved list recovered — ★ shows the true state now · click again to change it/);
  }
  { /* known state, lost write: flip, revert, and the reason is said */
    const WATCH = new Set(); const flashes = []; const paints = [];
    const fn = asyncFnFrom(shell, "toggleWatch", { WATCH, WATCH_READY: true, WATCH_ERROR: "",
      syncWatch: async () => WATCH, ytAct: async () => { paints.push("acting:" + WATCH.has("vidZ")); throw new Error("yt-act 500"); },
      wlFlash: (t) => flashes.push(t), paint: () => {}, refreshWatchButton: () => {}, YOUTUBE_ACCOUNT: "personal" });
    await fn(v);
    assert.deepEqual(paints, ["acting:true"], "the flip was optimistic");
    assert.ok(!WATCH.has("vidZ"), "the lost write reverted the flip");
    assert.match(flashes[0], /★ not saved — the shared watch-later write failed · try again/);
  }
  { /* known state, landed write: the flip stays and nothing flashes */
    const WATCH = new Set(); const flashes = [];
    const fn = asyncFnFrom(shell, "toggleWatch", { WATCH, WATCH_READY: true, WATCH_ERROR: "",
      syncWatch: async () => WATCH, ytAct: async () => ({}),
      wlFlash: (t) => flashes.push(t), paint: () => {}, refreshWatchButton: () => {}, YOUTUBE_ACCOUNT: "personal" });
    await fn(v);
    assert.ok(WATCH.has("vidZ"), "a landed save stays");
    assert.deepEqual(flashes, [], "no flash on success");
  }

  /* refreshWatchButton: the button may not claim "save to watch later" while nothing is known. */
  const btnCase = (bind) => {
    const b = { textContent: "", disabled: false, title: "", cls: new Set(),
      classList: { toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, remove(c) { this._s.delete(c); }, _s: new Set() },
      setAttribute() {} };
    const fn = fnFromSource(shellP, "refreshWatchButton", Object.assign({ el: () => b, CUR: { video_id: "vidZ" } }, bind));
    fn(); return b;
  };
  assert.equal(btnCase({ WATCH_READY: false, WATCH_ERROR: "x", WATCH: new Set() }).textContent, "watch later — state unknown");
  assert.match(btnCase({ WATCH_READY: false, WATCH_ERROR: "x", WATCH: new Set() }).title, /saved-or-not is unknown, not “unsaved”/);
  assert.equal(btnCase({ WATCH_READY: false, WATCH_ERROR: "", WATCH: new Set() }).textContent, "watch later…");
  assert.equal(btnCase({ WATCH_READY: true, WATCH_ERROR: "", WATCH: new Set(["vidZ"]) }).textContent, "remove from watch later");
  assert.equal(btnCase({ WATCH_READY: true, WATCH_ERROR: "", WATCH: new Set() }).textContent, "save to watch later");
});

test("/youtube: a failed feed read never claims the owner's empty table", () => {
  const yt = read("../youtube/index.html");
  /* "The table is empty; the ingester will fill it" is the OWNER's absence — it was painted
     for ANY failure of the feed read, blaming an ingester nobody measured (rule 1 + rule 2). */
  assert.match(yt, /let YT_LOADED = false, YT_FETCHED_AT = 0, YT_MAIN_FAILED = false;/);
  assert.match(yt, /\.catch\(\(\) => \{ YT_LOADED = true; YT_MAIN_FAILED = true; renderYT\(\); \}\);/,
    "the feed catch names itself a failure");
  assert.match(yt, /YT_FETCHED_AT = Date\.now\(\); YT_MAIN_FAILED = false;/,
    "a landed read clears the flag — landed, not merely attempted");
  assert.match(yt, /grid\.innerHTML = YT_MAIN_FAILED/,
    "the empty-grid sentence is chosen by the flag, not one sentence for two states");
  assert.match(yt, /read failed<\/b> — the wire is unavailable, not empty · retrying at the next pass/);
  assert.match(yt, /awaiting feed<\/b> — the youtube_feed table is empty; cards fill per video when the ingester lands/,
    "the owner's-absence wording survives for the read that LANDED empty");
});

test("an unknown day change gets neither a sign nor a direction colour — `null >= 0` is true in JavaScript", () => {
  /* The trap this whole test exists for: a relational comparison coerces null to 0, so
     `value >= 0` is TRUE for a value nobody sent. Every unguarded directional ternary
     therefore painted UNKNOWN as UP — a systematic bullish tint on missing data — and some
     printed a "+" sign and a fabricated 0.00 beside it. */
  assert.equal(null >= 0, true, "the coercion this guards against");

  const ticker = read("../ticker/index.html");
  /* /ticker fabricated the value itself: `|| 0` turned an unknown change into a reported
     flat day, which then also entered the movers ranking as the least-moving symbol. */
  assert.doesNotMatch(ticker, /num\(q\.change\)\) \|\| 0/, "the fabricated zero is gone");
  assert.match(ticker, /pct: num\(q\.chg_pct\) != null \? num\(q\.chg_pct\) : num\(q\.change\) \}\)\);/);
  assert.match(ticker, /const known = all\.filter\(\(q\) => q\.pct != null && isFinite\(q\.pct\)\);/);
  assert.match(ticker, /\.concat\(unknown\);/, "unknowns are kept and ranked last, never dropped");
  assert.match(ticker, /\.sc-tape__item \.neu\{ color:var\(--dim\); \}/);

  /* fmtC is an arrow const, not a `function` — extract the declaration itself and run it. */
  const decl = ticker.match(/const fmtC\s*=\s*\(c\) =>[\s\S]*?%\)"\);/);
  assert.ok(decl, "the fmtC declaration is found");
  const fmtC = vm.runInNewContext(decl[0] + " fmtC", { isFinite, Math });
  assert.equal(fmtC(null), "—", "no sign and no size for an unknown change");
  assert.equal(fmtC(undefined), "—");
  assert.equal(fmtC(NaN), "—");
  assert.equal(fmtC(0), "+0.00%", "a REPORTED flat day still reads as flat — that claim is true");
  assert.equal(fmtC(1.5), "+1.50%");
  assert.equal(fmtC(-1.5), "(1.50%)");

  /* The tone beside it must refuse on exactly the same input the text refuses on. */
  const tone = (pct) => (pct == null || !isFinite(pct) ? "neu" : pct >= 0 ? "up" : "dn");
  assert.match(ticker, /it\.pct == null \|\| !isFinite\(it\.pct\) \? "neu" : it\.pct >= 0 \? "up" : "dn"/);
  assert.equal(tone(null), "neu"); assert.equal(tone(0), "up"); assert.equal(tone(-1), "dn");

  /* The two template surfaces carried the same shape: honest "—" text, confident colour. */
  const alloc = read("../templates/allocation-module.html");
  assert.match(alloc, /style="color:\$\{r\.day==null\?'var\(--dim\)':r\.day>=0\?'var\(--green\)':'var\(--red\)'\}"/,
    "allocation: an unknown day is dim, not green");
  const sector = read("../templates/sector-rotation.html");
  assert.match(sector, /color:\$\{lq\.chg_pct==null\?'var\(--dim\)':lq\.chg_pct>=0\?'var\(--green\)':'var\(--red\)'\}/,
    "sector rotation: an unknown change is dim, not green");
  assert.match(sector, /\$\{lq\.chg_pct==null\?'change unknown'/,
    "…and it says so instead of printing a signed em-dash percentage");
  assert.doesNotMatch(sector, /\$\{lq\.chg_pct>=0\?'\+':''\}\$\{lq\.chg_pct!=null/,
    "the '+—%' construction is gone");
});
