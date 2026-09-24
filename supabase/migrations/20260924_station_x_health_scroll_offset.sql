-- Additive (applied 24 Sep by the coordinator): the raw scroll offset the X source sends with its crop,
-- so a runaway offset is visible in the register.
-- Rollback: alter table public.station_x_health drop column if exists scroll_offset;
alter table public.station_x_health add column if not exists scroll_offset double precision;
comment on column public.station_x_health.scroll_offset is 'The fractionalScrollOffset the X source sent with its crop (CSS px). Meant to be under ~4 px; the pane ignores anything larger (24 Sep).';

-- Additive (24 Sep, bridge 0.7.21): the bridge's own counters for its two safety nets.
-- Rollback: alter table public.station_x_health drop column if exists ack_fallbacks, drop column if exists runaway_resets;
alter table public.station_x_health add column if not exists ack_fallbacks integer;
alter table public.station_x_health add column if not exists runaway_resets integer;
