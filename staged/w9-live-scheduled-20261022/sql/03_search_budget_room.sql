-- W9 (22 Oct 2026) · THE TICKER SEARCHES GIVE ROOM. Alan: "If you have to reduce the amount of queries of the other
-- videos where we search for tickers to give room for this, do that. No problem."
--
-- youtube-feed (the RADAR ticker searches, every 20 minutes) reads app_config yt_search_budget_units on every run:
-- clamped to 0-9000, no row = 8000, and a search is costed at 101 units (search.list 100 + its videos call 1).
--   before  8000 -> 79 searches a day = 7,979 units; each of the 24 RADAR names 3.29 times a day, a turn every 7.3 h
--   after   7400 -> 73 searches a day = 7,373 units; each name 3.04 times a day, a turn every 7.9 h
-- 606 units a day come free: the due door's own ceiling (300) plus the worst extra re-ask call the 5-minute pass could
-- make (288), with 18 to spare. The planner takes names in RADAR order from a rotating cursor, so the cut is shared
-- evenly; no name stops being searched. The subscriptions are not touched (W9's sweep reads this same row and gives
-- the room to its second way, so a cut here is room there).
-- No deploy: the next youtube-feed run obeys. The value before is kept beside it so the rollback restores it exactly.
-- ROLLBACK (exact): 03_search_budget_room_ROLLBACK.sql
begin;
insert into public.app_config (key, value)
select 'yt_search_budget_units_before_w9',
       coalesce((select value from public.app_config where key = 'yt_search_budget_units'), '(no row)')
on conflict (key) do nothing;
insert into public.app_config (key, value) values ('yt_search_budget_units', '7400')
on conflict (key) do update set value = excluded.value, updated_ts = now();
commit;
