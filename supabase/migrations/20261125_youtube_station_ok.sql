-- 25 Nov 2026 (coordinator). NO SHORTS AND NO MEMBERS-ONLY VIDEOS ON THE STATION.
-- Alan, 25 Nov 23:00 ET: "the station, can we get the YouTube shorts off of it? No more shorts. And then there's videos
-- that are members only content. Let's avoid that because then it stops playing because it's members only content."
--
-- MEASURED BEFORE (25 Nov 23:15 ET, the newest 200 rows of the SCINTILLA list, what the Station pane loads):
--   GRID (MacBook, TV): 39 flagged Shorts + 9 unflagged under a minute + 5 unflagged 1-3 min Shorts; 5 members-only.
--   VIDEOS (iMac):      the 5 unflagged 1-3 min Shorts and the 5 members-only videos still showed.
--   Why: the collectors' Shorts test (a HEAD of youtube.com/shorts/<id> from the cloud) has missed about 1 Short in 6
--   since 2 Nov, and nothing marked members-only videos at all. YouTube's player raises NO error on a members-only
--   video (it sits at "not started"), so the pane's skip-unavailable never fired and playback stopped.
--
-- THIS CHANGE (additive: three columns, one log table, two columns appended to the view; nothing removed or rewritten):
--   youtube_videos.members_only      true = YouTube lists the video among the channel's members-only videos (UUMO list)
--   youtube_videos.class_checked_at  when the classifier (edge function yt-classify) last looked at the row
--   youtube_videos.class_tries       0 = not looked at yet; 1-4 = looked at and not in either list; 9 = found in a list
--   yt_class_log                     every flag the classifier changes (the undo list and the lag measurement)
--   youtube_feed.members_only        the column above, false when unknown
--   youtube_feed.station_ok          what the Station shows: not a Short (YouTube's list, the old flag, or a minute or
--                                    less, Alan's 22 Sep rule), not members-only, and not a brand-new 3-minutes-or-less
--                                    upload the classifier has not looked at yet (held at most 15 minutes, so a stopped
--                                    classifier never empties the Station).
--
-- ROLLBACK (written before applying; also in _archive/backend-fix-20260928/ROLLBACK-station-no-shorts-members-20261125.txt):
--   select cron.unschedule('yt-classify-1m'); select cron.unschedule('yt-classify-members-daily');
--   update public.youtube_videos v set is_short = false from public.yt_class_log l
--     where l.video_id = v.video_id and l.change = 'short';            -- only the flags this classifier turned on
--   drop view public.youtube_feed;  create view public.youtube_feed as <the definition kept in the rollback note>;
--   grant select, references, trigger on public.youtube_feed to anon, authenticated;  grant select on public.youtube_feed to chatbot_ro;
--   grant all on public.youtube_feed to service_role;
--   alter table public.youtube_videos drop column members_only, drop column class_checked_at, drop column class_tries;
--   drop table public.yt_class_log;

alter table public.youtube_videos
  add column if not exists members_only boolean,
  add column if not exists class_checked_at timestamptz,
  add column if not exists class_tries smallint not null default 0;

create table if not exists public.yt_class_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  video_id   text not null,
  channel_id text,
  change     text not null check (change in ('short', 'members', 'members_public')),
  age_s      integer          -- seconds from the row landing in the table to this change
);
alter table public.yt_class_log enable row level security;   -- no policies: the service role only
create index if not exists yt_class_log_at on public.yt_class_log (at desc);

create or replace view public.youtube_feed as
 SELECT video_id,
    title,
    channel_title AS channel,
    channel_id,
    ticker AS tickers,
        CASE
            WHEN live_broadcast = 'live'::text THEN 'LIVE'::text
            WHEN live_broadcast = 'upcoming'::text THEN NULL::text
            WHEN duration_sec IS NOT NULL THEN (((duration_sec / 60)::text) || ':'::text) || lpad((duration_sec % 60)::text, 2, '0'::text)
            WHEN live_broadcast IS NULL THEN 'LIVE'::text
            ELSE NULL::text
        END AS duration,
    is_short,
    cardinality(array_remove(subscription_accounts, 'networks'::text)) > 0 AS is_sub,
    false AS watch_later,
    thumbnail AS thumb_url,
    published_at,
    subscription_accounts,
        CASE
            WHEN live_broadcast = 'upcoming'::text AND live_scheduled_at > (now() + '24:00:00'::interval) THEN published_at
            ELSE COALESCE(live_started_at, live_scheduled_at, published_at)
        END AS feed_at,
        CASE
            WHEN live_broadcast = 'live'::text THEN 'live'::text
            WHEN live_broadcast = 'upcoming'::text THEN 'upcoming'::text
            WHEN live_started_at IS NOT NULL THEN 'was_live'::text
            ELSE 'none'::text
        END AS live_state,
    live_started_at AS started_at,
    live_scheduled_at AS starts_at,
    live_ended_at AS ended_at,
    COALESCE(members_only, false) AS members_only,
    (     COALESCE(is_short, false) = false
      AND COALESCE(members_only, false) = false
      AND NOT (duration_sec IS NOT NULL AND duration_sec <= 60)
      AND NOT (duration_sec IS NOT NULL AND duration_sec <= 180 AND class_tries = 0
               AND COALESCE(updated_ts, 0) > (extract(epoch from now()) - 900)::bigint)
    ) AS station_ok
   FROM youtube_videos;
