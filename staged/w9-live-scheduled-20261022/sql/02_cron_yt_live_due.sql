-- W9 (22 Oct 2026) · THE PULL AT THE SCHEDULED TIME.
-- Alan: "And at time that live videos are scheduled, do a pull."
--
-- WHAT IT RUNS. Every minute, ONLY when a stream is due: the job's own SQL first asks the table whether any row still
-- says upcoming with a scheduled start from 2 minutes ahead to 15 minutes past (the index of 01_live_due_index.sql).
-- A quiet minute calls nothing and costs nothing. A due minute calls yt-rss-sweep?due=1 (the door in
-- supabase/functions/yt-rss-sweep/index.ts of this folder), which asks YouTube about those streams in ONE videos call
-- (1 unit per 50 ids) and writes their live state, real start and end. Once YouTube calls a stream live it no longer
-- says upcoming, so the job stops asking about it; the 5-minute pass keeps it current while it is on air and after.
-- The windows here (2 and 15 minutes) are DUE_LEAD_MIN and DUE_TAIL_MIN of _shared/yt-live-due.mjs.
--
-- COST. Measured 8-22 Oct: 21.6 scheduled streams a day on the followed lists (41 on the busiest day); of 327 that
-- started, half were on air within 0.5 min of their hour, 76 % within 2, 90 % within 4.8. About three to five asks a
-- stream, shared when two start together: ~90 units a day expected; the door stops itself at 300 a day.
--
-- NEEDS FIRST: the function deployed from this folder (it ignores ?due=1 before that and would run a whole pass):
--     cd staged/w9-live-scheduled-20261022 && supabase functions deploy yt-rss-sweep --project-ref wadinxqplrggagkvrdag
--
-- THE BEARER. No key is written in this file. Like every other function job, it prefers the Vault secret
-- 'scintilla_functions_key' and otherwise copies the bearer the live yt-rss-sweep-5m job already carries, server-side.
--
-- SAFE TO RUN TWICE (unschedule-then-schedule). ROLLBACK (exact): 02_cron_yt_live_due_ROLLBACK.sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $mig$
declare
  bearer text;
  body   text;
begin
  select decrypted_secret into bearer from vault.decrypted_secrets where name = 'scintilla_functions_key' limit 1;
  if bearer is null then
    select substring(command from 'Bearer ([A-Za-z0-9._-]+)') into bearer from cron.job where jobname = 'yt-rss-sweep-5m' limit 1;
  end if;
  if bearer is null then
    raise exception 'yt-live-due cron: no bearer (no vault secret scintilla_functions_key and no yt-rss-sweep-5m job to copy from)';
  end if;

  body := format($cmd$
    select net.http_post(
      url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/yt-rss-sweep?due=1',
      headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'),
      body    := '{}'::jsonb,
      timeout_milliseconds := 30000)
    where exists (
      select 1 from public.youtube_videos
       where live_broadcast = 'upcoming'
         and live_scheduled_at between now() - interval '15 minutes' and now() + interval '2 minutes')
  $cmd$, 'Bearer ' || bearer);

  perform cron.unschedule('yt-live-due-1m') where exists (select 1 from cron.job where jobname = 'yt-live-due-1m');
  perform cron.schedule('yt-live-due-1m', '* * * * *', body);
end
$mig$;
