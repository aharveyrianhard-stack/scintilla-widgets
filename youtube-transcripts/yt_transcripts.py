#!/usr/bin/env python3
"""YouTube transcript extraction — proof of concept.

Takes a list of YouTube URLs (standard videos *and* Shorts), isolates the
11-character video ID from each, pulls the transcript, and prints the first
500 characters of each so the extraction is visibly proven. With ``--out`` it
also writes the full transcript in every supported shape — plain text,
timestamped text, SRT, WebVTT, JSON — so the capture is usable downstream.

    pip install -r requirements.txt
    python3 yt_transcripts.py                                # hardcoded proof list
    python3 yt_transcripts.py URL [URL ...]                  # any URLs / bare IDs
    python3 yt_transcripts.py --format timestamped --out captures URL ...

Exit status is 0 only when every URL yielded a transcript.

Three backends, one output:

1. youtube-transcript-api (primary). No key, no OAuth. From a normal
   connection this is the whole story.
2. yt-dlp (fallback). When YouTube meets the primary with "Sign in to confirm
   you're not a bot" — its standard reply to datacenter IPs — the same caption
   track is fetched through yt-dlp, which can present a proof-of-origin token
   from a bgutil provider running alongside, and honours a cookies file or a
   proxy when configured (see README).
3. Gemini (fallback, optional). Google's own route: with GEMINI_API_KEY set,
   the Gemini API watches the video from its YouTube URL and returns timed
   segments. It needs no caption track, is not subject to the bot check, and
   works for Shorts. It costs tokens.

Every backend ends in the library's FetchedTranscript, so the same formatters
render the same shapes, and the report names which backend delivered it.

Note on the library version: the pre-1.0 API was the class-level
``YouTubeTranscriptApi.get_transcript(video_id)``. Since 1.0 it is an instance
call, ``YouTubeTranscriptApi().fetch(video_id)``, returning a FetchedTranscript.
This script targets the current API (pinned in requirements.txt).
"""
from __future__ import annotations

import argparse
import functools
import json
import os
import re
import sys
from dataclasses import dataclass, field
from typing import Callable, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import parse_qs, urlparse

import requests
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
from youtube_transcript_api.formatters import (
    JSONFormatter,
    SRTFormatter,
    TextFormatter,
    WebVTTFormatter,
)
from youtube_transcript_api.proxies import GenericProxyConfig

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
BACKENDS = ("auto", "library", "ytdlp", "gemini")

FORMATTER = TextFormatter()

# Output shapes: name -> file extension used by --out.
FORMATS: Dict[str, str] = {
    "text": "txt",
    "timestamped": "timestamped.txt",
    "srt": "srt",
    "vtt": "vtt",
    "json": "json",
}

# Access configuration for servers and other addresses YouTube distrusts.
# Both are read from the environment so no credential ever lives in the repo.
ENV_COOKIES = "YT_COOKIES_FILE"   # Netscape cookies file from a signed-in browser (yt-dlp)
ENV_PROXY = "YT_PROXY"            # http(s)://user:pass@host:port, used by both backends
ENV_GEMINI_KEY = "GEMINI_API_KEY"
ENV_GEMINI_MODEL = "GEMINI_MODEL"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

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


def build_api() -> YouTubeTranscriptApi:
    """One library session; routed through YT_PROXY when that is set."""
    proxy = os.environ.get(ENV_PROXY)
    if proxy:
        return YouTubeTranscriptApi(
            proxy_config=GenericProxyConfig(http_url=proxy, https_url=proxy)
        )
    return YouTubeTranscriptApi()


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
    api = api or build_api()
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


def ytdlp_options(languages: Iterable[str]) -> dict:
    """yt-dlp options: captions only, quiet, plus the access config from the environment."""
    options = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": list(languages),
        "quiet": True,
        "no_warnings": True,
    }
    cookies = os.environ.get(ENV_COOKIES)
    if cookies:
        options["cookiefile"] = cookies
    proxy = os.environ.get(ENV_PROXY)
    if proxy:
        options["proxy"] = proxy
    return options


def fetch_transcript_ytdlp(
    video_id: str,
    languages: Iterable[str] = PREFERRED_LANGUAGES,
    ydl_factory: Optional[Callable] = None,
) -> FetchedTranscript:
    """Fallback for networks YouTube bot-checks: the same captions via yt-dlp.

    From a datacenter IP YouTube's player answers youtube-transcript-api's
    request with "Sign in to confirm you're not a bot" for most videos. yt-dlp
    can present a proof-of-origin token from a bgutil provider running next
    to it (see README), and uses YT_COOKIES_FILE / YT_PROXY when set. The
    chosen track is fetched in YouTube's json3 form and rebuilt as a
    FetchedTranscript, so the unchanged formatters do the formatting and
    nothing downstream knows which backend ran.
    """
    import yt_dlp  # optional dependency, imported only when the fallback runs

    with (ydl_factory or yt_dlp.YoutubeDL)(ytdlp_options(languages)) as ydl:
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


