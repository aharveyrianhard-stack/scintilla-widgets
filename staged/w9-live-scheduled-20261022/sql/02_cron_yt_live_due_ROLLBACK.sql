-- W9 rollback of 02_cron_yt_live_due.sql: the every-minute job goes. The 5-minute pass (yt-rss-sweep-5m) is untouched.
select cron.unschedule('yt-live-due-1m') where exists (select 1 from cron.job where jobname = 'yt-live-due-1m');
-- Optional: the door's own day count (it is only read by the W9 function, and only for today).
-- delete from public.app_config where key = 'yt_live_due';
