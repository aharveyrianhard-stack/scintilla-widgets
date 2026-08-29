"""CLI entry point.

    python -m youtube_transcripts                 # capability checks + unit suite
    python -m youtube_transcripts --self-test     # same, explicitly
    python -m youtube_transcripts <video-or-url>  # live extraction, dry run
    python -m youtube_transcripts <video> --store # live extraction, writes

A live run needs YT_API_KEY. Writing additionally needs the R2 and staging
credentials listed in _pipeline/README.md. Nothing is written without --store,
so an operator can inspect what a run would produce before it produces it.
"""

import os
import sys


def _live(target: str, store: bool) -> int:
    from .metadata import YouTubeDataAPI
    from .pipeline import TranscriptPipeline
    from .storage import MemoryColdStore, R2ColdStore, StagingWriter

    api_key = os.environ.get("YT_API_KEY", "").strip()
    if not api_key:
        print("YT_API_KEY is not set; a live run cannot fetch metadata.")
        return 2

    video_id = target.strip()
    for marker in ("v=", "youtu.be/", "/shorts/"):
        if marker in video_id:
            video_id = video_id.split(marker, 1)[1].split("&", 1)[0].split("?", 1)[0]
            break

    api = YouTubeDataAPI(api_key)

    if store:
        cold = R2ColdStore(
            bucket=os.environ.get("R2_BUCKET", "scintilla-transcripts-cold"),
            account_id=os.environ.get("R2_ACCOUNT_ID"),
            access_key_id=os.environ.get("R2_ACCESS_KEY_ID"),
            secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY"),
        )
        try:
            import psycopg2
        except ImportError:
            print("psycopg2 is required to write staging rows. "
                  "Run: pip install psycopg2-binary")
            return 2
        dsn = os.environ.get("TRANSCRIPT_STAGING_DSN", "").strip()
        if not dsn:
            print("TRANSCRIPT_STAGING_DSN is not set; refusing to guess a database.")
            return 2
        connection = psycopg2.connect(dsn)
        connection.autocommit = True
        cursor = connection.cursor()
        writer = StagingWriter(lambda sql, params: cursor.execute(sql, params))
    else:
        cold = MemoryColdStore()
        writer = StagingWriter(lambda sql, params: None)

    pipeline = TranscriptPipeline(api=api, cold_store=cold, staging_writer=writer)
    summary = pipeline.run_batch([video_id])

    print("mode: {0}".format("STORE" if store else "DRY RUN (nothing written)"))
    print("quota spent: {0} unit(s)".format(summary["quota_spent"]))
    for result in summary["results"]:
        print("{0}: {1} — {2} segments {3}".format(
            result["video_id"], result["status"], result["segment_count"],
            result["detail"][:200]))
    return 0 if summary["failed"] == 0 else 1


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    flags = {a for a in argv if a.startswith("-")}
    targets = [a for a in argv if not a.startswith("-")]

    if not targets or flags & {"--self-test", "--test"}:
        from .selftest import run_capability_checks

        return 0 if run_capability_checks() else 1

    return _live(targets[0], store="--store" in flags)


if __name__ == "__main__":
    sys.exit(main())