# -------------------------------------------------------- fallback: Gemini

GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)
GEMINI_PROMPT = (
    "Transcribe every spoken word in this video verbatim, in the language that is "
    "spoken. Return JSON only, of the form {\"language_code\": <BCP-47 code of the "
    "spoken language>, \"segments\": [{\"start\": <seconds>, \"end\": <seconds>, "
    "\"text\": <the words>}]}. Split segments at natural phrase boundaries of "
    "roughly one sentence each. Timestamps are seconds from the start of the video, "
    "as numbers. No commentary, no summary, no speaker labels."
)
GEMINI_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "language_code": {"type": "STRING"},
        "segments": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "start": {"type": "NUMBER"},
                    "end": {"type": "NUMBER"},
                    "text": {"type": "STRING"},
                },
                "required": ["start", "end", "text"],
            },
        },
    },
    "required": ["language_code", "segments"],
}


def gemini_request(video_id: str, model: str) -> Tuple[str, dict]:
    """The (url, JSON body) of the Gemini call for one video — kept separate so it can be inspected."""
    body = {
        "contents": [{
            "parts": [
                {"fileData": {"fileUri": WATCH_URL.format(video_id)}},
                {"text": GEMINI_PROMPT},
            ]
        }],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "responseSchema": GEMINI_SCHEMA,
        },
    }
    return GEMINI_ENDPOINT.format(model=model), body


def fetch_transcript_gemini(
    video_id: str,
    languages: Iterable[str] = PREFERRED_LANGUAGES,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    post: Optional[Callable] = None,
) -> FetchedTranscript:
    """Google's own route: Gemini watches the video and returns timed segments.

    Given a YouTube URL as ``fileData``, the Gemini API transcribes the audio
    itself — no caption track, no bot check, Shorts included, from any
    address. It needs GEMINI_API_KEY and spends tokens on the video. The
    reply is validated against a JSON schema and rebuilt as a
    FetchedTranscript so the same formatters apply.
    """
    api_key = api_key or os.environ.get(ENV_GEMINI_KEY, "")
    if not api_key:
        raise LookupError(f"{ENV_GEMINI_KEY} is not set")
    model = model or os.environ.get(ENV_GEMINI_MODEL) or DEFAULT_GEMINI_MODEL
    url, body = gemini_request(video_id, model)
    response = (post or requests.post)(
        url,
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json=body,
        timeout=600,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Gemini API HTTP {response.status_code}: "
            f"{' '.join(str(response.text).split())[:200]}"
        )
    payload = response.json()
    try:
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as err:
        raise RuntimeError(
            f"Gemini API returned no transcript text: {json.dumps(payload)[:200]}"
        ) from err
    data = json.loads(text)
    snippets: List[FetchedTranscriptSnippet] = []
    for seg in data.get("segments") or []:
        words = str(seg.get("text", "")).strip()
        if not words:
            continue
        start = float(seg.get("start") or 0.0)
        end = float(seg.get("end") or start)
        snippets.append(
            FetchedTranscriptSnippet(text=words, start=start, duration=max(0.0, end - start))
        )
    if not snippets:
        raise LookupError("Gemini returned no segments for this video")
    code = str(data.get("language_code") or next(iter(languages), "und"))
    return FetchedTranscript(
        snippets=snippets,
        video_id=video_id,
        language=f"{code} (Gemini transcription)",
        language_code=code,
        is_generated=True,
    )


# ------------------------------------------------------------ backend chain

_DEFAULT = object()  # "use the configured default" sentinel for fetcher arguments


def default_ytdlp_fetcher(languages: Iterable[str]) -> Fetcher:
    return functools.partial(fetch_transcript_ytdlp, languages=languages)


def default_gemini_fetcher(languages: Iterable[str]) -> Optional[Fetcher]:
    """Gemini joins the chain only when its key is present."""
    if os.environ.get(ENV_GEMINI_KEY):
        return functools.partial(fetch_transcript_gemini, languages=languages)
    return None


