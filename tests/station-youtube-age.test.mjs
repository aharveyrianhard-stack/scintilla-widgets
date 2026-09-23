/* SCI-26 — the Station's YouTube tiles never said how long ago a video was posted.
   ==============================================================================
   Each tile carried the video's LENGTH in the corner of the thumbnail (13:33) and the
   channel name underneath, with the right half of the channel line empty. Length is
   not age. A reader with only a length has no way to tell this morning's upload from
   one that has been sitting in the list for a week.

   The age now sits in that empty space. The contract this file holds:

     1. published_at is the only source. The database also knows when WE first saw a
        row (youtube_videos.updated_ts, written by the RSS sweep). Measured on the live
        table, that collection time trails publication by 4-15 minutes for ordinary
        uploads and by up to two days for livestreams — so using it as a fallback would
        make late-caught videos announce themselves as new. A row with no usable publish
        time is given no age, never a computed one.
     2. The wording is fixed and lowercase, and every step floors: the label is an age
        the video has certainly reached.
     3. The label keeps up with the clock without a timer per tile and without a request.

   Both mounted shells are asserted, because the deck pins each pane to its own release
   surface and a fix applied to one of them is not applied to the Station.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SHELLS = ["scintilla-video-v1", "personal-video-v1"];
const SRC = new Map(SHELLS.map((name) =>
  [name, fs.readFileSync(new URL(`../station-shells/${name}/index.html`, import.meta.url), "utf8")]));

function fnFrom(src, name, bindings = {}) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0, end = -1;
  for (let i = src.indexOf("{", start); i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    if (src[i] === "}") depth -= 1;
    if (depth === 0) { end = i + 1; break; }
  }
  return vm.runInNewContext(`(${src.slice(start, end)})`, bindings);
}

const BASE = { Number, isFinite, Date, String, Math, VIDEO_AGE_NONE:"",
  VIDEO_PUBLISHED_SHAPE:/^\d{4}-\d{2}-\d{2}[T ]/ };
const labeller = (src) => fnFrom(src, "videoAgeLabel",
  { ...BASE, videoPublishedMs:fnFrom(src, "videoPublishedMs", BASE) });

/* Prose is not behaviour. The doctrine assertions below read the code only. */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ");

/* A fixed instant so every expectation below is arithmetic, not wall clock. */
const NOW = Date.parse("2026-09-22T18:00:00Z");
const ago = (seconds) => new Date(NOW - seconds * 1000).toISOString();
const MIN = 60, HOUR = 3600, DAY = 86400;

