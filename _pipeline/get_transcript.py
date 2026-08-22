#!/usr/bin/env python3
"""Print the transcript of a YouTube video. One file, one command.

    pip install yt-dlp
    python3 get_transcript.py "https://www.youtube.com/watch?v=VIDEO_ID"

Options:
    --save      also write <video_id>.txt next to this script
    --timed     show timestamps instead of flowing text
    --lang xx   caption language (default en)

Nothing is uploaded anywhere. No API key needed. This is the same parsing
code the full pipeline uses, wrapped so you can see it work by yourself.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from youtube_transcripts.extractor import NoCaptionsAvailable, SubtitleExtractor
from youtube_transcripts.vtt import join_segments, parse_vtt_text


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    flags = [a for a in argv if a.startswith("--")]

    if not args:
        print(__doc__)
        return 2

    lang = "en"
    for flag in flags:
        if flag.startswith("--lang"):
            parts = flag.split("=", 1)
            if len(parts) == 2:
                lang = parts[1]
    if "--lang" in argv:
        index = argv.index("--lang")
        if index + 1 < len(argv):
            lang = argv[index + 1]
            args = [a for a in args if a != lang]

    target = args[0]
    print("Fetching captions for: {0}".format(target))
    print("(captions only — no video or audio is downloaded)\n")

    try:
        raw_vtt, info = SubtitleExtractor(lang=lang).fetch(target)
    except NoCaptionsAvailable as exc:
        print("No {0} captions available.\n  {1}".format(lang, exc))
        return 1
    except ImportError as exc:
        print("{0}\n\nRun:  pip install yt-dlp".format(exc))
        return 2
    except Exception as exc:
        print("Could not fetch captions:\n  {0}".format(exc))
        return 1

    segments = parse_vtt_text(raw_vtt)
    if not segments:
        print("The caption track was empty.")
        return 1

    title = (info or {}).get("title") or "(untitled)"
    channel = (info or {}).get("channel") or (info or {}).get("uploader") or "?"
    print("=" * 70)
    print(title)
    print("{0}  ·  {1} caption blocks".format(channel, len(segments)))
    print("=" * 70)
    print()

    if "--timed" in flags:
        body = "\n".join(
            "[{0}] {1}".format(s["start"][:-4], s["text"]) for s in segments
        )
    else:
        body = join_segments(segments)

    print(body)

    if "--save" in flags:
        video_id = (info or {}).get("id") or "transcript"
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "{0}.txt".format(video_id))
        with open(path, "w", encoding="utf-8") as handle:
            handle.write("{0}\n{1}\n\n{2}\n".format(title, channel, body))
        print("\n\nSaved to {0}".format(path))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
