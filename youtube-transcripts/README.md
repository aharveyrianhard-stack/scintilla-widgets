# YouTube transcript extraction — proof of concept

Pulls transcripts from **standard YouTube videos and YouTube Shorts** and
writes them as clean text, timestamped text, SRT, WebVTT and JSON. No Data
API key, no OAuth. This is the extraction primitive for the AI workflow; the
bulk run over subscribed channels comes later and only needs to feed video
IDs in.

## Run it

```sh
cd youtube-transcripts
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

python3 yt_transcripts.py                                   # hardcoded proof list (1 video + 2 Shorts)
python3 yt_transcripts.py 'https://www.youtube.com/shorts/…' 'https://youtu.be/…'   # your own
python3 yt_transcripts.py --format timestamped --out captures URL …   # usable capture
```

| flag | what it does |
|---|---|
| `--format text\|timestamped\|srt\|vtt\|json` | shape of the printed preview (default `text`, the sprint's clean block) |
| `--out DIR` | writes every transcript in full, in **every** format: `ID.txt`, `ID.timestamped.txt`, `ID.srt`, `ID.vtt`, `ID.json` |
| `--backend auto\|library\|ytdlp\|gemini` | `auto` (default) tries the library, then yt-dlp, then Gemini when a key is set; the others force one route |
| `--languages en,es` | preferred caption languages, in order (default `en`) |

Each URL prints as a block — kind, ID, language, snippet count, total chars,
which backend delivered it — then the first 500 characters in the chosen shape:

```
========================================================================
VIDEO  https://www.youtube.com/watch?v=dQw4w9WgXcQ
id=dQw4w9WgXcQ  lang=en  snippets=61  chars=2089  via=youtube-transcript-api
------------------------------------------------------------------------
[00:00] [♪♪♪]
[00:18] ♪ We're no strangers to love ♪
[00:22] ♪ You know the rules
…
========================================================================
1/1 transcripts extracted
wrote 5 files to captures/
```

Exit status is `0` only when every URL yielded a transcript, so it drops
straight into a shell pipeline or CI step. A video with no captions is
reported inline (`!! no captions: …`) and the batch keeps going.

## Three backends, one output

1. **`youtube-transcript-api`** (primary). Fetches the caption track, prefers
   human-written captions over auto-generated within the requested
   languages, falls back to the first language YouTube lists. From a normal
   home or office connection this is the whole story.
2. **yt-dlp** (fallback). Used only when the primary raises `RequestBlocked` /
   `IpBlocked` — YouTube's "Sign in to confirm you're not a bot", its
   standard answer to datacenter IPs. yt-dlp can present a proof-of-origin
   token from a small provider running alongside; the
   `bgutil-ytdlp-pot-provider` plugin in `requirements.txt` finds it
   automatically once it is up:

   ```sh
   docker run -d -p 4416:4416 brainicism/bgutil-ytdlp-pot-provider
   ```
3. **Gemini** (fallback, optional). Google's own route: with `GEMINI_API_KEY`
   set, the Gemini API is handed the YouTube URL and transcribes the video
   itself, returning timed segments. It needs no caption track, is not
   subject to the bot check, and works for Shorts from any address. It costs
   tokens on the video (a few minutes of video is a few hundred thousand
   tokens on the default model, `gemini-2.5-flash`; set `GEMINI_MODEL` to
   change it). Get a key at https://aistudio.google.com/apikey.

Every backend ends in the library's `FetchedTranscript`, so the same
formatters render the same shapes, and only the `via=` field differs.

## Access from servers: what is configurable

All of it comes from the environment, so no credential ever lives in the repo.

| variable | used by | meaning |
|---|---|---|
| `YT_COOKIES_FILE` | yt-dlp only (the library's cookie support is disabled in 1.2.x) | a Netscape-format cookies file exported from a browser signed in to YouTube; the documented way through the bot check with your own account |
| `YT_PROXY` | both the library and yt-dlp | `http://user:pass@host:port`; a residential or rotating proxy makes a server look like a normal connection |
| `GEMINI_API_KEY` | Gemini backend, `ask_gemini.py` | switches the Gemini route on |
| `GEMINI_MODEL` | same | model name, default `gemini-2.5-flash` |

## What has been proven live, and where

The sandbox this was written in cannot reach `youtube.com` at all — its
egress policy allows a short list of hosts — so the live runs happen on a
GitHub-hosted runner: `.github/workflows/youtube-transcripts-proof.yml` runs
the offline suite and then this script against real videos on every push to
this folder, and on demand from the Actions tab with any URLs you type in.
Every run leaves its output in the job log and in a `transcript-proof`
artifact holding the `proof/` capture directory (all five formats per video),
and `validate_captures.py` checks those files before the run can pass: every
format must exist, parse, agree on the cue count and start times, and the
plain text must equal the JSON cues joined. Dispatch inputs let you add URLs
and sample other Shorts from the runner.

**Standard video: extracted on every run**, timestamped. 61 snippets, 2089
characters of the real transcript. On some runners `youtube-transcript-api`
gets it directly; on others YouTube meets the library with its sign-in prompt
and the yt-dlp fallback delivers the identical text.

**Shorts from a datacenter IP: refused by YouTube.** For both Shorts, every
request from the runner gets "Sign in to confirm you're not a bot": the
library's, yt-dlp's, and yt-dlp with a proof-of-origin token attached. That
is YouTube's policy for cloud IP ranges, not a code path — a Short is parsed
to the same 11-character ID and fetched exactly like a video, and the offline
suite covers that path. From a normal connection the script runs as-is. On a
server, the three ways through are the ones above: a cookies file, a
residential proxy, or the Gemini route. The workflow therefore requires the
video step, runs the Shorts step as informational, and runs the Gemini step
and a Gemini review of this README only when a `GEMINI_API_KEY` repository
secret exists.

## Ask Gemini

```sh
export GEMINI_API_KEY=…
python3 ask_gemini.py --file README.md "Review this README for gaps and errors"
python3 ask_gemini.py "Does YouTube still require a PO token for json3 captions?"
```

The same question the workflow asks on every run once the secret is set; its
answer lands in the artifact as `gemini-review.md`.

## Prove it without the network

```sh
python3 -m unittest -v test_yt_transcripts
```

45 tests, all offline. URL parsing across every shape (`watch?v=`,
`/shorts/`, `youtu.be/`, `/embed/`, `/live/`, mobile and music hosts, extra
params, missing scheme, bare ID) plus the rejects; the fetch path against a
stand-in for `YouTubeTranscriptApi` that returns real `FetchedTranscript`
objects, so the library's formatters are the genuine article; the backend
chain (a block moves it along, success never touches a fallback, every
failed backend is named); the yt-dlp json3 rebuild; the Gemini request shape
and reply parsing; the cookies and proxy environment; every output format;
the capture directory; and the command line flags.

## What's inside

| file | role |
|---|---|
| `yt_transcripts.py` | `extract_video_id(url)` → `fetch_transcript` / `fetch_transcript_ytdlp` / `fetch_transcript_gemini` → `extract(url)` → `extract_all(urls)`; `render()` and `write_captures()` for the shapes; `main()` is the CLI |
| `ask_gemini.py` | one question to Gemini, optionally about a file |
| `test_yt_transcripts.py` | offline proof, stdlib `unittest` |
| `validate_captures.py` | structural check of a capture directory; the workflow runs it |
| `probe_clients.py` | what does this network get from YouTube? one line per client; `--sample-shorts N` runs the chain on N searched Shorts |
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
server, expect the prompt for many videos and all Shorts unless a cookies
file, a proxy, or the Gemini key is configured.

## Next step (not this sprint)

`extract_all()` takes any iterable of URLs or bare IDs, so the bulk pass is
`extract_all(ids_from_csv_or_db)` plus `write_captures()` per result. The
channel → video-ID discovery (Takeout CSV or the channel RSS feeds
`https://www.youtube.com/feeds/videos.xml?channel_id=…`) stays separate.
