"""YouTube Data API v3 client: URL construction, quota booking, normalization."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from youtube_transcripts.metadata import (  # noqa: E402
    MAX_IDS_PER_REQUEST,
    QuotaExceeded,
    TransientAPIError,
    YouTubeAPIError,
    YouTubeDataAPI,
    _classify_http_error,
    normalize_video,
    parse_iso8601_duration,
    uploads_playlist_id,
)
from youtube_transcripts.ratelimit import RateLimiter  # noqa: E402


def _api(transport, **kwargs):
    """Client with all waiting removed, so tests cost no wall time."""
    return YouTubeDataAPI(
        api_key="test-key",
        rate_limiter=RateLimiter(min_interval=0, sleeper=lambda s: None),
        transport=transport,
        sleeper=lambda s: None,
        **kwargs
    )


class TestUrlConstruction(unittest.TestCase):
    def test_resource_path_is_not_the_quota_method_name(self):
        """Regression: the request path is /videos, not /videos.list.

        Booking quota against the documented method name ("videos.list") and
        then reusing that string as the URL segment builds
        /youtube/v3/videos.list, which YouTube answers with 404. Caught only
        by a live call, so it is pinned here.
        """
        seen = []

        def transport(url, timeout):
            seen.append(url)
            return {"items": []}

        _api(transport).fetch_videos(["abc"])
        self.assertIn("/youtube/v3/videos?", seen[0])
        self.assertNotIn("videos.list", seen[0])

    def test_playlist_items_resource_path(self):
        seen = []

        def transport(url, timeout):
            seen.append(url)
            return {"items": []}

        _api(transport).recent_uploads("UCabc123", limit=5)
        self.assertIn("/youtube/v3/playlistItems?", seen[0])
        self.assertNotIn("playlistItems.list", seen[0])

    def test_requested_parts_and_key_are_sent(self):
        seen = []

        def transport(url, timeout):
            seen.append(url)
            return {"items": []}

        _api(transport).fetch_videos(["abc"])
        self.assertIn("part=snippet%2Cstatistics%2CcontentDetails", seen[0])
        self.assertIn("key=test-key", seen[0])


class TestQuota(unittest.TestCase):
    def test_fifty_ids_cost_one_unit(self):
        def transport(url, timeout):
            return {"items": []}

        api = _api(transport)
        api.fetch_videos(["v{0}".format(n) for n in range(MAX_IDS_PER_REQUEST)])
        self.assertEqual(api.quota_spent, 1)

    def test_batching_splits_at_fifty(self):
        calls = []

        def transport(url, timeout):
            calls.append(url)
            return {"items": []}

        api = _api(transport)
        api.fetch_videos(["v{0}".format(n) for n in range(120)])
        self.assertEqual(len(calls), 3)
        self.assertEqual(api.quota_spent, 3)

    def test_duplicate_ids_collapse(self):
        calls = []

        def transport(url, timeout):
            calls.append(url)
            return {"items": []}

        api = _api(transport)
        api.fetch_videos(["same"] * 80)
        self.assertEqual(len(calls), 1)

    def test_uploads_playlist_costs_no_quota(self):
        self.assertEqual(uploads_playlist_id("UCuAXFkgsw1L7xaCfnd5JJOw"),
                         "UUuAXFkgsw1L7xaCfnd5JJOw")
        with self.assertRaises(ValueError):
            uploads_playlist_id("not-a-channel")


class TestErrorClassification(unittest.TestCase):
    def test_quota_exceeded_is_not_retryable(self):
        error = _classify_http_error(
            403, '{"error":{"errors":[{"reason":"quotaExceeded"}]}}'
        )
        self.assertIsInstance(error, QuotaExceeded)

    def test_rate_limit_is_retryable(self):
        self.assertIsInstance(
            _classify_http_error(429, "{}"), TransientAPIError
        )
        self.assertIsInstance(
            _classify_http_error(
                403, '{"error":{"errors":[{"reason":"rateLimitExceeded"}]}}'
            ),
            TransientAPIError,
        )

    def test_server_error_is_retryable(self):
        self.assertIsInstance(_classify_http_error(503, ""), TransientAPIError)

    def test_client_error_is_permanent(self):
        self.assertIsInstance(_classify_http_error(400, "{}"), YouTubeAPIError)

    def test_quota_exhaustion_is_not_retried(self):
        attempts = []

        def transport(url, timeout):
            attempts.append(url)
            raise QuotaExceeded("spent")

        with self.assertRaises(QuotaExceeded):
            _api(transport).fetch_videos(["abc"])
        self.assertEqual(len(attempts), 1)

    def test_transient_error_is_retried_then_surfaces(self):
        attempts = []

        def transport(url, timeout):
            attempts.append(url)
            raise TransientAPIError("upstream 503")

        with self.assertRaises(TransientAPIError):
            _api(transport).fetch_videos(["abc"])
        self.assertEqual(len(attempts), 4)

    def test_transient_error_recovers_on_retry(self):
        state = {"n": 0}

        def transport(url, timeout):
            state["n"] += 1
            if state["n"] < 3:
                raise TransientAPIError("flaky")
            return {"items": []}

        api = _api(transport)
        api.fetch_videos(["abc"])
        self.assertEqual(state["n"], 3)


class TestNormalization(unittest.TestCase):
    ITEM = {
        "id": "vid1",
        "snippet": {
            "channelId": "UCx",
            "channelTitle": "Scintilla",
            "title": "Macro update",
            "publishedAt": "2026-08-21T10:00:00Z",
            "liveBroadcastContent": "none",
            "thumbnails": {"high": {"url": "https://i.ytimg.com/high.jpg"}},
            "tags": ["macro"],
        },
        "statistics": {"viewCount": "12345", "likeCount": "67", "commentCount": "8"},
        "contentDetails": {"duration": "PT10M5S", "caption": "true",
                           "licensedContent": True},
    }

    def test_statistics_strings_become_integers(self):
        row = normalize_video(self.ITEM)
        self.assertEqual(row["view_count"], 12345)
        self.assertIsInstance(row["view_count"], int)

    def test_caption_flag_is_a_string_in_the_api(self):
        """contentDetails.caption is "true"/"false", never a JSON boolean."""
        self.assertTrue(normalize_video(self.ITEM)["has_caption_track"])
        item = dict(self.ITEM, contentDetails={"caption": "false"})
        self.assertFalse(normalize_video(item)["has_caption_track"])

    def test_hidden_counts_become_none_not_zero(self):
        """A hidden like count is unknown, and must not read as zero."""
        row = normalize_video(dict(self.ITEM, statistics={}))
        self.assertIsNone(row["like_count"])

    def test_live_stream_has_no_duration(self):
        item = dict(self.ITEM)
        item["snippet"] = dict(item["snippet"], liveBroadcastContent="live")
        item["contentDetails"] = {"duration": "P0D", "caption": "false"}
        row = normalize_video(item)
        self.assertTrue(row["is_live"])
        self.assertEqual(row["duration_sec"], 0)

    def test_missing_sections_do_not_raise(self):
        row = normalize_video({"id": "bare"})
        self.assertEqual(row["video_id"], "bare")
        self.assertIsNone(row["view_count"])
        self.assertFalse(row["has_caption_track"])

    def test_absent_videos_are_omitted_not_raised(self):
        def transport(url, timeout):
            return {"items": [dict(TestNormalization.ITEM)]}

        result = _api(transport).fetch_videos(["vid1", "deleted-one"])
        self.assertIn("vid1", result)
        self.assertNotIn("deleted-one", result)


class TestDuration(unittest.TestCase):
    def test_forms(self):
        self.assertEqual(parse_iso8601_duration("PT1H2M3S"), 3723)
        self.assertEqual(parse_iso8601_duration("PT45S"), 45)
        self.assertEqual(parse_iso8601_duration("PT10M"), 600)
        self.assertEqual(parse_iso8601_duration("P1DT2H"), 93600)
        self.assertEqual(parse_iso8601_duration("P0D"), 0)

    def test_unparseable(self):
        self.assertIsNone(parse_iso8601_duration(None))
        self.assertIsNone(parse_iso8601_duration(""))
        self.assertIsNone(parse_iso8601_duration("10 minutes"))


if __name__ == "__main__":
    unittest.main()
