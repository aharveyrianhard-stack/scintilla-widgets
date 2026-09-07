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

Two backends, one output. youtube-transcript-api is tried first. When
YouTube's player refuses it with "Sign in to confirm you're not a bot" — its
standard answer to datacenter IPs such as CI runners and cloud servers — the
same captions are fetched through yt-dlp, which can attach a proof-of-origin
token from a running bgutil provider (see README), and are rebuilt as a
FetchedTranscript so the identical TextFormatter produces the text. The report
names which backend delivered each transcript.

Note on the library version: the pre-1.0 API was the class-level
``YouTubeTranscriptApi.get_transcript(video_id)``. Since 1.0 it is an instance
call, ``YouTubeTranscriptApi().fetch(video_id)``, returning a FetchedTranscript.
This script targets the current API (pinned in requirements.txt).
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import parse_qs, urlparse

from youtube_transcript_api import (
    CouldNotRetrieveTranscript,
    FetchedTranscript,
    FetchedTranscriptSnippet,
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
WATCH_URL = "https://www.youtube.com/watch?v={}"

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


# ------------------------------------------------- primary: youtube-transcript-api


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


# ------------------------------------------------------- fallback: yt-dlp

Fetcher = Callable[[str], FetchedTranscript]
CaptionTable = Dict[str, List[dict]]


def _pick_caption_track(
    manual: CaptionTable, auto: CaptionTable, languages: Iterable[str]
) -> Optional[Tuple[str, List[dict], bool]]:
    """Requested languages first, human-written before auto-generated; else
    the first track of any language. Returns (language_code, formats, is_generated).

    yt-dlp lists the spoken-language auto track as ``<lang>-orig`` and its
    machine translations as ``<lang>``; the original is the one to take.
    """
    for lang in languages:
        if manual.get(lang):
            return lang, manual[lang], False
        for key in (f"{lang}-orig", lang):
            if auto.get(key):
                return lang, auto[key], True
    for table, generated in ((manual, False), (auto, True)):
        for key, formats in table.items():
            if formats:
                return key.removesuffix("-orig"), formats, generated
    return None


def fetch_transcript_ytdlp(
    video_id: str,
    languages: Iterable[str] = PREFERRED_LANGUAGES,
    ydl_factory: Optional[Callable] = None,
) -> FetchedTranscript:
    """Fallback for networks YouTube bot-checks: the same captions via yt-dlp.

    From a datacenter IP YouTube's player answers youtube-transcript-api's
    request with "Sign in to confirm you're not a bot" for most videos. yt-dlp
    can present a proof-of-origin token from a bgutil provider running next
    to it (see README) and is handed the caption tracks anyway. The chosen
    track is fetched in YouTube's json3 form and rebuilt as a
    FetchedTranscript, so the unchanged TextFormatter does the formatting and
    nothing downstream knows which backend ran.
    """
    import yt_dlp  # optional dependency, imported only when the fallback runs

    options = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": list(languages),
        "quiet": True,
        "no_warnings": True,
    }
    with (ydl_factory or yt_dlp.YoutubeDL)(options) as ydl:
        info = ydl.extract_info(WATCH_URL.format(video_id), download=False) or {}
        choice = _pick_caption_track(
            info.get("subtitles") or {}, info.get("automatic_captions") or {}, languages
        )
        if choice is None:
            raise LookupError("yt-dlp saw no caption tracks for this video")
        lang, formats, is_generated = choice
        fmt = next((f for f in formats if f.get("ext") == "json3"), None)
        if fmt is None:
            raise LookupError(
                f"no json3 caption format among {[f.get('ext') for f in formats]}"
            )
        body = ydl.urlopen(fmt["url"]).read()

    snippets: List[FetchedTranscriptSnippet] = []
    for event in json.loads(body).get("events", []):
        text = "".join(seg.get("utf8", "") for seg in event.get("segs") or []).strip()
        if text:  # json3 pads auto-captions with newline-only filler events
            snippets.append(
                FetchedTranscriptSnippet(
                    text=text,
                    start=event.get("tStartMs", 0) / 1000.0,
                    duration=event.get("dDurationMs", 0) / 1000.0,
                )
            )
    return FetchedTranscript(
        snippets=snippets,
        video_id=video_id,
        language=fmt.get("name") or lang,
        language_code=lang,
        is_generated=is_generated,
    )


