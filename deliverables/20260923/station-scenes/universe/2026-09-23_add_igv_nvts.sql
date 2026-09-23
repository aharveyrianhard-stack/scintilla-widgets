-- ADD IGV AND NVTS TO THE TRACKED UNIVERSE — additive, pre-approved class, NOT APPLIED BY ME.
-- Database: the provider's Postgres (MASSIVE_DATABASE_URL), schema massive_stocks.
-- Written 2026-09-23 by the Station scenes lane. The coordinator applies it.
--
-- WHY: Alan's INDEXES layout carries IGV and his EXTRAS layout carries NVTS. The chart API
-- answers both with  state: SYMBOL_NOT_TRACKED, "symbol not in the tracked universe"  (verified
-- live at 2026-09-23, /candles?symbol=IGV&tf=D). Every other symbol in all twelve layouts is
-- served. /universe reports count 364, sha256 ab8f7965…d9d3.
--
-- HOW THE SYSTEM ADDS A NAME (read from the provider's own code, not assumed):
--   1. massive_stocks.instrument_map is the list the acquisition lane walks
--      (services/fmp-lane/manifest365.mjs: "select station_symbol, massive_symbol … where active").
--   2. The bar service's membership test is NOT this table: it is a HEAD against the symbol's
--      acquisition manifest in R2 (services/rest-accel/bar-service.mjs, isKnownSymbol →
--      /<bucket>/<ns>/_manifest/<SYM>.json). A row here without a manifest changes nothing.
--   3. So: this row, then the manifest + a tail pass for the symbol, then the universe count
--      and digest move — and those are PINNED in three places that must move with them:
--        · Station _provider/provider.js  EXPECTED_EQUITY_UNIVERSE = 364
--        · Station _provider/provider.js  ACCEPTED_UNIVERSE_SHA256 = ab8f7965…d9d3
--        · chart API machine env          SETTLED_EXPECTED_COUNT / SETTLED_UNIVERSE_DIGEST
-- Adding a name is additive in the database and NOT additive downstream. That is why this file
-- stops at the row and hands the rest to the coordinator, in order, rather than half-doing it.
--
-- :universe_hash is the digest the new universe will carry. Fill it with the digest the provider
-- publishes AFTER the acquisition pass, or with the current ab8f7965…d9d3 if the coordinator is
-- re-freezing afterwards. Do not invent one.

begin;

insert into massive_stocks.instrument_map
  (station_symbol, massive_symbol, mapping, provider_name, provider_type, primary_exchange,
   active, universe_hash, evidence)
values
  ('IGV',  'IGV',  'direct', 'iShares Expanded Tech-Software Sector ETF', 'etf',    'NASDAQ',
   true, :'universe_hash', 'Alan TradingView layout INDEXES, 2026-09-23; /candles?symbol=IGV&tf=D answered SYMBOL_NOT_TRACKED'),
  ('NVTS', 'NVTS', 'direct', 'Navitas Semiconductor',                     'equity', 'NASDAQ',
   true, :'universe_hash', 'Alan TradingView layout EXTRAS, 2026-09-23; /candles?symbol=NVTS&tf=D answered SYMBOL_NOT_TRACKED')
on conflict (station_symbol) do nothing;

commit;

-- CHECK (read-only):
--   select station_symbol, active, universe_hash from massive_stocks.instrument_map
--    where station_symbol in ('IGV','NVTS');
