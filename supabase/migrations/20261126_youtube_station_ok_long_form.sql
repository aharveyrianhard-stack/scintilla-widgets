-- 26 Nov 2026 (coordinator). NO SHORT OF ANY LENGTH (2 of 2): station_ok shows a video that could be a Short only on
-- YouTube's word that it is a regular video.
-- Alan, 26 Nov 08:40 ET: "I'm trying to say that I don't want shorts at all ... Brand new short upload, 3 minutes or less,
-- take a few minutes. I don't want any of them."
--
-- 25 Nov's rule held a new upload of 3 minutes or less only until the classifier's first look (15 minutes at most), so a
-- Short that YouTube had not listed yet could show. Now a video of 185 s or less (YouTube-confirmed Shorts run to 181 s), or
-- one with no length that is not a stream, shows only once youtube_videos.long_form = true: YouTube lists it in the
-- channel's long-form list (yt-classify reads UULF). Never confirmed means never shown. A minute or less never shows
-- (Alan, 22 Sep). Members-only and flagged Shorts as on 25 Nov. Same columns as 25 Nov, so every existing read is untouched.
-- Applied after the 30-day UULF backfill, so confirmed regular clips did not blink off.
-- ROLLBACK: the CREATE OR REPLACE VIEW block of 20261125_youtube_station_ok.sql (same columns).
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
      AND NOT (COALESCE(long_form, false) = false
               AND (   (duration_sec IS NOT NULL AND duration_sec <= 185)
                    OR (duration_sec IS NULL AND live_broadcast = 'none'::text
                        AND live_started_at IS NULL AND live_scheduled_at IS NULL)))
    ) AS station_ok
   FROM youtube_videos;
