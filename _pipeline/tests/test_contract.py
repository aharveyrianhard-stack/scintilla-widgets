"""The extraction -> sentiment payload contract."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from youtube_transcripts.contract import (  # noqa: E402
    CONTRACT_VERSION,
    PROCESSING_STATUSES,
    ContractError,
    assert_valid,
    build_payload,
    validate_payload,
)

SEGMENTS = [
    {"start": "00:00:01.000", "end": "00:00:02.000", "start_sec": 1.0,
     "end_sec": 2.0, "text": "Gold is bid"}
]

VALID = dict(
    video_id="vid1",
    channel_id="UCabc",
    title="Macro update",
    published_at="2026-08-21T10:00:00Z",
    raw_vtt_storage_key="raw/vtt/UCabc/2026/08/vid1.vtt.gz",
    full_transcript_text="Gold is bid",
    segments=SEGMENTS,
)


class TestValidPayload(unittest.TestCase):
    def test_builds_and_validates(self):
        payload = build_payload(**VALID)
        self.assertEqual(validate_payload(payload), [])
        self.assertEqual(payload["contract_version"], CONTRACT_VERSION)
        self.assertEqual(payload["processing_status"], "PENDING_ANALYSIS")
        self.assertEqual(payload["metadata"], {})

    def test_every_declared_status_is_accepted(self):
        for status in PROCESSING_STATUSES:
            payload = build_payload(processing_status=status, **VALID)
            self.assertEqual(validate_payload(payload), [])


class TestColumnWidths(unittest.TestCase):
    """Widths are checked here so the database is not the first to notice."""

    def test_video_id_over_32(self):
        errors = validate_payload(dict(build_payload(**VALID), video_id="v" * 33))
        self.assertTrue(any("video_id" in e and "32" in e for e in errors))

    def test_channel_id_over_64(self):
        errors = validate_payload(dict(build_payload(**VALID), channel_id="U" * 65))
        self.assertTrue(any("channel_id" in e and "64" in e for e in errors))

    def test_storage_key_over_255(self):
        errors = validate_payload(
            dict(build_payload(**VALID), raw_vtt_storage_key="k" * 256)
        )
        self.assertTrue(any("raw_vtt_storage_key" in e for e in errors))

    def test_exact_boundary_is_accepted(self):
        payload = build_payload(**dict(VALID, video_id="v" * 32, channel_id="U" * 64))
        self.assertEqual(validate_payload(payload), [])


class TestRejections(unittest.TestCase):
    def test_missing_required_fields(self):
        self.assertTrue(validate_payload({}))

    def test_not_an_object(self):
        for value in ("string", 42, None, []):
            self.assertTrue(validate_payload(value))

    def test_blank_required_text(self):
        for field in ("video_id", "channel_id", "title", "full_transcript_text"):
            errors = validate_payload(dict(build_payload(**VALID), **{field: "   "}))
            self.assertTrue(any(field in e for e in errors), field)

    def test_timestamp_forms(self):
        base = build_payload(**VALID)
        for good in ("2026-08-21T10:00:00Z", "2026-08-21T10:00:00.123Z",
                     "2026-08-21T10:00:00+00:00", "2026-08-21 10:00:00+0000"):
            self.assertEqual(validate_payload(dict(base, published_at=good)), [], good)
        for bad in ("21-08-2026", "2026-08-21", "", None, 1755772800, "yesterday"):
            self.assertTrue(validate_payload(dict(base, published_at=bad)), bad)

    def test_empty_segments_are_refused(self):
        errors = validate_payload(dict(build_payload(**VALID), segments=[]))
        self.assertTrue(any("segments" in e for e in errors))

    def test_segment_shape_is_enforced(self):
        base = build_payload(**VALID)
        for bad in ([{"start": "a"}], [{"start": "a", "end": "b", "text": ""}],
                    ["not-an-object"], [{"start": 1, "end": 2, "text": "x"}]):
            self.assertTrue(validate_payload(dict(base, segments=bad)), bad)

    def test_reversed_segment_window_is_refused(self):
        bad = [{"start": "00:00:09.000", "end": "00:00:01.000",
                "start_sec": 9.0, "end_sec": 1.0, "text": "backwards"}]
        errors = validate_payload(dict(build_payload(**VALID), segments=bad))
        self.assertTrue(any("precedes" in e for e in errors))

    def test_boolean_is_not_accepted_as_a_number(self):
        bad = [{"start": "a", "end": "b", "text": "x", "start_sec": True,
                "end_sec": 2.0}]
        errors = validate_payload(dict(build_payload(**VALID), segments=bad))
        self.assertTrue(any("start_sec" in e for e in errors))

    def test_null_segment_seconds_are_allowed(self):
        ok = [{"start": "a", "end": "b", "text": "x", "start_sec": None,
               "end_sec": None}]
        self.assertEqual(validate_payload(dict(build_payload(**VALID), segments=ok)), [])

    def test_unknown_processing_status(self):
        errors = validate_payload(
            dict(build_payload(**VALID), processing_status="MAYBE")
        )
        self.assertTrue(any("processing_status" in e for e in errors))

    def test_metadata_must_be_an_object(self):
        errors = validate_payload(dict(build_payload(**VALID), metadata=["nope"]))
        self.assertTrue(any("metadata" in e for e in errors))

    def test_assert_valid_raises_with_every_reason(self):
        with self.assertRaises(ContractError) as ctx:
            assert_valid({"video_id": "v" * 40, "segments": []})
        message = str(ctx.exception)
        self.assertIn("video_id", message)
        self.assertIn("segments", message)

    def test_build_payload_refuses_to_return_an_invalid_record(self):
        with self.assertRaises(ContractError):
            build_payload(**dict(VALID, segments=[]))


if __name__ == "__main__":
    unittest.main()
