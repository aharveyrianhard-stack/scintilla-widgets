"""Isolated storage routing: R2 cold bucket and the staging table.

PREFLIGHT.md is blunt about this: "Every rule that survived 2026-08-08 was a
constraint. Every rule that lived only in prose decayed within hours." The
zero-contamination mandate is prose unless something refuses to break it, so
`StagingWriter` raises on any attempt to target a production schema or a core
table rather than trusting the caller to have configured it correctly.

Raw caption text goes to R2 and only to R2. The staging row keeps a reference
key, never the blob a second time.
"""

import gzip
import io
import json
import re
from typing import Any, Callable, Dict, Iterable, List, Optional

__all__ = [
    "ISOLATED_SCHEMA",
    "STAGING_TABLE",
    "IsolationViolation",
    "transcript_key",
    "MemoryColdStore",
    "R2ColdStore",
    "StagingWriter",
]

ISOLATED_SCHEMA = "media_ingest"
STAGING_TABLE = "media_transcripts_staging"

# Schemas that carry live application state. Extraction never writes here.
PRODUCTION_SCHEMAS = frozenset(
    {
        "public",
        "auth",
        "storage",
        "realtime",
        "graphql",
        "graphql_public",
        "extensions",
        "vault",
        "supabase_functions",
        "cron",
        "net",
        "pgsodium",
        "information_schema",
    }
)

# Core tables named explicitly so a typo'd schema cannot smuggle one through.
PROTECTED_TABLES = frozenset(
    {
        "youtube_videos",
        "youtube_feed",
        "yt_positions",
        "app_config",
        "kv_secrets",
        "spine_events",
        "tickers",
        "station_shared_state",
        "ohlcv_history",
        "coldstore_manifest",
    }
)

_MAX_KEY = 255
_SAFE = re.compile(r"[^A-Za-z0-9._-]")


class IsolationViolation(RuntimeError):
    """Raised when a write would land outside the isolated ingestion layer."""


def _safe(value: str, fallback: str) -> str:
    """Reduce one path component to safe characters with no dot segments.

    R2 keys are flat strings, so ".." is inert in the bucket itself. It stops
    being inert the moment a key is joined to a local path -- which is exactly
    what a coldstore export does -- so the component is neutralized at the
    point it is built rather than at every point it is consumed.
    """
    cleaned = _SAFE.sub("_", (value or "").strip())
    cleaned = re.sub(r"\.{2,}", "_", cleaned)
    cleaned = cleaned.strip(".")
    return cleaned or fallback


def transcript_key(
    video_id: str,
    channel_id: str,
    published_at: Optional[str] = None,
    suffix: str = "vtt.gz",
) -> str:
    """Deterministic R2 object key, partitioned for cheap prefix listing.

    Kept inside the 255 characters the staging column accepts, because the
    column is what has to store it.
    """
    if not video_id:
        raise ValueError("video_id is required for a storage key")
    year, month = "unknown", "unknown"
    if published_at and len(published_at) >= 7:
        year, month = published_at[0:4], published_at[5:7]
    key = "raw/vtt/{0}/{1}/{2}/{3}.{4}".format(
        _safe(channel_id, "unknown_channel"),
        _safe(year, "unknown"),
        _safe(month, "unknown"),
        _safe(video_id, "unknown_video"),
        suffix,
    )
    if len(key) > _MAX_KEY:
        raise ValueError(
            "storage key is {0} chars, over the {1} the column accepts".format(
                len(key), _MAX_KEY
            )
        )
    return key


class MemoryColdStore:
    """In-memory stand-in used by the self-test suite. Writes no files."""

    def __init__(self, bucket: str = "scintilla-transcripts-cold"):
        self.bucket = bucket
        self.objects: Dict[str, bytes] = {}

    def put_transcript(self, key: str, raw_vtt: str, metadata=None) -> str:
        self.objects[key] = gzip.compress(raw_vtt.encode("utf-8"))
        return key

    def get_transcript(self, key: str) -> str:
        return gzip.decompress(self.objects[key]).decode("utf-8")


