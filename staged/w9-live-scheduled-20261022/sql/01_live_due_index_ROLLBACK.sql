-- W9 rollback of 01_live_due_index.sql: the index goes, nothing else changes.
drop index if exists public.youtube_videos_upcoming_due_idx;
