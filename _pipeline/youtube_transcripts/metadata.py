"""YouTube Data API v3 metadata retrieval (pipeline step 2).

Quota shape that drives the design:

  * videos.list costs 1 unit per *call*, not per video, and accepts up to 50
    comma-separated ids. Batching is therefore a 50x quota saving and the
    default here, not an optimization to add later.
  * playlistItems.list costs 1 unit and drives the cron fallback poll.
  * The uploads playlist id is derivable from the channel id (UC... -> UU...),
    so the usual channels.list lookup is skipped entirely for 0 units.
  * captions.download costs 200 units *and* requires channel ownership, which
    is why subtitles come from yt-dlp instead.

Two response quirks the API documents and callers routinely get wrong:
statistics values are strings, and contentDetails.caption is the string
"true"/"false" rather than a boolean. Both are normalized here once.
"""

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Dict, Iterable, List, Optional

from .ratelimit import CircuitBreaker, RateLimiter, retry_with_backoff

__all__ = [
    "API_ROOT",
    "MAX_IDS_PER_REQUEST",
    "QUOTA_COST",
    "YouTubeAPIError",
    "QuotaExceeded",
    "TransientAPIError",
    "parse_iso8601_duration",
    "uploads_playlist_id",
    "normalize_video",
    "YouTubeDataAPI",
]

API_ROOT = "https://www.googleapis.com/youtube/v3/"
MAX_IDS_PER_REQUEST = 50
QUOTA_COST = {"videos.list": 1, "playlistItems.list": 1, "search.list": 100}

_ISO_DURATION = re.compile(
    r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$"
)


class YouTubeAPIError(RuntimeError):
    """A non-retryable API failure."""


class QuotaExceeded(YouTubeAPIError):
    """Daily quota is spent; retrying today cannot help."""


class TransientAPIError(RuntimeError):
    """A retryable API failure (5xx, 429, transport error)."""


def parse_iso8601_duration(value: Optional[str]) -> Optional[int]:
    """ISO 8601 duration -> whole seconds. None for live/unset/unparseable."""
    if not value or not isinstance(value, str):
        return None
    match = _ISO_DURATION.match(value.strip())
    if not match:
        return None
    days, hours, minutes, seconds = match.groups()
    total = (
        int(days or 0) * 86400
        + int(hours or 0) * 3600
        + int(minutes or 0) * 60
        + float(seconds or 0)
    )
    return int(total)


def uploads_playlist_id(channel_id: str) -> str:
    """Derive the uploads playlist id from a channel id, costing no quota."""
    if not channel_id or not channel_id.startswith("UC"):
        raise ValueError(
            "expected a UC-prefixed channel id, got {0!r}".format(channel_id)
        )
    return "UU" + channel_id[2:]


