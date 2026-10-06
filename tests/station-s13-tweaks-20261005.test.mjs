/* S13 (5 Oct 2026, ~12:30 ET): the tweaks Alan named after seeing S12 live — pinned.
   1. The YouTube bar, re-ordered by use and in icons: NEXT · GRID · + WATCH LATER · ↻ on the bar (PREVIOUS and the
      place in the queue join them while a video plays), ⛶ and one ⋯ at the right; the channel switch and the filters
      behind the ⋯. NEXT works from the grid, GRID from the player and the theatre, + WATCH LATER on the playing
      video (so on the NEXT one) and on the thumbnail under the pointer.
   2. The X pane refreshes by itself on a cadence — 30 / 60 / 90 s, 60 by default — as "a page up": the newest posts
      to the top, never a blank; the rules it lives with (hover hold, the ⋯ panel, a hidden pane, two mirrors, the
      iPad) are decided in one function and tested together here. Icons on the X bar too.
   3. The bridge that does it is 0.7.23 and the health page expects it (0.7.24 since ST3, 6 Oct). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const shell = read("../station-shells/personal-video-v1/index.html"), twin = read("../station-shells/scintilla-video-v1/index.html");
const xshell = read("../station-shells/x-v2/index.html"), bridge = read("../station-x-bridge-draft/content.js");
const bar = shell.slice(shell.indexOf('<div id="bar">'), shell.indexOf('<div id="more"'));
const panel = shell.slice(shell.indexOf('<div id="more"'), shell.indexOf('<div id="grid">'));
const lift = (src, name) => { const m = src.match(new RegExp("\\n( *)(?:async )?function " + name + "\\(.*\\) \\{[\\s\\S]*?\\n\\1\\}")); assert.ok(m, "found " + name); return m[0]; };

test("S13 · the YouTube bar, by use: NEXT · GRID · + WATCH LATER · ↻ first, ⛶ and one ⋯ last; the channel and the filters behind the ⋯", () => {
  assert.equal(shell, twin, "personal-video-v1 and scintilla-video-v1 stay byte-identical");
  const order = ["bNext", "bBack", "bWatchBar", "bRefresh", "bPrev", "nowq", "bContinue", "bPipBar", "bFull", "bMenu"].map((id) => bar.indexOf('id="' + id + '"'));
  assert.ok(order.every((at) => at > 0), "every control is on the bar");
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "in the order of use");
  assert.doesNotMatch(bar, /id="feedProfile"|id="chips"|id="bFilters"/, "the channel switch and the filters are not on the bar");
  assert.match(panel, /<span class="lab">channel<\/span><select id="feedProfile"/, "the channel switch is behind the ⋯");
  assert.match(panel, /id="filters" role="group" aria-label="grid filters"><span class="lab">show<\/span><span id="chips"><\/span>/, "and so are the filters");
  assert.equal((bar.match(/aria-controls="more"/g) || []).length, 1, "one ⋯, not two");
});

test("S13 · icons, each with a one-line tooltip; words only where an icon would be a guess", () => {
  for (const id of ["bNext", "bBack", "bWatchBar", "bRefresh", "bPrev", "bPipBar", "bMenu"]) {
    const tag = bar.match(new RegExp("<button[^>]*id=\"" + id + "\"[^>]*>([\\s\\S]*?)</button>"));
    assert.ok(tag, id + " is a button on the bar");
    assert.match(tag[0], /title="[^"\n]{8,}"/, id + " has a one-line tooltip");
    assert.match(tag[0], /aria-label="[^"]+"/, id + " is named for a screen reader");
    assert.match(tag[1], /^<svg (class="add" )?viewBox="0 0 16 16" aria-hidden="true">/, id + " is an icon");
    assert.equal(tag[1].replace(/<svg[\s\S]*?<\/svg>/g, "").trim(), "", id + " carries no words");
  }
  assert.match(bar, /id="bContinue" type="button">tap to continue<\/button>/, "TAP TO CONTINUE stays in words: no icon says it");
  const css = shell.slice(shell.indexOf("S13 (5 Oct 2026, ~12:30 ET): THE BAR"), shell.indexOf("</style>"));
  assert.doesNotMatch(css, /#fff\b|#ffffff|\bwhite(?!-space)|rgb\(255/i, "no white added");
  assert.match(css, /#bNext, #bPrev, #bBack, #bWatchBar, #bRefresh, #bPipBar, #bMenu\{ width:26px; height:20px;/, "one size for every icon");
});

test("S13 · NEXT from the grid, GRID from anywhere, + WATCH LATER on what is playing or pointed at", () => {
  /* NEXT on the grid: after the last video watched, else the first */
  const UNAVAILABLE_VIDEO_IDS = new Set(["dead"]);
  const api = vm.runInNewContext("let LAST_PLAYED = '';" + lift(shell, "queuedVideo") + lift(shell, "nextQueuedVideo") + lift(shell, "gridNextVideo") +
    "({ next: (rows, last) => { LAST_PLAYED = last; return gridNextVideo(rows); } })", { UNAVAILABLE_VIDEO_IDS, Set });
  const rows = ["dead", "a", "b", "c"].map((video_id) => ({ video_id }));
  assert.equal(api.next(rows, "").video_id, "a", "nothing watched yet: the first video that can play");
  assert.equal(api.next(rows, "a").video_id, "b", "back from a video: the one after it");
  assert.equal(api.next(rows, "c").video_id, "a", "after the last: round to the first");
  assert.equal(api.next([], ""), null, "an empty list has no next");
  assert.match(shell, /if \(!CUR\) el\("bNext"\)\.disabled = !gridNextVideo\(rows\);/, "NEXT is live on the grid");
  assert.match(shell, /if \(!fromGrid \|\| CUR\) return;\n  const v = gridNextVideo\(\); if \(v\) playFromUserGesture\(v\);/, "and starts the queue inside the same tap");
  assert.match(shell, /if \(CUR\) LAST_PLAYED = CUR\.video_id;\n  CUR = null;/, "going back remembers where the queue was");
  /* GRID */
  const go = lift(shell, "goGrid");
  assert.match(go, /if \(DECK_STAGE > 0\) parent\.postMessage\(\{ type: "SCINTILLA_DECK_MEDIA_BACK" \}, location\.origin\);/, "from the theatre the pane comes home first");
  assert.match(go, /if \(CUR\) back\(\); else el\("grid"\)\.scrollTop = 0;/, "from the player: the thumbnails; on the grid: its top");
  assert.match(shell, /el\("bBack"\)\.addEventListener\("click", goGrid\);/);
  assert.doesNotMatch(shell, /el\("bBack"\)\.style\.display/, "GRID is never hidden");
  /* + WATCH LATER */
  assert.match(shell, /function watchTarget\(\) \{ return CUR \|\| BYID\[SEL\] \|\| null; \}/, "the playing video first — so it follows NEXT — else the thumbnail under the pointer");
  assert.match(shell, /await toggleWatch\(v\);/, "the same shared write as the star on a card");
  assert.match(shell, /if \(known && WATCH_READY && WATCH\.has\(v\.video_id\) !== was\)/, "it says so only when the write landed");
  assert.match(shell, /b\.classList\.toggle\("unk", !WATCH_READY\);/, "saved-or-not is never claimed before the saved list is read");
  assert.match(shell, /if \(event\.pointerType && event\.pointerType !== "mouse"\) return;/, "a touch plays the card; only a mouse points");
});

