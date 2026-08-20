do $migration$
declare
  mirror_command text;
begin
  select command into mirror_command from cron.job where jobid = 255;
  if mirror_command is not null then
    mirror_command := replace(
      mirror_command,
      E'\nselect net.http_get(''https://wadinxqplrggagkvrdag.supabase.co/functions/v1/table-to-r2?table=board_rsi'',''{}''::jsonb,''{}''::jsonb,120000); select pg_sleep(4);',
      ''
    );
    perform cron.alter_job(255::bigint, command := mirror_command);
  end if;
end
$migration$;
