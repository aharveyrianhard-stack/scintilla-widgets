-- SCINTILLA Station: a live stream belongs to the moment it STARTED.
--
-- YouTube's channel RSS dates a stream from when it was SCHEDULED, which can be
-- a day or more before it goes on air. The grid sorts by that date, so a stream
-- that ran this morning was filed under yesterday and fell off the first page:
-- measured 23 Sep, 242 rows in the feed carry a newer publish time than
-- "A New AI Killer For Stocks…" (published 2026-09-22 18:45Z, actually started
-- 2026-09-23 13:00Z), and the grid's first page is 200 rows.
--
-- The video row now keeps what the YouTube API calls liveStreamingDetails, and
-- the feed exposes ONE ordering time: the stream's actual start when there is
-- one, the scheduled start for something still to come, the publish time for an
-- ordinary upload.
--
-- APPLY ORDER IS SAFE EITHER WAY. Until the sweep fills the new columns every
-- row reads exactly as it does today; the shells fall back to published_at when
-- the columns are absent.

alter table public.youtube_videos
  add column if not exists live_broadcast    text,        -- snippet.liveBroadcastContent: live | upcoming | none
  add column if not exists live_started_at   timestamptz, -- liveStreamingDetails.actualStartTime
  add column if not exists live_ended_at     timestamptz, -- liveStreamingDetails.actualEndTime
  add column if not exists live_scheduled_at timestamptz, -- liveStreamingDetails.scheduledStartTime
  add column if not exists live_checked_ts   bigint;      -- last time the sweep asked YouTube about this row

-- the grid's ordering key
create index if not exists youtube_videos_feed_at_idx
  on public.youtube_videos ((coalesce(live_started_at, live_scheduled_at, published_at)) desc);

-- the rows the sweep re-checks: anything still live, still to come, or not yet timed
create index if not exists youtube_videos_live_watch_idx
  on public.youtube_videos (published_at desc)
  where duration_sec is null or live_broadcast in ('live', 'upcoming');

-- New columns are APPENDED so this stays a replace, not a drop: every existing
-- column keeps its name, type and position, and nothing that reads the feed
-- today has to change on the same deploy.
create or replace view public.youtube_feed
with (security_invoker = true)
as
select
  video_id,
  title,
  channel_title as channel,
  channel_id,
  ticker as tickers,
  case
    -- on air now
    when live_broadcast = 'live' then 'LIVE'::text
    -- still to come: the tile shows the start time instead of a length
    when live_broadcast = 'upcoming' then null::text
    when duration_sec is not null then (duration_sec / 60)::text || ':' || lpad((duration_sec % 60)::text, 2, '0')
    -- a row the new sweep has not reached yet reads exactly as it did before
    when live_broadcast is null then 'LIVE'::text
    else null::text
  end as duration,
  is_short,
  cardinality(subscription_accounts) > 0 as is_sub,
  false as watch_later,
  thumbnail as thumb_url,
  published_at,
  subscription_accounts,
  -- ---- appended: when the stream actually happened -------------------------
  coalesce(live_started_at, live_scheduled_at, published_at) as feed_at,
  case
    when live_broadcast = 'live' then 'live'
    when live_broadcast = 'upcoming' then 'upcoming'
    when live_started_at is not null then 'was_live'
    else 'none'
  end as live_state,
  live_started_at as started_at,
  live_scheduled_at as starts_at,
  live_ended_at as ended_at
from public.youtube_videos;

grant select on public.youtube_feed to anon, authenticated;
