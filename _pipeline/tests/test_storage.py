"""Storage routing and the isolation constraint."""

import gzip
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from youtube_transcripts.contract import ContractError, build_payload  # noqa: E402
from youtube_transcripts.storage import (  # noqa: E402
    ISOLATED_SCHEMA,
    PRODUCTION_SCHEMAS,
    PROTECTED_TABLES,
    IsolationViolation,
    MemoryColdStore,
    R2ColdStore,
    StagingWriter,
    transcript_key,
)

SEGMENTS = [
    {"start": "00:00:01.000", "end": "00:00:02.000", "start_sec": 1.0,
     "end_sec": 2.0, "text": "Gold is bid"}
]


def payload(**overrides):
    base = dict(
        video_id="vid1",
        channel_id="UCabc",
        title="Macro update",
        published_at="2026-08-21T10:00:00Z",
        raw_vtt_storage_key="raw/vtt/UCabc/2026/08/vid1.vtt.gz",
        full_transcript_text="Gold is bid",
        segments=SEGMENTS,
    )
    base.update(overrides)
    return build_payload(**base)


class TestTranscriptKey(unittest.TestCase):
    def test_partitioned_layout(self):
        self.assertEqual(
            transcript_key("vid1", "UCabc", "2026-08-21T10:00:00Z"),
            "raw/vtt/UCabc/2026/08/vid1.vtt.gz",
        )

    def test_missing_publish_date_still_produces_a_key(self):
        self.assertEqual(
            transcript_key("vid1", "UCabc", None),
            "raw/vtt/UCabc/unknown/unknown/vid1.vtt.gz",
        )

    def test_path_traversal_is_neutralized(self):
        key = transcript_key("../../etc/passwd", "../..", "2026-08-21T00:00:00Z")
        self.assertNotIn("..", key)
        self.assertNotIn("/etc/", key)

    def test_key_stays_within_the_column_width(self):
        self.assertLessEqual(
            len(transcript_key("v" * 32, "U" * 64, "2026-08-21T00:00:00Z")), 255
        )

    def test_oversize_key_is_refused_rather_than_truncated(self):
        with self.assertRaises(ValueError):
            transcript_key("v" * 32, "U" * 400, "2026-08-21T00:00:00Z")

    def test_video_id_is_required(self):
        with self.assertRaises(ValueError):
            transcript_key("", "UCabc", None)

    def test_key_is_deterministic(self):
        args = ("vid1", "UCabc", "2026-08-21T10:00:00Z")
        self.assertEqual(transcript_key(*args), transcript_key(*args))


class TestIsolationConstraint(unittest.TestCase):
    """Zero contamination has to be enforced, not merely documented."""

    def test_default_target_is_the_isolated_schema(self):
        writer = StagingWriter(lambda sql, params: None)
        self.assertEqual(
            writer.qualified_name,
            "{0}.media_transcripts_staging".format(ISOLATED_SCHEMA),
        )

    def test_every_production_schema_is_refused(self):
        for schema in PRODUCTION_SCHEMAS:
            with self.assertRaises(IsolationViolation):
                StagingWriter(lambda sql, params: None, schema=schema)

    def test_every_protected_core_table_is_refused(self):
        for table in PROTECTED_TABLES:
            with self.assertRaises(IsolationViolation):
                StagingWriter(lambda sql, params: None, table=table)

    def test_identifier_injection_is_refused(self):
        for bad in ("x; drop table youtube_videos", "public.youtube_videos",
                    'a"b', "1abc", "", "  "):
            with self.assertRaises(IsolationViolation):
                StagingWriter(lambda sql, params: None, schema=bad)

    def test_case_and_padding_do_not_bypass_the_guard(self):
        for bad in ("PUBLIC", "  public  ", "Public"):
            with self.assertRaises(IsolationViolation):
                StagingWriter(lambda sql, params: None, schema=bad)

    def test_a_purpose_built_isolated_schema_is_allowed(self):
        writer = StagingWriter(lambda sql, params: None, schema="media_ingest_sandbox")
        self.assertEqual(writer.schema, "media_ingest_sandbox")


class TestStagingWrite(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.writer = StagingWriter(lambda sql, params: self.calls.append((sql, params)))

    def test_writes_a_parameterized_upsert(self):
        self.writer.write(payload())
        sql, params = self.calls[0]
        self.assertIn("insert into media_ingest.media_transcripts_staging", sql)
        self.assertIn("on conflict (video_id) do update", sql)
        self.assertEqual(sql.count("%s"), 9)
        self.assertEqual(len(params), 9)

    def test_values_are_bound_never_interpolated(self):
        self.writer.write(payload(title="Robert'); drop table students;--"))
        sql, params = self.calls[0]
        self.assertNotIn("drop table", sql)
        self.assertIn("drop table students", params[2])

    def test_jsonb_columns_are_serialized(self):
        self.writer.write(payload())
        params = self.calls[0][1]
        self.assertIsInstance(params[6], str)
        self.assertIsInstance(params[7], str)
        self.assertIn("Gold is bid", params[6])

    def test_invalid_payload_never_reaches_the_database(self):
        with self.assertRaises(ContractError):
            self.writer.write({"video_id": "vid1"})
        self.assertEqual(self.calls, [], "no SQL may be issued for a bad payload")

    def test_write_many(self):
        self.writer.write_many([payload(video_id="a"), payload(video_id="b")])
        self.assertEqual(len(self.calls), 2)


class TestColdStore(unittest.TestCase):
    def test_memory_store_roundtrip(self):
        store = MemoryColdStore()
        store.put_transcript("k", "WEBVTT\n\nhello")
        self.assertEqual(store.get_transcript("k"), "WEBVTT\n\nhello")

    def test_r2_uploads_gzipped_with_correct_headers(self):
        class FakeS3(object):
            def __init__(self):
                self.puts = []

            def put_object(self, **kwargs):
                self.puts.append(kwargs)

        fake = FakeS3()
        store = R2ColdStore(bucket="scintilla-transcripts-cold", client=fake)
        store.put_transcript("raw/vtt/x.vtt.gz", "WEBVTT\n\nhello",
                             metadata={"video_id": "vid1"})
        put = fake.puts[0]
        self.assertEqual(put["Bucket"], "scintilla-transcripts-cold")
        self.assertEqual(put["ContentEncoding"], "gzip")
        self.assertEqual(put["Metadata"]["video_id"], "vid1")
        self.assertEqual(
            gzip.decompress(put["Body"].read()).decode("utf-8"), "WEBVTT\n\nhello"
        )

    def test_r2_requires_an_endpoint_when_no_client_is_supplied(self):
        with self.assertRaises((ValueError, ImportError)):
            R2ColdStore().client()

    def test_unicode_survives_the_roundtrip(self):
        store = MemoryColdStore()
        text = "WEBVTT\n\n日経平均 — the Nikkei rallied 2%"
        store.put_transcript("k", text)
        self.assertEqual(store.get_transcript("k"), text)


if __name__ == "__main__":
    unittest.main()
