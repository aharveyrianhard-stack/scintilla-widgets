-- SCINTILLA · aggregate media sentiment, for production analytics.
--
-- The egress side of the isolated extraction pipeline. media_ingest holds the
-- transcripts; this holds only what a dashboard needs: a score, a label, an
-- entity tag, a weight, and counts.
--
-- "Never stores raw text blobs" is enforced here, not just asserted. There is
-- no free-text column at all, and every text column carries a length check
-- short enough that a sentence cannot fit. The worker's SanitizedMetricWriter
-- applies the same limit from the other side via a column allowlist, so a
-- transcript is refused twice before it could reach a dashboard query.
--
-- Named media_sentiment_scores rather than anything containing "analytics":
-- the spine already carries a finding that TWO THINGS NAMED ANALYTICS is its
-- own defect, and public.news_sentiment already exists and is unrelated. This
-- table is neither, and does not replace either.
--
-- Deliberately NOT applied by the session that wrote it.

create table if not exists public.media_sentiment_scores (
  video_id varchar(32) not null,
  channel_id varchar(64),
  symbol varchar(32) not null,
  entity_kind varchar(16) not null default 'equity',
  published_at timestamptz,

  -- Polarity, as the contract defines it.
  sentiment_score numeric(4,3) not null default 0
    check (sentiment_score between -1 and 1),
  sentiment_label varchar(16) not null default 'NEUTRAL'
    check (sentiment_label in ('BULLISH', 'BEARISH', 'NEUTRAL')),
  confidence numeric(4,3) not null default 0
    check (confidence between 0 and 1),

  -- View count, engagement velocity and channel weight, blended.
  engagement_weight numeric(6,4) not null default 0
    check (engagement_weight between 0 and 1),
  weighted_score numeric(6,4) not null default 0
    check (weighted_score between -1 and 1),

  mention_count integer not null default 0 check (mention_count >= 0),
  segment_count integer not null default 0 check (segment_count >= 0),
  scorer varchar(32) not null default 'lexicon',
  alert boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (video_id, symbol),

  -- The rule, as a constraint. Nothing resembling prose fits in any of these.
  constraint media_sentiment_no_prose check (
    length(symbol) <= 32
    and length(entity_kind) <= 16
    and length(sentiment_label) <= 16
    and length(scorer) <= 32
    and length(video_id) <= 32
    and (channel_id is null or length(channel_id) <= 64)
  )
);

comment on table public.media_sentiment_scores is
  'Aggregate sentiment per (video, symbol) derived from isolated transcript '
  'staging. Metrics only — there is no text column, by constraint. Raw '
  'captions stay in R2 and media_ingest and never reach this table.';

comment on constraint media_sentiment_no_prose on public.media_sentiment_scores is
  'Enforces the zero-contamination egress rule: production analytics stores '
  'aggregated scores, entity tags and metrics, never raw text.';

create index if not exists idx_media_sentiment_symbol
  on public.media_sentiment_scores (symbol, published_at desc);

create index if not exists idx_media_sentiment_alert
  on public.media_sentiment_scores (published_at desc)
  where alert;

create or replace function public.touch_media_sentiment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists media_sentiment_scores_touch on public.media_sentiment_scores;

create trigger media_sentiment_scores_touch
  before update on public.media_sentiment_scores
  for each row execute function public.touch_media_sentiment_updated_at();

-- Dashboards read; only the worker writes.
alter table public.media_sentiment_scores enable row level security;

revoke all on table public.media_sentiment_scores from public;
revoke all on table public.media_sentiment_scores from anon;
revoke all on table public.media_sentiment_scores from authenticated;

grant select on table public.media_sentiment_scores to anon, authenticated;
grant select, insert, update on table public.media_sentiment_scores to service_role;

drop policy if exists media_sentiment_scores_read on public.media_sentiment_scores;
create policy media_sentiment_scores_read
  on public.media_sentiment_scores
  for select
  to anon, authenticated
  using (true);

-- No delete grant and no delete policy: corrections are new revisions, per the
-- standing rule that nothing is ever deleted.
