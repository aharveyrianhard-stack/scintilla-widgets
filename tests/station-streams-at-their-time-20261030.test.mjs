/* 30 Oct 2026 — a scheduled stream is on top at its time, and the grid beside the player keeps moving.
   Alan: "these live videos that are scheduled … I'm cool with them appearing a little bit before the video, but … if
   they're already posted now, then when it's actually the time they're further down the list, and I don't see them."
   (asked once already on 22 Oct - W9.) Measured: the MacBook's grid read the feed last at 09:06 ET on 29 Oct and stood
   still all day under a playing video; about thirty streams stood on top from midnight.
   The contract this file holds, for both mounted twins:
     1. a stream comes on the feed half an hour before its start, on top, soonest first; at its hour it is due, on top;
     2. the two-minute pass runs under a playing video where the grid is on screen beside it (the wall, the phone),
        and on a paged grid once he is back at the top;
     3. a grid at the top stays at the top, so what arrives there is seen; a scrolled grid keeps its tile;
     4. only a refusal of the stream columns (400) drops a session to publish-time order, never a network blip;
     5. the pass never starts a video. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SHELLS = ["scintilla-video-v1", "personal-video-v1"];
const SRC = new Map(SHELLS.map((name) =>
  [name, fs.readFileSync(new URL(`../station-shells/${name}/index.html`, import.meta.url), "utf8")]));

function fnText(src, name) {
  let start = src.indexOf(`async function ${name}(`);
  if (start === -1) start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    if (src[i] === "}") depth -= 1;
    if (depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`${name} has no end`);
}
function ctxFor(src) {
  const ctx = { Intl, Date, Math, Number, String, Array, Set, isFinite, esc: (s) => String(s == null ? "" : s) };
  vm.createContext(ctx);
  for (const line of src.match(/^const (?:START_TIME_NY|START_DAY_NY|NY_DAY|DUE_BEFORE_MS|DUE_AFTER_MS|SOON_BEFORE_MS|GRID_TOP_SLACK_PX|VIDEO_PUBLISHED_SHAPE)\s*=[^;]+;$/gm) || [])
    vm.runInContext(line, ctx);
  vm.runInContext(src.match(/^const notOnTheFeedYet = [^;]+;$/m)[0] + "\nglobalThis.notOnTheFeedYet = notOnTheFeedYet;", ctx);
  for (const name of ["videoPublishedMs", "startLabel", "streamPlace", "scheduledInPlace", "videoBadgeHTML",
    "videoRefreshPlan", "scrollAnchor", "restoreAnchor"]) vm.runInContext(fnText(src, name), ctx);
  return ctx;
}
const at = (iso) => Date.parse(iso);
const ids = (rows) => Array.from(rows, (v) => v.video_id);
const up = (id, starts, announced) => ({ video_id: id, live_state: "upcoming", starts_at: starts, feed_at: starts, published_at: announced, duration: null });
const upload = (id, published) => ({ video_id: id, live_state: "none", feed_at: published, published_at: published, duration: "12:00" });
/* Friday 30 Oct's SCINTILLA streams as the feed served them at 05:41 ET (latest start first), with the night's uploads */
const TODAY = [
  up("futurum1500", "2026-10-30T19:00:00+00:00", "2026-10-29T21:10:00+00:00"),
  up("verified1330", "2026-10-30T17:30:00+00:00", "2026-10-29T19:44:00+00:00"),
  up("wolf0930", "2026-10-30T13:30:00+00:00", "2026-10-26T03:49:00+00:00"),
  up("verified0900", "2026-10-30T13:00:00+00:00", "2026-10-29T19:43:00+00:00"),
  up("arete0815", "2026-10-30T12:15:00+00:00", "2026-10-24T23:27:00+00:00"),
];
const UPLOADS = [upload("upload0510", "2026-10-30T09:10:00+00:00"), upload("upload0230", "2026-10-30T06:30:00+00:00")];
const PAGE = [...TODAY, ...UPLOADS];

test("the twins are one page", () => {
  assert.equal(SRC.get("scintilla-video-v1"), SRC.get("personal-video-v1"));
});

