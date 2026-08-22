"""Segment-level sentiment scoring (sentiment step 2).

Polarity is -1.00 .. +1.00, as the contract requires. Two scorers implement the
same interface:

  * `LexiconScorer` -- deterministic, offline, no dependency and no API cost.
    It handles the two things a bag-of-words gets wrong on market commentary:
    negation ("not great" is not great) and the fact that the domain inverts
    ordinary polarity ("beat", "short squeeze", "cut" are not what they are in
    general English).
  * `ClaudeScorer` -- Claude with a JSON-schema output contract, for when
    nuance matters. `ClaudeBatchScorer` routes the same work through the
    Batches API at half price, which is the right shape for a backfill of
    thousands of segments where latency does not matter.

The lexicon scorer is the default so the pipeline runs, and is testable,
without credentials.
"""

import json
import os
import re
from typing import Any, Dict, Iterable, List, Optional, Sequence

__all__ = [
    "SentimentScore",
    "label_for",
    "LexiconScorer",
    "ClaudeScorer",
    "ClaudeBatchScorer",
    "SCORE_SCHEMA",
]

SCORING_MODEL = "claude-opus-5"

# Domain lexicon. Weights are deliberately coarse: the aggregate is what gets
# stored, and false precision on a single word would not survive it.
_POSITIVE = {
    "beat": 0.7, "beats": 0.7, "outperform": 0.7, "upgrade": 0.8,
    "upgraded": 0.8, "rally": 0.6, "rallied": 0.6, "surge": 0.8, "surged": 0.8,
    "breakout": 0.7, "bullish": 0.9, "strong": 0.5, "strength": 0.5,
    "growth": 0.4, "expanding": 0.4, "expansion": 0.4, "record": 0.5,
    "accelerating": 0.6, "momentum": 0.4, "buy": 0.5, "long": 0.3,
    "recovery": 0.5, "resilient": 0.5, "upside": 0.6, "gains": 0.5,
    "profitable": 0.6, "raised": 0.5, "raises": 0.5, "tailwind": 0.6,
}
_NEGATIVE = {
    "miss": -0.7, "missed": -0.7, "misses": -0.7, "downgrade": -0.8,
    "downgraded": -0.8, "selloff": -0.8, "sell-off": -0.8, "crash": -0.9,
    "plunge": -0.8, "plunged": -0.8, "bearish": -0.9, "weak": -0.5,
    "weakness": -0.5, "slowdown": -0.6, "contraction": -0.6, "recession": -0.7,
    "risk": -0.3, "risks": -0.3, "headwind": -0.6, "headwinds": -0.6,
    "downside": -0.6, "losses": -0.5, "bankruptcy": -0.9, "default": -0.7,
    "layoffs": -0.6, "warning": -0.6, "cut": -0.4, "cuts": -0.4,
    "overvalued": -0.5, "bubble": -0.5, "capitulation": -0.7,
}
_NEGATORS = frozenset({
    "not", "no", "never", "without", "hardly", "barely", "isn't", "isnt",
    "aren't", "arent", "wasn't", "wasnt", "won't", "wont", "don't", "dont",
    "doesn't", "doesnt", "didn't", "didnt", "cannot", "can't", "cant",
})
_INTENSIFIERS = {"very": 1.4, "extremely": 1.6, "massively": 1.6, "hugely": 1.5,
                 "sharply": 1.4, "significantly": 1.3, "slightly": 0.6,
                 "somewhat": 0.7, "marginally": 0.6, "modestly": 0.7}
_NEGATION_WINDOW = 3

_WORD = re.compile(r"[a-z']+")

#: The contract the model must answer in. `additionalProperties: false` plus a
#: full `required` list is what makes the response parseable without a retry.
SCORE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "polarity": {"type": "number"},
                    "confidence": {"type": "number"},
                },
                "required": ["index", "polarity", "confidence"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["scores"],
    "additionalProperties": False,
}

