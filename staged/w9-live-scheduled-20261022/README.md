# W9 — a scheduled live stream sits on the feed at its time, and is pulled again at its time

Staged for the coordinator. **Nothing here is deployed or applied.** The Station shells are on this branch
(`station-shells/scintilla-video-v1`, `personal-video-v1`, byte-identical).

## 1. How a live stream enters today, and where it sorts (read 23 Oct 2026, 00:00 ET)

Source read: the deployed functions, downloaded read-only — `yt-rss-sweep` **v13** (byte-identical to
`scintilla-hub` `hub/y6-lists-without-sign-in-20261012` @09ac89d) and `youtube-feed` **v16** — and the live tables
through the public key the shells use.

- **It enters** through the 5-minute sweep (`yt-rss-sweep-5m`). Each followed channel's free RSS feed lists a stream
  as soon as the channel schedules it. The sweep asks YouTube `videos.list part=…liveStreamingDetails` (1 unit per 50
  ids) and stores `live_broadcast` (upcoming/live/none), `live_scheduled_at`, `live_started_at`, `live_ended_at`,
  `live_checked_ts` — **these columns already exist** (`supabase/migrations/20260923_youtube_live_streams.sql`).
- **It is asked again** on every pass only while its *page* is less than **3 days** old (`REFRESH_DAYS = 3`), plus every
  row that says "live". A stream a channel sets up more than three days ahead is never asked again: tonight 77 rows say
  upcoming or live, most of the upcoming ones long past their hour. Two of today's SCINTILLA streams are like that (the
  8:15 am pre-market show, created 17 Oct, last asked 20 Oct; the 9:30 am day-trading stream, created 18 Oct, last asked
  21 Oct): they would never have said LIVE.
- **It sorts** by the view's `feed_at`: the scheduled start while it is within 24 h, its page's creation time when it is
  further out (`20260923_youtube_upcoming_within_a_day.sql`), the real start once it ran. The grid is newest-first, so
  tonight the seven streams of Friday were tiles 1–7, **4:20 pm first, 8:15 am seventh**; at 9:01 am the 8:15 show is
  still tile 7, saying "46m ago", under four streams that have not started, and it sinks under the day's uploads.
- The ticker-search lane (`youtube-feed`, every 20 min) **deletes** any video it finds still to come — by id, whatever
  stored it, so it could take a followed channel's stream off the feed until the sweep finds it again.

## 2. What W9 changes

| Where | What |
|---|---|
| Station shells (this branch) | On air first (unchanged). A stream whose hour has come (2 min before → 1 h after) is at the top even before YouTube calls it live, bright `LIVE at 9:00am`. The rest of today's (New York) streams next, soonest first. Another day's stream is not on the feed until its day. One an hour past its start without a start goes back to its hour and says `set for 8:15am`. An ended stream sits at its real start. No new request. |
| `supabase/functions/yt-rss-sweep` | `?due=1` door: the streams due from 2 min ahead to 15 min past, one videos call, no lock, its own day count (`app_config.yt_live_due`, cap 300). The 5-minute pass re-asks streams near or within 6 h past their hour whatever their page's age, and settles each older stale row once. The second way's guard counts the door and reads the searches' real budget. |
| `supabase/functions/youtube-feed` | deletes only its own (`source = 'search'`) upcoming rows. |
| `sql/01_live_due_index.sql` | one partial index on `live_scheduled_at where live_broadcast = 'upcoming'`. |
| `sql/02_cron_yt_live_due.sql` | `yt-live-due-1m`, every minute, calling the door **only** when the table has a due stream. |
| `sql/03_search_budget_room.sql` | `yt_search_budget_units` 8000 → 7400: 79 → 73 searches a day. |

`w9-functions.patch` is the whole function change against the deployed source (applies cleanly); the folder holds the
complete function set so it can be deployed from here.

## 3. Coordinator order (and the way back)

1. `sql/03_search_budget_room.sql` (no deploy; the next search run obeys) — back: `_ROLLBACK`.
2. `sql/01_live_due_index.sql` — back: `_ROLLBACK`.
3. `cd staged/w9-live-scheduled-20261022 && supabase functions deploy yt-rss-sweep --project-ref wadinxqplrggagkvrdag`
   — back: redeploy v13 from `scintilla-hub` @09ac89d (`_worktrees/y6-lists-without-sign-in-20261012`).
4. `sql/02_cron_yt_live_due.sql` (only after 3: before it, `?due=1` would run a whole pass) — back: `_ROLLBACK`.
5. Optional: `supabase functions deploy youtube-feed …` from this folder — back: v16 (`youtube-feed/index.ts` @09ac89d).
6. The Station: both video shells from this branch — back: both from 52b730d (sha256 `44e209d0…`).
Check after 3–4: `yt_rss_result.live_settle` > 0 on the first pass (the stale rows settle), `units.today.due_calls`
rising only around streams' hours, `app_config.yt_live_due.last.moved` naming streams as they go live.

## 4. The YouTube Data API day (10,000 units, reset at midnight Pacific)

| | before | after W9 |
|---|---|---|
| Ticker searches (`youtube-feed`, 101 units each) | 79 = **7,979** | 73 = **7,373** |
| Sweep's own videos calls (new rows + re-asks) | ~550 measured (1.9 a pass), worst 1,440 | same calls; the due and stale streams ride them (re-ask set 25 ids tonight: 1 call; ~2 while the backlog settles); worst unchanged (`REFRESH_MAX` 200) |
| The due door (new) | 0 | ~90 expected (21.6 streams a day 8–22 Oct × ~4 asks; 76 % start within 2 min of their hour), **cap 300** |
| Second way + lists (Y6) | ≤ 10,000 − 7,979 − own − 2/pass − 50 | ≤ 10,000 − 7,373 − own − door − 2/pass − 50 (606 more room, less the door) |
| Day | ≤ 10,000 by the guard | ≤ 10,000 by the guard |

**Which searches are cut:** none by name. The planner takes the 24 RADAR names in turn from a rotating cursor, so the
six searches a day come off all of them evenly: each name from 3.29 to 3.04 searches a day, a turn every 7.3 h → 7.9 h.
The 606 units cover the door's cap (300) and the worst extra re-ask call a pass could make (288). The subscriptions are
not cut.