class R2ColdStore:
    """Cloudflare R2 via the S3 API, streamed straight from memory.

    Nothing is staged on local disk on the way out, which is the whole point
    of the zero-footprint rule: the caption text exists in the worker's memory
    and in the bucket, and nowhere else.
    """

    def __init__(
        self,
        bucket: str = "scintilla-transcripts-cold",
        account_id: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        client: Optional[Any] = None,
    ):
        self.bucket = bucket
        self._client = client
        self._endpoint = endpoint_url or (
            "https://{0}.r2.cloudflarestorage.com".format(account_id)
            if account_id
            else None
        )
        self._access_key_id = access_key_id
        self._secret_access_key = secret_access_key

    def client(self) -> Any:
        if self._client is None:
            try:
                import boto3
            except ImportError as exc:  # pragma: no cover - environment dependent
                raise ImportError(
                    "boto3 is required for R2 uploads. Run: pip install boto3"
                ) from exc
            if not self._endpoint:
                raise ValueError("an R2 account id or endpoint URL is required")
            self._client = boto3.client(
                "s3",
                endpoint_url=self._endpoint,
                aws_access_key_id=self._access_key_id,
                aws_secret_access_key=self._secret_access_key,
                region_name="auto",
            )
        return self._client

    def put_transcript(
        self, key: str, raw_vtt: str, metadata: Optional[Dict[str, str]] = None
    ) -> str:
        """Gzip and upload caption text. Returns the stored key."""
        payload = gzip.compress(raw_vtt.encode("utf-8"))
        self.client().put_object(
            Bucket=self.bucket,
            Key=key,
            Body=io.BytesIO(payload),
            ContentType="text/vtt; charset=utf-8",
            ContentEncoding="gzip",
            Metadata={k: str(v) for k, v in (metadata or {}).items()},
        )
        return key

    def get_transcript(self, key: str) -> str:
        body = self.client().get_object(Bucket=self.bucket, Key=key)["Body"].read()
        return gzip.decompress(body).decode("utf-8")


class StagingWriter:
    """Writes contract payloads to the isolated staging table only.

    `execute` is any callable taking (sql, params); in production it is a
    psycopg connection cursor bound to the isolated instance.
    """

    def __init__(
        self,
        execute: Callable[[str, tuple], Any],
        schema: str = ISOLATED_SCHEMA,
        table: str = STAGING_TABLE,
    ):
        self.schema = self.guard_schema(schema)
        self.table = self.guard_table(table)
        self._execute = execute

    @staticmethod
    def guard_schema(schema: str) -> str:
        normalized = (schema or "").strip().lower()
        if not normalized:
            raise IsolationViolation("an isolated schema name is required")
        if normalized in PRODUCTION_SCHEMAS:
            raise IsolationViolation(
                "refusing to write extraction data into the production schema "
                "{0!r}; route it to {1!r}".format(normalized, ISOLATED_SCHEMA)
            )
        if not re.match(r"^[a-z_][a-z0-9_]*$", normalized):
            raise IsolationViolation("unsafe schema identifier {0!r}".format(schema))
        return normalized

    @staticmethod
    def guard_table(table: str) -> str:
        normalized = (table or "").strip().lower()
        if normalized in PROTECTED_TABLES:
            raise IsolationViolation(
                "refusing to write extraction data into the core table "
                "{0!r}".format(normalized)
            )
        if not re.match(r"^[a-z_][a-z0-9_]*$", normalized):
            raise IsolationViolation("unsafe table identifier {0!r}".format(table))
        return normalized

    @property
    def qualified_name(self) -> str:
        return "{0}.{1}".format(self.schema, self.table)

    def upsert_sql(self) -> str:
        return (
            "insert into {0} (video_id, channel_id, title, published_at, "
            "raw_vtt_storage_key, full_transcript_text, segments, metadata, "
            "processing_status) values (%s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "on conflict (video_id) do update set "
            "title = excluded.title, "
            "raw_vtt_storage_key = excluded.raw_vtt_storage_key, "
            "full_transcript_text = excluded.full_transcript_text, "
            "segments = excluded.segments, "
            "metadata = excluded.metadata, "
            "processing_status = excluded.processing_status, "
            "updated_at = now()".format(self.qualified_name)
        )

    def write(self, payload: Dict[str, Any]) -> Any:
        """Insert or refresh one transcript row. Payload must already be valid."""
        from .contract import assert_valid

        assert_valid(payload)
        params = (
            payload["video_id"],
            payload["channel_id"],
            payload["title"],
            payload["published_at"],
            payload["raw_vtt_storage_key"],
            payload["full_transcript_text"],
            json.dumps(payload["segments"]),
            json.dumps(payload.get("metadata") or {}),
            payload.get("processing_status", "PENDING_ANALYSIS"),
        )
        return self._execute(self.upsert_sql(), params)

    def write_many(self, payloads: Iterable[Dict[str, Any]]) -> List[Any]:
        return [self.write(payload) for payload in payloads]
