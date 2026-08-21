"""Engagement weighting and sanitized metric egress (sentiment steps 3-4).

This is the only module that writes to the production analytics database, so
it is the one place the "never stores raw text blobs" rule can actually be
enforced. It is enforced by allowlist, not by inspection: a column that is not
named in ALLOWED_COLUMNS cannot be written, and any string value longer than
MAX_SCALAR_CHARS is refused outright. A transcript cannot survive either check,
so the rule holds even if a future caller passes the whole payload in by
mistake.

The mirror of storage.StagingWriter, which refuses to write *into* production
from the ingestion side; this refuses to carry raw text *out* of it.
"""

import math
import re
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence

__all__ = [
    "ALLOWED_COLUMNS",
    "MAX_SCALAR_CHARS",
    "SanitizationError",
    "engagement_weight",
    "weighted_index",
    "aggregate_by_symbol",
    "SanitizedMetricWriter",
]

ANALYTICS_TABLE = "media_sentiment_scores"

#: Aggregates, tags and metrics only. Nothing here can hold a transcript.
ALLOWED_COLUMNS = (
    "video_id",
    "channel_id",
    "symbol",
    "entity_kind",
    "published_at",
    "sentiment_score",
    "sentiment_label",
    "confidence",
    "engagement_weight",
    "weighted_score",
    "mention_count",
    "segment_count",
    "scorer",
    "alert",
)

#: Long enough for a symbol, a label, an id or a timestamp; far too short for
#: a sentence. This is the constraint that makes the mandate real.
MAX_SCALAR_CHARS = 64

_ISO = "%Y-%m-%dT%H:%M:%S%z"


class SanitizationError(ValueError):
    """Raised when a metric row would carry something other than a metric."""


def _parse_ts(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str) or not value:
        return None
    text = value.strip().replace("Z", "+0000")
    text = re.sub(r"([+-]\d{2}):(\d{2})$", r"\1\2", text)
    for pattern in (_ISO, "%Y-%m-%dT%H:%M:%S.%f%z"):
        try:
            return datetime.strptime(text, pattern)
        except ValueError:
            continue
    return None


def engagement_weight(
    metadata: Dict[str, Any],
    now: Optional[datetime] = None,
    channel_weight: float = 1.0,
) -> float:
    """Blend reach, interaction rate and velocity into a 0..1 multiplier.

    Reach is log-scaled because the difference between 1k and 10k views matters
    far more than between 1M and 10M. Velocity is included so a video pulling
    views quickly counts for more than one that accumulated them over a year --
    that is the "engagement velocity" the spec asks for, and without it an old
    upload outranks today's news.

    Unknown counts return the neutral 0.5 rather than 0.0: a channel that hides
    its like count is not a channel with no likes.
    """
    views = metadata.get("view_count")
    likes = metadata.get("like_count")
    comments = metadata.get("comment_count")

    if not isinstance(views, (int, float)) or views is None or views < 0:
        reach = 0.5
        velocity = 0.5
    else:
        reach = min(1.0, math.log10(1.0 + float(views)) / 6.0)
        published = _parse_ts(metadata.get("published_at"))
        reference = now or datetime.now(timezone.utc)
        if published is None:
            velocity = 0.5
        else:
            hours = max(1.0, (reference - published).total_seconds() / 3600.0)
            per_hour = float(views) / hours
            velocity = min(1.0, math.log10(1.0 + per_hour) / 4.0)

    if (isinstance(views, (int, float)) and views
            and isinstance(likes, (int, float))):
        interactions = float(likes) + float(comments or 0)
        # 5% interaction rate is exceptional; treat it as the ceiling.
        interaction = min(1.0, (interactions / float(views)) / 0.05)
    else:
        interaction = 0.5

    blended = 0.45 * reach + 0.35 * velocity + 0.20 * interaction
    return round(max(0.0, min(1.0, blended * float(channel_weight))), 4)


def weighted_index(
    scores: Sequence[Any], weight: float = 1.0
) -> Dict[str, float]:
    """Confidence-and-engagement-weighted mean polarity.

    Weighting by confidence means a segment the scorer was unsure about cannot
    drag the index around; a set of entirely unconfident scores returns 0.0
    with zero weight rather than a spurious average.
    """
    numerator = 0.0
    denominator = 0.0
    for score in scores:
        confidence = float(getattr(score, "confidence", 0.0))
        polarity = float(getattr(score, "polarity", 0.0))
        numerator += polarity * confidence
        denominator += confidence
    if denominator <= 0:
        return {"score": 0.0, "confidence": 0.0, "weighted": 0.0}
    mean = numerator / denominator
    mean_confidence = denominator / max(1, len(scores))
    return {
        "score": round(mean, 4),
        "confidence": round(min(1.0, mean_confidence), 4),
        "weighted": round(mean * float(weight), 4),
    }


