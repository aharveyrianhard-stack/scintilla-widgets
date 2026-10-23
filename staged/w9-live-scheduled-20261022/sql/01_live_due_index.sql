-- W9 (22 Oct 2026) · the streams that are due, found by one small index.
--
-- THE STREAM TIMES ARE ALREADY STORED. 20260923_youtube_live_streams.sql added them to public.youtube_videos on 23 Sep
-- (live_broadcast = snippet.liveBroadcastContent, live_scheduled_at = scheduledStartTime, live_started_at =
-- actualStartTime, live_ended_at = actualEndTime, live_checked_ts = when the sweep last asked), and the sweep fills them
-- from videos.list part=liveStreamingDetails on every new row. Read on the live table 23 Oct 03:50Z: 77 rows say upcoming
-- or live, every one with its times. Nothing new needs storing; what was missing is asking again at the hour.
--
-- This adds ONE partial index for the two questions W9 asks every minute and every pass: "which streams still say
-- upcoming and are due from 2 minutes ahead to 15 minutes past" (the cron's guard, the ?due=1 door) and "which are near
-- or within 6 hours past their hour" (the 5-minute pass). It holds only the rows that say upcoming (77 tonight).
-- Additive; nothing reads differently. ROLLBACK: 01_live_due_index_ROLLBACK.sql
create index if not exists youtube_videos_upcoming_due_idx
  on public.youtube_videos (live_scheduled_at)
  where live_broadcast = 'upcoming';
