import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260811200534_station_shared_state.sql", import.meta.url),
  "utf8"
);

const tableDefinition = migration.slice(
  migration.indexOf("create table public.station_shared_state"),
  migration.indexOf("alter table public.station_shared_state")
);

test("Station shared state has the complete agreed scene vocabulary", () => {
  assert.match(migration, /create table public\.station_shared_state/i);
  assert.match(migration, /owner_id uuid primary key references auth\.users\(id\)/i);
  assert.match(migration, /flex3_ticker text references public\.tickers\(ticker\)/i);
  assert.match(migration, /ticker_overrides jsonb not null default '\{\}'::jsonb/i);
  assert.match(migration, /revision bigint not null default 1/i);

  const required = [
    "live", "index_now", "index_leadership", "company_leadership",
    "macro_cross_asset", "internals_fast", "internals_slow", "sectors",
    "themes", "focus_2", "custom"
  ];
  for (const scene of required) {
    assert.match(tableDefinition, new RegExp(`'${scene}'`));
  }
  assert.doesNotMatch(tableDefinition, /'macro_fast'|'macro_slow'/);
  assert.doesNotMatch(tableDefinition, /\b(?:zoom|pan|viewport|presentation)\b/i);
});

test("Station shared state is authenticated, owner-scoped, and non-destructive", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.station_shared_state from public/i);
  assert.match(migration, /revoke all on table public\.station_shared_state from anon/i);
  assert.match(migration, /grant select, insert, update on table public\.station_shared_state to authenticated/i);
  assert.doesNotMatch(migration, /grant .* to anon/i);
  assert.doesNotMatch(migration, /for delete/i);
  assert.doesNotMatch(migration, /security definer/i);

  for (const operation of ["select", "insert", "update"]) {
    assert.match(
      migration,
      new RegExp(`for ${operation}[\\s\\S]*?to authenticated`, "i"),
      `${operation} is authenticated-only`
    );
  }

  assert.equal(
    (migration.match(/\(\(select auth\.uid\(\)\) = owner_id\)/gi) || []).length,
    4,
    "every RLS predicate is bound to the owner id"
  );
});
