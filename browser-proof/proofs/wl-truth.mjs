/* The watch-later lane tells the truth on every surface that carries it.
   ======================================================================
   Run: PW_MODULE_DIR=<dir-with-playwright-core> node browser-proof/proofs/wl-truth.mjs
   The class is five files (grep yt_watch_later): /youtube, /pane-video, the two mounted
   shells (byte-identical, pinned so), and video-v1 — the retained rollback, exempt by
   ruling. This proof exercises the MOUNTED shell (what /deck actually shows) and /youtube:

   - a failed saved-list read paints UNKNOWN, never "unsaved" (rule 1: a failed read is
     never data) — and /youtube keeps the feed's own served watch_later flags, because
     those came from a read that LANDED;
   - a lost write reverts the optimistic flip AND says why (the shells used to revert
     silently; the gesture just vanished);
   - a lost subscribe says why (the catch used to swallow it whole);
   - the old "YouTube reconnect required" wording is gone — a failed Supabase table read
     may not name YouTube auth as its cause.

   All failure injection is PAGE-level routing (page routes take precedence over the rig's
   context routes), so the shared fixtures stay untouched for every other proof.
*/
import assert from "node:assert/strict";
import { launch, shoot, record, nowStamp } from "../rig.mjs";

const { context, origin, close } = await launch();

/* ---- scenario 1: the shell boots with the saved-list read DEAD ---- */
const s1 = await context.newPage();
const s1errs = []; s1.on("pageerror", (e) => s1errs.push(String(e).split("\n")[0]));
await s1.route("**/rest/v1/yt_watch_later**", (r) => r.abort("connectionrefused"));
await s1.goto(origin + "/station-shells/personal-video-v1/?feed=scintilla", { waitUntil: "domcontentloaded" });
await s1.waitForTimeout(5500); /* pg retries 3x with backoff before giving up */

const s1state = await s1.evaluate(() => ({
  unk: Array.from(document.querySelectorAll("#grid .star.unk")).length,
  claiming: Array.from(document.querySelectorAll("#grid .star:not(.unk)")).length,
  title: (document.querySelector("#grid .star.unk") || {}).title || "",
  btn: document.getElementById("bWatch").textContent,
  btnTitle: document.getElementById("bWatch").title,
}));
assert.ok(s1state.unk >= 3, "every card star paints UNKNOWN (" + s1state.unk + ")");
assert.equal(s1state.claiming, 0, "no card claims saved-or-unsaved off the dead read");
assert.match(s1state.title, /watch-later state unknown — the saved-list read failed/);
assert.equal(s1state.btn, "watch later — state unknown", "the button refuses the unsaved claim");
assert.match(s1state.btnTitle, /saved-or-not is unknown, not “unsaved”/);
const shot1 = await shoot(s1, "shell-wl-read-dead-unknown");

/* a click on an unknown star retries the read, refuses the flip, and says so */
await s1.click("#grid .star.unk");
await s1.waitForSelector("#wlFlash.show", { timeout: 8000 });
const s1flash = await s1.$eval("#wlFlash", (n) => n.textContent);
assert.match(s1flash, /★ unavailable — the saved-list read failed · nothing was changed/);

/* the watch-later list itself names the failed read — not "YouTube reconnect required" */
await s1.evaluate(() => { document.querySelectorAll("#chips .btn").forEach((b) => { if (b.textContent === "watch later") b.click(); }); });
await s1.waitForTimeout(4500);
const s1grid = await s1.$eval("#grid", (n) => n.textContent);
assert.match(s1grid, /the watch-later read failed — the saved list is unavailable, not empty · retrying at the next refresh/);
assert.ok(!s1grid.includes("YouTube reconnect required"), "the mislabeled cause is gone from the paint");
const shot1b = await shoot(s1, "shell-wl-list-read-failed-named");
assert.deepEqual(s1errs, [], "no page errors with the saved-list read dead");
await s1.close();

/* ---- scenario 2: the read LANDS, then a write is lost ---- */
const s2 = await context.newPage();
const s2errs = []; s2.on("pageerror", (e) => s2errs.push(String(e).split("\n")[0]));
await s2.route("**/rest/v1/yt_watch_later**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ video_id: "fixvid1" }]) }));
await s2.route("**/functions/v1/yt-act", async (r) => {
  /* settle AFTER the optimistic frame is observable */
  await new Promise((res) => setTimeout(res, 800));
  r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"boom"}' });
});
await s2.goto(origin + "/station-shells/personal-video-v1/?feed=scintilla", { waitUntil: "domcontentloaded" });
await s2.waitForSelector('#grid [data-star="fixvid1"].on', { timeout: 8000 });
const s2landed = await s2.evaluate(() => ({
  on: Array.from(document.querySelectorAll("#grid .star.on")).map((n) => n.dataset.star),
  off: Array.from(document.querySelectorAll("#grid .star:not(.on):not(.unk)")).length,
}));
assert.deepEqual(s2landed.on, ["fixvid1"], "the landed read paints exactly the saved video ★");
assert.ok(s2landed.off >= 2, "the rest claim unsaved from the same landed read");

