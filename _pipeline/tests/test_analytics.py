"""Engagement weighting and the sanitized egress boundary."""

import os
import sys
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from youtube_transcripts.analytics import (  # noqa: E402
    ALLOWED_COLUMNS,
    MAX_SCALAR_CHARS,
    SanitizationError,
    SanitizedMetricWriter,
    aggregate_by_symbol,
    engagement_weight,
    weighted_index,
)
from youtube_transcripts.entities import EntityHit  # noqa: E402
from youtube_transcripts.sentiment import SentimentScore  # noqa: E402

NOW = datetime(2026, 8, 21, 12, 0, 0, tzinfo=timezone.utc)


class TestEngagementWeight(unittest.TestCase):
    def test_more_views_weigh_more(self):
        small = engagement_weight({"view_count": 100}, NOW)
        large = engagement_weight({"view_count": 1000000}, NOW)
        self.assertGreater(large, small)

    def test_velocity_favours_the_fresher_video(self):
        """Same reach, different speed — today's news must outrank last year's."""
        fresh = engagement_weight(
            {"view_count": 50000, "published_at": "2026-08-21T06:00:00Z"}, NOW)
        stale = engagement_weight(
            {"view_count": 50000, "published_at": "2025-08-21T06:00:00Z"}, NOW)
        self.assertGreater(fresh, stale)

    def test_interaction_rate_counts(self):
        engaged = engagement_weight(
            {"view_count": 10000, "like_count": 500, "comment_count": 100}, NOW)
        inert = engagement_weight(
            {"view_count": 10000, "like_count": 1, "comment_count": 0}, NOW)
        self.assertGreater(engaged, inert)

    def test_hidden_counts_are_neutral_not_zero(self):
        """A hidden like count is unknown, not an absence of likes."""
        self.assertEqual(engagement_weight({}, NOW), 0.5)
        self.assertEqual(
            engagement_weight({"view_count": None, "like_count": None}, NOW), 0.5)

    def test_always_within_zero_and_one(self):
        for metadata in ({"view_count": 10 ** 12, "like_count": 10 ** 12,
                          "comment_count": 10 ** 12,
                          "published_at": "2026-08-21T11:59:00Z"},
                         {"view_count": 0}, {"view_count": -5}):
            weight = engagement_weight(metadata, NOW)
            self.assertGreaterEqual(weight, 0.0)
            self.assertLessEqual(weight, 1.0)

    def test_channel_weight_scales(self):
        base = engagement_weight({"view_count": 10000}, NOW)
        halved = engagement_weight({"view_count": 10000}, NOW, channel_weight=0.5)
        self.assertAlmostEqual(halved, round(base * 0.5, 4), places=3)

    def test_unparseable_timestamp_does_not_raise(self):
        self.assertIsInstance(
            engagement_weight({"view_count": 100, "published_at": "nope"}, NOW),
            float,
        )


class TestWeightedIndex(unittest.TestCase):
    def test_confidence_weights_the_mean(self):
        """A score the model was unsure of must not drag the index."""
        result = weighted_index([SentimentScore(1.0, 1.0),
                                 SentimentScore(-1.0, 0.1)])
        self.assertGreater(result["score"], 0.5)

    def test_all_unconfident_returns_zero(self):
        result = weighted_index([SentimentScore(0.9, 0.0),
                                 SentimentScore(-0.9, 0.0)])
        self.assertEqual(result["score"], 0.0)
        self.assertEqual(result["confidence"], 0.0)

    def test_empty(self):
        self.assertEqual(weighted_index([])["score"], 0.0)

    def test_engagement_scales_the_weighted_field_only(self):
        result = weighted_index([SentimentScore(1.0, 1.0)], weight=0.5)
        self.assertEqual(result["score"], 1.0)
        self.assertEqual(result["weighted"], 0.5)


