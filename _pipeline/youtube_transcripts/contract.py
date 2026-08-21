"""The payload contract between extraction and sentiment.

Golden rule 4: downstream sentiment modules ingest standardized JSON only.
Validation runs *before* the R2 upload and the staging insert, so a malformed
record costs one cheap check rather than a bucket object plus a failed insert
whose column limits (video_id 32, channel_id 64, storage key 255) would only
be discovered at write time.

Field names and widths mirror media_transcripts_staging exactly.
"""

import re
from typing import Any, Dict, List, Optional

__all__ = [
    "CONTRACT_VERSION",
    "PROCESSING_STATUSES",
    "ContractError",
    "validate_payload",
    "assert_valid",
    "build_payload",
]

CONTRACT_VERSION = "1.0.0"

PROCESSING_STATUSES = (
    "PENDING_ANALYSIS",
    "IN_ANALYSIS",
    "ANALYZED",
    "FAILED",
    "SKIPPED_NO_CAPTIONS",
)

# Column widths from the isolated staging DDL.
_MAX_VIDEO_ID = 32
_MAX_CHANNEL_ID = 64
_MAX_STORAGE_KEY = 255

_RFC3339 = re.compile(
    r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$"
)
_SEGMENT_KEYS = ("start", "end", "text")


class ContractError(ValueError):
    """Raised when a payload does not conform to the contract."""


def _check_text(value: Any, field: str, errors: List[str], max_len: Optional[int] = None,
                allow_empty: bool = False) -> None:
    if not isinstance(value, str):
        errors.append("{0}: expected string, got {1}".format(field, type(value).__name__))
        return
    if not allow_empty and not value.strip():
        errors.append("{0}: must not be empty".format(field))
        return
    if max_len is not None and len(value) > max_len:
        errors.append(
            "{0}: {1} chars exceeds the {2} the column accepts".format(
                field, len(value), max_len
            )
        )


def _check_segments(segments: Any, errors: List[str]) -> None:
    if not isinstance(segments, list):
        errors.append(
            "segments: expected list, got {0}".format(type(segments).__name__)
        )
        return
    if not segments:
        errors.append("segments: must not be empty")
        return
    for position, segment in enumerate(segments):
        label = "segments[{0}]".format(position)
        if not isinstance(segment, dict):
            errors.append(
                "{0}: expected object, got {1}".format(label, type(segment).__name__)
            )
            continue
        for key in _SEGMENT_KEYS:
            if key not in segment:
                errors.append("{0}.{1}: missing".format(label, key))
            elif not isinstance(segment[key], str):
                errors.append("{0}.{1}: expected string".format(label, key))
        if not str(segment.get("text", "")).strip():
            errors.append("{0}.text: must not be empty".format(label))
        for key in ("start_sec", "end_sec"):
            if key in segment and segment[key] is not None:
                if not isinstance(segment[key], (int, float)) or isinstance(
                    segment[key], bool
                ):
                    errors.append("{0}.{1}: expected number or null".format(label, key))
        start, end = segment.get("start_sec"), segment.get("end_sec")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)):
            if not isinstance(start, bool) and not isinstance(end, bool) and end < start:
                errors.append("{0}: end_sec {1} precedes start_sec {2}".format(
                    label, end, start))


def validate_payload(payload: Any) -> List[str]:
    """Return a list of contract violations. Empty list means conforming."""
    errors: List[str] = []
    if not isinstance(payload, dict):
        return ["payload: expected object, got {0}".format(type(payload).__name__)]

    _check_text(payload.get("video_id"), "video_id", errors, _MAX_VIDEO_ID)
    _check_text(payload.get("channel_id"), "channel_id", errors, _MAX_CHANNEL_ID)
    _check_text(payload.get("title"), "title", errors)
    _check_text(
        payload.get("raw_vtt_storage_key"),
        "raw_vtt_storage_key",
        errors,
        _MAX_STORAGE_KEY,
    )
    _check_text(payload.get("full_transcript_text"), "full_transcript_text", errors)

    published_at = payload.get("published_at")
    if not isinstance(published_at, str) or not _RFC3339.match(published_at):
        errors.append(
            "published_at: expected an RFC3339 timestamp, got {0!r}".format(published_at)
        )

    _check_segments(payload.get("segments"), errors)

    metadata = payload.get("metadata", {})
    if not isinstance(metadata, dict):
        errors.append(
            "metadata: expected object, got {0}".format(type(metadata).__name__)
        )

    status = payload.get("processing_status", "PENDING_ANALYSIS")
    if status not in PROCESSING_STATUSES:
        errors.append(
            "processing_status: {0!r} is not one of {1}".format(
                status, ", ".join(PROCESSING_STATUSES)
            )
        )

    return errors


def assert_valid(payload: Any) -> Dict[str, Any]:
    """Validate and return the payload, or raise ContractError."""
    errors = validate_payload(payload)
    if errors:
        raise ContractError(
            "payload violates contract v{0}: {1}".format(
                CONTRACT_VERSION, "; ".join(errors)
            )
        )
    return payload


def build_payload(
    video_id: str,
    channel_id: str,
    title: str,
    published_at: str,
    raw_vtt_storage_key: str,
    full_transcript_text: str,
    segments: List[Dict[str, Any]],
    metadata: Optional[Dict[str, Any]] = None,
    processing_status: str = "PENDING_ANALYSIS",
) -> Dict[str, Any]:
    """Assemble a contract payload and validate it before returning."""
    payload = {
        "contract_version": CONTRACT_VERSION,
        "video_id": video_id,
        "channel_id": channel_id,
        "title": title,
        "published_at": published_at,
        "raw_vtt_storage_key": raw_vtt_storage_key,
        "full_transcript_text": full_transcript_text,
        "segments": segments,
        "metadata": metadata or {},
        "processing_status": processing_status,
    }
    return assert_valid(payload)