for (const [shell, src] of SRC) {
  const ctx = ctxFor(src);

  test(`${shell}: a stream is on top half an hour before its start, and due at its hour`, () => {
    let now = at("2026-10-30T09:45:00Z");     // 05:45 ET: none within half an hour
    assert.deepEqual(ids(ctx.scheduledInPlace(PAGE, now)), ["upload0510", "upload0230"], "no stack of the day's streams on top");
    now = at("2026-10-30T11:50:00Z");         // 07:50 ET: the 8:15 is 25 minutes out
    let rows = ctx.scheduledInPlace(PAGE, now);
    assert.deepEqual(ids(rows), ["arete0815", "upload0510", "upload0230"]);
    assert.match(ctx.videoBadgeHTML(rows[0], now), /<span class="dur soon">LIVE at 8:15am<\/span>/);
    now = at("2026-10-30T12:31:00Z");         // 08:31 ET: the 8:15 has come; the 9:00 is 29 minutes out
    assert.deepEqual(ids(ctx.scheduledInPlace(PAGE, now)), ["arete0815", "verified0900", "upload0510", "upload0230"]);
    now = at("2026-10-30T13:01:00Z");         // 09:01 ET: both due, earliest first, the 9:30 next
    rows = ctx.scheduledInPlace(PAGE, now);
    assert.deepEqual(ids(rows), ["arete0815", "verified0900", "wolf0930", "upload0510", "upload0230"]);
    assert.match(ctx.videoBadgeHTML(rows[1], now), /class="dur soon due">LIVE at 9:00am</, "its time has come: bright");
    assert.equal(ctx.notOnTheFeedYet(TODAY[1], now), true, "the 1:30pm waits for its half hour");
  });

  test(`${shell}: the two-minute pass runs under a playing video where the grid is beside it`, () => {
    const base = { visible: true, playing: false, gridShown: true, pagedPast: false, atTop: true, pointerInList: false };
    assert.equal(ctx.videoRefreshPlan({ ...base, playing: true }).load, true, "the wall: the grid is on screen beside the player");
    assert.equal(ctx.videoRefreshPlan({ ...base, playing: true, gridShown: false }).load, false, "a video over the grid still holds it");
    assert.equal(ctx.videoRefreshPlan({ ...base, pagedPast: true }).load, true, "paged down but back at the top");
    assert.equal(ctx.videoRefreshPlan({ ...base, pagedPast: true, atTop: false }).load, false, "paged down and reading: left alone");
    assert.equal(ctx.videoRefreshPlan({ ...base, playing: true, pointerInList: true }).hold, true, "never under his hand");
    assert.equal(ctx.videoRefreshPlan({ ...base, visible: false }).load, false);
    assert.match(fnText(src, "videoRefreshState"), /gridShown: FIXED \|\| STACK \|\| BESIDE/);
    assert.match(fnText(src, "videoRefreshState"), /atTop: el\("grid"\)\.scrollTop <= GRID_TOP_SLACK_PX/);
    assert.equal((src.match(/videoRefreshPlan\(videoRefreshState\(\)\)/g) || []).length, 2, "the pass and the held refresh read one state");
  });

  test(`${shell}: at the top the grid stays at the top, so what arrives there is seen`, () => {
    const cards = (list, h = 100) => list.map((id, i) => ({ dataset: { v: id }, offsetTop: i * h, offsetHeight: h }));
    const grid = (top, list) => ({ scrollTop: top, _cards: cards(list),
      querySelectorAll() { return this._cards; },
      querySelector(sel) { const id = sel.match(/data-v="([^"]+)"/)[1]; return this._cards.find((c) => c.dataset.v === id) || null; } });
    let g = grid(0, ["a", "b", "c"]);
    let keep = ctx.scrollAnchor(g);
    g._cards = cards(["live", "a", "b", "c"]);      // a stream goes live on top
    ctx.restoreAnchor(g, keep);
    assert.equal(g.scrollTop, 0, "the new tile is in view");
    g = grid(250, ["a", "b", "c", "d"]);             // scrolled down, reading c
    keep = ctx.scrollAnchor(g);
    g._cards = cards(["live", "a", "b", "c", "d"]);
    ctx.restoreAnchor(g, keep);
    assert.equal(g.scrollTop, 350, "a scrolled grid keeps the tile he was reading");
  });

  test(`${shell}: only a refusal of the stream columns drops a session to publish-time order`, async () => {
    const run = async (status) => {
      const box = vm.createContext({ String, calls: [] });
      vm.runInContext(`var FEED_LIVE_OK = true;
        const feedQuery = () => (FEED_LIVE_OK ? "live" : "plain");
        let first = true;
        async function pg(q) { calls.push(q); if (first) { first = false; throw new Error(${JSON.stringify(status)}); } return [q]; }
        ${fnText(src, "readFeed")}
        globalThis.readFeed = readFeed; globalThis.state = () => FEED_LIVE_OK;`, box);
      let result = null, error = null;
      try { result = await box.readFeed(0); } catch (e) { error = e.message; }
      return { result, error, ok: box.state(), calls: Array.from(box.calls) };
    };
    const blip = await run("pg 503");
    assert.deepEqual([blip.error, blip.ok, blip.calls], ["pg 503", true, ["live"]], "a blip is a failed read, never a downgrade");
    const offline = await run("Failed to fetch");
    assert.equal(offline.ok, true, "nor is a Mac waking with no network");
    const refused = await run("pg 400");
    assert.deepEqual([Array.from(refused.result), refused.ok, refused.calls], [["plain"], false, ["live", "plain"]], "a 400 is the old database: the plain read");
  });

  test(`${shell}: the two-minute pass never starts a video`, () => {
    assert.match(fnText(src, "load"), /if \(START && BYID\[START\] && !quiet\) play\(BYID\[START\], AUTO\);/);
  });
}