_SYSTEM = (
    "You score financial market commentary. For each numbered segment return a "
    "polarity from -1.0 (maximally bearish on the assets discussed) to 1.0 "
    "(maximally bullish), and a confidence from 0.0 to 1.0. Judge the speaker's "
    "stance toward the assets, not the emotional tone of the language. A calm "
    "statement that a position is impaired is bearish. Segments that carry no "
    "market view score polarity 0.0 with low confidence. Return one entry per "
    "segment, using the segment's own index."
)


def label_for(polarity: float) -> str:
    if polarity >= 0.25:
        return "BULLISH"
    if polarity <= -0.25:
        return "BEARISH"
    return "NEUTRAL"


class SentimentScore:
    def __init__(self, polarity: float, confidence: float,
                 source: str = "lexicon"):
        self.polarity = max(-1.0, min(1.0, round(float(polarity), 2)))
        self.confidence = max(0.0, min(1.0, round(float(confidence), 2)))
        self.source = source

    @property
    def label(self) -> str:
        return label_for(self.polarity)

    def as_dict(self) -> Dict[str, Any]:
        return {"polarity": self.polarity, "confidence": self.confidence,
                "label": self.label, "source": self.source}

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return "<SentimentScore {0:+.2f} {1}>".format(self.polarity, self.label)


class LexiconScorer:
    """Deterministic domain-lexicon scorer with negation and intensifiers."""

    source = "lexicon"

    def __init__(self, positive: Optional[Dict[str, float]] = None,
                 negative: Optional[Dict[str, float]] = None):
        self.weights: Dict[str, float] = {}
        self.weights.update(_POSITIVE if positive is None else positive)
        self.weights.update(_NEGATIVE if negative is None else negative)

    def score_one(self, text: str) -> SentimentScore:
        words = _WORD.findall((text or "").lower())
        if not words:
            return SentimentScore(0.0, 0.0, self.source)

        total = 0.0
        matched = 0
        for position, word in enumerate(words):
            weight = self.weights.get(word)
            if weight is None:
                continue
            matched += 1
            window = words[max(0, position - _NEGATION_WINDOW):position]
            if any(candidate in _NEGATORS for candidate in window):
                weight = -weight * 0.8
            for candidate in window:
                if candidate in _INTENSIFIERS:
                    weight *= _INTENSIFIERS[candidate]
                    break
            total += weight

        if not matched:
            return SentimentScore(0.0, 0.0, self.source)

        polarity = total / matched
        # More matched cues means more evidence, saturating quickly.
        confidence = min(1.0, 0.35 + 0.2 * matched)
        return SentimentScore(polarity, confidence, self.source)

    def score(self, texts: Sequence[str]) -> List[SentimentScore]:
        return [self.score_one(text) for text in texts]


