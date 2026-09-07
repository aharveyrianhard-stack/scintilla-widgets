# YouTube transcript extraction — proof of concept

Pulls clean, timestamp-free transcript text from **standard YouTube videos and
YouTube Shorts** with `youtube-transcript-api`. No Data API key, no OAuth.
This is the extraction primitive for the AI workflow; the bulk run over
subscribed channels comes later and only needs to feed video IDs in.

## Run it

```sh
cd youtube-transcripts
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

python3 yt_transcripts.py                       # hardcoded proof list (1 video + 2 Shorts)
python3 yt_transcripts.py 'https://www.youtube.com/shorts/…' 'https://youtu.be/…'   # your own
```

Each URL prints as a block — kind, ID, language, snippet count, total chars,
then the first 500 characters of text:

```
========================================================================
VIDEO  https://www.youtube.com/watch?v=dQw4w9WgXcQ
id=dQw4w9WgXcQ  lang=en  snippets=61  chars=1980
------------------------------------------------------------------------
We're no strangers to love
You know the rules and so do I
…
========================================================================
SHORT  https://www.youtube.com/shorts/…
id=…  lang=en (auto-generated)  snippets=…  chars=…
------------------------------------------------------------------------
…
========================================================================
2/2 transcripts extracted
```

The hardcoded Shorts were picked from search results, not live-checked —
YouTube is unreachable from the sandbox this was written in — so swap in any
Short from your own subscriptions if either has since lost its captions.

Exit status is `0` only when every URL yielded a transcript, so it drops
straight into a shell pipeline or CI step. A video with no captions is
reported inline (`!! no captions: …`) and the batch keeps going.

## Prove it without the network

```sh
python3 -m unittest -v test_yt_transcripts
```

The suite runs offline. URL parsing is exercised across every shape
(`watch?v=`, `/shorts/`, `youtu.be/`, `/embed/`, `/live/`, mobile and music
hosts, extra params, missing scheme, bare ID) plus the rejects. The fetch path
runs against a stand-in for `YouTubeTranscriptApi` that returns real
`FetchedTranscript` objects, so the library's `TextFormatter` — the part that
strips timestamps — is the genuine article, and every error branch (captions
disabled, no transcript, IP blocked, bad URL, network fault) is shown to be
contained rather than raised.

## What's inside

| file | role |
|---|---|
| `yt_transcripts.py` | `extract_video_id(url)` → `fetch_transcript(id)` → `extract(url)` → `extract_all(urls)`; `main()` prints the report |
| `test_yt_transcripts.py` | offline proof, stdlib `unittest` |
| `requirements.txt` | `youtube-transcript-api>=1.2.4,<2` |

Shorts and videos share the same 11-character ID space; only the URL shape
differs. Nothing downstream of `extract_video_id` knows or cares which it was.

English is preferred (`fetch()` already prefers human-written captions over
auto-generated within that). If a video has captions but none in English, the
first transcript YouTube lists is taken instead and its language is reported
next to the text — better to hand the AI workflow Spanish than nothing.

## Two things to know before the bulk run

**The library moved to a new API at 1.0.** The classic snippet
`YouTubeTranscriptApi.get_transcript(video_id)` is gone; it is now
`YouTubeTranscriptApi().fetch(video_id)` returning a `FetchedTranscript`.
This script targets the current API and the requirement is pinned `<2`.

**YouTube blocks most cloud/datacenter IPs.** Requests from AWS, GCP, Azure,
hosted CI, and sandboxes like the one this was written in come back as
`RequestBlocked` / `IpBlocked`. The script names that case explicitly. Run
the live proof from a laptop on a normal connection; if the bulk job ends up
on a server it needs a rotating residential proxy (`youtube_transcript_api.proxies`
has a `WebshareProxyConfig` and a `GenericProxyConfig` — pass one to
`YouTubeTranscriptApi(proxy_config=…)`). Even from home, pace a bulk run;
hammering thousands of IDs from one IP invites the same block.

## Next step (not this sprint)

`extract_all()` takes any iterable of URLs or bare IDs, so the bulk pass is
`extract_all(ids_from_csv_or_db)` plus writing `result.text` somewhere. The
channel → video-ID discovery (Takeout CSV or the channel RSS feeds
`https://www.youtube.com/feeds/videos.xml?channel_id=…`) stays separate.
