"""Sentiment scoring: lexicon behaviour and the Claude request/response contract."""

import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from youtube_transcripts.sentiment import (  # noqa: E402
    SCORE_SCHEMA,
    ClaudeBatchScorer,
    ClaudeScorer,
    LexiconScorer,
    SentimentScore,
    label_for,
)


class FakeBlock(object):
    def __init__(self, text):
        self.type = "text"
        self.text = text


class FakeResponse(object):
    def __init__(self, payload=None, stop_reason="end_turn", text=None):
        self.stop_reason = stop_reason
        body = text if text is not None else json.dumps(payload or {"scores": []})
        self.content = [FakeBlock(body)]


class FakeMessages(object):
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.responses.pop(0) if self.responses else FakeResponse()


class FakeClient(object):
    def __init__(self, responses=None):
        self.messages = FakeMessages(responses or [])
        self.beta = type("Beta", (), {"messages": self.messages})()


class TestScoreValue(unittest.TestCase):
    def test_clamped_and_rounded(self):
        self.assertEqual(SentimentScore(5.0, 2.0).polarity, 1.0)
        self.assertEqual(SentimentScore(-5.0, -1.0).polarity, -1.0)
        self.assertEqual(SentimentScore(-5.0, -1.0).confidence, 0.0)
        self.assertEqual(SentimentScore(0.126, 0.5).polarity, 0.13)

    def test_labels(self):
        self.assertEqual(label_for(0.5), "BULLISH")
        self.assertEqual(label_for(-0.5), "BEARISH")
        self.assertEqual(label_for(0.0), "NEUTRAL")
        self.assertEqual(label_for(0.25), "BULLISH")
        self.assertEqual(label_for(0.24), "NEUTRAL")


class TestLexiconScorer(unittest.TestCase):
    def setUp(self):
        self.scorer = LexiconScorer()

    def test_bullish_and_bearish(self):
        self.assertGreater(self.scorer.score_one("a strong beat and an upgrade").polarity, 0)
        self.assertLess(self.scorer.score_one("a miss and a downgrade").polarity, 0)

    def test_negation_flips_polarity(self):
        """"not strong" must not read as strong."""
        plain = self.scorer.score_one("the setup is strong")
        negated = self.scorer.score_one("the setup is not strong")
        self.assertGreater(plain.polarity, 0)
        self.assertLess(negated.polarity, 0)

    def test_negation_only_reaches_backwards_in_a_window(self):
        far = self.scorer.score_one("not that it matters at all in any way strong")
        self.assertGreater(far.polarity, 0)

    def test_intensifier_amplifies(self):
        plain = self.scorer.score_one("strong quarter")
        loud = self.scorer.score_one("extremely strong quarter")
        self.assertGreater(loud.polarity, plain.polarity)

    def test_diminisher_damps(self):
        plain = self.scorer.score_one("strong quarter")
        quiet = self.scorer.score_one("slightly strong quarter")
        self.assertLess(quiet.polarity, plain.polarity)

    def test_no_cues_is_neutral_with_zero_confidence(self):
        score = self.scorer.score_one("the fed meets on tuesday")
        self.assertEqual(score.polarity, 0.0)
        self.assertEqual(score.confidence, 0.0)

    def test_empty_input(self):
        for value in ("", "   ", None):
            score = self.scorer.score_one(value)
            self.assertEqual(score.polarity, 0.0)
            self.assertEqual(score.confidence, 0.0)

    def test_confidence_grows_with_evidence(self):
        one = self.scorer.score_one("a beat")
        many = self.scorer.score_one("a beat and an upgrade and a rally and record growth")
        self.assertGreater(many.confidence, one.confidence)

    def test_batch_preserves_order_and_length(self):
        texts = ["a strong beat", "a bad miss", "nothing at all"]
        scores = self.scorer.score(texts)
        self.assertEqual(len(scores), 3)
        self.assertGreater(scores[0].polarity, 0)
        self.assertLess(scores[1].polarity, 0)
        self.assertEqual(scores[2].polarity, 0.0)

    def test_deterministic(self):
        text = "a very strong beat but real recession risk"
        self.assertEqual(self.scorer.score_one(text).polarity,
                         self.scorer.score_one(text).polarity)

    def test_source_recorded(self):
        self.assertEqual(self.scorer.score_one("a beat").source, "lexicon")


class TestSchema(unittest.TestCase):
    def test_schema_is_strict(self):
        """additionalProperties:false + full required is what makes the
        response parseable without a retry."""
        self.assertFalse(SCORE_SCHEMA["additionalProperties"])
        item = SCORE_SCHEMA["properties"]["scores"]["items"]
        self.assertFalse(item["additionalProperties"])
        self.assertEqual(sorted(item["required"]),
                         ["confidence", "index", "polarity"])


