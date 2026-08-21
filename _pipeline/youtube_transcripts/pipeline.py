"""End-to-end extraction orchestration.

Ordering matters here. The storage key is deterministic, so the contract
payload is assembled and validated *before* the R2 upload: a malformed record
then costs one cheap check instead of an orphaned bucket object plus a failed
insert.

A batch runs inside a single-flight lease and against a wall-clock deadline.
Both come straight from the 2026-08-06 saturation incident, whose recorded
must-fix list led with overlap prevention and matching the schedule to real
invocation duration. A run that hits its deadline stops cleanly and reports
what it did not reach, so the scheduler sees a short honest run rather than an
invocation that silently overlaps the next one.
"""

from typing import Any, Dict, Iterable, List, Optional

from .contract import build_payload
from .extractor import NoCaptionsAvailable, SubtitleExtractor
from .ratelimit import AlreadyRunning, Deadline, SingleFlight
from .storage import transcript_key
from .vtt import join_segments, parse_vtt_text

__all__ = ["ProcessOutcome", "TranscriptPipeline"]


class ProcessOutcome(object):
    """Per-video result. Never raises for an expected, permanent condition."""

    STORED = "STORED"
    SKIPPED_NO_CAPTIONS = "SKIPPED_NO_CAPTIONS"
    FAILED = "FAILED"

    def __init__(self, video_id: str, status: str, detail: str = "",
                 payload: Optional[Dict[str, Any]] = None):
        self.video_id = video_id
        self.status = status
        self.detail = detail
        self.payload = payload

    def as_dict(self) -> Dict[str, Any]:
        return {
            "video_id": self.video_id,
            "status": self.status,
            "detail": self.detail,
            "storage_key": (self.payload or {}).get("raw_vtt_storage_key"),
            "segment_count": len((self.payload or {}).get("segments") or []),
        }

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return "<ProcessOutcome {0} {1}>".format(self.video_id, self.status)