class FallbackFailed(Exception):
    """The primary was bot-checked and the fallback did not deliver either."""

    def __init__(self, blocked: RequestBlocked, fallback_error: Exception):
        super().__init__(str(fallback_error))
        self.blocked = blocked
        self.fallback_error = fallback_error


def _fetch_with_fallback(
    video_id: str, api: Optional[YouTubeTranscriptApi], fallback: Optional[Fetcher]
) -> Tuple[FetchedTranscript, str]:
    """Primary first; on YouTube's bot check, the fallback. Returns (transcript, backend)."""
    try:
        return fetch_transcript(video_id, api), "youtube-transcript-api"
    except RequestBlocked as blocked:  # IpBlocked is a subclass
        if fallback is None:
            raise
        try:
            return fallback(video_id), "yt-dlp"
        except Exception as err:  # noqa: BLE001 — reported next to the block that caused it
            raise FallbackFailed(blocked, err) from err


# ------------------------------------------------------------------ extraction


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
    backend: str = ""
    error: str = ""

    @property
    def preview(self) -> str:
        return self.text[:PREVIEW_CHARS]


def _brief(err: Exception, limit: int = 160) -> str:
    text = " ".join(str(err).split())
    return text if len(text) <= limit else text[:limit] + "…"


def _blocked_message(blocked: RequestBlocked) -> str:
    return (
        f"{type(blocked).__name__}: YouTube met this IP with its bot check "
        "(cloud/datacenter ranges are routinely told to sign in to prove they "
        "are not a bot)"
    )


def extract(
    url: str,
    api: Optional[YouTubeTranscriptApi] = None,
    fallback: Optional[Fetcher] = fetch_transcript_ytdlp,
) -> TranscriptResult:
    """Parse one URL, fetch its transcript, and report — never raises."""
    result = TranscriptResult(url=url, kind=url_kind(url))
    try:
        result.video_id = extract_video_id(url)
    except ValueError as bad:
        result.error = f"bad URL: {bad}"
        return result

    try:
        fetched, backend = _fetch_with_fallback(result.video_id, api, fallback)
    except TranscriptsDisabled:
        result.error = "no captions: the uploader disabled transcripts for this video"
    except NoTranscriptFound:
        result.error = "no captions: no transcript in any language"
    except FallbackFailed as both:
        result.error = (
            f"{_blocked_message(both.blocked)}; yt-dlp fallback: "
            f"{type(both.fallback_error).__name__}: {_brief(both.fallback_error)}"
        )
    except RequestBlocked as blocked:
        result.error = f"{_blocked_message(blocked)}; no fallback configured"
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
        result.backend = backend
        result.ok = True
    return result


def extract_all(
    urls: Iterable[str],
    api: Optional[YouTubeTranscriptApi] = None,
    fallback: Optional[Fetcher] = fetch_transcript_ytdlp,
) -> List[TranscriptResult]:
    api = api or YouTubeTranscriptApi()  # one session, reused across the batch
    return [extract(url, api, fallback) for url in urls]


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
                f"snippets={r.snippets}  chars={len(r.text)}  via={r.backend}"
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


def main(
    argv: Sequence[str],
    api: Optional[YouTubeTranscriptApi] = None,
    fallback: Optional[Fetcher] = fetch_transcript_ytdlp,
) -> int:
    urls = list(argv) or PROOF_URLS
    results = extract_all(urls, api=api, fallback=fallback)
    print_report(results)
    return 0 if all(r.ok for r in results) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