class TestClaudeScorer(unittest.TestCase):
    def test_request_shape(self):
        client = FakeClient([FakeResponse({"scores": []})])
        ClaudeScorer(client=client).score(["a", "b"])
        call = client.messages.calls[0]
        self.assertEqual(call["model"], "claude-opus-5")
        self.assertEqual(
            call["output_config"]["format"],
            {"type": "json_schema", "schema": SCORE_SCHEMA},
        )
        self.assertEqual(call["output_config"]["effort"], "low")

    def test_no_removed_parameters(self):
        """budget_tokens and temperature are 400s on this model."""
        client = FakeClient([FakeResponse({"scores": []})])
        ClaudeScorer(client=client).score(["a"])
        call = client.messages.calls[0]
        for removed in ("budget_tokens", "temperature", "top_p", "top_k"):
            self.assertNotIn(removed, call)
        self.assertNotIn("thinking", call)

    def test_fallbacks_requested_by_default(self):
        client = FakeClient([FakeResponse({"scores": []})])
        ClaudeScorer(client=client).score(["a"])
        call = client.messages.calls[0]
        self.assertEqual(call["fallbacks"], "default")
        self.assertIn("server-side-fallback-2026-07-01", call["betas"])

    def test_fallbacks_can_be_disabled(self):
        client = FakeClient([FakeResponse({"scores": []})])
        ClaudeScorer(client=client, fallbacks=False).score(["a"])
        self.assertNotIn("fallbacks", client.messages.calls[0])

    def test_prompt_indexes_each_segment(self):
        self.assertEqual(ClaudeScorer.build_prompt(["one", "two"]),
                         "[0] one\n[1] two")

    def test_parses_scores_by_index(self):
        response = FakeResponse({"scores": [
            {"index": 1, "polarity": -0.5, "confidence": 0.9},
            {"index": 0, "polarity": 0.5, "confidence": 0.8},
        ]})
        scores = ClaudeScorer.parse_response(response, 2)
        self.assertEqual(scores[0].polarity, 0.5)
        self.assertEqual(scores[1].polarity, -0.5)

    def test_omitted_segment_stays_neutral_not_dropped(self):
        """A short response must not silently shorten the batch."""
        response = FakeResponse({"scores": [
            {"index": 0, "polarity": 0.5, "confidence": 0.8}
        ]})
        scores = ClaudeScorer.parse_response(response, 3)
        self.assertEqual(len(scores), 3)
        self.assertEqual(scores[2].polarity, 0.0)
        self.assertEqual(scores[2].confidence, 0.0)

    def test_refusal_is_checked_before_content(self):
        response = FakeResponse({"scores": [
            {"index": 0, "polarity": 0.9, "confidence": 0.9}
        ]}, stop_reason="refusal")
        scores = ClaudeScorer.parse_response(response, 1)
        self.assertEqual(scores[0].polarity, 0.0)

    def test_malformed_json_degrades_to_neutral(self):
        scores = ClaudeScorer.parse_response(FakeResponse(text="not json"), 2)
        self.assertEqual([s.polarity for s in scores], [0.0, 0.0])

    def test_out_of_range_index_ignored(self):
        response = FakeResponse({"scores": [
            {"index": 99, "polarity": 1.0, "confidence": 1.0}
        ]})
        self.assertEqual(ClaudeScorer.parse_response(response, 1)[0].polarity, 0.0)

    def test_chunking(self):
        client = FakeClient([FakeResponse({"scores": []}) for _ in range(3)])
        scorer = ClaudeScorer(client=client, chunk_size=2)
        scores = scorer.score(["a", "b", "c", "d", "e"])
        self.assertEqual(len(client.messages.calls), 3)
        self.assertEqual(len(scores), 5)


class TestClaudeBatchScorer(unittest.TestCase):
    def test_requests_carry_the_schema_and_no_fallbacks(self):
        """The Batches API rejects the fallbacks parameter."""
        requests = ClaudeBatchScorer(client=FakeClient(), chunk_size=2).build_requests(
            ["a", "b", "c"]
        )
        self.assertEqual(len(requests), 2)
        self.assertEqual([r["custom_id"] for r in requests], ["seg-0", "seg-2"])
        for request in requests:
            self.assertEqual(request["params"]["model"], "claude-opus-5")
            self.assertIn("format", request["params"]["output_config"])
            self.assertNotIn("fallbacks", request["params"])
            self.assertNotIn("betas", request["params"])

    def test_collect_reassembles_out_of_order_results(self):
        """Batch results arrive in any order — key by custom_id, not position."""

        class Result(object):
            def __init__(self, custom_id, payload):
                self.custom_id = custom_id
                self.result = type("R", (), {
                    "type": "succeeded",
                    "message": FakeResponse(payload),
                })()

        class BatchClient(FakeClient):
            def __init__(self, results):
                FakeClient.__init__(self)
                self.messages.batches = type("B", (), {
                    "results": staticmethod(lambda _id: iter(results))
                })()

        results = [
            Result("seg-2", {"scores": [{"index": 0, "polarity": -0.8,
                                         "confidence": 0.9}]}),
            Result("seg-0", {"scores": [{"index": 1, "polarity": 0.4,
                                         "confidence": 0.7}]}),
        ]
        scorer = ClaudeBatchScorer(client=BatchClient(results), chunk_size=2)
        scores = scorer.collect("batch_1", 3)
        self.assertEqual(len(scores), 3)
        self.assertEqual(scores[1].polarity, 0.4)
        self.assertEqual(scores[2].polarity, -0.8)
        self.assertEqual(scores[0].polarity, 0.0)


if __name__ == "__main__":
    unittest.main()
