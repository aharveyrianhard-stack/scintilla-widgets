-- SCINTILLA Station: an upcoming stream rides the top of the grid only when it starts within a day.
--
-- 20260923_youtube_live_streams.sql made feed_at the stream's scheduled start for anything still to come,
-- so the first sweep after it (23 Sep 20:10Z) put eight upcoming streams above everything, the first one
-- 313 hours away (a 6 Oct lecture), two more two days out. An upcoming stream now sorts by its start
-- time only inside the next 24 hours; further out it keeps its publish time until it gets close.
-- Applied 23 Sep 2026 ~20:13Z. Undo: re-apply the view from 20260923_youtube_live_streams.sql.

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
    when live_broadcast = 'live' then 'LIVE'::text
    when live_broadcast = 'upcoming' then null::text
    when duration_sec is not null then (duration_sec / 60)::text || ':' || lpad((duration_sec % 60)::text, 2, '0')
    when live_broadcast is null then 'LIVE'::text
    else null::text
  end as duration,
  is_short,
  cardinality(subscription_accounts) > 0 as is_sub,
  false as watch_later,
  thumbnail as thumb_url,
  published_at,
  subscription_accounts,
  case
    when live_broadcast = 'upcoming' and live_scheduled_at > now() + interval '24 hours' then published_at
    else coalesce(live_started_at, live_scheduled_at, published_at)
  end as feed_at,
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
