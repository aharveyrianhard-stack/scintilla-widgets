-- 26 Nov 2026 (coordinator). NO SHORT OF ANY LENGTH (1 of 2): where YouTube's word that a video is a regular one is kept.
-- Alan, 26 Nov 08:40 ET: "I'm trying to say that I don't want shorts at all ... Brand new short upload, 3 minutes or less,
-- take a few minutes. I don't want any of them."
--   youtube_videos.long_form   true = the video is in its channel's long-form list (UULF + channel id without "UC"), i.e.
--                              YouTube itself says it is a regular video. Written by yt-classify for a row that could be a
--                              Short (61-185 s, or no length and not a stream). null = not confirmed.
--   yt_class_log.change        also 'long_form' (age_s = how long after landing YouTube's list confirmed it).
-- ROLLBACK: _archive/backend-fix-20260928/ROLLBACK-station-subscribed-only-20261126.txt (Part 2, step G, after D).
alter table public.youtube_videos add column if not exists long_form boolean;
alter table public.yt_class_log drop constraint if exists yt_class_log_change_check,
  add constraint yt_class_log_change_check check (change in ('short', 'members', 'members_public', 'long_form'));
