"""WebVTT parsing for YouTube caption tracks.

Pure stdlib: this module is importable and testable with no third-party
dependency installed, which is what lets the self-validation suite run in an
offline sandbox.
"""

import re
from typing import Any, Dict, List, Optional

__all__ = [
    "parse_timestamp",
    "strip_caption_markup",
    "parse_vtt_text",
    "join_segments",
]

# HH:MM:SS.mmm, MM:SS.mmm, and the SRT-style comma decimal separator.
_TIMESTAMP = r"(?:\d{1,3}:)?\d{2}:\d{2}[.,]\d{3}"
_CUE_TIMING = re.compile(
    r"^\s*(" + _TIMESTAMP + r")\s*-->\s*(" + _TIMESTAMP + r")(\s+.*)?$"
)
# <c.colorE5E5E5>, </c>, <b>, <00:00:01.100>, <v Speaker Name> ...
_TAG = re.compile(r"<[^>]*>")
_ENTITY = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
}


def parse_timestamp(value: str) -> Optional[float]:
    """Convert a WebVTT timestamp to seconds. Returns None if unparseable."""
    if not value:
        return None
    text = value.strip().replace(",", ".")
    parts = text.split(":")
    if not 2 <= len(parts) <= 3:
        return None
    try:
        seconds = float(parts[-1])
        minutes = int(parts[-2])
        hours = int(parts[-3]) if len(parts) == 3 else 0
    except ValueError:
        return None
    return hours * 3600 + minutes * 60 + seconds


def strip_caption_markup(text: str) -> str:
    """Remove VTT/HTML tags and entities, then collapse whitespace."""
    cleaned = _TAG.sub("", text)
    for entity, char in _ENTITY.items():
        cleaned = cleaned.replace(entity, char)
    # Any numeric/hex entity that survived the table above.
    cleaned = re.sub(r"&#x?[0-9a-fA-F]+;", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def parse_vtt_text(raw_vtt: str) -> List[Dict[str, Any]]:
    """Parse WebVTT into normalized timestamp blocks.

    Duplicate suppression is deliberately *consecutive*, not global. YouTube
    auto-captions roll the same line across adjacent cues, which is what needs
    collapsing; a phrase that genuinely recurs later in the video ("thank
    you", a repeated ticker name) is real signal and is kept. A global seen-set
    silently deletes those later occurrences and shortens the transcript the
    sentiment stage scores.
    """
    if not raw_vtt:
        return []

    blocks: List[Dict[str, Any]] = []
    lines = raw_vtt.splitlines()
    index = 0
    total = len(lines)

    while index < total:
        timing = _CUE_TIMING.match(lines[index])
        if not timing:
            index += 1
            continue

        start_raw, end_raw = timing.group(1).strip(), timing.group(2).strip()
        index += 1

        payload: List[str] = []
        while index < total and lines[index].strip():
            # A following cue with no blank line between blocks ends this one.
            if _CUE_TIMING.match(lines[index]):
                break
            payload.append(lines[index].strip())
            index += 1

        caption = strip_caption_markup(" ".join(payload))
        if not caption:
            continue
        if blocks and blocks[-1]["text"] == caption:
            # Rolling repeat: extend the previous block's window instead of
            # emitting a duplicate, so no wall-clock coverage is lost.
            blocks[-1]["end"] = end_raw
            blocks[-1]["end_sec"] = parse_timestamp(end_raw)
            continue

        blocks.append(
            {
                "start": start_raw,
                "end": end_raw,
                "start_sec": parse_timestamp(start_raw),
                "end_sec": parse_timestamp(end_raw),
                "text": caption,
            }
        )

    return blocks


def _overlap_length(previous: str, current: str) -> int:
    """Longest suffix of `previous` that is a prefix of `current`, word-wise."""
    prev_words = previous.split()
    cur_words = current.split()
    limit = min(len(prev_words), len(cur_words))
    for size in range(limit, 0, -1):
        if prev_words[-size:] == cur_words[:size]:
            return size
    return 0


def join_segments(segments: List[Dict[str, Any]]) -> str:
    """Concatenate segment text, removing rolling-caption overlap.

    Segments keep full fidelity for timestamp-anchored scoring; this produces
    the readable transcript for document-level models, where the repeated
    prefix of each rolling cue would otherwise triple word frequencies and
    skew any bag-of-words sentiment weighting.
    """
    out: List[str] = []
    for segment in segments:
        text = (segment.get("text") or "").strip()
        if not text:
            continue
        if not out:
            out.append(text)
            continue
        overlap = _overlap_length(out[-1], text)
        remainder = " ".join(text.split()[overlap:]) if overlap else text
        if remainder:
            out.append(remainder)
    return " ".join(out)
