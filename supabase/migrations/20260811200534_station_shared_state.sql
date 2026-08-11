-- SCINTILLA Station shared state.
--
-- This intentionally holds only deliberate, cross-device Station choices:
-- selected scene, FLEX 3, and explicit ticker overrides. Zoom, pan, display
-- density, and presentation remain device-local.

create table public.station_shared_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  active_scene text not null default 'live' check (
    active_scene in (
      'live',
      'index_now',
      'index_leadership',
      'company_leadership',
      'macro_cross_asset',
      'internals_fast',
      'internals_slow',
      'sectors',
      'themes',
      'focus_2',
      'custom'
    )
  ),
  flex3_ticker text references public.tickers(ticker),
  ticker_overrides jsonb not null default '{}'::jsonb
    check (jsonb_typeof(ticker_overrides) = 'object'),
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);

alter table public.station_shared_state enable row level security;

-- This is not a public/anonymous state channel. An authenticated owner may
-- operate only on its own singleton row; deletion is intentionally omitted.
revoke all on table public.station_shared_state from public;
revoke all on table public.station_shared_state from anon;
grant select, insert, update on table public.station_shared_state to authenticated;

create policy "station shared state is readable by its owner"
  on public.station_shared_state
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "station shared state is insertable by its owner"
  on public.station_shared_state
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "station shared state is updateable by its owner"
  on public.station_shared_state
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