for (const shell of SHELLS) {
  const src = SRC.get(shell);

  test(`${shell}: the wording Alan asked for, at every boundary`, () => {
    const label = labeller(src);
    const at = (seconds) => label(ago(seconds), NOW);

    assert.equal(at(0), "just now");
    assert.equal(at(119), "just now", "under two minutes is 'just now'");
    assert.equal(at(120), "2m ago", "and two minutes is a number — no gap between the two");
    assert.equal(at(14 * MIN), "14m ago");
    assert.equal(at(59 * MIN + 59), "59m ago", "floors: 59m59s has not reached an hour");
    assert.equal(at(HOUR), "1h ago");
    assert.equal(at(2 * HOUR), "2h ago");
    assert.equal(at(9 * HOUR), "9h ago");
    assert.equal(at(DAY - 1), "23h ago");
    assert.equal(at(DAY), "yesterday");
    assert.equal(at(2 * DAY - 1), "yesterday", "the whole second day reads as yesterday");
    assert.equal(at(2 * DAY), "2d ago");
    assert.equal(at(3 * DAY), "3d ago");
    assert.equal(at(7 * DAY - 1), "6d ago");
    assert.equal(at(7 * DAY), "1w ago");
    assert.equal(at(14 * DAY), "2w ago");

    /* Lowercase and dim was the instruction; nothing here may shout. */
    for (const seconds of [0, 30 * MIN, 5 * HOUR, DAY, 5 * DAY, 20 * DAY])
      assert.equal(at(seconds), at(seconds).toLowerCase());
  });

  test(`${shell}: an age is never invented`, () => {
    const label = labeller(src);
    /* This is the whole defect class: a row without a publish time must render
       nothing, because every arithmetic alternative produces a confident lie. */
    for (const empty of [null, undefined, ""]) assert.equal(label(empty, NOW), "");
    for (const bad of ["not a date", "NaN", {}, [], true, false, 0, "0", -1])
      assert.equal(label(bad, NOW), "", `${JSON.stringify(bad)} must not become an age`);
    /* The arithmetic the naive version performs, and what it would have shown. */
    assert.equal(new Date(Number(null)).getTime(), 0);
    assert.ok((NOW - 0) / 86400e3 > 20000, "a null read as zero is a 20,000-day-old video");
  });

  test(`${shell}: a publish time in the future is not an age`, () => {
    const label = labeller(src);
    assert.equal(label(ago(-30), NOW), "just now", "half a minute of clock skew still reads as new");
    assert.equal(label(ago(-3 * DAY), NOW), "", "a premiere scheduled for Friday is not 'just now'");
  });

  test(`${shell}: length and age are different numbers in different places`, () => {
    /* 13:33 is how long the video runs. It stays in the corner of the thumbnail,
       and the age is a separate element on the channel line. Losing that split is
       how a reader ends up thinking a 13-minute video was posted 13 minutes ago. */
    assert.match(src, /<span class="dur">' \+ esc\(v\.duration\)/,
      "the duration badge keeps its own element");
    assert.match(src, /class="age" data-published=/, "the age is its own element");
    assert.doesNotMatch(src, /class="dur"[^]{0,120}videoAgeLabel/,
      "the age never enters the duration badge");
  });

  test(`${shell}: the age is on the channel line, right-aligned into the empty space`, () => {
    assert.match(src, /'<div class="s"><span class="ch">' \+ esc\(v\.channel \|\| ""\) \+ "<\/span>" \+ videoAgeHTML\(v\)/,
      "channel and age share one line, channel first");
    assert.match(src, /\.cap \.s\{[^}]*display:flex/, "the line is a flex row, not two blocks");
    assert.match(src, /\.cap \.s \.age\{[^}]*margin-left:auto/, "the age is pushed to the right edge");
    assert.match(src, /\.cap \.s \.ch\{[^}]*text-overflow:ellipsis/,
      "a long channel name still truncates instead of pushing the age off the tile");
    /* Dim, small, monochrome, and above all not white: the age inherits the
       channel's own colour and font-size rather than introducing either. */
    assert.doesNotMatch(src, /\.cap \.s \.age\{[^}]*color:/, "the age introduces no colour of its own");
    assert.doesNotMatch(src, /\.cap \.s \.age\{[^}]*font-size:/, "nor a size of its own");
    assert.match(src, /\.cap \.s\{[^}]*color:var\(--mute\)/, "and the line it inherits from is the dim token");
  });

  test(`${shell}: the label keeps up with the clock, on the pass that already runs`, () => {
    /* A tile that said "2h ago" this morning must not still say it tonight. */
    const label = labeller(src);
    const published = ago(2 * HOUR);
    assert.equal(label(published, NOW), "2h ago");
    assert.equal(label(published, NOW + 7 * HOUR * 1000), "9h ago", "the same row, later in the day");
    assert.equal(label(published, NOW + DAY * 1000), "yesterday");

    assert.match(src, /function paintAges\(\)/, "there is one re-read for the whole grid");
    assert.match(src, /document\.querySelectorAll\("#grid \.age"\)/);
    /* On the existing 120s feed pass, before the conditional read — so the ages
       move even when the feed did not and even while a video is playing. */
    assert.match(src, /paintAges\(\);\n {4}if \(document\.visibilityState === "visible" && !CUR\) load\(false, true\);/);
    assert.match(src, /visibilitychange[^]{0,120}paintAges\(\)/,
      "and again the moment the tab comes back to the front");
  });

  test(`${shell}: no new timer, no new request, no new identity`, () => {
    const intervals = src.match(/setInterval\(/g) || [];
    assert.equal(intervals.length, 2,
      "still only the feed pass and the player-API poll — the ages added neither");
    /* paintAges reads the DOM and the clock. Nothing else. */
    const body = fnFrom(src, "paintAges", { document:{ querySelectorAll:() => [] }, Date,
      videoAgeLabel:() => "" });
    assert.equal(typeof body, "function");
    const fnSrc = src.slice(src.indexOf("function paintAges()"),
      src.indexOf("}", src.indexOf("document.addEventListener(\"visibilitychange\"")));
    assert.doesNotMatch(fnSrc, /fetch\(|pg\(|load\(/, "the re-read never touches the network");
    /* published_at travels on a data attribute; no id and no aria-label moved. */
    assert.match(src, /data-published="/);
    assert.doesNotMatch(src, /id="age/);
  });

  test(`${shell}: collection time is never substituted for publish time`, () => {
    /* updated_ts is the sweep pass that first saw the row. Measured on the live
       table for Verified Investing: ordinary uploads land 4-15 minutes after
       publication, livestreams up to 2d 1h after. It is not an age and must not
       reach this file — the feed view does not even expose it. */
    assert.doesNotMatch(codeOf(src), /updated_ts/,
      "no code here asks for, or reads, a collection time");
    /* 23 Sep: the age now comes from videoWhen(v) — the stream's actual start
       when the feed knows one, the publish time otherwise. That is still the
       video's own time, never ours: feed_at is YouTube's actualStartTime, and a
       row with no stream times is byte-for-byte the old behaviour. */
    assert.match(src, /videoAgeLabel\(when\)/,
      "the tile's age comes from the video's own time and nothing else");
    assert.match(src, /function videoWhen\(v\) \{ return \(v && \(v\.feed_at \|\| v\.published_at\)\) \|\| ""; \}/,
      "and that time is the start of the stream, or the publish time — no third source");
  });
}

test("both mounted shells carry the identical change", () => {
  /* The deck pins each pane to its own release surface, so a fix landing in one
     of them is a fix half-applied to the Station. */
  const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");
  for (const shell of SHELLS)
    assert.match(deck, new RegExp(`"/station-shells/${shell}"`), `${shell} is a mounted pane`);
  assert.equal(SRC.get("scintilla-video-v1"), SRC.get("personal-video-v1"),
    "the two shells stayed byte-identical, as they were before the change");
});
