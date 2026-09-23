/* Overnight 4 (22–23 Sep) — the video row, the channels, and GRID · VIDEOS · SHORTS.
   ==================================================================================
   Alan: "I'm never gonna have two videos at the same time... make the X space bigger and the video
   bigger... Make the video as big as it can be given the altitude of the space, as wide as it can
   be, that it doesn't crop. Give whatever extra space to the Twitter." · "The channels are ready:
   the Soundscape one, the golf one, another one for AI research, and I'm thinking of making another
   one for fitness." · "A combined grid, one of only shorts, one of only videos." · "Please don't
   make me lose features."

   What this file holds:
     1. the two mounted video shells are the same bytes;
     2. the deck's feed registry and the shell's profile registry name the same account keys, so a
        channel is one identity on the wall, in the pane and at the collector;
     3. a short is the platform's flag OR a length of 60 seconds or less — measured on the live
        feed on 2026-09-23: 3,859 flagged, 183 sub-minute videos not flagged, 1,283 flagged over a
        minute — and the database is asked the same question the page asks;
     4. the video pane on the wall is exactly as wide as its height allows for a 16:9 picture,
        chrome subtracted, clamped so neither pane starves, and the lock stands down for phone
        stacking, the media expansions and a bottom-row solo;
     5. the shell tells the deck about itself (its chrome height, a feed choice) instead of
        navigating on its own inside the wall. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SHELLS = ["personal-video-v1", "scintilla-video-v1"];
const shell = Object.fromEntries(SHELLS.map((n) =>
  [n, fs.readFileSync(new URL(`../station-shells/${n}/index.html`, import.meta.url), "utf8")]));
const pane = shell["personal-video-v1"];
const deck = fs.readFileSync(new URL("../deck/index.html", import.meta.url), "utf8");

function fnFrom(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  for (let i = src.indexOf("{", start); i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    if (src[i] === "}") { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced ${name}`);
}
function constFrom(src, name, terminator = ";\n") {
  const start = src.indexOf(`const ${name} =`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = src.indexOf(terminator, start);
  return src.slice(start, end + 1);
}

/* the shell's mode helpers, run as they are written */
const shellApi = vm.runInNewContext(
  [constFrom(pane, "SHORT_CLAUSE"), constFrom(pane, "LONG_CLAUSE"),
   fnFrom(pane, "modeClause"), fnFrom(pane, "durationSeconds"), fnFrom(pane, "isShortVideo"), fnFrom(pane, "inMode"),
   "let MODE = 'grid';",
   "({ SHORT_CLAUSE, LONG_CLAUSE, modeClause, durationSeconds, isShortVideo, inMode })"].join("\n"), {});
const profilesSrc = pane.slice(pane.indexOf("const FEED_PROFILES = ["), pane.indexOf("const FEED_PROFILE_KEYS"));
const { FEED_PROFILES } = vm.runInNewContext(profilesSrc + "\n({ FEED_PROFILES })", {});

/* the deck's registry and the width rule */
const deckApi = vm.runInNewContext(
  [constFrom(deck, "VIDEO_FEEDS", "];\n"), constFrom(deck, "VIDEO_FEEDS_WHEN_PRESENT"),
   constFrom(deck, "VIDEO_CHROME_FALLBACK_PX"), constFrom(deck, "VIDEO_FIT_MIN"),
   fnFrom(deck, "videoFitWidth"),
   "({ VIDEO_FEEDS, VIDEO_FEEDS_WHEN_PRESENT, VIDEO_CHROME_FALLBACK_PX, videoFitWidth })"].join("\n"), {});

test("1 · the two mounted video shells are byte-identical", () => {
  assert.equal(shell["personal-video-v1"], shell["scintilla-video-v1"]);
});

test("2 · deck feeds and shell profiles are the same six account keys, one label each", () => {
  const deckAccounts = [...deckApi.VIDEO_FEEDS].map(([, , account]) => account);   // spread: the sandbox's arrays are another realm's
  assert.deepEqual(deckAccounts, ["personal", "scintilla", "soundscapes", "golf", "ai_research", "fitness"]);
  const shellAccounts = FEED_PROFILES.filter((p) => p.account).map((p) => p.account);
  assert.deepEqual([...shellAccounts].sort(), [...deckAccounts].sort(), "the pane knows every feed the deck can put on the wall");
  for (const [key, label] of deckApi.VIDEO_FEEDS) assert.ok(key && label, "every feed has a pane key and a button label");
  assert.deepEqual([...deckApi.VIDEO_FEEDS_WHEN_PRESENT], ["ff"], "only FITNESS waits to be present before it is offered");
  assert.match(deck, /videoFeedKnown\(remembered\("station\.videoFeed"\)\)/, "a remembered feed is checked against the registry, never trusted");
  for (const account of ["soundscapes", "golf", "ai_research", "fitness"]) {
    const profile = FEED_PROFILES.find((p) => p.account === account);
    assert.match(profile.note, /waiting for its YouTube sign-in/, `${account} says in plain words what it waits for until rows carry it`);
  }
});

