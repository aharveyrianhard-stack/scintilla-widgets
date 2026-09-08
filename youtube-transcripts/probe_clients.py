#!/usr/bin/env python3
"""Which InnerTube client can fetch captions from *this* network?

YouTube answers the same video differently depending on the client context
in the request and the reputation of the calling IP: a datacenter IP can be
told "Sign in to confirm you're not a bot" for one client and get caption
tracks from another. youtube-transcript-api hardcodes the ANDROID client,
so when it reports RequestBlocked this probe tells you what *would* work
from the same machine. It hits the watch page, then the player endpoint
with each candidate client (and fetches the first caption track it gets),
then yt-dlp, and prints one line per attempt.

    pip install -r requirements.txt yt-dlp
    python3 probe_clients.py URL_OR_ID [URL_OR_ID ...]   # default: the proof list
"""
from __future__ import annotations

import html
import re
import sys
import time

import requests

from yt_transcripts import PROOF_URLS, extract_all, extract_video_id, print_report

WATCH = "https://www.youtube.com/watch?v={}"
PLAYER = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false"
UA_WEB = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
UA_IPAD = (
    "Mozilla/5.0 (iPad; CPU OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
)

# (label, client context, User-Agent). Versions are what the apps shipped in
# 2025; YouTube accepts a range, so exactness is not critical.
CLIENTS = [
    ("ANDROID (library default)",
     {"clientName": "ANDROID", "clientVersion": "20.10.38"},
     "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip"),
    ("IOS",
     {"clientName": "IOS", "clientVersion": "20.10.4", "deviceMake": "Apple",
      "deviceModel": "iPhone16,2", "osName": "iPhone", "osVersion": "18.3.2.22D82"},
     "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)"),
    ("ANDROID_VR",
     {"clientName": "ANDROID_VR", "clientVersion": "1.62.27", "deviceMake": "Oculus",
      "deviceModel": "Quest 3", "osName": "Android", "osVersion": "12L",
      "androidSdkVersion": 32},
     "com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; "
     "eureka-user Build/SQ3A.220605.009.A1) gzip"),
    ("TVHTML5",
     {"clientName": "TVHTML5", "clientVersion": "7.20250312.16.00"},
     "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version"),
    ("TVHTML5_SIMPLY_EMBEDDED_PLAYER",
     {"clientName": "TVHTML5_SIMPLY_EMBEDDED_PLAYER", "clientVersion": "2.0"},
     UA_WEB),
    ("WEB_EMBEDDED_PLAYER",
     {"clientName": "WEB_EMBEDDED_PLAYER", "clientVersion": "1.20250310.01.00"},
     UA_WEB),
    ("MWEB",
     {"clientName": "MWEB", "clientVersion": "2.20250311.03.00"},
     UA_IPAD),
    ("WEB",
     {"clientName": "WEB", "clientVersion": "2.20250312.04.00"},
     UA_WEB),
]

RULE = "=" * 72


