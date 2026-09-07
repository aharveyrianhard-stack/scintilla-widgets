#!/usr/bin/env python3
"""YouTube transcript extraction — proof of concept.

Takes a list of YouTube URLs (standard videos *and* Shorts), isolates the
11-character video ID from each, pulls the transcript with
youtube-transcript-api (no Data API key, no OAuth), strips timestamps with the
library's TextFormatter, and prints the first 500 characters of each so the
extraction is visibly proven.

    pip install -r requirements.txt
    python3 yt_transcripts.py                 # runs the hardcoded proof list
    python3 yt_transcripts.py URL [URL ...]   # or any URLs / bare IDs you pass

Exit status is 0 only when every URL yielded a transcript.

Note on the library version: the pre-1.0 API was the class-level
``YouTubeTranscriptApi.get_transcript(video_id)``. Since 1.0 it is an instance
call, ``YouTubeTranscriptApi().fetch(video_id)``, returning a FetchedTranscript.
This script targets the current API (pinned in requirements.txt).
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence
from urllib.parse import parse_qs, urlparse

from youtube_transcript_api import (
    CouldNotRetrieveTranscript,
    FetchedTranscript,
    NoTranscriptFound,
    RequestBlocked,
    TranscriptsDisabled,
    VideoUnavailable,
    YouTubeTranscriptApi,
)
from youtube_transcript_api.formatters import TextFormatter

# The proof list: at least one standard video and one Short. Shorts share the
# same 11-character ID space as videos — only the URL shape differs.
PROOF_URLS: List[str] = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",   # standard video
    "https://www.youtube.com/shorts/uOLqPKuO2Bo",    # Short — MKBHD studio clip
    "https://www.youtube.com/shorts/8rJJUfkeZvI",    # Short — second, in case one loses captions
]

PREVIEW_CHARS = 500
PREFERRED_LANGUAGES: Sequence[str] = ("en",)

FORMATTER = TextFormatter()

# ---------------------------------------------------------------- URL parsing

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
_PATH_PREFIXES = ("/shorts/", "/embed/", "/live/", "/v/", "/e/")


def _is_youtube_host(host: str) -> bool:
    return (
        host == "youtube.com"
        or host.endswith(".youtube.com")
        or host == "youtube-nocookie.com"
        or host.endswith(".youtube-nocookie.com")
    )


def extract_video_id(url: str) -> str:
    """Return the 11-character video ID from any common YouTube URL shape.

    Handles ``watch?v=ID``, ``/shorts/ID``, ``youtu.be/ID``, ``/embed/ID``,
    ``/live/ID``, mobile and music hosts, extra query params (``t=``, ``si=``,
    ``list=``), missing scheme, surrounding whitespace, and a bare ID.
    Raises ValueError when no ID can be found.
    """
    raw = (url or "").strip()
    if not raw:
        raise ValueError("empty URL")
    if VIDEO_ID_RE.match(raw):
        return raw
    if "://" not in raw:
        raw = "https://" + raw

    parts = urlparse(raw)
    host = (parts.hostname or "").lower()
    path = parts.path or ""
    query_v = (parse_qs(parts.query).get("v") or [None])[0]

    candidate: Optional[str] = None
    if host == "youtu.be":
        candidate = path.lstrip("/").split("/")[0]
    elif _is_youtube_host(host):
        for prefix in _PATH_PREFIXES:
            if path.startswith(prefix):
                candidate = path[len(prefix):].split("/")[0]
                break
        if candidate is None:
            candidate = query_v  # /watch?v=ID and friends
    else:
        raise ValueError(f"not a YouTube URL: {url!r}")

    if not candidate or not VIDEO_ID_RE.match(candidate):
        raise ValueError(f"no 11-character video ID in: {url!r}")
    return candidate


def url_kind(url: str) -> str:
    """Cosmetic label for the report — the fetch path is identical for both."""
    return "short" if "/shorts/" in (url or "") else "video"


# ------------------------------------------------------------------ fetching


@dataclass
class TranscriptResult:
    url: str
    kind: str
    video_id: Optional[str] = None
    ok: bool = False
    text: str = ""
    language: str = ""
    is_generated: Optional[bool] = None
    snippets: int = 0
    error: str = ""

    @property
    def preview(self) -> str:
        return self.text[:PREVIEW_CHARS]


def fetch_transcript(
    video_id: str,
    api: Optional[YouTubeTranscriptApi] = None,
    languages: Iterable[str] = PREFERRED_LANGUAGES,
) -> FetchedTranscript:
    """Fetch a transcript, preferring ``languages`` but taking whatever exists.

    ``fetch()`` already prefers manually written captions over auto-generated
    ones within the requested languages. When the video has captions but none
    in those languages, take the first transcript YouTube lists rather than
    failing — the text is still useful and the language is reported with it.
    """
    api = api or YouTubeTranscriptApi()
    try:
        return api.fetch(video_id, languages=list(languages))
    except NoTranscriptFound as missing:
        available = list(api.list(video_id))
        if not available:
            raise missing
        return available[0].fetch()


def _brief(err: Exception, limit: int = 160) -> str:
    text = " ".join(str(err).split())
    return text if len(text) <= limit else text[:limit] + "…"


def extract(url: str, api: Optional[YouTubeTranscriptApi] = None) -> TranscriptResult:
    """Parse one URL, fetch its transcript, and report — never raises."""
    result = TranscriptResult(url=url, kind=url_kind(url))
    try:
        result.video_id = extract_video_id(url)
    except ValueError as bad:
        result.error = f"bad URL: {bad}"
        return result

    try:
        fetched = fetch_transcript(result.video_id, api)
    except TranscriptsDisabled:
        result.error = "no captions: the uploader disabled transcripts for this video"
    except NoTranscriptFound:
        result.error = "no captions: no transcript in any language"
    except RequestBlocked as blocked:  # IpBlocked is a subclass
        result.error = (
            f"{type(blocked).__name__}: YouTube blocked this IP (cloud/datacenter "
            "ranges are routinely told to sign in to prove they are not a bot); "
            "run from a residential connection, or see probe_clients.py"
        )
    except VideoUnavailable:
        result.error = "video unavailable: private, deleted, or region-locked"
    except CouldNotRetrieveTranscript as err:
        result.error = f"{type(err).__name__}: {_brief(err)}"
    except Exception as err:  # noqa: BLE001 — network faults must not stop the batch
        result.error = f"{type(err).__name__}: {_brief(err)}"
    else:
        result.text = FORMATTER.format_transcript(fetched)
        result.language = fetched.language_code
        result.is_generated = fetched.is_generated
        result.snippets = len(fetched.snippets)
        result.ok = True
    return result


def extract_all(
    urls: Iterable[str], api: Optional[YouTubeTranscriptApi] = None
) -> List[TranscriptResult]:
    api = api or YouTubeTranscriptApi()  # one session, reused across the batch
    return [extract(url, api) for url in urls]


# ----------------------------------------------------------------- reporting

RULE = "=" * 72


def print_report(results: Sequence[TranscriptResult]) -> None:
    for r in results:
        print(RULE)
        print(f"{r.kind.upper():<6} {r.url}")
        if r.ok:
            auto = " (auto-generated)" if r.is_generated else ""
            print(
                f"id={r.video_id}  lang={r.language}{auto}  "
                f"snippets={r.snippets}  chars={len(r.text)}"
            )
            print("-" * 72)
            print(r.preview)
        else:
            print(f"id={r.video_id or '?'}  FAILED")
            print("-" * 72)
            print(f"!! {r.error}")
    print(RULE)
    ok = sum(1 for r in results if r.ok)
    print(f"{ok}/{len(results)} transcripts extracted")


def main(argv: Sequence[str], api: Optional[YouTubeTranscriptApi] = None) -> int:
    urls = list(argv) or PROOF_URLS
    results = extract_all(urls, api=api)
    print_report(results)
    return 0 if all(r.ok for r in results) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
