-- SCINTILLA · isolated YouTube transcript ingestion.
--
-- Heavy caption payloads are kept out of the application's way by construction,
-- not by convention:
--
--   * They live in their own schema, `media_ingest`, never in `public`.
--   * The table carries NO foreign key to any core table. A transcript row can
--     reference a video that public.youtube_videos has never heard of, and
--     dropping every row here cannot cascade into application state.
--   * Only service_role reaches it. anon and authenticated are revoked, so no
--     browser session can read a raw transcript blob or widen a query plan
--     against it.
--   * Raw VTT itself is NOT stored here. The bucket holds it; this table holds
--     a reference key. Production analytics later stores only scores derived
--     from these rows, never the text.
--
-- Deliberately NOT applied to scintilla-live by the session that wrote it.
-- Apply against the dedicated ingestion instance. If it is ever applied to a
-- shared cluster, the schema separation above is what keeps the blast radius
-- to `media_ingest`.

create schema if not exists media_ingest;

comment on schema media_ingest is
  'Isolated ingestion layer for heavy media extraction (YouTube captions). '
  'No foreign keys into application schemas. service_role only. '
  'Raw text lives in R2 (scintilla-transcripts-cold); rows here reference it.';

create table if not exists media_ingest.media_transcripts_staging (
  id uuid primary key default gen_random_uuid(),
  video_id varchar(32) not null unique,
  channel_id varchar(64) not null,
  title text not null,
  published_at timestamptz not null,
  -- Reference to the R2 object; the blob is never inlined here.
  raw_vtt_storage_key varchar(255) not null,
  full_transcript_text text not null,
  -- Normalized timestamp blocks: [{start,end,start_sec,end_sec,text}, ...]
  segments jsonb not null check (jsonb_typeof(segments) = 'array'),
  -- View counts, likes, language tags, engagement weighting inputs.
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  processing_status varchar(32) not null default 'PENDING_ANALYSIS' check (
    processing_status in (
      'PENDING_ANALYSIS',
      'IN_ANALYSIS',
      'ANALYZED',
      'FAILED',
      'SKIPPED_NO_CAPTIONS'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The status vocabulary is a constraint rather than prose because the
-- extraction worker and the sentiment worker are separate processes that would
-- otherwise drift apart silently.

create index if not exists idx_transcripts_video_channel
  on media_ingest.media_transcripts_staging (video_id, channel_id);

create index if not exists idx_transcripts_status
  on media_ingest.media_transcripts_staging (processing_status);

-- The sentiment stage claims work by status and age; without this it degrades
-- to a sequential scan once the table is large, which is precisely the shape
-- that saturated the pool during the 2026-08-06 coldstore drain.
create index if not exists idx_transcripts_pending_queue
  on media_ingest.media_transcripts_staging (processing_status, published_at desc)
  where processing_status = 'PENDING_ANALYSIS';

create or replace function media_ingest.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists media_transcripts_staging_touch
  on media_ingest.media_transcripts_staging;

create trigger media_transcripts_staging_touch
  before update on media_ingest.media_transcripts_staging
  for each row execute function media_ingest.touch_updated_at();

-- Access: extraction and sentiment workers only.
alter table media_ingest.media_transcripts_staging enable row level security;

revoke all on schema media_ingest from public;
revoke all on schema media_ingest from anon;
revoke all on schema media_ingest from authenticated;
revoke all on table media_ingest.media_transcripts_staging from public;
revoke all on table media_ingest.media_transcripts_staging from anon;
revoke all on table media_ingest.media_transcripts_staging from authenticated;

grant usage on schema media_ingest to service_role;
grant select, insert, update on table media_ingest.media_transcripts_staging
  to service_role;

-- No delete grant: corrections are new revisions of a row, matching the
-- standing rule that nothing is ever deleted.

comment on table media_ingest.media_transcripts_staging is
  'Isolated staging for extracted YouTube captions. No FK to core tables. '
  'raw_vtt_storage_key references the R2 cold bucket; production analytics '
  'stores only aggregate sentiment derived from these rows, never this text.';

comment on column media_ingest.media_transcripts_staging.raw_vtt_storage_key is
  'R2 object key in scintilla-transcripts-cold, e.g. '
  'raw/vtt/<channel_id>/<yyyy>/<mm>/<video_id>.vtt.gz';

comment on column media_ingest.media_transcripts_staging.segments is
  'Array of {start,end,start_sec,end_sec,text}. start/end are WebVTT strings; '
  'the _sec pair is the numeric form segment-level scoring anchors on.';
