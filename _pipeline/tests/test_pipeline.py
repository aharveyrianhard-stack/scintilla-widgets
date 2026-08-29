"""End-to-end orchestration under lock, deadline, and failure."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from youtube_transcripts.extractor import NoCaptionsAvailable  # noqa: E402
from youtube_transcripts.pipeline import ProcessOutcome, TranscriptPipeline  # noqa: E402
from youtube_transcripts.storage import MemoryColdStore, StagingWriter  # noqa: E402

VTT = (
    "WEBVTT\n\n"
    "00:00:01.000 --> 00:00:03.000\nMacro liquidity is expanding\n\n"
    "00:00:03.000 --> 00:00:06.000\nGold broke out this week\n"
)

META = {
    "video_id": "vid1",
    "channel_id": "UCabc",
    "channel_title": "Scintilla",
    "title": "Macro update",
    "published_at": "2026-08-21T10:00:00Z",
    "view_count": 12345,
    "like_count": 678,
    "comment_count": 9,
    "duration_sec": 605,
    "is_live": False,
    "tags": ["macro"],
    "category_id": "25",
    "default_audio_language": "en",
    "has_caption_track": False,
}


class Clock(object):
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


class FakeAPI(object):
    def __init__(self, videos=None, quota=1):
        self.videos = videos if videos is not None else {"vid1": dict(META)}
        self.quota_spent = quota
        self.requested = []

    def fetch_videos(self, ids):
        self.requested.append(list(ids))
        return {k: v for k, v in self.videos.items() if k in set(ids)}


class FakeExtractor(object):
    def __init__(self, vtt=VTT, raises=None, clock=None, cost=0.0):
        self.vtt = vtt
        self.raises = raises
        self.clock = clock
        self.cost = cost
        self.calls = []

    def fetch(self, video_id):
        self.calls.append(video_id)
        if self.clock is not None:
            self.clock.now += self.cost
        if self.raises:
            raise self.raises
        return self.vtt, {"id": video_id, "title": "Macro update"}


def build(api=None, extractor=None, clock=None):
    cold = MemoryColdStore()
    rows = []
    writer = StagingWriter(lambda sql, params: rows.append(params))
    pipeline = TranscriptPipeline(
        api=api or FakeAPI(),
        cold_store=cold,
        staging_writer=writer,
        extractor=extractor or FakeExtractor(),
        clock=clock,
    )
    return pipeline, cold, rows


class TestHappyPath(unittest.TestCase):
    def test_stores_to_both_layers(self):
        pipeline, cold, rows = build()
        summary = pipeline.run_batch(["vid1"])

        self.assertEqual(summary["stored"], 1)
        self.assertEqual(summary["failed"], 0)
        self.assertEqual(len(cold.objects), 1)
        self.assertEqual(len(rows), 1)

    def test_raw_vtt_goes_to_r2_verbatim(self):
        pipeline, cold, _ = build()
        pipeline.run_batch(["vid1"])
        key = list(cold.objects)[0]
        self.assertEqual(cold.get_transcript(key), VTT)

    def test_staging_row_references_the_key_and_holds_no_second_copy(self):
        pipeline, cold, rows = build()
        pipeline.run_batch(["vid1"])
        key = list(cold.objects)[0]
        self.assertEqual(rows[0][4], key)
        self.assertNotIn("WEBVTT", rows[0][5])

    def test_full_text_is_the_deoverlapped_transcript(self):
        pipeline, _, rows = build()
        pipeline.run_batch(["vid1"])
        self.assertEqual(
            rows[0][5], "Macro liquidity is expanding Gold broke out this week"
        )

    def test_metadata_blob_carries_engagement_signal(self):
        import json

        pipeline, _, rows = build()
        pipeline.run_batch(["vid1"])
        blob = json.loads(rows[0][7])
        self.assertEqual(blob["view_count"], 12345)
        self.assertEqual(blob["like_count"], 678)
        self.assertEqual(blob["segment_count"], 2)
        self.assertAlmostEqual(blob["transcript_seconds"], 6.0)
        self.assertTrue(blob["caption_is_automatic"])

    def test_row_enters_pending_analysis(self):
        pipeline, _, rows = build()
        pipeline.run_batch(["vid1"])
        self.assertEqual(rows[0][8], "PENDING_ANALYSIS")


class TestDegradedVideos(unittest.TestCase):
    def test_missing_captions_are_skipped_not_failed(self):
        pipeline, cold, rows = build(
            extractor=FakeExtractor(raises=NoCaptionsAvailable("none"))
        )
        summary = pipeline.run_batch(["vid1"])
        self.assertEqual(summary["skipped"], 1)
        self.assertEqual(summary["failed"], 0)
        self.assertEqual(cold.objects, {})
        self.assertEqual(rows, [])

    def test_empty_caption_file_is_skipped(self):
        pipeline, cold, rows = build(extractor=FakeExtractor(vtt="WEBVTT\n\n"))
        summary = pipeline.run_batch(["vid1"])
        self.assertEqual(summary["skipped"], 1)
        self.assertEqual(cold.objects, {})

    def test_transport_failure_is_reported_and_writes_nothing(self):
        pipeline, cold, rows = build(
            extractor=FakeExtractor(raises=RuntimeError("proxy 403"))
        )
        summary = pipeline.run_batch(["vid1"])
        self.assertEqual(summary["failed"], 1)
        self.assertEqual(cold.objects, {})
        self.assertEqual(rows, [])
        self.assertIn("proxy 403", summary["results"][0]["detail"])

    def test_video_absent_from_the_api_is_skipped(self):
        pipeline, cold, _ = build(api=FakeAPI(videos={}))
        summary = pipeline.run_batch(["deleted"])
        self.assertEqual(summary["skipped"], 1)
        self.assertIn("videos.list", summary["results"][0]["detail"])
        self.assertEqual(cold.objects, {})

    def test_invalid_payload_leaves_no_orphan_in_the_bucket(self):
        """Validation runs before upload, so a bad record costs nothing."""
        bad = dict(META, published_at="not-a-timestamp")
        pipeline, cold, rows = build(api=FakeAPI(videos={"vid1": bad}))
        summary = pipeline.run_batch(["vid1"])
        self.assertEqual(summary["failed"], 1)
        self.assertEqual(cold.objects, {}, "no object may be written for a bad payload")
        self.assertEqual(rows, [])

    def test_one_bad_video_does_not_stop_the_batch(self):
        api = FakeAPI(videos={"good": dict(META, video_id="good"), })
        pipeline, cold, rows = build(api=api)
        summary = pipeline.run_batch(["missing", "good"])
        self.assertEqual(summary["stored"], 1)
        self.assertEqual(summary["skipped"], 1)


class TestOverlapAndBudget(unittest.TestCase):
    """Both guards trace to the 2026-08-06 saturation incident."""

    def test_a_second_run_is_refused_while_one_holds_the_lease(self):
        clock = Clock()
        shared = {}
        api = FakeAPI(videos={"vid1": dict(META)})
        first = TranscriptPipeline(
            api=api, cold_store=MemoryColdStore(),
            staging_writer=StagingWriter(lambda s, p: None),
            extractor=FakeExtractor(), lock_store=shared, clock=clock,
        )
        second = TranscriptPipeline(
            api=FakeAPI(), cold_store=MemoryColdStore(),
            staging_writer=StagingWriter(lambda s, p: None),
            extractor=FakeExtractor(), lock_store=shared, clock=clock,
        )
        shared["media_transcripts_extraction_running"] = clock()
        summary = second.run_batch(["vid1"])
        self.assertIn("error", summary)
        self.assertEqual(summary["stored"], 0)
        self.assertEqual(summary["deferred"], 1)

    def test_lease_is_released_so_the_next_run_proceeds(self):
        shared = {}
        pipeline, _, _ = build()
        pipeline.lock_store = shared
        pipeline.run_batch(["vid1"])
        self.assertEqual(shared, {})
        self.assertEqual(pipeline.run_batch(["vid1"])["stored"], 1)

    def test_deadline_defers_the_remainder_instead_of_overrunning(self):
        clock = Clock()
        videos = {
            "v{0}".format(n): dict(META, video_id="v{0}".format(n)) for n in range(3)
        }
        pipeline, _, _ = build(
            api=FakeAPI(videos=videos),
            extractor=FakeExtractor(clock=clock, cost=6.0),
            clock=clock,
        )
        summary = pipeline.run_batch(["v0", "v1", "v2"], budget_seconds=10.0)
        self.assertEqual(summary["stored"], 2)
        self.assertEqual(summary["deferred"], 1)
        self.assertEqual(summary["deferred_ids"], ["v2"])

    def test_max_videos_bounds_the_batch(self):
        videos = {
            "v{0}".format(n): dict(META, video_id="v{0}".format(n)) for n in range(10)
        }
        pipeline, _, _ = build(api=FakeAPI(videos=videos))
        summary = pipeline.run_batch(list(videos), max_videos=3)
        self.assertEqual(summary["requested"], 3)
        self.assertEqual(summary["stored"], 3)

    def test_empty_input_does_no_work(self):
        api = FakeAPI()
        pipeline, _, _ = build(api=api)
        summary = pipeline.run_batch([])
        self.assertEqual(summary["requested"], 0)
        self.assertEqual(api.requested, [], "no quota may be spent on an empty batch")

    def test_metadata_is_fetched_in_one_batched_call(self):
        videos = {
            "v{0}".format(n): dict(META, video_id="v{0}".format(n)) for n in range(5)
        }
        api = FakeAPI(videos=videos)
        pipeline, _, _ = build(api=api)
        pipeline.run_batch(list(videos))
        self.assertEqual(len(api.requested), 1, "one call for the whole batch")


class TestOutcome(unittest.TestCase):
    def test_as_dict_shape(self):
        outcome = ProcessOutcome("vid1", ProcessOutcome.STORED, "", {
            "raw_vtt_storage_key": "k", "segments": [1, 2]})
        self.assertEqual(
            outcome.as_dict(),
            {"video_id": "vid1", "status": "STORED", "detail": "",
             "storage_key": "k", "segment_count": 2},
        )


if __name__ == "__main__":
    unittest.main()
