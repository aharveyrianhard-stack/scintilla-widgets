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

/* Parse real GRANT statements rather than grepping the file. A loose
   /grant[^;]*delete/ also matches the prose "No delete grant ...", so it can
   fail on a comment while the SQL is correct — and pass while it is not. */
function grantStatements(sql) {
  return Array.from(sql.matchAll(/^[ \t]*grant\b[^;]*;/gim), (m) =>
    m[0].replace(/\s+/g, " ")
  );
}

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
  const grants = grantStatements(migration);
  assert.ok(grants.length > 0, "the migration must grant something");
  for (const grant of grants) {
    assert.doesNotMatch(grant, /\bdelete\b/i, grant);
  }
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

/* ---- the EGRESS side: what may leave the isolated layer for production ---- */

const egress = fs.readFileSync(
  new URL("../supabase/migrations/20260821140000_media_sentiment_scores.sql", import.meta.url),
  "utf8"
);

const analytics = fs.readFileSync(
  new URL("../_pipeline/youtube_transcripts/analytics.py", import.meta.url),
  "utf8"
);

const egressTable = egress.slice(
  egress.indexOf("create table if not exists public.media_sentiment_scores"),
  egress.indexOf("comment on table public.media_sentiment_scores")
);

test("Production analytics has no column that could hold a transcript", () => {
  for (const banned of ["full_transcript_text", "transcript", "segments", "raw_vtt", "body"]) {
    assert.doesNotMatch(
      egressTable,
      new RegExp(`\\b${banned}\\b`, "i"),
      `${banned} must not exist on the metrics table`
    );
  }
  /* No unbounded text/varchar either — the widest is 64. */
  assert.doesNotMatch(egressTable, /^\s*\w+\s+text\b/im, "no bare text column");
  const widths = Array.from(egressTable.matchAll(/varchar\((\d+)\)/g), (m) => Number(m[1]));
  assert.ok(widths.length > 0);
  assert.ok(Math.max(...widths) <= 64, "no varchar wide enough for prose");
});

test("The no-prose rule is a database constraint, not a comment", () => {
  assert.match(egressTable, /constraint media_sentiment_no_prose check \(/i);
  assert.match(egress, /comment on constraint media_sentiment_no_prose/i);
});

test("Scores and weights are range-checked in the database", () => {
  assert.match(egressTable, /sentiment_score numeric\(4,3\)[\s\S]*?check \(sentiment_score between -1 and 1\)/i);
  assert.match(egressTable, /confidence numeric\(4,3\)[\s\S]*?check \(confidence between 0 and 1\)/i);
  assert.match(egressTable, /engagement_weight[\s\S]*?check \(engagement_weight between 0 and 1\)/i);
});

test("Dashboards read the metrics; only the worker writes them", () => {
  assert.match(egress, /enable row level security/i);
  assert.match(egress, /grant select on table public\.media_sentiment_scores to anon, authenticated/i);
  assert.match(egress, /grant select, insert, update on table public\.media_sentiment_scores to service_role/i);
  const grants = grantStatements(egress);
  assert.ok(grants.length > 0);
  for (const grant of grants) {
    assert.doesNotMatch(grant, /\bdelete\b/i, grant);
    if (/\bto\b[^;]*\banon\b/i.test(grant)) {
      for (const write of ["insert", "update", "truncate"]) {
        assert.doesNotMatch(
          grant, new RegExp(`\\b${write}\\b`, "i"),
          `anon must not be granted ${write}: ${grant}`
        );
      }
    }
  }
});

test("The sentiment label vocabulary is identical in SQL and in Python", () => {
  const sqlLabels = egressTable
    .slice(egressTable.indexOf("sentiment_label in ("))
    .match(/'[A-Z]+'/g)
    .map((s) => s.replaceAll("'", ""));
  const sentiment = fs.readFileSync(
    new URL("../_pipeline/youtube_transcripts/sentiment.py", import.meta.url),
    "utf8"
  );
  for (const label of sqlLabels) {
    assert.match(
      sentiment,
      new RegExp(`"${label}"`),
      `label_for() must be able to emit ${label}`
    );
  }
  assert.deepEqual([...sqlLabels].sort(), ["BEARISH", "BULLISH", "NEUTRAL"]);
});

test("The worker enforces the same egress rule by allowlist", () => {
  assert.match(analytics, /ALLOWED_COLUMNS = \(/);
  assert.match(analytics, /MAX_SCALAR_CHARS = 64/);
  assert.match(analytics, /class SanitizationError\(ValueError\)/);
  /* Allowlist, not blacklist: an unknown column is refused outright. */
  assert.match(analytics, /refusing columns not on the metric allowlist/);
  for (const banned of ["full_transcript_text", "segments", "raw_vtt_storage_key"]) {
    assert.doesNotMatch(
      analytics.slice(
        analytics.indexOf("ALLOWED_COLUMNS = ("),
        analytics.indexOf("MAX_SCALAR_CHARS")
      ),
      new RegExp(banned),
      `${banned} must not be writable to production analytics`
    );
  }
});

test("Every allowlisted column really exists on the metrics table", () => {
  const allowlist = analytics
    .slice(analytics.indexOf("ALLOWED_COLUMNS = ("), analytics.indexOf(")\n\n#: Long enough"))
    .match(/"(\w+)"/g)
    .map((s) => s.replaceAll('"', ""));
  assert.ok(allowlist.length >= 10);
  for (const column of allowlist) {
    assert.match(
      egressTable,
      new RegExp(`\\b${column}\\b`),
      `${column} is on the worker's allowlist but not in the table`
    );
  }
});

test("Ticker collisions with ordinary English are named, not discovered later", () => {
  const entities = fs.readFileSync(
    new URL("../_pipeline/youtube_transcripts/entities.py", import.meta.url),
    "utf8"
  );
  const collisions = entities.slice(
    entities.indexOf("COLLIDING_TICKERS = frozenset({"),
    entities.indexOf("# Context that rescues")
  );
  /* All of these are really in public.tickers and are also English words. */
  for (const symbol of ["LOW", "NOW", "BE", "SO", "PM", "DE", "MO", "ES", "AU", "CAT", "MA", "ED"]) {
    assert.match(collisions, new RegExp(`"${symbol}"`), `${symbol} must be guarded`);
  }
});