def _int_or_none(value: Any) -> Optional[int]:
    """statistics.* arrive as strings, and are absent when the owner hides them."""
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_video(item: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten one videos.list item into the shape the contract stores."""
    snippet = item.get("snippet") or {}
    statistics = item.get("statistics") or {}
    content = item.get("contentDetails") or {}
    thumbnails = snippet.get("thumbnails") or {}
    thumb = (
        thumbnails.get("maxres")
        or thumbnails.get("high")
        or thumbnails.get("medium")
        or thumbnails.get("default")
        or {}
    )
    # Documented as the strings "true"/"false", never a JSON boolean.
    caption_flag = str(content.get("caption", "")).lower() == "true"
    live = snippet.get("liveBroadcastContent") or "none"
    return {
        "video_id": item.get("id"),
        "channel_id": snippet.get("channelId"),
        "channel_title": snippet.get("channelTitle"),
        "title": snippet.get("title"),
        "description": snippet.get("description"),
        "published_at": snippet.get("publishedAt"),
        "thumbnail": thumb.get("url"),
        "tags": snippet.get("tags") or [],
        "category_id": snippet.get("categoryId"),
        "default_language": snippet.get("defaultLanguage"),
        "default_audio_language": snippet.get("defaultAudioLanguage"),
        "live_broadcast_content": live,
        "is_live": live in ("live", "upcoming"),
        "duration_sec": parse_iso8601_duration(content.get("duration")),
        "has_caption_track": caption_flag,
        "licensed_content": bool(content.get("licensedContent", False)),
        "definition": content.get("definition"),
        "projection": content.get("projection"),
        "view_count": _int_or_none(statistics.get("viewCount")),
        "like_count": _int_or_none(statistics.get("likeCount")),
        "comment_count": _int_or_none(statistics.get("commentCount")),
        "favorite_count": _int_or_none(statistics.get("favoriteCount")),
    }


def _default_transport(url: str, timeout: float) -> Dict[str, Any]:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        raise _classify_http_error(exc.code, body) from exc
    except urllib.error.URLError as exc:
        raise TransientAPIError("transport failure: {0}".format(exc.reason)) from exc


def _classify_http_error(status: int, body: str) -> BaseException:
    reason = ""
    try:
        parsed = json.loads(body)
        errors = (parsed.get("error") or {}).get("errors") or []
        if errors:
            reason = errors[0].get("reason", "")
    except (ValueError, AttributeError):
        pass
    if status == 403 and reason in ("quotaExceeded", "dailyLimitExceeded"):
        return QuotaExceeded("YouTube daily quota exhausted ({0})".format(reason))
    if status == 429 or reason in ("rateLimitExceeded", "userRateLimitExceeded"):
        return TransientAPIError("rate limited ({0})".format(reason or status))
    if status >= 500:
        return TransientAPIError("upstream {0}".format(status))
    return YouTubeAPIError("HTTP {0}{1}".format(status, ": " + reason if reason else ""))


class YouTubeDataAPI:
    """Quota-aware Data API v3 client with spacing and a breaker in front."""

    def __init__(
        self,
        api_key: str,
        rate_limiter: Optional[RateLimiter] = None,
        breaker: Optional[CircuitBreaker] = None,
        transport: Optional[Callable[[str, float], Dict[str, Any]]] = None,
        timeout: float = 20.0,
        sleeper: Optional[Callable[[float], None]] = None,
    ):
        if not api_key:
            raise ValueError("a YouTube Data API key is required")
        self.api_key = api_key
        self.rate_limiter = rate_limiter or RateLimiter(min_interval=0.2, jitter=0.1)
        self.breaker = breaker or CircuitBreaker(failure_threshold=5, reset_timeout=300)
        self.transport = transport or _default_transport
        self.timeout = timeout
        self.quota_spent = 0
        self._sleeper = sleeper

    def _get(self, resource: str, params: Dict[str, str]) -> Dict[str, Any]:
        """Call one Data API resource.

        `resource` is the URL path segment ("videos"), while quota is booked
        against the documented method name ("videos.list"). Conflating the two
        builds a request for /youtube/v3/videos.list, which returns 404.
        """
        query = dict(params)
        query["key"] = self.api_key
        url = API_ROOT + resource + "?" + urllib.parse.urlencode(query)

        def once() -> Dict[str, Any]:
            self.rate_limiter.acquire()
            return self.breaker.call(self.transport, url, self.timeout)

        retry_kwargs: Dict[str, Any] = {
            "attempts": 4,
            "base_delay": 2.0,
            "retry_on": (TransientAPIError,),
            "give_up_on": (QuotaExceeded, YouTubeAPIError),
        }
        if self._sleeper is not None:
            retry_kwargs["sleeper"] = self._sleeper
        result = retry_with_backoff(once, **retry_kwargs)
        self.quota_spent += QUOTA_COST.get(resource + ".list", 1)
        return result

    def fetch_videos(self, video_ids: Iterable[str]) -> Dict[str, Dict[str, Any]]:
        """Fetch metadata for any number of ids, 50 per quota unit.

        Ids YouTube does not return (deleted, private, bad id) are simply
        absent from the result rather than raising, so one dead id in a sweep
        cannot fail the batch around it.
        """
        unique: List[str] = []
        seen = set()
        for video_id in video_ids:
            if video_id and video_id not in seen:
                seen.add(video_id)
                unique.append(video_id)

        out: Dict[str, Dict[str, Any]] = {}
        for start in range(0, len(unique), MAX_IDS_PER_REQUEST):
            batch = unique[start : start + MAX_IDS_PER_REQUEST]
            body = self._get(
                "videos",
                {
                    "part": "snippet,statistics,contentDetails",
                    "id": ",".join(batch),
                    "maxResults": str(len(batch)),
                },
            )
            for item in body.get("items") or []:
                normalized = normalize_video(item)
                if normalized.get("video_id"):
                    out[normalized["video_id"]] = normalized
        return out

    def recent_uploads(self, channel_id: str, limit: int = 25) -> List[Dict[str, Any]]:
        """List recent uploads for a channel via its uploads playlist.

        Uses playlistItems.list (1 unit) rather than search.list (100 units).
        """
        playlist_id = uploads_playlist_id(channel_id)
        collected: List[Dict[str, Any]] = []
        page_token = None
        while len(collected) < limit:
            params = {
                "part": "contentDetails,snippet",
                "playlistId": playlist_id,
                "maxResults": str(min(50, limit - len(collected))),
            }
            if page_token:
                params["pageToken"] = page_token
            body = self._get("playlistItems", params)
            for item in body.get("items") or []:
                details = item.get("contentDetails") or {}
                snippet = item.get("snippet") or {}
                if details.get("videoId"):
                    collected.append(
                        {
                            "video_id": details["videoId"],
                            "published_at": details.get("videoPublishedAt")
                            or snippet.get("publishedAt"),
                            "title": snippet.get("title"),
                        }
                    )
            page_token = body.get("nextPageToken")
            if not page_token:
                break
        return collected[:limit]
