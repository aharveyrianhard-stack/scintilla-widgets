# YouTube extraction → market sentiment · isolated pipeline

Captions in, contract-shaped JSON out. Raw text lands in the R2 cold bucket and
the isolated staging schema; production analytics later stores only the scores
derived from it.

```
channel watch ──▶ videos.list ──▶ yt-dlp captions ──▶ VTT normalize
                   (1 unit /50)     (no media)          (segments + full text)
                                                             │
                                     contract validate ◀─────┘
                                             │
                        ┌────────────────────┴────────────────────┐
                        ▼                                         ▼
              R2 scintilla-transcripts-cold          media_ingest.media_transcripts_staging
                 raw/vtt/<ch>/<yy>/<mm>/<id>.vtt.gz     reference key + segments + metadata
```

## Run it

```bash
python3 -m youtube_transcripts                 # capability checks + unit suite
python3 -m youtube_transcripts <video-or-url>  # live, dry run — writes nothing
python3 -m youtube_transcripts <video> --store  # live, writes to R2 + staging
```

The unit suite is offline and needs no third-party package: `yt_dlp`, `boto3`
and `psycopg2` are lazy-imported and injectable, so a sandbox with no network
still gets a real pass/fail instead of a skipped run.

## Configuration

All of it comes from the environment. **No credential is read from, or written
to, any file in this repository** — which is what makes it safe that Vercel
serves this directory as text, the same as `supabase/`.

| Variable | Needed for |
| --- | --- |
| `YT_API_KEY` | any live run (metadata) |
| `R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_BUCKET` | `--store` |
| `TRANSCRIPT_STAGING_DSN` | `--store` — must point at the isolated instance |

## Isolation, as a constraint rather than a claim

`StagingWriter` refuses to construct against `public`, `auth`, `storage`,
`realtime`, `cron` and the rest, and against core tables by name
(`youtube_videos`, `app_config`, `spine_events`, …). Getting the target wrong
raises `IsolationViolation` before any SQL is built. The migration reinforces
it from the other side: its own schema, no foreign key into application state,
RLS on, `anon` and `authenticated` revoked, no `delete` grant.

## Rate limiting is aimed at the failure that actually happened

The 2026-08-06 incident on this spine ("DB SATURATION — coldstore export
drain") was not an upstream rate limit. A one-minute cron re-entered a job
whose real runtime was ~37 minutes, so ~37 copies ran at once and exhausted the
connection pool. The recorded must-fix list led with *single-flight lock so
invocations cannot overlap* and *cron interval matched to real invocation
duration*.

So `run_batch` holds a leased `SingleFlight` (a crashed worker's lease expires
rather than wedging the pipeline) and runs against a `Deadline`; work it cannot
reach is returned in `deferred_ids` instead of overrunning into the next tick.
`RateLimiter` and `CircuitBreaker` handle the upstream side: spacing is
enforced between request *starts*, and idle time buys exactly one free call
rather than a catch-up burst.

## Quota

`videos.list` costs 1 unit per call and takes 50 ids, so batching is a 50×
saving and is the default. The uploads playlist is derived from the channel id
(`UC…` → `UU…`) instead of a `channels.list` lookup, and `playlistItems.list`
(1 unit) replaces `search.list` (100). Against the default 10,000/day
allowance, a sweep is bounded by caption fetches, not by quota.

`captions.download` is never used: it costs 200 units *and* requires channel
ownership, which is the reason subtitles come from yt-dlp.

## Contract

`contract.py` is the boundary. Field names and widths mirror the staging table
exactly, and validation runs *before* the R2 upload, so a malformed record
costs one cheap check rather than an orphaned object plus a failed insert.
`tests/media-transcripts-isolation.test.mjs` asserts the SQL and Python status
vocabularies are identical — they are separate processes and would otherwise
drift silently.

## Verified

147 offline unit tests. The Data API path is live-verified. The yt-dlp path is
covered by an injected fake: `www.youtube.com` is blocked by the egress proxy
in CI, so it cannot be exercised live from there.
