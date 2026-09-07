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
which backend delivered it — then the first 500 characters of text:

```
========================================================================
VIDEO  https://www.youtube.com/watch?v=dQw4w9WgXcQ
id=dQw4w9WgXcQ  lang=en  snippets=61  chars=2089  via=youtube-transcript-api
------------------------------------------------------------------------
[♪♪♪]
♪ We're no strangers to love ♪
♪ You know the rules
and so do I ♪
…
========================================================================
SHORT  https://www.youtube.com/shorts/uOLqPKuO2Bo
id=uOLqPKuO2Bo  lang=en (auto-generated)  snippets=…  chars=…  via=youtube-transcript-api
------------------------------------------------------------------------
…
========================================================================
3/3 transcripts extracted
```

Exit status is `0` only when every URL yielded a transcript, so it drops
straight into a shell pipeline or CI step. A video with no captions is
reported inline (`!! no captions: …`) and the batch keeps going.

## What has been proven live, and where

The sandbox this was written in cannot reach `youtube.com` at all — its
egress policy allows a short list of hosts — so the live runs happen on a
GitHub-hosted runner. `.github/workflows/youtube-transcripts-proof.yml` runs
the offline suite and then this script against real videos on every push to
this folder, and on demand from the Actions tab with any URLs you type in.
Every run leaves its output in the job log and as a `transcript-proof`
artifact.

**Standard video: extracted on every run.** 61 snippets, 2089 characters of
the real transcript, first 500 printed. On some runners
`youtube-transcript-api` gets it directly; on others YouTube meets the
library with its sign-in prompt and the yt-dlp fallback (next section)
delivers the identical text through the same formatter.

**Shorts: not from a datacenter IP.** For both Shorts, YouTube answers every
request from the runner with "Sign in to confirm you're not a bot": the
library's request, yt-dlp's, and yt-dlp with a proof-of-origin token
attached. That is YouTube's policy for cloud IP ranges, not a code path — a
Short is parsed to the same 11-character ID and fetched exactly like a video,
and the offline suite covers that path. From a normal home or office
connection the script runs as-is. The workflow therefore requires the video
step and marks the Shorts step informational (it runs, it prints, it is
allowed to fail on the runner).

## Two backends, one output

1. **`youtube-transcript-api`** — the primary, and the whole story on a
   normal connection. Fetches the transcript, prefers human-written captions
   over auto-generated within the requested languages, falls back to the
   first language YouTube lists.
2. **yt-dlp** — used only when the primary raises `RequestBlocked` /
   `IpBlocked`, which is YouTube's answer to most datacenter IPs. yt-dlp can
   present a proof-of-origin token from a small provider running alongside
   it; the `bgutil-ytdlp-pot-provider` plugin in `requirements.txt` finds
   that provider automatically once it is up:

   ```sh
   docker run -d -p 4416:4416 brainicism/bgutil-ytdlp-pot-provider
   ```

   The chosen caption track is fetched in YouTube's json3 form, rebuilt as a
   `FetchedTranscript`, and handed to the unchanged `TextFormatter`, so the
   text is identical and only the `via=` field differs.

`probe_clients.py` is the diagnostic behind those findings: from any machine
it reports what the watch page, each InnerTube client, and yt-dlp return for
a video, so you can see what a given network gets before planning a bulk run.

## Prove it without the network

```sh
python3 -m unittest -v test_yt_transcripts
```

21 tests, all offline. URL parsing across every shape (`watch?v=`,
`/shorts/`, `youtu.be/`, `/embed/`, `/live/`, mobile and music hosts, extra
params, missing scheme, bare ID) plus the rejects; the fetch path against a
stand-in for `YouTubeTranscriptApi` that returns real `FetchedTranscript`
objects, so the library's `TextFormatter` is the genuine article; the
fallback wiring (a block triggers it, success never touches it, a double
failure names both causes); and the json3 rebuild (spoken-language track
preferred over machine translations, human captions over auto, filler events
dropped, timings kept).

## What's inside

| file | role |
|---|---|
| `yt_transcripts.py` | `extract_video_id(url)` → `fetch_transcript(id)` (primary) / `fetch_transcript_ytdlp(id)` (fallback) → `extract(url)` → `extract_all(urls)`; `main()` prints the report |
| `test_yt_transcripts.py` | offline proof, stdlib `unittest` |
| `probe_clients.py` | what does this network get from YouTube? one line per client |
| `requirements.txt` | `youtube-transcript-api` pinned `<2`; `yt-dlp` and the PO-token plugin for the fallback |
| `../.github/workflows/youtube-transcripts-proof.yml` | the live run on a hosted runner |

## Two things to know before the bulk run

**The library moved to a new API at 1.0.** The classic snippet
`YouTubeTranscriptApi.get_transcript(video_id)` is gone; it is now
`YouTubeTranscriptApi().fetch(video_id)` returning a `FetchedTranscript`.
This script targets the current API and the requirement is pinned `<2`.

**Where the bulk job runs decides what it gets.** From a laptop on a normal
connection, `youtube-transcript-api` alone does the work; pace the run, since
thousands of requests from one address invite the same sign-in prompt. From a
server, expect the prompt for many videos and all Shorts even with the
fallback; the library accepts a proxy (`WebshareProxyConfig` /
`GenericProxyConfig` in `youtube_transcript_api.proxies`, passed as
`YouTubeTranscriptApi(proxy_config=…)`) if the job must live in the cloud.

## Next step (not this sprint)

`extract_all()` takes any iterable of URLs or bare IDs, so the bulk pass is
`extract_all(ids_from_csv_or_db)` plus writing `result.text` somewhere. The
channel → video-ID discovery (Takeout CSV or the channel RSS feeds
`https://www.youtube.com/feeds/videos.xml?channel_id=…`) stays separate.