class TestAggregate(unittest.TestCase):
    def test_symbol_takes_the_sentiment_of_its_segments(self):
        hits = [EntityHit("MU", "equity", "CASHTAG", "$MU", 0, 0),
                EntityHit("NVDA", "equity", "SYMBOL", "NVDA", 0, 1)]
        scores = [SentimentScore(0.8, 1.0), SentimentScore(-0.8, 1.0)]
        out = aggregate_by_symbol(hits, scores)
        self.assertGreater(out["MU"]["sentiment_score"], 0)
        self.assertLess(out["NVDA"]["sentiment_score"], 0)

    def test_repeat_mentions_in_one_segment_count_once_for_sentiment(self):
        hits = [EntityHit("MU", "equity", "CASHTAG", "$MU", 0, 0),
                EntityHit("MU", "equity", "CASHTAG", "$MU", 10, 0)]
        out = aggregate_by_symbol(hits, [SentimentScore(1.0, 1.0)])
        self.assertEqual(out["MU"]["mention_count"], 2)
        self.assertEqual(out["MU"]["segment_count"], 1)
        self.assertEqual(out["MU"]["sentiment_score"], 1.0)

    def test_hit_without_a_score_contributes_a_mention_only(self):
        hits = [EntityHit("MU", "equity", "CASHTAG", "$MU", 0, 7)]
        out = aggregate_by_symbol(hits, [SentimentScore(1.0, 1.0)])
        self.assertEqual(out["MU"]["mention_count"], 1)
        self.assertEqual(out["MU"]["sentiment_score"], 0.0)

    def test_empty(self):
        self.assertEqual(aggregate_by_symbol([], []), {})


class TestSanitizedEgress(unittest.TestCase):
    """Production analytics stores metrics, never text — by allowlist."""

    def setUp(self):
        self.calls = []
        self.writer = SanitizedMetricWriter(
            lambda sql, params: self.calls.append((sql, params))
        )

    def test_metric_row_is_written(self):
        self.writer.write({"video_id": "v1", "symbol": "MU",
                           "sentiment_score": 0.42, "sentiment_label": "BULLISH"})
        sql, params = self.calls[0]
        self.assertIn("insert into public.media_sentiment_scores", sql)
        self.assertIn("on conflict (video_id, symbol) do update", sql)
        self.assertEqual(len(params), 4)

    def test_no_text_column_exists_on_the_allowlist(self):
        for banned in ("full_transcript_text", "segments", "raw_vtt_storage_key",
                       "transcript", "text", "body"):
            self.assertNotIn(banned, ALLOWED_COLUMNS)

    def test_off_allowlist_column_is_refused(self):
        with self.assertRaises(SanitizationError):
            self.writer.write({"video_id": "v1", "symbol": "MU",
                               "full_transcript_text": "the whole transcript"})
        self.assertEqual(self.calls, [])

    def test_a_sentence_cannot_fit_in_any_allowed_column(self):
        sentence = ("Macro liquidity expansion is accelerating across major "
                    "central banks and the setup is constructive.")
        self.assertGreater(len(sentence), MAX_SCALAR_CHARS)
        with self.assertRaises(SanitizationError):
            self.writer.write({"video_id": "v1", "symbol": "MU",
                               "sentiment_label": sentence})
        self.assertEqual(self.calls, [])

    def test_nested_values_are_refused(self):
        for value in ([1, 2, 3], {"a": 1}):
            with self.assertRaises(SanitizationError):
                self.writer.write({"video_id": "v1", "symbol": "MU",
                                   "alert": value})

    def test_required_keys(self):
        for row in ({"symbol": "MU"}, {"video_id": "v1"},
                    {"video_id": "", "symbol": "MU"}):
            with self.assertRaises(SanitizationError):
                self.writer.write(row)

    def test_non_object_refused(self):
        with self.assertRaises(SanitizationError):
            self.writer.write("not a row")

    def test_values_are_bound_never_interpolated(self):
        self.writer.write({"video_id": "v1", "symbol": "MU'; drop table x;--"})
        sql, params = self.calls[0]
        self.assertNotIn("drop table", sql)
        self.assertIn("drop table", params[1])

    def test_unsafe_identifiers_refused(self):
        for bad in ("x; drop table y", "1abc", "", 'a"b'):
            with self.assertRaises(SanitizationError):
                SanitizedMetricWriter(lambda s, p: None, table=bad)
            with self.assertRaises(SanitizationError):
                SanitizedMetricWriter(lambda s, p: None, schema=bad)

    def test_column_order_follows_the_allowlist(self):
        self.writer.write({"symbol": "MU", "video_id": "v1",
                           "mention_count": 2, "sentiment_score": 0.1})
        columns = self.calls[0][0].split("(", 1)[1].split(")", 1)[0]
        self.assertEqual(
            columns, "video_id, symbol, sentiment_score, mention_count")

    def test_write_many(self):
        self.writer.write_many([{"video_id": "v1", "symbol": "MU"},
                                {"video_id": "v1", "symbol": "NVDA"}])
        self.assertEqual(len(self.calls), 2)


if __name__ == "__main__":
    unittest.main()
