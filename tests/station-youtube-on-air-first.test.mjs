/* Y2 (5 Oct 2026) — a stream that is on air NOW is first in the video grid.
   Alan: "Wolf Trading is live right now on X Spaces and on YouTube — I don't see it on our YouTube feed."
   Fixtures only. The functions are lifted out of both mounted shells and run as they are. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SHELLS = ["scintilla-video-v1", "personal-video-v1"];
const SRC = new Map(SHELLS.map((name) => [name, fs.readFileSync(new URL(`../station-shells/${name}/index.html`, import.meta.url), "utf8")]));

function source(src, name) {
  let start = src.indexOf(`async function ${name}(`);
  if (start === -1) start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, name + " exists");
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) break; }
  return src.slice(start, i + 1);
}
function ctxWith(src, names, globals = {}) {
  const ctx = vm.createContext({ Date, isFinite, Array, Set, encodeURIComponent, ON_AIR_PIN_HOURS: 12, ON_AIR_MAX: 20, ...globals });
  for (const name of names) vm.runInContext(source(src, name), ctx);
  return ctx;
}
const NOW = Date.parse("2026-10-05T19:30:00Z");
const row = (id, feedAt, live = "none") => ({ video_id: id, feed_at: feedAt, live_state: live, subscription_accounts: ["scintilla"] });
const ids = (rows) => Array.from(rows, (v) => v.video_id);   // a plain array of this realm, whatever realm built the list

for (const [name, src] of SRC) {
  test(name + ": WOLF Trading went on air at 13:48 ET — it is the first tile, ahead of two hours of newer uploads", () => {
    const ctx = ctxWith(src, ["onAirNow", "liveFirst"]);
    const page = [row("upload-1925", "2026-10-05T19:25:00Z"), row("upload-1900", "2026-10-05T19:00:00Z"), row("wolf-live", "2026-10-05T17:48:00Z", "live"), row("upload-1700", "2026-10-05T17:00:00Z")];
    assert.deepEqual(ids(ctx.liveFirst(page, [row("wolf-live", "2026-10-05T17:48:00Z", "live")], NOW)), ["wolf-live", "upload-1925", "upload-1900", "upload-1700"]);
  });

  test(name + ": a stream on air that is NOT on the first page is still first", () => {
    const ctx = ctxWith(src, ["onAirNow", "liveFirst"]);
    const page = [row("a", "2026-10-05T19:25:00Z"), row("b", "2026-10-05T19:00:00Z")];
    const out = ctx.liveFirst(page, [row("early-live", "2026-10-05T12:00:00Z", "live"), row("late-live", "2026-10-05T18:00:00Z", "live")], NOW);
    assert.deepEqual(ids(out), ["late-live", "early-live", "a", "b"], "newest start first, then the page as it was");
  });

  test(name + ": nothing on air — the grid is exactly what it was", () => {
    const ctx = ctxWith(src, ["onAirNow", "liveFirst"]);
    const page = [row("a", "2026-10-05T19:25:00Z"), row("b", "2026-10-05T19:00:00Z")];
    assert.equal(ctx.liveFirst(page, [], NOW), page, "the very same list, untouched");
    assert.equal(ctx.liveFirst(page, null, NOW), page);
  });

  test(name + ": a round-the-clock stream, a stale LIVE and a stream still to come are not put first", () => {
    const ctx = ctxWith(src, ["onAirNow", "liveFirst"]);
    assert.equal(ctx.onAirNow(row("x", "2026-10-05T17:48:00Z", "live"), NOW), true);
    assert.equal(ctx.onAirNow(row("x", "2026-09-21T08:34:47Z", "live"), NOW), false, "said LIVE since 21 Sep");
    assert.equal(ctx.onAirNow(row("x", "2026-10-05T07:29:00Z", "live"), NOW), false, "on air for more than 12 hours");
    assert.equal(ctx.onAirNow(row("x", "2026-10-05T07:31:00Z", "live"), NOW), true);
    assert.equal(ctx.onAirNow(row("x", "2026-10-05T21:00:00Z", "upcoming"), NOW), false);
    assert.equal(ctx.onAirNow(row("x", "2026-10-05T17:00:00Z", "was_live"), NOW), false);
    assert.equal(ctx.onAirNow(row("x", "", "live"), NOW), false, "no start time, no claim");
    const page = [row("a", "2026-10-05T19:25:00Z"), row("binaural", "2026-09-22T10:16:59Z", "live")];
    assert.deepEqual(ids(ctx.liveFirst(page, [row("binaural", "2026-09-22T10:16:59Z", "live")], NOW)), ["a", "binaural"]);
  });

  test(name + ": a LIVE row a ticker search found (no channel of ours) is never put first", () => {
    const ctx = ctxWith(src, ["onAirNow", "liveFirst"]);
    const scam = { video_id: "scam", feed_at: "2026-10-05T19:00:00Z", live_state: "live", subscription_accounts: [] };
    const page = [row("a", "2026-10-05T19:25:00Z"), scam];
    assert.deepEqual(ids(ctx.liveFirst(page, [], NOW)), ["a", "scam"], "only what the on-air read returns is pinned, and that read asks for this feed's channels");
    const q = ctxWith(src, ["onAirQuery"], { FEED_PROFILE: { account: "scintilla" }, FEED_SELECT_LIVE: "video_id,feed_at,live_state", MODE: "grid", TICK: "", modeClause: () => "" }).onAirQuery();
    assert.match(q, /^youtube_feed\?select=video_id,feed_at,live_state&live_state=eq\.live&order=feed_at\.desc&limit=20&subscription_accounts=cs\.%7Bscintilla%7D$/);
    assert.equal(ctxWith(src, ["onAirQuery"], { FEED_PROFILE: { account: null }, FEED_SELECT_LIVE: "x", MODE: "grid", TICK: "", modeClause: () => "" }).onAirQuery(), "", "MARKET SEARCH carries no channels: nothing is asked");
  });

  test(name + ": the on-air read never breaks the grid, and is skipped where it cannot apply", async () => {
    const calls = [];
    const make = (globals) => ctxWith(src, ["readOnAir"], { FEED_LIVE_OK: true, LIST: "default", onAirQuery: () => "q", pg: async (q, tries) => { calls.push([q, tries]); return [row("x", "2026-10-05T19:00:00Z", "live")]; }, ...globals });
    assert.equal((await make({}).readOnAir()).length, 1);
    assert.deepEqual(calls[0], ["q", 1], "one try: the grid does not wait on retries");
    assert.deepEqual(Array.from(await make({ pg: async () => { throw new Error("pg 503"); } }).readOnAir()), [], "a failed read is an empty read");
    assert.deepEqual(Array.from(await make({ FEED_LIVE_OK: false }).readOnAir()), [], "an older feed has no live_state to ask about");
    assert.deepEqual(Array.from(await make({ LIST: "watch" }).readOnAir()), [], "Watch Later is Alan's own order");
    assert.match(source(src, "load"), /const nextRows = liveFirst\(filterFeedRows\(raw\), await readOnAir\(\)\);/, "the grid's first page goes through it");
  });
}

test("both mounted shells carry it byte for byte", () => {
  assert.equal(SRC.get("scintilla-video-v1"), SRC.get("personal-video-v1"));
});