class FallbackFailed(Exception):
    """The primary was bot-checked and no fallback delivered either."""

    def __init__(self, blocked: RequestBlocked, attempts: List[Tuple[str, Optional[Exception]]]):
        super().__init__("; ".join(f"{name}: {err}" for name, err in attempts))
        self.blocked = blocked
        self.attempts = attempts  # (backend name, error or None when not configured)


def _fetch_with_fallback(
    video_id: str,
    api: Optional[YouTubeTranscriptApi],
    fallback: Optional[Fetcher],
    gemini: Optional[Fetcher],
    backend: str = "auto",
    languages: Iterable[str] = PREFERRED_LANGUAGES,
) -> Tuple[FetchedTranscript, str]:
    """Run one forced backend, or the chain: library, then yt-dlp, then Gemini.

    Returns (transcript, backend name). Only YouTube's bot check moves the
    chain along; every other failure of the primary is final and reported
    as such, since a video without captions has none for yt-dlp either.
    """
    if backend == "library":
        return fetch_transcript(video_id, api, languages), "youtube-transcript-api"
    if backend == "ytdlp":
        if fallback is None:
            raise LookupError("the yt-dlp backend is not configured")
        return fallback(video_id), "yt-dlp"
    if backend == "gemini":
        if gemini is None:
            raise LookupError(f"the Gemini backend needs {ENV_GEMINI_KEY}")
        return gemini(video_id), "gemini"
    if backend != "auto":
        raise ValueError(f"unknown backend {backend!r}; choose from {', '.join(BACKENDS)}")

    try:
        return fetch_transcript(video_id, api, languages), "youtube-transcript-api"
    except RequestBlocked as blocked:  # IpBlocked is a subclass
        attempts: List[Tuple[str, Optional[Exception]]] = []
        for name, fetcher in (("yt-dlp", fallback), ("gemini", gemini)):
            if fetcher is None:
                attempts.append((name, None))
                continue
            try:
                return fetcher(video_id), name
            except Exception as err:  # noqa: BLE001 — reported next to the block that caused it
                attempts.append((name, err))
        raise FallbackFailed(blocked, attempts)


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
    fetched: Optional[FetchedTranscript] = field(default=None, repr=False)

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


def _attempts_report(attempts: List[Tuple[str, Optional[Exception]]]) -> str:
    parts = []
    for name, err in attempts:
        if err is None:
            hint = f" ({ENV_GEMINI_KEY} unset)" if name == "gemini" else ""
            parts.append(f"{name}: not configured{hint}")
        else:
            parts.append(f"{name} fallback: {type(err).__name__}: {_brief(err)}")
    return "; ".join(parts)


def extract(
    url: str,
    api: Optional[YouTubeTranscriptApi] = None,
    fallback: Optional[Fetcher] = _DEFAULT,  # type: ignore[assignment]
    gemini: Optional[Fetcher] = _DEFAULT,  # type: ignore[assignment]
    backend: str = "auto",
    languages: Iterable[str] = PREFERRED_LANGUAGES,
) -> TranscriptResult:
    """Parse one URL, fetch its transcript, and report — never raises."""
    languages = tuple(languages)
    if fallback is _DEFAULT:
        fallback = default_ytdlp_fetcher(languages)
    if gemini is _DEFAULT:
        gemini = default_gemini_fetcher(languages)

    result = TranscriptResult(url=url, kind=url_kind(url))
    try:
        result.video_id = extract_video_id(url)
    except ValueError as bad:
        result.error = f"bad URL: {bad}"
        return result

    try:
        fetched, used = _fetch_with_fallback(
            result.video_id, api, fallback, gemini, backend, languages
        )
    except TranscriptsDisabled:
        result.error = "no captions: the uploader disabled transcripts for this video"
    except NoTranscriptFound:
        result.error = "no captions: no transcript in any language"
    except FallbackFailed as failed:
        result.error = f"{_blocked_message(failed.blocked)}; {_attempts_report(failed.attempts)}"
    except RequestBlocked as blocked:
        result.error = f"{_blocked_message(blocked)}; backend forced to {backend}, no fallback tried"
    except VideoUnavailable:
        result.error = "video unavailable: private, deleted, or region-locked"
    except CouldNotRetrieveTranscript as err:
        result.error = f"{type(err).__name__}: {_brief(err)}"
    except Exception as err:  # noqa: BLE001 — network faults must not stop the batch
        result.error = f"{type(err).__name__}: {_brief(err)}"
    else:
        result.fetched = fetched
        result.text = FORMATTER.format_transcript(fetched)
        result.language = fetched.language_code
        result.is_generated = fetched.is_generated
        result.snippets = len(fetched.snippets)
        result.backend = used
        result.ok = True
    return result


