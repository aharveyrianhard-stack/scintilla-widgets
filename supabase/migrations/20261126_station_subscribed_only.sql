-- 26 Nov 2026 (coordinator). THE STATION'S SCINTILLA LIST = THE CHANNELS ALAN SUBSCRIBES TO ON YOUTUBE, NOTHING ELSE.
-- Alan, 26 Nov 08:40 ET: "I unsubscribed from a few channels. I don't know if we can refresh it so that like whatever I know
-- I'm not subscribed anymore goes away, because like I don't know, it's too much. There's too many of them".
--
-- MEASURED BEFORE (26 Nov 09:05 ET): his SCINTILLA subscriptions read from YouTube = the saved list = 60 channels (the two he
-- dropped on 25 Nov left at 23:20 ET, the hourly list read works). The list ALSO carried 25 channels he does not subscribe to:
-- the X-follows bridge (app_config yt_bridge_channels, 5-6 Oct: "subscribe to all of those, have the feed"), which rides with
-- SCINTILLA in yt-rss-sweep (withBridge) and yt-push, and keeps a bridged channel on the list even after he unsubscribes from
-- it on YouTube (a riding channel never "leaves"). 1,672 stored rows carried 'scintilla' only because of it. Station-visible
-- SCINTILLA rows of the last 14 days: 773 from 68 channels, 115 of them from those 25 channels.
-- AFTER (08:53 ET): 658 from 52 channels; no row of a channel outside his YouTube list carries 'scintilla'.
--
-- The bridge row is kept, its ids parked under parked_ids (both collectors read only "ids"); the stored rows lose the tag the
-- way the sweep untags a channel he unfollows (untagChannels). yt_bridge_untag_20261126 is the undo list.
-- ROLLBACK: _archive/backend-fix-20260928/ROLLBACK-station-subscribed-only-20261126.txt (Part 1: steps A, B, C).
create table if not exists public.yt_bridge_untag_20261126 (
  video_id text primary key,
  channel_id text,
  subscription_accounts text[],
  at timestamptz not null default now()
);
alter table public.yt_bridge_untag_20261126 enable row level security;   -- no policies: the service role only

update public.app_config
   set value = ((value::jsonb - 'ids') || jsonb_build_object('ids', '[]'::jsonb, 'parked_ids', value::jsonb->'ids',
                 'parked_at', now(), 'parked_why', 'Alan 26 Nov: only the channels he subscribes to on YouTube'))::text
 where key = 'yt_bridge_channels' and not (value::jsonb ? 'parked_ids');

with s as (select jsonb_array_elements_text(value::jsonb->'ids') id from public.app_config where key = 'yt_sub_channels_scintilla'),
     b as (select jsonb_array_elements_text(value::jsonb->'parked_ids') id from public.app_config where key = 'yt_bridge_channels'),
     only_b as (select id from b where id not in (select id from s))
insert into public.yt_bridge_untag_20261126 (video_id, channel_id, subscription_accounts)
select v.video_id, v.channel_id, v.subscription_accounts
  from public.youtube_videos v
 where v.channel_id in (select id from only_b) and 'scintilla' = any(v.subscription_accounts)
on conflict (video_id) do nothing;

update public.youtube_videos v
   set subscription_accounts = array_remove(v.subscription_accounts, 'scintilla')
 where v.video_id in (select video_id from public.yt_bridge_untag_20261126)
   and 'scintilla' = any(v.subscription_accounts);