class ClaudeScorer:
    """Claude with a JSON-schema output contract.

    Segments are sent in chunks so one call covers many, which is both cheaper
    and gives the model neighbouring context to judge a bare pronoun against.
    """

    source = "claude"

    def __init__(self, client: Optional[Any] = None, model: str = SCORING_MODEL,
                 chunk_size: int = 25, api_key: Optional[str] = None,
                 fallbacks: bool = True):
        self._client = client
        self.model = model
        self.chunk_size = max(1, int(chunk_size))
        self._api_key = api_key
        self.fallbacks = fallbacks

    def client(self) -> Any:
        if self._client is None:
            try:
                import anthropic
            except ImportError as exc:  # pragma: no cover - environment dependent
                raise ImportError(
                    "the anthropic SDK is required for Claude scoring. "
                    "Run: pip install anthropic"
                ) from exc
            key = self._api_key or os.environ.get("ANTHROPIC_API_KEY")
            self._client = anthropic.Anthropic(api_key=key) if key else anthropic.Anthropic()
        return self._client

    @staticmethod
    def build_prompt(texts: Sequence[str]) -> str:
        return "\n".join(
            "[{0}] {1}".format(index, text) for index, text in enumerate(texts)
        )

    def _request(self, texts: Sequence[str]) -> Any:
        kwargs: Dict[str, Any] = {
            "model": self.model,
            "max_tokens": 4096,
            "system": _SYSTEM,
            "messages": [{"role": "user", "content": self.build_prompt(texts)}],
            # Classification does not need deep reasoning; low effort keeps
            # cost down without disabling thinking, which on Opus 5 can leak
            # a tool call or a thinking tag into the visible text.
            "output_config": {
                "effort": "low",
                "format": {"type": "json_schema", "schema": SCORE_SCHEMA},
            },
        }
        client = self.client()
        if self.fallbacks:
            # A policy decline would otherwise silently drop a whole chunk.
            return client.beta.messages.create(
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                **kwargs
            )
        return client.messages.create(**kwargs)

    @staticmethod
    def parse_response(response: Any, expected: int) -> List[SentimentScore]:
        """Map a schema-constrained response back onto its segments.

        A refusal is a 200 with `stop_reason == "refusal"`, so it has to be
        checked before `content` is read. Any segment the model omits stays
        neutral-with-zero-confidence rather than being dropped, which would
        silently shorten the batch.
        """
        out = [SentimentScore(0.0, 0.0, ClaudeScorer.source) for _ in range(expected)]
        if getattr(response, "stop_reason", None) == "refusal":
            return out
        text = next(
            (block.text for block in getattr(response, "content", [])
             if getattr(block, "type", None) == "text"),
            "",
        )
        if not text:
            return out
        try:
            payload = json.loads(text)
        except ValueError:
            return out
        for entry in payload.get("scores") or []:
            try:
                index = int(entry["index"])
            except (KeyError, TypeError, ValueError):
                continue
            if 0 <= index < expected:
                out[index] = SentimentScore(
                    entry.get("polarity", 0.0),
                    entry.get("confidence", 0.0),
                    ClaudeScorer.source,
                )
        return out

    def score(self, texts: Sequence[str]) -> List[SentimentScore]:
        results: List[SentimentScore] = []
        for start in range(0, len(texts), self.chunk_size):
            chunk = list(texts[start : start + self.chunk_size])
            results.extend(self.parse_response(self._request(chunk), len(chunk)))
        return results


class ClaudeBatchScorer(ClaudeScorer):
    """The same contract through the Batches API, at half price.

    Right for a backfill of thousands of segments where an hour of latency is
    irrelevant. Note the Batches API rejects the `fallbacks` parameter, so a
    refused chunk here degrades to neutral rather than being rescued.
    """

    source = "claude-batch"

    def build_requests(self, texts: Sequence[str]) -> List[Dict[str, Any]]:
        requests = []
        for start in range(0, len(texts), self.chunk_size):
            chunk = list(texts[start : start + self.chunk_size])
            requests.append({
                "custom_id": "seg-{0}".format(start),
                "params": {
                    "model": self.model,
                    "max_tokens": 4096,
                    "system": _SYSTEM,
                    "messages": [
                        {"role": "user", "content": self.build_prompt(chunk)}
                    ],
                    "output_config": {
                        "effort": "low",
                        "format": {"type": "json_schema", "schema": SCORE_SCHEMA},
                    },
                },
            })
        return requests

    def submit(self, texts: Sequence[str]) -> str:
        batch = self.client().messages.batches.create(
            requests=self.build_requests(texts)
        )
        return batch.id

    def collect(self, batch_id: str, total: int) -> List[SentimentScore]:
        """Assemble results by custom_id. Batch results arrive in any order."""
        out = [SentimentScore(0.0, 0.0, self.source) for _ in range(total)]
        for result in self.client().messages.batches.results(batch_id):
            if getattr(result.result, "type", None) != "succeeded":
                continue
            try:
                start = int(str(result.custom_id).split("-", 1)[1])
            except (IndexError, ValueError):
                continue
            expected = min(self.chunk_size, total - start)
            if expected <= 0:
                continue
            for offset, score in enumerate(
                self.parse_response(result.result.message, expected)
            ):
                if start + offset < total:
                    out[start + offset] = SentimentScore(
                        score.polarity, score.confidence, self.source
                    )
        return out