test("S13 · the X cadence: 30 / 60 / 90 s, 60 by default, and the rules the timer lives with — together", () => {
  const api = vm.runInNewContext(xshell.match(/const X_REFRESH_CHOICES = [^\n]*\n/)[0] + lift(xshell, "xRefreshChoice") + lift(xshell, "xRefreshPlan") +
    "({ X_REFRESH_CHOICES, X_REFRESH_DEFAULT, xRefreshChoice, xRefreshPlan })", { Number });
  assert.deepEqual([...api.X_REFRESH_CHOICES], [30, 60, 90]);
  assert.equal(api.X_REFRESH_DEFAULT, 60);
  for (const [saved, want] of [[null, 60], ["", 60], ["45", 60], ["30", 30], ["90", 90], [60, 60]]) assert.equal(api.xRefreshChoice(saved), want, "a saved " + JSON.stringify(saved));
  const due = { live: true, remote: false, visible: true, owner: true, now: 100000, lastAt: 40000, seconds: 60, hover: false, panel: false };
  const plan = (patch) => api.xRefreshPlan(Object.assign({}, due, patch));
  assert.equal(plan({}).fire, true, "60 s after the last refresh it asks for a page up");
  assert.equal(plan({ lastAt: 40001 }).fire, false, "not a second early");
  assert.equal(plan({ seconds: 90 }).fire, false, "90 s means 90 s");
  assert.equal(plan({ seconds: 30, lastAt: 70000 }).fire, true, "30 s means 30 s");
  assert.deepEqual([plan({ hover: true }).fire, plan({ hover: true }).wait], [false, true], "the pointer on the feed: it waits, it is not dropped");
  assert.deepEqual([plan({ panel: true }).fire, plan({ panel: true }).wait], [false, true], "the ⋯ panel open: it waits");
  assert.equal(plan({ visible: false }).fire, false, "a hidden pane asks for nothing");
  assert.equal(plan({ owner: false }).fire, false, "a second mirror does not ask: one source, one refresh");
  assert.equal(plan({ remote: true }).fire, false, "the iPad never asks");
  assert.equal(plan({ live: false }).fire, false, "no source, no refresh");
  /* every rule at once: the most cautious wins */
  assert.equal(plan({ hover: true, panel: true, owner: false, visible: false }).fire, false);
  assert.match(xshell, /postXFloat\("refresh", \{ pageUp:true, every:xRefreshSeconds \}\);/, "the ask is a page up");
  assert.match(xshell, /el\("bXRefresh"\)\.addEventListener\("click", \(\) => postXFloat\("refresh"\)\);/, "↻ by hand is unchanged");
  assert.match(xshell, /for \(const id of \["bXRefresh", "bXList", "bXNotify"\]\) el\(id\)\.addEventListener\("click", \(\) => \{ xRefreshAt = Date\.now\(\);/, "a refresh by hand or a change of view starts the count again");
  assert.match(xshell, /if \(on\) \{ xRefreshAt = Date\.now\(\); paintXRefresh\(\); \}/, "the first page-up is one cadence after the feed attaches");
  for (const s of [30, 60, 90]) assert.match(xshell, new RegExp('<button class="btn xr" type="button" data-s="' + s + '" title="refresh every ' + s + ' seconds">' + s + "s</button>"));
});

test("S13 · the X pane keeps its last picture while the page turns, and the X bar is icons", () => {
  const src = "const X_PAGEUP_HOLD_MS = 1500, X_PAGEUP_HOLD_MAX_MS = 5000; let xHoldStart = 0, xHoldUntil = 0, xHoldSeq = -1, xfloatCrop = null;" +
    lift(xshell, "holdXPicture") + lift(xshell, "noteXPageUp") + "({ hold: holdXPicture, note: noteXPageUp, until: () => xHoldUntil, crop: (c) => { xfloatCrop = c; } })";
  const api = vm.runInNewContext(src, { Number, Math, Date });
  api.crop({ pageUp: { seq: 4, busy: false } }); api.hold(1000);
  assert.equal(api.until(), 2500, "the picture is held from the moment the page-up is asked");
  api.note({ seq: 5, busy: true }, 2000); assert.equal(api.until(), 3000, "and stays held while the source is busy");
  api.note({ seq: 5, busy: true }, 5900); assert.equal(api.until(), 6000, "but never longer than 5 s");
  api.crop({ pageUp: { seq: 5, busy: false } }); api.hold(1000); api.note({ seq: 5, busy: false }, 1400); assert.equal(api.until(), 2500, "the last page-up's sequence does not let go of this one");
  api.note({ seq: 6, busy: false }, 1400); assert.equal(api.until(), 1700, "it lets go just after the page lands");
  api.hold(1000); api.note(undefined, 1200); assert.equal(api.until(), 2500, "an older bridge says nothing: the hold simply runs out");
  assert.match(lift(xshell, "drawXFloat"), /if \(xHoldUntil\) \{\n    if \(Date\.now\(\) < xHoldUntil\) \{ xfloatFrame = requestAnimationFrame\(drawXFloat\); return; \}\n    xHoldUntil = 0;\n  \}/);
  /* icons */
  const xbar = xshell.slice(xshell.indexOf('<div id="bar">'), xshell.indexOf('<div id="body">'));
  for (const id of ["bXList", "bXNotify", "bXRefresh"]) assert.match(xbar, new RegExp('<button class="btn icon" id="' + id + '"[^>]*title="[^"]+"[^>]*aria-label="[^"]+">\\s*<svg'), id + " is an icon with a tooltip");
  assert.doesNotMatch(xbar, />refresh</, "the word is gone from the bar");
  assert.doesNotMatch(xbar, /id="bXBack"|id="bPair"|id="bPip"|id="xfSource"/, "the secondary controls left the bar");
  assert.match(xshell, /<div id="xMore" role="group" aria-label="more X controls">[\s\S]*?id="bXBack"[\s\S]*?id="bPair"[\s\S]*?id="bPip"[\s\S]*?id="xfSource"[\s\S]*?<\/div>/, "they are in the ⋯ panel");
  assert.match(xshell, /body:not\(\.x-more\) #xMore\{ display:none; \}/);
});

test("S13 · the bridge's page-up: X's own refresh, then the top — refused under a hand, dropped from a second mirror, never left on a blank", () => {
  const api = vm.runInNewContext("const PAGE_UP_MIN_GAP_MS = 20000;" + lift(bridge, "pageUpPlan") + lift(bridge, "pageUpOutcome") + "({ pageUpPlan, pageUpOutcome })", {});
  const ok = { stationMode: true, busy: false, switchingView: false, paused: false, now: 100000, lastAt: 0 };
  const plan = (patch) => api.pageUpPlan(Object.assign({}, ok, patch)).run;
  assert.equal(plan({}), true);
  assert.equal(plan({ paused: true }), false, "the hover hold: nothing moves under his hand");
  assert.equal(plan({ busy: true }), false, "one page-up at a time");
  assert.equal(plan({ switchingView: true }), false, "never across a change of view");
  assert.equal(plan({ lastAt: 85000 }), false, "a second mirror's ask inside 20 s is dropped");
  assert.equal(plan({ lastAt: 80000 }), true);
  assert.equal(plan({ stationMode: false }), false);
  const out = (before, after) => JSON.parse(JSON.stringify(api.pageUpOutcome(before, after)));
  assert.deepEqual(out({ readingKey: "/a/status/3" }, { painted: true, keys: ["/a/status/5", "/a/status/4", "/a/status/3"] }),
    { result: "top", readingOnScreen: true, newPosts: 2 }, "two new posts on top, the one he was reading still on the screen under them");
  assert.deepEqual(out({ readingKey: "/a/status/3" }, { painted: true, keys: ["/a/status/9", "/a/status/8"] }),
    { result: "top", readingOnScreen: false, newPosts: null }, "more than a screenful arrived: the newest are on top, his post has gone below");
  assert.deepEqual(out({ readingKey: "/a/status/3" }, { painted: false, keys: [] }),
    { result: "kept", readingOnScreen: null, newPosts: null }, "nothing painted: the page went back to where it was");
  const fn = lift(bridge, "pageUpRefresh");
  assert.match(fn, /await activateView\(session\.activeView, \{ refresh: true, align: false \}\);\n\s+root\.scrollTo\(\{ top: 0, behavior: "auto" \}\);/, "X's own refresh, then the page's own scroll to the top");
  assert.match(fn, /const painted = await waitFor\(\(\) => visibleFeedPosts\(\)\.length > 0, PAGE_UP_PAINT_WAIT_MS\);/, "it waits for posts to be painted");
  assert.match(fn, /\} else \{\n\s+root\.scrollTo\(\{ top: before\.scrollTop, behavior: "auto" \}\);/, "and goes back if none are");
  assert.match(fn, /finally \{\n\s+resetStationScrollComposite\(\);/, "the slow scroll's phase is reset, as on every other jump");
  assert.match(bridge, /if \(value && value\.pageUp\) await pageUpRefresh\(\);\n\s+else await refreshCurrentView\(\);/, "↻ by hand keeps the old path");
  assert.match(bridge, /pageUp: \{ \.\.\.session\.pageUp \},/, "the pane is told how the page-up went");
  assert.match(read("../station-x-bridge-draft/manifest.json"), /"version": "0\.7\.24"/);
  assert.match(read("../x-health/index.html"), /const TARGET = "0\.7\.24";/, "the health page expects the bridge that pages up");
});

test("S13 · measured on the real deck at 403 / 461 / 614: both bars one line, nothing cut; the + follows NEXT; the clock waits under a hand; the picture never blanks", () => {
  const m = JSON.parse(read("../deliverables/20261005/station-controls/harness/s13.json"));
  for (const [k, col] of [["1680x1050", 403], ["1920x1080", 461], ["2560x1440", 614]]) {
    const r = m[k]; assert.ok(r, k + " was measured"); assert.equal(r.rest.column.w, col);
    const y = r.youtube, x = r.x;
    for (const [name, bar] of [["grid", y.grid], ["playing", y.playing], ["scintilla", r.scintilla], ["X", x.bar]]) {
      assert.deepEqual([bar.cut, bar.squeezed, bar.overlaps, bar.noTooltip], [[], [], [], []], k + " " + name + ": nothing cut, squeezed, overlapping or without a tooltip");
      assert.equal(bar.oneLine, true, k + " " + name + ": one line"); assert.equal(bar.overflow, 0, k + " " + name + ": no scrolling row");
    }
    assert.deepEqual(y.grid.order.filter((id) => id !== "kk"), ["bNext", "bBack", "bWatchBar", "bRefresh", "bFull", "bMenu"], k + ": the grid's bar");
    assert.deepEqual(y.playing.order.filter((id) => id !== "kk"), ["bNext", "bBack", "bWatchBar", "bRefresh", "bPrev", "nowq", "bPipBar", "bFull", "bMenu"], k + ": the player's bar");
    assert.equal(y.pointed.outlined, y.pointed.second, k + ": the thumbnail pointed at is the one outlined");
    assert.deepEqual([y.addedFromGrid.on, y.addedFromGrid.inList], [true, true], k + ": + adds it from the grid");
    assert.deepEqual([y.nextFromGrid.playing, y.nextFromGrid.cur], [true, y.nextFromGrid.first], k + ": NEXT on the grid starts the first video");
    assert.deepEqual([y.addedPlaying.on, y.addedPlaying.inList], [true, true], k + ": + adds the playing video");
    assert.deepEqual([y.afterNext.cur, y.afterNext.target], [y.afterNext.second, y.afterNext.second], k + ": after NEXT the + is for the next video");
    assert.deepEqual([y.backToGrid.playing, y.backToGrid.gridShown, y.backToGrid.gridLit], [false, true, true], k + ": GRID is back on the thumbnails");
    assert.equal(y.backToGrid.nextWillPlay, y.backToGrid.third, k + ": and NEXT carries on from where the queue was");
    for (const p of [y.menuGrid, y.menuPlaying, x.panel]) assert.deepEqual([p.inside, p.cutInside], [true, []], k + ": the ⋯ panel opens inside the pane, nothing cut in it");
    assert.ok(y.menuGrid.items.includes("channel") && y.menuGrid.items.includes("videos") && y.menuGrid.items.some((i) => /^select:PERSONAL\|SCINTILLA/.test(i)), k + ": the channel switch and the filters are in the ⋯");
    assert.equal(y.menuAfterChoice.closed, true, k + ": a choice folds it");
    assert.deepEqual([x.every.text, x.every.seconds, x.every.saved], ["60s", 60, null], k + ": 60 s with nothing saved");
    assert.deepEqual(x.panelChoices, [{ s: "30s", on: false }, { s: "60s", on: true }, { s: "90s", on: false }]);
    assert.deepEqual([x.chose90.text, x.chose90.saved, x.chose90.panelClosed], ["90s", "90", true], k + ": a choice is shown, kept and folds the panel");
    assert.equal(x.clock.early, 0, k + ": nothing at 50 s of 60");
    assert.deepEqual(x.clock.underPointer, { asks: 0, hover: true, waiting: true }, k + ": due, but the pointer is on the feed — it waits");
    assert.deepEqual(x.clock.afterLeaving.asks, [{ action: "refresh", value: { pageUp: true, every: 60 } }], k + ": one page-up when the pointer leaves");
    assert.equal(x.clock.nextCount.asks, 0, k + ": and the count starts again");
    assert.deepEqual(x.ink.whileTurning, x.ink.reading, k + ": the source went empty and the pane kept its picture, to the pixel");
    assert.ok(x.ink.landed.litPct > 5 && x.ink.landed.top !== x.ink.reading.top, k + ": then the new page is drawn");
    assert.deepEqual(x.byHand, { asks: [{ action: "refresh", value: null }], restarted: true }, k + ": ↻ by hand is the plain refresh and restarts the count");
    assert.deepEqual([r.after.share.chartsArea, r.after.px.black, r.errs], [76, 0, []], k + ": the floor plan is untouched, no page error");
  }
  const p = m.pageUp;
  assert.equal(p.run.heldUnderHover.run, false); assert.equal(p.run.secondAskInside20s.run, false);
  assert.deepEqual([p.run.out.result, p.run.out.readingOnScreen, p.run.out.newPosts, p.run.xRefreshes], ["top", true, 2, 1], "one refresh of X: two new posts on top, his post still on screen");
  assert.equal(p.run.emptiestMomentPosts, 0, "the stand-in really did go empty while it refreshed — the case the hold is for");
  assert.deepEqual([p.newestOnTop, p.readingStillOnScreen, p.after.scrollTop], [true, true, 0]);
});
