-- Retire the two internal-computation relations only after the public Station deployment
-- stopped reading them. Production Chrome proof on 2026-08-20 observed zero network reads to
-- board_rsi or derived_series across the provider-backed equity surfaces. The full pre-cleanup
-- database, Storage, and Edge Function export remains on the mounted memory card.
--
-- Deliberately no CASCADE: an unrecorded dependency must abort this migration atomically.

do $migration$
declare
  mirror_command text;
begin
  if exists (select 1 from cron.job where jobid = 165) then
    perform cron.unschedule(165::bigint);
  end if;

  select command into mirror_command from cron.job where jobid = 255;
  if mirror_command is not null then
    mirror_command := regexp_replace(
      mirror_command,
      E'\\n?select net\\.http_get\\(''https://wadinxqplrggagkvrdag\\.supabase\\.co/functions/v1/table-to-r2\\?table=board_rsi'',''\\{\\}''::jsonb,''\\{\\}''::jsonb,120000\\); select pg_sleep\\(4\\);',
      '',
      'g'
    );
    perform cron.alter_job(255::bigint, command := mirror_command);
  end if;
end
$migration$;

drop view if exists public.derived_latest;
drop view if exists public.data_holes;

drop function if exists public.audit_random_tickers(integer);
drop function if exists public.scin_rebuild_board_rsi();

drop table if exists public.derived_series;
drop table if exists public.board_rsi;