await s2.click('#grid [data-star="fixvid0"]');
await s2.waitForTimeout(250);
assert.ok(await s2.$('#grid [data-star="fixvid0"].on'), "the flip is optimistic while the write is in flight");
await s2.waitForSelector("#wlFlash.show", { timeout: 8000 });
const s2flash = await s2.$eval("#wlFlash", (n) => n.textContent);
assert.match(s2flash, /★ not saved — the shared watch-later write failed · try again/);
assert.equal(await s2.$('#grid [data-star="fixvid0"].on'), null, "the lost write reverted the flip");
const shot2 = await shoot(s2, "shell-wl-lost-write-said");

/* ---- scenario 3: a lost subscribe says why (same page, same dead writer) ---- */
await s2.evaluate(() => subscribeToChannel({ channel_id: "fixchan", channel: "Fixture Channel", subscription_accounts: [] }));
await s2.waitForSelector("#wlFlash.show", { timeout: 8000 });
const s3flash = await s2.$eval("#wlFlash", (n) => n.textContent);
assert.match(s3flash, /subscribe failed — the shared write did not land · try again/);
assert.deepEqual(s2errs, [], "no page errors across lost write and lost subscribe");
await s2.close();

/* ---- scenario 4: /youtube — the failed dedicated read keeps the feed's own flags ---- */
const s4 = await context.newPage();
const s4errs = []; s4.on("pageerror", (e) => s4errs.push(String(e).split("\n")[0]));
await s4.route("**/rest/v1/youtube_feed**", (r) => r.fulfill({ status: 200, contentType: "application/json",
  body: JSON.stringify([0, 1, 2].map((i) => ({ video_id: "fixvid" + i, title: "Fixture video " + (i + 1),
    channel: "Fixture Channel", channel_id: "fixchan", tickers: "NVDA", duration: "10:0" + i,
    is_short: false, is_sub: false, subscription_accounts: ["scintilla"],
    watch_later: i === 1, /* the SERVER says fixvid1 is saved — landed data */
    thumb_url: null, published_at: new Date(Date.now() - (i + 1) * 3600e3).toISOString() }))) }));
await s4.route("**/rest/v1/yt_watch_later**", (r) => r.abort("connectionrefused"));
await s4.goto(origin + "/youtube/", { waitUntil: "domcontentloaded" });
await s4.waitForTimeout(6000);

const s4state = await s4.evaluate(() => ({
  onCount: document.querySelectorAll(".sc-ytc__star.is-on").length,
  starCount: document.querySelectorAll(".sc-ytc__star").length,
  mark: (document.querySelector('[data-f="WATCH"] .wlbad') || {}).title || "",
}));
assert.equal(s4state.onCount, 1, "the feed's served watch_later flag KEEPS its star — a failed second read never zeroes it");
assert.ok(s4state.starCount >= 3, "the grid painted");
assert.match(s4state.mark, /the saved-list read failed — ★ rides the feed snapshot, not the saved list/,
  "the Watch Later chip wears the persistent marker");
assert.deepEqual(s4errs, [], "the failed read is CAUGHT — before this unit it was an unhandled rejection");
const shot4 = await shoot(s4, "youtube-wl-read-dead-feed-snapshot");
await s4.close();

console.log("wl-truth proof PASSED — shell unknown/lost-write/lost-subscribe + youtube feed-snapshot");

record(`## ${nowStamp()} — the watch-later lane tells the truth: unknown is said, lost writes say why

Command: \`PW_MODULE_DIR=… node browser-proof/proofs/wl-truth.mjs\` (page-level failure injection; asserts inline)

- **The mounted shell with the saved-list read DEAD** (${shot1}): every card star paints the UNKNOWN "?" state ("watch-later state unknown — the saved-list read failed · a click retries the read"), zero cards claim saved-or-unsaved, and the bWatch button reads "watch later — state unknown" — a failed read is never data. A click on an unknown star retries the read and, still failing, flashes "★ unavailable — the saved-list read failed · nothing was changed" without flipping anything. The watch-later list itself paints "the watch-later read failed — the saved list is unavailable, not empty · retrying at the next refresh" (${shot1b}) — the old "YouTube reconnect required" wording, which named YouTube auth as the cause of a failed Supabase table read, is gone from the mounted shells and /pane-video (video-v1 keeps it: retained rollback, exempt by ruling).
- **The read lands, then a write is lost** (${shot2}): the landed read paints exactly the saved video ★; a save click flips optimistically, the 500 settles, the flip REVERTS and the reason is said — "★ not saved — the shared watch-later write failed · try again". The shells used to revert silently; the gesture just vanished.
- **A lost subscribe says why**: "subscribe failed — the shared write did not land · try again" — the catch used to swallow it whole.
- **/youtube keeps the feed's own served flags** (${shot4}): the feed rows arrive with a server-side watch_later column — landed data. With the dedicated saved-list read dead, the flagged video KEEPS its star (it used to be zeroed by an empty page cache), the Watch Later chip wears a persistent "!" marker titled "the saved-list read failed — ★ rides the feed snapshot, not the saved list", and the failure is caught — before this unit it was an unhandled promise rejection.

Zero page errors in every scenario. Rollback: revert the single commit carrying this unit — said states, guards, pins and this proof; no data lane, authority or methodology changed; the rollback shell untouched.
`);

await close();
