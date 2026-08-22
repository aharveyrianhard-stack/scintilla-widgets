"""Sentiment orchestration: staging in, aggregate metrics out.

Claims PENDING_ANALYSIS rows from the isolated staging table, resolves
entities, scores segments, weights by engagement, and writes only aggregates
to production analytics. Raw text is read from staging and never leaves this
process.

Reuses the extraction stage's overlap controls for the same reason they exist
there: this worker is also cron-driven, also touches the same database, and
the 2026-08-06 saturation was caused by a job re-entering itself.
"""

from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence

from .analytics import aggregate_by_symbol, engagement_weight
from .entities import Confidence
from .ratelimit import AlreadyRunning, Deadline, SingleFlight
from .sentiment import label_for

__all__ = ["ALERT_SCORE", "ALERT_WEIGHT", "SentimentPipeline"]

#: An alert needs both a decided view and an audience. Either alone is noise:
#: a strong opinion nobody watched, or a popular video with no stance.
ALERT_SCORE = 0.45
ALERT_WEIGHT = 0.60


class SentimentPipeline:
    def __init__(
        self,
        resolver: Any,
        scorer: Any,
        metric_writer: Any,
        status_writer: Optional[Callable[[str, str], Any]] = None,
        min_confidence: str = "trusted",
        channel_weights: Optional[Dict[str, float]] = None,
        lock_store: Optional[dict] = None,
        lock_key: str = "media_sentiment_analysis_running",
        lease_seconds: float = 900.0,
        clock: Optional[Callable[[], float]] = None,
        now: Optional[datetime] = None,
    ):
        self.resolver = resolver
        self.scorer = scorer
        self.metric_writer = metric_writer
        self.status_writer = status_writer
        self.min_confidence = min_confidence
        self.channel_weights = channel_weights or {}
        self.lock_store = lock_store if lock_store is not None else {}
        self.lock_key = lock_key
        self.lease_seconds = lease_seconds
        self._clock = clock
        self._now = now

    def _lock(self) -> SingleFlight:
        kwargs: Dict[str, Any] = {"lease_seconds": self.lease_seconds,
                                  "store": self.lock_store}
        if self._clock is not None:
            kwargs["clock"] = self._clock
        return SingleFlight(self.lock_key, **kwargs)

    def _deadline(self, budget_seconds: float) -> Deadline:
        if self._clock is not None:
            return Deadline(budget_seconds, clock=self._clock)
        return Deadline(budget_seconds)

    def process_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Score one staged transcript into per-symbol metric rows."""
        video_id = row.get("video_id")
        segments = row.get("segments") or []
        metadata = dict(row.get("metadata") or {})
        metadata.setdefault("published_at", row.get("published_at"))

        texts = [str(segment.get("text") or "") for segment in segments]
        if not texts:
            return {"video_id": video_id, "status": "SKIPPED",
                    "detail": "no segments to score", "rows": []}

        hits = self.resolver.resolve_segments(segments)
        if self.min_confidence == "trusted":
            hits = [hit for hit in hits if hit.confidence in Confidence.TRUSTED]

        scores = self.scorer.score(texts)
        weight = engagement_weight(
            metadata,
            now=self._now or datetime.now(timezone.utc),
            channel_weight=self.channel_weights.get(row.get("channel_id"), 1.0),
        )

        aggregates = aggregate_by_symbol(hits, scores, weight)
        scorer_name = getattr(self.scorer, "source", "unknown")

        rows: List[Dict[str, Any]] = []
        for symbol, stats in sorted(aggregates.items()):
            alert = (
                abs(stats["sentiment_score"]) >= ALERT_SCORE
                and weight >= ALERT_WEIGHT
            )
            rows.append({
                "video_id": video_id,
                "channel_id": row.get("channel_id"),
                "symbol": symbol,
                "entity_kind": stats["entity_kind"],
                "published_at": row.get("published_at"),
                "sentiment_score": stats["sentiment_score"],
                "sentiment_label": label_for(stats["sentiment_score"]),
                "confidence": stats["confidence"],
                "engagement_weight": weight,
                "weighted_score": stats["weighted_score"],
                "mention_count": stats["mention_count"],
                "segment_count": stats["segment_count"],
                "scorer": scorer_name[:32],
                "alert": alert,
            })

        return {"video_id": video_id, "status": "SCORED",
                "detail": "", "rows": rows,
                "themes": self.resolver.resolve_themes(" ".join(texts))}

    def run_batch(
        self,
        rows: Iterable[Dict[str, Any]],
        budget_seconds: float = 600.0,
        max_rows: Optional[int] = None,
    ) -> Dict[str, Any]:
        claimed = list(rows)
        if max_rows is not None:
            claimed = claimed[:max_rows]

        summary: Dict[str, Any] = {
            "requested": len(claimed), "scored": 0, "skipped": 0,
            "failed": 0, "deferred": 0, "metric_rows": 0, "alerts": 0,
            "results": [], "deferred_ids": [],
        }
        if not claimed:
            return summary

        try:
            with self._lock():
                deadline = self._deadline(budget_seconds)
                for position, row in enumerate(claimed):
                    if deadline.expired():
                        remaining = [r.get("video_id") for r in claimed[position:]]
                        summary["deferred"] = len(remaining)
                        summary["deferred_ids"] = remaining
                        break
                    video_id = row.get("video_id")
                    try:
                        outcome = self.process_row(row)
                        if outcome["rows"]:
                            self.metric_writer.write_many(outcome["rows"])
                        summary["metric_rows"] += len(outcome["rows"])
                        summary["alerts"] += sum(
                            1 for r in outcome["rows"] if r["alert"]
                        )
                        if outcome["status"] == "SCORED":
                            summary["scored"] += 1
                            self._mark(video_id, "ANALYZED")
                        else:
                            summary["skipped"] += 1
                            self._mark(video_id, "SKIPPED_NO_CAPTIONS")
                        summary["results"].append({
                            "video_id": video_id, "status": outcome["status"],
                            "symbols": [r["symbol"] for r in outcome["rows"]],
                        })
                    except Exception as exc:
                        summary["failed"] += 1
                        self._mark(video_id, "FAILED")
                        summary["results"].append({
                            "video_id": video_id, "status": "FAILED",
                            "detail": str(exc)[:300],
                        })
        except AlreadyRunning as exc:
            summary["error"] = str(exc)
            summary["deferred"] = len(claimed)
            summary["deferred_ids"] = [r.get("video_id") for r in claimed]
        return summary

    def _mark(self, video_id: Optional[str], status: str) -> None:
        """Status is advisory: a staging write failure must not lose metrics
        that were already committed to analytics."""
        if self.status_writer and video_id:
            try:
                self.status_writer(video_id, status)
            except Exception:
                pass