class TranscriptPipeline:
    def __init__(
        self,
        api: Any,
        cold_store: Any,
        staging_writer: Any,
        extractor: Optional[SubtitleExtractor] = None,
        lang: str = "en",
        lock_store: Optional[dict] = None,
        lock_key: str = "media_transcripts_extraction_running",
        lease_seconds: float = 900.0,
        clock: Optional[Any] = None,
    ):
        self.api = api
        self.cold_store = cold_store
        self.staging_writer = staging_writer
        self.extractor = extractor or SubtitleExtractor(lang=lang)
        self.lang = lang
        self.lock_store = lock_store if lock_store is not None else {}
        self.lock_key = lock_key
        self.lease_seconds = lease_seconds
        self._clock = clock

    def _lock(self) -> SingleFlight:
        kwargs: Dict[str, Any] = {
            "lease_seconds": self.lease_seconds,
            "store": self.lock_store,
        }
        if self._clock is not None:
            kwargs["clock"] = self._clock
        return SingleFlight(self.lock_key, **kwargs)

    def _deadline(self, budget_seconds: float) -> Deadline:
        if self._clock is not None:
            return Deadline(budget_seconds, clock=self._clock)
        return Deadline(budget_seconds)

    def process_video(self, video_id: str, meta: Dict[str, Any]) -> ProcessOutcome:
        """Extract, normalize, store, and stage one video."""
        try:
            raw_vtt, info = self.extractor.fetch(video_id)
        except NoCaptionsAvailable as exc:
            return ProcessOutcome(
                video_id, ProcessOutcome.SKIPPED_NO_CAPTIONS, str(exc)
            )
        except Exception as exc:
            return ProcessOutcome(video_id, ProcessOutcome.FAILED, str(exc))

        segments = parse_vtt_text(raw_vtt)
        if not segments:
            return ProcessOutcome(
                video_id,
                ProcessOutcome.SKIPPED_NO_CAPTIONS,
                "caption track parsed to zero usable cues",
            )

        channel_id = meta.get("channel_id") or (info or {}).get("channel_id") or ""
        published_at = meta.get("published_at") or ""
        key = transcript_key(video_id, channel_id, published_at)

        try:
            payload = build_payload(
                video_id=video_id,
                channel_id=channel_id,
                title=meta.get("title") or (info or {}).get("title") or "",
                published_at=published_at,
                raw_vtt_storage_key=key,
                full_transcript_text=join_segments(segments),
                segments=segments,
                metadata=self._metadata_blob(meta, info, segments),
            )
        except Exception as exc:
            # Validated before upload, so nothing is orphaned in the bucket.
            return ProcessOutcome(video_id, ProcessOutcome.FAILED, str(exc))

        try:
            self.cold_store.put_transcript(
                key,
                raw_vtt,
                metadata={"video_id": video_id, "channel_id": channel_id},
            )
            self.staging_writer.write(payload)
        except Exception as exc:
            return ProcessOutcome(video_id, ProcessOutcome.FAILED, str(exc), payload)

        return ProcessOutcome(video_id, ProcessOutcome.STORED, "", payload)

    def _metadata_blob(
        self, meta: Dict[str, Any], info: Dict[str, Any], segments: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Engagement and language facts the sentiment stage weights by."""
        last_end = None
        for segment in reversed(segments):
            if segment.get("end_sec") is not None:
                last_end = segment["end_sec"]
                break
        return {
            "channel_title": meta.get("channel_title"),
            "view_count": meta.get("view_count"),
            "like_count": meta.get("like_count"),
            "comment_count": meta.get("comment_count"),
            "duration_sec": meta.get("duration_sec"),
            "is_live": meta.get("is_live"),
            "tags": meta.get("tags") or [],
            "category_id": meta.get("category_id"),
            "default_audio_language": meta.get("default_audio_language"),
            "caption_language": self.lang,
            "caption_is_automatic": not bool(meta.get("has_caption_track")),
            "transcript_seconds": last_end,
            "segment_count": len(segments),
        }

    def run_batch(
        self,
        video_ids: Iterable[str],
        budget_seconds: float = 600.0,
        max_videos: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Process a bounded batch under one lease and one deadline."""
        requested = [v for v in video_ids if v]
        if max_videos is not None:
            requested = requested[:max_videos]

        summary: Dict[str, Any] = {
            "requested": len(requested),
            "stored": 0,
            "skipped": 0,
            "failed": 0,
            "deferred": 0,
            "quota_spent": 0,
            "results": [],
            "deferred_ids": [],
        }
        if not requested:
            return summary

        try:
            lock = self._lock()
        except Exception as exc:  # pragma: no cover - defensive
            summary["error"] = str(exc)
            return summary

        try:
            with lock:
                deadline = self._deadline(budget_seconds)
                metadata = self.api.fetch_videos(requested)
                summary["quota_spent"] = getattr(self.api, "quota_spent", 0)

                for position, video_id in enumerate(requested):
                    if deadline.expired():
                        remaining = requested[position:]
                        summary["deferred"] = len(remaining)
                        summary["deferred_ids"] = remaining
                        break
                    meta = metadata.get(video_id)
                    if meta is None:
                        outcome = ProcessOutcome(
                            video_id,
                            ProcessOutcome.SKIPPED_NO_CAPTIONS,
                            "not returned by videos.list (deleted, private, or bad id)",
                        )
                    else:
                        outcome = self.process_video(video_id, meta)
                    summary["results"].append(outcome.as_dict())
                    if outcome.status == ProcessOutcome.STORED:
                        summary["stored"] += 1
                    elif outcome.status == ProcessOutcome.SKIPPED_NO_CAPTIONS:
                        summary["skipped"] += 1
                    else:
                        summary["failed"] += 1
                summary["quota_spent"] = getattr(self.api, "quota_spent", 0)
        except AlreadyRunning as exc:
            summary["error"] = str(exc)
            summary["deferred"] = len(requested)
            summary["deferred_ids"] = requested
        return summary
