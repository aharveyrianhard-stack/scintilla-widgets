"""Sentiment orchestration end to end."""

import os
import sys
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from youtube_transcripts.analytics import SanitizedMetricWriter  # noqa: E402
from youtube_transcripts.entities import EntityResolver  # noqa: E402
from youtube_transcripts.sentiment import LexiconScorer, SentimentScore  # noqa: E402
from youtube_transcripts.sentiment_pipeline import (  # noqa: E402
    ALERT_SCORE,
    ALERT_WEIGHT,
    SentimentPipeline,
)

NOW = datetime(2026, 8, 21, 12, 0, 0, tzinfo=timezone.utc)
UNIVERSE = ["MU", "NVDA", "LOW", "NOW", "PM"]


def row(**overrides):
    base = {
        "video_id": "v1",
        "channel_id": "UCabc",
        "published_at": "2026-08-21T06:00:00Z",
        "segments": [
            {"text": "Micron beat and raised guidance, very strong quarter"},
            {"text": "Nvidia looks bearish here with real weakness"},
            {"text": "the low of the day was ugly"},
        ],
        "metadata": {"view_count": 50000, "like_count": 2000,
                     "comment_count": 300},
    }
    base.update(overrides)
    return base


class Clock(object):
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


class FixedScorer(object):
    source = "fixed"

    def __init__(self, scores):
        self.scores = scores

    def score(self, texts):
        return [self.scores[i % len(self.scores)] for i in range(len(texts))]


def build(scorer=None, clock=None, **kwargs):
    written = []
    writer = SanitizedMetricWriter(lambda sql, params: written.append(params))
    statuses = []
    pipeline = SentimentPipeline(
        resolver=EntityResolver(UNIVERSE),
        scorer=scorer or LexiconScorer(),
        metric_writer=writer,
        status_writer=lambda vid, status: statuses.append((vid, status)),
        now=NOW,
        clock=clock,
        **kwargs
    )
    return pipeline, written, statuses


class TestScoring(unittest.TestCase):
    def test_resolves_scores_and_writes_metrics(self):
        pipeline, written, statuses = build()
        summary = pipeline.run_batch([row()])
        self.assertEqual(summary["scored"], 1)
        self.assertEqual(summary["metric_rows"], 2)
        self.assertEqual(sorted(r["symbols"] for r in summary["results"])[0],
                         ["MU", "NVDA"])
        self.assertEqual(statuses, [("v1", "ANALYZED")])

    def test_collision_is_not_scored(self):
        """"the low of the day" must not mint a LOW holding."""
        pipeline, _, _ = build()
        symbols = pipeline.run_batch([row()])["results"][0]["symbols"]
        self.assertNotIn("LOW", symbols)

    def test_sentiment_follows_the_segment_the_symbol_appears_in(self):
        pipeline, _, _ = build()
        outcome = pipeline.process_row(row())
        by_symbol = {r["symbol"]: r for r in outcome["rows"]}
        self.assertEqual(by_symbol["MU"]["sentiment_label"], "BULLISH")
        self.assertEqual(by_symbol["NVDA"]["sentiment_label"], "BEARISH")

    def test_themes_are_reported(self):
        pipeline, _, _ = build()
        outcome = pipeline.process_row(row(segments=[
            {"text": "the Fed signalled a rate cut as inflation cooled"}
        ]))
        self.assertIn("MONETARY_POLICY", outcome["themes"])

    def test_scorer_name_recorded(self):
        pipeline, _, _ = build(scorer=FixedScorer([SentimentScore(0.5, 1.0)]))
        outcome = pipeline.process_row(row())
        self.assertEqual(outcome["rows"][0]["scorer"], "fixed")

    def test_no_segments_is_skipped(self):
        pipeline, written, statuses = build()
        summary = pipeline.run_batch([row(segments=[])])
        self.assertEqual(summary["skipped"], 1)
        self.assertEqual(written, [])
        self.assertEqual(statuses, [("v1", "SKIPPED_NO_CAPTIONS")])

    def test_no_entities_writes_nothing(self):
        pipeline, written, _ = build()
        summary = pipeline.run_batch([row(segments=[
            {"text": "good morning everyone, welcome back"}
        ])])
        self.assertEqual(summary["metric_rows"], 0)
        self.assertEqual(written, [])


