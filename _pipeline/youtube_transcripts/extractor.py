"""Subtitle ingestion via yt-dlp (pipeline step 3).

Captions only: no audio or video stream is ever requested, so a two-hour
upload costs a few tens of kilobytes.

Two things the naive version of this gets wrong:

  * The written filename is guessed as "<id>.<lang>.vtt". yt-dlp actually
    writes whatever language tag it matched -- ".en-orig.vtt", ".en-US.vtt",
    ".en-GB.vtt" -- so the guess misses and the caller reports "no subtitles"
    for a video that has them. The real path is read back from the info dict,
    with a glob as backstop.
  * "This video has no captions" is a permanent fact, not a transient error.
    Retrying it burns the budget and the request allowance for nothing, so it
    is raised as its own non-retryable type.

yt_dlp is imported lazily and the factory is injectable, which keeps the
offline self-test suite runnable with nothing installed.
"""

import glob
import os
import shutil
import tempfile
from typing import Any, Callable, Dict, List, Optional, Tuple

from .ratelimit import CircuitBreaker, RateLimiter

__all__ = [
    "NoCaptionsAvailable",
    "SubtitleDownloadError",
    "watch_url",
    "resolve_subtitle_path",
    "SubtitleExtractor",
]


class NoCaptionsAvailable(RuntimeError):
    """The video exists but exposes no usable caption track. Do not retry."""


class SubtitleDownloadError(RuntimeError):
    """A retryable failure while fetching subtitles."""


def watch_url(video_id_or_url: str) -> str:
    """Accept a bare video id or any watch URL and return a canonical URL."""
    value = (video_id_or_url or "").strip()
    if not value:
        raise ValueError("a video id or URL is required")
    if value.startswith("http://") or value.startswith("https://"):
        return value
    return "https://www.youtube.com/watch?v=" + value


def resolve_subtitle_path(
    outdir: str, video_id: str, lang: str, info: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """Find the subtitle file yt-dlp actually wrote."""
    requested = (info or {}).get("requested_subtitles") or {}
    # Exact language first, then any regional/original variant of it.
    ordered_keys = [lang] + [
        key for key in requested if key != lang and str(key).startswith(lang)
    ]
    for key in ordered_keys:
        entry = requested.get(key) or {}
        filepath = entry.get("filepath")
        if filepath and os.path.exists(filepath):
            return filepath

    patterns = [
        os.path.join(outdir, "{0}.{1}.vtt".format(video_id, lang)),
        os.path.join(outdir, "{0}.{1}*.vtt".format(video_id, lang)),
        os.path.join(outdir, "{0}*.vtt".format(video_id)),
    ]
    for pattern in patterns:
        matches = sorted(glob.glob(pattern))
        if matches:
            return matches[0]
    return None


class SubtitleExtractor:
    """Fetches caption tracks, leaving nothing on disk."""

    def __init__(
        self,
        lang: str = "en",
        rate_limiter: Optional[RateLimiter] = None,
        breaker: Optional[CircuitBreaker] = None,
        ydl_factory: Optional[Callable[[Dict[str, Any]], Any]] = None,
        socket_timeout: float = 30.0,
    ):
        self.lang = lang
        # YouTube tolerates far less burst on the media host than on the API.
        self.rate_limiter = rate_limiter or RateLimiter(min_interval=2.0, jitter=1.5)
        self.breaker = breaker or CircuitBreaker(failure_threshold=4, reset_timeout=600)
        self.socket_timeout = socket_timeout
        self._ydl_factory = ydl_factory

    def _factory(self) -> Callable[[Dict[str, Any]], Any]:
        if self._ydl_factory is not None:
            return self._ydl_factory
        try:
            import yt_dlp
        except ImportError as exc:  # pragma: no cover - environment dependent
            raise ImportError(
                "yt_dlp is required for live extraction. Run: pip install yt-dlp"
            ) from exc
        return yt_dlp.YoutubeDL

    def build_options(self, outdir: str) -> Dict[str, Any]:
        """yt-dlp options: captions only, never a media stream."""
        return {
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            # Base tag plus regional/original variants; a bare "en" misses
            # the "en-orig" track that auto-captions are often filed under.
            "subtitleslangs": [self.lang, "{0}.*".format(self.lang)],
            "subtitlesformat": "vtt",
            "outtmpl": os.path.join(outdir, "%(id)s.%(ext)s"),
            "paths": {"home": outdir},
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "socket_timeout": self.socket_timeout,
            "retries": 2,
            "ignoreerrors": False,
        }

    def fetch(self, video_id_or_url: str) -> Tuple[str, Dict[str, Any]]:
        """Return (raw_vtt_text, info_dict) and purge every temp artifact.

        Nothing is left behind: the caption text is handed back in memory for
        the caller to stream into object storage.
        """
        url = watch_url(video_id_or_url)
        outdir = tempfile.mkdtemp(prefix="yt-vtt-")
        try:
            self.rate_limiter.acquire()
            info = self.breaker.call(self._download, url, outdir)
            video_id = (info or {}).get("id") or ""
            path = resolve_subtitle_path(outdir, video_id, self.lang, info)
            if not path:
                raise NoCaptionsAvailable(
                    "no {0} caption track for {1}".format(self.lang, url)
                )
            with open(path, "r", encoding="utf-8", errors="replace") as handle:
                return handle.read(), (info or {})
        finally:
            shutil.rmtree(outdir, ignore_errors=True)

    def _download(self, url: str, outdir: str) -> Dict[str, Any]:
        factory = self._factory()
        options = self.build_options(outdir)
        try:
            with factory(options) as ydl:
                return ydl.extract_info(url, download=True)
        except NoCaptionsAvailable:
            raise
        except Exception as exc:
            message = str(exc)
            lowered = message.lower()
            permanent = (
                "video unavailable",
                "private video",
                "has been removed",
                "does not exist",
                "members-only",
                "age-restricted",
            )
            if any(marker in lowered for marker in permanent):
                raise NoCaptionsAvailable(
                    "{0} is not retrievable: {1}".format(url, message)
                ) from exc
            raise SubtitleDownloadError(
                "subtitle fetch failed for {0}: {1}".format(url, message)
            ) from exc

    def available_languages(self, info: Dict[str, Any]) -> List[str]:
        """Every caption tag the video exposes, manual and automatic."""
        tags = set()
        for key in ("subtitles", "automatic_captions"):
            for tag in (info.get(key) or {}):
                tags.add(tag)
        return sorted(tags)
