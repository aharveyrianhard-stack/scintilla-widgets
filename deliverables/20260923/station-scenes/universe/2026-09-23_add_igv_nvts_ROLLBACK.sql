-- ROLLBACK for 2026-09-23_add_igv_nvts.sql. Removes exactly the two rows that migration added,
-- and nothing else: no other symbol, no other column, no price row, no R2 object.
-- Safe to run only if the two symbols have NOT since been acquired; if they have, the coordinator
-- should deactivate rather than delete, so the acquired bars keep an owner:
--    update massive_stocks.instrument_map set active = false where station_symbol in ('IGV','NVTS');

begin;

delete from massive_stocks.instrument_map
 where station_symbol in ('IGV', 'NVTS')
   and evidence like 'Alan TradingView layout%2026-09-23%';

commit;

-- CHECK (read-only): the same select should return no rows.