class TestAlerts(unittest.TestCase):
    def test_strong_view_plus_reach_alerts(self):
        pipeline, _, _ = build(scorer=FixedScorer([SentimentScore(0.9, 1.0)]))
        outcome = pipeline.process_row(row())
        self.assertTrue(outcome["rows"][0]["alert"])
        self.assertGreaterEqual(abs(outcome["rows"][0]["sentiment_score"]),
                                ALERT_SCORE)
        self.assertGreaterEqual(outcome["rows"][0]["engagement_weight"],
                                ALERT_WEIGHT)

    def test_strong_view_nobody_watched_does_not_alert(self):
        pipeline, _, _ = build(scorer=FixedScorer([SentimentScore(0.9, 1.0)]))
        outcome = pipeline.process_row(row(
            metadata={"view_count": 3, "like_count": 0, "comment_count": 0}))
        self.assertFalse(outcome["rows"][0]["alert"])

    def test_popular_but_neutral_does_not_alert(self):
        pipeline, _, _ = build(scorer=FixedScorer([SentimentScore(0.05, 1.0)]))
        outcome = pipeline.process_row(row())
        self.assertFalse(outcome["rows"][0]["alert"])


class TestEgressSafety(unittest.TestCase):
    def test_no_written_value_could_hold_a_transcript(self):
        """Every emitted row must survive the sanitizer — that is the point."""
        pipeline, written, _ = build()
        pipeline.run_batch([row()])
        self.assertTrue(written)
        for params in written:
            for value in params:
                if isinstance(value, str):
                    self.assertLessEqual(len(value), 64)

    def test_transcript_text_never_appears_in_a_metric_row(self):
        pipeline, written, _ = build()
        pipeline.run_batch([row()])
        flat = " ".join(str(v) for params in written for v in params)
        self.assertNotIn("Micron beat", flat)
        self.assertNotIn("bearish here", flat)


class TestOverlapAndBudget(unittest.TestCase):
    def test_second_run_refused_while_a_lease_is_held(self):
        clock = Clock()
        shared = {"media_sentiment_analysis_running": clock()}
        pipeline, written, _ = build(clock=clock, lock_store=shared)
        summary = pipeline.run_batch([row()])
        self.assertIn("error", summary)
        self.assertEqual(summary["deferred"], 1)
        self.assertEqual(written, [])

    def test_lease_released_after_a_run(self):
        clock = Clock()
        shared = {}
        pipeline, _, _ = build(clock=clock, lock_store=shared)
        pipeline.run_batch([row()])
        self.assertEqual(shared, {})

    def test_deadline_defers_the_remainder(self):
        clock = Clock()

        class SlowScorer(LexiconScorer):
            source = "slow"

            def score(self, texts):
                clock.now += 6.0
                return LexiconScorer.score(self, texts)

        pipeline, _, _ = build(scorer=SlowScorer(), clock=clock)
        rows = [row(video_id="v{0}".format(n)) for n in range(3)]
        summary = pipeline.run_batch(rows, budget_seconds=10.0)
        self.assertEqual(summary["scored"], 2)
        self.assertEqual(summary["deferred_ids"], ["v2"])

    def test_max_rows_bounds_the_batch(self):
        pipeline, _, _ = build()
        rows = [row(video_id="v{0}".format(n)) for n in range(5)]
        self.assertEqual(pipeline.run_batch(rows, max_rows=2)["requested"], 2)

    def test_empty_batch(self):
        pipeline, written, _ = build()
        self.assertEqual(pipeline.run_batch([])["requested"], 0)
        self.assertEqual(written, [])


class TestFailureHandling(unittest.TestCase):
    def test_a_failing_row_is_recorded_and_the_batch_continues(self):
        class Exploding(object):
            source = "boom"

            def score(self, texts):
                if "Micron beat and raised guidance, very strong quarter" in texts:
                    raise RuntimeError("scorer died")
                return [SentimentScore(0.0, 0.0) for _ in texts]

        pipeline, _, statuses = build(scorer=Exploding())
        summary = pipeline.run_batch([
            row(video_id="bad"),
            row(video_id="good", segments=[{"text": "NVDA is fine"}]),
        ])
        self.assertEqual(summary["failed"], 1)
        self.assertEqual(summary["scored"], 1)
        self.assertIn(("bad", "FAILED"), statuses)

    def test_status_write_failure_does_not_lose_committed_metrics(self):
        """Analytics is already written by then; a staging blip must not undo it."""
        written = []
        pipeline = SentimentPipeline(
            resolver=EntityResolver(UNIVERSE),
            scorer=LexiconScorer(),
            metric_writer=SanitizedMetricWriter(
                lambda sql, params: written.append(params)),
            status_writer=lambda vid, status: (_ for _ in ()).throw(
                RuntimeError("staging unreachable")),
            now=NOW,
        )
        summary = pipeline.run_batch([row()])
        self.assertEqual(summary["scored"], 1)
        self.assertTrue(written)


if __name__ == "__main__":
    unittest.main()