test("2b · the deck builds one pane per feed from the registry and keeps the two original panes' words", () => {
  assert.match(deck, /for \(const \[key, label, account\] of VIDEO_FEEDS\) \{\n    if \(key === "fb" \|\| key === "fa"\) continue;\n    defs\.splice\(defs\.length - 1, 0, \{/, "the channel panes are added before X; the two original pane literals are untouched");
  assert.match(deck, /\{ row: 1, key: "fb", short: "personal", title: "Personal YouTube", tag: "personal subscriptions",/);
  assert.match(deck, /\{ row: 1, key: "fa", short: "SCINTILLA", title: "SCINTILLA YouTube", tag: "SCINTILLA subscriptions · shared Watch Later",/);
  assert.match(deck, /"\?shell=v1&feed=" \+ account \+ "&cols=2&view="/);
  assert.match(deck, /"Personal YouTube"/); assert.match(deck, /"SCINTILLA YouTube"/);
  assert.match(deck, /"SCINTILLA subscriptions · shared Watch Later"/);
  assert.match(deck, /channelVideo: "\/station-shells\/scintilla-video-v1"/, "the channel feeds ride the SCINTILLA twin");
  assert.match(deck, /if \(o\.def\.kind === "video" && !videoFeedChip\(o\.def\.key\)\) continue;/, "an awaiting channel has a switch button but no pane chip");
  assert.match(fnFrom(pane, "paint"), /ACCOUNT_EMPTY\s*\? '<div class="msg note">/, "an empty channel pane says what it is waiting for, not 'no videos'");
  assert.match(fnFrom(pane, "paint"), /has no videos here yet/, "in plain words, with the channel named");
  assert.match(fnFrom(pane, "paint"), /CONNECT_PAGE \+[\s\S]{0,80}\?account=/, "and the one step linked");
  assert.match(fnFrom(pane, "load"), /subscription_accounts=cs\." \+\s*encodeURIComponent\("\{" \+ FEED_PROFILE\.account \+ "\}"\) \+ "&limit=1"/, "decided by one id read");
});

test("3 · a short is the platform's flag OR sixty seconds or less; the page and the query agree", () => {
  const { durationSeconds, isShortVideo, inMode, modeClause, SHORT_CLAUSE, LONG_CLAUSE } = shellApi;
  assert.equal(durationSeconds("0:45"), 45);
  assert.equal(durationSeconds("1:00"), 60);
  assert.equal(durationSeconds("1:01"), 61);
  assert.equal(durationSeconds("13:33"), 813);
  assert.equal(durationSeconds("1:02:33"), 3753);
  assert.equal(durationSeconds(""), null);
  assert.equal(durationSeconds("live"), null);
  assert.equal(durationSeconds(null), null);
  assert.equal(isShortVideo({ is_short: true, duration: "3:00" }), true, "flagged: a short however long");
  assert.equal(isShortVideo({ is_short: false, duration: "0:59" }), true, "sub-minute: a short however unflagged");
  assert.equal(isShortVideo({ is_short: false, duration: "1:00" }), true, "sixty seconds is the boundary, inclusive");
  assert.equal(isShortVideo({ is_short: false, duration: "1:01" }), false);
  assert.equal(isShortVideo({ is_short: false, duration: null }), false, "no length and no flag is not a short");
  const rows = [{ is_short: true, duration: "3:00" }, { is_short: false, duration: "0:30" }, { is_short: false, duration: "12:00" }];
  assert.deepEqual(rows.map((v) => inMode(v, "grid")), [true, true, true], "GRID is everything");
  assert.deepEqual(rows.map((v) => inMode(v, "videos")), [false, false, true], "VIDEOS has no shorts of either kind");
  assert.deepEqual(rows.map((v) => inMode(v, "shorts")), [true, true, false], "SHORTS has both kinds");
  assert.equal(modeClause("grid"), "");
  assert.equal(modeClause("shorts"), SHORT_CLAUSE);
  assert.equal(modeClause("videos"), LONG_CLAUSE);
  for (const piece of ["is_short.eq.true", "duration.like.0:*", "duration.eq.1:00"]) assert.ok(SHORT_CLAUSE.includes(piece), `the SHORTS query asks for ${piece}`);
  for (const piece of ["is_short=eq.false", "duration=not.like.0:*", "duration=neq.1:00"]) assert.ok(LONG_CLAUSE.includes(piece), `the VIDEOS query excludes ${piece}`);
});

test("3b · the tabs come first, every list keeps its chip, the old links still land", () => {
  const paint = fnFrom(pane, "paintChips");
  assert.ok(paint.indexOf("for (const [id, label] of MODES)") < paint.indexOf("for (const l of LISTS)"), "GRID · VIDEOS · SHORTS before the list chips");
  assert.match(paint, /aria-pressed/, "the active tab is announced");
  assert.match(pane, /LEGACY_LIST === "shorts" \? "shorts"/, "?list=shorts opens the SHORTS tab");
  assert.match(pane, /LEGACY_LIST === "all" \? "grid"/, "?list=all opens the market grid");
  assert.match(pane, /const MODE_DEFAULT = FEED === "scintilla" \|\| FEED === "market" \? "grid" : "videos";/, "each feed opens on what it showed before the tabs existed");
  assert.match(fnFrom(pane, "feedQuery"), /q \+= modeClause\(MODE\);/, "the database is asked the same question");
  assert.match(fnFrom(pane, "visibleRows"), /inMode\(v\)/, "the id-based watch list is filtered on the page");
  assert.match(fnFrom(pane, "visibleQueue"), /inMode\(v\)/, "prev / next stay inside the tab");
  assert.match(fnFrom(pane, "syncUrl"), /p\.set\("mode", MODE\)/, "the URL carries the tab, so PiP and the deck lift the same view");
  assert.match(pane, /\.dur\{/, "the duration badge Alan asked to keep is still styled");
  assert.match(fnFrom(pane, "cardHTML"), /class="dur"/, "and still painted on the thumbnail");
});

test("4 · the video pane and X split the bottom row 50/50 (Alan, 23 Sep)", () => {
  const { videoFitWidth, VIDEO_CHROME_FALLBACK_PX } = deckApi;
  assert.equal(VIDEO_CHROME_FALLBACK_PX, 25);
  // "Let's just give the YouTube 50-50." The picture is capped by the row height, so a wider pane
  // bought only black bars; half and half at every width and height.
  for (const [row, h] of [[1920, 495], [1440, 445], [1000, 900], [1920, 200]]) {
    assert.equal(videoFitWidth(row, h, 25), Math.round(row / 2), `${row}px row → half`);
  }
  assert.equal(videoFitWidth(0, 495, 25), 0);
  assert.match(deck, /\.dsec\[data-sec="video"\]\{ display:none !important; \}/, "the feed choice lives in the pane dropdown, not the top bar");
  const fit = fnFrom(deck, "fitVideoPane");
  assert.match(fit, /o\.def\.key === VIDEO_FEED && !STACKED && MEDIA_STAGE === 0 && !soloInBottomRow\(\)/, "the lock only applies to the ordinary two-pane row");
  assert.match(fit, /o\.node\.style\.width = ""/, "and stands down cleanly");
  assert.match(deck, /#rowBot > \.pane\.video-fit\{ flex:0 0 auto; \}/, "X is a plain flex sibling and takes the rest");
  for (const hook of ["applyVideoFeed", "applyMediaStage", "resetMediaStage", "relayout"]) {
    assert.match(fnFrom(deck, hook), /fitVideoPane\(\)/, `${hook} re-fits the pane`);
  }
});

test("5 · the shell reports to the deck; the deck listens", () => {
  assert.match(pane, /parent\.postMessage\(\{ sc: "video-chrome", px: el\("bar"\)\.offsetHeight, feed: FEED \}, location\.origin\)/);
  assert.match(pane, /parent\.postMessage\(\{ sc: "video-feed", account: next \}, location\.origin\)/);
  assert.match(pane, /const EMBEDDED = /, "only inside the wall");
  assert.match(deck, /event\.data\?\.sc === "video-chrome"/);
  assert.match(deck, /event\.data\?\.sc === "video-feed"/);
  assert.match(deck, /VIDEO_FEED_KEY_BY_ACCOUNT\.get\(String\(event\.data\.account \|\| ""\)\.toLowerCase\(\)\)/);
  assert.match(fnFrom(deck, "readVideoFeedPresence"), /subscription_accounts=ov\./, "presence is read from the rows, once, with one overlap query");
  assert.match(fnFrom(deck, "paintVideoFeed"), /awaiting \? " ·" : ""/, "a named channel with no rows yet is marked, not hidden");
});

test("5b · a channel feed cannot subscribe through the collectors deployed today", () => {
  assert.match(pane, /const CHANNEL_FEED_SUBSCRIBE_READY = false;/, "flipped only in the change that deploys the six-account collectors");
  assert.match(fnFrom(pane, "subscribeToChannel"), /if \(CHANNEL_FEED && !CHANNEL_FEED_SUBSCRIBE_READY\) return;/);
  assert.match(fnFrom(pane, "refreshSubscribeButton"), /b\.disabled = true;[\s\S]{0,120}"subscribe — after the collector update"/, "and the button says why");
});

test("6 · house rule: nothing added tonight is white or near-white", () => {
  const added = [
    deck.slice(deck.indexOf("THE VIDEO TAKES THE WIDTH ITS HEIGHT ALLOWS"), deck.indexOf("#rowBot > .pane.video-fit{ flex:0 0 auto; }")),
    pane.slice(pane.indexOf("#chips .sep{"), pane.indexOf("#q{")),
  ].join("\n");
  assert.doesNotMatch(added, /#fff\b|#ffffff|#f2f2f8|#c6c8de|\bwhite(?!-space)|rgb\(255/i);
});