def extract_all(
    urls: Iterable[str],
    api: Optional[YouTubeTranscriptApi] = None,
    fallback: Optional[Fetcher] = _DEFAULT,  # type: ignore[assignment]
    gemini: Optional[Fetcher] = _DEFAULT,  # type: ignore[assignment]
    backend: str = "auto",
    languages: Iterable[str] = PREFERRED_LANGUAGES,
) -> List[TranscriptResult]:
    languages = tuple(languages)
    api = api or build_api()  # one session, reused across the batch
    if fallback is _DEFAULT:
        fallback = default_ytdlp_fetcher(languages)
    if gemini is _DEFAULT:
        gemini = default_gemini_fetcher(languages)
    return [extract(url, api, fallback, gemini, backend, languages) for url in urls]


# ------------------------------------------------------------------ rendering


def _clock(seconds: float) -> str:
    total = int(seconds)
    hours, rest = divmod(total, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}" if hours else f"{minutes:02d}:{secs:02d}"


def render(fetched: FetchedTranscript, fmt: str = "text") -> str:
    """One transcript in one shape. ``text`` is the sprint's clean block;
    ``timestamped`` prefixes each snippet with its start time; the rest are
    the library's own SRT, WebVTT and JSON formatters."""
    if fmt == "text":
        return FORMATTER.format_transcript(fetched)
    if fmt == "timestamped":
        return "\n".join(f"[{_clock(s.start)}] {s.text}" for s in fetched.snippets)
    if fmt == "srt":
        return SRTFormatter().format_transcript(fetched)
    if fmt == "vtt":
        return WebVTTFormatter().format_transcript(fetched)
    if fmt == "json":
        return JSONFormatter().format_transcript(fetched, indent=2, ensure_ascii=False)
    raise ValueError(f"unknown format {fmt!r}; choose from {', '.join(FORMATS)}")


def write_captures(result: TranscriptResult, out_dir: str) -> List[str]:
    """Write a successful result in every format into ``out_dir``; return the paths."""
    if not result.ok or result.fetched is None:
        return []
    os.makedirs(out_dir, exist_ok=True)
    paths = []
    for fmt, ext in FORMATS.items():
        path = os.path.join(out_dir, f"{result.video_id}.{ext}")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(render(result.fetched, fmt).rstrip("\n") + "\n")
        paths.append(path)
    return paths


# ----------------------------------------------------------------- reporting

RULE = "=" * 72


def print_report(results: Sequence[TranscriptResult], fmt: str = "text") -> None:
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
            print(render(r.fetched, fmt)[:PREVIEW_CHARS] if r.fetched else r.preview)
        else:
            print(f"id={r.video_id or '?'}  FAILED")
            print("-" * 72)
            print(f"!! {r.error}")
    print(RULE)
    ok = sum(1 for r in results if r.ok)
    print(f"{ok}/{len(results)} transcripts extracted")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract clean transcripts from YouTube videos and Shorts."
    )
    parser.add_argument(
        "urls", nargs="*",
        help="YouTube URLs or bare 11-character IDs (default: the hardcoded proof list)",
    )
    parser.add_argument(
        "--format", choices=list(FORMATS), default="text",
        help="shape of the printed preview (default: text). --out always writes every shape",
    )
    parser.add_argument(
        "--out", metavar="DIR",
        help="write each transcript in full, in every format, into DIR",
    )
    parser.add_argument(
        "--backend", choices=BACKENDS, default="auto",
        help="auto = library, then yt-dlp, then Gemini when GEMINI_API_KEY is set (default)",
    )
    parser.add_argument(
        "--languages", default=",".join(PREFERRED_LANGUAGES),
        help="preferred caption languages, comma-separated (default: en)",
    )
    return parser.parse_args(list(argv))


def main(
    argv: Sequence[str],
    api: Optional[YouTubeTranscriptApi] = None,
    fallback: Optional[Fetcher] = _DEFAULT,  # type: ignore[assignment]
    gemini: Optional[Fetcher] = _DEFAULT,  # type: ignore[assignment]
) -> int:
    args = parse_args(argv)
    urls = args.urls or PROOF_URLS
    languages = tuple(code.strip() for code in args.languages.split(",") if code.strip())
    results = extract_all(
        urls, api=api, fallback=fallback, gemini=gemini,
        backend=args.backend, languages=languages or PREFERRED_LANGUAGES,
    )
    print_report(results, args.format)
    if args.out:
        written = [path for r in results for path in write_captures(r, args.out)]
        print(f"wrote {len(written)} files to {args.out}/")
    return 0 if all(r.ok for r in results) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