def aggregate_by_symbol(
    hits: Iterable[Any],
    scores: Sequence[Any],
    weight: float = 1.0,
) -> Dict[str, Dict[str, Any]]:
    """Roll segment scores up per resolved symbol.

    A symbol is credited with the sentiment of the segments it was mentioned
    in; a mention in a segment with no score contributes a mention but no
    polarity.
    """
    buckets: Dict[str, Dict[str, Any]] = {}
    for hit in hits:
        symbol = getattr(hit, "symbol", None)
        if not symbol:
            continue
        bucket = buckets.setdefault(
            symbol,
            {"symbol": symbol, "kind": getattr(hit, "kind", "equity"),
             "mentions": 0, "segments": set(), "scores": []},
        )
        bucket["mentions"] += 1
        index = getattr(hit, "segment_index", None)
        if index is not None and index not in bucket["segments"]:
            bucket["segments"].add(index)
            if 0 <= index < len(scores):
                bucket["scores"].append(scores[index])

    out: Dict[str, Dict[str, Any]] = {}
    for symbol, bucket in buckets.items():
        stats = weighted_index(bucket["scores"], weight)
        out[symbol] = {
            "symbol": symbol,
            "entity_kind": bucket["kind"],
            "mention_count": bucket["mentions"],
            "segment_count": len(bucket["segments"]),
            "sentiment_score": stats["score"],
            "confidence": stats["confidence"],
            "weighted_score": stats["weighted"],
        }
    return out


class SanitizedMetricWriter:
    """Writes aggregate metrics to production analytics. Nothing else."""

    def __init__(self, execute: Callable[[str, tuple], Any],
                 table: str = ANALYTICS_TABLE,
                 schema: str = "public"):
        if not re.match(r"^[a-z_][a-z0-9_]*$", (schema or "").strip().lower()):
            raise SanitizationError("unsafe schema identifier {0!r}".format(schema))
        if not re.match(r"^[a-z_][a-z0-9_]*$", (table or "").strip().lower()):
            raise SanitizationError("unsafe table identifier {0!r}".format(table))
        self.schema = schema.strip().lower()
        self.table = table.strip().lower()
        self._execute = execute

    @property
    def qualified_name(self) -> str:
        return "{0}.{1}".format(self.schema, self.table)

    @staticmethod
    def sanitize(row: Dict[str, Any]) -> Dict[str, Any]:
        """Refuse anything that is not a metric. Allowlist, not blacklist."""
        if not isinstance(row, dict):
            raise SanitizationError("metric row must be an object")

        unknown = sorted(set(row) - set(ALLOWED_COLUMNS))
        if unknown:
            raise SanitizationError(
                "refusing columns not on the metric allowlist: {0}".format(
                    ", ".join(unknown)
                )
            )
        for column, value in row.items():
            if isinstance(value, str) and len(value) > MAX_SCALAR_CHARS:
                raise SanitizationError(
                    "{0} is {1} chars; production analytics stores metrics, "
                    "never text (limit {2})".format(
                        column, len(value), MAX_SCALAR_CHARS
                    )
                )
            if isinstance(value, (list, dict)):
                raise SanitizationError(
                    "{0} is a {1}; only scalar metrics may cross this "
                    "boundary".format(column, type(value).__name__)
                )
        for required in ("video_id", "symbol"):
            if not row.get(required):
                raise SanitizationError("{0} is required".format(required))
        return row

    def upsert_sql(self, columns: Sequence[str]) -> str:
        placeholders = ", ".join(["%s"] * len(columns))
        updates = ", ".join(
            "{0} = excluded.{0}".format(column)
            for column in columns
            if column not in ("video_id", "symbol")
        )
        return (
            "insert into {0} ({1}) values ({2}) "
            "on conflict (video_id, symbol) do update set {3}{4}".format(
                self.qualified_name, ", ".join(columns), placeholders, updates,
                ", updated_at = now()" if updates else "",
            )
        )

    def write(self, row: Dict[str, Any]) -> Any:
        clean = self.sanitize(row)
        columns = [column for column in ALLOWED_COLUMNS if column in clean]
        params = tuple(clean[column] for column in columns)
        return self._execute(self.upsert_sql(columns), params)

    def write_many(self, rows: Iterable[Dict[str, Any]]) -> List[Any]:
        return [self.write(row) for row in rows]
