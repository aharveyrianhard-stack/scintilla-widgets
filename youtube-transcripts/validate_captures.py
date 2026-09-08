#!/usr/bin/env python3
"""Check a capture directory written by ``yt_transcripts.py --out``.

For every video ID in the directory all five files must exist and parse, agree
on the number of cues, carry non-negative, non-decreasing start times, hold
non-empty text, and the plain-text file must equal the JSON cues joined. One
line per video; exit status 1 on any failure. This is how the workflow tests
the captured files rather than merely writing them.

    python3 validate_captures.py captures
"""
from __future__ import annotations

import json
import os
import re
import sys
from typing import List, Sequence, Tuple

from yt_transcripts import FORMATS, _clock

SRT_TIME = re.compile(r"^(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})$")
VTT_TIME = re.compile(r"^(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})$")
STAMP = re.compile(r"^\[(\d+:)?(\d{2}):(\d{2})\] (.*)$")


def _seconds(h: str, m: str, s: str, ms: str) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0


def _cue_starts(text: str, pattern: re.Pattern) -> List[float]:
    starts = []
    for line in text.splitlines():
        match = pattern.match(line.strip())
        if match:
            starts.append(_seconds(*match.groups()[:4]))
    return starts


def check_video(directory: str, video_id: str) -> Tuple[bool, str]:
    """Return (ok, one-line verdict) for one video's set of capture files."""
    paths = {fmt: os.path.join(directory, f"{video_id}.{ext}") for fmt, ext in FORMATS.items()}
    missing = [fmt for fmt, path in paths.items() if not os.path.isfile(path)]
    if missing:
        return False, f"{video_id}: missing {', '.join(missing)}"

    contents = {}
    for fmt, path in paths.items():
        with open(path, encoding="utf-8") as handle:
            contents[fmt] = handle.read()

    problems = []
    try:
        cues = json.loads(contents["json"])
    except ValueError as err:
        return False, f"{video_id}: json does not parse ({err})"
    if not isinstance(cues, list) or not cues:
        return False, f"{video_id}: json holds no cues"
    starts = [float(c.get("start", -1)) for c in cues]
    if any(s < 0 for s in starts):
        problems.append("negative start time in json")
    if any(b < a for a, b in zip(starts, starts[1:])):
        problems.append("start times go backwards in json")
    if any(not str(c.get("text", "")).strip() for c in cues):
        problems.append("empty cue text in json")

    expected_text = "\n".join(str(c["text"]) for c in cues).strip()
    if contents["text"].strip() != expected_text:
        problems.append("txt differs from the json cues joined")

    stamped = [STAMP.match(line) for line in contents["timestamped"].splitlines() if line.strip()]
    if len(stamped) != len(cues) or any(m is None for m in stamped):
        problems.append(f"timestamped has {sum(m is not None for m in stamped)} stamped lines for {len(cues)} cues")
    else:
        for m, c in zip(stamped, cues):
            if f"[{_clock(float(c['start']))}]" != m.group(0)[: m.group(0).index("]") + 1]:
                problems.append("timestamped clocks do not match json starts")
                break

    srt_starts = _cue_starts(contents["srt"], SRT_TIME)
    if len(srt_starts) != len(cues):
        problems.append(f"srt has {len(srt_starts)} cues for {len(cues)} in json")
    elif any(abs(a - b) > 0.0015 for a, b in zip(srt_starts, starts)):
        problems.append("srt start times differ from json")

    if not contents["vtt"].startswith("WEBVTT"):
        problems.append("vtt lacks the WEBVTT header")
    vtt_starts = _cue_starts(contents["vtt"], VTT_TIME)
    if len(vtt_starts) != len(cues):
        problems.append(f"vtt has {len(vtt_starts)} cues for {len(cues)} in json")
    elif any(abs(a - b) > 0.0015 for a, b in zip(vtt_starts, starts)):
        problems.append("vtt start times differ from json")

    if problems:
        return False, f"{video_id}: FAIL: " + "; ".join(problems)
    last = cues[-1]
    span = f"{_clock(starts[0])} to {_clock(float(last['start']) + float(last.get('duration', 0)))}"
    return True, (
        f"{video_id}: {len(cues)} cues, {span}, {len(expected_text)} chars, "
        "all five formats agree"
    )


def validate(directory: str) -> Tuple[int, int, List[str]]:
    """Return (ok count, total count, verdict lines) for every video in the directory."""
    if not os.path.isdir(directory):
        return 0, 0, [f"{directory}: no such directory"]
    ids = sorted({name.split(".")[0] for name in os.listdir(directory) if name.endswith(".json")})
    lines, ok = [], 0
    for video_id in ids:
        good, verdict = check_video(directory, video_id)
        ok += good
        lines.append(verdict)
    return ok, len(ids), lines


def main(argv: Sequence[str]) -> int:
    directory = argv[0] if argv else "captures"
    ok, total, lines = validate(directory)
    for line in lines:
        print(line)
    print(f"{ok}/{total} capture sets valid in {directory}/")
    return 0 if total and ok == total else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