def _text_from_timedtext(body: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", body)).split())


def probe_watch_page(session: requests.Session, vid: str) -> None:
    r = session.get(
        WATCH.format(vid),
        headers={"User-Agent": UA_WEB, "Accept-Language": "en-US,en;q=0.9"},
        timeout=30,
    )
    page = r.text
    has_key = "found" if "INNERTUBE_API_KEY" in page else "MISSING"
    recaptcha = 'class="g-recaptcha"' in page
    consent_wall = "consent.youtube.com" in page
    print(
        f"watch page: http={r.status_code} bytes={len(page)} "
        f"INNERTUBE_API_KEY={has_key} recaptcha={recaptcha} consent_wall={consent_wall}"
    )


def probe_client(session: requests.Session, vid: str, label: str, client: dict, ua: str) -> None:
    ctx = {"client": {**client, "hl": "en", "gl": "US"}}
    if "EMBEDDED" in client["clientName"]:
        ctx["thirdParty"] = {"embedUrl": "https://www.youtube.com/"}
    try:
        p = session.post(
            PLAYER,
            json={"context": ctx, "videoId": vid, "contentCheckOk": True, "racyCheckOk": True},
            headers={"User-Agent": ua, "Content-Type": "application/json"},
            timeout=30,
        )
        data = p.json()
    except Exception as err:  # noqa: BLE001 — a probe reports, never raises
        print(f"  {label:<32} player error: {type(err).__name__}: {str(err)[:100]}")
        return
    status = data.get("playabilityStatus", {})
    tracks = (
        data.get("captions", {})
        .get("playerCaptionsTracklistRenderer", {})
        .get("captionTracks", [])
    )
    line = f"  {label:<32} http={p.status_code} playability={status.get('status')} tracks={len(tracks)}"
    if status.get("reason"):
        line += f" reason={status['reason']!r}"
    if tracks:
        track = next((t for t in tracks if t.get("languageCode") == "en"), tracks[0])
        url = track["baseUrl"]
        kind = "asr" if track.get("kind") == "asr" else "manual"
        try:
            tt = session.get(url, headers={"User-Agent": ua}, timeout=30)
            text = _text_from_timedtext(tt.text)
            line += (
                f"\n      timedtext[{track.get('languageCode')} {kind}] http={tt.status_code} "
                f"bytes={len(tt.text)}{' po-token-required(exp=xpe)' if '&exp=xpe' in url else ''}"
            )
            line += f"\n      TEXT: {text[:120]}" if text else "\n      TEXT: (empty body)"
        except Exception as err:  # noqa: BLE001
            line += f"\n      timedtext error: {type(err).__name__}: {str(err)[:100]}"
    print(line)


def probe_ytdlp(vid: str) -> None:
    try:
        import yt_dlp
    except ImportError:
        print("  yt-dlp: not installed (pip install yt-dlp)")
        return
    label = f"yt-dlp {yt_dlp.version.__version__}"
    opts = {
        "skip_download": True, "writesubtitles": True, "writeautomaticsub": True,
        "subtitleslangs": ["en"], "quiet": True, "no_warnings": True,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(WATCH.format(vid), download=False)
    except Exception as err:  # noqa: BLE001
        print(f"  {label:<32} FAILED: {type(err).__name__}: {str(err)[:140]}")
        return
    manual = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}
    print(f"  {label:<32} manual langs={sorted(manual)[:6]} auto langs={len(auto)}")
    for kind, table in (("manual", manual), ("auto", auto)):
        formats = table.get("en") or []
        fmt = next((f for f in formats if f.get("ext") == "json3"), None)
        if not fmt:
            continue
        r = requests.get(fmt["url"], timeout=30)
        try:
            events = [e for e in r.json().get("events", []) if e.get("segs")]
            text = " ".join("".join(s.get("utf8", "") for s in e["segs"]) for e in events)
            print(f"      {kind} en json3 http={r.status_code} events={len(events)} TEXT: {' '.join(text.split())[:120]}")
        except Exception:  # noqa: BLE001
            print(f"      {kind} en json3 http={r.status_code} unparsable: {r.text[:80]!r}")


class _Silent:
    """yt-dlp logger that swallows its own log lines; the report speaks for itself."""

    def debug(self, msg): pass
    def info(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): pass


def sample_shorts(count: int) -> int:
    """Measure, from this machine, whether the bot check applies to Shorts as a class
    or to particular clips: search YouTube for ``count`` Shorts through yt-dlp
    and run the ordinary extraction chain on each. Exit 0 when at least one
    extracts, so the workflow's summary carries the answer."""
    import yt_dlp

    options = {"quiet": True, "no_warnings": True, "extract_flat": True, "logger": _Silent()}
    with yt_dlp.YoutubeDL(options) as ydl:
        found = ydl.extract_info(f"ytsearch{count}:#shorts", download=False) or {}
    ids = [entry["id"] for entry in found.get("entries", []) if entry and entry.get("id")]
    print(f"search returned {len(ids)} Shorts; running the ordinary chain on each")
    results = extract_all([f"https://www.youtube.com/shorts/{video_id}" for video_id in ids])
    print_report(results, "timestamped")
    return 0 if any(r.ok for r in results) else 1


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "--sample-shorts":
        return sample_shorts(int(argv[1]))
    urls = argv or PROOF_URLS
    session = requests.Session()
    for url in urls:
        vid = extract_video_id(url)
        print(RULE)
        print(f"{url}  ->  {vid}")
        probe_watch_page(session, vid)
        for label, client, ua in CLIENTS:
            probe_client(session, vid, label, client, ua)
            time.sleep(0.5)
        probe_ytdlp(vid)
    print(RULE)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
