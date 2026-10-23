-- W9 rollback of 03_search_budget_room.sql: yt_search_budget_units goes back to exactly what it was (or away, if there
-- was no row), and the kept copy is removed. The next youtube-feed run obeys; no deploy.
begin;
update public.app_config a
   set value = b.value, updated_ts = now()
  from public.app_config b
 where a.key = 'yt_search_budget_units'
   and b.key = 'yt_search_budget_units_before_w9'
   and b.value <> '(no row)';
delete from public.app_config
 where key = 'yt_search_budget_units'
   and exists (select 1 from public.app_config where key = 'yt_search_budget_units_before_w9' and value = '(no row)');
delete from public.app_config where key = 'yt_search_budget_units_before_w9';
commit;
