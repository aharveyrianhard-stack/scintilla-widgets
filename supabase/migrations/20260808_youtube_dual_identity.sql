-- SCINTILLA Station: distinguish the two intentional YouTube identities.
-- Existing subscription rows came from the configured SCINTILLA channel and
-- are backfilled accordingly. A text array lets one video belong to both
-- accounts without duplicating the canonical video row.

alter table public.youtube_videos
  add column if not exists subscription_accounts text[] not null default '{}'::text[];

update public.youtube_videos
set subscription_accounts = array['scintilla']::text[]
where source = 'subscription'
  and cardinality(subscription_accounts) = 0;

create index if not exists youtube_videos_subscription_accounts_idx
  on public.youtube_videos using gin (subscription_accounts);

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
    when duration_sec is null then 'LIVE'::text
    else (duration_sec / 60)::text || ':' || lpad((duration_sec % 60)::text, 2, '0')
  end as duration,
  is_short,
  cardinality(subscription_accounts) > 0 as is_sub,
  false as watch_later,
  thumbnail as thumb_url,
  published_at,
  subscription_accounts
from public.youtube_videos;

grant select on public.youtube_feed to anon, authenticated;

