#!/usr/bin/env python3
"""Ask Gemini a question through the Gemini API, optionally about a file.

    export GEMINI_API_KEY=…      # from https://aistudio.google.com/apikey
    python3 ask_gemini.py --file README.md "Review this README for gaps and errors"

Prints Gemini's answer. Exit status 2 when GEMINI_API_KEY is unset, 1 on an
API error. Shares its endpoint and model settings with yt_transcripts.py.
"""
from __future__ import annotations

import argparse
import os
import sys
from typing import Callable, Optional, Sequence

import requests

from yt_transcripts import DEFAULT_GEMINI_MODEL, ENV_GEMINI_KEY, ENV_GEMINI_MODEL, GEMINI_ENDPOINT


def ask(
    question: str,
    attachment: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    post: Optional[Callable] = None,
) -> str:
    api_key = api_key or os.environ.get(ENV_GEMINI_KEY, "")
    if not api_key:
        raise LookupError(f"{ENV_GEMINI_KEY} is not set")
    model = model or os.environ.get(ENV_GEMINI_MODEL) or DEFAULT_GEMINI_MODEL
    parts = []
    if attachment:
        parts.append({"text": f"Attached file for review:\n\n{attachment}"})
    parts.append({"text": question})
    response = (post or requests.post)(
        GEMINI_ENDPOINT.format(model=model),
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json={"contents": [{"parts": parts}]},
        timeout=300,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Gemini API HTTP {response.status_code}: {' '.join(str(response.text).split())[:300]}"
        )
    payload = response.json()
    return "".join(
        part.get("text", "") for part in payload["candidates"][0]["content"]["parts"]
    )


def main(argv: Sequence[str]) -> int:
    parser = argparse.ArgumentParser(description="Ask Gemini, optionally about a file.")
    parser.add_argument("question", nargs="+", help="the question (joined with spaces)")
    parser.add_argument("--file", help="a file whose contents are attached to the question")
    args = parser.parse_args(list(argv))
    attachment = None
    if args.file:
        with open(args.file, encoding="utf-8") as handle:
            attachment = handle.read()
    try:
        print(ask(" ".join(args.question), attachment))
    except LookupError as err:
        print(f"!! {err}", file=sys.stderr)
        return 2
    except Exception as err:  # noqa: BLE001 — report, do not trace
        print(f"!! {type(err).__name__}: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
