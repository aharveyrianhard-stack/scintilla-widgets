/* 26 Nov 2026 (coordinator). Alan: "I'm trying to say that I don't want shorts at all ... Brand new short upload, 3 minutes
   or less, take a few minutes. I don't want any of them. And by the way, I unsubscribed from a few channels ... whatever I
   know I'm not subscribed anymore goes away, because like I don't know, it's too much. There's too many of them".
   Pinned here: (1) a video that could be a Short shows only on YouTube's own word that it is a regular video (the channel's
   long-form list, UULF); (2) the SCINTILLA list is his YouTube subscriptions and nothing else (the X-follows bridge parked,
   its channels' rows untagged, an undo list kept). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const classifier = read("supabase/functions/yt-classify/index.ts");
const view = read("supabase/migrations/20261126_youtube_station_ok_long_form.sql");
const column = read("supabase/migrations/20261126_youtube_long_form.sql");
const subs = read("supabase/migrations/20261126_station_subscribed_only.sql");

function fnText(src, name) {
  const start = src.search(new RegExp("(export )?(async )?function " + name + "\\("));
  assert.notEqual(start, -1, name + " must exist");
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) break; }
  return src.slice(start, i + 1);
}

test("a video that could be a Short waits for YouTube's long-form list: 61-185 s, or no length and not a stream", () => {
  const box = vm.createContext({});
  vm.runInContext("const MINUTE_S = 60, SHORT_MAX_S = 185;\n" +
    fnText(classifier, "waitsForWord").replace("export ", "").replace("(r: Row)", "(r)") + "\nglobalThis.w = waitsForWord;", box);
  const row = (o) => ({ is_short: null, members_only: null, long_form: null, duration_sec: 120, live_broadcast: "none",
    live_started_at: null, live_scheduled_at: null, ...o });
  assert.equal(box.w(row({})), true, "a 2-minute upload waits");
  assert.equal(box.w(row({ duration_sec: 181 })), true, "YouTube-confirmed Shorts run to 181 s");
  assert.equal(box.w(row({ duration_sec: 185 })), true);
  assert.equal(box.w(row({ duration_sec: 186 })), false, "longer than any Short: shown as before");
  assert.equal(box.w(row({ duration_sec: 45 })), false, "a minute or less never shows anyway, no list read for it");
  assert.equal(box.w(row({ long_form: true })), false, "confirmed regular: done");
  assert.equal(box.w(row({ is_short: true })), false, "a Short: done");
  assert.equal(box.w(row({ members_only: true })), false, "members-only: done");
  assert.equal(box.w(row({ duration_sec: null })), true, "no length and not a stream: waits");
  assert.equal(box.w(row({ duration_sec: null, live_broadcast: "upcoming" })), false, "a scheduled stream is not held");
  assert.equal(box.w(row({ duration_sec: null, live_started_at: "2026-11-26T14:00:00Z" })), false, "a stream that ran");
});

test("the classifier reads UULF only for a waiting row, looks 8 times, and only ever confirms", () => {
  assert.match(classifier, /prefix: "UUSH" \| "UUMO" \| "UULF"/);
  assert.match(classifier, /const WAIT_DUE_S = \[0, 120, 300, 600, 1200, 3600, 10800, 43200\];/);
  assert.match(classifier, /const WAIT_DONE = 8, SHORT_MAX_S = 185, MINUTE_S = 60;/);
  assert.match(classifier, /const lf = waiting\.length \? await readList\(key, "UULF", ch, lfUntil, opts\.backfillDays \? 20 : 2\) : null;/,
    "the long-form list is read only for a channel with a waiting row");
  assert.match(classifier, /if \(waits && lf && lf\.ok && lf\.ids\.has\(r\.video_id\)\) \{/);
  assert.match(classifier, /change: "long_form"/, "every confirmation is written down with its age");
  assert.match(classifier, /patch\(\[\.\.\.longIds\], \{ long_form: true, class_tries: FOUND, class_checked_at: at \}\)/);
  assert.doesNotMatch(classifier, /long_form: false/, "never takes a confirmation back");
  assert.match(classifier, /if \(waits && lf && lf\.truncated && lf\.oldest != null && Date\.parse\(r\.published_at \|\| ""\) < lf\.oldest\) continue;/,
    "a row older than what was read is not a no");
  assert.match(classifier, /\(waitsForWord\(r\) \? WAIT_DUE_S : DUE_AFTER_S\)\[r\.class_tries\]/);
  assert.match(column, /add column if not exists long_form boolean/);
  assert.match(column, /check \(change in \('short', 'members', 'members_public', 'long_form'\)\)/);
});

test("station_ok: a video of 185 s or less shows only once YouTube lists it as a regular video", () => {
  assert.match(view, /AND NOT \(duration_sec IS NOT NULL AND duration_sec <= 60\)/, "a minute or less never shows (22 Sep)");
  assert.match(view, /AND NOT \(COALESCE\(long_form, false\) = false\s+AND \(\s+\(duration_sec IS NOT NULL AND duration_sec <= 185\)/);
  assert.match(view, /OR \(duration_sec IS NULL AND live_broadcast = 'none'::text\s+AND live_started_at IS NULL AND live_scheduled_at IS NULL\)/);
  assert.doesNotMatch(view, /class_tries = 0/, "the 15-minute hold is gone: a stopped classifier never lets a Short through");
  assert.match(view, /COALESCE\(is_short, false\) = false\s+AND COALESCE\(members_only, false\) = false/);
  assert.match(view, /\) AS station_ok\s+FROM youtube_videos;\s*$/, "the same columns as 25 Nov, station_ok last");
});

test("SCINTILLA = his YouTube subscriptions: the X-follows bridge parked, its channels untagged, the undo list first", () => {
  assert.match(subs, /jsonb_build_object\('ids', '\[\]'::jsonb, 'parked_ids', value::jsonb->'ids'/, "both collectors read only ids");
  assert.match(subs, /only_b as \(select id from b where id not in \(select id from s\)\)/, "a bridged channel he subscribes to stays");
  assert.ok(subs.indexOf("insert into public.yt_bridge_untag_20261126") < subs.indexOf("array_remove(v.subscription_accounts, 'scintilla')"),
    "the undo list is written before any tag comes off");
  assert.match(subs, /array_remove\(v\.subscription_accounts, 'scintilla'\)/, "only the SCINTILLA tag; nothing deleted");
  assert.doesNotMatch(subs, /delete from public\.youtube_videos/i);
});
