import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL(
    "../supabase/migrations/20260821120000_media_transcripts_staging_isolated.sql",
    import.meta.url
  ),
  "utf8"
);

const contract = fs.readFileSync(
  new URL("../_pipeline/youtube_transcripts/contract.py", import.meta.url),
  "utf8"
);

const storage = fs.readFileSync(
  new URL("../_pipeline/youtube_transcripts/storage.py", import.meta.url),
  "utf8"
);

const tableDefinition = migration.slice(
  migration.indexOf("create table if not exists media_ingest.media_transcripts_staging"),
  migration.indexOf("create index if not exists idx_transcripts_video_channel")
);

test("Extraction staging lives in its own schema, never in public", () => {
  assert.match(migration, /create schema if not exists media_ingest/i);
  assert.match(
    migration,
    /create table if not exists media_ingest\.media_transcripts_staging/i
  );
  assert.doesNotMatch(
    migration,
    /create table (if not exists )?public\./i,
    "extraction must not create anything in the application schema"
  );
});

test("Staging carries no foreign key into application state", () => {
  assert.doesNotMatch(
    tableDefinition,
    /references/i,
    "a foreign key would couple ingestion to core tables and let a cascade cross the boundary"
  );
});

test("Staging is unreachable from the browser", () => {
  assert.match(migration, /enable row level security/i);
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on table media_ingest\\.media_transcripts_staging from ${role}`,
        "i"
      ),
      `${role} must not reach raw transcript rows`
    );
    assert.match(
      migration,
      new RegExp(`revoke all on schema media_ingest from ${role}`, "i")
    );
  }
  assert.match(
    migration,
    /grant select, insert, update on table media_ingest\.media_transcripts_staging\s+to service_role/i
  );
  assert.doesNotMatch(migration, /grant .* to anon/i);
  assert.doesNotMatch(migration, /grant .* to authenticated/i);
});

test("Corrections are revisions, so nothing grants delete", () => {
  assert.doesNotMatch(migration, /grant[^;]*\bdelete\b/i);
});

test("The staging row references the R2 object rather than duplicating it", () => {
  assert.match(tableDefinition, /raw_vtt_storage_key varchar\(255\) not null/i);
  assert.match(
    migration,
    /raw\/vtt\/<channel_id>\/<yyyy>\/<mm>\/<video_id>\.vtt\.gz/,
    "the key layout the worker builds must be documented on the column"
  );
});

test("Declared column widths match what the extractor validates against", () => {
  assert.match(tableDefinition, /video_id varchar\(32\) not null unique/i);
  assert.match(tableDefinition, /channel_id varchar\(64\) not null/i);

  assert.match(contract, /_MAX_VIDEO_ID = 32/);
  assert.match(contract, /_MAX_CHANNEL_ID = 64/);
  assert.match(contract, /_MAX_STORAGE_KEY = 255/);
});

test("The processing-status vocabulary is identical in SQL and in Python", () => {
  const sqlStatuses = tableDefinition
    .slice(
      tableDefinition.indexOf("processing_status in ("),
      tableDefinition.indexOf("created_at")
    )
    .match(/'[A-Z_]+'/g)
    .map((s) => s.replaceAll("'", ""));

  const pythonStatuses = contract
    .slice(
      contract.indexOf("PROCESSING_STATUSES = ("),
      contract.indexOf("# Column widths")
    )
    .match(/"[A-Z_]+"/g)
    .map((s) => s.replaceAll('"', ""));

  assert.deepEqual(
    [...sqlStatuses].sort(),
    [...pythonStatuses].sort(),
    "the two workers are separate processes; a drifting status vocabulary fails silently"
  );
  assert.ok(sqlStatuses.includes("PENDING_ANALYSIS"));
  assert.ok(sqlStatuses.includes("SKIPPED_NO_CAPTIONS"));
});

test("JSONB columns are shape-checked in the database", () => {
  assert.match(tableDefinition, /segments jsonb not null check \(jsonb_typeof\(segments\) = 'array'\)/i);
  assert.match(tableDefinition, /jsonb_typeof\(metadata\) = 'object'/i);
});

test("The queue the sentiment stage reads is indexed", () => {
  assert.match(migration, /idx_transcripts_video_channel[\s\S]*?\(video_id, channel_id\)/i);
  assert.match(migration, /idx_transcripts_status[\s\S]*?\(processing_status\)/i);
  assert.match(
    migration,
    /idx_transcripts_pending_queue[\s\S]*?where processing_status = 'PENDING_ANALYSIS'/i,
    "claiming pending work must not degrade to a sequential scan"
  );
});

test("updated_at is maintained by the database, not by the caller", () => {
  assert.match(migration, /create trigger media_transcripts_staging_touch/i);
  assert.match(migration, /before update on media_ingest\.media_transcripts_staging/i);
});

test("The worker refuses production schemas and core tables at runtime", () => {
  for (const schema of ["public", "auth", "storage", "realtime", "cron"]) {
    assert.match(
      storage,
      new RegExp(`"${schema}"`),
      `${schema} must be on the refused list, not merely discouraged in prose`
    );
  }
  for (const table of ["youtube_videos", "app_config", "spine_events"]) {
    assert.match(storage, new RegExp(`"${table}"`));
  }
  assert.match(storage, /class IsolationViolation\(RuntimeError\)/);
  assert.match(storage, /raise IsolationViolation\(/);
});
